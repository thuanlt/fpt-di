# Feature Survey — Together AI (api.together.ai)

**Phiên bản:** 1.0
**Ngày:** 18/08/2026
**Trạng thái:** Draft
**Chủ sở hữu:** Thuan Luu Thi (BA/PO)
**URL khảo sát:** `https://api.together.ai/endpoints` + `docs.together.xyz` + `together.ai/pricing`

---

## 1. Tổng quan

| Field | Value |
|-------|-------|
| **Sản phẩm** | Together AI — "AI Native Cloud" |
| **Định vị** | Accelerate training, fine-tuning và inference trên GPU clusters tối ưu hiệu năng |
| **Target** | AI-native companies (Cursor, Decagon, Vercept, Hedra, Pika, Cartesia) |
| **API** | OpenAI-compatible |
| **Free tier** | $5 credit khi signup |

---

## 2. Feature Matrix — Chi tiết

### 2.1 Inference Modes

| Feature | Mô tả | Pricing | FPT có? |
|---------|-------|---------|---------|
| **Serverless Inference** | Instant access, không provisioning, pay-per-token/megapixel/second | $0.05–9.00/1M tokens | ✓ (serverless) |
| **Dedicated Endpoints** | Reserved GPU, predictable latency, isolation, reserved throughput, autoscaling | H100 $6.49/hr · B200 $11.95/hr | ✓ (DDI) |
| **GPU Clusters** | Bare-metal + InfiniBand, cho training / custom inference engine | H100 $5.49/hr on-demand · $3.99/hr reserved | ✗ |
| **Batch API** | Async inference, giảm 50% chi phí cho non-urgent workloads | -50% so serverless | ✗ |
| **Provisioned Throughput (PTU)** | Reserved capacity theo throughput units + SLA | Theo PTU | ✗ |

### 2.2 Model Catalog

| Feature | Mô tả |
|---------|-------|
| **Số lượng model** | 100–200+ models |
| **Loại model** | Chat, instruct, code, image generation, embeddings, vision, audio, video generation |
| **Họ model** | Llama (all sizes), DeepSeek, Qwen, Mistral, Mixtral, DBRX, GPT-OSS, Kimi, GLM, MiniMax, Gemma, Nemotron |
| **Update** | Thêm model mới thường xuyên |
| **Pricing ví dụ** | GPT-OSS 20B: $0.05/$0.20 per 1M input/output tokens; DeepSeek V4 Pro: $2.10/$4.40 |

### 2.3 Fine-Tuning Platform

| Feature | Mô tả |
|---------|-------|
| **Phương pháp** | LoRA, full fine-tuning, DPO (Preference Alignment) |
| **Scale** | Multi-node training cho large models |
| **Managed training** | One-click deployment sau fine-tune |
| **Pricing** | ~$8–12/1M training tokens (LoRA) + hosting per-hour sau đó |
| **FPT có?** | ✗ — GAP lớn |

### 2.4 Developer Tools

| Feature | Mô tả | FPT có? |
|---------|-------|---------|
| **OpenAI-compatible API** | Migration dễ từ OpenAI | ✓ |
| **Python SDK** | `pip install together` | ✓ |
| **CLI** | Cluster operations | ✗ |
| **Playground** | Test model interactively | ✓ (separate page) |
| **Streaming** | Real-time token streaming | ✓ |

### 2.5 Pricing Model

| Model | Mô tả |
|-------|-------|
| **Pure consumption-based** | Không subscription tier, không setup fee, không minimum commitment |
| **Input < Output** | Input tokens luôn rẻ hơn output tokens |
| **Dedicated hosting** | ~$4,700/tháng cho 1 H100 (fine-tuned model), không phụ thuộc usage |
| **Batch discount** | -50% cho non-real-time |

---

## 3. Homepage UX Analysis (api.together.ai)

### 3.1 Landing page structure

```
┌────────────────────────────────────────────────────────────┐
│ Nav: Docs | Blog | Pricing | [Sign In]                     │
├────────────────────────────────────────────────────────────┤
│ HERO: "Build on the AI Native Cloud"                       │
│ Sub: "Accelerate training, fine-tuning and inference on    │
│ performance-optimized GPU clusters"                        │
│ 3 value props:                                             │
│  • Evaluate & build across modalities                      │
│  • Fine-tune open-source models                            │
│  • Reliably serve at unmatched price-performance          │
├────────────────────────────────────────────────────────────┤
│ SOCIAL PROOF: "AI Natives build on Together AI"            │
│ [Cursor] [Decagon] [Vercept] [Hedra] [Pika] [Cartesia]    │
├────────────────────────────────────────────────────────────┤
│ CTA: "Let's get started" — Sign in (Google/GitHub/SSO)    │
└────────────────────────────────────────────────────────────┘
```

