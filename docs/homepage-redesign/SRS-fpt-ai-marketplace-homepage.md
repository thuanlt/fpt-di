# SRS — Software Requirements Specification
## Redesign Homepage FPT AI Marketplace

**Phiên bản:** 1.0
**Ngày:** 17/08/2026
**Trạng thái:** Draft
**Liên quan:** BRD v1.0, Data Dictionary, RTM

---

## 1. Giới thiệu

### 1.1 Mục đích
Tài liệu này mô tả chi tiết yêu cầu chức năng (Functional Requirements) và phi chức năng (Non-Functional Requirements) cho việc thiết kế lại homepage FPT AI Marketplace, tập trung vào: UI/UX, hiển thị thông tin nhà cung cấp (vendor), và tiện ích hỗ trợ quyết định modeling.

### 1.2 Thuật ngữ

| Thuật ngữ | Định nghĩa |
|-----------|-----------|
| Model | Mô hình AI (LLM, VLM, TTS, STT, Embedding...) |
| Vendor | Nhà cung cấp/phát triển model (FPT, Google, Alibaba, DeepSeek, Z.AI, MiniMax, Anthropic, OpenAI) |
| Modality | Loại model: LLM, VLM, Text-to-Speech, Speech-to-Text, Embedding |
| Context window | Độ dài ngữ cảnh tối đa (token) model xử lý được |
| Latency class | Phân loại tốc độ phản hồi (Fast/Medium/Slow) |
| Modeling | Hoạt động lựa chọn và cấu hình model để tích hợp vào ứng dụng |

---

## 2. Yêu cầu chức năng (Functional Requirements)

### FR-HERO — Hero Section

#### FR-HERO-001: Value proposition nổi bật
**Priority:** Must Have | **Status:** Draft

**Mô tả:** Hero section hiển thị rõ ràng 3 giá trị cốt lõi của nền tảng.

**Yêu cầu con:**
- **FR-HERO-001.1:** Hiển thị headline chính mô tả marketplace (VD: "One API. Every Frontier AI Model.")
- **FR-HERO-001.2:** Hiển thị tối đa 3 benefit badges: (1) $100 free credit trong 30 ngày, (2) 1 API cho mọi model, (3) Chi phí tối ưu.
- **FR-HERO-001.3:** Có 2 CTA chính: "Start Free" (đăng ký) và "Explore Models" (cuộn xuống danh mục).
- **FR-HERO-001.4:** Có khu vực "Trusted vendors" hiển thị logo các nhà cung cấp (FPT, Google, Alibaba, DeepSeek, Z.AI, MiniMax).

**Acceptance Criteria:**
1. Khi tải trang, hero hiển thị trong viewport đầu tiên.
2. Headline, 3 benefit badges, 2 CTA, và logo vendors đều hiển thị đầy đủ.
3. Click "Start Free" → mở trang đăng ký. Click "Explore Models" → cuộn mượt đến danh sách model.
4. Logo vendor là ảnh thật (không placeholder), tối đa 6 logo.

---

### FR-VENDOR — Hiển thị & lọc theo nhà cung cấp

#### FR-VENDOR-001: Badge vendor trên model card
**Priority:** Must Have | **Status:** Draft

**Mô tả:** Mỗi model card hiển thị logo + tên nhà cung cấp ở vị trí nổi bật.

**Acceptance Criteria:**
1. Card model hiển thị logo vendor (≤ 24×24px) kèm tên vendor.
2. Logo/Tên vendor click được → dẫn đến danh sách model của vendor đó (filtered view).
3. Vendor hiển thị nhất quán trên toàn bộ danh sách.

#### FR-VENDOR-002: Bộ lọc theo vendor
**Priority:** Must Have | **Status:** Draft

**Mô tả:** Người dùng lọc danh sách model theo một hoặc nhiều vendor.

**Yêu cầu con:**
- **FR-VENDOR-002.1:** Filter bar hiển thị danh sách vendor (checkbox/multi-select).
- **FR-VENDOR-002.2:** Chọn nhiều vendor → hiển thị model thuộc bất kỳ vendor nào được chọn (OR logic).
- **FR-VENDOR-002.3:** Có nút "Clear all" để reset bộ lọc.

**Acceptance Criteria:**
1. Chọn vendor "Google" → chỉ hiển thị model của Google.
2. Chọn "Google" + "Alibaba" → hiển thị model của cả hai.
3. Click "Clear all" → reset về toàn bộ model.
4. Số lượng kết quả được cập nhật real-time và hiển thị tổng số.

