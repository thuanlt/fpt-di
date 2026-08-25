# Verify: Hybrid Pricing per-GPU/giờ + per-TPM/phút trên cùng SKU — có vendor nào đã bán chưa?

**CLAIM cần refutation (nguyên văn):** "Chưa nền tảng inference nào công khai hybrid pricing per-GPU/giờ làm baseline + per-TPM/phút làm upgrade tier → đây là USP unique cho FPT nếu triển khai."

**Tiêu chí quyết định (theo phân biệt layer của lead):**
- **FAILS ở layer "cùng SKU"** = có vendor bán hybrid THẬT: cấp commit + token overage trên CÙNG endpoint/SKU, auto-fallback, cùng dòng meter hoặc ít nhất cùng endpoint không cần deploy thứ hai tay.
- **FAILS ở layer "cùng invoice"** = hai deployment/meter tách biệt cùng account invoice (không cùng SKU).
- **SURVIVES ở mức "cùng SKU unique"** = nếu mọi vendor khảo sát chỉ dừng ở "hai hosted endpoint/meter tách biệt nối bằng traffic routing" thì claim unique cho FPT vẫn còn giá trị ở đúng层 này.

**KẾT LUẬN TỔNG (chi tiết bên dưới):**
- **FAILS ở layer "cùng endpoint, commit + token overage, auto-fallback" (GCP Vertex AI Provisioned Throughput + spillover).** GCP đã bán đúng mô hình hybrid commit-baseline + token-overage trên CÙNG endpoint, KHÔNG cần deploy thứ hai, ghi cùng invoice GCP. Đây là cơ chế tự động "default behavior".
- **SURVIVES ở layer rất hẹp "per-GPU/giờ literal + cùng meter đơn"**: không vendor nào bill baseline theo **per-RAW-GPU/hour** — tất cả dùng proxy unit throughput (GSU/PTU/MU). GCP dùng GSU/hour, không phải GPU/hour. Nên nếu claim đòi *literal* per-GPU-hour, claim còn sống, nhưng rất hẹp và dễ bị xem là displacing: GCP đã có sẵn cấu trúc tier trên cùng endpoint.

---

## Bảng tổng khảo sát (сковzat)

| Vendor | Baseline commit unit | Overage unit | Cùng SKU/endpoint? | Auto-fallback? | Kết luận |
|---|---|---|---|---|---|
| **GCP Vertex / Gemini Agent Platform** | **per-GSU/hour** (Provisioned Throughput) | **per-token (PAYG)** | **CÙNG endpoint, bật tự động mặc định** | **CÓ — "by default"** | **FAILS layer "cùng endpoint + tier"** |
| Azure OpenAI (Foundry) | per-PTU/hour | per-token PAYG | TÁCH deployment; spillover route giữa hai dep | CÓ (cần cấu hình `spilloverDeploymentName`) | Tách deployment cùng invoice |
| AWS Bedrock | per-MU/hour (Provisioned Throughput) | per-token PAYG | TÁCH — purchased PT là resource riêng | KHÔNG (429 khi cạn) | Tách resource cùng account |
| Together AI | per-minute per replica (DMI) | per-token (Serverless) | TÁCH sản phẩm (DMI vs Serverless) | KHÔNG | Tách SKU |
| Modal | per-GPU-second (Reserved? không có) | không có overage token | N/A | N/A | Không hybrid (chỉ pay-as-go) |
| Baseten | per-GPU-minute (Dedicated) | per-token (Model APIs) | TÁCH sản phẩm (Dedicated vs Model APIs) | KHÔNG | Tách SKU |
| Anyscale | per-token (Endpoints) / per-hour (Workspaces) | — | TÁCH sản phẩm | KHÔNG | Tách sản phẩm |
| OpenRouter | per-token | — | KHÔNG có commit tier | N/A | Không hybrid (aggregator) |
| Hyperbolic | (GPU rental marketplace) | (serverless per-token) | TÁCH | KHÔNG | Tách SKU |
| Novita.ai | per-token + separate GPU instance | — | TÁCH ("billed by the token, not the hour"; GPU instance tách) | KHÔNG | Tách SKU |

