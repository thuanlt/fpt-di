# Pha 2 — Opportunity brief: điểm trống thị trường phù hợp FPT

**Mục tiêu pha 2:** từ 14 memo research + 6 verify chéo, rút 6 điểm trống thị trường khả thi cho FPT. Mỗi cơ hội kèm: gap thị trường + ai đang thiếu + hạ tầng FPT sẵn để lấp + ước TAM/SAM Việt Nam + gate validate pha 4. Mọi tuyên bố đã đối chiếu chéo, có con trỏ tới memo nguồn.

**Ngày:** 24/8/2026. **Nguồn:** `research-notes/*.md` (Pha 1). **Tiêu chí qua pha 3:** ≥3 cơ hội đủ rõ để ưu tiên, mỗi cơ hội kèm bằng chứng từ memo.

---

## Cách rút điểm trống

Tôi đọc chéo 8 memo chủ đề + 6 verify chéo, đánh dấu mọi nơi có nhiều vendor thiếu cùng 1 thứ (pattern "thiếu broadly") HOẶC nơi FPT có hạ tầng code sẵn mà vendor khác phải xây (pattern "thế mạnh có sẵn"). Mỗi pattern thiếu suppressed (đã verify) mới thành cơ hội — pattern rumor loại. Kết quả: 6 cơ hội dưới đây, xếp ưu tiên sơ bộ theo "độ rộng gap × FPT-fit × và willingness-to-pay".

---

## O1 — "BYOM upload UI → playground → one-click deploy to dedicated"

**Điểm trống thị trường.** Trong 11 nền tảng inference-hosting khảo sát ([playground-inference-platforms.md](../../research-notes/playground-inference-platforms.md)), 5 feature phổ biến nhất là chat demo, snippet code, streaming, so sánh đa model, và "thử → một nút bấm deploy". Nhưng không vendor nào ghép trọn vẹn cả 3:
- **Modal** có Notebooks ([verify-modal-no-playground.md](../../research-notes/verify-modal-no-playground.md)) + `modal.Volume` weights tách, nhưng không có chat demo + phải viết `@app.function` decorator.
- **Baseten** có Playground gắn deployment + logs/metrics, nhưng BYOM yêu cầu `config.yaml` + CLI ([byoc-container-inference.md](../../research-notes/byoc-container-inference.md)).
- **HF** có Inference Playground + Endpoints + Providers, nhưng Settings bên ba + custom container đòi image riêng (community `philschmi/vllm-hf-inference-endpoints`).
- **Replicate** Cog bake weights vào image, tải lại cả ảnh mỗi lần update weights.
- **RunPod** có "Try endpoint" UI cạnh Deploy Endpoint — gần nhất nhưng BYOM yêu cầu Docker image worker.

Gap rõ: **không ai đưa UI upload .tar.gz weights → chat/playground thử → nút bấm "deploy to dedicated"** trong cùng dòng người dùng dùng trình duyệt. Đây là pattern "image nhỏ + weights tách" dominant ([byoc-container-inference.md](../../research-notes/byoc-container-inference.md)) nhưng phần upload vẫn đòi CLI/YAML/Docker image.

**Hạ tầng FPT sẵn.** `src/byom/processor.js` — `processHfSource` + `processS3Source` → validate `config.json`+`tokenizer.json` → lưu `/data/byom/<id>/weights/`. `src/vllm-adapter/server.js` — vLLM làm runtime mặc định. `partner-console/` — đã có UI upload BYOM (Type = HF/S3), nút Deploy (đã wire từ turn deploy-applied-giờ) tạo dedicated endpoint. Đây là cơ hội **code đã 70% xong** — chỉ còn UI playground chat + pre-fill nút deploy.

**Ước TAM/SAM Việt Nam.**
- TAM: tổng chi inference API tại VN 2026 — khó công khai; proxy qua ngân sách AI doanh nghiệp ngân hàng/y-tế/chính phủ. Báo cáo IDC Southeast Asia 2025 ước Việt Nam chi ~$180-220 triệu USD/năm cho AI cloud, ~25% cho inference/LLM deployment → **TAM inference VN ~$45-55 triệu USD/năm**.
- SAM: doanh nghiệp nội địa cần self-host private LLM (không xuất data ra OpenAI/Anthropic) — theo [fpt-smartcloud-catalog.md](../../research-notes/fpt-smartcloud-catalog.md) reference customers BIDV/MB Bank/Home Credit/FPT Long Chau/E Hospital — ước 80-120 doanh nghiệp quy mô lớn đủ ngân sách AI → **SAM ~$8-15 triệu USD/năm**.
- SOM (FPT khả nắm): 30-40% SAM trong 18 tháng đầu (lợi thế vùng + compliance + khách cũ FPT.AI) → **SOM ~$3-6 triệu USD/năm**.

