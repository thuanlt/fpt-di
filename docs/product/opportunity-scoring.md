# Pha 3 — Opportunity scoring: chấm 6 cơ hội theo 4 trục

**Mục tiêu pha 3:** chấm điểm 6 cơ hội từ [opportunity-brief.md](./opportunity-brief.md) theo 4 trục có trọng số, rút top-1 để đi pha 4 (validate khách thật). Mọi bằng chứng chốt kèm con trỏ tới memo `research-notes/` hoặc code trong repo.

**Mô hình chấm:**

| Trục | Trọng số | Thước đo |
|---|---|---|
| **Kỹ thuật** | 40% | % code sẵn, tuần build, rủi ro phụ thuộc |
| **Thị trường VN** | 25% | SAM (xấp xỉ từ pha 2) + số khách tiềm năng trong danh sách FPT reference ([fpt-smartcloud-catalog.md](../../research-notes/fpt-smartcloud-catalog.md)) |
| **Lợi thế FPT** | 25% | vùng VN + egress nội địa + Nghị định 13/PDPA + chi phí điện thấp + khách cũ FPT.AI |
| **Willingness-to-pay** | 10% | đối chiếu giá công khai đối thủ (Together H100 $5,49/giờ [verify-together-dmi-price.md](../../research-notes/verify-together-dmi-price.md), Modal $3,95/giờ [serverless-pricing-autoscale.md](../../research-notes/serverless-pricing-autoscale.md)) |

Mỗi trục chấm 0-10. Điểm tổng = $\sum \text{trục} \times \text{trọng số}$. Cơ hội **PASS pha 3** nếu tổng ≥ 6,5 và điểm kỹ thuật ≥ 6.

---

## Bảng chấm chính

| # | Cơ hội | Kỹ thuật (40%) | Thị trường VN (25%) | Lợi thế FPT (25%) | W2P (10%) | **Tổng** | Pass? |
|---|---|---|---|---|---|---|---|
| **O1** | BYOM upload → playground → deploy | 9 (code 70% sẵn, ~3 tuần) | 8 (5/5 ref khách cần private LLM) | 9 (compliance PDPA + cluster nội bộ) | 8 (vs Together $5,49/giờ → FPT $3/giờ, -45%) | **8,45** | ✅ |
| **O3** | Carryover 20% quota + swap GPU | 9 (code 80% sẵn, ~2 tuần) | 7 (3/5 ref khách enterprise cam kết dài) | 8 (cluster nội bộ cho swap vật lý + carryover chưa ai public) | 7 (vs Bedrock/GAzure "không refund") | **8,00** | ✅ |
| **O6** | Mở giá serverless công khai | 9 (code 95%, ~1-2 tuần) | 6 (TAM $8-12M nhưng thị phần FPT nắm nhỏ) | 7 (chỉ cần công bố, không cần hạ tầng mới) | 7 (vs Together per-token $1,04/$1,74) | **7,55** | ✅ |
| **O4** | p95 cold-start công khai | 9 (code 90%, ~1 tuần) | 4 (tài sản giao tiếp, không phải doanh thu trực tiếp) | 6 (khoảng trống info công khai, [serverless-pricing-autoscale.md](../../research-notes/serverless-pricing-autoscale.md)) | 3 (không có benchmark sẵn nên phải đo thật) | **5,95** | ❌ |
| **O2** | Trial RPM/RPD không thẻ cho BYOM | 5 (code 40%, ~4-5 tuần) | 5 (TAM nhỏ $50-200K/năm) | 7 (pattern còn sống [sandbox-trial-economics-FILL.md](../../research-notes/sandbox-trial-economics-FILL.md)) | 5 (free tier, không thu trực tiếp — phễu cho O1) | **5,55** | ❌ |
| **O5** | AI Gateway multi-provider nội địa | 2 (code 0%, 8-12 tuần) | 8 (TAM $5-7M, Nghị định 13/PDPA chặn route cross-border) | 9 (chưa ai nội địa, compliance) | 7 (RFP ngân hàng đã đòi) | **5,55** | ❌ |

## Top-1 chọn: **O1**

