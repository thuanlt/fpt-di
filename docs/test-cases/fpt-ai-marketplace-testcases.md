# Test Case — FPT AI Marketplace

**URL:** `https://marketplace.fptcloud.com/`  
**Ngày:** 12/08/2026  
**Tiêu chuẩn:** IPA (Information-technology Promotion Agency, Japan)  
**Ngôn ngữ:** Tiếng Việt  

---

## Tổng quan

FPT AI Marketplace là trang marketplace cung cấp các AI models từ nhiều provider (Anthropic, OpenAI, Alibaba, DeepSeek, FPT). Trang bao gồm các tính năng chính:

- **Danh sách model** — Hiển thị 17 models, phân trang 12/trang, có search & filter
- **Model detail** — Chi tiết model, pricing, API documentation
- **Playground** — Chạy thử model (yêu cầu đăng nhập)
- **Search** — Tìm kiếm model theo tên
- **Filter** — Lọc theo Provider và loại model (LLM, VLM, TTS, STT, v.v.)
- **Sign In/Sign Up** — Đăng nhập/Đăng ký tài khoản

---

## 1. Trang chủ — Danh sách Model (Homepage / Model Catalog)

### TC-HOME-001: Hiển thị trang chủ thành công

| Field | Content |
|---|---|
| **TC-ID** | TC-HOME-001 |
| **Function** | Homepage rendering |
| **Screen** | `https://marketplace.fptcloud.com/` |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Trang chủ tải và hiển thị đúng nội dung |
| **Precondition** | Không |
| **Procedure** | 1. Mở trình duyệt, truy cập `https://marketplace.fptcloud.com/` |
| **Expected Result** | 1. Trang redirect về `/en` (hoặc `/vi` nếu chọn tiếng Việt) 2. Tiêu đề trang: "FPT AI Marketplace" 3. Hiển thị heading "Your Production-Grade Gateway to World-Class AI Models" 4. Hiển thị danh sách model cards (12 models trên trang 1) 5. Hiển thị navigation bar: Model Status, Playground, Pricing, User guide, API Reference 6. Hiển thị nút "Sign in/Sign up" và "Get Your API Key" |
| **Notes** | Kiểm tra trên Chrome, Firefox, Edge |

---

### TC-HOME-002: Hiển thị thông tin model card đầy đủ

| Field | Content |
|---|---|
| **TC-ID** | TC-HOME-002 |
| **Function** | Model card display |
| **Screen** | Homepage |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Mỗi model card hiển thị đầy đủ thông tin |
| **Precondition** | Trang chủ đã tải thành công |
| **Procedure** | 1. Kiểm tra card "GLM-5.2" trên trang chủ |
| **Expected Result** | 1. Hiển thị tên model: "GLM-5.2" 2. Hiển thị loại: "Large Language Model · Hosted by FPT" 3. Hiển thị mô tả ngắn (có chứa "1M-token context window") 4. Hiển thị pricing: Context 1m, Cached $0.26/M, Input $1.4/M, Output $4.4/M 5. Click vào card → redirect đến `/en/models/fci-glm-5-2` |
| **Notes** | Kiểm tra ít nhất 3 model cards khác nhau |

---

### TC-HOME-003: Pagination — Trang 1

| Field | Content |
|---|---|
| **TC-ID** | TC-HOME-003 |
| **Function** | Pagination |
| **Screen** | Homepage |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Hiển thị đúng số lượng model trên trang 1 |
| **Precondition** | Trang chủ đã tải thành công |
| **Procedure** | 1. Đếm số model cards hiển thị trên trang 1 2. Kiểm tra text "Total records: 19" và "12 / page" |
| **Expected Result** | 1. Hiển thị đúng 12 model cards trên trang 1 2. Hiển thị "Total records: 19" 3. Hiển thị "12 / page" 4. Hiển thị số trang: 1, 2 |
| **Notes** | Không |

---

### TC-HOME-004: Pagination — Chuyển sang trang 2

| Field | Content |
|---|---|
| **TC-ID** | TC-HOME-004 |
| **Function** | Pagination |
| **Screen** | Homepage |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Click vào trang 2, hiển thị đúng model còn lại |
| **Precondition** | Trang chủ đã tải, đang ở trang 1 |
| **Procedure** | 1. Click vào số "2" ở phần pagination |
| **Expected Result** | 1. Trang chuyển sang trang 2 2. Hiển thị 5 model cards (17 - 12 = 5) 3. Số "2" được highlight/active 4. Các model trên trang 2 khác với trang 1 |
| **Notes** | Không |

---

### TC-HOME-005: Pagination — Quay lại trang 1

