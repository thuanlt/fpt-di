# GPU Pool v0.3 — Đề xuất Giải pháp cho Rủi ro & Lỗ hổng

> Nguồn đầu vào: `docs/gpu-pool-arc42-v0.3-summary-risk-analysis.md` (R1–R12, L1–L5)
> Góc nhìn: cloud infrastructure + Well-Architected (Reliability, Performance, Cost, Security)
> Nguyên tắc: ưu tiên **bảo vệ bất biến I1–I7** trước, sau đó mới tối ưu; mỗi giải pháp ghi rõ chi phí ảnh hưởng và phase triển khai.
> Ngày: 2026-08-28

---

# PHẦN A — GIẢI PHÁP CHO RỦI RO CRITICAL

## A1. R1 — Ngăn double allocation: Postgres là source of truth duy nhất

**Nguyên tắc:** Redis chỉ là *fast-path cache + lock ngắn hạn*. Mọi quyết định cấp GPU exclusive **bắt buộc commit qua Postgres** trong 1 transaction.

### Protocol 2 giai đoạn (fast-path + commit)

```
GIAI ĐOẠN 1 — Fast path (Redis, ~ms):
  DECRBY pool:available:{pool_id} {gpu_count}
  nếu kết quả < 0  → INCRBY hoàn tác + từ chối ngay (không chạm Postgres)

GIAI ĐOẠN 2 — Commit (Postgres, 1 transaction):
  BEGIN;
    SELECT id FROM physical_gpus WHERE id = ANY($gpu_ids) FOR UPDATE;   -- row lock
    INSERT INTO gpu_allocations (allocation_group_id, gpu_id, status)
    VALUES ... ;                                                        -- unique index chặn trùng
    UPDATE physical_gpus SET status = 'allocated' WHERE id = ANY($gpu_ids);
  COMMIT;
  Nếu lỗi → ROLLBACK + INCRBY pool:available (hoàn tác fast path)
```

### Rào chắn vật lý (defense-in-depth)

```sql
-- Partial unique index: 1 GPU active chỉ thuộc MỘT allocation
CREATE UNIQUE INDEX uq_gpu_active_allocation
  ON gpu_allocations (gpu_id)
  WHERE status IN ('RESERVED','ALLOCATING','ALLOCATED','RUNNING');
```

Ngay cả khi code bug, **engine DB từ chối** double allocation → I1 được đảm bảo ở tầng hạ tầng, không phải tầng ứng dụng.

### Reconciliation (safety net)

- Agent báo trạng thái GPU thực tế mỗi 15s (event `GPU_CAPACITY_CHANGED`)
- CP diff Postgres ↔ báo cáo agent mỗi 5 phút; lệch → đánh dấu GPU `QUARANTINE` + alert `ALLOCATION_DRIFT`
- Metric mới: `gpu_allocation_drift_total`

**Chi phí:** không thêm component (Postgres/Redis đã có). Công sức: ~2 tuần (schema + protocol + reconciliation). **Phase 1 — bắt buộc trước GA Dedicated.**

---

## A2. R2 — Multi-GPU atomicity: giao atomicity cho K8s bằng gang scheduling

**Nhận định:** CP không thể đảm bảo atomicity ở tầng vật lý (device plugin drift, GPU hỏng giữa chừng). Địa điểm đúng để đảm bảo "8 GPU hoặc 0" là **K8s scheduler** — qua **gang scheduling**.

### Giải pháp: Kueue (CNCF) + K8s native

1. **Mỗi cluster GPU cài Kueue** (open-source, 1 operator nhỏ):
   - `ClusterQueue` per capacity pool (dedicated/serverless/training)
   - `ResourceFlavor` per resource class (`h100-full`, `h100-mig-1g`, ...)
   - Pod multi-GPU (`nvidia.com/gpu: 8`) chỉ được admit khi **đủ cả 8** — K8s bind nguyên tử, không có trạng thái "3/8"