---

## 1. **GCP Vertex AI / Gemini Enterprise Agent Platform — REFUTATION CHÍNH**

Đây là vendor duy nhất trong khảo sát có **cơ chế spillover/auto-fallback TRÊN CÙNG ENDPOINT** — không cần deploy thứ hai. Đây là điểm mấu chốt.

**Cơ chế (từ doc chính thức GCP, "Use Provisioned Throughput", truy cập 08/2026):**

> "If a request exceeds the remaining Provisioned Throughput quota, the entire request is processed as an on-demand request **by default** and is billed at the pay-as-you-go rate. When this occurs, the traffic appears as **spillover** on the monitoring dashboards."
>
> "After your Provisioned Throughput order is active, the **default behavior** takes place automatically. You don't have to change your code to begin consuming your order as long as you are consuming it in the region provisioned."

**Điểm bẻ gãy claim:**
- User KHÔNG cần tạo deployment thứ hai. Cùng `GenerativeModel(...)` call, cùng endpoint. Khi quota PT exceeded → request rơi vào **on-demand PAYG token billing**.
- Số PT được thuê theo **GSU/hour** (Gemini Standard Unit/hour) — đây là proxy cho throughput-hour, **không phải per-RAW-GPU/hour**, nhưng cấu trúc commit-horizon giống hệt ý intent của claim.
- Spillover traffic hiển thị như một dimension riêng (`spillover`) trên dashboard; "dedicated" line = dùng PT, "spillover" line = dùng PAYG token.
- User có thể ép route bằng HTTP header `X-Vertex-AI-LLM-Request-Type: dedicated` (chỉ PT, 429 khi cạn) hoặc `shared` (chỉ PAYG). Mặc định = "dedicated-first, spillover-on-exhaust".

**Snapshot cấu trúc bill (cùng endpoint, 2 meter):**
```
Endpoint: gemini-2.5-pro, region: us-central1
PT order: 25 GSU active, billed per-GSU-hour (reservation)
Traffic flow (một call duy nhất):
  - Nếu estimate token < quota còn lại → billed on PT meter (đã đóng trong $/GSU/hr)
  - Nếu estimate token > quota còn lại → request bị đẩy sang on-demand, billed per-token tại PAYG rate
Header để route:
  X-Vertex-AI-LLM-Request-Type: dedicated = chỉ PT (429 nếu cạn)
  X-Vertex-AI-LLM-Request-Type: shared = chỉ PAYG token
  (mặc định không set header = dedicated-first, spillover-on-exhaust)
Dashboard metric dimensions: dedicated / spillover / shared
```

**Đánh giá refutation:**
- Cấu trúc "baseline commit (per-throughput-unit-hour) + token overage (PAYG per-token), cùng endpoint, auto-fallback nếu exhaust" — **đã tồn tại public** từ GCP.
- Khác biệt duy nhất với claim của FPT: GCP bill theo per-**GSU**/hour (Gemini Standard Unit) chứ không phải per-**GPU**/hour. Nhưng GSU *là* proxy cho throughput-hour (≈ per-GPU/hour normalized theo model throughput), nên ý nghĩa kinh tế gần như same.
- Nên: **ở layer "hybrid commit + overage trên cùng endpoint, auto-fallback" → claim FAILS.** Đã có vendor (GCP) bán đúng mô hình từ trước (public doc cập nhật 2026).

🔗 Nguồn chính:
- Use Provisioned Throughput | Gemini Enterprise Agent Platform — https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/provisioned-throughput/use-provisioned-throughput (truy cập 08/2026)
- "Control overages or bypass Provisioned Throughput" section mô tả default-on spillover.
- Provisioned Throughput overview — https://cloud.google.com/blog/products/ai-machine-learning/provisioned-throughput-on-vertex-ai

---

## 2. Azure OpenAI / Microsoft Foundry — Hybrid tách deployment (cùng invoice, KHÔNG cùng SKU)

