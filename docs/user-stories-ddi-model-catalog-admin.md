# User Stories — Hệ thống Admin Model Catalog (DDI)

**Phiên bản:** 1.0
**Ngày:** 27/08/2026
**Trạng thái:** Draft
**Chủ sở hữu:** Thuan Luu Thi (BA/PO)
**Căn cứ:** `docs/srs-ddi-model-catalog-admin.md` (14 FR), `docs/prototype-ddi-model-catalog-admin.md` (7 màn hình)
**Format:** Mỗi story gồm User Story + Acceptance Criteria (Given-When-Then) + Business Rules + Dependencies, map 1-1 với FR.

---

## Personas

| Persona | Vai trò | Mô tả |
|---------|---------|-------|
| **P1 — Catalog Admin** | `catalog_admin` | Nhân sự FPT nội bộ, khai báo model, quản lý catalog |
| **P2 — Catalog Approver** | `catalog_approver` | Quản lý cấp trên, kiểm duyệt model trước khi public |
| **P3 — Khách hàng DDI** | Customer | Developer/DevOps dùng catalog để deploy (tác nhân gián tiếp) |

---

## Epic 1 — Xem & lọc Model Catalog (FR-MC-001)

### US-001: Xem danh sách model trong catalog

**As a** Catalog Admin (P1)
**I want** xem danh sách toàn bộ model trong catalog với các trạng thái
**So that** tôi nắm được tổng thể catalog và tìm nhanh model cần quản lý

**Priority:** Must Have

#### Acceptance Criteria
- [ ] **AC1:** Given tôi ở màn hình Model Catalog, when tôi mở tab **Public Catalog**, then tôi chỉ thấy entry có `catalog_type=public`, mỗi entry hiển thị: ID, Display name, HF model ID, Status, Weight status, From price.
- [ ] **AC2:** Given danh sách có 50+ entry, when tôi cuộn xuống cuối trang, then hệ thống phân trang (50/trang) và tôi điều hướng được giữa các trang.
- [ ] **AC3:** Given entry có `status_code=active`, when tôi xem danh sách, then entry hiển thị badge xanh lá; `pending_review` badge vàng; `draft` badge xám; `inactive` badge xám đậm.

#### Business Rules
- BR-1.1: Entry `draft` và `pending_review` chỉ hiển thị cho P1/P2, **không** hiển thị cho P3.
- BR-1.2: Giá hiển thị định dạng `$X.XX`; entry chưa có giá hiển thị "—".

#### Dependencies
- FR-MC-009 (phân biệt catalog_type)

---

### US-002: Lọc và tìm kiếm model

**As a** Catalog Admin (P1)
**I want** lọc danh sách theo status, category, weight status và tìm theo từ khóa
**So that** tôi thu hẹp nhanh danh sách khi catalog lớn

**Priority:** Must Have

#### Acceptance Criteria
- [ ] **AC1:** Given tôi chọn lọc `Status=pending_review`, when hệ thống tải lại danh sách, then chỉ hiện entry ở trạng thái pending_review.
- [ ] **AC2:** Given tôi nhập query "llama", when tôi bấm Lọc, then danh sách chỉ hiện entry có `id`, `display_name` hoặc `hf_model_id` chứa "llama" (không phân biệt hoa thường).
- [ ] **AC3:** Given tôi kết hợp lọc `Status=active` + `Category=chat`, then danh sách hiện entry thỏa **cả hai** điều kiện.
- [ ] **AC4:** Given không có entry nào khớp bộ lọc, then hệ thống hiển thị empty state "Không tìm thấy model nào khớp bộ lọc" + nút "Xóa bộ lọc".

#### Business Rules
- BR-2.1: Mỗi lần đổi bộ lọc, danh sách reset về trang 1.

#### Dependencies
- FR-MC-001, FR-MC-014 (danh sách category để lọc)

---

## Epic 2 — Nhập model từ Hugging Face (FR-MC-002)

### US-003: Fetch metadata model từ HF Hub

**As a** Catalog Admin (P1)
**I want** nhập HF Model ID và hệ thống tự lấy metadata từ Hugging Face
**So that** tôi không phải nhập tay thông số model, giảm sai sót