| Field | Content |
|---|---|
| **TC-ID** | TC-HOME-005 |
| **Function** | Pagination |
| **Screen** | Homepage |
| **Viewpoint** | 準正常系 (Semi-normal) |
| **Test Item** | Click vào trang 1 khi đang ở trang 2 |
| **Precondition** | Đang ở trang 2 |
| **Procedure** | 1. Click vào số "1" ở phần pagination |
| **Expected Result** | 1. Trang quay về trang 1 2. Hiển thị lại 12 model cards 3. Số "1" được highlight/active |
| **Notes** | Không |

---

## 2. Search

### TC-SEARCH-001: Tìm kiếm model theo tên thành công

| Field | Content |
|---|---|
| **TC-ID** | TC-SEARCH-001 |
| **Function** | Search |
| **Screen** | Homepage |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Tìm kiếm "gemma" trả về đúng kết quả |
| **Precondition** | Trang chủ đã tải thành công |
| **Procedure** | 1. Nhập "gemma" vào ô tìm kiếm 2. Chờ kết quả hiển thị |
| **Expected Result** | 1. Hiển thị 3 model chứa "gemma": gemma-4-31B-it, gemma-4-26B-A4B-it, gemma-3-27b-it 2. "Total records: 3" 3. Chỉ còn 1 trang |
| **Notes** | Không |

---

### TC-SEARCH-002: Tìm kiếm không có kết quả

| Field | Content |
|---|---|
| **TC-ID** | TC-SEARCH-002 |
| **Function** | Search |
| **Screen** | Homepage |
| **Viewpoint** | 準正常系 (Semi-normal) |
| **Test Item** | Tìm kiếm từ khóa không tồn tại |
| **Precondition** | Trang chủ đã tải thành công |
| **Procedure** | 1. Nhập "xyznonexistent" vào ô tìm kiếm 2. Chờ kết quả hiển thị |
| **Expected Result** | 1. Không hiển thị model card nào 2. "Total records: 0" 3. Không có lỗi, hiển thị thông báo "No results" hoặc danh sách rỗng |
| **Notes** | Không |

---

### TC-SEARCH-003: Tìm kiếm với ký tự đặc biệt

| Field | Content |
|---|---|
| **TC-ID** | TC-SEARCH-003 |
| **Function** | Search |
| **Screen** | Homepage |
| **Viewpoint** | 異常系 (Abnormal) |
| **Test Item** | Tìm kiếm với ký tự đặc biệt |
| **Precondition** | Trang chủ đã tải thành công |
| **Procedure** | 1. Nhập `gemma-4-31B-it` (có ký tự `-`) vào ô tìm kiếm 2. Chờ kết quả |
| **Expected Result** | 1. Tìm thấy model "gemma-4-31B-it" hoặc không crash 2. Không có lỗi trang, không crash |
| **Notes** | Không |

---

### TC-SEARCH-004: Tìm kiếm với ký tự SQL injection

| Field | Content |
|---|---|
| **TC-ID** | TC-SEARCH-004 |
| **Function** | Search |
| **Screen** | Homepage |
| **Viewpoint** | Security |
| **Test Item** | SQL injection trong ô tìm kiếm |
| **Precondition** | Trang chủ đã tải thành công |
| **Procedure** | 1. Nhập `' OR 1=1 --` vào ô tìm kiếm 2. Chờ kết quả |
| **Expected Result** | 1. Không trả về toàn bộ database 2. Không có lỗi SQL hiển thị 3. Trả về 0 kết quả hoặc kết quả an toàn |
| **Notes** | Kiểm tra backend sử dụng parameterized query |

---

### TC-SEARCH-005: Tìm kiếm với XSS payload

| Field | Content |
|---|---|
| **TC-ID** | TC-SEARCH-005 |
| **Function** | Search |
| **Screen** | Homepage |
| **Viewpoint** | Security |
| **Test Item** | XSS trong ô tìm kiếm |
| **Precondition** | Trang chủ đã tải thành công |
| **Procedure** | 1. Nhập `<script>alert('xss')</script>` vào ô tìm kiếm 2. Chờ kết quả |
| **Expected Result** | 1. Không execute JavaScript 2. Không có alert box hiện lên 3. Input được HTML-encode hoặc bị chặn |
| **Notes** | Kiểm tra console không có lỗi JavaScript do payload |

---

### TC-SEARCH-006: Tìm kiếm với chuỗi rỗng

| Field | Content |
|---|---|
| **TC-ID** | TC-SEARCH-006 |
| **Function** | Search |
| **Screen** | Homepage |
| **Viewpoint** | 準正常系 (Semi-normal) |
| **Test Item** | Ô tìm kiếm rỗng hiển thị tất cả model |
| **Precondition** | Trang chủ đã tải thành công |
| **Procedure** | 1. Xóa hết nội dung trong ô tìm kiếm (nếu có) 2. Chờ kết quả |
| **Expected Result** | 1. Hiển thị lại tất cả 19 models 2. "Total records: 19" |
| **Notes** | Không |

