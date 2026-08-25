# Competitive Analysis — AI Model Marketplace & Serverless Inference

**Phiên bản:** 1.0
**Ngày:** 17/08/2026
**Trạng thái:** Draft
**Chủ sở hữu:** Thuan Luu Thi (BA/PO)
**Phạm vi:** Phân tích đối thủ cung cấp AI model dưới dạng serverless inference API + hạ tầng tự chủ

---

## 1. Tổng quan thị trường

Thị trường AI model marketplace serverless inference đang phát triển nhanh chóng (2025-2026), với xu hướng:
- **Chi phí inference giảm mạnh**: Từ $60/1M tokens (2021) xuống $0.06/1M tokens (2026)
- **Self-hosting trở nên khả thi**: Break-even ~2M tokens/ngày hoặc GPU utilization 22-48%
- **Open-source models phổ biến**: Llama, Qwen, Gemma, DeepSeek — nhiều provider host cùng model
- **OpenAI-compatible API**: Almost all providers support OpenAI API format

---

## 2. Đối thủ chính — Serverless Inference + Self-Hosted Infrastructure

### 2.1 Together AI

| Field | Value |
|-------|-------|
| **Website** | together.ai |
| **Mô hình** | Serverless inference API + dedicated GPU clusters |
| **Hạ tầng** | Tự chủ (own GPU infrastructure, NVIDIA H100/A100) |
| **Model catalog** | 100+ open-source models (Llama, Qwen, Mixtral, Gemma) |
| **Pricing** | Pay-per-token ($0.18-$3.50/1M tokens tùy model) |
| **API** | OpenAI-compatible |
| **Highlight** | |
| | • Real-time inference với auto-scaling |
| | • Fine-tuning API |
| | • Streaming support |
| | • Model benchmarking công khai |
| **Homepage concept** | |
| | • Hero: "The fastest way to run open-source AI" |
| | • Model grid với provider badge (Meta, Alibaba, Google) |
| | • Real-time pricing calculator |
| | • Benchmark comparison table |
| **Điểm mạnh** | Infrastructure tự chủ, tốc độ cao, model catalog rộng |
| **Điểm yếu** | Pricing cao hơn DeepInfra, không có multi-provider routing |

---

### 2.2 Fireworks AI

| Field | Value |
|-------|-------|
| **Website** | fireworks.ai |
| **Mô hình** | Serverless inference API |
| **Hạ tầng** | Tự chủ (NVIDIA GPU clusters, optimized inference engine) |
| **Model catalog** | 80+ models (Llama, Qwen, Mixtral, Gemma, custom) |
| **Pricing** | Pay-per-token ($0.20-$4.00/1M tokens) |
| **API** | OpenAI-compatible + native SDK |
| **Highlight** | |
| | • Inference engine tối ưu (vLLM + custom optimizations) |
| | • Fine-tuning platform |
| | • Real-time + batch inference |
| | • Custom model deployment |
| **Homepage concept** | |
| | • Hero: "Build with the best open-source models" |
| | • Provider showcase (Meta, Google, Alibaba, Mistral) |
| | • Model cards với latency benchmark |
| | • Pricing table transparent |
| **Điểm mạnh** | Inference engine tối ưu, custom model support |
| **Điểm yếu** | Model catalog nhỏ hơn Together, pricing cao |

---

### 2.3 Groq

| Field | Value |
|-------|-------|
| **Website** | groq.com |
| **Mô hình** | Serverless inference API (hardware-accelerated) |
| **Hạ tầng** | Tự chủ (LPU — Language Processing Unit, proprietary chip) |
| **Model catalog** | 30+ models (Llama, Mixtral, Gemma, Grok) |
| **Pricing** | Free tier + pay-per-token ($0.06-$0.89/1M tokens) |
| **API** | OpenAI-compatible |
| **Highlight** | |
| | • **Ultra-low latency** (LPU chip, 300+ tokens/sec) |
| | • Deterministic inference (no GPU memory bottlenecks) |
| | • Free tier hào phóng |
| | • Real-time streaming |
| **Homepage concept** | |
| | • Hero: "Blazingly fast AI inference" |
| | • Speed benchmark hero (Groq vs GPU) |
| | • Model cards với latency highlight |
| | • Pricing: free + low cost |
| **Điểm mạnh** | Latency thấp nhất thị trường, pricing cạnh tranh, free tier |
| **Điểm yếu** | Model catalog nhỏ, chỉ host open-source models |