**Priority:** Must Have

#### Acceptance Criteria
- [ ] **AC1:** Given tôi ở form Add Model (HF) và nhập `nvidia/Llama-3.3-70B-Instruct-FP8`, when tôi bấm "Fetch from Hugging Face", then hệ thống prefill `display_name`, `parameters_display`, `context_length_display`, `license` từ HF vào form.
- [ ] **AC2:** Given tôi nhập repo ID không tồn tại, when tôi bấm Fetch, then hệ thống hiển thị lỗi "Không tìm thấy model hoặc thiếu config.json" trong ≤ 5 giây và **không** tạo entry.
- [ ] **AC3:** Given HF API trả rate limit, when hệ thống fetch, then hệ thống retry tự động (backoff) và hiển thị thông báo "Đang thử lại…" — dữ liệu đã nhập không mất.
- [ ] **AC4:** Given HF API không phản hồi sau 10 giây, then hệ thống hiển thị "HF phản hồi chậm, thử lại sau" và cho phép bấm Fetch lại.
- [ ] **AC5:** Given metadata đã prefill, when tôi sửa các trường, then giá trị tôi sửa được giữ (prefill chỉ là giá trị khởi đầu).

#### Business Rules
- BR-3.1: `hf_model_id` là trường bắt buộc với mọi entry (kể cả proprietary).
- BR-3.2: Hệ thống lưu `revision` (SHA) của HF repo tại thời điểm fetch để truy xuất.

#### Dependencies
- FR-MC-003 (form chung), NFR-MC-005 (xử lý HF timeout/rate-limit)

---

## Epic 3 — Khai báo model thủ công (FR-MC-003)

### US-004: Tạo model mới bằng form manual

**As a** Catalog Admin (P1)
**I want** khai báo model độc quyền/nội bộ hoàn toàn thủ công
**So that** model không có trên HF công khai vẫn vào được catalog

**Priority:** Must Have

#### Acceptance Criteria
- [ ] **AC1:** Given tôi ở form Add Model (Manual), when tôi nhập đủ các trường bắt buộc (id, hf_model_id, display_name, short_description, parameters_display, context_length_display, license, catalog_type, categories, ≥1 hardware profile) và bấm "Lưu draft", then entry được tạo với `status_code=draft`.
- [ ] **AC2:** Given model không có trên HF, when tôi nhập `hf_model_id=fpt-internal/vietgpt-v1`, then hệ thống chấp nhận (identifier nội bộ hợp lệ).
- [ ] **AC3:** Given tôi bỏ trống trường bắt buộc, when tôi bấm lưu, then field thiếu được đánh dấu đỏ kèm thông báo cụ thể, form không gửi.
- [ ] **AC4:** Given tôi nhập giá âm ở hardware profile, then hệ thống chặn với thông báo "Giá phải ≥ 0".

#### Business Rules
- BR-4.1: Entry mới luôn ở trạng thái `draft` — chưa hiển thị cho khách.
- BR-4.2: `from_price` là giá thấp nhất trong các hardware profiles (hệ thống tự tính hoặc admin nhập).

#### Dependencies
- FR-MC-007 (hardware profile), FR-MC-010 (giá)

---

### US-005: Gắn GPU profile cho model

**As a** Catalog Admin (P1)
**I want** khai báo các cấu hình GPU hỗ trợ cho model (SKU, số GPU, precision, VRAM, giá)
**So that** khách chọn được cấu hình deploy phù hợp và hệ thống biết cách serving

**Priority:** Must Have

#### Acceptance Criteria
- [ ] **AC1:** Given tôi ở form model, when tôi thêm 1 hardware profile với `gpu_sku_code=l40s`, `gpus_per_instance=1`, `precision=fp8`, `vram_required_gb=75`, `price=3.29`, then profile được lưu vào `hardware_profiles[]`.
- [ ] **AC2:** Given tôi thêm profile thứ 2, when tôi lưu, then entry có 2 profile và khách thấy cả 2 lựa chọn.
- [ ] **AC3:** Given tôi đánh dấu `is_recommended` cho 2 profile cùng lúc, when tôi lưu, then hệ thống cảnh báo "Chỉ được đánh dấu 1 profile là recommended".
- [ ] **AC4:** Given VRAM khai báo nhỏ hơn VRAM ước tính của model (dựa trên params + precision), then hệ thống hiển thị cảnh báo vàng trước khi lưu (không chặn).