Azure có "Traffic spillover" nhưng spillover target phải là MỘT deployment **khác** (PAYG standard). Đây là hybrid ở mức "hai deployment nối bằng routing", không cùng SKU.

**Cơ chế (từ doc chính thức Microsoft, "Manage traffic with spillover", cập nhật 06/2026):**

> "Spillover manages traffic fluctuations on provisioned deployments by automatically routing overage requests to a corresponding standard deployment."
>
> Prerequisite: "your account must have at least one active pay-as-you-go deployment that matches the model and version of your current provisioned deployment."
> Cấu hình: `"spilloverDeploymentName": "spillover-standard-deployment"` (một deployment khác trong cùng Azure OpenAI resource).

**Chi phí spillover (snapshot cấu trúc bill):**
- Requests xử lý trên provisioned deployment → chỉ tính hourly PTU cost (đã commit).
- Requests route sang standard deployment → billed per input/cached/output token rates cho model version + deployment type đó.

**Đánh giá:**
- Đây là "hai hosted endpoint tách biệt cùng account/resource, nối bằng traffic-shifting". Billing là hai meter tách.
- Khác biệt với GCP: Azure **yêu cầu tạo deployment thứ hai** (PAYG) trước. GCP thì on-demand chỉ khi nào request exceed quota, không cần deployment riêng.
- → Azure KHÔNG cùng SKU. Nếu claim của FPT được hiểu ở_layer "cùng SKU" thì Azure vẫn clears bar.

🔗 Nguồn:
- Manage traffic with spillover — https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/spillover-traffic-management (cập nhật 06/2026)
- Provisioned throughput billing — https://learn.microsoft.com/en-us/azure/foundry/openai/concepts/provisioned-throughput-billing (cập nhật 05/2026)

---

## 3. AWS Bedrock — Provisioned Throughput (per-MU/hour) KHÔNG có spillover auto-fallback

**Cơ chế (từ doc AWS chính thức):**

> "You're billed hourly for a Provisioned Throughput that you purchase. The price per hour depends on... the number of Model Units (MUs)... an MU delivers a specific throughput level for the specified model."
> Commit tiers: no-commit / 1-month / 6-month. Không có spillover tự động.

**Behavior khi exhaustion:**
- Khi exceed on-demand quota → HTTP 429 ThrottlingException.
- Khi exceed provisioned capacity → cũng 429 (không có fallbackincluded built-in); user phải tự implement retry/fallback hoặc request quota increase.
- Custom/fine-tuned model bắt buộc mua Provisioned Throughput (no on-demand alternative for custom).

**Đánh giá:**
- AWS không tích hợp "PTU + PAYG token" trên cùng resource. PTU là resource riêng, PAYG là mode riêng.
- → Tách resource cùng account. Nếu claim giữ ở_layer "cùng SKU unique" thì AWS clears.

🔗 Nguồn:
- Increase model invocation capacity with Provisioned Throughput — https://docs.aws.amazon.com/bedrock/latest/userguide/prov-throughput.html
- Troubleshoot 429 throttling — https://repost.aws/knowledge-center/bedrock-throttling-error

---

## 4. Together AI — DMI (per-minute) vs Serverless (per-token) là hai SKU tách biệt

**Cơ chế (từ docs Together chính thức):**

> "Dedicated model inference (DMI) bills based on the hardware your deployments run on, **regardless of model or request volume**."
> "Billed by the minute: A deployment bills for as long as it runs, not per token or per request... Each running replica bills independently."
> "Serverless models bill per token, while dedicated model inference bills per-minute for each running replica."

**Một số giá DMI (per-hour, single-GPU):**
- H100 80GB: $5.49/hr
- B200 180GB: $8.99/hr
- H200 / GB300 / B300: contact sales.

**Đánh giá:**
- DMI = một product. Serverless = product khác. Khác endpoint, khác meter, khác SKU hoàn toàn.
- Together có "Reserved" cho DMI (commit per-month, lower effective rate) nhưng vẫn là dedicated-only, không có token-overage tier.
- → Không hybrid cùng SKU.

