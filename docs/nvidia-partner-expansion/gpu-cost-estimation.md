# Ước tính chi phí GPU — Hạ tầng inference FPT DDI

**Phiên bản:** 1.0
**Ngày:** 25/08/2026
**Trạng thái:** Draft
**Chủ sở hữu:** Thuan Luu Thi (BA/PO)
**Loại tài liệu:** Cost Estimation / Business Case
**Liên quan:** `production-readiness-gpu-inference.md`, `brd-nvidia-partner-expansion.md`

> Ước tính chi phí hạ tầng GPU để chạy inference thật. Con số là **ước tính tham khảo** (thị trường GPU biến động) — cần xác nhận giá thực tế từ NVIDIA/FPT khi procurement.

---

## 1. Giả định

| Giả định | Giá trị |
|----------|---------|
| Loại GPU chính | H100 SXM (80GB) — flagship inference |
| GPU phụ | A30 (24GB) — endpoint nhỏ/low-cost |
| Số node GPU (MVP) | 4 node × 2 GPU = 8 GPU |
| Số node GPU (Scale) | 8 node × 4 GPU = 32 GPU |
| Model GPU | Mua (CAPEX) hoặc Thuê (OPEX) |
| Thời gian khấu hao | 3 năm (36 tháng) |
| Data center | VN (điện, cooling, rack) |

---

## 2. Chi phí mua GPU (CAPEX)

### 2.1 Giá tham khảo thị trường (2026)
| GPU | Giá/mỗi card (USD) | Ghi chú |
|-----|---------------------|---------|
| H100 SXM 80GB | $25,000 – $30,000 | Flagship, khan hiếm |
| H200 141GB | $30,000 – $35,000 | Mới, memory lớn |
| A30 24GB | $8,000 – $12,000 | Low-cost inference |
| B300 (Blackwell) | $40,000+ | Thế hệ mới |

### 2.2 Chi phí cluster MVP (8 GPU H100)
| Hạng mục | Đơn giá (USD) | Số lượng | Thành tiền (USD) |
|----------|---------------|----------|------------------|
| GPU H100 SXM | 27,500 | 8 | 220,000 |
| Server GPU (dual GPU) | 40,000 | 4 | 160,000 |
| Network 100GbE (switch, cable) | 15,000 | 1 | 15,000 |
| Storage NVMe (10TB/node) | 2,000 | 4 | 8,000 |
| **Tổng CAPEX MVP** | | | **≈ 403,000** |

### 2.3 Chi phí cluster Scale (32 GPU H100)
| Hạng mục | Đơn giá (USD) | Số lượng | Thành tiền (USD) |
|----------|---------------|----------|------------------|
| GPU H100 SXM | 27,500 | 32 | 880,000 |
| Server GPU (quad GPU) | 150,000 | 8 | 1,200,000 |
| Network 100GbE (spine-leaf) | 60,000 | 1 | 60,000 |
| Storage NVMe (10TB/node) | 2,000 | 8 | 16,000 |
| **Tổng CAPEX Scale** | | | **≈ 2,156,000** |

### 2.4 Chi phí khấu hao / tháng
| Cluster | CAPEX (USD) | /36 tháng | /tháng (USD) |
|---------|-------------|-----------|--------------|
| MVP (8 GPU) | 403,000 | 11,194 | ≈ 11,200 |
| Scale (32 GPU) | 2,156,000 | 59,889 | ≈ 59,900 |

---

## 3. Chi phí vận hành hàng tháng (OPEX)

### 3.1 Data center (VN)
| Hạng mục | Chi phí/tháng (USD) |
|----------|---------------------|
| Điện (8 GPU × 700W × 24h × 30 ngày × $0.12/kWh) | ≈ 4,400 |
| Cooling | ≈ 1,500 |
| Rack space (4 rack) | ≈ 2,000 |
| Network bandwidth | ≈ 1,000 |
| **Tổng DC MVP/tháng** | **≈ 8,900** |

### 3.2 Nhân sự vận hành
| Vai trò | Số lượng | Chi phí/tháng (USD) |
|---------|----------|---------------------|
| MLOps Engineer (GPU/k8s) | 2 | 6,000 |
| DevOps/SRE | 1 | 4,500 |
| **Tổng nhân sự/tháng** | | **≈ 10,500** |

