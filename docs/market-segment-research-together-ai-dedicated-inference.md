# Nghiên cứu Phân khúc Thị trường — Dedicated Inference của Together AI

**Phiên bản:** 1.0
**Ngày:** 20/08/2026
**Trạng thái:** Draft
**Chủ sở hữu:** Thuan Luu Thi (BA/PO)
**Phạm vi:** Phân tích cách Together AI phân khúc thị trường dedicated inference — theo mô hình triển khai, theo loại khách hàng, theo use case, theo pricing, theo kênh bán và theo vùng địa lý
**Nguồn:** `together.ai/dedicated-model-inference`, `together.ai/customers` (18 case study), `together.ai/pricing`, báo cáo Sacra (08/2026), newsroom IBM (11/08/2026), blog Together Enterprise Platform (02/2026)

---

## 1. Executive Summary

| Câu hỏi | Trả lời |
|---------|---------|
| **Together lớn cỡ nào?** | Revenue ~$1 tỷ (annualized 02/2026), bookings $1.15 tỷ (Q2/2026), valuation $8.3 tỷ (Series C 07/2026), gross margin ~45% |
| **Họ phân khúc thị trường theo trục nào?** | 5 trục: mô hình triển khai (5 tier) × loại khách (AI-native/enterprise/model-provider) × use case (voice/coding/media/healthcare) × pricing × địa lý |
| **Khách hàng dedicated chủ yếu là ai?** | **AI-native startups** (Cursor, Decagon, Pika, Hedra, Dippy) + **enterprise chọn lọc** (Salesforce, Washington Post, Zomato, SCB10X) + **model provider** (Deep Cogito, Arcee, SCB10X) |
| **Use case nào chạy dedicated nhiều nhất?** | Voice AI real-time, coding/agent, generative media (video/image), AI companion — đều là workload **steady traffic + latency-sensitive** |
| **Điểm khác biệt vs FPT DDI?** | Together thắng về **research-backed performance** (ATLAS, Megakernel, CPD) + **ecosystem** (NVIDIA, IBM, YC, AWS Marketplace). FPT thắng về **data residency VN + tiếng Việt + giá rẻ 50%+** |

---

## 2. Quy mô công ty (bối cảnh)

| Chỉ số | Giá trị | Nguồn |
|--------|---------|-------|
| Revenue annualized | **~$1 tỷ** (02/2026), tăng từ ~$618M (cuối 2025) | Sacra |
| Annual bookings | **$1.15 tỷ** (Q2/2026) | Sacra |
| Valuation | **$8.3 tỷ** (Series C 07/2026, $800M, Aramco Ventures) — tăng 2.5x so với $3.3 tỷ | Sacra |
| Tổng funding | ~$1.33 tỷ | Sacra |
| Gross margin | ~45% (sẽ cải thiện khi tự sở hữu GPU) | Sacra |
| Tăng trưởng | 400% y/y (2024) | Sacra |
| Data center | Maryland (07/2025), Memphis (sắp tới), **Sweden (09/2025)** | Sacra |
| Capacity cam kết | **>500 MW** (Series C) | Sacra |

**Cấu trúc doanh thu (2 dòng):**
1. **Per-token API** (serverless) — chiếm **30–40% revenue**, scale theo inference volume
2. **GPU server rental** (dedicated/cluster/training) — **phần lớn còn lại**, nguồn từ CoreWeave/Lambda → ngày càng từ data center tự có

> **Insight:** Dedicated/GPU rental là **bến doanh thu chính** của Together, không phải serverless. Điều này xác nhận dedicated là phân khúc họ đầu tư mạnh nhất — đúng đối thủ trực tiếp của FPT DDI.

---

## 3. Phân khúc theo mô hình triển khai (5 tier)

Together chia thị trường inference thành **5 tier** theo mức độ kiểm soát hạ tầng + cam kết capacity. Đây là trục phân khúc **quan trọng nhất** — mỗi tier nhắm một nhóm nhu cầu khác nhau.

| Tier | Đơn vị giá | Capacity | SLA | Nhắm vào | Kênh |
|------|-----------|----------|-----|----------|------|
| **1. Serverless** | Per-token | Shared, best-effort | Không | Traffic biến động, prototype, early-stage | Self-serve |
| **2. Provisioned Throughput (PTU)** | Per PTU ($0.05/PTU/min) | Reserved token capacity | **≥99% uptime** | Production cần reliability + predictable pricing | **Contact sales** |
| **3. Dedicated Model Inference (DMI)** | Per GPU-hour (H100 $5.49, B200 $8.99) | Reserved, isolated GPU | — | **Steady traffic, latency-sensitive, high-throughput** | Self-serve + sales |
| **4. Dedicated Container Inference** | Contact sales | Fully-managed, scalable | — | Generative media, non-standard runtime, custom pipeline | **Contact sales** |
| **5. GPU Clusters** | Per GPU-hour (H100 $1.76–2.39, B200 $4.00–5.50) | Bare-metal, multi-node | — | Training, custom inference engine, model provider | Self-serve + sales |