---

### 2.4 Replicate

| Field | Value |
|-------|-------|
| **Website** | replicate.com |
| **Mô hình** | Serverless inference + custom model deployment |
| **Hạ tầng** | Tự chủ (cloud GPU infrastructure) |
| **Model catalog** | 1000+ models (LLM, image, audio, video) |
| **Pricing** | Pay-per-second ($0.0001-$0.10/sec tùy GPU) |
| **API** | Native REST + SDKs |
| **Highlight** | |
| | • Multi-modal (không chỉ LLM) |
| | • Custom model deployment (bring your own Docker) |
| | • Webhook support |
| | • Streaming |
| **Homepage concept** | |
| | • Hero: "Run machine learning models in the cloud" |
| | • Model gallery (grid cards, filter by category) |
| | • Provider attribution (creator name on each card) |
| | • "Deploy your own model" CTA |
| **Điểm mạnh** | Multi-modal, custom model, ecosystem rộng |
| **Điểm yếu** | Pricing per-second không transparent cho token-based, latency cao hơn Together/Groq |

---

### 2.5 DeepInfra

| Field | Value |
|-------|-------|
| **Website** | deepinfra.com |
| **Mô hình** | Serverless inference API |
| **Hạ tầng** | Tự chủ (NVIDIA GPU clusters) |
| **Model catalog** | 200+ open-source models |
| **Pricing** | Pay-per-token ($0.02-$0.30/1M tokens) — **rẻ nhất thị trường** |
| **API** | OpenAI-compatible |
| **Highlight** | |
| | • Pricing cực thấp (thường 50-80% rẻ hơn Together/Fireworks) |
| | • Model catalog rộng |
| | • Real-time inference |
| | • Custom model deployment |
| **Homepage concept** | |
| | • Hero: "The cheapest way to run AI models" |
| | • Pricing comparison table (DeepInfra vs Together vs Fireworks) |
| | • Model cards với pricing prominent |
| | • Provider filter |
| **Điểm mạnh** | Pricing rẻ nhất, model catalog rộng |
| **Điểm yếu** | Brand awareness thấp, UI/UX cơ bản, latency không tối ưu bằng Groq |

---

### 2.6 SiliconFlow

| Field | Value |
|-------|-------|
| **Website** | siliconflow.cn |
| **Mô hình** | All-in-one serverless AI cloud |
| **Hạ tầng** | Tự chủ (GPU infrastructure, China + global) |
| **Model catalog** | 100+ models (Qwen, Llama, Yi, custom) |
| **Pricing** | Pay-per-token ($0.05-$0.50/1M tokens) |
| **API** | OpenAI-compatible |
| **Highlight** | |
| | • All-in-one platform (inference + fine-tuning + deployment) |
| | • Strong China market presence |
| | • Fast inference (optimized for Chinese models) |
| | • Dedicated endpoints |
| **Homepage concept** | |
| | • Hero: "All-in-One Serverless AI Cloud" |
| | • Model showcase với provider attribution |
| | • Pricing calculator |
| | • Fine-tuning CTA |
| **Điểm mạnh** | All-in-one, China market, pricing cạnh tranh |
| **Điểm yếu** | Global brand awareness thấp, UI tiếng Trung, limited Western models |

---

### 2.7 Lepton AI

