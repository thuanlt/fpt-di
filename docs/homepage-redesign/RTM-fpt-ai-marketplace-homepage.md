# Requirements Traceability Matrix (RTM)
## Redesign Homepage FPT AI Marketplace

**Phiên bản:** 1.0
**Ngày:** 17/08/2026
**Trạng thái:** Draft
**Liên quan:** BRD v1.0, SRS v1.0, User Stories v1.0, Data Dictionary v1.0

---

## 1. Mục đích

Ma trận truy vết (RTM) liên kết các yêu cầu nghiệp vụ (BR), yêu cầu chức năng (FR), yêu cầu phi chức năng (NFR), user story (US) và entity dữ liệu — đảm bảo mọi yêu cầu đều được bao phủ bởi thiết kế và có thể kiểm chứng.

---

## 2. Ma trận truy vết tổng hợp

| ID | Mô tả | Ưu tiên | BR | US | Entity dữ liệu | Test case liên quan |
|----|-------|---------|----|----|----------------|---------------------|
| FR-HERO-001 | Hero value proposition | Must | BR-05 | US-08 | — | TC-HOME-001 |
| FR-VENDOR-001 | Badge vendor trên card | Must | BR-01 | US-01 | Vendor, Model | TC-HOME-001 (mở rộng) |
| FR-VENDOR-002 | Bộ lọc theo vendor | Must | BR-02 | US-02 | Vendor, Model | TC-FILTER-* (mở rộng) |
| FR-VENDOR-003 | Trang danh sách theo vendor | Should | BR-01 | US-01 | Vendor, Model | TC mới |
| FR-MODEL-001 | Thông số kỹ thuật trên card | Must | BR-03 | US-03 | Model | TC-HOME-001 (mở rộng) |
| FR-MODEL-002 | Compare model | Should | BR-04 | US-04 | CompareSession | TC mới |
| FR-SEARCH-001 | Search cải tiến | Must | — | US-05 | Model, Vendor | TC-SEARCH-001..009 |
| FR-SEARCH-002 | Empty state | Must | — | US-06 | — | TC-SEARCH-002/004 (fix) |
| FR-NAV-001 | Fix pagination | Must | — | US-07 | Model | TC-HOME-003/004/005 (BUG-001) |
| FR-NAV-002 | Toggle Grid/List | Could | — | — | — | TC mới |
| FR-ACCESS-001 | Responsive mobile | Must | — | US-09 | — | TC mới |
| FR-ACCESS-002 | Accessibility WCAG 2.1 AA | Should | — | US-10 | — | TC mới |
| NFR-PERF-001 | Hiệu năng tải trang | Must | — | — | — | TC-PERF-001 |
| NFR-PERF-002 | Hiệu năng tương tác | Must | — | — | — | TC-PERF-002 |
| NFR-SEC-001 | Bảo mật OWASP | Must | — | — | — | TC-SEARCH-004/005 |
| NFR-COMP-001 | Tương thích trình duyệt | Must | — | — | — | TC mới |
| NFR-USAB-001 | Khả năng sử dụng | Should | — | — | — | Survey SUS |
| NFR-REL-001 | Độ tin cậy | Must | — | — | — | Regression |
| NFR-OBS-001 | Quan sát & đo lường | Should | BG-1..5 | — | AnalyticsEvent | Analytics |

---

## 3. Truy vết ngược: Yêu cầu nghiệp vụ → Chức năng

| BR | Mô tả | FR/NFR bao phủ | Trạng thái |
|----|-------|----------------|-----------|
| BR-01 | Hiển thị thương hiệu vendor | FR-VENDOR-001, FR-VENDOR-003 | ✓ Bao phủ |
| BR-02 | Bộ lọc theo vendor | FR-VENDOR-002 | ✓ Bao phủ |
| BR-03 | Thông tin kỹ thuật để modeling | FR-MODEL-001 | ✓ Bao phủ |
| BR-04 | So sánh model | FR-MODEL-002 | ✓ Bao phủ |
| BR-05 | Giá trị cốt lõi nổi bật | FR-HERO-001 | ✓ Bao phủ |
| BR-06 | Điều hướng không lỗi | FR-NAV-001, FR-SEARCH-002 | ✓ Bao phủ |

---

## 4. Truy vết ngược: Mục tiêu kinh doanh → Chức năng

| BG | Mục tiêu | FR/NFR/US hỗ trợ |
|----|----------|------------------|
| BG-1 | Tăng conversion đăng ký | FR-HERO-001 (US-08) |
| BG-2 | Giảm time-to-select-model | FR-MODEL-001, FR-VENDOR-002, FR-SEARCH-001 |
| BG-3 | Tăng độ tin cậy vendor | FR-VENDOR-001, FR-VENDOR-003 |
| BG-4 | Hỗ trợ quyết định modeling | FR-MODEL-002 (Compare) |
| BG-5 | Giảm bounce rate | FR-HERO-001, NFR-PERF-001 |

---

## 5. Truy vết dữ liệu

| Entity | FR/NFR sử dụng | Ghi chú |
|--------|----------------|---------|
| Vendor | FR-VENDOR-001/002/003 | **Entity mới** — cần bổ sung vào CMS |
| Category | FR-MODEL-001 | Đã có (filter modality) |
| Model | FR-MODEL-001, FR-NAV-001 | **Mở rộng** — thêm context, giá, latency |
| CompareSession | FR-MODEL-002 | **Entity mới** (client-side) |
| AnalyticsEvent | NFR-OBS-001 | **Entity mới** |

---

## 6. Khoảng trống (Gaps) & Hành động

| Gap | Mô tả | Hành động đề xuất | Ưu tiên |
|-----|-------|-------------------|---------|
| GAP-1 | Dữ liệu vendor chưa có trong CMS | Bổ sung entity Vendor + seed data 8 vendor | Cao |
| GAP-2 | Model thiếu context window/giá/latency | Chuẩn hóa dữ liệu model, xác nhận vendor_id từng model | Cao |
| GAP-3 | Chưa có trang so sánh | Thiết kế + phát triển FR-MODEL-002 | TB |
| GAP-4 | Bug pagination chưa fix | Fix FR-NAV-001 (selector pagination) | Cao |
| GAP-5 | Empty state chưa có | Implement FR-SEARCH-002 | Cao |
| GAP-6 | Chưa có analytics event | Implement NFR-OBS-001 | TB |

---

## 7. Trạng thái bao phủ yêu cầu

| Loại | Tổng | Đã bao phủ | Khoảng trống |
|------|------|-----------|--------------|
| FR | 12 | 12 | 0 |
| NFR | 8 | 8 | 0 |
| BR | 6 | 6 | 0 |
| US | 10 | 10 | 0 |
| BG | 5 | 5 | 0 |

> **Kết luận:** 100% yêu cầu đã được bao phủ bởi thiết kế. Các khoảng trống (GAP) chủ yếu là về dữ liệu nguồn và phát triển tính năng mới, không phải thiếu yêu cầu.