#### FR-VENDOR-003: Trang danh sách model theo vendor
**Priority:** Should Have | **Status:** Draft

**Mô tả:** URL riêng hiển thị tất cả model của một vendor (VD: `/en/vendors/google`).

**Acceptance Criteria:**
1. Truy cập `/en/vendors/{vendor}` hiển thị header vendor (logo, tên, mô tả ngắn) và danh sách model.
2. Breadcrumb hiển thị đường dẫn Home → Vendors → {Vendor}.

---

### FR-MODEL — Thông tin kỹ thuật trên card (hỗ trợ modeling)

#### FR-MODEL-001: Thông số kỹ thuật trên model card
**Priority:** Must Have | **Status:** Draft

**Mô tả:** Card model hiển thị các thông số cần thiết để ra quyết định modeling mà không cần mở trang chi tiết.

**Yêu cầu con:**
- **FR-MODEL-001.1:** Hiển thị tên model.
- **FR-MODEL-001.2:** Hiển thị modality (tag: LLM, VLM, TTS, STT, Embedding).
- **FR-MODEL-001.3:** Hiển thị context window (VD: 128K, 1M tokens).
- **FR-MODEL-001.4:** Hiển thị giá tham chiếu (USD/1M tokens input).
- **FR-MODEL-001.5:** Hiển thị latency class (Fast/Medium/Slow).
- **FR-MODEL-001.6:** Hiển thị badge "FPT-hosted" nếu model chạy trên hạ tầng FPT (liên quan dữ liệu tại nhà/data residency).

**Acceptance Criteria:**
1. Mỗi card hiển thị ≥ 5 thông số: tên, modality, context, giá, latency.
2. Thông số hiển thị bằng icon + text, dễ quét bằng mắt.
3. Card không bị lỗi layout khi thiếu 1 thông số (hiển thị "—").

#### FR-MODEL-002: Compare model
**Priority:** Should Have | **Status:** Draft

**Mô tả:** Người dùng chọn tối đa 4 model để so sánh cạnh nhau.

**Yêu cầu con:**
- **FR-MODEL-002.1:** Mỗi card có checkbox "Compare".
- **FR-MODEL-002.2:** Thanh Compare bar hiển thị số model đã chọn (VD: "2/4 selected").
- **FR-MODEL-002.3:** Click "Compare" → mở trang so sánh side-by-side (bảng so sánh: vendor, modality, context, giá, latency, capabilities).
- **FR-MODEL-002.4:** Chặn chọn quá 4 model (hiển thị thông báo).

**Acceptance Criteria:**
1. Chọn 2–4 model → bảng so sánh hiển thị đúng các cột.
2. Chọn model thứ 5 → hiển thị thông báo "Tối đa 4 model" và không cho chọn thêm.
3. Trang so sánh có nút "Try in Playground" cho từng model.
4. Bảng so sánh responsive trên mobile (scroll ngang).

---

### FR-SEARCH — Tìm kiếm & Empty state

#### FR-SEARCH-001: Search cải tiến
**Priority:** Must Have | **Status:** Draft

**Mô tả:** Search box hỗ trợ gợi ý và tìm kiếm theo nhiều tiêu chí.

**Yêu cầu con:**
- **FR-SEARCH-001.1:** Search theo tên model, vendor, modality.
- **FR-SEARCH-001.2:** Autocomplete gợi ý model/vendor khi gõ (≥ 2 ký tự).
- **FR-SEARCH-001.3:** Case-insensitive, trim whitespace.

**Acceptance Criteria:**
1. Gõ "gemma" → hiển thị model gemma (case-insensitive).
2. Gõ "google" → hiển thị model của Google.
3. Gõ 2 ký tự → hiển thị gợi ý dropdown.
4. Kết quả cập nhật trong ≤ 500ms sau khi dừng gõ (debounce 300ms).

#### FR-SEARCH-002: Empty state rõ ràng
**Priority:** Must Have | **Status:** Draft

**Mô tả:** Khi search/filter không có kết quả, hiển thị empty state thân thiện.

**Acceptance Criteria:**
1. Khi 0 kết quả → hiển thị icon + thông điệp "Không tìm thấy model phù hợp" + gợi ý thay đổi từ khóa.
2. Hiển thị nút "Reset filters/search".
3. Không gây timeout hay treo giao diện.

---

### FR-NAV — Điều hướng & Pagination

#### FR-NAV-001: Fix bug pagination
**Priority:** Must Have | **Status:** Draft
**Liên quan:** BUG-001, TC-HOME-005

