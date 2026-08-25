# FPT DDI — Dedicated Inference
## Market Research, Strategic Roadmap & Competitive Analysis

**Phiên bản:** 1.0 (Merged)
**Ngày:** 18/08/2026
**Chủ sở hữu:** DDI Team
**Phạm vi:** Market research + Strategic implementation roadmap

---

## SLIDE 1 · TITLE

```
B2B ONLY
FPT DDI — Dedicated Inference
Market Research, Strategic Roadmap & Competitive Analysis

"Deploy an AI model running on dedicated, reserved GPUs.
Always on, no shared capacity, no rate limits.
Better suited for serious traffic than serverless."

FPT · Dedicated Inference · Model Catalog · GPU Container
H100 · H200 · B300 · A30

Chủ sở hữu: DDI Team  |  Ngày: 18/08/2026
```

---

## SLIDE 2 · EXECUTIVE SUMMARY

| Câu hỏi | Trả lời |
|---------|---------|
| **Sản phẩm là gì?** | Dedicated Inference: deploy model trên GPU dedicated/reserved, always-on, không shared capacity, không rate limits |
| **Khác serverless?** | Serverless = chia sẻ hạ tầng, pay-per-token, cold-start & rate limits. Dedicated = tài nguyên riêng, GPU/giờ, hiệu năng ổn định |
| **Phù hợp ai?** | Traffic nghiêm túc (production, enterprise), latency ổn định, bảo mật tách biệt |
| **Thị trường** | AI inference ~$117,8 tỷ (2026), GPU ~35,3%; VN ~$1 tỷ, CAGR ~39% |
| **Cơ hội FPT** | "Dedicated + data residency VN + tiếng Việt" — khoảng trống chưa đối thủ nào chiếm giữ mạnh |

---

## SLIDE 3 · DEDICATED vs SERVERLESS

| Tiêu chí | Dedicated (FPT DDI) | Serverless |
|----------|---------------------|------------|
| **Tài nguyên GPU** | Riêng (reserved) | Chia sẻ (shared pool) |
| **Trạng thái** | Always-on | Cold-start |
| **Rate limits** | Không có | Có |
| **Hiệu năng** | Ổn định, dự đoán được | Dao động theo load |
| **Định giá** | GPU/giờ (reserved) | Pay-per-token |
| **Bảo mật tách biệt** | Hoàn toàn | Chia sẻ hạ tầng |
| **Phù hợp** | Production, enterprise, compliance | Prototype, low-traffic, cost-sensitive |

---

## SLIDE 4 · THỊ TRƯỜNG TOÀN CẦU & VIỆT NAM

### AI Inference toàn cầu
- **~$117,8 tỷ** (2026)
- **GPU segment ~35,3%**
- **AI Data Center GPU:** $12,83B → $77,15B (2035), CAGR ~22%
- **Cloud tăng nhanh nhất**

### Chỉ số so sánh

| Chỉ số | Toàn cầu | Việt Nam |
|--------|----------|----------|
| Quy mô AI | ~$117,8 tỷ (2026) | ~$1 tỷ (2026) |
| Tăng trưởng | CAGR ~22% (GPU data center) | CAGR ~39% đến 2031 |
| Doanh nghiệp dùng AI | — | — |

---

## SLIDE 5 · CẠNH TRANH

| Provider | Mô hình Dedicated | Pricing GPU/giờ | Điểm mạnh |
|----------|-------------------|-----------------|-----------|
| **Together AI** | GPU Clusters, Dedicated Container Inference | H100 ~$2–3 | Container + k8s + VM trọn gói |
| **Fireworks AI** | Dedicated deployments, Virtual Cloud, BYOC | B200 $9 | Engine tối ưu, BYOC |
| **Baseten** | Dedicated + serverless, cross-cloud autoscale | — | Autoscaling đa cloud |
| **Lambda** | 1-Click Clusters, MK8s | B200 $3,49 | Giá rẻ, price transparency |

---

## SLIDE 6 · ĐỊNH VỊ — MA TRẬN CẠNH TRANH