---

### TC-SEARCH-007: Tìm kiếm phân biệt hoa/thường

| Field | Content |
|---|---|
| **TC-ID** | TC-SEARCH-007 |
| **Function** | Search |
| **Screen** | Homepage |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Tìm kiếm "GEMMA" (viết hoa) |
| **Precondition** | Trang chủ đã tải thành công |
| **Procedure** | 1. Nhập "GEMMA" (viết hoa toàn bộ) vào ô tìm kiếm 2. Chờ kết quả |
| **Expected Result** | 1. Tìm thấy 3 model gemma (case-insensitive search) 2. Kết quả giống như tìm "gemma" thường |
| **Notes** | Assumption: search nên case-insensitive |

---

### TC-SEARCH-008: Tìm kiếm với khoảng trắng

| Field | Content |
|---|---|
| **TC-ID** | TC-SEARCH-008 |
| **Function** | Search |
| **Screen** | Homepage |
| **Viewpoint** | 異常系 (Abnormal) |
| **Test Item** | Tìm kiếm chỉ khoảng trắng |
| **Precondition** | Trang chủ đã tải thành công |
| **Procedure** | 1. Nhập "   " (3 khoảng trắng) vào ô tìm kiếm 2. Chờ kết quả |
| **Expected Result** | 1. Hiển thị tất cả model hoặc 0 kết quả 2. Không crash, không lỗi |
| **Notes** | Không |

---

### TC-SEARCH-009: Tìm kiếm chuỗi dài

| Field | Content |
|---|---|
| **TC-ID** | TC-SEARCH-009 |
| **Function** | Search |
| **Screen** | Homepage |
| **Viewpoint** | 境界値 (Boundary) |
| **Test Item** | Tìm kiếm với chuỗi rất dài (1000 ký tự) |
| **Precondition** | Trang chủ đã tải thành công |
| **Procedure** | 1. Nhập chuỗi 1000 ký tự ("a" lặp 1000 lần) vào ô tìm kiếm 2. Chờ kết quả |
| **Expected Result** | 1. Không crash, không lỗi server 2. Trả về 0 kết quả hoặc xử lý an toàn 3. Thời gian phản hồi hợp lý (< 5 giây) |
| **Notes** | Boundary: kiểm tra max length của input field |

---

## 3. Filter

### TC-FILTER-001: Lọc theo loại model — Large Language Model

| Field | Content |
|---|---|
| **TC-ID** | TC-FILTER-001 |
| **Function** | Filter by model type |
| **Screen** | Homepage |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Lọc "Large Language Model" trả về đúng kết quả |
| **Precondition** | Trang chủ đã tải thành công |
| **Procedure** | 1. Click vào filter "Provider" hoặc filter loại model 2. Chọn "Large Language Model" 3. Chờ kết quả |
| **Expected Result** | 1. Chỉ hiển thị model có loại "Large Language Model" 2. "Total records" giảm so với 17 3. Các model hiển thị đều có label "Large Language Model" |
| **Notes** | Không |

---

### TC-FILTER-002: Lọc theo loại model — Vision Language Model

| Field | Content |
|---|---|
| **TC-ID** | TC-FILTER-002 |
| **Function** | Filter by model type |
| **Screen** | Homepage |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Lọc "Vision Language Model" trả về đúng kết quả |
| **Precondition** | Trang chủ đã tải thành công |
| **Procedure** | 1. Chọn filter "Vision Language Model" 2. Chờ kết quả |
| **Expected Result** | 1. Chỉ hiển thị model có loại "Vision Language Model" (gemma-4-31B-it, gemma-4-26B-A4B-it, Qwen2.5-VL-7B-Instruct, gemma-3-27b-it, Vietnamese_Embedding) 2. "Total records" = 5 |
| **Notes** | Không |

---

### TC-FILTER-003: Lọc theo loại model — Speech to Text

| Field | Content |
|---|---|
| **TC-ID** | TC-FILTER-003 |
| **Function** | Filter by model type |
| **Screen** | Homepage |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Lọc "Speech to Text" trả về đúng kết quả |
| **Precondition** | Trang chủ đã tải thành công |
| **Procedure** | 1. Chọn filter "Speech to Text" 2. Chờ kết quả |
| **Expected Result** | 1. Chỉ hiển thị model "whisper-large-v3-turbo" 2. "Total records" = 1 |
| **Notes** | Không |

---

### TC-FILTER-004: Lọc theo loại model — Text to Speech

