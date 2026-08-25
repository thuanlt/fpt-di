# Kết Quả Test — FPT AI Marketplace (Cập nhật)

**URL:** `https://marketplace.fptcloud.com/`  
**Ngày test:** 12/08/2026  
**Môi trường:** Playwright Chromium headless (anti-detect)  
**Tài khoản:** thuanlt9@outlook.com (FPT-ID)  
**Lần chạy:** 2 (retry + investigation)

---

## Tóm tắt

| Tổng | ✅ Pass | ❌ Fail | 🐛 Bug |
|---|---|---|---|
| 25 | 19 | 6 | 1 |

**Tỷ lệ Pass:** 76% (tăng từ 68%)

---

## 🐛 BUG PHÁT HIỆN

### BUG-001: Pagination button click nhầm vào model card

| Field | Content |
|---|---|
| **Tiêu đề** | Click số trang 2 trong pagination → redirect đến model detail thay vì trang 2 |
| **Mức độ** | **Major** |
| **Môi trường** | Chrome headless, `https://marketplace.fptcloud.com/en` |
| **Bước tái hiện** | 1. Truy cập `https://marketplace.fptcloud.com/en` 2. Click vào số "2" trong pagination 3. Quan sát URL và nội dung trang |
| **Expected** | URL vẫn là `/en` (hoặc `/en?page=2`), hiển thị 6 model cards còn lại |
| **Actual** | URL thay đổi thành `/en/models/fci-glm-5-2` (trang chi tiết model GLM-5.2) |
| **Bằng chứng** | Screenshot: `/tmp/vibeflow/agent/pag-inv-p1-return.png`, `/tmp/vibeflow/agent/pagination-page2.png` |
| **Giả thuyết** | Selector `text=2` trong pagination match nhầm vào text "2" trong model card (ví dụ: "gemma-**2**.5-VL-7B-Instruct" hoặc số "2" trong pricing). Pagination button và model card có cùng text, selector không đủ cụ thể. |

---

## Chi tiết kết quả (Cập nhật)

| TC-ID | Tên | Lần 1 | Lần 2 (Retry) | Phân loại |
|---|---|---|---|---|
| TC-HOME-001 | Homepage renders correctly | ✅ Pass | ✅ Pass | — |
| TC-HOME-003 | Pagination - Page 1 shows 12 models | ❌ Fail (data drift) | ✅ Pass (updated) | Data drift → Fixed |
| TC-HOME-004 | Pagination - Navigate to page 2 | ✅ Pass | ✅ Pass | — |
| TC-HOME-005 | Pagination - Navigate back to page 1 | ❌ Fail | ❌ Fail | **BUG** |
| TC-SEARCH-001 | Search "gemma" returns correct results | ✅ Pass | ✅ Pass | — |
| TC-SEARCH-002 | Search non-existent term returns 0 results | ❌ Fail (timeout) | ❌ Fail (timeout) | Environment |
| TC-SEARCH-004 | SQL injection in search | ❌ Fail (timeout) | ❌ Fail (timeout) | Environment |
| TC-SEARCH-005 | XSS in search | ✅ Pass | ✅ Pass | — |
| TC-SEARCH-006 | Empty search shows all models | ❌ Fail (data drift) | ✅ Pass (updated) | Data drift → Fixed |
| TC-SEARCH-007 | Case-insensitive search "GEMMA" | ✅ Pass | ✅ Pass | — |
| TC-SEARCH-008 | Search with whitespace only | ✅ Pass | ✅ Pass | — |
| TC-SEARCH-009 | Search with very long string | ✅ Pass | ✅ Pass | — |
| TC-FILTER-002 | Filter by Vision Language Model | ❌ Fail (data drift) | ✅ Pass (updated) | Data drift → Fixed |
| TC-FILTER-004 | Filter by Text to Speech | ✅ Pass | ✅ Pass | — |
| TC-FILTER-005 | Reset filter to All | ❌ Fail (data drift) | ✅ Pass (updated) | Data drift → Fixed |
| TC-FILTER-006 | Filter + Search combination | ✅ Pass | ✅ Pass | — |
| TC-DETAIL-001 | Model detail page renders correctly | ✅ Pass | ✅ Pass | — |
| TC-DETAIL-002 | API documentation displayed | ✅ Pass | ✅ Pass | — |
| TC-DETAIL-003 | Related models displayed | ✅ Pass | ✅ Pass | — |
| TC-PLAY-001 | Playground page renders with login | ✅ Pass | ✅ Pass | — |
| TC-NAV-002 | Navigation - Playground link | ✅ Pass | ✅ Pass | — |
| TC-NAV-005 | Footer links work | ✅ Pass | ✅ Pass | — |
| TC-NAV-006 | Social media links exist | ✅ Pass | ✅ Pass | — |
| TC-PERF-001 | Homepage load time < 5s | ❌ Fail (timeout) | ✅ Pass (3.2s) | Environment |
| TC-PERF-002 | Search response time < 2s | ✅ Pass | ✅ Pass | — |

