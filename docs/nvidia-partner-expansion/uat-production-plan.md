# UAT Production — Kế hoạch kiểm thu hạ tầng inference thật

**Phiên bản:** 1.0
**Ngày:** 25/08/2026
**Trạng thái:** Draft
**Chủ sở hữu:** Thuan Luu Thi (BA/PO)
**Loại tài liệu:** UAT (User Acceptance Testing) Plan
**Liên quan:** `production-readiness-gpu-inference.md`, `k8s-architecture.md`, `adr-engine-inference.md`

> Kế hoạch kiểm thu (UAT) cho hạ tầng inference GPU thật — xác nhận hệ thống đạt chuẩn production trước khi go-live.

---

## 1. Mục tiêu UAT

Xác nhận FPT DDI inference GPU thật đáp ứng:
- **FR-INT-001..005** (worker, vLLM/Triton/TRT, NeMo, OCR, DGX) hoạt động đúng.
- **NFR-PERF-001/002** (latency, throughput) đạt target.
- **NFR-SEC-001** (guardrails) chặn đúng.
- **NFR-AVAIL-001** (99.9%) — test resilience.
- **Data residency** — data không rời VN.

**Tiêu chí go-live:** 100% test P0 pass, ≥95% test P1 pass, không có defect Blocker/Major.

---

## 2. Phạm vi UAT

| Trong phạm vi | Ngoài phạm vi |
|---------------|---------------|
| Deploy endpoint GPU thật | Marketing/sales |
| Inference vLLM/Triton/TRT | Billing thực tế (chỉ mock) |
| Guardrails NeMo | Mobile app |
| Document extraction OCR | Multi-region DR |
| Performance benchmark | Training/fine-tuning |
| Resilience (failover) | |

---

## 3. Môi trường UAT

| Hạng mục | Yêu cầu |
|----------|---------|
| GPU | ≥2× H100 (hoặc A30) trên k8s |
| GPU Operator | Đã cài, DCGM exporter chạy |
| NGC access | Pull NIM được |
| Data center | VN |
| Network | 100GbE (inter-node) |
| Monitoring | Prometheus + Grafana + DCGM |

---

## 4. Test scenarios

### 4.1 Functional (P0)

| TC | Scenario | Expected | Priority |
|----|----------|----------|----------|
| UAT-F-01 | Deploy endpoint vLLM thật | Endpoint running, invoke trả về token thật | P0 |
| UAT-F-02 | Deploy endpoint TensorRT-LLM | Engine compile + serve, latency thấp | P0 |
| UAT-F-03 | Deploy endpoint Triton | Multi-model serve đúng | P0 |
| UAT-F-04 | Guardrails PII (banking) | Số TK/TCCD bị mask | P0 |
| UAT-F-05 | Guardrails injection | Prompt injection bị chặn | P0 |
| UAT-F-06 | Document OCR (insurance) | Extract fields đúng, redact medical | P0 |
| UAT-F-07 | Structured output (securities) | JSON đúng schema | P0 |
| UAT-F-08 | Auth + role (admin/operator/viewer) | Enforce đúng | P0 |
| UAT-F-09 | Audit log | Ghi đầy đủ action | P0 |
| UAT-F-10 | Pricing + quota | 429 khi vượt quota | P0 |

### 4.2 Performance (P0)

| TC | Scenario | Expected | Priority |
|----|----------|----------|----------|
| UAT-P-01 | Latency p95 coding | ≤800ms | P0 |
| UAT-P-02 | Latency p95 securities | ≤500ms (TensorRT-LLM) | P0 |
| UAT-P-03 | Throughput +20% (TRT vs vLLM) | TRT ≥ vLLM × 1.2 | P0 |
| UAT-P-04 | Time-to-first-token | ≤500ms | P1 |
| UAT-P-05 | GPU memory utilization | ≤90% | P1 |
| UAT-P-06 | Load test (100 concurrent) | Không crash, p95 trong target | P1 |

### 4.3 Resilience (P1)