| Field | Content |
|---|---|
| **TC-ID** | TC-FILTER-004 |
| **Function** | Filter by model type |
| **Screen** | Homepage |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Lọc "Text to Speech" trả về đúng kết quả |
| **Precondition** | Trang chủ đã tải thành công |
| **Procedure** | 1. Chọn filter "Text to Speech" 2. Chờ kết quả |
| **Expected Result** | 1. Chỉ hiển thị model "FPT.AI-VITs" 2. "Total records" = 1 |
| **Notes** | Không |

---

### TC-FILTER-005: Reset filter — Chọn "All"

| Field | Content |
|---|---|
| **TC-ID** | TC-FILTER-005 |
| **Function** | Filter reset |
| **Screen** | Homepage |
| **Viewpoint** | 準正常系 (Semi-normal) |
| **Test Item** | Reset filter về "All" |
| **Precondition** | Đang filter theo một loại model |
| **Procedure** | 1. Chọn "All" trong filter |
| **Expected Result** | 1. Hiển thị lại tất cả 19 models 2. "Total records: 19" |
| **Notes** | Không |

---

### TC-FILTER-006: Filter kết hợp Search

| Field | Content |
|---|---|
| **TC-ID** | TC-FILTER-006 |
| **Function** | Filter + Search combination |
| **Screen** | Homepage |
| **Viewpoint** | Combination |
| **Test Item** | Kết hợp search và filter |
| **Precondition** | Trang chủ đã tải thành công |
| **Procedure** | 1. Nhập "gemma" vào ô tìm kiếm 2. Chọn filter "Vision Language Model" 3. Chờ kết quả |
| **Expected Result** | 1. Kết quả là giao của search "gemma" và filter "Vision Language Model" 2. Hiển thị gemma-4-31B-it, gemma-4-26B-A4B-it, gemma-3-27b-it (3 models) 3. Không hiển thị Qwen2.5-VL-7B (không chứa "gemma") |
| **Notes** | Logic AND giữa search và filter |

---

### TC-FILTER-007: Filter loại không có model

| Field | Content |
|---|---|
| **TC-ID** | TC-FILTER-007 |
| **Function** | Filter empty result |
| **Screen** | Homepage |
| **Viewpoint** | 準正常系 (Semi-normal) |
| **Test Item** | Filter loại model không có model nào (ví dụ: ReRanking, Guardrail) |
| **Precondition** | Trang chủ đã tải thành công |
| **Procedure** | 1. Chọn filter "ReRanking" 2. Chờ kết quả |
| **Expected Result** | 1. Không hiển thị model card nào 2. "Total records: 0" 3. Không crash, hiển thị thông báo không có kết quả |
| **Notes** | Không |

---

## 4. Model Detail Page

### TC-DETAIL-001: Truy cập trang chi tiết model

| Field | Content |
|---|---|
| **TC-ID** | TC-DETAIL-001 |
| **Function** | Model detail page |
| **Screen** | `/en/models/qwen3.6-27b` |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Click vào model card, mở trang chi tiết |
| **Precondition** | Trang chủ đã tải thành công |
| **Procedure** | 1. Click vào model card "Qwen3.6-27B" trên trang chủ |
| **Expected Result** | 1. Redirect đến `/en/models/qwen3.6-27b` 2. Hiển thị breadcrumb: `/ Qwen3.6-27B` 3. Hiển thị tên model: "Qwen3.6-27B" 4. Hiển thị loại: "Large Language Model" 5. Hiển thị pricing: Context 262K, Input $0.3/M, Output $3.25/M, Cached $0.15/M 6. Hiển thị mô tả chi tiết model 7. Hiển thị nút "Try in Playground" và "Request Dedicated Inference" |
| **Notes** | Không |

---

### TC-DETAIL-002: Hiển thị API documentation

| Field | Content |
|---|---|
| **TC-ID** | TC-DETAIL-002 |
| **Function** | API documentation |
| **Screen** | Model detail page |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Hiển thị API documentation với cURL example |
| **Precondition** | Đang ở trang chi tiết model |
| **Procedure** | 1. Cuộn xuống phần "Inference API" 2. Kiểm tra tab "cURL" |
| **Expected Result** | 1. Hiển thị endpoint: `curl -X POST https://mkp-api.fptcloud.com/v1/chat/completions` 2. Hiển thị header: `Content-Type: application/json` và `Authorization: Bearer your-api-key` 3. Hiển thị sample input JSON với model name, messages, temperature, max_tokens, v.v. 4. Hiển thị sample output JSON với code 200 |
| **Notes** | Không |

---

### TC-DETAIL-003: Hiển thị Related Models