2. **CP mapping**: 1 `GPUAllocationGroup` → 1 Kueue `ResourceRequest` (Pod template do agent render)
3. **Bonus — Kueue cohort + borrowing mô tả đúng SOFT reservation**:
   - Dedicated pool = ClusterQueue có **guaranteed quota** (không bao giờ bị borrow)
   - Serverless pool = ClusterQueue **borrowable** trong cohort
   - Kueue tự reclaim quota borrow khi owner cần → **thay thế phần lớn logic reclaim thủ công của R3**
4. **Fallback nếu không dùng Kueue** (Volcano gang-scheduling hoặc native `schedulingGates`): thêm trạng thái `PARTIALLY_ALLOCATED` + compensation timer 60s + lệnh `RELEASE` idempotent cho các GPU đã bind.

**Chi phí:** Kueue open-source, runtime cost ~2–4 vCPU/cluster. Công sức: ~3 tuần (integration agent + mapping). **Phase 3** (khi multi-GPU vào scope) nhưng nên pilot sớm ở Phase 1–2 cho trường hợp 2–4 GPU.

---

## A3. R3 — SOFT reclaim race: Capacity Promise + single-writer

**Vấn đề gốc:** 2 Dedicated request đồng thời đều "hứa" reclaim cùng 1 capacity → over-commit.

### Giải pháp: Capacity Promise (hứa có ràng buộc, có TTL)

```
Dedicated request đến:
1. Kiểm tra Postgres (source of truth):
     available + reclaimable ≥ gpu_count ?
2. INSERT capacity_promise (pool_id, request_id, gpu_count,
     status='PENDING_RECLAIM', expires_at = now() + 120s)
   -- UNIQUE (pool_id, request_id) + kiểm tra tổng promesse pending
     không vượt reclaimable → từ chối request thứ 2 ngay
3. Reclaim Coordinator (single-writer, pg_advisory_xact_lock(pool_id)):
     phát lệnh scale-down cho Serverless replicas (deadline = TTL)
4. Drained trong TTL  → promise FULFILLED → tiến hành allocation
   Hết TTL chưa đủ  → promise EXPIRED → fallback:
     a) thử cluster/region khác (Global Scheduler re-plan)
     b) queue với vị trí ưu tiên
     c) reject rõ ràng (lỗi "capacity không khả dụng trong SLA")
```

### Preemption policy — NÂNG TỪ PHASE 5 LÊN PHASE 2

SOFT reservation đã hàm ý preemption từ Phase 1–2, nên policy phải định nghĩa sớm:

| Workload bị preempt | Grace period | Điều kiện |
|---|---|---|
| Serverless (giữa 2 request) | 0s — drain tại request boundary | luôn được |
| Serverless (đang serve) | 30s — hoàn tất request hiện tại | được |
| Notebook | 60s — auto-save | được, thông báo trước |
| Training (có checkpoint) | 5 min — ghi checkpoint | được nếu checkpoint interval ≤ 5 min |
| Training (không checkpoint) | — | **KHÔNG preempt** — chọn cluster khác |
| Dedicated | — | **KHÔNG BAO GIỜ** |

**Compensation:** metering đánh dấu workload bị preempt → billing không tính phần bị cắt (chính sách cần PM xác nhận).

**Chi phí:** bảng `capacity_promise` + advisory lock (Postgres native, free). Công sức: ~3 tuần. **Phase 2** (khi SOFT pool kích hoạt).

---

# PHẦN B — GIẢI PHÁP CHO RỦI RO HIGH

## B1. R4 — Control Plane HA

### Topology

```
CP: 3 replicas, rải 3 AZ
  - Stateless API: load-balanced
  - Scheduler/Coordinator: leader election (K8s Lease hoặc pg_advisory_lock)
  - RTO failover < 60s
Postgres: primary + 2 replicas (Patroni), synchronous commit cho bảng allocations
Redis: 3 nodes sentinel
```

### In-flight allocation khi CP chết (bổ sung I5)

