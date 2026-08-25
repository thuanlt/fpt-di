# Pricing, Autoscale & Cold-Start của Inference Serverless (2024–2026)

**Memo research – snapshot lấy trong tháng 8/2026.** Sub-question: khảo sát pricing formula, bảng giá H100/A100/L4, cold-start, autoscale, multi-region và rate-limit cho ~13 nhà cung cấp inference serverless/pay-per-token/pay-per-second.

> Lưu ý quan trọng về snapshot: Nhiều nhà cung cấp (đặc biệt Together AI, Fireworks, Replicate, Modal, Baseten, Hyperbolic, Lepton) thay đổi bảng giá theo quý. Mọi số liệu trong memo này đều kèm ngày lấy (thường là "snapshot 2026-08" nếu lấy trong phiên này, hoặc ngày cụ thể từ source công khai). Nếu một thông số không công khai (không公开) sẽ ghi rõ.

## Phần 1 — Nền tảng API first-party (per-token)

### OpenAI (snapshot 2026-08, nguồn developers.openai.com/api/docs/pricing)

OpenAI áp dụng **pricing per-1M-token (input/output)** thuần túy — không có khái niệm "GPU per second" ở API first-party. Bảng giá chia theo service tier:

- **Standard**: gpt-5.6-sol $4/$20 per 1M (in/out), gpt-5.4 $2.50/$15, gpt-4.1 $2/$8, gpt-4o-mini $0.15/$0.60.
- **Batch (asynchronous, 24h)**: giảm 50% — gpt-4.1 $1/$4, gpt-4o-mini $0.075/$0.30.
- **Flex (priority thấp hơn)**: cùng mức với Batch cho hầu hết model (gpt-5.6-sol $2/$10).
- **Fast mode** (priority cao, throughput đảm bảo): cộng thêm ~75% — gpt-4.1 $3.50/$14, gpt-4o $4.25/$17.
- **Long context** (>=272K token): tăng gấp đôi input và ~1.5× output.
- **Regional processing (data residency)**: +10% uplift cho model ra sau 5/3/2026.
- **Prompt caching**: cache read = 10% giá input.