| Field | Content |
|---|---|
| **TC-ID** | TC-DETAIL-003 |
| **Function** | Related models |
| **Screen** | Model detail page |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Hiển thị danh sách related models |
| **Precondition** | Đang ở trang chi tiết model |
| **Procedure** | 1. Cuộn xuống phần "Related models" |
| **Expected Result** | 1. Hiển thị ít nhất 3 related models 2. Mỗi related model có tên, loại, pricing 3. Có link "View all" để xem tất cả |
| **Notes** | Không |

---

### TC-DETAIL-004: Click "Try in Playground"

| Field | Content |
|---|---|
| **TC-ID** | TC-DETAIL-004 |
| **Function** | Navigate to Playground |
| **Screen** | Model detail page |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Click "Try in Playground" từ trang chi tiết |
| **Precondition** | Đang ở trang chi tiết model |
| **Procedure** | 1. Click nút "Try in Playground" |
| **Expected Result** | 1. Redirect đến `/en/playground?model=<model-name>` 2. Model được chọn sẵn trong dropdown |
| **Notes** | Nếu chưa đăng nhập, hiển thị yêu cầu đăng nhập |

---

### TC-DETAIL-005: Các tab trên trang chi tiết

| Field | Content |
|---|---|
| **TC-ID** | TC-DETAIL-005 |
| **Function** | Detail page tabs |
| **Screen** | Model detail page |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Kiểm tra các tab: Inference API, Details, Benchmarks, Rate limit, Review |
| **Precondition** | Đang ở trang chi tiết model |
| **Procedure** | 1. Click lần lượt vào từng tab: Inference API, Details, Benchmarks, Rate limit, Review |
| **Expected Result** | 1. Mỗi tab hiển thị nội dung tương ứng 2. Tab "Inference API" — hiển thị API docs 3. Tab "Details" — hiển thị thông tin chi tiết model 4. Tab "Benchmarks" — hiển thị benchmark scores 5. Tab "Rate limit" — hiển thị giới hạn rate 6. Tab "Review" — hiển thị đánh giá (nếu có) |
| **Notes** | Không |

---

## 5. Playground

### TC-PLAY-001: Truy cập Playground — Chưa đăng nhập

| Field | Content |
|---|---|
| **TC-ID** | TC-PLAY-001 |
| **Function** | Playground access |
| **Screen** | `/en/playground` |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Truy cập Playground khi chưa đăng nhập |
| **Precondition** | Chưa đăng nhập |
| **Procedure** | 1. Truy cập `/en/playground` |
| **Expected Result** | 1. Trang Playground tải thành công 2. Hiển thị model dropdown (mặc định GLM-5.2) 3. Hiển thị các tham số: Temperature, Max output tokens, Top P, Top K, Presence penalty, Frequency penalty 4. Hiển thị "Enable streaming" checkbox 5. Hiển thị "System prompt" input 6. Hiển thị các gợi ý prompt mẫu 7. Hiển thị thông báo "You need to log in to access this feature" 8. Nút "Login or sign up" có thể click |
| **Notes** | Không |

---

### TC-PLAY-002: Click "Login or sign up" từ Playground

| Field | Content |
|---|---|
| **TC-ID** | TC-PLAY-002 |
| **Function** | Login redirect from Playground |
| **Screen** | Playground |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Click "Login or sign up" từ Playground |
| **Precondition** | Chưa đăng nhập, đang ở Playground |
| **Procedure** | 1. Click nút "Login or sign up" trên Playground |
| **Expected Result** | 1. Redirect đến trang đăng nhập hoặc mở modal đăng nhập 2. Không crash, không lỗi |
| **Notes** | Không |

---

### TC-PLAY-003: Playground — Các tham số model

| Field | Content |
|---|---|
| **TC-ID** | TC-PLAY-003 |
| **Function** | Playground parameters |
| **Screen** | Playground |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Kiểm tra các tham số có thể điều chỉnh |
| **Precondition** | Đang ở Playground |
| **Procedure** | 1. Kiểm tra các trường tham số |
| **Expected Result** | 1. "Temperature" — slider/input, giá trị mặc định (thường 1.0) 2. "Max output tokens" — input number 3. "Top P" — slider/input 4. "Top K" — slider/input 5. "Presence penalty" — slider/input 6. "Frequency penalty" — slider/input 7. "Enable streaming" — checkbox |
| **Notes** | Không |

---

### TC-PLAY-004: Playground — Gợi ý prompt mẫu

| Field | Content |
|---|---|
| **TC-ID** | TC-PLAY-004 |
| **Function** | Prompt suggestions |
| **Screen** | Playground |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Click vào prompt mẫu |
| **Precondition** | Đang ở Playground |
| **Procedure** | 1. Click vào "Create a blog outline" 2. Kiểm tra nội dung prompt |
| **Expected Result** | 1. Prompt "Create a blog outline" được điền vào ô prompt 2. Có thể chỉnh sửa nội dung prompt |
| **Notes** | Kiểm tra từng prompt mẫu |