**Mô tả:** Pagination phải hoạt động chính xác, không nhầm lẫn với model card.

**Acceptance Criteria:**
1. Click số trang → URL cập nhật (`?page=N`) và hiển thị đúng trang.
2. Click số trang KHÔNG được redirect sang trang chi tiết model.
3. Nút Previous/Next hoạt động đúng.
4. Hiển thị "Showing X–Y of Z models".

#### FR-NAV-002: Layout toggle Grid/List
**Priority:** Could Have | **Status:** Draft

**Mô tả:** Cho phép người dùng chuyển giữa chế độ xem grid và list.

**Acceptance Criteria:**
1. Nút toggle Grid/List hoạt động, giữ lựa chọn khi reload (persist).
2. Chế độ List hiển thị thông tin chi tiết hơn (nhiều cột).

---

### FR-ACCESS — Accessibility & Mobile

#### FR-ACCESS-001: Responsive mobile
**Priority:** Must Have | **Status:** Draft

**Acceptance Criteria:**
1. Homepage hiển thị đúng trên 320px, 768px, 1440px width.
2. Touch target ≥ 44×44px trên mobile.
3. Không có scroll ngang bị cắt nội dung.

#### FR-ACCESS-002: Accessibility (WCAG 2.1 AA)
**Priority:** Should Have | **Status:** Draft

**Acceptance Criteria:**
1. Contrast ratio ≥ 4.5:1 cho text.
2. Tất cả ảnh có alt text.
3. Có thể điều hướng bằng keyboard (tab, enter).
4. Focus indicator rõ ràng.

---

## 3. Yêu cầu phi chức năng (Non-Functional Requirements)

### NFR-PERF-001: Hiệu năng tải trang
**Priority:** Must Have

- **Performance:** Homepage tải hoàn tất (LCP) ≤ 2.5 giây trên kết nối 4G; FCP ≤ 1.5 giây.
- **Acceptance:** Lighthouse Performance score ≥ 85 trên desktop, ≥ 70 trên mobile.

### NFR-PERF-002: Hiệu năng tương tác
**Priority:** Must Have

- **Performance:** Search/filter phản hồi ≤ 600ms; pagination chuyển trang ≤ 800ms.
- **Acceptance:** Không có jank (long task > 250ms) khi thao tác.

### NFR-SEC-001: Bảo mật
**Priority:** Must Have

- **Security:** Tuân thủ OWASP Top 10; chống SQL injection và XSS (đã test TC-SEARCH-004/005).
- **Security:** Không hiển thị thông tin nhạy cảm của vendor ngoài dữ liệu công khai.

### NFR-COMP-001: Tương thích trình duyệt
**Priority:** Must Have

- **Compatibility:** Hỗ trợ Chrome, Firefox, Safari, Edge — 2 phiên bản mới nhất.
- **Compatibility:** Không hỗ trợ IE.

### NFR-USAB-001: Khả năng sử dụng
**Priority:** Should Have

- **Usability:** Người dùng mới hoàn thành "chọn 1 model" trong ≤ 60 giây.
- **Usability:** System Usability Scale (SUS) ≥ 70.

### NFR-REL-001: Độ tin cậy
**Priority:** Must Have

- **Reliability:** Availability ≥ 99.5%; không có lỗi pagination/search (regression-free).

### NFR-OBS-001: Quan sát & đo lường
**Priority:** Should Have

- **Observability:** Track các sự kiện: click CTA, search, filter, compare, view vendor.
- **Observability:** Dashboard analytics đo KPI (BG-1..BG-5).

---

## 4. Ma trận ưu tiên (MoSCoW)

| Ưu tiên | Số lượng | Danh sách |
|---------|----------|-----------|
| Must Have | 10 | FR-HERO-001, FR-VENDOR-001, FR-VENDOR-002, FR-MODEL-001, FR-SEARCH-001, FR-SEARCH-002, FR-NAV-001, FR-ACCESS-001, NFR-PERF-001, NFR-PERF-002, NFR-SEC-001, NFR-COMP-001, NFR-REL-001 |
| Should Have | 6 | FR-VENDOR-003, FR-MODEL-002, FR-ACCESS-002, NFR-USAB-001, NFR-OBS-001 |
| Could Have | 1 | FR-NAV-002 |
| Won't Have | 0 | — |

---

## 5. Ngoài phạm vi (Out of Scope)

- Redesign trang chi tiết model (phase 2).
- Thay đổi backend inference.
- Playground, billing, API key management.
- Thêm ngôn ngữ mới.