| TC | Scenario | Expected | Priority |
|----|----------|----------|----------|
| UAT-R-01 | Kill 1 GPU node | Traffic failover, không mất request | P1 |
| UAT-R-02 | GPU OOM | Pod restart, không mất data | P1 |
| UAT-R-03 | NGC down | Fallback image cached | P1 |
| UAT-R-04 | Postgres failover | Recovery <30s | P1 |
| UAT-R-05 | GPU temperature >85°C | Throttle + alert | P1 |

### 4.4 Security (P0)

| TC | Scenario | Expected | Priority |
|----|----------|----------|----------|
| UAT-S-01 | Data residency | Data không rời VN | P0 |
| UAT-S-02 | Network policy | GPU pod chỉ nhận traffic backend | P0 |
| UAT-S-03 | Secret management | API key/NGC token không leak | P0 |
| UAT-S-04 | Image scan | Không vulnerability critical | P1 |
| UAT-S-05 | RBAC | Worker không delete endpoint | P0 |

### 4.5 Operations (P1)

| TC | Scenario | Expected | Priority |
|----|----------|----------|----------|
| UAT-O-01 | Monitoring dashboard | GPU + inference metrics hiển thị | P1 |
| UAT-O-02 | Alert (GPU util >90%) | Alert trigger đúng | P1 |
| UAT-O-03 | Autoscaling (HPA) | Scale up khi util >70% | P1 |
| UAT-O-04 | Canary deploy | 10% → 100% đúng | P1 |
| UAT-O-05 | Rollback | Tự động khi error >1% | P1 |

---

## 5. Entry / Exit criteria

### Entry criteria (điều kiện vào UAT)
- [ ] Hạ tầng GPU sẵn sàng (k8s + GPU Operator + NGC).
- [ ] Worker thật + vLLM/Triton/TRT đã deploy.
- [ ] Monitoring (Prometheus+Grafana+DCGM) chạy.
- [ ] Môi trường UAT ổn định ≥24h.

### Exit criteria (điều kiện go-live)
- [ ] 100% test P0 pass.
- [ ] ≥95% test P1 pass.
- [ ] Không có defect Blocker/Major mở.
- [ ] Performance đạt target (latency, throughput).
- [ ] Data residency xác nhận.
- [ ] Runbook vận hành hoàn tất.
- [ ] Stakeholder sign-off.

---

## 6. Defect severity & SLA

| Severity | Định nghĩa | SLA fix |
|----------|-----------|---------|
| Blocker | Hệ thống không chạy, mất data | 4 giờ |
| Major | Tính năng chính lỗi, không có workaround | 24 giờ |
| Minor | Tính năng phụ lỗi, có workaround | 3 ngày |
| Trivial | Cosmetic, không ảnh hưởng chức năng | 1 sprint |

---

## 7. Vardata / test data

| Dữ liệu | Nguồn | Ghi chú |
|---------|-------|---------|
| Model NIM | NGC | DeepSeek-Coder, Llama-3.3-70B, Qwen-Coder |
| Document mẫu | Nhân tạo | Hợp đồng, hóa đơn, hồ sơ bảo hiểm (medical redact) |
| Prompt mẫu | Nhân tạo | Per phân khúc (coding/banking/securities/insurance) |
| API keys | Tạo UAT | admin/operator/viewer |

**Lưu ý:** Không dùng data thật của khách hàng — chỉ data nhân tạo/masked.

---

## 8. Lịch UAT (đề xuất)

| Tuần | Hoạt động |
|------|-----------|
| Tuần 1 | Environment setup + smoke test |
| Tuần 2 | Functional UAT (P0) |
| Tuần 3 | Performance + Security UAT |
| Tuần 4 | Resilience + Operations UAT |
| Tuần 5 | Defect fix + re-test + sign-off |

---

## 9. Roles & responsibilities

| Vai trò | Trách nhiệm |
|---------|-------------|
| BA/PO (Thuan Luu Thi) | Approve test case, sign-off |
| QA | Thực thi UAT, báo cáo defect |
| MLOps | Setup hạ tầng GPU, engine |
| Dev | Fix defect |
| Security | Xác nhận security test |

---

## 10. Deliverables
- UAT test report (kết quả từng TC).
- Defect log.
- Performance benchmark report.
- Go/No-Go recommendation.
- Sign-off document.