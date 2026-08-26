# Test Case — Onboarding Model Partner (FPT DDI Partner Console)

**URL:** `http://localhost:5173/#/partners` (preview)
**Ngày:** 25/08/2026
**Tiêu chuẩn:** IPA (Information-technology Promotion Agency, Japan)
**Ngôn ngữ:** Tiếng Việt
**Template:** Mirror `docs/test-cases/fpt-ai-marketplace-testcases.md` (convention trong repo)

---

## Tổng quan

Tính năng **Onboarding Model Partner** cho phép Partner Ops tạo mới một tổ chức model partner qua form, lưu vào backend (Postgres), và hiển thị trong bảng Model partners.

**Trạng thái hiện tại (as-is):** Nút "Request onboarding" là **stub** — chỉ hiện toast, không có form/API/backend. Dữ liệu partner là mock static. Bộ test case này viết cho tính năng **to-be** (sau khi build agent implement).

### Yêu cầu / Spec (tóm tắt — traceability)

| ID | Yêu cầu | Priority |
|----|---------|----------|
| FR-ONB-001 | Click "Request onboarding" → mở modal | Must |
| FR-ONB-002 | Modal có 6 trường: `name`, `contact`, `top`, `integration`, `status`, `note` + nút Submit/Cancel | Must |
| FR-ONB-003 | `name` required, max 100 ký tự | Must |
| FR-ONB-004 | `contact` required, email hợp lệ, max 100 | Must |
| FR-ONB-005 | `top` optional, max 100 | Should |
| FR-ONB-006 | `integration` optional, max 100 | Should |
| FR-ONB-007 | `status` dropdown, mặc định `pending` (pending/trialing/active/on hold) | Must |
| FR-ONB-008 | `note` optional, max 500 | Should |
| FR-ONB-011..014 | Client-side validation (rỗng, sai email, over-length) | Must/Should |
| FR-ONB-015 | Server validate lại, trả 400 nếu sai | Must |
| FR-ONB-016 | Server trả 409 nếu `name` trùng (unique) | Must |
| FR-ONB-017 | `GET /v1/partners` — danh sách partner | Must |
| FR-ONB-018 | `POST /v1/partners` — tạo partner, trả 201 | Must |
| FR-ONB-019 | POST yêu cầu auth + scope `endpoints` | Must |
| FR-ONB-020 | POST yêu cầu role `operator`/`admin` (viewer → 403) | Must |
| FR-ONB-021 | Partner mới: `id` uuid, `since`=YYYY-MM hiện tại, `models=0`, `share=0` | Should |
| FR-ONB-022 | Ghi `audit_log` khi tạo (action `partner_create`) | Should |
| FR-ONB-023 | Submit OK → modal đóng, toast "Đã tạo partner <name> (pending)" | Must |
| FR-ONB-024 | Bảng refresh, hiển thị partner mới | Must |
| FR-ONB-025 | Status badge đúng màu theo status | Should |
| FR-ONB-026 | Click hàng partner mới → drawer mở đúng dữ liệu | Should |
| FR-ONB-027 | Danh sách load từ `GET /v1/partners` (không mock) | Must |
| NFR-ONB-001 | POST < 500ms (p95) | — |
| NFR-ONB-002 | Chống SQLi (parameterized) + XSS (encode) | — |
| NFR-ONB-004 | API lỗi 4xx/5xx → app không crash, hiện toast lỗi | — |

**Data model (bảng `partners`):** `id` (uuid PK), `name` (unique, NOT NULL), `contact` (NOT NULL), `top`, `integration`, `status` (default `pending`), `note`, `since` (YYYY-MM), `models` (int, default 0), `share` (int, default 0), `created_at`.

---

## 1. Modal onboarding — Hiển thị

### TC-ONB-001: Click "Request onboarding" mở modal

