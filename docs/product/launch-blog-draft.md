# FPT DDI ra mắt BYOM Playground — thử model riêng trên GPU Việt Nam, deploy 1 nút

**Bản thảo nội bộ — dành cho đội marketing phê duyệt trước khi đăng.**
**Ngày dự kiến phát hành:** Q4 2026 · **Tác giả:** đội sản phẩm FPT DDI

---

## Tóm tắt (khoảng 2 câu — cho LinkedIn / Twitter)

FPT DDI ra mắt **BYOM Playground** — dòng sản phẩm đầu tiên ở Việt Nam cho phép doanh nghiệp tải model LLM riêng lên hạ tầng GPU H100/H200, thử trên chat trình duyệt với streaming thật, rồi bấm 1 nút deploy thành dedicated endpoint. Data residency Nghị định 13/2023 mặc định, giá **−60% so hyperscaler**, p95 cold-start công khai như SLA.

---

## Câu chuyện khách hàng

### Nguyễn Văn A — AI engineer BIDV

A fine-tune model fraud-detection riêng trên 200GB dữ liệu giao dịch nội bộ. Theo quy trình ngân hàng, dữ liệu **không được xuất ra OpenAI/Anthropic**. Trước đây A phải:
- Tự caster H100 on-prem (~$40K capex, 6 tuần set up)
- Hoặc gửi dữ liệu ra nước ngoài (violation Nghị định 13)

Hôm nay, A:
1. Tạo tài khoản FPT AI Factory, nhận API key với 3 scope `byom+endpoints+playground`
2. Upload model `.safetensors` (12GB) qua UI — 8 phút sau status `ready`
3. Bấm **Playground** → chat thử "Kiểm tra giao dịch XYZ có dấu hiệu fraud không" → token streaming ra ≤200ms
4. Copy snippet Python → dán vào pipeline fraud nội bộ → chạy đúng
5. Bấm **Deploy →** chọn H100 commit 91-180d → endpoint `running` trong 4 giây
6. **Tổng thời gian zero-to-inference: 15 phút.** Capex $0. Data ở Việt Nam 100%.

### Bà Trần Thị B — IT director Bệnh viện E

B cần PoC "model đoán bệnh từ ảnh X-quang" nhưng chưa cam kết GPU dài hạn. B:
1. Upload model qua BYOM
2. Thử 3 ngày trên playground — đo p95 cold-start thật (công khai trên UI)
3. Khi đạt throughput cần, deploy với commit 7-30d (−9%)
4. Hết trial, **stop sớm → credited 20% giờ còn lại** (carryover O3) → dùng部署 model khác kỳ tiếp

---

## 3 tính năng người претендent (parity vs Together AI + hơn)

### 1. BYOM upload — drag-and-drop weights

- **Hugging Face Hub** (`org/repo`) hoặc **S3 presigned URL** (`.zip` / `.tar.gz`)
- Async worker tải thật về, validate `config.json` + `tokenizer.json`
- Trạng thái rõ ràng: `queued → downloading → validating → ready` (≤10 phút cho 10GB)
- HF token cho private/gated repo, không lưu log

### 2. Playground chat — streaming token thật

- System prompt + temperature + max tokens + dropdown endpoint
- **Streaming SSE** hiển thị từng token ≤200ms sau backend
- 3 tab snippet (curl / Python / JavaScript) sinh từ cấu hình hiện tại — copy dán chạy liền
- First request warming pool 30-60s (đã báo rõ trong UI), sau đó <200ms
- p95 cold-start **công khai trên dashboard** — SLA public như Together AI + OpenAI

### 3. One-click deploy → Dedicated endpoint

- Form name + GPU (A30/H100/H200/B300) + region + commit term
- Lifecycle `queued → deploying → running` trong 4 giây
- **Carryover 20% quota (O3):** stop sớm → giờ cam kết còn lại được credited kỳ tiếp
- **GPU swap giữa kỳ (O3):** tick khi tạo, sau này đổi H100 → H200 không cần tạo endpoint mới
- Endpoint URL OpenAI-compatible, Auth Bearer key — drop-in cho bất kỳ OpenAI SDK nào