1. Mỗi allocation có `last_intent` + `lease_owner` + `lease_expiry` trong Postgres
2. **Agent KHÔNG bao giờ tự release** — chỉ CP (leader hợp lệ) phát lệnh release (chống split-brain)
3. CP down: agent giữ workload chạy (I5), queue lệnh mới local (durable)
4. CP mới lên:
   - Re-acquire lease hết hạn
   - Agent re-sync toàn bộ trạng thái thực tế (GPU, workload, model)
   - Allocation kẹt `ALLOCATING` → đối chiếu thực tế: đủ → `ALLOCATED`; thiếu → compensate (theo A2)
5. RPO: PITR Postgres ~5 phút; bảng allocation đồng bộ → RPO ≈ 0 cho state allocation

**Chi phí:** 3 VM nhỏ cho CP (2–4 vCPU/8GB mỗi cái — CP là control plane nhẹ), Postgres HA. Đây là chi phí **bắt buộc** cho control plane production. **Phase 1.**

---

## B2. R5 — Race scale-to-zero vs request: Pin mechanism

### Cơ chế pin bằng conditional UPDATE (giải quyết TOCTOU)

```sql
-- Router muốn giữ replica (gọi trước khi route request):
UPDATE model_replicas
SET pin_count = pin_count + 1
WHERE id = $1 AND status IN ('IDLE','EVICTING') AND pin_count < 4;
-- affected = 1 → pin OK, route request
-- affected = 0 → eviction đã thắng → đi cold path

-- Eviction controller (chỉ evict khi không ai pin):
UPDATE model_replicas
SET status = 'EVICTING'
WHERE id = $1 AND status IN ('IDLE','SERVING') AND pin_count = 0;
```

- Pin có TTL 30s (auto-expire nếu request chết giữa chừng)
- `pin_count` là cột mới trên `model_replicas`

**Chi phí:** negligible (1 cột + 2 conditional update). **Phase 4** (khi scale-to-zero vào scope).

---

## B3. R6 — MIG reconfiguration: planned operation, không inline

### Quy trình 5 bước (Partition Manager)

```
1. PLANNED     — tính target layout (bin-packing theo demand forecast resource class)
2. DRAINING    — chỉ khi GPU idle > 10 phút HOẶC maintenance window
                 (Serverless drain trước; Dedicated KHÔNG tự động — cần migration plan)
3. RECONFIGURING — agent chạy nvidia-smi mig, báo cáo từng bước
4. APPLIED     — cập nhật inventory (MIG UUID mới) + bump layout_version
                 → scheduler mới thấy layout mới sau khi APPLIED
5. FAILED      — rollback về layout cũ (layout trước luôn được giữ)
```

### Guardrails

- Max **1 reconfig/GPU/giờ**; layout versioning để reconcile
- Alert khi reconfig fail 2 lần liên tiếp → GPU quarantine
- Metric: `mig_reconfig_duration`, `mig_reconfig_failure_total`

**Chi phí:** công sức ~3 tuần, không thêm hạ tầng. **Phase 2.**

---

## B4. R7 — Agent ↔ CP: idempotency + fencing + anti-flapping

### Command envelope (mọi lệnh CP → agent)

```json
{
  "command_id": "01J9X...ULID",
  "fence_epoch": 42,
  "type": "ALLOCATE | RELEASE | EVICT | MIG_RECONFIG",
  "allocation_id": "alloc-123",
  "issued_at": "2026-08-28T10:00:00Z"
}
```

- **Idempotency**: agent lưu `command_id` đã xử lý (SQLite local, LRU 10k). Lệnh trùng → ACK không re-execute. CP retry an toàn.
- **Fencing**: agent từ chối lệnh có `fence_epoch` cũ hơn epoch hiện tại → chặn lệnh stale từ CP cũ sau failover.
- **Kafka ordering**: partition key = `cluster_id` (GPU/allocation events), `model_id` (model events) → thứ tự per-entity.