**Logic phân tầng (từ docs):**
- **Serverless** = "I want to serve open models với OpenAI-compatible API, không cần nghĩ về GPU"
- **PTU** = production cần SLA + giá dự đoán được, nhưng chưa cần kiểm soát hardware
- **DMI** = steady/serious traffic, cần latency ổn định + chạy fine-tuned model + rẻ hơn serverless ở utilization cao
- **Container** = khách có engine/model riêng (media pipeline, runtime không chuẩn)
- **Clusters** = khách tự vận hành (training, custom engine)

> **Insight cho FPT:** FPT DDI hiện chỉ có **tier 3 (DMI)**. Together đã phủ cả 5 tier — khách "tốt nghiệp" từ serverless → PTU → DMI → container đều ở lại hệ sinh thái Together. FPT cần roadmap PTU (tier 2) và container (tier 4) để không mất khách khi họ scale.

---

## 4. Phân khúc theo loại khách hàng

Từ 18 customer stories, nhóm khách dedicated của Together chia thành **3 nhóm rõ rệt**:

### 4.1 AI-native Startups (nhóm lớn nhất)

Đặc điểm: sản phẩm AI là core business, traffic tăng nhanh, nhạy latency, cần cost-efficient ở scale.

| Khách | Use case | Kết quả đạt được |
|-------|----------|------------------|
| **Cursor** | Coding assistant real-time | 72 GPU GB200 NVL72, low-latency at scale |
| **Decagon** | Voice AI (customer service) | **6× giảm cost/turn**, p95 <400ms, deploy model hàng tuần |
| **Pika** | Video generation | Scale training + inference cho cộng đồng creator |
| **Hedra** | Viral AI video | **60% cost savings**, scale qua traffic surge |
| **Dippy AI** | AI companion | **4M tokens/phút**, median TTFT 0.4s |
| **Yutori** | Browser-use AI agent | 2× faster inference |
| **Vercept** | Computer-use AI (VyUI) | **11× faster inference**, ~30% cost savings |
| **Krea** | Image/video generation | Real-time high-quality at scale |
| **Runware** | Generative video/image API | 5–10× vs đối thủ |
| **HeroUI / LegionEdge** | Code sandbox / prototyping | 10× faster launch / 3 tháng nhanh hơn |

> **Insight:** Nhóm này là **engine tăng trưởng** của Together. Họ vào bằng self-serve, scale nhanh, và là nguồn case study. FPT DDI muốn bắt nhóm này cần **portal self-serve + free trial + deploy <5 phút** (đúng MoSCoW MUST của FPT).

### 4.2 Enterprise (chọn lọc, ARR lớn)

Đặc điểm: cần compliance, privacy, scale ổn định, mua qua sales/RFP.

| Khách | Ngành | Kết quả đạt được |
|-------|-------|------------------|
| **Salesforce** | Enterprise software | ~33% cost savings, 2× latency reduction |
| **The Washington Post** | Media | 2s response time, "AI independence", strict privacy |
| **Zomato** | Food-tech / CSKH | 2× CSAT score, scale >1.000 messages/phút |
| **SCB10X** (Siam Commercial Bank) | **Tài chính (Thái Lan)** | 50% cloud savings, model tiếng Thái |

> **Insight:** Enterprise của Together thiên về **media, fintech, customer service** — không phải ngân hàng VN. SCB10X (ngân hàng Thái) là evidence rằng Together có thể bán dedicated cho **ngân hàng châu Á** — đây là warning signal cho FPT: cùng phân khúc BFSI, Together đã có chân ở SEA.

### 4.3 Model Provider / Research (nhóm đặc thù)

Đặc điểm: tự train model, cần GPU scale + inference engine tối ưu để serve model của mình.

| Khách | Hoạt động | Kết quả |
|-------|-----------|---------|
| **Deep Cogito** | Train + deploy frontier reasoning model | <500ms TTFT |
| **Arcee AI** | Serve model riêng (migrates từ AWS) | **95% faster TTFT** trên dedicated |
| **Scaled Cognition** | Train APT-1 | ~3 tháng time saved |
| **Latent Health** | Clinical AI training | 7× training cost efficiency |
| **SCB10X** | Thai language model | Purpose-built infra |

> **Insight:** Đây là nhóm **chạy GPU Clusters + DMI** — họ không mua "inference API" mà mua **năng lực serve model tự có**. FPT Phase 2 (BYOM + GPU clusters) cần nhắm nhóm này để khác hóa.

---

## 5. Phân khúc theo Use Case