### 3.3 Tổng OPEX MVP/tháng
| Hạng mục | USD/tháng |
|----------|-----------|
| Data center | 8,900 |
| Nhân sự | 10,500 |
| License phần mềm (monitoring, registry) | 1,500 |
| **Tổng OPEX MVP** | **≈ 20,900** |

---

## 4. Chi phí thuê GPU (OPEX-only — alternative)

Nếu không mua GPU, thuê từ cloud (DGX Cloud / hyperscaler):

| Nguồn | Giá H100/giờ (USD) | Ghi chú |
|-------|---------------------|---------|
| NVIDIA DGX Cloud | $3.30 – $4.00 | Pay-per-use |
| AWS (p5) | $9.00 – $12.00 | |
| GCP (a3) | $8.00 – $11.00 | |
| Azure (ND H100) | $8.00 – $10.00 | |

### Chi phí thuê 8 GPU H100 chạy 24/7
| Nguồn | /giờ | /tháng (730h) |
|-------|------|---------------|
| DGX Cloud | $26.40 – $32.00 | $19,300 – $23,400 |
| AWS p5 | $72 – $96 | $52,600 – $70,100 |
| GCP a3 | $64 – $88 | $46,700 – $64,200 |

→ **DGX Cloud rẻ nhất** cho thuê GPU, phù hợp spike/thử nghiệm.

---

## 5. So sánh Buy vs Rent (MVP 8 GPU)

| Tiêu chí | Mua (CAPEX) | Thuê DGX Cloud (OPEX) |
|----------|-------------|------------------------|
| Chi phí tháng đầu | 403,000 (một lần) + 20,900 | ≈ 21,000 |
| Chi phí 12 tháng | 403,000 + 250,800 = **653,800** | ≈ 252,000 |
| Chi phí 36 tháng | 403,000 + 752,400 = **1,155,400** | ≈ 756,000 |
| Sở hữu GPU | Có | Không |
| Data residency | Kiểm soát (VN) | Phụ thuộc region |
| Phù hợp | Tải ổn định, banking/insurance | Spike, thử nghiệm |

**Break-even point:** ~18 tháng (mua rẻ hơn thuê sau 18 tháng sử dụng liên tục).

---

## 6. Khuyến nghị theo phân khúc

| Phân khúc | Khuyến nghị | Lý do |
|-----------|-------------|-------|
| **Banking / Insurance** | **Mua GPU on-prem (VN)** | Data residency, PDPA, chi phí ổn định |
| **Coding** | **Mua + DGX Cloud (spike)** | Tải ổn định + peak giờ cao điểm |
| **Securities** | **Mua GPU (TensorRT-LLM)** | Latency thấp, tải ổn định |
| **Thử nghiệm / PoC** | **Thuê DGX Cloud** | Không đầu tư lớn, scale nhanh |

---

## 7. KPI tài chính

| KPI | Target |
|-----|--------|
| GPU utilization | ≥60% (tránh lãng phí) |
| Cost per 1M tokens | Giảm ≥20% năm đầu (quá commit) |
| Revenue per GPU/tháng | ≥ $5,000 (MVP) |
| Payback period (mua GPU) | ≤ 24 tháng |

---

## 8. Rủi ro chi phí

| Rủi ro | Tác động | Giảm thiểu |
|--------|----------|------------|
| Giá GPU tăng | CAPEX tăng | Đặt trước, lock giá |
| GPU khan hiếm (H100) | Trễ hạ tầng | Đa dạng nguồn, fallback A30 |
| Utilization thấp | Lãng phí | Autoscaling, multi-tenant |
| Điện tăng | OPEX tăng | Optimized cooling, PUE thấp |

---

## 9. Lưu ý
- Con số là **ước tính tham khảo** — cần xác nhận giá thực tế từ NVIDIA/FPT/data center VN khi procurement.
- Giá GPU biến động theo thị trường — cập nhật định kỳ.
- Chi phí nhân sự có thể thay đổi theo mức lương thị trường VN.