# BRD — Thiết kế lại Homepage FPT AI Marketplace

**Tài liệu:** Business Requirements Document (BRD)
**Phiên bản:** 1.0
**Ngày:** 17/08/2026
**Trạng thái:** Draft
**Chủ sở hữu:** Thuan Luu Thi (BA/PO)
**Phạm vi:** Redesign homepage `https://marketplace.fptcloud.com/en`

---

## 1. Tổng quan dự án

### 1.1 Bối cảnh

FPT AI Marketplace là nền tảng cho phép doanh nghiệp khám phá, thử nghiệm và triển khai các mô hình AI (LLM, VLM, Text-to-Speech, Speech-to-Text, Embedding...) thông qua API thống nhất (serverless inference). Hiện tại homepage đóng vai trò là "mặt tiền" giới thiệu danh mục model và dẫn dắt người dùng đến các trang chi tiết.

### 1.2 Vấn đề hiện tại (Problem Statement)

Qua khảo sát thực tế trang (12/08/2026) và phân tích screenshot homepage (17/08/2026), các vấn đề chính:

| # | Vấn đề | Bằng chứng / Tác động |
|---|--------|------------------------|
| P1 | **Provider gần như vô hình** — chỉ có logo nhỏ xíu (≤16px) ở góc trái card, không có tên provider rõ ràng | Người dùng không biết model do ai phát triển, thiếu tin tưởng |
| P2 | **Không có khu vực showcase provider** — không có section giới thiệu các provider uy tín (Google, Alibaba, DeepSeek, FPT...) | Không tận dụng được brand equity của các provider |
| P3 | **Không có bộ lọc theo provider** — sidebar chỉ có filter theo category (LLM, Reasoning, Vision...) | Không thể lọc "chỉ xem model của Google/FPT" |
| P4 | **Card model quá dense, khó quét** — nhiều dòng text nhỏ, giá/context/latency xếp chồng nhau, không có khoảng trắng | Thời gian quét thông tin cao, dễ bỏ sót |
| P5 | **Hero tối, thiếu điểm nhấn** — dark background, text nhỏ, CTA không nổi bật | Tỷ lệ chuyển đổi thấp |
| P6 | **Bug pagination** (BUG-001, TC-HOME-005) — click số trang nhầm vào model card | Trải nghiệm điều hướng lỗi |
| P7 | **Empty state kém** — search 0 kết quả không hiển thị thông báo rõ ràng | Người dùng bối rối |

### 1.3 Mục tiêu kinh doanh (Business Goals)

| ID | Mục tiêu | Đo lường (KPI) | Target |
|----|----------|----------------|--------|
| BG-1 | Tăng tỷ lệ chuyển đổi từ khách ghé thăm → đăng ký dùng thử | Conversion rate | +25% so với baseline |
| BG-2 | Giảm thời gian từ lúc vào trang đến khi chọn được model | Time-to-select-model | ≤ 60 giây |
| BG-3 | Tăng độ tin cậy thông qua hiển thị rõ nhà cung cấp | Vendor recognition survey | ≥ 80% người dùng nhận diện được vendor |
| BG-4 | Hỗ trợ người dùng kỹ thuật (BA/Dev) ra quyết định modeling nhanh | Số lượt dùng tính năng "Compare" | +40% |
| BG-5 | Giảm tỷ lệ thoát trang (bounce rate) | Bounce rate | -15% |

### 1.4 Phạm vi

**Trong phạm vi (In scope):**
- Redesign hero section
- Nâng cấp danh sách model card (thêm vendor, thông số kỹ thuật)
- Bộ lọc nâng cao (vendor, modality, context window, giá)
- Tính năng Compare model
- Cải thiện search + empty state
- Fix bug pagination
- Responsive mobile

**Ngoài phạm vi (Out of scope):**
- Thay đổi backend inference engine
- Redesign trang chi tiết model (sẽ ở phase 2)
- Playground, billing, API key management
- Đa ngôn ngữ mới (giữ EN/VI hiện tại)

---

## 2. Stakeholders

| Stakeholder | Vai trò | Nhu cầu chính |
|-------------|---------|---------------|
| Khách mới (New visitor) | Chưa đăng ký | Hiểu marketplace bán gì, tin tưởng, đăng ký dùng thử |
| Nhà phát triển (Developer) | Tích hợp API | Tìm model phù hợp, xem thông số, so sánh, lấy API key |
| BA/Data Scientist | Chọn model cho dự án | So sánh model theo context, giá, modality |
| Nhà cung cấp model (Vendor) | Google, Alibaba, DeepSeek, FPT, Z.AI, MiniMax... | Thương hiệu được hiển thị rõ, thu hút người dùng |
| Admin FPT | Vận hành | Dễ quản lý danh mục, đo lường hiệu quả |

---

## 3. Yêu cầu nghiệp vụ (Business Requirements)

### BR-01: Hiển thị thương hiệu nhà cung cấp
Homepage **phải** hiển thị rõ ràng nhà cung cấp (logo + tên) cho mỗi model trên card, trong bộ lọc, và trên trang chi tiết.

### BR-02: Bộ lọc theo nhà cung cấp
Người dùng **phải** có thể lọc danh sách model theo một hoặc nhiều nhà cung cấp.

### BR-03: Thông tin kỹ thuật để ra quyết định
Card model **phải** hiển thị tối thiểu: modality, context window, giá/1M token, latency class — để người dùng quyết định mà không cần mở chi tiết.

### BR-04: So sánh model
Người dùng **phải** có thể chọn tối đa 4 model để so sánh cạnh nhau (side-by-side).

### BR-05: Giá trị cốt lõi nổi bật
Hero section **phải** truyền tải: 1 API cho nhiều model, $100 credit dùng thử 30 ngày, chi phí tối ưu.

### BR-06: Điều hướng không lỗi
Pagination, search, filter **phải** hoạt động không lỗi, có empty state rõ ràng.

---

## 4. Rủi ro & Giả định

| ID | Rủi ro | Mức | Giảm thiểu |
|----|--------|-----|-----------|
| RK-1 | Dữ liệu vendor/model không đầy đủ trong CMS | Cao | Chuẩn hóa schema dữ liệu (xem Data Dictionary) |
| RK-2 | Performance giảm khi thêm thông tin lên card | TB | Lazy-load, skeleton, tối ưu ảnh logo |
| RK-3 | Người dùng quen UI cũ phản đối | TB | A/B test, giữ chế độ xem grid/list |
| RK-4 | Chi phí phát triển vượt ngân sách | TB | Triển khai theo phase (MVP → nâng cao) |

**Giả định:**
- Backend đã có sẵn dữ liệu vendor, context window, giá cho từng model.
- Logo vendor có sẵn hoặc có thể cấp phép sử dụng.
- Không thay đổi kiến trúc backend hiện tại.

---

## 5. Phê duyệt

| Vai trò | Tên | Ngày | Chữ ký |
|---------|-----|------|--------|
| BA/PO | Thuan Luu Thi | | |
| Tech Lead | | | |
| Product Owner | | | |