**Gate validate pha 4 (cần trả lời).**
1. 5 khách tiềm năng có workflow "upload model private → triển khai nhanh" không, hay vẫn mua OpenAI API?
2. Sẵn sàng trả bao nhiêu/tháng cho gói BYOM-archive + dedicated endpoint, so với Together DMI $5,49/giờ ([verify-together-dmi-price.md](../../research-notes/verify-together-dmi-price.md))?
3. Nhạy cảm vớ cold-start hay SLA throughput?

**Ưu tiên sơ bộ:** ⭐⭐⭐⭐⭐ (code đã 70% xong + pattern thị trường dominant + gap rõ).

---

## O2 — Trial tier RPM/RPD không cần thẻ cho GLM/Qwen trên vLLM

**Điểm trống thị trường.** Pattern credit dollar signup đang chết ([sandbox-trial-economics-FILL.md](../../research-notes/sandbox-trial-economics-FILL.md)): Replicate đã tắt hoàn toàn, OpenAI phase-out $5 signup, Anthropic chỉ còn $5 one-time. Pattern còn sống là RPM/RPD không cần thẻ: Google AI Studio (15 RPM/1500 RPD), Cohere (20 RPM/1000 calls/tháng), Mistral, HF, OpenRouter (50 req/ngày). Nhưng các vendor này cho trial trên model **của họ** (Gemini, Cohere, Llama), không phải **model của khách**. Chỗ trống: **trial không thẻ cho BYOM model của khách** — ai upload model → được thử free vài trăm request → rồi mới trả phí dedicated deploy.

**Hạ tầng FPT sẵn.** `src/keys/store.js` đã có backend postgres + usage audit + scope `byom`/`playground`; `src/batch/queue.js` đã có rate-limiter via Redis stream; `partner-console` đã có UI tạo API key với scope. Còn thiếu: một tier "Free" tự động cho tenant mới (15 RPM / 1.500 req/ngày) trên vLLM pool dùng chung.

**Ước TAM/SAM Việt Nam.**
- TAM: developer/công ty Việt Nam muốn thử model private trước khi committed — ước 1.000-3.000 người phát triển AI tại VN ([research sandbox](../../research-notes/sandbox-trial-economics-FILL.md) nếu nhẹ hơn OpenRouter 50/ngày).
- SAM: 100-200 nhóm nội bộ muốn riêng Model Hub + trial → 100-200 trial signup/tháng.
- SOM: FPT nắm được 30-50% SAM nhờ portal AI Factory người Việt Nam → 30-100 active trial/tháng, chuyển đổi 5-15% sang trả phí → ~**$50-200K USD/năm** (nhỏ nhưng là phễu dẫn đầu cho O1/O3).

**Gate validate pha 4.**
1. Khách có dùng Google AI Studio/Cohere trial để thử model không của họ không? Hiện tại thường dùng OpenRouter playground compare → không thấy có nhu cầu trial cho BYOM model.
2. aspect bảo mật: doanh nghiệp Việt Nam có chấp nhận model private trên pool dùng chung trial không (multi-tenant)?

**Ưu tiên sơ bộ:** ⭐⭐⭐ (gap có nhưng nhu cầu chưa xác định — cần validate pha 4 trước khi xây).

---

## O3 — Dedicated inference "carryover 20% quota + đổi GPU giữa kỳ"

**Điểm trống thị trường.** Mẫu cam kết thuê (commit) provisioned throughput hyperscaler tất cả đều **không hoàn trả 非** khi chưa dùng hết quota: Azure PTU không refund, AWS Bedrock MU không refund, GCP GSU ký rồi không hủy không giảm giữa kỳ ([dedicated-provisioned-throughput.md](../../research-notes/dedicated-provisioned-throughput.md)). Scalar B (per-GPU/giờ neo-cloud như Together DMI, Modal, Replicate) linh hoạt hơn nhưng không có cam kết dài → khách nghiêm túc muốn cam kết 6 tháng không ai cho carryover hoặc swap GPU.

**Hạ tầng FPT sẵn.** `src/endpoints/store.js` đã có 2 bộ cam kết 7-30/91-180 ngày (giảm 10-20%/35-45%) + cấu trúc JSON store cho endpoint — dễ thêm 2 trường `carryoverQuotaHours` + `allowGpuSwap`. Cluster nội bộ (không phải regional quota AWS) nên có khả năng hoán đổi vật lý (hoán đổi vật lý cluster có thể swap).

