# Implementation Plan — Phase 1 (MVP): Mở rộng FPT DDI với NVIDIA

**Phiên bản:** 1.0
**Ngày:** 25/08/2026
**Trạng thái:** Approved — sẵn sàng cho build agent
**Chủ sở hữu:** Thuan Luu Thi (BA/PO)
**Liên quan:** `srs-nvidia-partner-expansion.md`, `user-stories-nvidia-partner-expansion.md`, `api-spec-nvidia-partner-expansion.md`, `wireframes-nvidia-partner-expansion.md`, `estimation-nvidia-partner-expansion.md`

> Tài liệu này là **blueprint triển khai** cho build agent. Mỗi task chỉ rõ file cần sửa, schema, hành vi, và tiêu chí chấp nhận. Build agent thực hiện theo đúng spec — không tự ý đổi thiết kế.

---

## 1. Phạm vi Phase 1

| Story | Mô tả | Ưu tiên |
|-------|-------|---------|
| US-10 | Phân quyền theo vai trò (admin/operator/viewer) | M |
| US-05 | Audit trail bất biến | M |
| US-01 | Deploy NVIDIA NIM 1-click | M |
| US-02 | Guardrails banking (NeMo) | M |
| US-08 | Chế độ code privacy | M |

**Thứ tự triển khai (dependency):** US-10 → US-05 → US-01 → US-02 → US-08

---

## 2. US-10 — Phân quyền theo vai trò

### 2.1 Schema
- Bảng `api_keys` thêm cột:
  - `role TEXT NOT NULL DEFAULT 'viewer'` — giá trị: `admin` | `operator` | `viewer`
  - `role_updated_at TIMESTAMPTZ`

### 2.2 Migration
- File: `db/migrations/007-us10-role.sql`
```sql
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'viewer';
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS role_updated_at TIMESTAMPTZ;
```

### 2.3 Backend — `src/keys/store.js`
- **fileBackend.create** và **pgBackend.create**: nhận thêm tham số `role`, lưu vào record.
- **fileBackend.rowToRecord / pgBackend.rowToRecord**: map thêm `role`.
- **module.exports**: không đổi signature (role là optional).
- Validation: `role` ∈ {`admin`,`operator`,`viewer`}; mặc định `viewer` nếu không truyền.

### 2.4 Backend — `src/keys/routes.js`
- `POST /keys`: nhận `role` từ body, truyền vào `store.create`.
- `PATCH /keys/:id`: hỗ trợ cập nhật `role` (thêm `updateRole`).
- Response trả về `role`.

### 2.5 Backend — `server.js` (auth middleware)
- `req.apiKey` đã có record — thêm helper `requireRole(role)`.
- Enforce: tạo/sửa key & guardrails → cần `role=admin`; tạo/sửa endpoint → `role=operator` hoặc `admin`; viewer chỉ đọc.
- Cụ thể: trong middleware auth, sau khi verify + hasScope, kiểm tra role theo path (như `pathScope`).

### 2.6 Frontend — `partner-console/app.js` + `index.html`
- Form tạo key thêm dropdown `role`.
- Bảng API Keys hiển thị cột `role`.
- Ẩn/disable nút tạo endpoint khi role=viewer.

### 2.7 Kiểm thử — `tests/us10-roles/run-tests.js`
- Tạo key role=viewer → POST /endpoints → 403.
- Tạo key role=operator + scope endpoints → POST /endpoints → cho phép.
- Tạo key role=admin → POST /keys → cho phép.
- Key không truyền role → mặc định viewer.

---

## 3. US-05 — Audit trail bất biến

### 3.1 Schema
- Bảng mới `audit_log`:
```sql
CREATE TABLE IF NOT EXISTS audit_log (
  id          TEXT PRIMARY KEY,
  ts          TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor       TEXT NOT NULL,
  role        TEXT,
  action      TEXT NOT NULL,
  entity_id   TEXT,
  entity_type TEXT,
  result      TEXT NOT NULL DEFAULT 'success',
  ip          TEXT,
  meta        JSONB
);
```
- Append-only: **không có UPDATE/DELETE**; cấm qua trigger hoặc không expose API xóa.

### 3.2 Migration — `db/migrations/008-us05-audit.sql`
- Tạo bảng `audit_log` + index trên `ts`, `actor`, `action`.

### 3.3 Backend — module mới `src/audit/store.js`
- `record(entry)` — insert append-only.
- `list({ from, to, actor, action, limit, offset })` — query có lọc.
- Export `{ record, list }`.

### 3.4 Backend — `src/audit/routes.js`
- `GET /v1/audit` — yêu cầu scope `admin`.
- Response: `{ count, data: [...] }`.

### 3.5 Backend — ghi audit vào các điểm nhạy cảm
- Hook vào: tạo/sửa/xóa endpoint, tạo/revoke/rotate key, bật/tắt guardrails, thay đổi gói giá.
- Ghi tại store layer hoặc route layer (chọn route layer để không phụ thuộc backend file/postgres).

### 3.6 Frontend
- Tab "Audit" hiển thị log, lọc theo actor/action/time.

### 3.7 Kiểm thử — `tests/us05-audit/run-tests.js`
- Tạo endpoint → audit log ghi đủ fields.
- Không có API xóa audit (405/403).
- Lọc theo actor đúng.
- GET /v1/audit với key không admin → 403.

---

## 4. US-01 — Deploy NVIDIA NIM 1-click