---

## 6. Navigation

### TC-NAV-001: Navigation bar — Model Status

| Field | Content |
|---|---|
| **TC-ID** | TC-NAV-001 |
| **Function** | Navigation |
| **Screen** | Any page |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Click "Model Status" trong navigation |
| **Precondition** | Đang ở bất kỳ trang nào |
| **Procedure** | 1. Click "Model Status" trong navigation bar |
| **Expected Result** | 1. Redirect đến `/en/model-status` 2. Trang tải thành công 3. Hiển thị danh sách model với trạng thái |
| **Notes** | Trang model-status có thể timeout (đã phát hiện trong exploration) |

---

### TC-NAV-002: Navigation bar — Playground

| Field | Content |
|---|---|
| **TC-ID** | TC-NAV-002 |
| **Function** | Navigation |
| **Screen** | Any page |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Click "Playground" trong navigation |
| **Precondition** | Đang ở bất kỳ trang nào |
| **Procedure** | 1. Click "Playground" trong navigation bar |
| **Expected Result** | 1. Redirect đến `/en/playground` 2. Trang Playground tải thành công |
| **Notes** | Không |

---

### TC-NAV-003: Navigation bar — Pricing (external link)

| Field | Content |
|---|---|
| **TC-ID** | TC-NAV-003 |
| **Function** | Navigation |
| **Screen** | Any page |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Click "Pricing" trong navigation |
| **Precondition** | Đang ở bất kỳ trang nào |
| **Procedure** | 1. Click "Pricing" trong navigation bar |
| **Expected Result** | 1. Redirect đến `https://ai.fptcloud.com/pricing/maas` 2. Mở trong tab mới hoặc cùng tab |
| **Notes** | Link external, kiểm tra đúng URL |

---

### TC-NAV-004: Navigation bar — API Reference (external link)

| Field | Content |
|---|---|
| **TC-ID** | TC-NAV-004 |
| **Function** | Navigation |
| **Screen** | Any page |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Click "API Reference" trong navigation |
| **Precondition** | Đang ở bất kỳ trang nào |
| **Procedure** | 1. Click "API Reference" trong navigation bar |
| **Expected Result** | 1. Redirect đến `https://github.com/fpt-corp/ai-marketplace` 2. Mở trong tab mới hoặc cùng tab |
| **Notes** | Link external đến GitHub |

---

### TC-NAV-005: Footer links

| Field | Content |
|---|---|
| **TC-ID** | TC-NAV-005 |
| **Function** | Footer navigation |
| **Screen** | Any page |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Kiểm tra các link trong footer |
| **Precondition** | Đang ở bất kỳ trang nào |
| **Procedure** | 1. Cuộn xuống footer 2. Click từng link: FPT AI Factory, FPT Cloud, Privacy Policy, Terms Of Use, User guide, API Reference |
| **Expected Result** | 1. "FPT AI Factory" → `https://ai.fptcloud.com/` 2. "FPT Cloud" → `https://fptcloud.com/en/` 3. "Privacy Policy" → `https://factory.fpt.ai/privacy-policy/privacy-statement` 4. "Terms Of Use" → `https://factory.fpt.ai/privacy-policy/terms-of-use` 5. Tất cả link hoạt động, không có 404 |
| **Notes** | Kiểm tra từng link không bị broken |

---

### TC-NAV-006: Social media links

| Field | Content |
|---|---|
| **TC-ID** | TC-NAV-006 |
| **Function** | Social media links |
| **Screen** | Footer |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Kiểm tra link mạng xã hội trong footer |
| **Precondition** | Đang ở bất kỳ trang nào |
| **Procedure** | 1. Cuộn xuống footer 2. Click icons: Facebook, YouTube, LinkedIn, Discord |
| **Expected Result** | 1. Facebook → `https://www.facebook.com/fptsmartcloud` 2. YouTube → `https://www.youtube.com/channel/UCJM51jaizo0jSbv35HD2nYA` 3. LinkedIn → `https://www.linkedin.com/company/fpt-cloud` 4. Discord → `https://discord.com/invite/gVF74wMubp` 5. Tất cả mở trong tab mới |
| **Notes** | Không |

---

## 7. Sign In / Sign Up

### TC-SIGNIN-001: Click "Sign in/Sign up"

| Field | Content |
|---|---|
| **TC-ID** | TC-SIGNIN-001 |
| **Function** | Sign in |
| **Screen** | Homepage |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Click nút "Sign in/Sign up" |
| **Precondition** | Chưa đăng nhập |
| **Procedure** | 1. Click nút "Sign in/Sign up" trên navigation bar |
| **Expected Result** | 1. Redirect đến trang đăng nhập hoặc mở modal đăng nhập 2. Hiển thị form đăng nhập với các trường cần thiết |
| **Notes** | Không |