Gom từ 18 case study, 5 use case chạy dedicated nhiều nhất:

| Use case | Đại diện | Yêu cầu kỹ thuật | Vì sao cần dedicated |
|----------|----------|------------------|----------------------|
| **Voice AI real-time** | Decagon, Cartesia (90ms), Dippy | End-to-end <500ms, p95 <400ms | Latency bar cao nhất — shared không đáp ứng |
| **Coding / Agent** | Cursor, Scaled Cognition, Yutori | High-throughput, low-latency, scale lớn | Traffic spiky + cần throughput ổn định |
| **Generative media (video/image)** | Pika, Hedra, Krea, Runware | GPU scale, burst traffic, custom pipeline | Viral traffic surge + pipeline không chuẩn |
| **Customer support / CSKH** | Zomato, Decagon | High concurrency, 24/7 | >1.000 msg/phút, cần SLA |
| **Clinical / Healthcare** | XY.AI, Latent Health, Slingshot | HIPAA, BAA, accuracy | Compliance bắt buộc + dedicated VPC |

> **Insight:** 4/5 use case là **steady + latency-sensitive** — đúng định nghĩa "serious traffic" của dedicated. FPT nên dùng 5 use case này làm **blueprint demo** khi bán cho khách VN (CSKH, voice, recommendation, clinical note).

---

## 6. Phân khúc theo Pricing

| Phân khúc giá | Product | Đối tượng | Logic |
|---------------|---------|-----------|-------|
| **Entry / cost-sensitive** | Serverless + Batch API (-50%) | Startup, batch workload | Batch = lấp GPU giờ thấp điểm, biến chi phí chìm thành doanh thu |
| **Mid / production** | PTU ($0.05/PTU/min) | Production cần SLA | Cam kết TPM + SLA 99% — predictable pricing |
| **Premium / control** | DMI (H100 $5.49/hr) | Serious traffic, fine-tuned model | Rẻ hơn serverless ở utilization cao, full control |
| **Bare-metal / max control** | GPU Clusters (H100 $1.76–2.39/hr) | Model provider, training | Rẻ nhất/GPU, khách tự vận hành |

**Điểm đáng chú ý:**
- **Batch API -50%** (launch 06/2025): 50.000 requests/batch, best-effort 24h — tier giá rẻ cho workload không real-time
- **Reserved < On-demand**: cam kết dài hạn được chiết khấu (giữ chân enterprise)
- **No rate limits** được bán như **giá trị cộng thêm**, không phải giảm giá

> **Insight cho FPT:** FPT đã có "Batch API -50%" trong MoSCoW (slide 22) — **đúng hướng** với Together. FPT nên thêm **PTU tier** (cam kết TPM + SLA) làm cầu nối giữa serverless và DMI, vì đây là nơi enterprise "bẫy" khách bằng predictable pricing.

---

## 7. Phân khúc theo Kênh bán (GTM)

| Kênh | Nhắm vào | Bằng chứng |
|------|----------|-----------|
| **Self-serve portal** | AI-native startup, developer | "Get started" → `api.together.ai/endpoints`, deploy trong phút |
| **Contact sales** | Enterprise, PTU, container, reserved | "Talk to Sales", "Contact Sales" cho PTU/container |
| **Hợp tác hạ tầng** | Enterprise + ecosystem | **IBM $240M** (NVIDIA AI infra trên IBM Cloud, 08/2026), **AWS Marketplace**, **NVIDIA Preferred Partner** |
| **Hợp tác ecosystem** | Startup ecosystem | **Y Combinator** — "first dedicated YC GPU cluster" |
| **Enterprise Platform** | Enterprise đa môi trường | "Run GenAI securely in any environment, 2× faster" (02/2026) |

> **Insight:** Together chạy **hai đường vào song song** — self-serve cho startup + sales/partnership cho enterprise. FPT DDI cũng đang làm y hệt (slide 9: "Hai chuyển động bán hàng song song"). Điểm khác: Together có **IBM + AWS Marketplace + YC** làm kênh — FPT cần tìm đối tác tương đương tại VN (FPT IS, Viettel, NVIDIA VN).

---

## 8. Phân khúc theo Địa lý

| Vùng | Trạng thái | Ý nghĩa |
|------|-----------|---------|
| **Mỹ** | Maryland (07/2025), Memphis (sắp tới) | Core market, >500 MW cam kết |
| **Châu Âu** | **Sweden (09/2025)** — giảm 50–70ms latency; kế hoạch Pháp/UK/Ý/Bồ Đào Nha (100K GPU Blackwell đến 2028) | **Data residency EU** — phục vụ yêu cầu EU |
| **Châu Á - Thái Bình Dương** | **Chưa có region** | **Khoảng trống — cơ hội FPT** |