#### Business Rules
- BR-5.1: Tối thiểu 1 hardware profile; đúng 1 profile `is_recommended=true`.
- BR-5.2: Giá lưu dạng `per_gpu_hourly_price_usd_micros` (USD × 1.000.000) theo API hiện có.

#### Dependencies
- FR-MC-007

---

## Epic 4 — Quy trình kiểm duyệt 1 cấp (FR-MC-005)

### US-006: Submit entry để duyệt

**As a** Catalog Admin (P1)
**I want** submit entry draft để chuyển sang chờ duyệt
**So that** approver xem xét và model có thể public

**Priority:** Must Have

#### Acceptance Criteria
- [ ] **AC1:** Given entry ở trạng thái `draft` và tôi có role `catalog_admin`, when tôi bấm "Submit", then entry chuyển sang `pending_review`.
- [ ] **AC2:** Given entry ở `pending_review`, when tôi (creator) xem entry, then tôi thấy trạng thái chờ duyệt và **không** thấy nút Approve/Reject.
- [ ] **AC3:** Given entry chưa đủ dữ liệu bắt buộc (thiếu giá), when tôi submit, then hệ thống chặn với thông báo trường thiếu.

#### Business Rules
- BR-6.1: Sau khi submit, entry không thể sửa metadata cho đến khi được duyệt hoặc từ chối.

#### Dependencies
- FR-MC-005

---

### US-007: Approve entry

**As a** Catalog Approver (P2)
**I want** chấp thuận entry đã submit
**So that** model chính thức public cho khách hàng

**Priority:** Must Have

#### Acceptance Criteria
- [ ] **AC1:** Given entry ở `pending_review` và tôi có role `catalog_approver`, when tôi bấm "Approve", then entry chuyển sang `active` và xuất hiện trong catalog của khách.
- [ ] **AC2:** Given entry nguồn HF được approve và weights chưa mirrored, when tôi approve, then hệ thống tự động khởi động pull weights về mirror và hiển thị "Đang pull weights…".
- [ ] **AC3:** Given entry do chính tôi tạo, when tôi mở entry, then nút Approve bị tắt kèm tooltip "Bạn là người tạo entry này" (khi hệ thống có ≥ 2 admin).
- [ ] **AC4:** Given tôi approve entry, then hệ thống ghi audit log (tôi, thời điểm, draft→active).

#### Business Rules
- BR-7.1: 1 cấp duyệt duy nhất — approver chấp thuận là public (khi weights Mirrored).
- BR-7.2: Entry `active` chỉ hiển thị cho khách khi `weight_status=Mirrored` (entry HF).

#### Dependencies
- FR-MC-005, FR-MC-012 (mirror)

---

### US-008: Reject entry kèm lý do

**As a** Catalog Approver (P2)
**I want** từ chối entry với lý do bắt buộc
**So that** creator biết cần sửa gì và entry quay về trạng thái soạn

**Priority:** Must Have

#### Acceptance Criteria
- [ ] **AC1:** Given entry ở `pending_review`, when tôi bấm "Reject" mà không nhập lý do, then hệ thống chặn (lý do ≥ 5 ký tự).
- [ ] **AC2:** Given tôi nhập lý do "License không phù hợp, cần license MIT/Apache", when tôi bấm Reject, then entry về `draft` và lý do được ghi vào History.
- [ ] **AC3:** Given entry bị reject, when creator mở entry, then banner vàng hiển thị lý do từ chối.

#### Business Rules
- BR-8.1: Lý do reject bắt buộc, lưu vĩnh viễn trong audit log.

#### Dependencies
- FR-MC-005, FR-MC-008

---

## Epic 5 — Quản lý vòng đời entry (FR-MC-006)