```
                    Serverless / Shared          →          Dedicated / Reserved
                    ┌─────────────────┬─────────────────┐
    Global          │  Global         │  Global         │
    (Generic)       │  serverless     │  dedicated      │
                    │  (Together)     │  (Fireworks)    │
                    ├─────────────────┼─────────────────┤
    Local           │  Local          │  Niche local    │
    (Data residency)│  serverless     │  dedicated      │
                    │  (GreenNode)    │  ★ FPT DDI      │
                    └─────────────────┴─────────────────┘
```

**Vị trí FPT:** góc "niche local dedicated" — dedicated + data residency Việt Nam. Khoảng trống chưa đối thủ nào chiếm giữ mạnh.

---

## SLIDE 7 · PRICING BENCHMARK — DEDICATED GPU/GIỜ (2026)

| GPU | Range on-demand | Provider thấp nhất | Hyperscaler cao nhất |
|-----|-----------------|-------------------|---------------------|
| **H100** | $1,99 – $14,90 | Vast $1,60 · GMI $2,00 · RunPod $2,89 | AWS ~$6,16 |
| **H200** | $1,99 – $13,78 | GMI $2,60 · Jarvislabs $3,99 | AWS $7,91 · Azure $10,60 |
| **B200** | $3,20 – $16,11 | Runcrate $3,20 · Lambda $3,49 | AWS $14,24 · GCP $16,11 |
| **A30** | Entry-level | Thấp hơn H100 đáng kể | — |

### INSIGHTS
- **40–60%** neo-cloud định giá thấp hơn hyperscaler
- **FPT định giá đề xuất:** ngang neo-cloud ($2–3/giờ cho H100), entry-point rẻ cho A30

---

## SLIDE 8 · SWOT ANALYSIS

| Strengths | Weaknesses |
|-----------|------------|
| ✓ Hạ tầng tự chủ VN | ✗ Brand toàn cầu thấp hơn Together/Fireworks |
| ✓ Quan hệ chiến lược NVIDIA | ✗ Model catalog hẹp hơn |
| ✓ Data residency + compliance | ✗ Nguồn cung B300 hạn chế |
| ✓ Model tiếng Việt FPT.AI | ✗ Vận hành GPU quy mô lớn còn mới |
| ✓ Dải GPU A30 → B300 | |

| Opportunities | Threats |
|---------------|----------|
| ○ Thị trường inference $117,8 tỷ | ● Đối thủ funding $1,3–2 tỷ mở rộng nhanh |
| ○ Xu hướng serverless → dedicated | ● GreenNode/Viettel nội địa |
| ○ Chiến lược AI quốc gia 250K GPU | ● Biến động giá GPU |
| ○ NVIDIA đầu tư $4–4,5 tỷ vào VN | ● Đua giảm giá làm mỏng margin |

---

## SLIDE 9 · GO-TO-MARKET STRATEGY

### Định vị
> "Dedicated, reserved GPUs. Always on, no shared capacity, no rate limits. Better suited for serious traffic than serverless."

### 3 Trụ cột khác biệt

| # | Trụ cột | Mô tả |
|---|---------|-------|
| 1 | **Dedicated & Always-on** | Tài nguyên GPU riêng, không shared capacity, không rate limits |
| 2 | **Data residency Việt Nam** | Tuân thủ Nghị định 13/2023 |
| 3 | **Tiếng Việt & Địa phương** | Model FPT.AI, hỗ trợ bản địa, latency thấp |

### Chiến lược giá

| GPU | Định giá đề xuất | So với thị trường |
|-----|-----------------|-------------------|
| **A30** | Entry-point rẻ, hút SME | Cạnh tranh nhất |
| **H100** | Ngang neo-cloud ($2–3/giờ) | Cạnh tranh |
| **H200** | — | — |
| **B300** | — | — |

---

## SLIDE 10 · MARKET SEGMENTS OVERVIEW

### 5 Phân khúc — ưu tiên theo budget và khả năng tiếp cận