**Lý do chọn O1 làm cơ hội đi pha 4 (validate khách thật):**

1. **Tổng điểm cao nhất (8,45)** — chênh 0,45 so với O3 thứ hai, cách biệt rõ so với các cơ hội fail.
2. **Code sẵn 70%** — `src/byom/processor.js` (`processHfSource` + `processS3Source`), `src/vllm-adapter/server.js`, `partner-console` BYOM upload UI + nút Deploy đã wire (turn deploy-applied-giờ). MVP thêm ~3 tuần: UI chat playground + pre-fill nút deploy.
3. **Gap thị trường rõ, đã verify** — [playground-inference-platforms.md](../../research-notes/playground-inference-platforms.md) liệt kê 11 nền tảng, không vendor nào ghép trọn vẹn "UI upload `.tar.gz` weights → chat/playground thử → nút bấm deploy to dedicated trong trình duyệt":
   - Modal có Notebooks ([verify-modal-no-playground.md](../../research-notes/verify-modal-no-playground.md)) nhưng không chat demo, đòi `@app.function` decorator.
   - Baseten Playground gắn deployment nhưng BYOM đòi `config.yaml` CLI ([byoc-container-inference.md](../../research-notes/byoc-container-inference.md)).
   - HF dùng Settings bên ba + image cộng đồng `philschmi/vllm-hf-inference-endpoints`.
   - Replicate Cog bake weights vào image, tải lại cả ảnh mỗi update.
4. **Phù hợp 5/5 reference customers FPT** cần private LLM: BIDV, MB Bank, Home Credit, FPT Long Chau, E Hospital ([fpt-smartcloud-catalog.md](../../research-notes/fpt-smartcloud-catalog.md) — reference customers công khai) — tất cả đều có yêu cầu data nội địa + không xuất model ra OpenAI/Anthropic.
5. **Will-to-pay đo được ngay** — benchmark Together DMI H100 $5,49/giờ ([verify-together-dmi-price.md SURVIVES](../../research-notes/verify-together-dmi-price.md)) + Modal $3,95/giờ → FPT đặt $3/giờ on-demand → cam kết giảm 10-45% sẽ thấp hơn 50% vs Together và gần Modal. Khách dễ đối chiếu.

## Top-2 song song: **O3 + O6**

Hai cơ hội này không cần validate khách riêng (rủi ro thấp, code sẵn cao) — có thể đi **song song** làm tài sản giao tiếp trong pilot:

- **O6 mở giá serverless công khai đầy đủ**: ~1-2 tuần, chỉ là logic pricing + Marketplace UI không cần đăng nhập. Tài sản giao tiếp phễu top — khách thử trước khi call sales.
- **O3 carryover + swap GPU**: ~2 tuần, mở rộng `src/endpoints/store.js` thêm 2 trường `carryoverQuotaHours` + `allowGpuSwap`. Tài sản giao tiếp enterprise — chưa vendor nào public USP này.

Cả hai không thay thế O1 — chúng bổ trợ phễu (O6 dẫn đầu phễu thử, O3 chốt khách enterprise nghiêm túc).

## Fail (để pha 2 sau) + lý do

- **O4 p95 cold-start**: tổng 5,95 < 6,5. Là tài sản giao tiếp không phải doanh thu trực tiếp, không validate khách được (chỉ là đo trên cluster). Nên làm song song với O1 (1 tuần dev) khi đo trên cluster pilot — không pha 4 riêng.
- **O2 trial RPM/RPD**: tổng 5,55 < 6,5. Cần validate nhu cầu "trial cho BYOM model" chưa xác định (Google AI Studio/Cohere cho trial trên **model của họ**, không phải model của khách). Để sau khi O1 ship, dùng data pilot để quyết định.
- **O5 AI Gateway**: tổng 5,55 < 6,5 nhưng điểm lợi thế FPT cao nhất (9) — đây là play dài hạn (8-12 tuần build mới). Để pha 2 sau khi O1 ship + có khách pilot xác nhận nhu cầu multi-provider + Nghị định 13/PDPA thực tế chặn route. **Cơ hội này nên ưu tiên cao nhất ở vòng planning kế tiếp**.