| Field | Content |
|---|---|
| **TC-ID** | TC-ONB-001 |
| **Function** | Open onboarding modal |
| **Screen** | `#/partners` |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Click nút "Request onboarding" mở modal |
| **Precondition** | Đã vào view Model partners, có API key role `operator`/`admin` |
| **Procedure** | 1. Vào view Model partners 2. Click nút "Request onboarding" (`#addPartnerBtn`) |
| **Expected Result** | 1. Modal onboarding mở ra (không chỉ hiện toast) 2. Modal có tiêu đề liên quan onboarding/partner 3. Modal chứa form nhập liệu 4. Overlay hiện ra |
| **Notes** | FR-ONB-001. As-is: chỉ hiện toast — đây là điểm cần implement |

---

### TC-ONB-002: Modal hiển thị đầy đủ trường + nút

| Field | Content |
|---|---|
| **TC-ID** | TC-ONB-002 |
| **Function** | Modal form fields |
| **Screen** | Onboarding modal |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Modal hiển thị đủ 6 trường + 2 nút |
| **Precondition** | Modal onboarding đã mở |
| **Procedure** | 1. Kiểm tra các trường trong modal |
| **Expected Result** | 1. Có trường `name` (text) 2. Có trường `contact` (email) 3. Có trường `top` (text) 4. Có trường `integration` (text) 5. Có trường `status` (dropdown, mặc định `pending`) 6. Có trường `note` (textarea) 7. Có nút "Submit" 8. Có nút "Cancel" |
| **Notes** | FR-ONB-002, 007 |

---

### TC-ONB-003: Click "Cancel" đóng modal, không submit

| Field | Content |
|---|---|
| **TC-ID** | TC-ONB-003 |
| **Function** | Cancel onboarding |
| **Screen** | Onboarding modal |
| **Viewpoint** | 準正常系 (Semi-normal) |
| **Test Item** | Click Cancel không gửi dữ liệu |
| **Precondition** | Modal onboarding đã mở, đã điền một số trường |
| **Procedure** | 1. Điền `name` = "TestCancel" 2. Click nút "Cancel" |
| **Expected Result** | 1. Modal đóng 2. Không có request `POST /v1/partners` nào được gửi 3. Bảng partner không thay đổi (không có "TestCancel") |
| **Notes** | FR-ONB-010 |

---

### TC-ONB-004: Escape key đóng modal

| Field | Content |
|---|---|
| **TC-ID** | TC-ONB-004 |
| **Function** | Close modal via keyboard |
| **Screen** | Onboarding modal |
| **Viewpoint** | 準正常系 (Semi-normal) |
| **Test Item** | Nhấn Escape đóng modal |
| **Precondition** | Modal onboarding đã mở |
| **Procedure** | 1. Nhấn phím `Escape` |
| **Expected Result** | 1. Modal đóng 2. Không submit dữ liệu |
| **Notes** | Nhất quán với các modal khác trong app |

---

## 2. Form fields — Validation (client-side)

### TC-ONB-005: Submit với `name` rỗng

| Field | Content |
|---|---|
| **TC-ID** | TC-ONB-005 |
| **Function** | Name validation |
| **Screen** | Onboarding modal |
| **Viewpoint** | 異常系 (Abnormal) |
| **Test Item** | `name` rỗng bị chặn |
| **Precondition** | Modal onboarding đã mở |
| **Procedure** | 1. Để trống `name` 2. Điền `contact` = `test@example.com` 3. Click "Submit" |
| **Expected Result** | 1. Không gửi request `POST /v1/partners` 2. Hiện thông báo lỗi trường `name` (required) 3. Modal vẫn mở 4. Focus vào trường `name` |
| **Notes** | FR-ONB-011 |

---

### TC-ONB-006: Submit với `name` chỉ khoảng trắng

| Field | Content |
|---|---|
| **TC-ID** | TC-ONB-006 |
| **Function** | Name validation |
| **Screen** | Onboarding modal |
| **Viewpoint** | 異常系 (Abnormal) |
| **Test Item** | `name` chỉ khoảng trắng bị chặn |
| **Precondition** | Modal onboarding đã mở |
| **Procedure** | 1. Nhập `name` = "   " (3 khoảng trắng) 2. Điền `contact` hợp lệ 3. Click "Submit" |
| **Expected Result** | 1. Không gửi request 2. Hiện thông báo lỗi `name` (required/blank) 3. Modal vẫn mở |
| **Notes** | FR-ONB-011 |

