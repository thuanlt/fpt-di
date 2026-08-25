# Deploy lên production — FPT DDI Partner Console

Kiến trúc deploy production cho **FPT DDI partner console** — đối chiếu codebase thật (backend Node + vllm-adapter Node, Postgres 30 bảng, Redis, 3 workers in-process, partner-console tĩnh). Role: cloud-expert → chỉ output doc; mọi quyết định kèm lý do + cost + security.

## 1. Thành phần thật (ground truth)

| Component | Tech | Port | Lưu ý |
|---|---|---|---|
| `backend` | Node 20 (`server.js`) | 3000 | API `/v1/*`, serve partner-console tĩnh, chạy 3 workers (batch/byom/endpoint) in-process |
| `vllm-adapter` | Node 20 (`src/vllm-adapter/server.js`) | 8000 | Proxy `/v1/chat/completions` + `/v1/models` → vLLM thật |
| `partner-console` | HTML/JS tĩnh (`partner-console/`) | Caddy :443 | SPA, cache bust `?v=N` |
| `postgres` | pg15 (migrations 001/002) | 5432 | 30 bảng (partners, customers, ft_jobs, experiments, sla, ptu…) + `endpoint_usage` |
| `redis` | 7 (stream `ddi:batch:stream`) | 6379 | Batch queue (consumer group `ddi-workers`) |
| Storage | File `/data/batch`, `/data/byom` | — | Batch input/output + BYOM weights |

## 2. Topology đề nghị (target = Kubernetes, region HAN-2)

```mermaid
flowchart LR
  subgraph Edge
    LB[Ingress NGINX / Caddy TLS]:::edge
  end
  subgraph App
    WEB["web (replica 2-3)<br/>WORKER_MODE=web<br/>API + console"]:::app
    WK["worker (replica 1-2)<br/>WORKER_MODE=worker<br/>batch/byom/endpoint"]:::app
  end
  subgraph Data
    PG[("postgres HA<br/>2 AZ, WAL archive")]:::data
    RD[("redis Sentinel<br/>1 primary + 2 replica")]:::data
    S3[("S3 FSS<br/>bucket backup")]:::data
  end
  subgraph Inference
    VLLM["vllm-adapter<br/>replica 2"]:::app
    GPU["vLLM pods<br/>H100/A30"):::gpu
  end
  LB --> WEB
  LB --> VLLM
  WEB --> PG
  WEB --> RD
  WK --> PG
  WK --> RD
  WK --> S3
  VLLM --> GPU
  WEB --> VLLM
```

Lý do:
- **Tách `web` / `worker`** (Gap 2): `web` stateless scale ngang cho user; `worker` scale theo load queue, không đụng tới request latency.
- **vllm-adapter tách service**: GPU pool độc lập, scale riêng theo throughput; không chạy gửi nhà Node chung với API.
- **Postgres HA 2 AZ + WAL archive**: RPO ≤ 5 phút, RTO ≤ 30 phút (delta từ `db/migrations/001` có 30 bảng nghiệp vụ).
- **Redis Sentinel**: batch queue không đơn-p失效.

## 3. Resource & cost (region HAN-2, on-demand, ước lượng tháng)

| Thành phần | Sizing | VND/tháng (≈) |
|---|---|---|
| web (3 replica) | 1 vCPU / 2 GB mỗi | ~3,000K |
| worker (2) | 2 vCPU / 4 GB mỗi | ~4,000K |
| vllm-adapter (2) | 1 vCPU / 1 GB | ~1,200K |
| postgres HA | 4 vCPU / 16 GB + 200 GB SSD | ~8,000K |
| redis sentinel | 1 vCPU / 2 GB ×3 | ~3,000K |
| GPU vLLM (H100) | 2 pod × H100 | ~120,000K (chiếm >80% bill) |
| Backup + egress | S3 + WAL | ~1,500K |
| **Tổng** | | **≈ 140,000K/tháng** |

Tối ưu cost (ưu tiên theo impact):
1. **GPU commit 91-180d** (COMMIT_MULT 0.73 trong `endpoints/store.js`) → GPU bill × 0.73 = tiết kiệm ~32,000K/tháng.
2. **Worker HPA theo Redis stream lag** (scale worker 1→4 khi queue dài), không giữ fixed 2 replica 24/7.
3. **Postgres reserved (1 năm)**: tiết kiệm ~30% so với on-demand.
4. **vllm-adapter chỉ scale giờ hành chính** nếu traffic nội bộ (cron scale).

## 4. Security & compliance (Nghị định 13/2023 — data residency VN)

