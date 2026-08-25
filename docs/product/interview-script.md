# Pha 4 — Interview script template: validate cơ hội O1 với khách FPT

**Mục tiêu:** chứng minh 5-7 khách tiềm năng từ reference list FPT trả tiền cho "BYOM upload UI → playground → one-click deploy to dedicated", không chỉ đoán willingness-to-pay từ giá đối thủ.

**Cách dùng script này:** đội sales FPT liên hệ 5-7 khách từ danh sách reference công khai (xem `docs/product/opportunity-brief.md` + `research-notes/fpt-smartcloud-catalog.md`), đặt interview 30 phút, hỏi theo 4 câu chính + nhánh follow-up. Ghi transcript/raw note (tiếng Việt OK, miễn đầy đủ câu hỏi-câu trả lời) → gửi về team product để phân tích. Mỗi interview 1 file `interview-<ten-khach>.md` trong thư mục `docs/product/interviews/`.

**Gate qua pha 5 (MVP scope):** ≥3/5 khách xác nhận pain + ≥2/5 nêu số tiền/tháng cụ thể ≥$5K/tháng.

---

## Danh sách khách tiềm năng (lấy từ [fpt-smartcloud-catalog.md §4.3 reference customers](../../research-notes/fpt-smartcloud-catalog.md))

| Khách | Ngành | Vai trò liên hệ đề nghị | Lí do thích hợp O1 |
|---|---|---|---|
| **BIDV** | Ngân hàng | CTO / Head of AI | Compliance PDPA bắt buộc private LLM, dùng FPT.AI chatbot |
| **MB Bank** | Ngân hàng | Head of Innovation | Quote FPT.AI: "tăng 60% productivity, giảm 10% lỗi nhập liệu" — đã dùng FPT.AI cho data entry → gần nhu cầu inference private |
| **Home Credit Vietnam** | Tài chính | CTO / Head of Customer Service | Quote: "FPT.AI virtual assistant is helping us reach a large number of customers" → workload lớn, cần endpoint cam kết |
| **E Hospital** (Bệnh viện E) | Y tế | Director IT / Head of AI | Quote: "AI on a sovereign foundation ... elevate the quality of care" — y tế, data nội địa không xuất, model riêng |
| **FPT Long Chau** | Retail (FPT) | Head of Training | Nhận training pharmacist + đã có nhu cầu fine-tune model riêng |
| **LandingAI** (Mỹ) | Visual AI | CEO Dan Maloney | Kiểm chứng pattern quốc tế + hạ tầng 24/7 (đã dùng FPT) |

**Đề nghị ưu tiên 5 khách đầu (Việt Nam) — họ có compliance PDPA + ngân sách nội địa rõ. LandingAI dùng làm đối chiếu quốc tế nếu còn thời gian.**

---

## Script interview 30 phút

### Mở đầu (2 phút)

> "Xin chào, tôi [tên] từ FPT SmartCloud. Chúng tôi đang phát triển dịch vụ mới cho phép doanh nghiệp upload model AI riêng (private/fine-tuned) lên hạ tầng FPT, thử trực tiếp bằng playground chat trong trình duyệt, rồi bấm 1 nút để deploy thành endpoint dedicated GPU. Phỏng vấn 30 phút để kiểm tra nhu cầu thật và mức giá phù hợp. Mọi thông tin chỉ ghi aggregate, không công bố riêng. OK bắt đầu?"

### Câu 1 — Workflow inference hiện tại (5 phút)

> "Hiện tại team [khách] đang chạy inference AI như nào? Dùng API cloud nào, hay self-host vLLM trên máy nội bộ, hay chưa có?"

**Nhánh follow-up:**
- Nếu dùng API OpenAI/Anthropic/Google: "Bao nhiêu request/tháng? Chi phí/tháng hiện tại?"
- Nếu self-host vLLM: "Trên hạ tầng gì — bare metal, AWS, GCP, hay FPT? Bao nhiêu GPU? Cold-start ảnh hưởng production không?"
- Nếu chưa có: "Có từng thử chưa, rồi vì sao chưa triển khai?"

**Ghi:** vendor hiện tại + volume + cost/tháng + pain chính.

### Câu 2 — Đau lớn nhất (8 phút)

> "Khi triển khai inference production, đau lớn nhất của team là gì?"

**Nhánh follow-up (đọc từng gợi ý, khách chọn):**
- a) **Cold-start** — request đầu sau idle chậm, ảnh hưởng UX?
- b) **Cost** — chi phí GPU/giờ quá cao, đặc biệt khi traffic spikey?
- c) **Compliance** — data không được xuất ra nước ngoài (PDPA/Nghị định 13)?
- d) **BYOM workflow** — khó upload model riêng (fine-tuned/private) lên vendor, phải dùng API model nhà cung cấp?
- e) **Đo lường** — khó track p50/p95 latency, token/tháng, cost theo request?
- f) **Khác** — tinh tế lấy quoted其他的.

**Ghi:** pain chính (top 1-2), pain phụ. **Quan trọng:** nếu pain chính KHÔNG phải (c) hoặc (d) → O1 có thể không phù hợp khách này.

### Câu 3 — Willingness-to-pay (8 phút)