| # | Phân khúc | ARR | Ưu tiên |
|---|-----------|-----|---------|
| **#1 BFSI** | Banking, Financial Services & Insurance | $1M–20M+ | ★ PRIMARY |
| **#2 Mid-market Tech** | B2B2C Software có LLM feature | $200K–5M | ★ PRIMARY |
| **#3 Retail Chain** | Chuỗi bán lẻ & E-commerce | $500K–10M | PRIMARY |
| **#4 Healthcare** | Bệnh viện & life sciences | $500K–15M | FASTEST GROWING |
| **#5 Government** | Chính phủ & công ích | — | SECONDARY |

---

## SLIDE 11 · BFSI — PRIMARY TARGET

### Banking, Financial Services & Insurance

| Metric | Value |
|--------|-------|
| **AI in BFSI market 2024** | $43B |
| **CAGR đến 2033** | 24% |
| **JPMorgan AI infra/năm** | $2B |
| **BFSI IT spending 2026** | $6,15T (10.8% YoY growth) |

### Use Cases
- Fraud detection real-time (<50ms)
- KYC / AML document processing
- Contract intelligence & compliance
- Customer advisory bot (wealth mgmt)
- Credit scoring với NLP

### Tại sao BẮT BUỘC phải dùng Dedicated
- 🔒 **Data isolation** — luật bắt buộc, không negotiate được
- ⚡ **Latency p99 <100ms** — fraud detection không thể spike
- 📋 **Audit trail** đầy đủ cho ngân hàng trung ương
- 📜 **SOC2, GDPR, HIPAA** — shared endpoint bị legal veto

**ARR potential:** $1M–$20M+ | **Sales cycle:** 6–18 tháng | **Decision maker:** CTO + CISO + Legal

---

## SLIDE 12 · MID-MARKET TECH — SECONDARY TARGET

### B2B2C Software có LLM feature trong production

| Metric | Value |
|--------|-------|
| **Token/ngày khi hit dedicated tier** | 200M+ |
| **Tăng trưởng** | 30%/tháng |
| **Số inference provider sử dụng** | 3 (trung bình) |
| **Sales cycle** | 2–6 tuần (ngắn nhất) |

### Buying Trigger
- Hit rate limit → feature down cho toàn bộ customer
- p95 latency tăng 3x → enterprise customer complain
- Unit economics âm → cần giảm cost/token 30–40%
- Enterprise customer hỏi về data isolation policy
- Muốn fine-tune model trên customer data (upsell)

**ARR potential:** $200K–5M | **Sales cycle:** 2–6 tuần | **Decision maker:** CTO + VP Engineering

---

## SLIDE 13 · RETAIL CHAIN & E-COMMERCE

### Chuỗi bán lẻ & E-commerce lớn

| Metric | Value |
|--------|-------|
| **Doanh thu e-comm từ AI recommendations** | 35% (2025) |
| **Giảm tồn kho với AI** | 20–30% |
| **Volume peak season** | 10x (11/11, Tết) |

### Use Cases
- Demand forecasting SKU-level (4h cập nhật)
- Personalized recommendation real-time
- Dynamic pricing — cập nhật theo phút
- AI chatbot CSKH handle peak 50K concurrent
- Supply chain & inventory optimization

### Buying Trigger thực tế
- 💥 Shared endpoint down ngày 11/11 → mất doanh thu ngay
- 📉 Conversion drop khi recommendation engine lag >200ms
- 💰 Usage-based bill tăng 4x cuối năm không báo trước
- 🏆 Đối thủ đã deploy AI — CEO áp lực cạnh tranh

**ARR potential:** $500K–$10M | **Sales cycle:** 3–9 tháng | **Decision maker:** CTO + CDO + CFO

---

## SLIDE 14 · HEALTHCARE & LIFE SCIENCES

### Bệnh viện, bảo hiểm y tế & pharma

| Metric | Value |
|--------|-------|
| **CAGR healthcare AI đến 2033** | 32.2% (Fastest growing) |
| **Tiết kiệm tiềm năng/năm** | $200B (McKinsey) |
| **Vendor bị loại vòng HIPAA/BAA** | 90% (shared endpoint không pass) |

### Use Cases
- Clinical note summarization (2h/ngày/bác sĩ)
- Prior authorization tự động (-70–80% thủ công)
- Medical coding ICD-10 & billing
- Patient triage chatbot 24/7
- Drug interaction check & discovery