---

### TC-SIGNIN-002: Form đăng nhập — Các trường input

| Field | Content |
|---|---|
| **TC-ID** | TC-SIGNIN-002 |
| **Function** | Sign in form |
| **Screen** | Sign in page/modal |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Kiểm tra các trường input trên form đăng nhập |
| **Precondition** | Đang ở trang/modal đăng nhập |
| **Procedure** | 1. Kiểm tra các trường input trên form |
| **Expected Result** | 1. Có trường Email/Username (required) 2. Có trường Password (required, type="password") 3. Có nút "Sign in" hoặc "Login" 4. Có link "Forgot password" hoặc "Sign up" |
| **Notes** | Cần xác minh form thật khi truy cập được |

---

### TC-SIGNIN-003: Đăng nhập với thông tin sai

| Field | Content |
|---|---|
| **TC-ID** | TC-SIGNIN-003 |
| **Function** | Sign in validation |
| **Screen** | Sign in page/modal |
| **Viewpoint** | 異常系 (Abnormal) |
| **Test Item** | Đăng nhập với email sai |
| **Precondition** | Đang ở trang/modal đăng nhập |
| **Procedure** | 1. Nhập email không tồn tại: `nonexistent@example.com` 2. Nhập password bất kỳ 3. Click "Sign in" |
| **Expected Result** | 1. Hiển thị thông báo lỗi: "Invalid credentials" hoặc tương tự 2. Không redirect, vẫn ở trang đăng nhập 3. Không hiển thị password đã nhập |
| **Notes** | Không tiết lộ email có tồn tại hay không |

---

### TC-SIGNIN-004: Đăng nhập với email rỗng

| Field | Content |
|---|---|
| **TC-ID** | TC-SIGNIN-004 |
| **Function** | Sign in validation |
| **Screen** | Sign in page/modal |
| **Viewpoint** | 異常系 (Abnormal) |
| **Test Item** | Đăng nhập với email rỗng |
| **Precondition** | Đang ở trang/modal đăng nhập |
| **Procedure** | 1. Để trống trường email 2. Nhập password bất kỳ 3. Click "Sign in" |
| **Expected Result** | 1. Hiển thị thông báo lỗi: "Email is required" hoặc tương tự 2. Không gửi request đến server 3. Focus vào trường email |
| **Notes** | Client-side validation |

---

### TC-SIGNIN-005: Đăng nhập với password rỗng

| Field | Content |
|---|---|
| **TC-ID** | TC-SIGNIN-005 |
| **Function** | Sign in validation |
| **Screen** | Sign in page/modal |
| **Viewpoint** | 異常系 (Abnormal) |
| **Test Item** | Đăng nhập với password rỗng |
| **Precondition** | Đang ở trang/modal đăng nhập |
| **Procedure** | 1. Nhập email hợp lệ 2. Để trống trường password 3. Click "Sign in" |
| **Expected Result** | 1. Hiển thị thông báo lỗi: "Password is required" hoặc tương tự 2. Không gửi request đến server 3. Focus vào trường password |
| **Notes** | Client-side validation |

---

### TC-SIGNIN-006: Đăng nhập với email không hợp lệ

| Field | Content |
|---|---|
| **TC-ID** | TC-SIGNIN-006 |
| **Function** | Sign in validation |
| **Screen** | Sign in page/modal |
| **Viewpoint** | 異常系 (Abnormal) |
| **Test Item** | Đăng nhập với email không đúng format |
| **Precondition** | Đang ở trang/modal đăng nhập |
| **Procedure** | 1. Nhập email không hợp lệ: `invalid-email` 2. Nhập password bất kỳ 3. Click "Sign in" |
| **Expected Result** | 1. Hiển thị thông báo lỗi: "Invalid email format" hoặc tương tự 2. Không gửi request đến server |
| **Notes** | Client-side email validation |

---

### TC-SIGNIN-007: SQL injection trong email

| Field | Content |
|---|---|
| **TC-ID** | TC-SIGNIN-007 |
| **Function** | Sign in security |
| **Screen** | Sign in page/modal |
| **Viewpoint** | Security |
| **Test Item** | SQL injection trong trường email |
| **Precondition** | Đang ở trang/modal đăng nhập |
| **Procedure** | 1. Nhập `' OR 1=1 --` vào trường email 2. Nhập password bất kỳ 3. Click "Sign in" |
| **Expected Result** | 1. Không bypass authentication 2. Không có lỗi SQL hiển thị 3. Trả về thông báo lỗi an toàn |
| **Notes** | Kiểm tra backend sử dụng parameterized query |

---

### TC-SIGNIN-008: XSS trong trường email