---

### TC-ONB-007: Submit với `contact` rỗng

| Field | Content |
|---|---|
| **TC-ID** | TC-ONB-007 |
| **Function** | Contact validation |
| **Screen** | Onboarding modal |
| **Viewpoint** | 異常系 (Abnormal) |
| **Test Item** | `contact` rỗng bị chặn |
| **Precondition** | Modal onboarding đã mở |
| **Procedure** | 1. Điền `name` = "TestCo" 2. Để trống `contact` 3. Click "Submit" |
| **Expected Result** | 1. Không gửi request 2. Hiện thông báo lỗi `contact` (required) 3. Modal vẫn mở |
| **Notes** | FR-ONB-012 |

---

### TC-ONB-008: Submit với `contact` sai format email

| Field | Content |
|---|---|
| **TC-ID** | TC-ONB-008 |
| **Function** | Contact validation |
| **Screen** | Onboarding modal |
| **Viewpoint** | 異常系 (Abnormal) |
| **Test Item** | `contact` không phải email hợp lệ bị chặn |
| **Precondition** | Modal onboarding đã mở |
| **Procedure** | 1. Điền `name` = "TestCo" 2. Điền `contact` = `not-an-email` 3. Click "Submit" |
| **Expected Result** | 1. Không gửi request 2. Hiện thông báo lỗi `contact` (invalid email) 3. Modal vẫn mở |
| **Notes** | FR-ONB-012 |

---

### TC-ONB-009: Submit với `name` 101 ký tự (vượt max)

| Field | Content |
|---|---|
| **TC-ID** | TC-ONB-009 |
| **Function** | Name length boundary |
| **Screen** | Onboarding modal |
| **Viewpoint** | 境界値 (Boundary) |
| **Test Item** | `name` > 100 ký tự bị chặn |
| **Precondition** | Modal onboarding đã mở |
| **Procedure** | 1. Nhập `name` = chuỗi 101 ký tự ("a" × 101) 2. Điền `contact` hợp lệ 3. Click "Submit" |
| **Expected Result** | 1. Không gửi request 2. Hiện thông báo lỗi `name` (over length, max 100) 3. Modal vẫn mở |
| **Notes** | FR-ONB-013. Điểm 3: 101 (vượt) |

---

### TC-ONB-010: Submit với `name` đúng 100 ký tự (bằng max)

| Field | Content |
|---|---|
| **TC-ID** | TC-ONB-010 |
| **Function** | Name length boundary |
| **Screen** | Onboarding modal |
| **Viewpoint** | 境界値 (Boundary) |
| **Test Item** | `name` = 100 ký tự được accept |
| **Precondition** | Modal onboarding đã mở |
| **Procedure** | 1. Nhập `name` = chuỗi 100 ký tự 2. Điền `contact` hợp lệ 3. Click "Submit" |
| **Expected Result** | 1. Gửi request `POST /v1/partners` 2. Không có lỗi length 3. (Nếu name chưa tồn tại) tạo thành công |
| **Notes** | FR-ONB-003. Điểm 3: 100 (bằng max) |

---

### TC-ONB-011: Submit với `name` 99 ký tự (dưới max)

| Field | Content |
|---|---|
| **TC-ID** | TC-ONB-011 |
| **Function** | Name length boundary |
| **Screen** | Onboarding modal |
| **Viewpoint** | 境界値 (Boundary) |
| **Test Item** | `name` = 99 ký tự được accept |
| **Precondition** | Modal onboarding đã mở |
| **Procedure** | 1. Nhập `name` = chuỗi 99 ký tự 2. Điền `contact` hợp lệ 3. Click "Submit" |
| **Expected Result** | 1. Gửi request 2. Không có lỗi length |
| **Notes** | FR-ONB-003. Điểm 3: 99 (dưới max) |