- **TLS tại edge**: Caddy ACME Let's Encrypt (auto renew), HSTS `max-age=63072000; preload`.
- **CSP**: `script-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'` (SPA tĩnh, không inline script).
- **Postgres**: SSL-only (`sslmode=require`), secret từ k8s Secret + sealed-secrets cho git.
- **Redis**: `--requirepass`, network policy kafka chỉ cho `web` + `worker`.
- **Secrets**: k8s Secret + SealedSecret (Bitnami) commit vào git; rotate `FPT_DDI_INFERENCE_KEY` 90 ngày.
- **Least privilege**: SA cluster chỉ đọc `pg`/`redis` service (NetworkPolicy default-deny, allow whitelist).
- **Audit log**: API `recordUsage` (đã có) mở rộng sang `key_usage_audit` (Gap 1) → vết admin action; forward stdout đến Loki/ELK.
- **Data residency**: toàn bộ storage chọn region HAN-2 (FSS) — узна `s3-han02.fptcloud.com`, không cross-region egress.

## 5. HA/DR

- **RPO**: Postgres WAL archive mỗi 5 phút + base backup hằng đêm → ≤ 5 phút.
- **RTO**: Pod anti-affinity 2 AZ + readiness probe `/health` (Gap 3 check pg+redis+fs) → pod bad autoscaler 立即 thay, ≤ 30 giây.
- **Backup test**: monthly restore演练 vào staging `pg-restore-test`, check `pg_dump` chạy được.
- **Chaos drill**: chủ định kill 1 web/worker replica 1 tuần/1 lần, verify readiness + HPA.

## 6. Migration plan (zero-downtime, 6 phase)

| Phase | Việc | Risk | Rollback |
|---|---|---|---|
| 1 | Build & push image `backend:v2.1`, `vllm-adapter:v2.1` đến registry nội `registry.fpt.vn/ddi/` | thấp | revert tag |
| 2 | Apply `db/migrations/003-api-keys-and-endpoints.sql` trên staging → smoke test | thấp (additive) | `DROP TABLE` sau backup |
| 3 | Deploy `web` replica 2 (`WORKER_MODE=web`) song song old `backend` (cùng DB/Redis) → route 10% traffic | user thấy 2 phiên bản | giảm traffic về 0% |
| 4 | Deploy `worker` replica 1 (`WORKER_MODE=worker`); stop workers trong old `backend` env | jobs treo nếu thiếu worker | khôi phục workers in old backend |
| 5 | Cutover 100% traffic sang `web` new; ngưng old `backend` | API gián đoạn < 1 phút | LB switch lại old |
| 6 | Cleanup old `backend`, monitor 24h, verify tests/endpoints/batch/inference | — | — |

Mỗi phase có readiness gate (`tests/*/run-tests.js` pass + `/health` 200). Không phase nào destructive mà không có snapshot.

## 7. Runbook launch (acceptance)

```bash
# Build image
podman build -f Dockerfile.backend -t registry.fpt.vn/ddi/backend:v2.1 .
podman build -f Dockerfile.vllm-adapter -t registry.fpt.vn/ddi/vllm-adapter:v2.1 .

# Apply migration (staging trước)
psql $PG_STAGING -f db/migrations/003-api-keys-and-endpoints.sql
for t in keys endpoints batch inference; do DDI_BASE=https://staging-console.fpt-ddi.vn node tests/$t/run-tests.js; done

# Helm install
helm upgrade --install ddi ./deploy/helm -f deploy/values.prod.yaml --namespace ddi-prod

# Verify
curl -sI https://console.fpt-ddi.vn/ | grep -iE "strict-transport|content-security"
curl -s https://console.fpt-ddi.vn/health | jq '.status'   # mong "ok"
kubectl -n ddi-prod rollout status deploy/ddi-web ddi-worker
```

## 8. Cần chốt trước khi ship (blockers)

| # | Block | Hành động |
|---|---|---|
| B1 | `/v1/keys/*` public (`server.js:49`) | khóa bằng admin auth (MFA/SSO/IP allowlist) **trước** Gap 1 |
| B4 | Postgres default `ddi/ddi` | prod override `PG_PASSWORD` + SSL |
| B5 | Redis không password | compose `--requirepass` + NetworkPolicy |
| B6 | `FPT_DDI_INFERENCE_KEY` trống | điền từ sealed-secret trước phase 3 |

Xong 4 block + 4 gap (xem `docs/modernization/fix-4-gaps.md`), partner console sẵn sàng launching cho user nội bộ. Recommend pilot 1 nhóm user nội → monitor 1 tuần → mở dần.
