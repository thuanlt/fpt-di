# Kế hoạch nối inference thật trên hạ tầng GPU FPT

**Phiên bản:** 1.0
**Ngày:** 25/08/2026
**Trạng thái:** Draft
**Chủ sở hữu:** Thuan Luu Thi (BA/PO)
**Loại tài liệu:** Production-Readiness Plan / Technical Integration Plan
**Liên quan:** `implementation-plan-phase1.md`, `implementation-plan-phase2.md`, `implementation-plan-phase3.md`

> Tài liệu này định nghĩa **yêu cầu hạ tầng + tích hợp** để chuyển FPT DDI từ preview (mô phỏng GPU) sang **inference thật** trên cluster GPU NVIDIA của FPT. Đây là tài liệu BA — mô tả WHAT cần làm, không phải code.

---

## 1. Hiện trạng & khoảng cách

### 1.1 Hiện trạng (preview)
| Lớp | Trạng thái | Ghi chú |
|-----|-----------|---------|
| Nền tảng ứng dụng (API, auth, guardrails, audit, pricing, dashboard, documents) | **Thật** | Chạy trên Postgres/Redis thật |
| Lifecycle endpoint (queued→deploying→running) | **Mô phỏng** | Worker dùng delay, không deploy thật |
| GPU | **Không có** | Preview pod không có NVIDIA GPU |
| Deploy NIM | **Mô phỏng** | Không pull container NIM từ NGC |
| Inference | **Mock** | vllm-adapter sinh text giả (reversed prompt + noise) |
| TensorRT-LLM | **Mô phỏng** | Số throughput giả lập |
| OCR tài liệu | **Mock** | Extraction giả lập |

### 1.2 Khoảng cách cần lấp (Gap)
| # | Gap | Tác động | Ưu tiên |
|---|-----|----------|---------|
| G-1 | Không có cluster k8s + GPU NVIDIA | Không deploy endpoint thật | Must |
| G-2 | Worker mô phỏng, không apply manifest thật | Endpoint không chạy thật | Must |
| G-3 | vllm-adapter là mock, không phải vLLM thật | Inference không thật | Must |
| G-4 | Không có quyền NGC để pull NIM | Không deploy NIM thật | Must |
| G-5 | Không có Triton/TensorRT-LLM thật | Không tối ưu hiệu năng thật | Should |
| G-6 | Không có API key NVIDIA DGX Cloud | Không dùng DGX Cloud | Could |
| G-7 | OCR mock, không OCR thật | Trích xuất tài liệu không thật | Should |

---

## 2. Yêu cầu hạ tầng (Infrastructure Requirements)

### 2.1 Cluster Kubernetes + GPU (FR-INFRA-001, Must)
Hệ thống **phải** có cluster k8s với node GPU NVIDIA để chạy endpoint inference.

**Yêu cầu cụ thể:**
- **GPU:** ≥4 node, mỗi node ≥2 GPU (H100/H200/A30/B300) — đủ cho MVP.
- **Kubernetes:** v1.28+, có **NVIDIA GPU Operator** (device plugin, container toolkit).
- **Storage:** PersistentVolume cho model weights (NVMe SSD, ≥10TB).
- **Network:** bandwidth ≥100GbE giữa các node GPU (cho tensor parallel).
- **Data residency:** cluster đặt tại data center **Việt Nam** (HAN/SGN) — yêu cầu bắt buộc cho banking/insurance.

**Acceptance:**
- `kubectl get nodes` hiển thị node có `nvidia.com/gpu` allocatable.
- Deploy 1 pod yêu cầu 1 GPU → pod chạy được, `nvidia-smi` trong pod thấy GPU.

### 2.2 NVIDIA GPU Operator & drivers (FR-INFRA-002, Must)
- **NVIDIA driver** ≥535 trên mọi node GPU.
- **NVIDIA Container Toolkit** + **GPU Operator** cài đặt, version tương thích.
- **CUDA** ≥12.2 trên node.

**Acceptance:** Pod chạy được image có CUDA, truy cập GPU.

### 2.3 NVIDIA NGC access (FR-INFRA-003, Must)
- Tài khoản **NVIDIA NGC** với quyền pull container NIM.
- API key NGC lưu trong **secret manager** (không hardcode).
- Pull container NIM: `nvcr.io/nim/<model>:<version>`.

**Acceptance:** `docker pull nvcr.io/nim/llama3-70b-instruct:25.02` thành công.

