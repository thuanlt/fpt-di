# BRD — Mở rộng FPT DDI Partner Console với đối tác NVIDIA

**Phiên bản:** 1.0
**Ngày:** 25/08/2026
**Trạng thái:** Draft
**Chủ sở hữu:** Thuan Luu Thi (BA/PO)
**Loại tài liệu:** Business Requirements Document (BRD)

---

## 1. Bối cảnh & mục tiêu kinh doanh

### 1.1 Bối cảnh
FPT DDI (Dedicated Inference) là nền tảng cho phép khách hàng deploy model LLM lên hạ tầng GPU chuyên dụng. Partner Console hiện đã có: quản lý endpoint dedicated, BYOM (bring-your-own-model), batch inference, playground, API key theo scope, monitoring thời gian thực, và cấu hình post-deploy (autoscaling, context length, GPU count, quantization, KV cache, sampling).

Đối tác chiến lược hiện tại là **NVIDIA** — nhà cung cấp hạ tầng GPU (H100, H200, A30, B300) và hệ sinh thái phần mềm (CUDA, Triton, TensorRT-LLM, NeMo, NIM, DGX Cloud).

### 1.2 Mục tiêu chiến lược (SMART)
| # | Mục tiêu | Đo lường | Thời hạn |
|---|----------|----------|----------|
| GO-1 | Mở rộng thị trường sang 4 phân khúc có tiềm năng doanh thu cao | ≥30 khách hàng mới đăng ký từ 4 phân khúc | 6 tháng |
| GO-2 | Thu hút user bằng bộ tính năng theo phân khúc (coding, banking, chứng khoán, bảo hiểm) | ≥50% khách mới dùng ≥1 tính năng theo phân khúc | 6 tháng |
| GO-3 | Tăng doanh thu tái diễn (recurring revenue) | ARPU tăng ≥25%, tỷ lệ giữ chân ≥80% | 12 tháng |
| GO-4 | Tận dụng hệ sinh thái NVIDIA làm lợi thế cạnh tranh | ≥10 tính năng tích hợp NVIDIA (NIM, Triton, NeMo Guardrails, DGX) | 12 tháng |

### 1.3 Đối tượng khách hàng mục tiêu (persona theo phân khúc)

| Phân khúc | Persona | Pain point chính | Nhu cầu cốt lõi |
|-----------|---------|------------------|-----------------|
| **Coding** | Kỹ sư phần mềm, CTO startup, đội DevOps | Code assistant chậm, chi phí token cao, lo rò rỉ mã nguồn | Model code nhanh, latency thấp, data không rời VN |
| **Banking** | Giám đốc CNTT ngân hàng, đội tuân thủ | Tuân thủ NHNN, không xuất dữ liệu khách hàng ra nước ngoài | Inference nội bộ, audit trail, guardrails |
| **Chứng khoán** | Quỹ đầu tư, công ty chứng khoán, nhà phân tích | Cần phân tích thời gian thực, độ trễ thấp, chính xác | Low-latency inference, xử lý số liệu tài chính |
| **Bảo hiểm** | Công ty bảo hiểm, broker, đội underwriting | Định phí, xử lý claim, tuân thủ hợp đồng | Xử lý tài liệu, tự động hóa quy trình, guardrails |

---

## 2. Phạm vi

### 2.1 Trong phạm vi (In scope)
1. **Bộ tính năng theo phân khúc** (segment packs): gói tính năng chuyên biệt cho coding, banking, chứng khoán, bảo hiểm.
2. **Tích hợp hệ sinh thái NVIDIA**: NVIDIA NIM catalog, Triton Inference Server, NeMo Guardrails, TensorRT-LLM optimization, DGX Cloud (roadmap).
3. **Tuân thủ & bảo mật theo ngành**: audit trail, data residency, guardrails, role-based access.
4. **Mô hình định giá theo phân khúc**: pricing pack, commitment, quota.
5. **Dashboard & báo cáo theo phân khúc**: KPI theo ngành.

### 2.2 Ngoài phạm vi (Out of scope — phiên bản 1.0)
1. Training/fine-tuning toàn diện (chỉ hỗ trợ inference + BYOM hiện có).
2. Tích hợp sâu DGX Cloud (roadmap pha 2).
3. Marketplace mở cho bên thứ ba (chỉ catalog NVIDIA + FPT).
4. Mobile app native.

---

## 3. Stakeholders

| Stakeholder | Vai trò | Mối quan tâm |
|-------------|---------|--------------|
| NVIDIA (đối tác) | Cung cấp GPU + phần mềm, đồng marketing | Doanh số GPU, độ phủ thị trường, reference |
| FPT (chủ sở hữu) | Vận hành nền tảng, bán hàng | Doanh thu, margin, giữ chân |
| Khách hàng 4 phân khúc | Người dùng cuối | Chi phí, latency, tuân thủ, dễ dùng |
| Đội phát triển | Triển khai | Yêu cầu rõ ràng, khả thi |
| Đội tuân thủ | Rà soát quy định | Tuân thủ NHNN, PDPA, SBV, ICA |

---

## 4. Yêu cầu kinh doanh (Business Requirements — BR)

> Ký hiệu ưu tiên MoSCoW: **M**=Must, **S**=Should, **C**=Could, **W**=Won't (v1.0)

### BR-01 — Segment Pack: Coding (M)
Nền tảng **phải** cung cấp gói tính năng dành cho nhà phát triển, gồm: model code chuyên dụng (CodeLlama, DeepSeek-Coder, Qwen-Coder), endpoint low-latency, playground code, và chế độ bảo mật mã nguồn (không log prompt chứa mã nguồn).
- **Acceptance:** Khách hàng coding có thể deploy endpoint model code ≤5 phút; latency p95 ≤800ms cho completion ngắn; dữ liệu không rời VN.