> "Nếu FPT ra dịch vụ: bạn upload model riêng (file `.tar.gz` chứa weights+config), playground chat thử trong trình duyệt, rồi bấm 1 nút deploy thành endpoint dedicated GPU H100. Giá tham khảo: $3/giờ on-demand, cam kết 91-180 ngày giảm 35-45% ($1,65-1,95/giờ). So với Together AI công khai $5,49/giờ, Modal $3,95/giờ — FPT rẻ hơn. Bạn sẵn sàng trả bao nhiêu/tháng cho gói như vậy?"

**Nhánh follow-up:**
- "Mức/tháng đó cho bao nhiêu GPU, số request/ngày?"
- "So với chi phí hiện tại, rẻ hơn hay đắt hơn?"
- "Nếu thêm USP: được carryover 20% quota chưa dùng sang kỳ kế tiếp (Bedrock/Azure không cho) — có tăng willingness-to-pay không?"
- "Nếu thêm USP: được đổi loại GPU giữa kỳ cam kết (A100 → H100 → B200, GCP không cho) — có tăng willingness-to-pay không?"

**Ghi:** số tiền/tháng khách nêu + điều kiện + so với chi phí hiện tại + tăng W2P khi thêm O3 USP.

### Câu 4 — Rào cản chuyển sang FPT (5 phút)

> "Nếu đủ tốt về giá + compliance, điều gì còn cản trở team chuyển sang dịch vụ này?"

**Nhánh follow-up:**
- "Trust hạ tầng VN (so với AWS/GCP) — concern về availability, support?"
- "Review nội bộ mất bao lâu để duyệt vendor mới? Phòng nào phê duyệt?"
- "MOQ/PO/contractual bloque? Cần cam kết nào?"
- "Có yêu cầu SLA throughput (TPM) hay chỉ quan tâm GPU/giờ?"

**Ghi:** rào cản chính + thời gian review nội bộ + người phê duyệt.

### Kết (2 phút)

> "Cảm ơn [tên]. Nếu OK, tôi gửi bản demo trong 2-3 tuần tới — bạn có muốn thử early access pilot không? Phản hồi sau pilot sẽ quyết định go-to-market. Email phản hồi: [sales FPT]."

---

## Template ghi transcript (mỗi interview 1 file)

```markdown
# Interview: <Tên khách> — <Ngày>

**Khách:** <Tên tổ chức> — <Ngành> — <Vai trò người interview>
**Ngày:** <YYYY-MM-DD>
**Người interview:** <Tên sales FPT>
**Thời lượng:** <XX phút>

## Câu 1 — Workflow inference hiện tại
- Vendor hiện tại:
- Volume req/tháng:
- Chi phí/tháng:
- Pain chính workflow:

## Câu 2 — Đau lớn nhất
- Pain chính (top 1-2):
- Pain phụ:
- Phù hợp O1 (compliance/BYOM)? [Yes/No/Phụ]:
- Quote khách (1 câu nguyên văn quan trọng nhất):

## Câu 3 — Willingness-to-pay
- Số tiền/tháng nêu:
- Điều kiện:
- So với chi phí hiện tại:
- Tăng W2P khi thêm carryover (O3)? [Yes/No/Phụ]:
- Tăng W2P khi thêm swap GPU (O3)? [Yes/No/Phụ]:

## Câu 4 — Rào cản
- Rào cản chính:
- Thời gian review nội bộ:
- Người phê duyệt:
- Yêu cầu SLA:

## Verdict interview
- Pain xác nhận? [Yes/No]
- W2P cụ thể nêu? [Yes — $X/tháng / No — chỉ qualitative]
- Phù hợp O1? [Strong / Moderate / Weak]
- Convert pilot? [Yes definite / Yes possible / No]

## Note phụ
<ghi chú qualit trong quá trình interview>
```

---

## Gate qua pha 5

| Tiêu chí | Ngưỡng | Cách đo |
|---|---|---|
| Số interview hoàn tất | ≥5/5 khách Việt Nam | Đếm file trong `docs/product/interviews/` |
| Pain xác nhận | ≥3/5 `Pain chính = compliance hoặc BYOM` | Đọc verdict mỗi file |
| W2P cụ thể ≥$5K/tháng | ≥2/5 | Đọc "Số tiền/tháng nêu" verdict |
| Fit O1 | ≥3/5 `Phù hợp O1 = Strong/Moderate` | Đọc verdict |

**Nếu PASS** → sang pha 5 (MVP scope): viết `spec-mvp.md` theo template spec-driven-development, tách task theo planning-and-task-breakdown.

**Nếu FAIL** → pivot:
- Nếu pain chính không phải compliance/BYOM → chuyển top-1 sang O3 hoặc O5 (cơ hội phù hợp pain khác).
- Nếu W2P < $5K/tháng → thu hẹp TAM, tập trung khách bigger (banking) thay vì khách smaller.

---

## Sản phẩm bàn giao pha 4

Sau khi đội sales trả 5-7 transcript về, tôi sẽ đọc từng transcript, aggregate vào `docs/product/customer-validation.md`:
- Bảng pain tổng hợp — ai đau gì, top 1-2 pain cross-customer.
- Bảng W2P — phân phối số tiền/tháng, augmented vs not (O3 USP).
- Verdict go/no-go cho O1.
- Top-1 cơ hội mới nếu pivot.

## Cách trả transcript về

Đội sales tạo file `docs/product/interviews/interview-<ten-khach>.md` theo template trên, push lên repo hoặc gửi qua email. Tôi (backend-dev role) sẽ đọc + phân tích khi đủ 5 transcript.