🔗 Nguồn: https://docs.together.ai/docs/dedicated-endpoints/pricing

---

## 5. Baseten — Dedicated (per-GPU-minute) vs Model APIs (per-token) là hai sản phẩm tách

**Cơ chế (từ baseten.co/pricing):**
- **Dedicated Deployments**: chỉ trả cho compute used, tính per-minute. A100 80GB: $0.06667/min (~$4/hr); H100 80GB: $0.10833/min (~$6.50/hr); B200: $0.16633/min (~$10/hr). Auto-scaling theo traffic, idle không phí.
- **Model APIs**: pre-optimized models OpenAI-compatible, **per-token**. Ví dụ GLM-5.2: $1.40/$0.14/$4.40; DeepSeek V4 Pro: $1.74/$0.145/$3.48 per 1M tokens.
- Hai séc-tion riêng trên cùng trang pricing, hai meter riêng.

**Đánh giá:**
- Baseten có "hybrid deployment" (Baseten Cloud + Self-hosted + Hybrid) nhưng đó là hybrid về vị trí infrastructure, KHÔNG phải hybrid pricing commit+token trên cùng SKU.
- "Dedicated" product = per-GPU-minute. "Model APIs" product = per-token. Different SKUs.
- → Tách SKU.

🔗 Nguồn: https://www.baseten.co/pricing/

---

## 6. Modal — chỉ per-GPU-second, không commit reserved, không per-token

**Cơ chế (từ search/Morphllm, công bố 2026):**
- H100 ~$0.001097/sec (~$3.95/hr cơ bản), với multiplier region 1.5–1.75× và non-preemptible 3×.
- Tính per-second, không commit term, không auto-shutoff nhưng scale-to-zero.
- Không có per-token billing cho LLM. Muốn serve LLM → user tự chạy vLLM/SGLang, trả per-GPU-second.

**Đánh giá:**
- Modal **không có layer commit** cả. Càng không hybrid.
- → Không phải refutation.

🔗 Nguồn: Modal vs Together comparison (morphllm) — https://www.morphllm.com/comparisons/together-vs-modal ; Modal platform home — https://modal.com/

---

## 7. Anyscale — Endpoints token-only, Workspaces tách sản phẩm

**Cơ chế (từ Costbench/FutureAGI):**
- Anyscale Endpoints: serverless per-token, bắt đầu $0.15/M tokens, custom enterprise pricing.
- Anyscale Workspaces/Managed Ray Clusters: giờ compute (separate product).
- Hai product không ăn nhập trên cùng SKU; không có docs Anyscale nào mô tả commit+token-fallback trên cùng endpoint.

**Đánh giá:** Không refutation. → Tách sản phẩm.

🔗 Nguồn: https://costbench.com/software/llm-api-providers/anyscale/ ; https://futureagi.com/blog/best-anyscale-llm-alternatives-2026/

---

## 8. OpenRouter, Hyperbolic, Novita.ai

