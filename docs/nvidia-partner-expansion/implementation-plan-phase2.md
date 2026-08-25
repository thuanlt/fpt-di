# Implementation Plan — Phase 2: Mở rộng FPT DDI với NVIDIA

**Phiên bản:** 1.0
**Ngày:** 25/08/2026
**Trạng thái:** Approved — sẵn sàng cho build agent
**Chủ sở hữu:** Thuan Luu Thi (BA/PO)
**Liên quan:** `srs-nvidia-partner-expansion.md`, `user-stories-nvidia-partner-expansion.md`, `api-spec-nvidia-partner-expansion.md`, `wireframes-nvidia-partner-expansion.md`, `estimation-nvidia-partner-expansion.md`, `implementation-plan-phase1.md`

> Blueprint triển khai Phase 2. Mỗi task chỉ rõ file cần sửa, schema, hành vi, tiêu chí chấp nhận. Build agent TUÂN THỦ ĐÚNG — không tự ý đổi thiết kế.

---

## 1. Phạm vi Phase 2

| Story | Mô tả | Ưu tiên |
|-------|-------|---------|
| US-03 | Structured output (JSON Schema) cho chứng khoán | S |
| US-06 | Gói giá theo phân khúc (price pack) | M |
| US-07 | Dashboard KPI theo phân khúc | S |
| US-09 | Tối ưu engine TensorRT-LLM | S |

**Thứ tự triển khai (dependency):** US-06 → US-07 → US-03 → US-09
- US-06 (pricing) trước vì US-07 (dashboard) cần dữ liệu cost theo phân khúc.
- US-03, US-09 độc lập, song song được.

**Nền tảng từ Phase 1 (đã có):** bảng `endpoint_entities` có `segment`, `engine`, `data_residency`; bảng `audit_log`; bảng `guardrail_event`; bảng `model_catalog`; auth role (admin/operator/viewer).

---

## 2. US-06 — Gói giá theo phân khúc

### 2.1 Schema
- Bảng mới `price_pack`:
```sql
CREATE TABLE IF NOT EXISTS price_pack (
  id             TEXT PRIMARY KEY,
  segment        TEXT NOT NULL,
  gpu            TEXT NOT NULL,
  region         TEXT NOT NULL,
  rate_per_hour  NUMERIC(10,4) NOT NULL,
  rate_per_token NUMERIC(14,8),
  commitment     TEXT NOT NULL DEFAULT 'on-demand',
  discount_pct   NUMERIC(5,2) DEFAULT 0,
  quota_rpm      INT,
  quota_tpm      INT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (segment, gpu, region)
);
```
- `endpoint_entities` thêm cột `price_pack_id TEXT`.

### 2.2 Migration — `db/migrations/011-us06-price-pack.sql`
- Tạo `price_pack` + seed gói mẫu (banking H100 HAN-1, coding H100 HAN-1, securities H200 SGN-1).
- ALTER `endpoint_entities` thêm `price_pack_id`.

### 2.3 Backend — module mới `src/pricing/store.js` + `src/pricing/routes.js`
- `create({ segment, gpu, region, rate_per_hour, rate_per_token, commitment, discount_pct, quota_rpm, quota_tpm })` — validate + unique (segment+gpu+region) → 409 nếu trùng.
- `list({ segment, gpu, region })`.
- `getBySegmentGpuRegion(segment, gpu, region)`.
- Routes:
  - `POST /v1/price-packs` (scope admin) — tạo gói.
  - `GET /v1/price-packs` — danh sách, lọc segment/gpu/region.

### 2.4 Backend — `src/endpoints/store.js` + `routes.js`
- Khi tạo endpoint: tự resolve `price_pack_id` theo (segment, gpu, region); nếu có gói → áp rate + quota.
- `rate` trả về = rate_per_hour của gói (thay vì rate mặc định).
- Quota: theo dõi RPM/TPM; vượt → 429.

### 2.5 Frontend
- Tab **Billing** (WF-04): bảng gói giá, nút New pack (modal), Export CSV.
- Modal Deploy: hiển thị estimated price theo gói đã resolve.

### 2.6 Kiểm thử — `tests/us06-pricing/run-tests.js`
- Tạo gói giá → 201.
- Trùng (segment+gpu+region) → 409.
- Endpoint banking H100 HAN-1 → rate đúng gói.
- Vượt quota RPM → 429.
- GET /v1/price-packs?segment=banking → đúng gói.