| Field | Value |
|-------|-------|
| **Website** | lepton.ai |
| **Mô hình** | Serverless inference + dedicated GPU endpoints |
| **Hạ tầng** | Tự chủ (GPU infrastructure) |
| **Model catalog** | 50+ models |
| **Pricing** | Pay-per-token + dedicated endpoints |
| **API** | OpenAI-compatible |
| **Highlight** | |
| | • Low-latency serverless inference |
| | • Dedicated GPU endpoints (consistent performance) |
| | • Custom model deployment |
| | • Python-native SDK |
| **Homepage concept** | |
| | • Hero: "Build AI apps in minutes" |
| | • Model cards với latency benchmark |
| | • "Deploy your own model" flow |
| | • Pricing: serverless + dedicated |
| **Điểm mạnh** | Low latency, dedicated endpoints, Python-native |
| **Điểm yếu** | Model catalog nhỏ, brand awareness thấp |

---

### 2.8 OpenRouter

| Field | Value |
|-------|-------|
| **Website** | openrouter.ai |
| **Mô hình** | Multi-provider routing marketplace |
| **Hạ tầng** | Không tự host — route đến nhiều provider (Together, Fireworks, Groq, v.v.) |
| **Model catalog** | 200+ models (từ nhiều provider) |
| **Pricing** | Pass-through pricing (giá của provider gốc + phí nhỏ) |
| **API** | OpenAI-compatible |
| **Highlight** | |
| | • **Multi-provider routing** — 1 API cho nhiều provider |
| | • Smart routing (tự chọn provider rẻ nhất/nhanh nhất) |
| | • Provider attribution rõ ràng |
| | • Fallback support |
| **Homepage concept** | |
| | • Hero: "One API for all AI models" |
| | • Provider showcase (logo grid) |
| | • Model cards với provider badge + pricing từ nhiều provider |
| | • Smart routing explanation |
| **Điểm mạnh** | Multi-provider, smart routing, 1 API cho mọi model |
| **Điểm yếu** | Không tự host infrastructure, phụ thuộc provider, latency không tối ưu |

---

## 3. Bảng so sánh tổng hợp

| Provider | Hạ tầng | Model count | Pricing/1M tok | Latency | API | Multi-provider | Custom model |
|----------|---------|-------------|----------------|---------|-----|----------------|--------------|
| **Together AI** | ✓ Tự chủ | 100+ | $0.18-3.50 | Fast | OpenAI | ✗ | ✓ |
| **Fireworks AI** | ✓ Tự chủ | 80+ | $0.20-4.00 | Fast | OpenAI | ✗ | ✓ |
| **Groq** | ✓ Tự chủ (LPU) | 30+ | $0.06-0.89 | **Ultra-fast** | OpenAI | ✗ | ✗ |
| **Replicate** | ✓ Tự chủ | 1000+ | Per-second | Medium | Native | ✗ | ✓ |
| **DeepInfra** | ✓ Tự chủ | 200+ | **$0.02-0.30** | Medium | OpenAI | ✗ | ✓ |
| **SiliconFlow** | ✓ Tự chủ | 100+ | $0.05-0.50 | Fast | OpenAI | ✗ | ✓ |
| **Lepton AI** | ✓ Tự chủ | 50+ | Competitive | Fast | OpenAI | ✗ | ✓ |
| **OpenRouter** | ✗ Route | 200+ | Pass-through | Medium | OpenAI | ✓ | ✗ |

---

## 4. Phân tích UI/UX — Homepage Design Patterns

### 4.1 Provider Attribution (nổi bật provider)

| Provider | Cách hiển thị provider | Đánh giá |
|----------|----------------------|----------|
| **Together AI** | Provider badge trên card (Meta, Google, Alibaba) | ✓ Tốt — badge màu + tên |
| **Fireworks AI** | Provider name trong model detail | TB — không nổi trên card |
| **Groq** | Provider name trong model list | ✓ Tốt — tên provider rõ |
| **Replicate** | Creator name prominent trên card | ✓ Rất tốt — creator là yếu tố chính |
| **DeepInfra** | Provider name nhỏ trong card | ✗ Kém — khó nhận diện |
| **OpenRouter** | Provider badge + pricing per provider | ✓ Rất tốt — nhiều provider cho 1 model |

### 4.2 Model Card Design