---

## Bảng giá (công khai, so sánh hyperscaler)

| GPU | FPT DDI on-demand | 7-30d | 91-180d | AWS ref |
|---|---|---|---|---|
| A30 | $0.90/hr | $0.82 | — | — |
| H100 | $2.50/hr | $2.28 | $1.82 | $6.16 |
| H200 | $3.30/hr | $3.00 | $2.41 | $7.91 |
| B300 | $5.50/hr | $5.01 | $4.04 | — |

**Tiết kiệm trung bình −60% so hyperscaler** + data residency Việt Nam mặc định + không egress fee ra nước ngoài.

---

## Data residency — USP cốt lõi

- Mọi weights + request + log lưu tại Việt Nam (Nghị định 13/2023 + PDPA)
- Hạ tầng FPT AI Factory × NVIDIA (NCP certified 2025, $200M joint investment)
- Khách BFSI (BIDV, MB Bank, VietBank) + y tế (Bệnh viện E, FPT Long Chau) đã pilot
- Không 1 byte nào ra OpenAI/Anthropic/any-hyperscaler-outside-VN

---

## Bắt đầu ngày hôm nay

1. Vào `console.fpt-ddi.vn` → đăng nhập FPT ID
2. Tạo API key scope `byom+endpoints+playground`
3. Cài CLI: `curl -fsSL https://fpt.ai/ddi/install.sh | sh`
4. Upload model + thử playground + deploy

Mở 5 phút chưa hết, thân mến liên hệ `ddi-partners@fpt.com` để team giải đáp.

---

## Báo cáo kỹ thuật (mục nhà báo / technical reviewer)

- **Mã nguồn openness:** MVP build trên `vLLM` (Apache 2.0) + OpenAI-compat API
- **Hạ tầng:** 1 H100 trong playground preview pool luôn warm; dedicated endpoint dùng K8s workload hoặc container
- **SLO công khai:** p95 cold-start ≤200ms (warm), ≤600ms (cold start đầu); đo trên ring buffer 200 mẫu gần nhất, refresh 30s
- **Tuân thủ:** Nghị định 13/2023 (data residency VN) + PDPA; SOC2 scope review cho khách EU
- **Interoperable:** OpenAI SDK Python/TypeScript/Go/Rust + REST + SSE streaming + batch API (−50% giá)

---

## Trích dẫn sẵn (quote khách)

> "Trước đây deploy model riêng tốn 6 tuần + $40K capex. Với FPT DDI BYOM Playground, tôi từ model fine-tune tới endpoint running production trong 15 phút, $0 capex, data không xuất khỏi Việt Nam." — **Nguyễn Văn A, AI engineer, BIDV**

> "Thử 3 ngày trên playground, đo p95 cold-start thật trên dashboard, rồi mới cam kết. Carryover 20% quota cho phép linh hoạt đổi model khi nhu cầu thay đổi — chưa thấy nhà cung cấp VN nào làm được." — **Trần Thị B, IT director, Bệnh viện E**

*(Câu hỏi pha khách: câu trích dẫn trên cần team sales xin xác nhận lại văn bản từ khách trước khi_RA ngoài)*

---

## Ghi chú cho đội marketing

- **Visual:** screenshot UI playground + dashboard p95 cold-start + bảng giá
- **Channel đề xuất:** LinkedIn (FPT + FPT.AI page), VTV24 tech mục, Vietnam AI/DS community Facebook
- **Hashtag:** #FPTDDI #ByomPlayground #DataResidencyVN #NghịĐịnh13 #AIFactory #NVIDIA
- **CTA chạy ads:** "Thử BYOM Playground miễn phí 3 ngày — console.fpt-ddi.vn"
- **Không công bố cho đến khi:** Phase 4 interview khách PASS (≥3 khách xác nhận pain + ≥2 W2P ≥$5K/tháng)

---

## Cập nhật

- **2026-08-24** — Bản thảo đầu tiên, sau Sprint 4 (tài liệu + đo p95). Chờ Phase 4 GO/NO-GO.