### Heartbeat anti-flapping

```
Agent → CP: heartbeat 10s
Mất 3 heartbeat (30s)  → cluster STALE (không cấp allocation mới)
STALE → CONNECTED: cần 2 heartbeat liên tiếp OK
Minimum STALE duration: 60s (chống bật tắt liên tục do mạng chập chờn)
```

**Chi phí:** negligible. **Phase 1** (idempotency) / Phase 2 (fencing khi CP HA hoạt động).

---

# PHẦN C — GIẢI PHÁP CHO RỦI RO MEDIUM

## C1. R8 — Billing time-slicing: bill theo reserved capacity, đo bằng DCGM để audit

| Mục | Phương án |
|---|---|
| **Billing** | Bill theo **reserved capacity** của resource class (VD: `h100-shared` = 1/4 GPU-hour) — dự đoán được, đơn giản, khớp "khách trả tiền cho slice đã mua" |
| **Metering/audit** | DCGM per-container GPU utilization (driver mới hỗ trợ cgroup accounting) — dùng cho giải quyết khiếu nại, KHÔNG dùng để billing trực tiếp |
| **Granularity** | 1 phút (chuẩn ngành; AWS/GCP per-second có minimum 1 phút) |

**Chi phí:** DCGM đã có trong kiến trúc; chỉ thay đổi metering adapter. **Phase 2.**

## C2. R9 — Warm pool cost control (từ Phase 4, không đợi Phase 5)

```
Bảng model_warm_policies:
  model_id, min_replicas, max_replicas,
  warm_ttl_minutes (mặc định: 30 phút model popular / 10 phút khác),
  priority

Giới hạn toàn cục:
  warm_pool_gpu_cap = 10% capacity Serverless pool (cấu hình per-cluster)
  Vượt cap → auto-shrink theo priority thấp nhất

Metric mới: model_warm_idle_gpu_hours (chi phí idle có thể đo được)
Alert: warm pool GPU-hours > budget ngày → tự shrink + thông báo
```

**Chi phí:** đây chính là giải pháp tiết kiệm — ước tính giảm 15–30% GPU idle chi phí cho serverless. **Phase 4.**

## C3. R10 — Model artifact cross-region

1. **Object storage multi-region replication** (S3 CRR / MinIO site replication) cho bucket model artifacts
2. **P2P cache handoff**: khi replica đặt ở cluster mới, agent kéo từ **NVMe của cluster peer** trước (nhanh, không tốn egress) → fallback object storage
3. **Checksum bắt buộc**: verify SHA-256 sau mỗi load (trường `ModelCache.checksum` đã có — enforce nó, không chỉ lưu)
4. Artifact > 50GB: split thành shards + verify per-shard (chống tải lại toàn bộ khi 1 shard lỗi)

**Chi phí:** storage replication = artifact size × số region (trung bình); P2P handoff tiết kiệm đáng kể egress cost. **Phase 3–4.**

## C4. R11 — Node auto-provisioning (Phase 5, nhưng thiết kế interface từ Phase 1)

```
Capacity Forecaster:
  - Input: utilization 7 ngày + Dedicated commitments (BIẾT TRƯỚC — tín hiệu tốt nhất)
  - Rule: pool utilization 7d > 80% HOẶC commitment đến gần (T-7 ngày) → đề xuất provision

Provisioning flow:
  OpenStack Provider Create VM (GPU flavor)
  → auto-join K8s (GPU Operator tự cài)
  → agent discover → inventory → pool

Guardrails (cost control):
  - Max nodes auto-provision per pool (VD: 10)
  - Dưới ngưỡng $X/ngày → auto-approve; vượt → human approval
  - Dedicated commitment: pre-provision theo ngày bắt đầu (tránh over/under-provision)
```

**Chi phí:** giảm over-provisioning (thường 20–30% capacity mua thừa). **Phase 5**, interface `CreateVM/DeleteVM` đã có trong provider spec (mục 11.3).