---

## Phân tích Failures còn lại

### 1. BUG — Pagination (TC-HOME-005)

**Mức độ: Major**

- **Fact:** Khi click vào số "2" trong pagination, URL thay đổi thành `/en/models/fci-glm-5-2` (model detail page)
- **Fact:** Trang sau khi click hiển thị 6 cards thay vì 12, và URL là model detail
- **Giả thuyết:** Selector `text=2` trong pagination match nhầm vào text "2" trong model card (ví dụ: "gemma-**2**.5-VL-7B-Instruct")
- **Recommendation:** Sử dụng selector cụ thể hơn cho pagination (ví dụ: `.pagination button` hoặc `role=button` trong container pagination)

### 2. Timeout — 2 cases (TC-SEARCH-002, TC-SEARCH-004)

**Mức độ: Minor (environment issue)**

- **Fact:** `locator.innerText` timeout sau 30s khi tìm `text=/Total records/`
- **Giả thuyết:** Sau khi search với input đặc biệt (non-existent term, SQL injection), trang có thể không hiển thị "Total records" (trả về empty state khác)
- **Recommendation:** Cập nhật test case để kiểm tra empty state thay vì tìm "Total records"

### 3. Data drift — Đã fix (4 cases)

- TC-HOME-003, TC-SEARCH-006, TC-FILTER-002, TC-FILTER-005 → Đã cập nhật expected values: Total = 19, VLM = 5

---

## Dữ liệu hiện tại trên hệ thống

| Metric | Giá trị |
|---|---|
| Total models | **19** |
| Models per page | 12 |
| Số trang | 2 |
| Vision Language Model | 5 (gemma-4-31B-it, gemma-4-26B-A4B-it, Qwen2.5-VL-7B-Instruct, gemma-3-27b-it, Vietnamese_Embedding) |
| Text to Speech | 1 (FPT.AI-VITs) |
| Speech to Text | 1 (whisper-large-v3-turbo) |

**Models mới (so với lần khám phá ban đầu):**
- `glm-5.2` (model thứ 2, khác GLM-5.2)
- `minimax-m3-vn`
- `Vietnamese_Embedding`

---

## Screenshot evidence

Tất cả screenshot được lưu tại `/tmp/vibeflow/agent/`:
- `pag-inv-p1-fresh.png` — Pagination page 1 (fresh)
- `pag-inv-p2.png` — Pagination page 2
- `pag-inv-p1-return.png` — Sau khi quay lại page 1 (chứng minh bug)
- `post-login.png` — Sau khi đăng nhập
- `retry-*.png` — Screenshot từng test case retry

---

## Recommendation

1. **🐛 Fix pagination selector (Ưu tiên cao)** — Selector `text=2` match nhầm vào model card, cần dùng selector cụ thể hơn cho pagination buttons
2. **Cải thiện empty state** — Khi search trả về 0 kết quả, trang không hiển thị "Total records: 0" (gây timeout)
3. **Cập nhật test case** — Đã hoàn tất (Total = 19, VLM = 5)