## Bảng nhạy cảm (stress-test chấm)

Nếu trọng số thay đổi 10% (kỹ thuật 30%, thị trường 35%, lợi thế 25%, W2P 10%) — top-1 thay không?

| # | Trọng số gốc (40/25/25/10) | Trọng số nhạy (30/35/25/10) | Thay rank? |
|---|---|---|---|
| O1 | 8,45 | 8,25 | top-1 giữ |
| O3 | 8,00 | 7,90 | top-2 giữ |
| O5 | 5,55 | 6,80 (lợi thế + thị trường tăng) | ⬆ lên top-3 |
| O6 | 7,55 | 6,85 | ⬇ xuống top-3 |
| O4 | 5,95 | 5,30 | thấp hơn |
| O2 | 5,55 | 5,35 | thấp hơn |

Top-1 **O1 không đổi** ở cả 2 bộ trọng số — kết luận vững.

---

## Chốt pha 3 + chuỗi sang pha 4

**Đi pha 4 với O1.** Mục tiêu pha 4: chứng minh 5 khách tiềm năng từ reference list FPT trả tiền cho "BYOM upload UI → playground → one-click deploy to dedicated", không chỉ đoán willingness-to-pay từ giá đối thủ.

**Kế hoạch validate (pha 4):**
1. Lấy danh sách 5-7 khách từ FPT reference công khai:
   - **BIDV** (ngân hàng — compliance PDPA bắt buộc private LLM)
   - **MB Bank** (quote FPT.AI: "tăng 60% productivity" — đã dùng FPT.AI cho chatbot, gần nhu cầu inference private)
   - **Home Credit Vietnam** (quote: "FPT.AI virtual assistant is helping us to reach and serve a large number of customers")
   - **E Hospital** (quote: "AI on a sovereign foundation ... elevate the quality of care" — y-tế, data nội địa không xuất)
   - **FPT Long Chau** (FPT Retail — pharmacist training, model riêng, đã có nhu cầu fine-tune)
   - **LandingAI** (Mỹ — kiểm chứng pattern quốc tế, visual AI, dùng FPT hạ tầng 24/7)
2. Mỗi interview 30 phút, 4 câu:
   - (1) **Workflow inference hiện tại** — dùng OpenAI API / Together / self-host vLLM / chưa có?
   - (2) **Đau lớn nhất** — cold-start? cost? compliance? BYOM workflow khó?
   - (3) **Sẵn sàng trả bao nhiêu/tháng** cho "upload model private → playground thử → deploy dedicated" — so với Together $5,49/giờ?
   - (3) **Rào cản chuyển sang FPT** — trust hạ tầng VN? cold-start? review nội bộ?
3. Gate qua pha 5 (MVP scope): ≥3/5 khách xác nhận pain + ≥2/5 nêu số tiền/tháng cụ thể ≥$5K/tháng.

**Sản phẩm bàn giao pha 4:** `docs/product/customer-validation.md` — từng interview tóm tắt + bảng willingness-to-pay + nhận định go/no-go cho O1.

## Tôi làm gì tiếp?

Pha 4 cần **đối thoại thật với khách**, không phải research thuần. Tôi không có quyền tiếp cận khách FPT (không role sales, không email khách). Có 2 cách thực tế:

1. **Bạn (hoặc đội sales FPT) làm interview thật** → gửi tôi transcript/audio → tôi phân tích + viết `customer-validation.md` (\* recommend).
2. **Tôi viết guide interview template** (`docs/product/interview-script.md`) — 4 câu + nhánh follow-up + cách ghi willingness-to-pay → đội sales FPT dùng → trả transcript về.

Bạn muốn tôi đi hướng nào?

1. Viết **interview script template** ngay để đội sales FPT dùng (cách 2, không cần đợi)
2. Chờ bạn / sales trả transcript thật rồi tôi phân tích (cách 1)
3. Bỏ qua validate khách, **bỏ qua pha 4** đi thẳng pha 5 (MVP scope cho O1) — chấp nhận rủi ro chưa validate