## C5. R12 — Partial model load recovery

```
Load protocol (agent):
1. Download → <model>.tmp trên NVMe
2. Verify SHA-256 với ModelArtifact.checksum
3. Atomic rename → tên final
4. MỚI đánh dấu WARM_CACHE
5. Crash giữa chừng → startup cleanup job xóa *.tmp (orphan: mtime > 2h)

GPU load fail:
  Agent restart → kiểm tra runtime process; state LOADING nhưng process chết
  → mark FAILED → retry 1 lần → evict về COLD
```

**Chi phí:** negligible. **Phase 4.**

---

# PHẦN D — GIẢI PHÁP CHO LỖ HỔNG TÀI LIỆU (L1–L5)

## D1. L1 — Quality scenarios có số đo (bổ sung vào Arc42 §quality)

| Scenario | Target |
|---|---|
| Allocation latency p99 — single GPU | < 5s |
| Allocation latency p99 — 8-GPU group | < 30s |
| CP availability | 99.9% (~43 phút downtime/tháng) |
| CP failover RTO | < 60s |
| Cold start từ WARM (model ≤ 10GB) | < 60s |
| Cold start từ COLD (model ≤ 100GB) | < 5 phút |
| Warm resume (scale-to-zero → serve) | < 30s |
| Reclaim SLA (SOFT → Dedicated) | p95 < 90s |
| Double allocation | 0 (invariant — monitored, không phải target) |

## D2. L2 — ADR-009: lựa chọn data stores

| Store | Chọn | Lý do | Alternatives đã loại |
|---|---|---|---|
| **PostgreSQL** | Source of truth durable state | Transactional integrity cho allocation commit, partial unique index (I1), advisory lock cho coordination | etcd (quá low-level cho domain này), MongoDB (transaction guarantee yếu hơn cho commit allocation) |
| **Redis** | Cache capacity + distributed lock | Sub-ms cho hot scheduling path (nghìn GPU) | Chỉ Postgres (quá chậm cho scheduler hot path) |
| **Kafka** | Event backbone | Decoupling, replay cho metering/billing audit | NATS (replay yếu hơn), event-sourcing trong Postgres (phức tạp vận hành) |

**Ghi rõ trong ADR:** events là **notification-only** (không event-sourcing) — reconciliation là safety net (khớp §37).

## D3. L3 — Kafka semantics

- **Delivery**: at-least-once + **idempotent consumers** (mọi handler idempotent — khớp B4)
- **Retention**: 7 ngày (operational events) / 90 ngày (metering events — audit billing)
- **Partitioning**: partition key = `cluster_id` (GPU events), `model_id` (model events), `allocation_id` (allocation events) → thứ tự per-entity
- **DLQ** cho poison message + alert

## D4. L4 — Security multi-tenancy (least privilege)

| Tầng | Giải pháp |
|---|---|
| **GPU isolation** | Policy sản phẩm: Dedicated cần isolation → Full GPU / MIG / Dedicated Node. Time-slice chỉ cho Serverless (multi-tenant chấp nhận được, **tài liệu hóa rõ** rủi ro side-channel HBM — chấp nhận có chủ đích) |
| **Agent RBAC** | Service account riêng per agent: get/list nodes+GPUs, create/delete pods **chỉ trong namespace `gpu-pool`**. Cấm `cluster-admin`. Workload tenant: namespace per-tenant + NetworkPolicy |
| **OpenStack** | 2 bộ credential tách biệt: (1) read-only inventory (Get VM/Host/AZ/Hypervisor) per project+region; (2) write (Create/Delete VM) chỉ cho GPU VM flow — scope theo project/region/cluster |
| **CP ↔ Agent** | mTLS, certificate per agent (identity kiểu SPIFFE), audit log cho mọi quyết định allocation (ai, khi nào, GPU nào, vì sao) |

## D5. L5 — Deployment view (bổ sung §35)