---

### TC-ONB-012: Submit với `note` 501 ký tự (vượt max)

| Field | Content |
|---|---|
| **TC-ID** | TC-ONB-012 |
| **Function** | Note length boundary |
| **Screen** | Onboarding modal |
| **Viewpoint** | 境界値 (Boundary) |
| **Test Item** | `note` > 500 ký tự bị chặn |
| **Precondition** | Modal onboarding đã mở |
| **Procedure** | 1. Điền `name`, `contact` hợp lệ 2. Nhập `note` = chuỗi 501 ký tự 3. Click "Submit" |
| **Expected Result** | 1. Không gửi request 2. Hiện thông báo lỗi `note` (over length, max 500) |
| **Notes** | FR-ONB-014. Điểm 3: 501 (vượt) |

---

### TC-ONB-013: Submit với `note` đúng 500 ký tự (bằng max)

| Field | Content |
|---|---|
| **TC-ID** | TC-ONB-013 |
| **Function** | Note length boundary |
| **Screen** | Onboarding modal |
| **Viewpoint** | 境界値 (Boundary) |
| **Test Item** | `note` = 500 ký tự được accept |
| **Precondition** | Modal onboarding đã mở |
| **Procedure** | 1. Điền `name`, `contact` hợp lệ 2. Nhập `note` = chuỗi 500 ký tự 3. Click "Submit" |
| **Expected Result** | 1. Gửi request 2. Không có lỗi length cho `note` |
| **Notes** | FR-ONB-008. Điểm 3: 500 (bằng max) |

---

## 3. Submit — Thành công

### TC-ONB-014: Submit form hợp lệ tạo partner mới

| Field | Content |
|---|---|
| **TC-ID** | TC-ONB-014 |
| **Function** | Create partner |
| **Screen** | Onboarding modal → `#/partners` |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Submit form hợp lệ tạo partner thành công |
| **Precondition** | Có API key role `operator`/`admin`; partner "Acme AI" chưa tồn tại |
| **Procedure** | 1. Mở modal 2. Điền `name`="Acme AI", `contact`="bd@acme.ai", `top`="Acme-7B", `integration`="vLLM", `status`="pending", `note`="Test partner" 3. Click "Submit" |
| **Expected Result** | 1. Request `POST /v1/partners` trả 201 2. Modal đóng 3. Hiện toast "Đã tạo partner Acme AI (pending)" 4. Bảng partner có hàng "Acme AI" 5. Hàng có models=0, share=0 |
| **Notes** | FR-ONB-018, 023, 024 |

---

### TC-ONB-015: Partner mới có status "pending" + metadata đúng

| Field | Content |
|---|---|
| **TC-ID** | TC-ONB-015 |
| **Function** | Partner metadata |
| **Screen** | `#/partners` |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Partner mới có status/metadata đúng |
| **Precondition** | Đã tạo partner "Acme AI" (TC-ONB-014) |
| **Procedure** | 1. Kiểm tra hàng "Acme AI" trong bảng 2. Mở drawer chi tiết |
| **Expected Result** | 1. Status = "pending" 2. `since` = tháng hiện tại (YYYY-MM) 3. `models` = 0 4. `share` = 0 5. Có `id` (uuid) |
| **Notes** | FR-ONB-021 |

---

### TC-ONB-016: Partner mới hiển thị status badge đúng màu

| Field | Content |
|---|---|
| **TC-ID** | TC-ONB-016 |
| **Function** | Status badge |
| **Screen** | `#/partners` |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Badge status của partner mới đúng màu |
| **Precondition** | Đã tạo partner "Acme AI" (status pending) |
| **Procedure** | 1. Kiểm tra badge status của hàng "Acme AI" |
| **Expected Result** | 1. Badge hiển thị "pending" 2. Màu badge đúng theo style của status pending (khác active/trialing/on hold) |
| **Notes** | FR-ONB-025 |