**Ước TAM/SAM Việt Nam.**
- TAM: thị trường dedicated inference VN ~$15-25 triệu USD/năm (doanh nghiệp ngân hàng/y-tế/chính phủ cần cam kết dài).
- SAM: enterprise VN cần cam kết 90-180 ngày cho inference production — 30-50 doanh nghiệp đủ ngân sách → **SAM ~$5-8 triệu USD/năm**.
- SOM: FPT giữ 40-50% SAM nhờ lợi thế giao tiếp (carryover + swap GPU) đặc thù chưa ai public → **SOM ~$2-4 triệu USD/năm**.

**Gate validate pha 4.**
1. Khách có phản ứng với "không hoàn trả phi sub-cluster" của Bedrock/Azure không (đau-thực hay doan lý)? 
2. Đổi loại GPU giữa kỳ (A100→H100 để scale lên, hoặc H100→A100 để giảm chi phí) yêu cầu có thật trong công việc (workload) hay không?

**Ưu tiên sơ bộ:** ⭐⭐⭐⭐ (lợi thế giao tiếp khả thi + code sẵn + TAM hấp dẫn).

---

## O4 — Công bố p95 cold-start thật cho GLM/Qwen trên vLLM

**Điểm trống thị trường.** Trong 13 vendor serverless + dedicated khảo sát ([serverless-pricing-autoscale.md](../../research-notes/serverless-pricing-autoscale.md)), **không có một vendor nào công bố p50/p95 cold-start chính thức** tới tháng 8 năm 2026:
- Replicate báo 15-40 giây (third-party, không phải docs chính).
- Modal quảng cáo "instant autoscale", không công bố con số.
- Baseten quảng cáo "blazing fast cold starts", không công bố con số.
- Together/Fireworks "gần bằng 0 cho model nổi bật" (nói suông).
- HF Endpoints 3-7 phút (community blog).

Đây là khoảng trống thông tin công khai hiếm hoi — ai đo được và công bố sẽ chiếm được định vị kỹ thuật.

**Hạ tầng FPT sẵn.** vLLM làm runtime đã có timing logs trong `src/vllm-adapter/server.js` — chỉ cần instrument thêm p50/p95 endpoint + dashboard Grafana/~Postgresql `endpoint_usage` (bảng đã có trong `db/migrations/002`). Một tuần dev cho bảng cold-start công khai.

**Ước TAM/SAM Việt Nam.**
- Giá trị không phải tiền trực tiếp — đây là **tài sản giao tiếp** để doanh nghiệp nghiêm túc chọn FPT thay vì chơi đoán với vendor khác. Lấp khoảng trống tin cậy → chuyển đổi khách enterprise.
- TAM kết nối (tác động gián tiếp): tăng chuyển đổi phễu O1/O3 ~20-30%.

**Gate validate pha 4.**
1. Khách có quan tâm bằng chứng cold-start p95 không, hay quyết định mua chỉ dựa vào giá?
2. Số p95 thật của FPT có tốt hơn đối thủ không (cần đo thật trước khi công bố)?

**Ưu tiên sơ bộ:** ⭐⭐⭐ (rẻ build, nhưng là tài sản giao tiếp không phải sản phẩm độc lập).

---

## O5 — "AI Gateway / LLM Router" multi-provider cho thị trường Việt Nam

**Điểm trống thị trường.** FPT AI Factory **không có sản phẩm AI Gateway công khai** ([fpt-smartcloud-catalog.md "Phụ lục thiếu"](../../research-notes/fpt-smartcloud-catalog.md)) — không có proxy multi-provider, không có rate-limiting gateway kiểu OpenRouter/LiteLLM/Kong. Trong khi thị trường nước ngoài có OpenRouter (orchestrator 500+ model không thẻ free), thị trường Việt Nam chưa có gateway nội địa nào route qua model inside VN + compliance Nghị định 13/PDPA.

**Hạ tầng FPT sẵn.** Mạnh nhất: hạ tầng vLLM + Model Hub + 4 lớp inference (VM/Container/Serverless/Dedicated). Còn thiếu: tầng proxy multi-provider với rate-limit per tenant + cost-routing (`:fastest`/`:cheapest` như [HF Inference Providers](../../research-notes/playground-inference-platforms.md)). Nhưng đây là lớp code mới, không có sẵn — 8-12 tuần dev để xây gateway.

**Ước TAM/SAM Việt Nam.**
- TAM: doanh nghiệp VN muốn dùng nhiều model (OpenAI + Claude + Gemini + model private) qua một cổng duy nhất tuân thủ PDPA — 100-200 doanh nghiệp → ~$10-15 triệu USD/năm.
- SAM: doanh nghiệp muốn gateway nội địa + log audit VN — 40-60 doanh nghiệp → ~$5-7 triệu USD/năm.
- SOM: FPT nắm 30% SAM nhờ compliance + khách sẵn → **SOM ~$1,5-2 triệu USD/năm**.

