# Process Flows (BPMN Notation)
## Redesign Homepage FPT AI Marketplace

**Phiên bản:** 1.0
**Ngày:** 17/08/2026
**Trạng thái:** Draft
**Liên quan:** SRS v1.0, User Stories v1.0

> Lưu ý: Các sơ đồ dưới đây dùng ký pháp BPMN được biểu diễn bằng Mermaid (flowchart), phù hợp để render trong preview.

---

## 1. Quy trình: Khách hàng chọn model để modeling

**Mô tả:** Luồng chính của một người dùng kỹ thuật (BA/Developer) từ lúc vào homepage đến khi chọn được model phù hợp để tích hợp.

**Actors:**
- **Người dùng (User):** Khách ghé thăm / nhà phát triển
- **Hệ thống (System):** FPT AI Marketplace

### Flow

```mermaid
flowchart TD
    A([Người dùng mở homepage]) --> B{Hero hiển thị}
    B -->|Click Explore Models| C[Cuộn xuống danh sách model]
    B -->|Click Start Free| Z([Trang đăng ký])

    C --> D[Nhìn thấy danh sách model card<br/>có vendor + thông số kỹ thuật]
    D --> E{Lọc theo vendor?}
    E -->|Có| F[Chọn vendor trong filter bar]
    E -->|Không| G
    F --> G{Tìm kiếm thêm?}
    G -->|Có| H[Nhập từ khóa search<br/>có autocomplete]
    G -->|Không| I
    H --> I{Dùng Compare?}
    I -->|Có| J[Tick Compare 2-4 model]
    I -->|Không| K
    J --> L[Click Compare]
    L --> M[Trang so sánh side-by-side]
    M --> K
    K{Số kết quả?}
    K -->|0 kết quả| N[Empty state hiển thị]
    N --> O[Click Reset filters/search]
    O --> C
    K -->|Có kết quả| P[Click vào model card]
    P --> Q([Trang chi tiết model])
```

**Business Rules:**
- BR-01: Mỗi model gắn đúng 1 vendor.
- BR-02: Multi-select vendor dùng OR logic.
- BR-04: Compare tối đa 4 model.

**Exceptions:**
- Không có kết quả → empty state (FR-SEARCH-002).
- Chọn model thứ 5 trong compare → chặn + thông báo.

---

## 2. Quy trình: Bộ lọc theo nhà cung cấp

**Mô tả:** Luồng xử lý khi người dùng lọc model theo vendor.

```mermaid
flowchart TD
    A([User chọn vendor trong filter]) --> B{Có nhiều vendor?}
    B -->|1 vendor| C[Query model theo vendor]
    B -->|Nhiều vendor| D[Query model theo OR logic]
    C --> E[Cập nhật danh sách real-time]
    D --> E
    E --> F{Số kết quả?}
    F -->|>0| G[Hiển thị danh sách + tổng số]
    F -->|0| H[Hiển thị empty state]
    G --> I{User click Clear all?}
    H --> I
    I -->|Có| J[Reset về toàn bộ model]
    I -->|Không| K([Kết thúc])
    J --> K
```

**Business Rules:**
- BR-02: OR logic cho multi-select.
- Tổng số kết quả cập nhật real-time (FR-VENDOR-002.4).

---

## 3. Quy trình: So sánh model (Compare)

**Mô tả:** Luồng so sánh tối đa 4 model cạnh nhau.

```mermaid
flowchart TD
    A([User tick Compare trên card]) --> B{Số model đã chọn?}
    B -->|< 4| C[Thêm vào Compare bar<br/>hiển thị X/4]
    B -->|= 4| D{User tick model thứ 5?}
    D -->|Có| E[Chặn + thông báo<br/>Tối đa 4 model]
    D -->|Không| F
    C --> F{User click Compare?}
    E --> F
    F -->|Có| G[Tạo trang so sánh side-by-side]
    G --> H{User chọn Try in Playground?}
    H -->|Có| I([Playground model])
    H -->|Không| J([Kết thúc])
    F -->|Không| K([Tiếp tục duyệt])
```

**Business Rules:**
- BR-04: Giới hạn 4 model.

---

## 4. Quy trình: Tìm kiếm với Empty State

**Mô tả:** Luồng xử lý search và trường hợp không có kết quả.

```mermaid
flowchart TD
    A([User gõ từ khóa]) --> B{≥ 2 ký tự?}
    B -->|Có| C[Hiển thị autocomplete dropdown]
    B -->|Không| D[Chờ nhập thêm]
    C --> E[Debounce 300ms]
    E --> F[Thực hiện search<br/>case-insensitive + trim]
    F --> G{Số kết quả?}
    G -->|>0| H[Hiển thị danh sách model]
    G -->|0| I[Hiển thị empty state<br/>icon + thông điệp + Reset]
    H --> J([Kết thúc])
    I --> K{User click Reset?}
    K -->|Có| L[Reset về toàn bộ model]
    K -->|Không| J
    L --> J
```

**Business Rules:**
- FR-SEARCH-001.3: Case-insensitive, trim whitespace.
- FR-SEARCH-001.2: Autocomplete khi ≥ 2 ký tự.
- Debounce 300ms, phản hồi ≤ 500ms.

---

## 5. Quy trình: Điều hướng Pagination (Fix bug)

**Mô tả:** Luồng pagination chuẩn, khắc phục BUG-001.

```mermaid
flowchart TD
    A([User click số trang N]) --> B[Xác định vùng click<br/>trong container pagination]
    B --> C[Cập nhật URL ?page=N]
    C --> D[Fetch model trang N]
    D --> E[Render danh sách trang N]
    E --> F[Hiển thị Showing X-Y of Z]
    F --> G([Kết thúc])
```

**Business Rules:**
- FR-NAV-001: Click số trang KHÔNG được redirect sang trang chi tiết model.
- Hiển thị "Showing X–Y of Z models".

**Exceptions:**
- Nếu click nhầm vào vùng model card (ngoài pagination) → hành vi mở trang chi tiết là đúng; phải phân biệt vùng click bằng selector cụ thể.

---

## 6. Sơ đồ tổng quan kiến trúc trang (Wireframe mức cao)

```mermaid
flowchart LR
    subgraph Homepage
        H[Header: Logo, Nav, Login]
        HE[Hero: Headline + Benefit + CTA + Trusted Vendors]
        SB[Search Bar + Filter Bar<br/>Vendor | Modality | Context | Price]
        GR[Grid Model Cards<br/>Vendor badge + thông số kỹ thuật]
        PG[Pagination + Showing X-Y of Z]
        FT[Footer]
    end
    GR --> CB[(Compare Bar<br/>nổi bottom)]
    CB --> CP[Trang Compare]
    GR --> MD[Trang chi tiết model]
    HE --> RG[Trang đăng ký]
```