**Đánh giá:**
- Landing page **gọn, focused** — chỉ 1 CTA (sign in)
- Social proof mạnh (6 brand logos: Cursor, Pika, Hedra...)
- 3 value props rõ ràng: evaluate → fine-tune → serve
- **Không có model catalog trên landing** — catalog nằm sau sign-in (console)

### 3.2 Console (sau sign-in)

| Section | Features |
|---------|----------|
| **Endpoints** | List serverless + dedicated endpoints, create new, monitor |
| **Model Catalog** | Browse, filter, test models |
| **Fine-tuning** | Create job, track progress, deploy |
| **GPU Clusters** | Rent, manage, monitor clusters |
| **Playground** | Interactive testing |
| **Billing** | Usage, invoices, cost breakdown |
| **API Keys** | Create, scope, revoke |

---

## 4. Gap Analysis — Together AI vs FPT DDI

| Feature | Together AI | FPT DDI | Priority |
|---------|-------------|---------|----------|
| Serverless inference | ✓ | ✓ | — |
| Dedicated endpoints | ✓ (H100 $6.49/hr) | ✓ (H100 $2–3/hr) | FPT rẻ hơn 50%+ |
| GPU clusters (bare-metal) | ✓ | ✗ | Should |
| Batch API (-50%) | ✓ | ✗ | **Must** |
| Provisioned Throughput (PTU) | ✓ | ✗ | Should |
| Fine-tuning (LoRA/full/DPO) | ✓ | ✗ | **Must** |
| Multi-node training | ✓ | ✗ | Could |
| CLI | ✓ | ✗ | Could |
| 200+ models | ✓ | ~20 models | **Must** (Phase 1: ≥20) |
| Multi-modal (image, audio, video) | ✓ | ✗ (chỉ LLM/VLM/TTS) | Should |
| Free tier | $5 credit | $100 credit (30 ngày) | FPT hào phóng hơn |
| OpenAI-compatible | ✓ | ✓ | — |
| Social proof (customer logos) | ✓ Mạnh | ✗ | Should |

---

## 5. Insights & Recommendations

### 5.1 Điểm mạnh Together AI cần học

| # | Insight | Recommendation cho FPT |
|---|---------|----------------------|
| 1 | **Pricing transparent** — hiển thị giá GPU/hr công khai trên pricing page | Public pricing page cho DDI (A30, H100, H200, B300) |
| 2 | **Batch API -50%** — giảm friction cho non-urgent workloads | Bổ sung Batch API vào Phase 2 |
| 3 | **Fine-tuning managed** — one-click deploy sau fine-tune | Bổ sung Fine-tuning API vào Phase 2 |
| 4 | **Social proof** — 6 customer logos trên landing | Thu thập + hiển thị customer logos (khi có) |
| 5 | **3 value props rõ ràng** — evaluate → fine-tune → serve | Chốt 3 value props cho FPT DDI landing |
| 6 | **Pure consumption-based** — không minimum commitment | Giữ nguyên mô hình pay-per-use |

### 5.2 Lợi thế FPT so với Together AI

| Advantage | Chi tiết |
|-----------|----------|
| **Giá rẻ hơn 50%+** | H100 $2–3/hr (FPT) vs $6.49/hr (Together) |
| **Data residency VN** | Tuân thủ Nghị định 13/2023 — Together không có |
| **Model tiếng Việt** | FPT.AI — unique, Together không có |
| **Free tier hào phóng hơn** | $100 credit (FPT) vs $5 (Together) |
| **Local support** | Hỗ trợ tiếng Việt, latency thấp cho VN |

### 5.3 Gaps cần đóng (theo priority)

| Priority | Gap | Action |
|----------|-----|--------|
| **Must** | Batch API | Bổ sung vào Phase 2 roadmap |
| **Must** | Fine-tuning (LoRA) | Bổ sung vào Phase 2 |
| **Must** | Model catalog ≥20 | Đảm bảo Phase 1 KPI |
| **Should** | GPU clusters (bare-metal) | Phase 3 |
| **Should** | Provisioned Throughput | Phase 3 |
| **Should** | Multi-modal (image, video) | Phase 3 |
| **Could** | CLI | Phase 3+ |

---

## 6. Conclusion

Together AI là benchmark mạnh nhất cho FPT DDI về **feature breadth** (serverless + dedicated + clusters + fine-tuning + batch). Tuy nhiên, FPT có lợi thế **giá rẻ hơn 50%+ + data residency VN + model tiếng Việt** — 3 điểm mà Together không có.

**Khuyến nghị:** FPT DDI nên tập trung Phase 1 vào "dedicated + data residency + giá rẻ" trước, sau đó bổ sung Batch API + Fine-tuning (Phase 2) để thu hẹp gap feature.