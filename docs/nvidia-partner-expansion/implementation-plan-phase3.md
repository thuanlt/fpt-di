# Implementation Plan — Phase 3: Mở rộng FPT DDI với NVIDIA

**Phiên bản:** 1.0
**Ngày:** 25/08/2026
**Trạng thái:** Approved — sẵn sàng cho build agent
**Chủ sở hữu:** Thuan Luu Thi (BA/PO)
**Liên quan:** `srs-nvidia-partner-expansion.md`, `user-stories-nvidia-partner-expansion.md`, `api-spec-nvidia-partner-expansion.md`, `wireframes-nvidia-partner-expansion.md`, `estimation-nvidia-partner-expansion.md`, `implementation-plan-phase1.md`, `implementation-plan-phase2.md`

> Blueprint triển khai Phase 3. Mỗi task chỉ rõ file cần sửa, schema, hành vi, tiêu chí chấp nhận. Build agent TUÂN THỦ ĐÚNG — không tự ý đổi thiết kế.

---

## 1. Phạm vi Phase 3

| Story | Mô tả | Ưu tiên |
|-------|-------|---------|
| US-04 | Trích xuất tài liệu bảo hiểm (contract/claim) | S |
| BR-05.4 | DGX Cloud integration (roadmap) | C |

**Thứ tự triển khai:** US-04 → DGX Cloud (roadmap, có thể tách riêng).

**Nền tảng từ Phase 1+2 (đã có):**
- Bảng `endpoint_entities` (segment, engine, guardrails_*, code_privacy, price_pack_id).
- Bảng `guardrail_event`, `audit_log`, `model_catalog`, `price_pack`.
- Module `src/audit/*`, `src/catalog/*`, `src/pricing/*`, `src/dashboard/*`.
- Auth role (admin/operator/viewer) + scope.
- Module `src/byom/*` — xử lý file upload (HF/S3) cho weights model.

**Hiện trạng cần lưu ý:** Chưa có module OCR/trích xuất tài liệu. BYOM chỉ xử lý weights model, không phải document. Phase 3 cần thêm module document processing mới.

---

## 2. US-04 — Trích xuất tài liệu bảo hiểm

### 2.1 Schema
- Bảng mới `document_job` (job trích xuất tài liệu):
```sql
CREATE TABLE IF NOT EXISTS document_job (
  id            TEXT PRIMARY KEY,
  endpoint_id   TEXT,              -- endpoint insurance dùng để trích xuất (tuỳ chọn)
  segment       TEXT NOT NULL DEFAULT 'insurance',
  doc_type      TEXT NOT NULL DEFAULT 'contract',  -- contract | claim
  filename      TEXT NOT NULL,
  file_size     INT,
  status        TEXT NOT NULL DEFAULT 'queued',    -- queued|processing|completed|failed
  fields        JSONB,             -- kết quả trích xuất
  confidence    NUMERIC(5,4),      -- độ tin cậy tổng
  redacted      BOOLEAN DEFAULT FALSE,  -- có che thông tin nhạy cảm không
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```
- Bảng `endpoint_entities` không đổi (dùng segment=insurance có sẵn).

### 2.2 Migration — `db/migrations/012-us04-document.sql`
- Tạo `document_job` + index trên `status`, `segment`, `created_at`.

### 2.3 Backend — module mới `src/documents/store.js`
- Dual-backend (file/postgres), pattern như `src/byom/store.js`.
- `create({ endpoint_id, segment, doc_type, filename, file_size })` → trả job id, status=queued.
- `getById(id)`, `list({ segment, status, limit })`, `update(id, patch)`.
- Lưu file upload vào `data/documents/<jobId>/` (tương tự byom `jobDir`).

### 2.4 Backend — module mới `src/documents/processor.js`
- Nhận file (PDF/text), trích xuất trường theo `doc_type`:
  - `contract`: `party_name`, `policy_number`, `sum_insured`, `term_start`, `term_end`, `premium`, `insurer`.
  - `claim`: `claim_number`, `claimant_name`, `incident_date`, `amount_claimed`, `status`.
- **OCR/text extraction:**
  - File text/JSON → parse trực tiếp.
  - File PDF → dùng model document-capable (gọi endpoint insurance đã deploy) HOẶC service OCR mock trong preview (trả fields mẫu + confidence).
  - Trong preview: dùng **mock extraction** (giống vllm-adapter mock) — trả fields có `confidence`, đánh dấu `redacted` nếu gặp pattern y tế.
- **Guardrails y tế (FR-SEG-005.2):** rà soát nội dung, nếu chứa thông tin y tế nhạy cảm → che/redact trường đó + đặt `redacted=true`.
- Ghi `audit_log` khi tạo/completed job.