### 2.4 Model registry & storage (FR-INFRA-004, Should)
- Registry nội bộ (Harbor/ECR) để cache image NIM + model weights.
- Storage object (S3/MinIO) cho weights BYOM.

### 2.5 Monitoring & observability (FR-INFRA-005, Should)
- **Prometheus + Grafana** cho GPU metrics (utilization, memory, temperature).
- **DCGM** (Data Center GPU Manager) exporter.
- Alert khi GPU OOM, nhiệt độ cao, utilization bất thường.

---

## 3. Tích hợp inference thật (Integration Requirements)

### 3.1 Worker deploy thật (FR-INT-001, Must)
Thay worker mô phỏng bằng worker deploy thật lên k8s.

**Hành vi mới:**
- Khi endpoint `queued` → worker tạo **k8s manifests** (Deployment/StatefulSet + Service + Ingress) cho model.
- Apply manifest lên cluster (qua k8s API).
- Poll pod status: `Pending → Running → Ready`.
- Khi pod ready (health check pass) → endpoint `running`.
- Khi pod fail → endpoint `failed` + ghi audit.

**Yêu cầu:**
- Worker **phải** dùng k8s client thật (không delay simulation).
- Manifest phải khai báo GPU resource (`nvidia.com/gpu: N`).
- Hỗ trợ **engine** khác nhau:
  - `nim` → image NIM từ NGC.
  - `vllm` → image vLLM + model weights.
  - `triton` → image Triton + model repo.
  - `tensorrt-llm` → image TensorRT-LLM + build engine.
- Hỗ trợ **autoscaling** thật (KEDA/HPA) theo metric (inflight, gpu_util, latency).

**Acceptance:**
- Deploy endpoint NIM → pod thật chạy trên GPU, `nvidia-smi` thấy GPU.
- Gọi inference → response từ model thật (không phải mock).
- Scale out → thêm pod GPU.

### 3.2 vLLM/Triton/TensorRT-LLM thật (FR-INT-002, Must)
- **vLLM:** chạy model LLM với continuous batching, PagedAttention.
- **Triton:** serving đa model, dynamic batching.
- **TensorRT-LLM:** compile engine tối ưu (inference nhanh hơn).

**Yêu cầu:**
- Endpoint invoke (`/v1/endpoints/:id/chat/completions`) proxy tới **service inference thật** (vLLM/Triton/TensorRT) thay vì mock adapter.
- Giữ OpenAI-compatible API.
- Hỗ trợ streaming SSE.

**Acceptance:**
- Gọi inference → response từ model thật (text có nghĩa, không phải reversed prompt).
- Throughput/latency đo được trên GPU thật.
- TensorRT-LLM đạt throughput ≥20% so với vLLM (benchmark thật).

### 3.3 Guardrails thật (FR-INT-003, Should)
- Thay pattern-based guardrails bằng **NeMo Guardrails** thật (chạy trên GPU/CPU).
- Tích hợp NeMo Guardrails vào pipeline inference (trước/sau model).

**Acceptance:** Guardrails chặn PII/injection với độ chính xác cao hơn pattern-based.

### 3.4 OCR thật (FR-INT-004, Should)
- Thay mock extraction bằng **OCR thật** (Tesseract/PaddleOCR) + model document-capable.
- Hỗ trợ PDF scan.

**Acceptance:** Trích xuất hợp đồng PDF scan đạt ≥90% chính xác.

### 3.5 DGX Cloud integration (FR-INT-005, Could)
- Khi có API key NVIDIA DGX Cloud: worker hỗ trợ `deployment_target=dgx_cloud`.
- Gọi DGX Cloud API provision instance.
- Billing pay-per-use.

**Acceptance:** Deploy endpoint DGX Cloud → instance provision trên hạ tầng NVIDIA.

---

## 4. Production-Readiness Checklist

### 4.1 Hạ tầng
- [ ] Cluster k8s + GPU NVIDIA (≥4 node, ≥2 GPU/node) tại VN.
- [ ] NVIDIA GPU Operator + driver + CUDA.
- [ ] Storage cho model weights (NVMe, ≥10TB).
- [ ] Network 100GbE giữa node GPU.
- [ ] NVIDIA NGC access + API key trong secret manager.
- [ ] Model registry nội bộ (Harbor) + object storage (S3/MinIO).
- [ ] Prometheus + Grafana + DCGM exporter.

