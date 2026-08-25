# User Stories & Acceptance Criteria
## Redesign Homepage FPT AI Marketplace

**Phiên bản:** 1.0
**Ngày:** 17/08/2026
**Trạng thái:** Draft
**Liên quan:** BRD v1.0, SRS v1.0

---

## US-01: Hiển thị nhà cung cấp trên model card

**As a** khách ghé thăm marketplace
**I want** thấy rõ logo và tên nhà cung cấp trên mỗi model card
**So that** tôi tin tưởng vào nguồn gốc model và biết model nào do ai phát triển

**Liên quan:** FR-VENDOR-001, BR-01

### Acceptance Criteria
- [ ] Given tôi đang ở homepage, when tôi nhìn vào một model card, then card hiển thị logo vendor (≤24×24px) và tên vendor.
- [ ] Given tôi click vào logo/tên vendor, then tôi được dẫn đến danh sách model của vendor đó.
- [ ] Given tôi cuộn qua toàn bộ danh sách, then mọi card đều hiển thị vendor nhất quán.

### Business Rules
- BR-01: Mỗi model phải gắn đúng 1 vendor trong hệ thống (không để trống).

### Technical Notes
- Cần dữ liệu vendor hợp lệ trong CMS; logo lấy từ CDN.

### Dependencies
- US-02 (bộ lọc vendor), Data Dictionary (entity Vendor)

---

## US-02: Lọc model theo nhà cung cấp

**As a** nhà phát triển
**I want** lọc danh sách model theo một hoặc nhiều nhà cung cấp
**So that** tôi nhanh chóng tìm được model từ vendor tôi tin cậy

**Liên quan:** FR-VENDOR-002, BR-02

### Acceptance Criteria
- [ ] Given tôi chọn vendor "Google", when tôi áp dụng bộ lọc, then chỉ hiển thị model của Google.
- [ ] Given tôi chọn "Google" và "Alibaba", then hiển thị model của cả hai (OR logic).
- [ ] Given tôi click "Clear all", then bộ lọc reset về toàn bộ model.
- [ ] Given tôi thay đổi bộ lọc, then tổng số kết quả cập nhật real-time.

### Business Rules
- BR-02: Multi-select vendor dùng OR logic.

### Dependencies
- US-01, US-06 (empty state)

---

## US-03: Xem thông số kỹ thuật trên model card

**As a** BA/Data Scientist
**I want** thấy context window, giá, modality, latency ngay trên card
**So that** tôi quyết định model phù hợp mà không phải mở từng trang chi tiết

**Liên quan:** FR-MODEL-001, BR-03

### Acceptance Criteria
- [ ] Given tôi nhìn vào model card, then card hiển thị ≥5 thông số: tên, modality, context window, giá/1M token, latency class.
- [ ] Given model chạy trên hạ tầng FPT, then hiển thị badge "FPT-hosted".
- [ ] Given một thông số bị thiếu dữ liệu, then hiển thị "—" thay vì lỗi layout.

### Business Rules
- BR-03: Context window hiển thị dạng "128K", "1M"; giá dạng USD/1M tokens.

### Dependencies
- Data Dictionary (entity Model)

---

## US-04: So sánh model cạnh nhau

**As a** nhà phát triển
**I want** chọn tối đa 4 model để so sánh side-by-side
**So that** tôi chọn được model tốt nhất cho dự án của mình

**Liên quan:** FR-MODEL-002, BR-04

### Acceptance Criteria
- [ ] Given tôi tick checkbox "Compare" trên model, then model được thêm vào Compare bar.
- [ ] Given tôi chọn 4 model, then nút "Compare" active và mở trang so sánh.
- [ ] Given tôi cố chọn model thứ 5, then hiển thị thông báo "Tối đa 4 model" và chặn chọn thêm.
- [ ] Given trang so sánh hiển thị, then có bảng so sánh vendor/modality/context/giá/latency và nút "Try in Playground".

### Business Rules
- BR-04: Giới hạn so sánh tối đa 4 model.

### Dependencies
- US-03

---

## US-05: Tìm kiếm có gợi ý

**As a** người dùng
**I want** tìm kiếm model theo tên, vendor, modality có autocomplete
**So that** tôi tìm nhanh model mình cần

**Liên quan:** FR-SEARCH-001

### Acceptance Criteria
- [ ] Given tôi gõ "gemma", then hiển thị model gemma (case-insensitive).
- [ ] Given tôi gõ "google", then hiển thị model của Google.
- [ ] Given tôi gõ ≥2 ký tự, then hiển thị dropdown gợi ý.
- [ ] Given tôi dừng gõ, then kết quả cập nhật trong ≤500ms (debounce 300ms).