### 2.5 Backend — module mới `src/documents/routes.js`
- `POST /v1/documents` (scope `endpoints`) — upload file (multipart) + metadata → tạo job, trả job id.
- `GET /v1/documents` — list job, lọc segment/status.
- `GET /v1/documents/:id` — chi tiết job + fields.
- `POST /v1/documents/:id/confirm` (scope `operator`/`admin`) — xác nhận/sửa thủ công fields → lưu lại.
- Worker: poll job `queued` → `processing` → gọi processor → `completed`/`failed`.

### 2.6 Frontend — `partner-console/`
- View **Documents** (rail mới): upload form (chọn doc_type, file), bảng job (status, confidence, redacted).
- Detail job: hiển thị fields trích xuất, đánh dấu trường `redacted`, nút "Sửa thủ công" + "Xác nhận".
- Wireframe: tham khảo WF-03 style (form + bảng + detail).

### 2.7 Kiểm thử — `tests/us04-document/run-tests.js`
- Upload hợp đồng (text mẫu) → job completed, fields trích xuất đúng (≥90% trường chính xác).
- Upload claim → fields claim đúng.
- Tài liệu chứa thông tin y tế → `redacted=true`, trường y tế bị che.
- File không đọc được → status=failed, error rõ.
- Lọc list theo segment/status.
- Confirm (sửa thủ công) → fields cập nhật.
- Không key → 401; thiếu scope → 403.

---

## 3. BR-05.4 — DGX Cloud integration (roadmap)

> Đây là tính năng **roadmap** (C — Could have), không bắt buộc cho MVP Phase 3. Tài liệu hoá yêu cầu để triển khai khi có hạ tầng DGX Cloud.

### 3.1 Yêu cầu
- **FR-DGX-001 (C):** Hệ thống **nên** hỗ trợ deploy endpoint lên DGX Cloud (compute-as-a-service của NVIDIA) thay vì chỉ GPU on-prem.
- **FR-DGX-002 (C):** Hệ thống **nên** hiển thị lựa chọn "DGX Cloud" trong modal deploy (bên cạnh H100/H200/A30/B300 on-prem).
- **FR-DGX-003 (C):** Hệ thống **nên** tracking chi phí DGX Cloud (pay-per-use) riêng biệt trong billing.

### 3.2 Schema (khi triển khai)
- `endpoint_entities` thêm cột `deployment_target TEXT DEFAULT 'onprem'` (giá trị: `onprem` | `dgx_cloud`).
- `price_pack` thêm cột `deployment_target TEXT DEFAULT 'onprem'`.

### 3.3 Backend (khi triển khai)
- `src/endpoints/store.js` + `worker.js`: khi `deployment_target=dgx_cloud`, gọi NVIDIA DGX Cloud API để provision instance.
- `src/pricing/store.js`: gói giá DGX Cloud (pay-per-use).
- Tích hợp NVIDIA DGX Cloud API (cần API key NVIDIA, credential quản lý riêng).

### 3.4 Frontend (khi triển khai)
- Modal Deploy: option "Deployment target" (on-prem / DGX Cloud).
- Billing: hiển thị chi phí DGX Cloud.

### 3.5 Kiểm thử (khi triển khai)
- Deploy endpoint DGX Cloud → instance provision.
- Chi phí DGX Cloud tính đúng.

### 3.6 Lưu ý
- DGX Cloud cần **thỏa thuận + API key NVIDIA** — chưa có trong preview hiện tại.
- Đề xuất: Phase 3 chỉ **tài liệu hoá + scaffold** (cột `deployment_target`, option UI disabled "coming soon"), không tích hợp thật cho tới khi có hạ tầng.

---

## 4. Tiêu chí hoàn thành (Definition of Done)

- [ ] US-04: test suite riêng **100% pass**.
- [ ] Regression toàn bộ suite hiện có (Phase 1+2+cũ) **0 fail**.
- [ ] Migration idempotent, áp được lên Postgres preview.
- [ ] Frontend serve code mới (bump `app.js?v=N`).
- [ ] Preview health 200.
- [ ] DGX Cloud: scaffold (cột + option UI "coming soon") — không bắt buộc tích hợp thật.

---

## 5. Lưu ý cho build agent

- Migration idempotent (`IF NOT EXISTS`); áp thủ công lên Postgres preview.
- Module `src/documents/*` theo pattern dual-backend + file storage như `src/byom/*`.
- OCR/extraction trong preview dùng **mock** (giống vllm-adapter) — trả fields + confidence, không cần OCR thật.
- Guardrails y tế (redact) phải ghi `audit_log`.
- Quota/audit/role tuân thủ quy ước Phase 1+2.
- DGX Cloud chỉ scaffold — không gọi API NVIDIA thật (chưa có credential).
- Không dùng git commands.
- Khi xong báo cáo: file tạo/sửa, kết quả từng suite, regression, trạng thái preview.