### US-009: Disable / Enable model

**As a** Catalog Admin (P1)
**I want** tắt (unpublish) hoặc bật lại model trong catalog
**So that** tôi kiểm soát model nào khách có thể deploy mà không phá endpoint đang chạy

**Priority:** Must Have

#### Acceptance Criteria
- [ ] **AC1:** Given entry `active` không có endpoint nào, when tôi bấm "Disable", then entry chuyển `inactive` và biến mất khỏi catalog khách.
- [ ] **AC2:** Given entry `active` đang có 3 endpoint chạy, when tôi bấm "Disable", then modal cảnh báo "Model đang có 3 endpoint đang chạy — endpoint vẫn hoạt động. Tiếp tục?" và tôi phải xác nhận.
- [ ] **AC3:** Given entry đã `inactive`, when tôi bấm "Enable", then entry về `active` (nếu weights vẫn Mirrored).
- [ ] **AC4:** Given entry `inactive`, when khách truy cập catalog, then khách không thấy entry nhưng endpoint cũ vẫn serve bình thường.

#### Business Rules
- BR-9.1: Disable **không** ảnh hưởng endpoint đã deploy.
- BR-9.2: Entry `active` không thể Xóa — chỉ Disable.

#### Dependencies
- FR-MC-006

---

### US-010: Xóa entry draft

**As a** Catalog Admin (P1)
**I want** xóa entry draft không còn dùng
**So that** catalog không bị rác

**Priority:** Must Have

#### Acceptance Criteria
- [ ] **AC1:** Given entry ở `draft`, when tôi bấm "Xóa" và xác nhận, then entry bị xóa khỏi catalog.
- [ ] **AC2:** Given entry ở `active` hoặc `inactive`, when tôi mở dropdown hành động, then **không** có tùy chọn Xóa (chỉ Disable/Enable).
- [ ] **AC3:** Given tôi xóa entry, then audit log ghi hành động xóa (không thể khôi phục).

#### Business Rules
- BR-10.1: Chỉ entry `draft` được xóa.

#### Dependencies
- FR-MC-006

---

## Epic 6 — Tách catalog độc quyền (FR-MC-009)

### US-011: Quản lý model độc quyền trong catalog riêng

**As a** Catalog Admin (P1)
**I want** model độc quyền/nội bộ nằm trong catalog riêng, tách khỏi catalog công khai
**So that** model chưa công bố không lộ ra cho mọi khách hàng

**Priority:** Must Have

#### Acceptance Criteria
- [ ] **AC1:** Given tôi tạo entry với `catalog_type=proprietary`, when tôi lưu, then entry chỉ xuất hiện trong tab **Proprietary Catalog** của admin.
- [ ] **AC2:** Given entry proprietary ở `active`, when khách hàng thường truy cập catalog, then khách **không** thấy entry.
- [ ] **AC3:** Given khách hàng trong whitelist contract, when truy cập catalog, then khách chỉ thấy subset model proprietary được cấp quyền.
- [ ] **AC4:** Given entry ở catalog public, when tôi mở form sửa, then **không** có thao tác chuyển sang proprietary (và ngược lại).

#### Business Rules
- BR-11.1: `catalog_type` gán khi tạo, không đổi được sau đó.
- BR-11.2: `hf_model_id` bắt buộc cả với proprietary (dùng identifier nội bộ nếu không có trên HF).

#### Dependencies
- FR-MC-009

---

## Epic 7 — Giá model (FR-MC-010)

### US-012: Khai báo giá thủ công

**As a** Catalog Admin (P1)
**I want** tự nhập giá cho từng GPU profile và `from_price`
**So that** giá phản ánh chính sách pricing của FPT cho từng model

**Priority:** Must Have

#### Acceptance Criteria
- [ ] **AC1:** Given tôi nhập `per_gpu_hourly_price_usd_micros` tương đương $3.29/GPU/h cho profile L40S, when tôi lưu, then API nhận giá đúng đơn vị micros (3290000).
- [ ] **AC2:** Given entry có 2 profile giá $3.29 và $5.00, then `from_price` hiển thị $3.29 (giá thấp nhất).
- [ ] **AC3:** Given entry thiếu giá ở mọi profile, when tôi submit để duyệt, then hệ thống chặn: "Entry chưa có giá — nhập giá cho ít nhất 1 GPU profile".
- [ ] **AC4:** Given tôi nhập giá 0, then hệ thống chấp nhận (model miễn phí/dùng thử).

