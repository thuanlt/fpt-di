# Kết Quả Test — AI Factory Console (neo.fpt.ai)

**URL:** `https://neo.fpt.ai/`  
**Ngày test:** 12/08/2026  
**Môi trường:** Playwright Chromium headless (anti-detect)  
**Tài khoản:** thuanlt11@fpt.com (FPT-ID)  

---

## Tóm tắt

| Tổng | ✅ Pass | ❌ Fail |
|---|---|---|
| **29** | **25** | **4** |

**Tỷ lệ Pass:** 86%

---

## Chi tiết kết quả

| TC-ID | Tên | Trạng thái | Ghi chú |
|---|---|---|---|
| TC-AUTH-001 | Login successful with FPT ID | ✅ Pass | Login successful, redirected to dashboard |
| TC-AUTH-003 | Login page displays all methods | ✅ Pass | Login page displays correctly with 4 methods + Sign up |
| TC-AUTH-004 | SQL injection in username | ❌ Fail | Expected error message |
| TC-AUTH-005 | XSS in username | ✅ Pass | XSS payload entered, no script execution detected |
| TC-DASH-001 | Dashboard displays all info | ✅ Pass | Dashboard displays all sections correctly |
| TC-DASH-002 | Sidebar navigation displays correctly | ✅ Pass | Sidebar displays all navigation items |
| TC-DASH-003 | Quick access - Click GPU Virtual Machine | ✅ Pass | Navigate to GPU VM page successfully |
| TC-DASH-004 | Recent activities displays correctly | ✅ Pass | Recent activities displays with correct format |
| TC-GPU-001 | GPU VM page displays empty state | ✅ Pass | GPU VM page displays empty state correctly |
| TC-GPU-002 | Click Create Virtual Machine | ✅ Pass | Create VM action triggered, URL: /gpu-vm/virtual-machines/new |
| TC-GPU-003 | GPU VM tabs navigation | ✅ Pass | Tabs navigation works without crash |
| TC-DDI-001 | Dedicated Inference page displays correctly | ✅ Pass | Dedicated Inference page displays correctly |
| TC-DDI-002 | Search model on Dedicated Inference | ❌ Fail | Input search là readonly (Ant Design select), không thể fill |
| TC-SLI-001 | Serverless Inference page displays correctly | ✅ Pass | Serverless Inference page displays correctly |
| TC-SLI-002 | Filter model by category | ✅ Pass | Category filter dropdown opens |
| TC-SLI-003 | Filter model by provider | ❌ Fail | Overlay ant-select-content chặn click vào dropdown |
| TC-PRICE-001 | Pricing page displays correctly | ✅ Pass | Pricing page displays all sections |
| TC-PRICE-002 | H100 GPU Instance pricing table | ✅ Pass | H100 pricing table displays correctly |
| TC-PRICE-003 | H200 GPU Instance pricing table | ✅ Pass | H200 pricing table displays correctly |
| TC-PRICE-004 | Storage pricing table | ✅ Pass | Storage pricing table displays correctly |
| TC-SET-001 | Settings sub-menu displays | ✅ Pass | Settings sub-menu displays correctly |
| TC-NAV-001 | Navigation to Dashboard | ✅ Pass | Navigation to Dashboard works |
| TC-NAV-002 | Hide/Show menu toggle | ✅ Pass | Menu toggle works |
| TC-NAV-003 | Go to Organization | ❌ Fail | Nút không tìm thấy sau khi hide menu |
| TC-NAV-004 | External link - Docs | ✅ Pass | Docs link is valid |
| TC-FB-001 | Feedback form displays correctly | ✅ Pass | Feedback form displays correctly |
| TC-FB-002 | Feedback form - Submit with empty required field | ✅ Pass | Submit with empty required field handled |
| TC-PERF-001 | Login performance < 10s | ✅ Pass | Login completed in 8.335s |
| TC-PERF-002 | Dashboard load time < 5s | ✅ Pass | Dashboard loaded in 3.037s |

---

## Phân tích Failures

### 1. TC-AUTH-004: SQL injection in username

| Field | Content |
|---|---|
| **Mức độ** | Medium |
| **Nguyên nhân** | Không tìm thấy thông báo "Invalid" sau khi nhập SQL injection payload |
| **Giả thuyết** | FPT ID có thể redirect hoặc hiển thị thông báo lỗi khác |
| **Recommendation** | Kiểm tra lại thông báo lỗi thực tế từ FPT ID |

### 2. TC-DDI-002: Search model on Dedicated Inference

| Field | Content |
|---|---|
| **Mức độ** | Low (test issue) |
| **Nguyên nhân** | Input search là `readonly` (Ant Design select component), không thể fill trực tiếp |
| **Recommendation** | Sử dụng API của Ant Design để fill select component |

### 3. TC-SLI-003: Filter model by provider

| Field | Content |
|---|---|
| **Mức độ** | Low (test issue) |
| **Nguyên nhân** | Overlay `ant-select-content` chặn click vào dropdown |
| **Recommendation** | Sử dụng keyboard events hoặc API của Ant Design |

### 4. TC-NAV-003: Go to Organization

| Field | Content |
|---|---|
| **Mức độ** | Low (test issue) |
| **Nguyên nhân** | Nút "Go to Organization" không tìm thấy sau khi hide menu |
| **Recommendation** | Kiểm tra lại selector sau khi menu bị ẩn |

---

## Screenshot evidence

Tất cả screenshot được lưu tại `docs/test-cases/screenshots/neo-*.png` (29 screenshots)