```
CP:        3 replicas / 3 AZ (K8s Deployment), leader election
Postgres:  primary + 2 replicas (Patroni), synchronous commit bảng allocations
Redis:     3 nodes + sentinel
Kafka:     3 brokers
Agent:     2 replicas/cluster (active-passive, leader election) — chống node failure
RTO:       CP < 60s | Postgres < 5 min (Patroni failover) | Agent < 30s
```

---

# PHẦN E — MA TRẬN ƯU TIÊN TRIỂN KHAI

| Giải pháp | Rủi ro | Phase | Quick win? | Ghi chú |
|---|---|---|---|---|
| A1 — Postgres source of truth + unique index | R1 | **1** | Có (2 tuần) | **Bắt buộc trước GA** |
| B1 — CP HA + in-flight recovery | R4 | **1** | Không (4–6 tuần) | Bắt buộc production |
| B4 — Command idempotency + heartbeat | R7 | **1** | Có (2 tuần) | Fencing khi CP HA chạy |
| D1 — Quality scenarios có số | L1 | **1** | Có (1 tuần) | Làm ngay — làm cơ sở acceptance test |
| D4 — Agent RBAC + credential scoping | L4 | **1** | Có (2 tuần) | Least privilege sớm |
| A2 — Kueue gang scheduling | R2 | 3 (pilot 1–2) | Không (3 tuần) | Pilot với 2–4 GPU trước |
| A3 — Capacity Promise + preemption policy | R3 | **2** | Không (3 tuần) | Kèm chính sách billing preempt |
| B3 — MIG reconfig coordination | R6 | **2** | Không (3 tuần) | Guardrails từ đầu |
| C1 — Billing reserved capacity | R8 | **2** | Có (2 tuần) | PM xác nhận chính sách |
| D2/D3 — ADR data stores + Kafka semantics | L2, L3 | **2** | Có (1 tuần) | Tài liệu hóa quyết định đã ngầm chọn |
| B2 — Pin mechanism | R5 | 4 | Có (1 tuần) | Đơn giản, làm cùng scale-to-zero |
| C2 — Warm pool policy | R9 | 4 | Có (2 tuần) | Tiết kiệm chi phí trực tiếp |
| C3 — Artifact cross-region + checksum | R10 | 3–4 | Không (3 tuần) | |
| C5 — Partial load recovery | R12 | 4 | Có (1 tuần) | tmp+rename+checksum |
| D5 — Deployment view | L5 | 1–2 | Có (1 tuần) | |
| C4 — Node auto-provisioning | R11 | 5 | Không (6+ tuần) | Forecaster + cost gates |

## Tổng kết chi phí ảnh hưởng

| Hạng mục | Chi phí | Loại |
|---|---|---|
| Kueue operator | ~2–4 vCPU/cluster, open-source | Runtime nhỏ |
| CP 3 replicas | 3 × (2–4 vCPU/8GB) | VM nhỏ, bắt buộc |
| Postgres HA (Patroni) | +2 replica instances | Bắt buộc production |
| Redis sentinel | +2 nodes | Bắt buộc production |
| Storage replication | artifact size × regions | Trung bình, P2P handoff bù egress |
| **Tiết kiệm ước tính** | Warm pool −15–30% GPU idle; auto-provisioning −20–30% over-provisioning | **Dương về tổng** |

**Kết luận:** Tổng chi phí thêm của các giải pháp là **moderate** (chủ yếu CP HA + Postgres HA — vốn là yêu cầu production chuẩn), trong khi 2 giải pháp cost-control (warm pool policy, auto-provisioning) **tạo ra tiết kiệm vượt chi phí đầu tư** từ Phase 4–5.

## Top 3 việc nên làm NGAY (trước Phase 1 GA)

1. **A1** — unique index + commit protocol (2 tuần, chặn double allocation vật lý)
2. **D1** — quality scenarios có số (1 tuần, làm acceptance criteria cho mọi phase)
3. **B4** — command idempotency (2 tuần, nền tảng cho CP HA và mọi retry)