#### Business Rules
- BR-12.1: Giá ≥ 0, bắt buộc trước khi entry active.
- BR-12.2: Không có bảng giá chuẩn tự động — mọi giá do admin khai báo (quyết định đã chốt).

#### Dependencies
- FR-MC-010

---

## Epic 8 — Mirror nội bộ (FR-MC-012, FR-MC-013)

### US-013: Pull weights về mirror nội bộ

**As a** Platform Ops (P1)
**I want** hệ thống tự động tải weights model HF về S3 nội bộ khi entry được duyệt
**So that** khách deploy từ hạ tầng FPT — ổn định, không phụ thuộc HF lúc deploy

**Priority:** Must Have

#### Acceptance Criteria
- [ ] **AC1:** Given entry HF được approve, when hệ thống khởi động pull, then weights được tải về `s3://<bucket>/ddi-models/{hf_model_id}/{revision}/` và `weight_status` chuyển `Mirroring`.
- [ ] **AC2:** Given pull đang chạy, when tôi mở tab Mirror của entry, then tôi thấy tiến độ ( %) và trạng thái `Mirroring`.
- [ ] **AC3:** Given pull thất bại (mất kết nối), when hệ thống retry 3 lần đều fail, then `weight_status=MirrorFailed`, lý do lỗi hiển thị cho admin, entry **không** hiển thị cho khách.
- [ ] **AC4:** Given pull thành công, when hệ thống tính checksum SHA-256, then checksum khớp với HF và `weight_status=Mirrored`.
- [ ] **AC5:** Given entry `weight_status ≠ Mirrored`, when khách truy cập catalog, then khách **không** thấy entry.
- [ ] **AC6:** Given entry chưa Mirrored, when khách thử deploy, then hệ thống từ chối deploy.

#### Business Rules
- BR-13.1: Giữ nguyên weights gốc theo đúng revision — không nén/quantize lại.
- BR-13.2: Retry mặc định 3 lần; sau 3 lần fail → MirrorFailed + thông báo admin.

#### Dependencies
- FR-MC-012, FR-MC-013

---

### US-014: Theo dõi và retry mirror

**As a** Catalog Admin (P1)
**I want** xem tất cả mirror jobs và retry khi thất bại
**So that** tôi chủ động xử lý model chưa sẵn sàng

**Priority:** Must Have

#### Acceptance Criteria
- [ ] **AC1:** Given tôi mở màn hình Sync & Mirror, then tôi thấy bảng: model, revision, tiến độ, trạng thái, hành động.
- [ ] **AC2:** Given 1 job `MirrorFailed`, when tôi bấm "Retry", then job chạy lại từ đầu (reset progress) và trạng thái về `Mirroring`.
- [ ] **AC3:** Given 1 job `Mirroring`, when tôi bấm "Hủy", then pull dừng và trạng thái về `NotMirrored`.
- [ ] **AC4:** Given job fail, then dòng lỗi gần nhất hiển thị lý do (VD: "connection reset after 2.1GB, retry 3/3").

#### Business Rules
- BR-14.1: Retry/Hủy chỉ cho role admin; approver chỉ xem.

#### Dependencies
- FR-MC-012, FR-MC-013

---

## Epic 9 — Audit log (FR-MC-008)

### US-015: Xem lịch sử thay đổi entry

**As a** Catalog Admin (P1)
**I want** xem toàn bộ lịch sử thay đổi của một entry
**So that** tôi truy vết được ai đã làm gì, khi nào

**Priority:** Should Have