---

### TC-ONB-017: Click partner mới mở drawer đúng dữ liệu

| Field | Content |
|---|---|
| **TC-ID** | TC-ONB-017 |
| **Function** | Partner drawer |
| **Screen** | `#/partners` → drawer |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Click hàng partner mới mở drawer đúng |
| **Precondition** | Đã tạo partner "Acme AI" |
| **Procedure** | 1. Click vào hàng "Acme AI" |
| **Expected Result** | 1. Drawer mở, tiêu đề "Acme AI" 2. Hiển thị: Status=pending, Models=0, Share=0%, Serving stack="vLLM", Contact="bd@acme.ai", Notes="Test partner" |
| **Notes** | FR-ONB-026 |

---

## 4. Submit — Thất bại (abnormal)

### TC-ONB-018: Submit `name` trùng → 409

| Field | Content |
|---|---|
| **TC-ID** | TC-ONB-018 |
| **Function** | Duplicate name |
| **Screen** | Onboarding modal |
| **Viewpoint** | 異常系 (Abnormal) |
| **Test Item** | Tạo partner với `name` đã tồn tại |
| **Precondition** | Partner "FPT.AI" đã tồn tại trong DB |
| **Procedure** | 1. Mở modal 2. Điền `name`="FPT.AI", `contact`="x@y.com" 3. Click "Submit" |
| **Expected Result** | 1. Request trả 409 2. Hiện thông báo lỗi "Partner đã tồn tại" (hoặc tương tự) 3. Modal vẫn mở 4. Không tạo partner trùng |
| **Notes** | FR-ONB-016 |

---

### TC-ONB-019: Submit với key role `viewer` → 403

| Field | Content |
|---|---|
| **TC-ID** | TC-ONB-019 |
| **Function** | Role enforcement |
| **Screen** | Onboarding modal |
| **Viewpoint** | 異常系 (Abnormal) |
| **Test Item** | Viewer không thể tạo partner |
| **Precondition** | API key có role `viewer` |
| **Procedure** | 1. Set API key role viewer 2. Mở modal, điền form hợp lệ 3. Click "Submit" |
| **Expected Result** | 1. Request trả 403 2. Hiện thông báo lỗi (thiếu quyền / yêu cầu role operator/admin) 3. Không tạo partner |
| **Notes** | FR-ONB-020 |

---

### TC-ONB-020: Submit không có API key → 401

| Field | Content |
|---|---|
| **TC-ID** | TC-ONB-020 |
| **Function** | Auth required |
| **Screen** | Onboarding modal |
| **Viewpoint** | 異常系 (Abnormal) |
| **Test Item** | Không có API key bị chặn |
| **Precondition** | Không có API key hợp lệ (xóa localStorage) |
| **Procedure** | 1. Xóa API key 2. Mở modal, điền form hợp lệ 3. Click "Submit" |
| **Expected Result** | 1. Request trả 401 2. Hiện thông báo lỗi (cần API key / unauthorized) 3. Không tạo partner |
| **Notes** | FR-ONB-019 |

---

### TC-ONB-021: Submit với key thiếu scope → 403

| Field | Content |
|---|---|
| **TC-ID** | TC-ONB-021 |
| **Function** | Scope enforcement |
| **Screen** | Onboarding modal |
| **Viewpoint** | 異常系 (Abnormal) |
| **Test Item** | Key thiếu scope `endpoints` bị chặn |
| **Precondition** | API key role operator nhưng KHÔNG có scope `endpoints` |
| **Procedure** | 1. Set API key thiếu scope endpoints 2. Mở modal, điền form hợp lệ 3. Click "Submit" |
| **Expected Result** | 1. Request trả 403 2. Hiện thông báo lỗi (thiếu scope) 3. Không tạo partner |
| **Notes** | FR-ONB-019 |

---

### TC-ONB-022: Server reject form sai (bypass client validation)

