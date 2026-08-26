# Hướng dẫn dùng tính năng Phase 3 — FPT DDI Partner Console

**Phiên bản:** 1.0
**Ngày:** 25/08/2026
**Trạng thái:** Approved
**Chủ sở hữu:** Thuan Luu Thi (BA/PO)
**Phạm vi:** US-04 (Trích xuất tài liệu bảo hiểm) + DGX Cloud scaffold

> Hướng dẫn vận hành cho người dùng Partner Console. Preview: `http://localhost:5173`.

---

## 1. Tổng quan

Phase 3 thêm 2 tính năng:
1. **Documents (US-04)** — trích xuất thông tin từ tài liệu bảo hiểm (hợp đồng / claim form), tự che thông tin y tế nhạy cảm, cho phép sửa thủ công.
2. **DGX Cloud scaffold** — option deploy lên NVIDIA DGX Cloud (hiện ở chế độ "coming soon", chưa tích hợp thật).

---

## 2. Documents — Trích xuất tài liệu bảo hiểm (US-04)

### 2.1 Truy cập
- Mở console → rail sidebar → **Documents**.

### 2.2 Upload tài liệu
1. Chọn **Document type**: `contract` (hợp đồng) hoặc `claim` (hồ sơ bồi thường).
2. Chọn **Segment**: mặc định `insurance`.
3. Chọn **file** (text/JSON; PDF ở chế độ preview dùng mock extraction).
4. Bấm **Upload** → hệ thống tạo job, status `queued`.

### 2.3 Theo dõi job
- Bảng job hiển thị: `id`, `doc_type`, `filename`, `status` (queued → processing → completed/failed), `confidence`, `redacted`.
- Job tự poll (2.5s) cho tới khi `completed` hoặc `failed`.

### 2.4 Xem kết quả trích xuất
- Bấm vào 1 job → panel detail hiển thị các trường đã trích xuất:
  - **contract**: `party_name`, `policy_number`, `sum_insured`, `term_start`, `term_end`, `premium`, `insurer`.
  - **claim**: `claim_number`, `claimant_name`, `incident_date`, `amount_claimed`, `status`.
- Mỗi trường kèm **confidence** (độ tin cậy).
- Trường chứa thông tin y tế nhạy cảm bị đánh dấu **`[REDACTED]`** (guardrails y tế tự che).

### 2.5 Sửa thủ công & xác nhận
- Bấm **Sửa thủ công** → chỉnh các trường sai → lưu.
- Bấm **Xác nhận** → job được xác nhận (cần role `operator` hoặc `admin`).

### 2.6 Ví dụ file mẫu (text)
```
POLICY CONTRACT
Policy Number: INS-2026-00123
Party: Nguyen Van A
Sum Insured: 500000000 VND
Term Start: 2026-01-01
Term End: 2027-01-01
Premium: 12000000 VND
Insurer: FPT Insurance
```
→ Upload → job `completed`, 7 trường trích xuất đúng, confidence cao.

### 2.7 Lưu ý bảo mật
- Tài liệu chứa thông tin y tế (chẩn đoán, toa thuốc, bệnh án) → hệ thống **tự redact** trường đó + đặt `redacted=true` (tuân thủ PDPA / Nghị định 13/2023/NĐ-CP).
- Mọi thao tác tạo/completed job được ghi **audit log** (xem tab Audit).

---

## 3. DGX Cloud scaffold (roadmap)

### 3.1 Truy cập
- Mở **Modal Deploy** (từ NIM catalog hoặc Create endpoint).

### 3.2 Option Deployment target
- Form deploy có thêm mục **Deployment target**:
  - **On-prem** (mặc định) — GPU H100/H200/A30/B300 nội bộ.
  - **DGX Cloud — coming soon** (disabled, chưa bật).

### 3.3 Trạng thái hiện tại
- DGX Cloud ở chế độ **scaffold**: đã có cột `deployment_target` (DB) + option UI, nhưng **chưa tích hợp API NVIDIA DGX Cloud thật** (chưa có credential/thỏa thuận).
- Khi NVIDIA cấp API key + hạ tầng, option sẽ được bật và cho phép deploy endpoint lên DGX Cloud (pay-per-use).

---

## 4. Quyền truy cập (role)

| Thao tác | Role tối thiểu |
|----------|----------------|
| Upload tài liệu, xem job | scope `endpoints` (mọi role) |
| Sửa thủ công / Xác nhận job | `operator` hoặc `admin` |
| Xem audit log | `admin` |

> Key demo tự động (đủ scope) dùng được hết thao tác trên.

---

## 5. Kiểm tra nhanh (smoke test)

1. Mở `http://localhost:5173` → rail **Documents**.
2. Dán file mẫu (mục 2.6) vào 1 file text, upload với doc_type `contract`.
3. Chờ job `completed` → mở detail → thấy 7 trường + confidence.
4. Upload file chứa thông tin y tế → thấy trường `[REDACTED]` + `redacted=true`.
5. Mở Modal Deploy → thấy option **DGX Cloud — coming soon** (disabled).

---

## 6. API tham khảo

| Endpoint | Method | Scope | Mô tả |
|----------|--------|-------|-------|
| `/v1/documents` | POST | endpoints | Upload tài liệu (multipart) |
| `/v1/documents` | GET | endpoints | List job (lọc segment/status) |
| `/v1/documents/:id` | GET | endpoints | Chi tiết job + fields |
| `/v1/documents/:id/confirm` | POST | operator/admin | Sửa thủ công + xác nhận |

---

## 7. Câu hỏi thường gặp

**Hỏi: Tại sao PDF không trích xuất được ở preview?**
Đáp: Preview dùng **mock extraction** (giống vllm-adapter) — hỗ trợ text/JSON thật, PDF ở chế độ mock. Khi có model document-capable / OCR thật, PDF sẽ trích xuất đầy đủ.

**Hỏi: Thông tin y tế bị che thì tôi có xem được không?**
Đáp: Trường nhạy cảm hiển thị `[REDACTED]` để tuân thủ bảo mật. Admin có thể xem bản gốc qua audit nếu có thẩm quyền.

**Hỏi: Khi nào DGX Cloud dùng được?**
Đáp: Khi NVIDIA cấp API key + hạ tầng DGX Cloud theo thỏa thuận đối tác. Hiện tại chỉ scaffold.