### 4.2 Tích hợp
- [ ] Worker deploy thật (k8s client, apply manifest, poll pod).
- [ ] vLLM/Triton/TensorRT-LLM thật thay mock adapter.
- [ ] Invoke proxy tới service inference thật.
- [ ] Autoscaling thật (KEDA/HPA).
- [ ] Guardrails NeMo thật (tuỳ chọn).
- [ ] OCR thật (tuỳ chọn).
- [ ] DGX Cloud integration (tuỳ chọn).

### 4.3 Bảo mật & tuân thủ
- [ ] Secret management (NGC key, k8s service account) — không hardcode.
- [ ] Network policy: pod inference chỉ expose nội bộ.
- [ ] mTLS giữa worker ↔ k8s API.
- [ ] Data residency: endpoint banking/insurance chỉ chạy node VN.
- [ ] Audit log ghi mọi thao tác deploy/inference.
- [ ] Tuân thủ PDPA (Nghị định 13/2023/NĐ-CP).

### 4.4 Vận hành
- [ ] Runbook deploy/rollback endpoint.
- [ ] Alert GPU (OOM, nhiệt độ, utilization).
- [ ] Backup model weights + Postgres.
- [ ] DR plan (recovery khi node GPU hỏng).
- [ ] Capacity planning (monitor GPU utilization, forecast).

### 4.5 Kiểm thử production
- [ ] E2E test trên cluster GPU thật (deploy → inference → scale → teardown).
- [ ] Load test: throughput/latency trên GPU thật.
- [ ] Failure test: kill pod GPU → endpoint recover.
- [ ] Security test: guardrails, auth, data residency.

---

## 5. Lộ trình triển khai

| Giai đoạn | Thời gian | Nội dung | Deliverable |
|-----------|-----------|----------|-------------|
| **P0 — Hạ tầng** | 4-6 tuần | Setup cluster k8s + GPU, GPU Operator, NGC access, storage | Cluster GPU sẵn sàng |
| **P1 — Worker thật** | 4-6 tuần | Worker deploy thật (k8s), vLLM thật, invoke proxy | Endpoint chạy thật trên GPU |
| **P2 — Tối ưu** | 3-4 tuần | Triton/TensorRT-LLM, autoscaling, NeMo Guardrails | Hiệu năng + bảo mật thật |
| **P3 — Mở rộng** | 4-8 tuần | OCR thật, DGX Cloud, DR, capacity planning | Production đầy đủ |

**Tổng:** ~4-6 tháng để production-ready đầy đủ.

---

## 6. Rủi ro & giảm thiểu

| Rủi ro | Khả năng | Tác động | Giảm thiểu |
|--------|----------|----------|------------|
| Thiếu GPU H100/H200 tại VN | Trung bình | Trễ P0 | Đặt trước, fallback A30/H100 |
| NGC access chậm phê duyệt | Trung bình | Trễ P0 | Xin sớm, dùng model open-source fallback |
| TensorRT-LLM compile lâu | Cao | Trễ P2 | Cache engine, dùng model phổ biến |
| Cluster GPU không ổn định | Thấp | Uptime | Redundancy, DR plan |
| Chi phí GPU cao | Cao | Margin | Commitment, autoscaling, DGX Cloud |

---

## 7. KPI production

| KPI | Target | Nguồn |
|-----|--------|-------|
| Uptime endpoint | ≥99.5% | Monitoring |
| Latency p95 (coding) | ≤800ms | GPU metrics |
| Latency p95 (securities) | ≤500ms | GPU metrics |
| Throughput (TensorRT vs vLLM) | +20% | Benchmark |
| GPU utilization | 60-80% | DCGM |
| Time-to-deploy (NIM) | ≤5 phút | Worker log |
| OCR accuracy (insurance) | ≥90% | Test |

---

## 8. Phụ lục — So sánh preview vs production

| Lớp | Preview (hiện tại) | Production (target) |
|-----|-------------------|---------------------|
| GPU | Không có | H100/H200/A30/B300 tại VN |
| Deploy | Simulation (delay) | k8s thật (apply manifest) |
| NIM | Label/engine flag | Container NIM thật từ NGC |
| Inference | Mock (reversed prompt) | vLLM/Triton/TensorRT thật |
| Guardrails | Pattern-based | NeMo Guardrails thật |
| OCR | Mock | Tesseract/PaddleOCR + model |
| DGX Cloud | Scaffold (coming soon) | API thật (khi có key) |
| Data | Postgres/Redis preview | Postgres/Redis production + DR |
| Monitoring | Cơ bản | Prometheus + Grafana + DCGM |