### 4.1 Schema
- Bảng mới `model_catalog`:
```sql
CREATE TABLE IF NOT EXISTS model_catalog (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  family         TEXT NOT NULL DEFAULT 'llm',
  segments       TEXT[] NOT NULL DEFAULT '{}',
  source         TEXT NOT NULL DEFAULT 'fpt',
  nim_version    TEXT,
  gpu_compatible TEXT[] NOT NULL DEFAULT '{}',
  max_context    INT,
  quantizations  TEXT[] NOT NULL DEFAULT '{}',
  status         TEXT NOT NULL DEFAULT 'available'
);
```
- Bảng `endpoint_entities` thêm cột:
  - `segment TEXT`, `engine TEXT DEFAULT 'vllm'`, `code_privacy BOOLEAN DEFAULT FALSE`, `guardrails_enabled BOOLEAN DEFAULT FALSE`, `guardrails_template TEXT`, `data_residency TEXT DEFAULT 'VN'`

### 4.2 Migration — `db/migrations/009-us01-nim.sql`
- Tạo `model_catalog` + seed dữ liệu NIM mẫu (DeepSeek-Coder, Llama, Qwen-Coder).
- ALTER `endpoint_entities` thêm các cột trên.

### 4.3 Backend — `src/catalog/store.js` + `src/catalog/routes.js`
- `GET /v1/catalog` — lọc theo segment/source/gpu.
- Seed catalog từ migration.

### 4.4 Backend — `src/endpoints/store.js`
- `create()` nhận thêm: `segment`, `engine`, `codePrivacy`, `guardrailsEnabled`, `guardrailsTemplate`.
- `rowToEp` map các cột mới.

### 4.5 Backend — `src/endpoints/routes.js`
- `POST /endpoints` nhận các trường mới, validate engine/segment.
- Region banking/insurance → chỉ VN (data residency).

### 4.6 Frontend
- Tab Catalog (WF-01), Modal Deploy (WF-02).

### 4.7 Kiểm thử — `tests/us01-nim/run-tests.js`
- GET /v1/catalog?segment=coding → chỉ model coding.
- Deploy model NIM → endpoint running.
- Deploy không key → 401; thiếu scope → 403.
- Deploy tên trùng → 409.

---

## 5. US-02 — Guardrails banking (NeMo)

### 5.1 Schema
- Bảng `endpoint_entities` đã có `guardrails_enabled`, `guardrails_template` (US-01).
- Bảng mới `guardrail_event`:
```sql
CREATE TABLE IF NOT EXISTS guardrail_event (
  id          TEXT PRIMARY KEY,
  endpoint_id TEXT NOT NULL,
  ts          TIMESTAMPTZ NOT NULL DEFAULT now(),
  rule        TEXT NOT NULL,
  severity    TEXT NOT NULL DEFAULT 'warn',
  blocked     BOOLEAN NOT NULL DEFAULT TRUE,
  reason      TEXT
);
```

### 5.2 Migration — `db/migrations/010-us02-guardrails.sql`
- Tạo `guardrail_event` + index.

### 5.3 Backend — `src/endpoints/store.js`
- `updateGuardrails(endpointId, { enabled, template, rules })`.
- Template mặc định: `banking` (chặn PII, prompt injection, financial advice), `insurance` (thêm medical), `general`.

### 5.4 Backend — `src/endpoints/routes.js`
- `PATCH /endpoints/:id/guardrails` — cấu hình guardrails.

### 5.5 Backend — `src/endpoints/invoke.js`
- Trước khi forward request: kiểm tra guardrails (PII pattern, prompt injection heuristic).
- Nếu chặn → trả response chuẩn + ghi `guardrail_event`.
- `GET /endpoints/:id/guardrails/events` — đếm blocked theo rule.

### 5.6 Frontend
- Tab Guardrails (WF-03).

### 5.7 Kiểm thử — `tests/us02-guardrails/run-tests.js`
- Bật guardrails banking → chặn CCCD.
- Chặn prompt injection.
- Event log đếm đúng.
- Template không hợp lệ → 400.

---

## 6. US-08 — Chế độ code privacy

### 6.1 Schema
- `endpoint_entities.code_privacy` (đã có từ US-01).

### 6.2 Backend — `src/endpoints/invoke.js`
- Khi `code_privacy=true`: không ghi prompt plaintext vào audit/usage log.
- Vẫn forward request + trả response bình thường.

### 6.3 Backend — `src/endpoints/routes.js`
- `POST /endpoints` nhận `codePrivacy`.
- `PATCH /endpoints/:id` cập nhật `codePrivacy`.

### 6.4 Frontend
- Checkbox code privacy trong Modal Deploy (WF-02).

### 6.5 Kiểm thử — `tests/us08-code-privacy/run-tests.js`
- Bật code privacy → prompt không xuất hiện plaintext trong audit.
- Vẫn hoạt động bình thường.
- Tắt → log như thường.

---

## 7. Tiêu chí hoàn thành (Definition of Done)

- [ ] Mọi story Phase 1 có test suite riêng, **100% pass**.
- [ ] Regression toàn bộ suite hiện có **0 fail**.
- [ ] Migration áp dụng được lên Postgres preview (không phá data cũ).
- [ ] Frontend serve code mới (bump `app.js?v=N`).
- [ ] Preview health 200, fingerprint cập nhật.

---

## 8. Lưu ý cho build agent

- **KHÔNG** tự ý đổi thiết kế/schema đã chốt trong tài liệu này.
- Migration phải **idempotent** (`IF NOT EXISTS`) — preview Postgres volume persist, initdb không chạy lại.
- Sau khi sửa migration, **áp thủ công** lên Postgres preview qua `podman-compose exec -T postgres psql -U ddi -d ddi -c "..."`.
- Backend rebuild bằng `podman-compose up -d --build --force-recreate backend` (code bake vào image).
- Frontend (volume mount) chỉ cần bump version, không rebuild.
- Tuân thủ quy ước mã hiện có (dual backend file/postgres, `pick()` dispatch, `rowToEp`/`rowToRecord`).