#### Acceptance Criteria
- [ ] **AC1:** Given tôi mở tab History của entry, then tôi thấy bảng: thời gian, người, hành động, chi tiết (trường cũ → mới), sắp xếp mới nhất trên cùng.
- [ ] **AC2:** Given entry trải qua create → submit → reject → sửa → submit → approve, then History hiển thị đủ 6 sự kiện đúng thứ tự.
- [ ] **AC3:** Given tôi (hoặc bất kỳ user nào) thử xóa/sửa dòng log, then hệ thống không hỗ trợ thao tác này (append-only).

#### Business Rules
- BR-15.1: Audit log ghi: tạo, sửa (field-level), submit, approve, reject, disable, enable, xóa, mirror retry.

#### Dependencies
- FR-MC-008, NFR-MC-004

---

## Epic 10 — Quản lý Category (FR-MC-014)

### US-016: Quản lý danh mục model

**As a** Catalog Admin (P1)
**I want** tạo/sửa/xóa category để phân loại model
**So that** khách và admin lọc model theo mục đích sử dụng (chat, reasoning, code…)

**Priority:** Must Have

#### Acceptance Criteria
- [ ] **AC1:** Given tôi bấm "Thêm category" và nhập `code=code-gen`, `display_name=Code Generation`, `sort_order=3`, then category xuất hiện trong danh sách.
- [ ] **AC2:** Given category `chat` đang có 8 model, when tôi bấm "Xóa", then nút bị tắt kèm tooltip "Category đang có 8 model — chuyển model đi trước".
- [ ] **AC3:** Given category `3d-generation` không có model nào, when tôi xóa, then category bị xóa thành công.
- [ ] **AC4:** Given tôi đổi `display_name` của category đang dùng, then các model đã gắn category vẫn giữ nguyên liên kết (chỉ đổi tên hiển thị).

#### Business Rules
- BR-16.1: `code` là slug duy nhất, không đổi được khi category đã có model.

#### Dependencies
- FR-MC-014

---

## Epic 11 — Batch import (FR-MC-004 — Phase 2)

### US-017: Import hàng loạt model từ file

**As a** Catalog Admin (P1)
**I want** upload file CSV/YAML/JSON chứa nhiều model
**So that** khởi tạo/đồng bộ catalog nhanh khi có nhiều model cùng lúc

**Priority:** Could Have (Phase 2)

#### Acceptance Criteria
- [ ] **AC1:** Given tôi upload file JSON 50 model hợp lệ, when hệ thống import, then 50 entry `draft` được tạo và báo cáo "50 thành công / 0 lỗi".
- [ ] **AC2:** Given file 50 dòng có 2 dòng lỗi (thiếu hardware_profiles, giá âm), then 48 dòng hợp lệ được tạo, báo cáo liệt kê "Dòng 12: thiếu hardware_profiles; Dòng 37: giá âm".
- [ ] **AC3:** Given file có 600 dòng, when tôi upload, then hệ thống từ chối: "Vượt quá giới hạn 500 model/lần".
- [ ] **AC4:** Given tôi bấm "Tải template", then file template mẫu (đầy đủ fields + ví dụ) được tải về.

#### Business Rules
- BR-17.1: Mọi entry import về trạng thái `draft` — vẫn phải qua duyệt.
- BR-17.2: Giới hạn 500 model/lần.

#### Dependencies
- FR-MC-004

---

## Epic 12 — Auto-sync revision (FR-MC-011 — Phase 2)

### US-018: Hệ thống tự kiểm tra revision mới từ HF

**As a** Catalog Admin (P1)
**I want** hệ thống tự động kiểm tra revision mới của model HF theo lịch
**So that** catalog luôn có phiên bản model mới nhất mà không cần kiểm tra tay

**Priority:** Should Have (Phase 2)

#### Acceptance Criteria
- [ ] **AC1:** Given entry có `sync_enabled=true`, when daily job chạy (hàng ngày), then hệ thống kiểm tra revision HF của entry đó.
- [ ] **AC2:** Given HF có revision mới, when job phát hiện, then hệ thống tạo `pending_update` (revision cũ → mới) — **không** tự áp dụng.
- [ ] **AC3:** Given entry có `sync_enabled=false`, when daily job chạy, then entry bị bỏ qua.
- [ ] **AC4:** Given tôi bật/tắt `sync_enabled` ở tab Mirror, then thay đổi có hiệu lực từ lần sync kế tiếp.
- [ ] **AC5:** Given sync chạy, then endpoint đang chạy của model **không** bị gián đoạn.