- **OpenRouter**: aggregator per-token, BYOK + add-on fee; không có tier commit/overage. (Nguồn: https://openrouter.ai/ ; https://tokenmix.ai/blog/openrouter-api)
- **Hyperbolic**: GPU rental marketplace + serverless per-token, không có docs mô tả commit+token-overage cùng SKU.
- **Novita.ai**: billing rõ ràng tách — "Billed by the token, not the hour" cho Model APIs; GPU instances là product riêng. (Nguồn: https://novita.ai/ ; https://shareai.now/blog/insights/llm-api-providers/)

Cả ba KHÔNG phải là refutation.

---

## Phân biệt rõ layer (để lead dễ quyết định)

```mermaid
flowchart TD
    A[CLAIM: per-GPU/hr commit + per-TPM/min overage unique] --> Q1{Vendor có cùng SKU/endpoint + auto-fallback?}
    Q1 -->|CÓ - GCP Vertex PT + spillover| FAIL_CUNGSK[FAILS ở layer "cùng endpoint + tier"]
    Q1 -->|KHÔNG| Q2{Vendor có cùng invoice nhưng tách deployment/meter?}
    Q2 -->|CÓ - Azure, AWS| TACH_DEPLOY[Tách deployment cùng invoice]
    Q2 -->|KHÔNG - Together, Baseten, Anyscale, Modal, OpenRouter, Hyperbolic, Novita| TACH_SKU[Tách SKU hoàn toàn]
    FAIL_CUNGSK --> DECISION[Điểm sống sót duy nhất: per-GPU/hour literal - GCP dùng GSU/hour chứ không phải GPU/hour]
    TACH_DEPLOY --> DECISION2[Claim SURVIVES ở layer "cùng SKU unique" nếu giữ tiêu chí per-raw-GPU-hour]
    TACH_SKU --> DECISION2
```

**Tóm tắt phân biệt:**
1. **Layer "cùng invoice hai deployment tách"**: Azure, AWS thỏa. KHÔNG phải cùng SKU. Claim SURVIVES nếu giữ đúng tiêu chí "cùng SKU".
2. **Layer "cùng SKU/endpoint, commit-first + auto token-overage"**: **CHỈ có GCP Vertex PT + default spillover**. Đây là refutation mạnh nhất. Mặc dù GCP bill theo GSU/hour (Gemini Standard Unit — proxy throughput) chứ không phải GPU/hour, cơ chế kinh tế là **giống hệt** ý FPT đề xuất: user mua commit throughput-hour, dùng đến đâu hết, request sau tự rơi vào on-demand token trong cùng một logical endpoint.
3. **Layer "per-RAW-GPU/hour literal"**: không vendor nào dùng; GCP dùng GSU, Azure dùng PTU, AWS dùng MU. Đây là nitpick kỹ thuật duy nhất còn giữ claim sống sót, nhưng là nitpick yếu vì user không quan tâm GPU-count, chỉ quan tâm throughput-hour commit.

**Kết luận cho lead:**
- Nếu report đi về hybrid POSH/tier model — claim **FAILS**. GCP đã có sẵn.
- Nếu report đi về USP framed ở "GĐ phân biệt GPU-flavor cụ thể (H100/B200) và billed per-RAW-GPU-hour, không qua proxy throughput-unit" — claim **SURVIVES ở layer kỹ thuật hẹp**, phù hợp cho thị trường Việt Nam (không phải GCP tier-1 enterprise), nhưng cần framing rõ ràng là "GPU-flavor-specific commit + token overage" (chứ không phải generic hybrid).

---

## Nguồn (URL + truy cập date)

| # | URL | Date truy cập |
|---|---|---|
| 1 | https://docs.together.ai/docs/dedicated-endpoints/pricing | 08/2026 |
| 2 | https://learn.microsoft.com/en-us/azure/foundry/openai/concepts/provisioned-throughput-billing | 08/2026 (doc date 05/2026) |
| 3 | https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/spillover-traffic-management | 08/2026 (doc date 06/2026) |
| 4 | https://docs.aws.amazon.com/bedrock/latest/userguide/prov-throughput.html | 08/2026 |
| 5 | https://repost.aws/knowledge-center/bedrock-throttling-error | 08/2026 |
| 6 | https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/provisioned-throughput/use-provisioned-throughput | 08/2026 |
| 7 | https://cloud.google.com/blog/products/ai-machine-learning/provisioned-throughput-on-vertex-ai | 08/2026 |
| 8 | https://www.baseten.co/pricing/ | 08/2026 |
| 9 | https://www.morphllm.com/comparisons/together-vs-modal | 08/2026 |
| 10 | https://www.morphllm.com/comparisons/together-vs-baseten | 08/2026 |
| 11 | https://modal.com/ | 08/2026 |
| 12 | https://costbench.com/software/llm-api-providers/anyscale/ | 08/2026 |
| 13 | https://openrouter.ai/ | 08/2026 |
| 14 | https://novita.ai/ | 08/2026 |