> **Insight:** Together mở rộng địa lý theo **data residency** (EU → Sweden). Đây là **chứng minh mô hình "dedicated + data residency" bán được** — chính là chiến lược của FPT với VN. Nhưng Together **chưa có APAC** → FPT có cửa chiếm giữ VN + ASEAN trước khi họ vào.

---

## 9. Compliance & Security (yếu tố phân khúc enterprise)

| Cam kết | Chi tiết |
|---------|----------|
| **Single-tenant** | Mỗi deployment chạy trên GPU isolated riêng — traffic/data không bao giờ chia sẻ |
| **Data ownership** | Prompt + model weights do khách kiểm soát; **Together không train trên data khách** |
| **Data residency** | Chọn region khi deploy |
| **Chứng chỉ** | **SOC 2 Type II**, **ISO 27001:2022** |
| **Voice platform** | **HIPAA**, zero data retention, dedicated data residency |

> **Insight:** Compliance là **cửa vào enterprise** — 90% vendor bị loại ở vòng HIPAA/BAA (theo deck FPT slide 14). Together có SOC 2 + ISO 27001 + HIPAA. **FPT cần chốt compliance pack (BAA/SOC2) trước Phase 1** — deck FPT đã ghi nhận gap này ở slide 20.

---

## 10. Implications cho FPT DDI

### 10.1 Điểm FPT nên học từ Together

| # | Bài học | Hành động cho FPT |
|---|---------|-------------------|
| 1 | **Phủ 5 tier deployment** (serverless→PTU→DMI→container→cluster) | Roadmap thêm **PTU** (Phase 2) + **Dedicated Container** (Phase 3) để giữ khách khi scale |
| 2 | **Batch API -50%** lấp giờ thấp điểm | Giữ trong MoSCoW — đúng hướng, làm Phase 2 |
| 3 | **5 use case blueprint** (voice/coding/media/CSKH/clinical) | Dùng làm demo + case study khi bán cho khách VN |
| 4 | **Research-backed performance** (ATLAS 3.18×, Megakernel 3.6×, CPD +40%) | FPT cần có ít nhất 1–2 optimization "wow" để cạnh tranh hiệu năng, không chỉ giá |
| 5 | **Hai kênh song song** (self-serve + sales/partnership) | Đã đúng — bổ sung đối tác VN (FPT IS, Viettel, NVIDIA VN) thay cho IBM/AWS/YC |
| 6 | **Data residency làm trục mở rộng địa lý** | Mở rộng VN → ASEAN theo model của Together (EU→Sweden) |

### 10.2 Lợi thế FPT mà Together KHÔNG có

| # | Lợi thế | Bằng chứng |
|---|---------|-----------|
| 1 | **Data residency VN** (NĐ 13/2023) | Together chưa có APAC — FPT độc chiếm VN |
| 2 | **Model tiếng Việt** (FPT.AI) | Together chỉ có SCB10X (tiếng Thái) — không có tiếng Việt |
| 3 | **Giá rẻ 50%+** (H100 $2–3/hr vs $5.49/hr) | Cùng dedicated, một nửa giá |
| 4 | **Local support 24/7** | Latency thấp + hỗ trợ tại chỗ cho VN |

### 10.3 Warning signals cần theo dõi

| # | Tín hiệu | Rủi ro cho FPT |
|---|----------|----------------|
| 1 | **SCB10X** (ngân hàng Thái) đã dùng Together | Cùng phân khúc BFSI — Together đã có chân ở SEA |
| 2 | **Mở rộng EU** theo data residency | Mô hình "dedicated + residency" được chứng minh — Together sẽ nhân bản sang APAC |
| 3 | **IBM $240M + AWS Marketplace** | Enterprise reach của Together rất rộng — FPT cần đối tác enterprise VN tương đương |
| 4 | **Valuation $8.3 tỷ + 500 MW** | Together có vốn mở rộng nhanh — FPT cần chiếm giữ VN trước |

---

## 11. Nguồn

- `https://www.together.ai/dedicated-model-inference` (product page, 08/2026)
- `https://www.together.ai/customers` (18 customer stories, 08/2026)
- `https://www.together.ai/pricing` (pricing, 08/2026)
- `https://sacra.com/c/together-ai/` (revenue, valuation, business model, 08/2026)
- `https://newsroom.ibm.com/2026-08-11-IBM-and-Together-AI-Sign-Multi-Year-Agreement...` (IBM partnership)
- `https://www.together.ai/blog/introducing-the-together-enterprise-platform` (02/2026)
- `https://www.together.ai/blog/together-yc-gpu-cluster` (YC partnership)

> **Lưu ý:** Số liệu revenue/valuation từ Sacra là **ước tính** (estimate), không phải báo cáo kiểm toán. Số liệu giá + model lấy từ nguồn công khai 08/2026, có thể thay đổi. Xác minh lại trước khi trình bày chính thức.