Min charge: không có min charge; billing theo token thật dùng. Tiered discount: không có public volume tier — chỉ "enterprise sales" qua [`sales@anthropic.com`-style] cho OpenAI. (Nguồn: <https://developers.openai.com/api/docs/pricing>, lấy 2026-08-24.)

### Anthropic Claude (snapshot 2026-08, nguồn platform.claude.com/docs/en/about-claude/pricing)

Anthropic cũng pricing **per-1M-token**, chia model line:

- **Claude Opus 5 / 4.8 / 4.7 / 4.6 / 4.5**: $5/$25 per 1M (in/out).
- **Claude Sonnet 5**: $2/$10 (introductory giữ làm giá chuẩn — Anthropic đã huỷ kế hoạch nâng lên $3/$15 vào 1/9/2026).
- **Claude Sonnet 4.6/4.5**: $3/$15.
- **Claude Haiku 4.5**: $1/$5.
- **Batch API**: giảm 50% (Opus $2.50/$12.50; Sonnet 5 $1/$5).
- **Prompt caching**: 5m write = 1.25× input, 1h write = 2× input, cache hit = 0.1× input.
- **Data residency** (`inference_geo: "us"`): ×1.1 cho model Claude 4.6+.
- **Fast mode** (Opus 5, 4.8; research preview): $10/$50 per 1M.
- **Tool pricing**: bash +325 token, computer toolset +4.5K input token, web search $10/1.000 lần tìm kiếm.
- **Code execution tool**: 1.550 giờ free/tháng, sau đó $0.05/giờ per container, min 5 phút.

Min charge: không. Volume discount: chỉ enterprise qua sales. (Nguồn: <https://platform.claude.com/docs/en/about-claude/pricing>, lấy 2026-08-24.)

### Google Gemini API (snapshot 2026-08, nguồn ai.google.dev/gemini-api/docs/pricing + deepmind.google)

Google áp dụng **per-1M-token** với nhiều tier: Free (limited RPM), Prepaid, Pay-as-you-go, và vé "introductory pricing" hết hạn. Số liệu kiểm chứng được (lấy 2026-08-24):

- **Gemini 2.5 Pro**: $1.25 input / $10 output per 1M token (context 1M token).
- **Gemini 2.5 Flash**: $0.10–$1.00 input tier tùy context, $0.10–$1.00 output trên tier thấp; $0.075 input tier thường (các nguồn giao động giữa $0.075–$1.00 tùy ≤128K vs >128K context).
- **Gemini 2.5 Flash Image**: $30/1M output token (1290 token/image → $0.039/image).
- **Gemini 3.7 Flash** (introductory): $0.375 input / $1.875 output per 1M token, hết hạn 31/12/2026; từ 1/1/2027: $1.50/$7.50.
- Vertex AI: pricing riêng cho enterprise, regional/multi-region, global.

Rate limit: Free tier có RPD (requests per day) limit lên đến 500 RPD trên Flash-Lite; paid tier dùng TPM/RPM; không có SLA cụ thể public. Multi-region: Vertex AI cung cấp regional, multi-region, global endpoints. (Nguồn: <https://ai.google.dev/gemini-api/docs/pricing>, <https://deepmind.google/models/gemini/flash/>, <https://developers.googleblog.com/en/introducing-gemini-2-5-flash-image/> — lấy 2026-08-24.)

## Phần 2 — Serverless pay-per-token cho open model

### Together AI (snapshot 2026-08, nguồn together.ai/pricing)

Together AI áp dụng **prixing per-1M-token** thuần, có cột "cached" thấp hơn (giảm 70-90% input khi cache hit):

- **Llama 3.3 70B**: $1.04 input / $1.04 output (cùng giá, không tách cached) — <https://www.together.ai/models/llama-3-3-70b>
- **DeepSeek V4 Pro**: $1.74 / $0.20 cached / $3.48 — DeepSeek V4 Flash 0731 chỉ $0.14 / $0.03 / $0.28
- **gpt-oss-120B**: $0.15 / $0.60
- **Qwen3.7-Plus**: $0.32 / $1.28; **Qwen3.5-397B-A17B** $0.60/$3.60
- **GLM-5.2**: $1.40 / $4.40
- **Kimi K3**: $3.00 / $15.00

Không có min charge. Batch API có cột riêng (giảm 50% cho hầu hết model). Cùng model có serverless + dedicated endpoint + provisioned throughput (3 chế độ). Tiered discount: chỉ enterprise via sales. (Nguồn: <https://www.together.ai/pricing>, lấy 2026-08-24.)

### Fireworks AI (snapshot 2026-08, nguồn docs.fireworks.ai/serverless/pricing)

Fireworks tách 2 cột serving path: **Standard** và **Priority** (Priority = +25-50% giá, routing ưu tiên). Trong mỗi cell các giá là **input / cached / output** per 1M token:

- **DeepSeek V4 Pro**: $1.74 / $0.145 / $3.48 (Standard), $2.61 / $0.218 / $5.22 (Priority)
- **DeepSeek V4 Flash 0731**: $0.22 / $0.007 / $0.66 Standard
- **GLM 5.2**: $1.40 / $0.14 / $4.40; **Fast variant** $2.10 / $0.21 / $6.60
- **gpt-oss-120B**: $0.15 / $0.015 / $0.60 Standard, $0.18 / $0.018 / $0.72 Priority
- **Kimi K3**: $3.00 / $0.30 / $15.00; Fast $4.50 / $0.45 / $22.50
- **NVIDIA Nemotron 3 Ultra (preview)**: $0.60 / $0.12 / $2.40

**Pricing theo kích cỡ chung** (áp dụng cho mọi text/vision model không liệt kê riêng):
- <4B params: $0.10 / 1M
- 4B–16B params: $0.20 / 1M
- >16B params: $0.90 / 1M
- MoE 56B–176B params: $1.20 / 1M

US-only serverless: +10% premium (trừ GLM 5.2 Fast US = global). Batch: 50% serverless. Embeddings: $0.008–$0.10 / 1M input token. (Nguồn: <https://docs.fireworks.ai/serverless/pricing>, lấy 2026-08-24.)

### Anyscale Endpoints (đã sunset, snapshot 2024)

Anyscale đã **sunset multi-tenant Endpoints API vào tháng 8/2024** ([Auxen migration note](https://auxen.ai/compare/anyscale); [futureagi.com](https://futureagi.com/blog/best-anyscale-llm-alternatives-2026/)). Trước khi sunset:

- **Llama 2 70B**: $1.00 / 1M tokens (cả input và output — cùng giá) ([press release](https://www.anyscale.com/press/anyscale-launches-new-service-anyscale-endpoints-10x-more-cost-effective-for-most-popular-open-source-llms))
- **Llama 3 70B Instruct** (trước khi sunset): $1.00 / $1.00 per 1M token ([mytokentracker](https://mytokentracker.io/models/anyscale/meta-llama/Meta-Llama-3-70B-Instruct))
- **Llama 3 8B**: $0.20 / 1M tokens
- **Mixtral 8x7B**: $0.50 / 1M tokens
- Llama 3.1 70B Instruct Turbo: $1.00/$1.00 (theo third-party tracker, trước khi deprecate)

Sau tháng 8/2024, sản phẩm LLM surface còn sót lại chuyển vào "Anyscale Platform" với Ray Serve + thin convenience layer; không còn là API first-party công khai. ([costbench.com/software/llm-api-providers/anyscale](https://costbench.com/software/llm-api-providers/anyscale/) — 2026-07-27 — ghi "usage-based từ $0.013–$4.96/M token" cho Workspaces/Services, không còn Endpoints cũ.)

**Kết luận**: Anyscale Endpoints không còn phục vụ per-token API sản phẩm — đã bị sunset, không còn snapshot 2025-2026 có ý nghĩa so sánh trực tiếp.

### AI/ML API (snapshot 2026, nguồn aimlapi.com)

AI/ML API là một **aggregator/gateway** đến 1000+ model từ nhiều backend, OpenAI-compatible. Pricing per-1M-token riêng từng model:

- **Llama 3.1 70B Instruct Turbo**: **(Deprecated)** — pricing hiện đã ẩn trên trang chính thức (token slot trống), thay bằng chuyển hướng sang model khác
- **DeepSeek V4 Pro**: $0.5655 input / $1.131 output per 1M token (rẻ hơn Together/Fireworks ~3× — vì AI/ML API aggregator tự route backend cheapest)
- **Kimi K3**: $3.9 input / $19.5 output per 1M (đắt hơn Together $3.00/$15.00)
- **GPT-5.5**: $6.5 input / $39 output per 1M (giá cộng thêm markup ~30% so OpenAI first-party $5/$30)
- **Claude Sonnet 5**: $2.6 / $13 (giá cộng ~30% vs Anthropic $2/$10)
- **Gemini 3.5 Flash**: $0.65 / $3.9 (giá cộng ~30%)
- **MiniMax M3**: $0.39 / $1.56

Plan: $40/tháng trở lên, free trial có. Một điểm quan trọng: AI/ML API thường **đảo ngược định tuyến** — giá có thể rẻ hơn first-party khi họ rẻ backend rẻ hơn, và đắt hơn khi cộng markup. (Nguồn: <https://aimlapi.com/models/llama-3-1-70b-instruct-turbo-api>, <https://aimlapi.com/> — lấy 2026-08-24.)

### Novita.ai (snapshot partial 2025-12)

Novita.ai đã **deprecate nhiều model serverless** vào ngày 25/12/2025 — bao gồm `meta-llama/llama-3.3-70b-instruct` và `google/gemma-3-12b-it` (theo [changelog](https://novita.ai/docs/de/changelog/25-12-25)). Pricing cụ thể per-1M-token cho các model còn lại **không còn công khai** trong docs công khai phiên này — số liệu cụ thể "không公开". Cần login vào dashboard Novita mới thấy giá hiện hành. Khuyến nghị migration sang model mới — không có mã chuyển đổi công khai.

## Phần 3 — Serverless per-second (GPU time)

### Replicate (snapshot 2026-08, nguồn replicate.com/pricing)

Replicate tính **per-second GPU** (min theo giây — không có min phút), billing theo 3 pha: warm-up/cold-start (đã bao gồm), model load, và run time. Phần lớn model công khai dùng per-second; riêng một số vendor-contributed model (Claude, GPT) tính per-token.

| Hardware | $/sec | $/hour |
|---|---|---|
| Nvidia H100 80GB | $0.001525 | $5.49 |
| Nvidia A100 80GB | $0.001400 | $5.04 |
| 2× A100 80GB | $0.002800 | $10.08 |
| 4× A100 80GB | $0.005600 | $20.16 |
| 8× A100 80GB | $0.011200 | $40.32 |
| 2× H100 | $0.003050 | $10.98 |
| 4× H100 | $0.006100 | $21.96 |
| 8× H100 | $0.012200 | $43.92 |
| Nvidia H200 80GB | $0.001525 | $5.49 (committed spend) |
| Nvidia L40S | $0.000975 | $3.51 |
| 2× L40S | $0.001950 | $7.02 |
| Nvidia T4 | $0.000225 | $0.81 |
| CPU (small) | $0.000025 | $0.09 |
| CPU | $0.000100 | $0.36 |

Min charge: không công khai min — tính từng giây. Tiered discount: enterprise via sales, Multi-GPU A100/H100/H200 cần "committed spend contract". (Nguồn: <https://replicate.com/pricing>, lấy 2026-08-24.)

Special: private model dùng dedicated hardware — phải trả cả idle time (trừ "fast booting fine-tunes" chỉ trả khi active). Cold start pha setup + model load (15–40 giây, billed) — các nguồn báo cáo khác nhau.

### Modal (snapshot 2026-08, nguồn modal.com/pricing)

Modal tính **per-second granular**: GPU-second + CPU core-second + memory GiB-second. Tách riêng GPU (per second thuần) và CPU/memory — đây là điểm khác nhất so với Replicate/Baseten.

**GPU Tasks** (serverless functions):

| GPU | $/sec | $/hour tương đương |
|---|---|---|
| Nvidia B300 | $0.001972 | $7.10 |
| Nvidia B200 | $0.001736 | $6.25 |
| Nvidia H200 SXM | $0.001261 | $4.54 |
| Nvidia H100 SXM5 | $0.001097 | $3.95 |
| Nvidia RTX PRO 6000 | $0.000842 | $3.03 |
| Nvidia A100 80GB | $0.000694 | $2.50 |
| Nvidia A100 40GB | $0.000583 | $2.10 |
| Nvidia L40S | $0.000542 | $1.95 |
| Nvidia A10 | $0.000306 | $1.10 |
| Nvidia L4 | $0.000222 | $0.80 |
| Nvidia T4 | $0.000164 | $0.59 |

CPU: $0.0000131/core-sec (min 0.125 core/container) → $0.0473/core-hr
Memory: $0.00000222/GiB-sec → $0.008/GiB-hr
Volumes: $0.09/GiB-tháng, 1 TiB free/tháng

**Plan tiers**:
- Starter: $0 + compute, $30 free credit/tháng, 100 concurrent container, 10 GPU concurrency, 1 region multipliers 1.5× đến 1.75×
- Team: $250/tháng + compute, $100 credit, 5000 container, 50 GPU concurrency
- Enterprise: custom, volume discount, SSO/HIPAA
- Non-preemptible: 3× base price (cho job không thể bị pre-empt)
- Region selection: 1.5–1.75× base
- AWS/GCP marketplace spend OK (committed spend)

Min charge: 0.125 CPU core và memory đi kèm. (Nguồn: <https://modal.com/pricing>, lấy 2026-08-24.)

### HF Inference Endpoints (dedicated mode) (snapshot 2026-08, nguồn hf docs/inference-endpoints/pricing)

Khác hẳn các serverless trên: HF Endpoints là **dedicated instance per hour** (Billing theo phút thực tế), VN pay-as-you-go monthly. Phải có Hub subscription.

**AWS instances**:
| Type | x1 | x4 | x8 |
|---|---|---|---|
| T4 (14GB) | $0.5/hr | $3/hr (4×) | – |
| L4 (24GB) | $0.8/hr | $3.8/hr (4×) | – |
| A10G (24GB) | $1/hr | $5/hr (4×) | – |
| L40S (48GB) | $1.8/hr | $8.3/hr (4×) | $23.5/hr (8×) |
| A100 (80GB) | $2.5/hr | $5/hr (2×) | $10/hr (4×) | $20/hr (8×)
| H200 (141GB) | $5/hr | $10/hr (2×) | $20/hr (4×) | $40/hr (8×)

**GCP instances**: T4 $0.5/hr, L4 $0.7/hr (x1) / $3.8 (x4), A100 $3.6/hr (x1) / $14.4 (x4) / $28.8 (x8), H100 **$10/hr (x1)** / $20 / $40 / $80 — H100 chỉ có trên GCP.

Accelerator: AWS Inferentia2 $0.75/hr (1 inf2, 32GB), $12/hr (12× inf2). GCP TPU v5e $1.2/hr (1×1), $4.75 (2×2 = 4 unit), $9.5 (2×4 = 8 unit).

Source: <https://huggingface.co/docs/inference-endpoints/pricing> (lấy 2026-08-24).

### Baseten (snapshot 2026-08, nguồn baseten.co/pricing)

Baseten có 2 chế độ:
- **Model APIs** (per-token, serverless, OpenAI-compatible)
  - Kimi K3 $3.00/$0.30/$15.00
  - Kimi K2.6 $0.95/$0.16/$4.00
  - GLM-5.2 $1.40/$0.14/$4.40; GLM-5.2 Fast $2.10/$0.21/$6.60
  - DeepSeek V4 Pro $1.74/$0.145/$3.48; DeepSeek V4 Flash 0731 $0.13/$0.028/$0.26
  - gpt-oss-120B $0.10/$0.50 (cached: -)
  - NVIDIA Nemotron 3 Ultra $0.60/$0.12/$2.40
- **Dedicated Deployments** (per-minute, không trả idle):
  | GPU | $/min | $/hour |
  |---|---|---|
  | T4 (16GB VM) | $0.01052 | $0.63 |
  | L4 (24GB) | $0.01414 | $0.85 |
  | A10G (24GB) | $0.02012 | $1.21 |
  | A100 (80GB) | $0.06667 | $4.00 |
  | H100 MIG (40GB) | $0.0625 | $3.75 |
  | H100 (80GB) | $0.10833 | $6.50 |
  | B200 (180GB) | $0.16633 | $9.98 |
  - CPU: 1x2 $0.00058/min, 16x64 $0.01382/min

Plan tiers: Basic ($0/mo), Pro (unlimited autoscaling + priority compute), Enterprise (custom, self-host, hybrid, custom SLA). FAQ công khai: **không trả idle time** — only deploy/scale/active prediction. Volume discount chỉ qua Pro/Enterprise. (Nguồn: <https://www.baseten.co/pricing/>, lấy 2026-08-24.)

### Hyperbolic (snapshot 2026, nguồn blog/3rd-party reports)

Hyperbolic không công bố bảng giá chính thức có cấu trúc (per-token hay per-hour) mà thông qua marketplace. Một số nguồn báo cáo:
- H200 $3.49 GPU-hour (Hyperbolic blog "H200 Price in 2026")
- H100 SXM on-demand ~$1.49/hour (Hyperbolic on-demand) đến $6.98/hr trên high-end marketplace (so sánh 2025)
- Decentralized marketplace (host là third-party), nên cold-start/autoscale rất phụ thuộc host cụ thể
- Không公开 p50/p95 cold start, không公开 SLA chính thức

Source: <https://www.hyperbolic.ai/blog/h200-price> và <https://chatforest.com/reviews/hyperbolic-ai-decentralized-gpu-inference/> (lấy 2026-08).

### Lepton AI (đã dừng, snapshot 2025)

Lepton AI đã bị NVIDIA mua lại 2025, sản phẩm được absorb vào "NVIDIA DGX Cloud Lepton" — một GPU marketplace khác hẳn developer API ban đầu. Pricing cũ: serverless endpoint có rate limit 10 RPM ở tier free; credit-based với tier theo token-per-minute. **Pricing hiện hành fundamentally khác** sau acquisition — không còn chart so sánh được với Lepton cũ. (Nguồn: <https://free-llm.com/provider/lepton-ai>, <https://www.nvidia.com/en-us/data-center/dgx-cloud-lepton/>.)

## Phần 4 — Bảng side-by-side (giữa memo)

### Bảng 1: H100 GPU price/hour (snapshot 2026-08)

| Vendor | Chế độ | H100 80GB ($/hr) | Note |
|---|---|---|---|
| Replicate | per-sec (public) | $5.49 | per-second, không min |
| Modal | per-sec (serverless) | $3.95 (H100 SXM5) | +1.5–1.75× region, +3× non-preemptible |
| Baseten | per-min (dedicated) | $6.50 | không trả idle |
| Baseten | per-min (H100 MIG 40GB) | $3.75 | MIG slicing |
| HF Endpoints | per-hr (dedicated, GCP only) | $10.00 | pay-as-you-go monthly |
| Hugging Face AWS | chưa có H100 | — | chỉ có H200 $5/hr x1 |
| Hyperbolic | on-demand marketplace | $1.49–$3.49 | phân tán, không SLA chuẩn |
| Together AI | dedicated endpoint | quote-only | enterprise via sales |
| Fireworks AI | dedicated endpoint | quote-only | enterprise via sales |
| Lepton AI (NVIDIA DGX) | marketplace | không公开 charted | đã absorbed vào NVIDIA |

### Bảng 2: A100 80GB price/hour (snapshot 2026-08)

| Vendor | Chế độ | A100 80GB ($/hr) |
|---|---|---|
| Replicate | per-sec | $5.04 (1×), $10.08 (2×), $20.16 (4×) |
| Modal | per-sec | $2.50 (80GB), $2.10 (40GB) |
| Baseten | per-min | $4.00 |
| HF Endpoints (AWS) | per-hr | $2.5 (x1), $5 (x2), $10 (x4), $20 (x8) |
| HF Endpoints (GCP) | per-hr | $3.6 (x1), $7.2 (x2), $14.4 (x4), $28.8 (x8) |
| Hyperbolic | marketplace | $1.49–$6.98 (rộng) |

### Bảng 3: L4 / L40S price/hour (snapshot 2026-08)

| Vendor | GPU | $/hr |
|---|---|---|
| Replicate | L40S | $3.51 |
| Modal | L40S | $1.95 |
| Modal | L4 (24GB) | $0.80 |
| Baseten | L4 (24GB) | $0.85 |
| HF Endpoints (AWS) | L4 (24GB) | $0.8/hr x1, $3.8 x4 |
| HF Endpoints (GCP) | L4 | $0.7 x1, $3.8 x4 |
| HF Endpoints (AWS) | L40S | $1.8 x1, $8.3 x4, $23.5 x8 |

### Bảng 4: Llama 3.3 70B / DeepSeek V3-type per-1M-token (snapshot 2026-08)

| Vendor | Llama 3.3 70B (in/out) | DeepSeek V4 Pro (in/cached/out) |
|---|---|---|
| Together AI | $1.04 / $1.04 (cùng giá) | $1.74 / $0.20 / $3.48 |
| Fireworks AI (Standard) | không serve 70B trên serverless – only size-based $0.90 (>16B) | $1.74 / $0.145 / $3.48 |
| Fireworks AI (Priority) | không serve | $2.61 / $0.218 / $5.22 |
| Baseten Model APIs | không có 70B (đã deprecate) | $1.74 / $0.145 / $3.48 (giống Fireworks) |
| Replicate (per-sec) | N/A (per-sec billing) | deepseek-r1 $0.01/K-out, $3.75/M-in (vendor-contrib) |
| Modal | N/A serverless, self-host per-sec | N/A |
| HF Endpoints | N/A dedicated only | N/A dedicated only |
| Novita.ai | Đã deprecate 25/12/2025 | không公开 giá mới |
| Anyscale | Đã sunset Endpoints sản phẩm | N/A |

> Lưu ý quan trọng: DeepSeek V4 Pro pricing giữa Together, Fireworks, Baseten gần như **đồng nhất** ($1.74 in, ~$3.48 out) — gợi ý một cơ chế backend chia sẻ hoặc upstream pricing của DeepSeek. Llama 3.3 70B chỉ còn Together public per-token — vì Fireworks/Baseten đã chuyển sang model mới.

## Phần 5 — Pattern Autoscale + Cold-start (tổng hợp)

### Pattern phổ biến của Autoscale

1. **Serverless scale-to-zero** (Together/Fireworks/Replicate-Baseten-serverless/Modal/Starter): min replica = 0, max replica = hàng chục/hàng trăm; scaling dựa trên queue depth hoặc RPS; vendor tự lo capacity planning. Người dùng không trả idle.

2. **Min-replica ≥ 1 (dedicated)** (HF Endpoints, Baseten Dedicated): user cấu hình min và max replica; setting min ≥1 đảm bảo zero cold-start nhưng trả cho min replica 24/7. HF Endpoints cho phép "Scaled to Zero" nhưng replica đó vẫn chiếm quota.

3. **Priority/Fast tier** (Fireworks Priority, OpenAI Fast mode, Anthropic Fast mode, Together Provisioned Throughput): return một hệ thống "fully warm" với SLA latency, nhưng cộng thêm 25–75% giá.

### Cold-start trade-off — các kết quả đo lường được thu thập

- **Replicate**: 15–40 giây model load (billed) — các báo cáo khác nhau tùy model, fast-booting fine-tunes loại bỏ cold-start.
- **RunPod** (đối chiếu): ~30 giây cold start
- **Modal**: container warm pool siêu ngắn — người dùng thường báo sub-second spin-up (vì container đã pre-warmed). Region selection và non-preemptible là multiplier chính.
- **Baseten**: marketing "fast cold starts" nhưng không公开 số p50/p95 cụ thể trên trang pricing.
- **HF Endpoints**: ~3–7 phút để deploy/initialize instance mới (do underlying EC2/GKE).
- **Together/Fireworks**: chung shared warm pool cho các model Featured → cold start gần như bằng 0 cho model đã warm.

**Vendor claim "zero cold start"**:
- Together AI có "Provisioned Throughput" (min replica > 0, paid idle) → zero cold-start.
- Modal marketing "instant autoscale", không公开 p50/p95.
- Baseten marketing "blazing fast cold starts" — không公开 số.
- **Không vendor nào công bố p50/p95 cold start chính thức** trong tài liệu pricing snapshot 2026-08 — đây là gap công khai.

### Multi-region / latency routing
- OpenAI: regional data residency (10% uplift, US-only, từ 5/3/2026).
- Anthropic: `inference_geo: us` × 1.1 (Claude 4.6+), tiếng Anh liên quan đến data residency.
- Together/Fireworks: US-only serverless +10%; không公开 latency routing song song.
- Modal: region selection multiplier 1.5–1.75×; không có latency routing tự động cross-region.
- Baseten: custom global regions chỉ ở Enterprise.

### Rate-limit + burst behaviour
- OpenAI: rate limit tier-based (Free/Tier 1–5/Enterprise), không public RPM chính xác mà để daarft bảng http"Rate limits".
- Anthropic: Start/Build/Scale tier; Tool token count (e.g. computer toolset 4.5K token/tool def overhead).
- Fireworks: per model path có account quota (spend tiers). Cite `Account quotas` docs.
- Modal: Starter 100 container/10 GPU concurrency; Team 5000 container/50 GPU concurrency; Enterprise custom.
- Lepton (cũ): 10 RPM serverless endpoint tier free.
- Whisper/Baseten: rate-limit theo plan — Pro "higher Model API rate limits" — không公开 số.

## Source list (cập nhật cuối)

1. OpenAI Pricing — <https://developers.openai.com/api/docs/pricing> — ngày lấy 2026-08-24
2. Anthropic Pricing — <https://platform.claude.com/docs/en/about-claude/pricing> — 2026-08-24
3. Together AI Pricing — <https://www.together.ai/pricing> — 2026-08-24
4. Fireworks AI Serverless Pricing — <https://docs.fireworks.ai/serverless/pricing> — 2026-08-24
5. Replicate Pricing — <https://replicate.com/pricing> — 2026-08-24
6. Modal Pricing — <https://modal.com/pricing> — 2026-08-24
7. Baseten Pricing — <https://www.baseten.co/pricing/> — 2026-08-24
8. HF Inference Endpoints Pricing — <https://huggingface.co/docs/inference-endpoints/pricing> — 2026-08-24
9. Hyperbolic H200 blog — <https://www.hyperbolic.ai/blog/h200-price> — 2026
10. Lepton AI status — <https://free-llm.com/provider/lepton-ai> — 2025 (acquired)
11. NVIDIA DGX Cloud Lepton — <https://www.nvidia.com/en-us/data-center/dgx-cloud-lepton/> — 2026
12. Novita.ai changelog deprecation — <https://novita.ai/docs/de/changelog/25-12-25> — 2025-12-25