### Dealbreaker ngay vòng đầu
- ❌ Không ký được BAA / HIPAA
- ❌ Data ra khỏi hospital perimeter
- ❌ Không có dedicated VPC option
- ❌ Không có clinical validation / accuracy data

**ARR potential:** $500K–$15M | **Sales cycle:** 6–24 tháng | **Decision maker:** CIO + Compliance + CMO

---

## SLIDE 15 · SEGMENT COMPARISON

| Tiêu chí | 🏦 BFSI | 🛒 Retail | 🏥 Healthcare | 💻 Mid-market |
|----------|---------|-----------|---------------|---------------|
| **IT budget** | Pre-approved hàng triệu $ | $500K–10M/năm | $500K–15M/năm | $200K–5M |
| **Lý do mua dedicated** | Compliance bắt buộc | Peak volume + SLA | HIPAA mandatory | Rate limit + scale |
| **ARR potential** | $1M–20M+ | $500K–10M | $500K–15M | $200K–5M |
| **Churn risk** | Thấp — lock in cao | Trung bình | Thấp — compliance | Cao — price sensitive |
| **Sales cycle** | 6–18 tháng | 3–9 tháng | 6–24 tháng | 2–6 tuần |

---

## SLIDE 16 · TARGET CUSTOMER STRATEGY

### Tập trung 2 nhóm: BFSI và Mid-market Tech

**Bổ trợ nhau hoàn hảo:** BFSI cho ARR lớn & lock-in, Tech cho velocity & học sản phẩm nhanh

| | #1 BFSI (PRIMARY) | #2 Mid-market Tech (SECONDARY) |
|---|-------------------|-------------------------------|
| **ARR** | $1M – $20M+ | $200K – $5M |
| **Sales cycle** | 6 – 18 tháng | 2 – 6 tuần |
| **Decision maker** | CTO + CISO + Legal | CTO + VP Engineering |
| **Tại sao chọn** | Compliance bắt buộc, budget pre-approved, lock-in cao | Velocity cao, học sản phẩm nhanh, PLG → enterprise |

---

## SLIDE 17 · USER PERSONA — BFSI

### Minh — Head of AI Platform tại ngân hàng top 5

| Field | Value |
|-------|-------|
| **Tuổi / Vai trò** | 38, Head of AI Platform · Bank top 5 VN |
| **Team** | 30 engineers + 5 data scientists |
| **Báo cáo** | CTO, dotted-line CISO |
| **Budget** | Quản lý $4–6M/năm infra AI |
| **KPI** | Latency p99, audit pass-rate, cost/token |

### Goals
- Triển khai fraud-detection <50ms
- Pass audit của NHNN, SOC2
- Giảm chi phí inference 30%

### Pains
- Shared endpoint không ký được BAA
- Latency spike giờ cao điểm
- Vendor lock-in của cloud lớn

### Buying Triggers
- RFP hạ tầng AI 2026
- Compliance team chặn shared LLM
- POC fraud detection thất bại trên shared

### Tools & Channels
- RFP qua mua sắm nội bộ
- Vào qua Accenture / Deloitte / FPT IS
- Tham khảo Gartner, peer banks

---

## SLIDE 18 · USER PERSONA — MID-MARKET TECH

### Linh — VP Engineering tại Mid-tech company

| Field | Value |
|-------|-------|
| **Tuổi / Vai trò** | 32, VP Eng · Mid-tech Company (Series B, 80 người) |
| **Team** | 12 engineers, 2 ML |
| **Báo cáo** | CTO co-founder |
| **Budget** | $300K–800K/năm LLM infra |
| **KPI** | p95 latency, $/MTok, uptime |

### Goals
- Giảm cost/token 30–40%
- Tự fine-tune model trên customer data
- Đạt SLA cho enterprise customer

### Pains
- Hit rate limit shared endpoint
- p95 tăng 3x giờ cao điểm
- Technical debt tích lũy

### Buying Triggers
- Feature down cho customer → churn
- Enterprise customer hỏi về data isolation
- Unit economics âm

---

## SLIDE 19 · CUSTOMER JOURNEY — BFSI

### Từ Catalog đến Billing — Enterprise journey