### BR-02 — Segment Pack: Banking (M)
Nền tảng **phải** hỗ trợ ngân hàng với: guardrails (NeMo Guardrails), audit trail đầy đủ, data residency trong nước, và chế độ tuân thủ NHNN.
- **Acceptance:** Mọi request/reponse được ghi audit trail không thể sửa; guardrails chặn prompt chứa thông tin định danh cá nhân (PII) theo Nghị định 13/2023/NĐ-CP (PDPA).

### BR-03 — Segment Pack: Chứng khoán (S)
Nền tảng **nên** cung cấp endpoint low-latency cho phân tích tài chính thời gian thực, kèm hỗ trợ xử lý số liệu dạng bảng.
- **Acceptance:** Latency p95 ≤500ms cho inference ngắn; hỗ trợ structured output (JSON schema) cho dữ liệu tài chính.

### BR-04 — Segment Pack: Bảo hiểm (S)
Nền tảng **nên** hỗ trợ xử lý tài liệu bảo hiểm (contract, claim form) với OCR/trích xuất, guardrails, và audit trail.
- **Acceptance:** Trích xuất thông tin hợp đồng với độ chính xác ≥90%; guardrails chặn prompt chứa thông tin y tế nhạy cảm.

### BR-05 — NVIDIA Ecosystem Integration (M)
Nền tảng **phải** tích hợp hệ sinh thái NVIDIA: NVIDIA NIM catalog (deploy model NIM 1-click), Triton Inference Server (hiệu năng), NeMo Guardrails (bảo mật).
- **Acceptance:** ≥10 model NIM deploy được từ catalog; guardrails NeMo hoạt động trên endpoint; hiệu năng cải thiện ≥20% với Triton/TensorRT-LLM.

### BR-06 — Pricing theo phân khúc (M)
Nền tảng **phải** hỗ trợ gói định giá khác nhau theo phân khúc (commitment, quota, burst).
- **Acceptance:** Admin có thể tạo gói giá theo phân khúc; khách thấy giá đúng theo gói đã chọn.

### BR-07 — Dashboard theo phân khúc (S)
Nền tảng **nên** cung cấp dashboard KPI theo phân khúc (usage, cost, latency, compliance status).
- **Acceptance:** Dashboard hiển thị KPI theo phân khúc; xuất được báo cáo CSV.

### BR-08 — Compliance & Audit (M)
Nền tảng **phải** cung cấp audit trail không thể sửa đổi cho mọi hoạt động liên quan dữ liệu nhạy cảm, theo quy định ngành.
- **Acceptance:** Mọi thao tác admin/user được ghi log với timestamp, actor, action; log không thể sửa.

---

## 5. Rủi ro & giả định

### 5.1 Rủi ro
| Rủi ro | Khả năng | Tác động | Giảm thiểu |
|--------|----------|----------|------------|
| Chi phí GPU NVIDIA cao | Cao | Margin thấp | Gói commitment, autoscaling |
| Thay đổi quy định NHNN | Trung bình | Chậm triển khai | Theo dõi sandbox, thiết kế linh hoạt |
| Đối thủ (Together AI, BytePlus) | Cao | Mất thị phần | Tính năng theo phân khúc, data residency |
| Khó tích hợp NIM | Thấp | Chậm release | PoC trước, tài liệu NVIDIA |

### 5.2 Giả định
- A-1: Hạ tầng GPU NVIDIA (H100/H200/A30/B300) có sẵn tại VN.
- A-2: NVIDIA cấp quyền sử dụng NIM/Triton/NeMo theo thỏa thuận đối tác.
- A-3: Khách hàng 4 phân khúc có nhu cầu inference nội bộ (data residency).
- A-4: Quy định sandbox fintech (Nghị định 141/2016/NĐ-CP và các sửa đổi) cho phép thử nghiệm.

---

## 6. KPI & đo lường thành công

| KPI | Baseline | Target (6 tháng) | Nguồn dữ liệu |
|-----|----------|------------------|---------------|
| Số khách hàng mới 4 phân khúc | 0 | ≥30 | Bảng users |
| ARPU | Hiện tại | +25% | Bảng billing |
| Tỷ lệ giữ chân | Hiện tại | ≥80% | Bảng subscription |
| Latency p95 (coding) | — | ≤800ms | Monitoring |
| Số model NIM deploy | 0 | ≥10 | Catalog |
| Doanh thu tái diễn | Hiện tại | +30% | Bảng billing |

---

## 7. Lộ trình (Roadmap)

| Pha | Thời gian | Nội dung |
|-----|-----------|----------|
| **Pha 1** (MVP) | 8-12 tuần | Segment Pack Coding + NVIDIA NIM catalog + Guardrails cơ bản + Audit trail |
| **Pha 2** | 3-6 tháng | Segment Pack Banking + Chứng khoán + Pricing theo phân khúc |
| **Pha 3** | 6-12 tháng | Segment Pack Bảo hiểm + DGX Cloud + Dashboard theo phân khúc |

---

## 8. Tài liệu liên quan
- `docs/srs-nvidia-partner-expansion.md` — Yêu cầu chức năng chi tiết
- `docs/user-stories-nvidia-partner-expansion.md` — User stories & acceptance criteria
- `docs/process-flows-nvidia-partner-expansion.md` — Quy trình (BPMN)
- `docs/data-dictionary-rtm-nvidia-partner-expansion.md` — Data dictionary & RTM
- `docs/competitive-survey-post-deploy-model-config.md` — Khảo sát đối thủ
- `docs/together-ai-endpoints-console-survey.md` — Khảo sát Together AI