| Field | Content |
|---|---|
| **TC-ID** | TC-SIGNIN-008 |
| **Function** | Sign in security |
| **Screen** | Sign in page/modal |
| **Viewpoint** | Security |
| **Test Item** | XSS trong trường email |
| **Precondition** | Đang ở trang/modal đăng nhập |
| **Procedure** | 1. Nhập `<script>alert('xss')</script>` vào trường email 2. Click "Sign in" |
| **Expected Result** | 1. Không execute JavaScript 2. Không có alert box 3. Input được encode hoặc bị chặn |
| **Notes** | Không |

---

## 8. Responsiveness & General

### TC-RESP-001: Trang chủ trên mobile viewport

| Field | Content |
|---|---|
| **TC-ID** | TC-RESP-001 |
| **Function** | Responsive design |
| **Screen** | Homepage |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Trang chủ hiển thị đúng trên mobile |
| **Precondition** | Không |
| **Procedure** | 1. Resize trình duyệt về viewport 375x667 (iPhone SE) 2. Kiểm tra giao diện |
| **Expected Result** | 1. Navigation bar chuyển thành hamburger menu (nếu có) 2. Model cards hiển thị đúng, không bị overflow 3. Text không bị cắt 4. Có thể scroll và tương tác |
| **Notes** | Kiểm tra trên multiple breakpoints: 375px, 768px, 1024px |

---

### TC-RESP-002: Trang chủ trên tablet viewport

| Field | Content |
|---|---|
| **TC-ID** | TC-RESP-002 |
| **Function** | Responsive design |
| **Screen** | Homepage |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Trang chủ hiển thị đúng trên tablet |
| **Precondition** | Không |
| **Procedure** | 1. Resize trình duyệt về viewport 768x1024 (iPad) 2. Kiểm tra giao diện |
| **Expected Result** | 1. Layout điều chỉnh phù hợp 2. Model cards hiển thị đúng grid 3. Không bị overflow hay cắt text |
| **Notes** | Không |

---

### TC-PERF-001: Thời gian tải trang chủ

| Field | Content |
|---|---|
| **TC-ID** | TC-PERF-001 |
| **Function** | Performance |
| **Screen** | Homepage |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Trang chủ tải trong thời gian hợp lý |
| **Precondition** | Không |
| **Procedure** | 1. Mở `https://marketplace.fptcloud.com/` 2. Đo thời gian từ bắt đầu navigation đến `networkidle` |
| **Expected Result** | 1. Thời gian tải < 5 giây (networkidle) 2. Không có resource bị timeout |
| **Notes** | Phụ thuộc vào tốc độ mạng, đo trong môi trường ổn định |

---

### TC-PERF-002: Thời gian phản hồi search

| Field | Content |
|---|---|
| **TC-ID** | TC-PERF-002 |
| **Function** | Search performance |
| **Screen** | Homepage |
| **Viewpoint** | 正常系 (Normal) |
| **Test Item** | Search phản hồi nhanh |
| **Precondition** | Trang chủ đã tải thành công |
| **Procedure** | 1. Nhập "gemma" vào ô tìm kiếm 2. Đo thời gian từ khi nhập xong đến khi kết quả hiển thị |
| **Expected Result** | 1. Thời gian phản hồi < 2 giây 2. Kết quả hiển thị đúng |
| **Notes** | Không |

---

## Tóm tắt Test Cases

| Area | Số lượng | 正常系 | 準正常系 | 異常系 | 境界値 | Security | Combination |
|---|---|---|---|---|---|---|---|
| Homepage | 5 | 3 | 2 | 0 | 0 | 0 | 0 |
| Search | 9 | 2 | 2 | 2 | 1 | 2 | 0 |
| Filter | 7 | 4 | 2 | 0 | 0 | 0 | 1 |
| Model Detail | 5 | 5 | 0 | 0 | 0 | 0 | 0 |
| Playground | 4 | 4 | 0 | 0 | 0 | 0 | 0 |
| Navigation | 6 | 6 | 0 | 0 | 0 | 0 | 0 |
| Sign In | 8 | 2 | 0 | 4 | 0 | 2 | 0 |
| Responsive | 2 | 2 | 0 | 0 | 0 | 0 | 0 |
| Performance | 2 | 2 | 0 | 0 | 0 | 0 | 0 |
| **Tổng** | **48** | **30** | **6** | **6** | **1** | **4** | **1** |

---

**Ghi chú:**
- Template: IPA standard (no user template provided)
- Output format: Markdown
- Một số test case (Sign In form, Model Status) cần truy cập thực tế để xác minh chi tiết
- Test case TC-NAV-001 (Model Status) đã phát hiện timeout trong exploration — cần kiểm tra lại
- Playground yêu cầu đăng nhập — test case execution cần tài khoản test