---

## 3. US-07 — Dashboard KPI theo phân khúc

### 3.1 Schema
- Không bảng mới — aggregate từ `endpoint_usage` (đã có tokens, cost, latency, status_code, created_at) + `guardrail_event` + `endpoint_entities.segment`.

### 3.2 Migration
- Không cần (dùng dữ liệu có sẵn). Có thể thêm index trên `endpoint_usage.created_at` nếu chưa có.

### 3.3 Backend — `src/endpoints/invoke.js` (hoặc module `src/dashboard/routes.js`)
- `GET /v1/dashboard?segment=&range=&format=`:
  - `kpis`: requests, cost_usd, p95_latency_ms, error_rate, guardrail_blocks.
  - `series`: theo bucket thời gian (minute/hour/day) — requests, cost, p95.
  - `format=csv` → trả CSV.
- Lọc theo `segment` (join endpoint_entities).

### 3.4 Frontend
- Tab **Dashboard** (WF-06): KPI cards + line chart + guardrail blocks by rule.
- Dropdown segment, Export CSV.

### 3.5 Kiểm thử — `tests/us07-dashboard/run-tests.js`
- GET /v1/dashboard?segment=banking → KPI đúng.
- Export CSV → file hợp lệ.
- Guardrail blocks khớp guardrail_event.
- Lọc range 24h/7d/30d.

---

## 4. US-03 — Structured output (JSON Schema)

### 4.1 Schema
- Không bảng mới.

### 4.2 Backend — `src/endpoints/invoke.js`
- `POST /endpoints/:id/chat/completions` nhận `response_format`:
```json
{ "type": "json_schema", "json_schema": { "name": "trade", "strict": true, "schema": {...} } }
```
- Truyền `response_format` xuống vLLM adapter (hỗ trợ guided decoding).
- Validate schema trước khi gọi (sai → 400).
- Endpoint securities: SLA p95 ≤500ms.

### 4.3 Frontend
- Playground: toggle "Structured output" + nhập JSON Schema.
- Hiển thị output đã validate.

### 4.4 Kiểm thử — `tests/us03-structured/run-tests.js`
- Gửi response_format json_schema → output validate đúng schema.
- Schema sai → 400.
- Latency p95 securities ≤500ms.

---

## 5. US-09 — Tối ưu engine TensorRT-LLM

### 5.1 Schema
- `endpoint_entities.engine` đã có (Phase 1) — giá trị `tensorrt-llm`.

### 5.2 Backend — `src/endpoints/store.js` + `worker.js`
- Khi `engine=tensorrt-llm`: worker khởi động endpoint với engine tối ưu (build engine + cache).
- Tracking: lưu throughput baseline vs tensorrt-llm để báo cáo cải thiện.

### 5.3 Backend — monitoring
- `GET /endpoints/:id/metrics` bổ sung `engine` + throughput so với baseline.
- Benchmark: đo throughput A/B, báo cáo % cải thiện.

### 5.4 Frontend
- Modal Deploy: option engine `tensorrt-llm` (đã có từ Phase 1).
- Chi tiết endpoint: hiển thị engine + throughput improvement.

### 5.5 Kiểm thử — `tests/us09-tensorrt/run-tests.js`
- Deploy engine=tensorrt-llm → endpoint running.
- Benchmark throughput ≥20% so với engine mặc định.
- Monitoring hiển thị throughput/latency.

---

## 6. Tiêu chí hoàn thành (Definition of Done)

- [ ] Mọi story Phase 2 có test suite riêng, **100% pass**.
- [ ] Regression toàn bộ suite hiện có (Phase 1 + cũ) **0 fail**.
- [ ] Migration idempotent, áp được lên Postgres preview.
- [ ] Frontend serve code mới (bump `app.js?v=N`).
- [ ] Preview health 200.

---

## 7. Lưu ý cho build agent

- Migration idempotent (`IF NOT EXISTS`); áp thủ công lên Postgres preview.
- Không phá data cũ; dual-backend file/postgres hoạt động.
- Tuân thủ quy ước hiện có (dual backend, `pick()`, `rowToEp`, audit hook).
- Quota (US-06) phải không làm chậm request thường (dùng counter hiệu quả).
- Dashboard (US-07) aggregate phải hiệu quả (index, bucket) — không full scan lớn.
- Không dùng git commands.
- Khi xong báo cáo: file tạo/sửa, kết quả từng suite, regression, trạng thái preview.