| Field | Content |
|---|---|
| **TC-ID** | TC-ONB-022 |
| **Function** | Server-side validation |
| **Screen** | `POST /v1/partners` (API) |
| **Viewpoint** | 異常系 (Abnormal) |
| **Test Item** | Server validate độc lập (không tin client) |
| **Precondition** | Có API key operator |
| **Procedure** | 1. Gọi trực tiếp `POST /v1/partners` với body `{ name: "", contact: "bad" }` (qua curl/devtools, bỏ qua client validation) |
| **Expected Result** | 1. Server trả 400 2. Body lỗi có `details` liệt kê trường sai (name, contact) 3. Không ghi DB |
| **Notes** | FR-ONB-015 |

---

## 5. Security

### TC-ONB-023: SQL injection trong `name`

| Field | Content |
|---|---|
| **TC-ID** | TC-ONB-023 |
| **Function** | SQLi protection |
| **Screen** | Onboarding modal / `POST /v1/partners` |
| **Viewpoint** | Security |
| **Test Item** | SQLi trong `name` không bypass |
| **Precondition** | Có API key operator |
| **Procedure** | 1. Gọi `POST /v1/partners` với `name` = `' OR 1=1 --`, `contact`="a@b.com" |
| **Expected Result** | 1. Không trả về toàn bộ bảng partners 2. Không có lỗi SQL hiển thị 3. Trả 400 (validation) hoặc tạo partner với tên literal (được escape) 4. Kiểm tra code dùng parameterized query |
| **Notes** | NFR-ONB-002 |

---

### TC-ONB-024: XSS trong `name`

| Field | Content |
|---|---|
| **TC-ID** | TC-ONB-024 |
| **Function** | XSS protection |
| **Screen** | Onboarding modal → bảng |
| **Viewpoint** | Security |
| **Test Item** | XSS trong `name` không execute |
| **Precondition** | Có API key operator |
| **Procedure** | 1. Tạo partner với `name` = `<script>alert('xss')</script>` 2. Nhìn bảng partner |
| **Expected Result** | 1. Không có alert box hiện lên 2. Tên hiển thị được HTML-encode (hiện literal `<script>...`) 3. Không execute JavaScript |
| **Notes** | NFR-ONB-002. Kiểm tra console không có lỗi do payload |

---

### TC-ONB-025: XSS trong `note`

| Field | Content |
|---|---|
| **TC-ID** | TC-ONB-025 |
| **Function** | XSS protection |
| **Screen** | Onboarding modal → drawer |
| **Viewpoint** | Security |
| **Test Item** | XSS trong `note` không execute |
| **Precondition** | Có API key operator |
| **Procedure** | 1. Tạo partner với `note` = `<img src=x onerror=alert(1)>` 2. Mở drawer partner đó |
| **Expected Result** | 1. Không có alert box 2. Note hiển thị được encode 3. Không execute |
| **Notes** | NFR-ONB-002 |

---

## 6. List & Combination

### TC-ONB-026: Danh sách partner load từ API

| Field | Content |
|---|---|
| **TC-ID** | TC-ONB-026 |
| **Function** | Partner list source |
| **Screen** | `#/partners` |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Bảng partner load từ `GET /v1/partners` |
| **Precondition** | Backend chạy, có data partner trong DB |
| **Procedure** | 1. Vào view Model partners 2. Mở DevTools → Network 3. Nhìn request khi tải trang |
| **Expected Result** | 1. Có request `GET /v1/partners` trả 200 2. Bảng hiển thị đúng data từ API response 3. Không còn dùng mock static `DATA.partners` |
| **Notes** | FR-ONB-027 |

---

### TC-ONB-027: Search tìm thấy partner mới

| Field | Content |
|---|---|
| **TC-ID** | TC-ONB-027 |
| **Function** | Search + new partner |
| **Screen** | `#/partners` |
| **Viewpoint** | Combination |
| **Test Item** | Search partner vừa tạo |
| **Precondition** | Đã tạo partner "Acme AI" |
| **Procedure** | 1. Nhập "acme" vào ô search 2. Chờ kết quả |
| **Expected Result** | 1. Bảng chỉ còn hàng "Acme AI" 2. Không crash |
| **Notes** | Kết hợp search + data mới |