| Provider | Layout | Provider visibility | Pricing visible | Specs visible |
|----------|--------|---------------------|-----------------|---------------|
| **Together AI** | Grid card | ✓ Badge | ✓ | ✓ Context/price |
| **Fireworks AI** | Grid card | TB Name | ✓ | ✓ Context/price |
| **Groq** | List + card | ✓ Name | ✓ | ✓ Latency/price |
| **Replicate** | Gallery card | ✓ Creator | TB | ✗ Chi tiết ít |
| **DeepInfra** | Grid card | ✗ Small | ✓ | ✓ Context/price |
| **OpenRouter** | List card | ✓ Provider | ✓ Multi-price | ✓ Context |

### 4.3 Filter & Search

| Provider | Filter provider | Filter category | Search autocomplete | Multi-select |
|----------|----------------|-----------------|-------------------|--------------|
| **Together AI** | ✓ | ✓ | ✓ | ✓ |
| **Fireworks AI** | ✓ | ✓ | ✓ | ✓ |
| **Groq** | ✗ | ✓ | ✓ | ✗ |
| **Replicate** | ✗ | ✓ | ✓ | ✗ |
| **DeepInfra** | ✓ | ✓ | ✓ | ✓ |
| **OpenRouter** | ✓ | ✓ | ✓ | ✓ |

---

## 5. Insights & Recommendations cho FPT AI Marketplace

### 5.1 Điểm khác biệt của FPT

| Yếu tố | FPT Advantage |
|--------|---------------|
| **FPT-hosted models** | Data residency tại Việt Nam — lợi thế compliance |
| **Vietnamese models** | FPT.AI-VITs, Vietnamese_Embedding — unique |
| **Local infrastructure** | Latency thấp cho khách hàng Việt Nam |
| **Pricing** | Cạnh tranh với DeepInfra, rẻ hơn Together/Fireworks |

### 5.2 Recommendations từ competitive analysis

| Priority | Recommendation | Lý do |
|----------|---------------|-------|
| **Must** | Provider showcase section (như Together AI + OpenRouter) | Provider là yếu tố tin tưởng — Together AI làm tốt |
| **Must** | Provider filter multi-select | DeepInfra/OpenRouter có, FPT thiếu |
| **Must** | Provider badge nổi trên card (như Replicate) | Replicate — creator là yếu tố chính, FPT cần làm tương tự |
| **Should** | Pricing comparison (FPT vs market) | DeepInfra làm tốt — tạo niềm tin về giá |
| **Should** | Latency benchmark trên card | Groq làm tốt — latency là điểm bán hàng |
| **Should** | "FPT-hosted" badge prominent | Unique advantage — data residency |
| **Could** | Multi-provider routing (như OpenRouter) | 1 API cho nhiều provider — long-term vision |
| **Could** | Custom model deployment (như Replicate) | Bring your own model — enterprise value |

### 5.3 Pricing Strategy

| Model type | FPT Target | Together AI | DeepInfra | Groq |
|------------|-----------|-------------|-----------|------|
| Llama 3.1 8B | $0.05-0.10 | $0.18 | $0.02 | $0.06 |
| Llama 3.1 70B | $0.20-0.50 | $0.80 | $0.10 | $0.39 |
| Qwen 72B | $0.15-0.40 | $0.70 | $0.08 | N/A |
| Gemma 7B | $0.05-0.10 | $0.18 | $0.02 | $0.06 |

> **Recommendation:** FPT nên định giá cạnh tranh với DeepInfra (rẻ nhất) nhưng cao hơn 20-50% để đảm bảo margin, đồng thời highlight FPT-hosted advantage.

---

## 6. Conclusion

FPT AI Marketplace có lợi thế cạnh tranh rõ ràng: **hạ tầng tự chủ tại Việt Nam + model tiếng Việt + data residency**. Tuy nhiên, cần cải thiện UI/UX để **nổi bật provider** (học từ Together AI, Replicate, OpenRouter) và **hiển thị thông tin kỹ thuật rõ ràng** (học từ Groq, DeepInfra).

**Top 3 đối thủ cần theo dõi sát:**
1. **Together AI** — benchmark cho provider attribution + model card design
2. **DeepInfra** — benchmark cho pricing competitive
3. **OpenRouter** — benchmark cho multi-provider concept