### Dependencies
- US-06

---

## US-06: Empty state thân thiện khi không có kết quả

**As a** người dùng
**I want** thấy thông báo rõ ràng khi search/filter không có kết quả
**So that** tôi biết không phải lỗi hệ thống và có hướng xử lý

**Liên quan:** FR-SEARCH-002, P5, TC-SEARCH-002/004

### Acceptance Criteria
- [ ] Given search/filter trả về 0 kết quả, then hiển thị icon + thông điệp "Không tìm thấy model phù hợp".
- [ ] Given empty state hiển thị, then có nút "Reset filters/search".
- [ ] Given empty state hiển thị, then không xảy ra timeout hay treo giao diện.

### Dependencies
- US-02, US-05

---

## US-07: Pagination hoạt động chính xác

**As a** người dùng
**I want** điều hướng giữa các trang model không bị lỗi
**So that** tôi xem được toàn bộ danh mục

**Liên quan:** FR-NAV-001, BUG-001, TC-HOME-005

### Acceptance Criteria
- [ ] Given tôi click số trang, then URL cập nhật (?page=N) và hiển thị đúng trang.
- [ ] Given tôi click số trang, then KHÔNG redirect sang trang chi tiết model.
- [ ] Given tôi click Previous/Next, then chuyển trang đúng.
- [ ] Given tôi ở trang bất kỳ, then hiển thị "Showing X–Y of Z models".

### Dependencies
- Fix backend pagination nếu cần

---

## US-08: Hero truyền tải giá trị cốt lõi

**As a** khách mới
**I want** hiểu ngay marketplace mang lại lợi ích gì
**So that** tôi có động lực đăng ký dùng thử

**Liên quan:** FR-HERO-001, BR-05

### Acceptance Criteria
- [ ] Given tôi mở homepage, then hero hiển thị headline + 3 benefit badges + 2 CTA.
- [ ] Given tôi click "Start Free", then mở trang đăng ký.
- [ ] Given tôi click "Explore Models", then cuộn mượt đến danh sách model.
- [ ] Given hero hiển thị, then có khu vực logo "Trusted vendors" (tối đa 6 logo).

### Dependencies
- Asset logo vendor

---

## US-09: Responsive trên mobile

**As a** người dùng mobile
**I want** homepage hiển thị đúng trên điện thoại
**So that** tôi dùng được marketplace mọi lúc mọi nơi

**Liên quan:** FR-ACCESS-001

### Acceptance Criteria
- [ ] Given tôi mở trang trên 320px, then không có scroll ngang cắt nội dung.
- [ ] Given tôi chạm vào nút/CTA, then touch target ≥44×44px.
- [ ] Given tôi mở trên 320px/768px/1440px, then layout hiển thị đúng.

### Dependencies
- Design system responsive

---

## US-10: Accessibility chuẩn WCAG 2.1 AA

**As a** người dùng khuyết tật
**I want** dùng được homepage bằng keyboard và screen reader
**So that** tôi không bị loại trừ

**Liên quan:** FR-ACCESS-002

### Acceptance Criteria
- [ ] Given tôi dùng keyboard, then điều hướng được bằng Tab/Enter với focus indicator rõ ràng.
- [ ] Given tôi dùng screen reader, then mọi ảnh có alt text.
- [ ] Given tôi kiểm tra contrast, then text ≥4.5:1.

### Dependencies
- Design tokens

---

## Tóm tắt

| US | Tiêu đề | Ưu tiên | Liên quan FR |
|----|---------|---------|--------------|
| US-01 | Hiển thị nhà cung cấp trên card | Must | FR-VENDOR-001 |
| US-02 | Lọc theo nhà cung cấp | Must | FR-VENDOR-002 |
| US-03 | Thông số kỹ thuật trên card | Must | FR-MODEL-001 |
| US-04 | So sánh model | Should | FR-MODEL-002 |
| US-05 | Tìm kiếm có gợi ý | Must | FR-SEARCH-001 |
| US-06 | Empty state | Must | FR-SEARCH-002 |
| US-07 | Pagination chính xác | Must | FR-NAV-001 |
| US-08 | Hero giá trị cốt lõi | Must | FR-HERO-001 |
| US-09 | Responsive mobile | Must | FR-ACCESS-001 |
| US-10 | Accessibility | Should | FR-ACCESS-002 |