#### Business Rules
- BR-18.1: Sync chỉ tạo đề xuất — việc áp dụng do approver quyết định (US-019).
- BR-18.2: Mặc định `sync_enabled=true` cho entry nguồn HF.

#### Dependencies
- FR-MC-011

---

### US-019: Duyệt cập nhật revision mới

**As a** Catalog Approver (P2)
**I want** xem và chấp thuận/từ chối đề xuất revision mới
**So that** bản cập nhật chỉ áp dụng khi được kiểm soát

**Priority:** Should Have (Phase 2)

#### Acceptance Criteria
- [ ] **AC1:** Given có 1 `pending_update` cho model Kimi K2.6 (rev A → rev B), when tôi ở tab Pending updates, then tôi thấy dòng đề xuất với cả 2 revision.
- [ ] **AC2:** Given tôi bấm "Approve", then `weight_status` reset về `Mirroring`, hệ thống pull weights revision B về mirror; khi pull xong, entry dùng revision B.
- [ ] **AC3:** Given tôi bấm "Reject", then entry giữ revision A, đề xuất bị đóng, audit log ghi lại.
- [ ] **AC4:** Given pull revision B thất bại, then entry **vẫn chạy revision A** (không down model).

#### Business Rules
- BR-19.1: Chỉ áp dụng revision mới sau khi mirror thành công (zero-downtime).

#### Dependencies
- FR-MC-011, FR-MC-013

---

## Ma trận traceability: User Story ↔ FR ↔ Màn hình

| Story | FR | Màn hình | Priority | Phase |
|-------|----|----------|:--------:|:-----:|
| US-001 | FR-MC-001 | M1 | Must | 1 |
| US-002 | FR-MC-001 | M1 | Must | 1 |
| US-003 | FR-MC-002 | M2 | Must | 1 |
| US-004 | FR-MC-003 | M3 | Must | 1 |
| US-005 | FR-MC-007 | M2/M3 | Must | 1 |
| US-006 | FR-MC-005 | M4 | Must | 1 |
| US-007 | FR-MC-005 | M4 | Must | 1 |
| US-008 | FR-MC-005 | M4 | Must | 1 |
| US-009 | FR-MC-006 | M1/M4 | Must | 1 |
| US-010 | FR-MC-006 | M1/M4 | Must | 1 |
| US-011 | FR-MC-009 | M1 | Must | 1 |
| US-012 | FR-MC-010 | M2/M3 | Must | 1 |
| US-013 | FR-MC-012, 013 | M4/M6 | Must | 1 |
| US-014 | FR-MC-012, 013 | M6 | Must | 1 |
| US-015 | FR-MC-008 | M4 | Should | 1 |
| US-016 | FR-MC-014 | M5 | Must | 1 |
| US-017 | FR-MC-004 | M7 | Could | 2 |
| US-018 | FR-MC-011 | M6 | Should | 2 |
| US-019 | FR-MC-011, 013 | M6 | Should | 2 |

**Phân bố:** 16 stories Phase 1 (13 Must + 1 Should) · 3 stories Phase 2.
**Mọi FR trong SRS đều được bao phủ bởi ít nhất 1 user story** (FR-MC-001 → US-001/002; FR-MC-002 → US-003; … FR-MC-014 → US-016).

---

## Ghi chú cho team dev

1. **Story điểm (Story Points) gợi ý** để sprint planning: US-003/013 (HF fetch, mirror) phức tạp nhất — nên ước 5–8 SP; US-001/002/016 (list, lọc, category) — 3 SP; US-006/007/008 (approval) — 3 SP.
2. **Definition of Done chung:** code review pass + test tự động cho mọi AC + audit log ghi đúng + không phá NFR-MC-003 (RBAC).
3. **Story Phase 2** (US-017/018/019) chỉ bắt đầu sau khi gate Phase 1 pass (UAT + 1 model HF thật mirror + deploy thành công).