| # | Màn hình | Hành động | Kết quả | Feature |
|---|----------|-----------|---------|---------|
| 1 | **Model Catalog** | Lọc theo task (NLP, fraud), license thương mại, size phù hợp GPU on-prem | ✓ Short-list model qua được vòng compliance | Search & Filter |
| 2 | **Model Detail** | Xem specs, license, preset GPU & cost preview để gửi Legal và Finance | ✓ Có tài liệu kỹ thuật + chi phí cho RFP | Cost Preview |
| 3 | **Deploy — Advanced** | Chọn GPU / replicas / quantization, region VN, auto-scale theo giờ giao dịch | ✓ Endpoint dedicated, data residency VN, có SLA | Advanced Deploy |
| 4 | **My Dedicated Model** | Monitor endpoint, scale up/down, view usage | ✓ Endpoint running, SLA tracked | Lifecycle Management |
| 5 | **Usage & Billing** | Xem token usage, GPU-hours, spend per project | ✓ Invoice + cost optimization insights | Billing Dashboard |
| 6 | **API Keys** | Create scoped keys, rotate, revoke | ✓ Secure access control | API Key Management |

---

## SLIDE 20 · FEATURE LIST

### 7 Module cốt lõi — phục vụ cả enterprise (BFSI) lẫn self-serve (Tech)

| # | Module | Mô tả |
|---|--------|-------|
| 01 | **Model Catalog** | List model có sẵn — search, filter theo task/size/license |
| 02 | **Hugging Face Import** | Pull bất kỳ model nào từ HF về object storage VN |
| 03 | **Model Detail** | Specs, license, preset GPU recommendation, cost preview |
| 04 | **Deploy Flow** | Quick (preset) & Advanced (GPU / replicas / quantization / auto-scale) |
| 05 | **My Dedicated Model** | Lifecycle endpoint: Queued → Deploying → Running ↔ Paused |
| 06 | **Usage & Billing** | All models token, Requests Over Time, GPU-hours, Spend |
| 07 | **API Keys** | Scoped keys, one-time reveal, revocation |

---

## SLIDE 21 · DEPLOY FLOW — ROADMAP 3 PHASE

### Từ deploy thủ công → autoscale theo tải → scale-to-zero tối ưu chi phí

| Phase | Tên | Mô tả | Features |
|-------|-----|-------|----------|
| **01** | **MVP · Launch** | Deploy Model — User chọn model, GPU, region → endpoint dedicated chạy 24/7 | Quick deploy (preset GPU) & Advanced (GPU type, replicas, quantization); Region VN, object storage nội địa; Endpoint URL + API key cấp ngay; Fixed replicas — user tự chỉnh |
| **02** | **Sau MVP** | Autoscale — Replicas tự co giãn theo QPS / GPU utilization, min ≥ 1 | Set min/max replicas + target metric (QPS, GPU%, latency p95); Scale-up nhanh khi traffic tăng, scale-down có cooldown; Giữ tối thiểu 1 replica nóng → không cold start; Phù hợp BFSI / production workload có SLA |
| **03** | **Tối ưu** | Scale-to-zero — Khi không có traffic, scale về 0 → tiết kiệm 100% chi phí | Auto-pause khi idle > threshold; Warm-up trước khi serve request; Phù hợp Mid-market Tech / batch workloads |

---

## SLIDE 22 · PRICING STRATEGY

### Chiến lược giá — Competitive + Margin

| GPU | Định giá đề xuất | So với thị trường | Mục tiêu |
|-----|-----------------|-------------------|----------|
| **A30** | Entry-point rẻ | Cạnh tranh nhất | Hút SME, startup |
| **H100** | $2–3/giờ | Ngang neo-cloud | Cạnh tranh enterprise |
| **H200** | — | — | — |
| **B300** | — | — | — |

### Pricing model
- **Pay-per-GPU-hour** (reserved) — phù hợp dedicated
- **Savings Plans** — tiered discounts cho enterprise (commit 1/3/6/12 tháng)
- **Batch API discount** — 50% off cho non-real-time workloads

---

## SLIDE 23 · PRODUCT ROADMAP — 24 THÁNG