---

### TC-ONB-028: Filter status "pending" thấy partner mới

| Field | Content |
|---|---|
| **TC-ID** | TC-ONB-028 |
| **Function** | Filter + new partner |
| **Screen** | `#/partners` |
| **Viewpoint** | Combination |
| **Test Item** | Lọc theo status pending |
| **Precondition** | Đã tạo partner "Acme AI" (status pending) |
| **Procedure** | 1. Click chip filter tương ứng status pending (nếu có) hoặc kiểm tra filter |
| **Expected Result** | 1. Partner "Acme AI" (pending) hiển thị 2. Logic filter đúng |
| **Notes** | Lưu ý: filter hiện có là all/active/trialing/on hold — cần thêm "pending" nếu muốn lọc (open question) |

---

## 7. Performance & Resilience

### TC-ONB-029: POST /v1/partners phản hồi nhanh

| Field | Content |
|---|---|
| **TC-ID** | TC-ONB-029 |
| **Function** | Performance |
| **Screen** | `POST /v1/partners` |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Thời gian phản hồi API |
| **Precondition** | Backend chạy |
| **Procedure** | 1. Đo thời gian `POST /v1/partners` (form hợp lệ) từ submit đến response |
| **Expected Result** | 1. Thời gian < 500ms (p95) 2. Không timeout |
| **Notes** | NFR-ONB-001 |

---

### TC-ONB-030: API lỗi 500 → app không crash

| Field | Content |
|---|---|
| **TC-ID** | TC-ONB-030 |
| **Function** | Error resilience |
| **Screen** | Onboarding modal |
| **Viewpoint** | 異常系 (Abnormal) |
| **Test Item** | API lỗi không làm crash app |
| **Precondition** | Mô phỏng backend trả 500 (hoặc DB down) |
| **Procedure** | 1. Khi backend lỗi, mở modal, điền form hợp lệ 2. Click "Submit" |
| **Expected Result** | 1. App không crash / không trắng màn hình 2. Hiện toast lỗi (ví dụ "Lỗi server, thử lại") 3. Modal vẫn mở, data không mất |
| **Notes** | NFR-ONB-004 |

---

## Tóm tắt Test Cases

| Area | Số lượng | 正常系 | 準正常系 | 異常系 | 境界値 | Security | Combination |
|---|---|---|---|---|---|---|---|
| Modal hiển thị | 4 | 2 | 2 | 0 | 0 | 0 | 0 |
| Form validation | 9 | 0 | 0 | 4 | 5 | 0 | 0 |
| Submit success | 4 | 4 | 0 | 0 | 0 | 0 | 0 |
| Submit fail | 5 | 0 | 0 | 5 | 0 | 0 | 0 |
| Security | 3 | 0 | 0 | 0 | 0 | 3 | 0 |
| List & combination | 3 | 1 | 0 | 0 | 0 | 0 | 2 |
| Performance & resilience | 2 | 1 | 0 | 1 | 0 | 0 | 0 |
| **Tổng** | **30** | **8** | **2** | **10** | **5** | **3** | **2** |

---

**Ghi chú:**
- Template: mirror `fpt-ai-marketplace-testcases.md` (IPA, tiếng Việt, format bảng) — convention trong repo.
- Output format: Markdown.
- Bộ test này viết cho tính năng **to-be** (chưa implement). As-is: nút chỉ là stub (chỉ hiện toast).
- Phần spec/yêu cầu (FR-ONB-xxx) được gộp vào đầu file vì role QA chỉ được ghi vào `docs/test-cases/`; SRS riêng lẻ thuộc phạm vi role BA.
- Một số case (TC-ONB-022, 023, 029) cần gọi API trực tiếp (curl/devtools) ngoài UI.
- Open question: filter status hiện không có "pending" — cần bổ sung nếu muốn lọc partner mới (TC-ONB-028).