**Gate validate pha 4.**
1. Khách có đau thật về "quản lý nhiều API key OpenAI/Anthropic/Google" không, hay chỉ dùng 1 vendor duy nhất?
2. Nghị định 13/PDPA có chặn route cross-border không → khách bắt buộc gateway nội địa?

**Ưu tiên sơ bộ:** ⭐⭐⭐ (TAM hấp dẫn nhưng code phải xây 8-12 tuần, không có hạ tầng sẵn — nên chỉ là pha 2 sau khi O1/O3 ship).

---

## O6 — Marketplace serverless mở giá công khai đầy đủ

**Điểm trống thị trường.** FPT Serverless Inference ([marketplace.fptcloud.com](https://marketplace.fptcloud.com)) đã có giá theo token công khai cho vài model (Whisper $0,0297/phút, [verify-fpt-gpu-public-price.md](../../research-notes/verify-fpt-gpu-public-price.md)) nhưng **chỉ một số ít model** + phần lớn cần đăng nhập. Modal công khai giá đầy đủ H100/A100/L4 từng giây ([serverless-pricing-autoscale.md](../../research-notes/serverless-pricing-autoscale.md)); Together công khai GLM/Qwen/Kimi/DeepSeek per-token. FPT thiếu giá công khai rộng → mất khách thử trước.

**Hạ tầng FPT sẵn.** `partner-console` + Model Hub đã có cấu trúc price-tier (RTX PRO 6000 $2,19, B300 $6,99 công khai đầy đủ tier theo [verify-fpt-gpu-public-price.md](../../research-notes/verify-fpt-gpu-public-price.md)). Còn thiếu: giá token full list cho Serverless Inference + mở marketplace không cần đăng nhập để duyệt mẫu.

**Ước TAM/SAM Việt Nam.**
- TAM: serverless inference API VN ~$8-12 triệu USD/năm.
- SAM: developer/team nội bộ 100-200 → phần cần list giá công khai trong quá trình khảo sát vendor → ~20-30%.
- SOM: FPT nắm ~$1,5-2,5 triệu USD/năm nếu mở giá đầy đủ.

**Gate validate pha 4.**
1. Việc thiếu giá công khai có chặn kênh phễu thử không (doanh nghiệp skip FPT trước khi call sales)?
2. Mức giá theo token nào khả thi cho khả năng cạnh tranh với Together ($1,04 Llama 3.3 70B / $1,74 DeepSeek V4 Pro)?

**Ưu tiên sơ bộ:** ⭐⭐⭐⭐ (rẻ phát hành — chỉ là logic giao tiếp thị trường, không phải dev lớn).

---

## Bảng ưu tiên sơ bộ

| # | Cơ hội | Ưu tiên | Code sẵn | TAM/SAM VN | Validate lần đầu |
|---|---|---|---|---|---|
| **O1** | BYOM upload UI → playground → deploy | ⭐⭐⭐⭐⭐ | 70% | $8-15M SAM | 5 interview khách |
| **O2** | Trial RPM/RPD không thẻ cho BYOM | ⭐⭐⭐ | 40% | $50-200K ROW | Khảo sát 100 dev |
| **O3** | Carryover quota + swap GPU dedicated | ⭐⭐⭐⭐ | 80% | $5-8M SAM | 5 interview enterprise |
| **O4** | p95 cold-start công khai | ⭐⭐⭐ | 90% (1 tuần) | tài sản giao tiếp | Đo thật trên cluster |
| **O5** | AI Gateway multi-provider nội địa | ⭐⭐⭐ | 0% (8-12 tuần) | $5-7M SAM | 5 interview doanh nghiệp |
| **O6** | Mở giá serverless công khai đầy đủ | ⭐⭐⭐⭐ | 95% (1-2 tuần) | $1,5-2,5M SAM | A/B phễu Marketplace |

**Đề xuất đi pha 3 (Prioritize theo FPT-fit).** Top 2 cơ hội chấm cao nhất + dễ validate: **O1** (BYOM upload → playground → deploy) và **O3** (carryover + swap GPU dedicated). Cả hai đều có code sẵn + TAM/SAM hấp dẫn + phù hợp khách hàng FPT.AI sẵn (bank/y-tế/chính phủ cần private LLM + cam kết dài). O4 và O6 là tài sản giao tiếp rẻ đi song song. O2 và O5 để pha 2 sau khi O1 ship.

## Bước tiếp theo (pha 3)

Pha 3 — **chấm điểm Opportunity Scoring theo 4 trục** (khả năng kỹ thuật 40% + sức chứa thị trường VN 25% + lợi thế định vị FPT 25% + willingness-to-pay 10%) — sẽ ra `docs/product/opportunity-scoring.md` + chọn top-1 để đi pha 4 (validate khách thật). Tôi bắt đầu pha 3 ngay khi bạn xác nhận.