| Phase | Timeline | Deliverables | KPI |
|-------|----------|-------------|-----|
| **Phase 1: Foundation** | 0–6 tháng | Ra mắt dedicated trên H100/A30; Model catalog cốt lõi; API chuẩn OpenAI-compatible; Portal self-serve | ≥20 model · ≥10 khách hàng pilot |
| **Phase 2: Scale** | 6–12 tháng | Thêm H200/B300; SLA cam kết; BYOM + enterprise onboarding; Data residency certification | ≥50 model · ≥50 khách hàng · 99,9% uptime |
| **Phase 3: Optimize** | 12–24 tháng | Autoscale; Scale-to-zero; AI Agent builder; AI Savings Plans; Multi-region (ASEAN) | ≥100 model · ≥200 khách hàng · 99,95% uptime |

---

## SLIDE 24 · KHUYẾN NGHỊ — MoSCoW

### MUST — Điều kiện tối thiểu để ra mắt
1. **Định vị rõ** "dedicated + always-on + data residency VN" — khác biệt cốt lõi
2. **Pricing competitive** — ngang neo-cloud, entry-point rẻ cho A30
3. **API OpenAI-compatible** — giảm friction tích hợp
4. **Portal self-serve** — deploy model trong ≤5 phút
5. **Model catalog cốt lõi** — ≥20 model (LLM, VLM, TTS)

### SHOULD — Competitive advantage
6. **SLA cam kết** — 99,9% uptime, latency p99 guarantee
7. **BYOM (Bring Your Own Model)** — enterprise onboarding
8. **Data residency certification** — Nghị định 13/2023
9. **Usage & Billing dashboard** — cost transparency
10. **API Keys management** — scoped, rotate, revoke

### COULD — Long-term differentiation
11. **Autoscale** — replicas tự co giãn theo tải
12. **Scale-to-zero** — tiết kiệm chi phí khi idle
13. **AI Agent builder** — managed agents, custom tools
14. **AI Savings Plans** — tiered discounts
15. **Multi-region** — expand to ASEAN

---

## SLIDE 25 · THANK YOU

```
Cảm ơn!
FPT DDI — Dedicated Inference

Always on · No shared capacity · No rate limits · Better suited for serious traffic

01  Phê duyệt định vị
02  Chốt pricing
03  Khởi động Phase 1 (Foundation)

Liên hệ: DDI Team  ·  18/08/2026
```

---

## PHỤ LỤC: So sánh 2 file nguồn

### File 1: "dedicated_inference_Strategic Implementation Roadmap.pptx" (14 slides)
**Nội dung mạnh:**
- Market segments chi tiết (BFSI, Retail, Healthcare, Mid-market)
- User Personas (Minh - BFSI, Linh - Mid-market)
- Customer Journey (6 bước từ Catalog đến Billing)
- Feature List (7 modules)
- Deploy Flow Roadmap (3 phases: MVP, Autoscale, Scale-to-zero)
- Buying triggers & use cases cho từng segment

### File 2: "FPT-DDI-Dedicated-Inference.pptx" (12 slides)
**Nội dung mạnh:**
- Executive Summary (product definition, market size)
- Dedicated vs Serverless comparison
- Market size data (global $117.8B, VN $1B)
- Competitive landscape (Together, Fireworks, Baseten, Lambda)
- Positioning matrix (niche local dedicated)
- Pricing benchmark (GPU/hour)
- SWOT analysis
- Go-to-Market strategy (3 pillars)
- 24-month roadmap
- MoSCoW recommendations

### Điểm trùng (đã hợp nhất)
- Market segments (BFSI, Healthcare, Retail, Mid-market)
- Competitive analysis
- Roadmap
- Pricing strategy
- Target customer strategy

### Điểm bổ sung (đã merge)
- Từ File 1: User Personas, Customer Journey, Feature List, Deploy Flow 3 phases
- Từ File 2: Executive Summary, Dedicated vs Serverless, Market size, Positioning matrix, SWOT, MoSCoW

### Kết quả
**25 slides hoàn chỉnh** — từ Executive Summary → Market Analysis → Competitive Landscape → Customer Segments → User Personas → Product Features → Roadmap → Recommendations.