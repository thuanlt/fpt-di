# Giải pháp Model Serving trên Kubernetes — FPT DDI

Mô hình vận hành: đội K8s/platform sở hữu hạ tầng ("nhấn nút" ra cluster sẵn sàng);
AI Engineering sở hữu mọi thứ từ "model" trở lên để biến cluster trống thành endpoint serving đạt SLA.

## Phân ranh trách nhiệm

| Đội K8s / Platform | AI Engineering |
|---|---|
| Cluster, GPU node pool | Chuẩn bị & đóng gói model |
| NVIDIA driver + device plugin/runtime | Cấu hình serving (engine, TP/PP, params) |
| Storage class, object storage | Manifest & pipeline deploy |
| Ingress/LB, TLS termination | Expose route OpenAI-compatible, auth, rate limit |
| Node autoscaler (Karpenter/CA) | Ngưỡng autoscaling theo metric inference |
| Hạ tầng monitoring/log | Metrics engine, dashboard SLO, billing metering |

## 8 nhóm task của AI Engineering

### 1. Chuẩn bị & đóng gói model
- Chọn model từ catalog, xác minh license (thương mại vs open-weights)
- Chọn quantization theo GPU: FP8 cho H100/H200 (Hopper); INT8/AWQ cho A30 (Ampere không có FP8 tensor cores)
- Sync weights về object storage nội địa (data residency), versioning từng bản
- Chọn & build serving image (vLLM / SGLang / TensorRT-LLM / Triton) khớp ma trận CUDA/driver, push private registry

### 2. Cấu hình serving (phần chuyên môn nặng nhất)
- Parallelism: TP/PP theo size model × số GPU (Llama-70B FP16 ≈ 140GB → TP2/TP4 trên H100 80GB)
- Runtime params: max_model_len, gpu_memory_utilization, chunked prefill, prefix caching, max_num_seqs
- Pod spec: nvidia.com/gpu, /dev/shm đủ lớn cho NCCL, CPU/RAM cho giai đoạn load
- Probes: startup probe dài (model load vài phút), readiness = /health của engine

### 3. Manifest & pipeline deploy
- Helm chart/Kustomize template cho endpoint (console sinh manifest từ form Create endpoint)
- Init container tải weights từ object storage vào NVMe/emptyDir, hoặc CSI mount
- GitOps (ArgoCD) hoặc console apply trực tiếp; rollout blue-green khi đổi bản model
- Secrets: API keys, registry pull secrets

### 4. Expose & bảo mật
- Service + Ingress/Gateway API, TLS; route OpenAI-compatible (/v1/chat/completions)
- Auth API key, rate limit tại gateway
- Network policy tách tenant — BFSI bắt buộc isolation riêng

### 5. Autoscaling & SLA
- HPA/KEDA theo queue depth / GPU util / request rate; min ≥ 1 replica cho workload SLA (không cold start)
- Scale-to-zero chỉ cho batch/dev
- Định nghĩa ngưỡng scale; đội K8s vận hành Karpenter/cluster-autoscaler

### 6. Observability & billing
- Metrics engine: TTFT, TPOT, p95/p99, tokens/s, KV-cache hit, GPU util (Prometheus exporter của vLLM)
- Dashboard + alert gắn SLO 99,9%; log tập trung
- Metering GPU-hours theo endpoint để billing

### 7. Test & nghiệm thu trước GA
- Load test (JMeter/k6) chứng minh p95 dưới ngưỡng SLA trên từng GPU class
- Failover test: kill node → đo thời gian reschedule + warm-up
- Accuracy spot-check sau quantization

### 8. Vận hành vòng đời
- Ma trận tương thích driver/CUDA/engine; kế hoạch upgrade
- Cập nhật model, rollback
- Runbook: OOM, NCCL timeout, GPU ECC error → drain node

## Workflow deploy endpoint trên K8s (thể hiện trong console)

1. Validate config & generate manifests — Auto (console sinh Helm values từ form)
2. Apply manifests to cluster — Platform (GitOps/ArgoCD hoặc kubectl apply)
3. Schedule pods on GPU node — Platform (nodeSelector + tolerations)
4. Init: pull model weights — AI Eng (object storage VN → NVMe)
5. Start serving container — AI Eng (vLLM/SGLang từ private registry)
6. Load model + warmup — AI Eng (startup probe)
7. Readiness pass → expose endpoint — Platform (Service + Ingress, TLS, auth)
8. Running — serving traffic, metrics on

## Khuyến nghị cho console

Form Create endpoint (K8s) nên bổ sung: quantization, serving engine, max_model_len, TP degree —
để console encode đúng cấu hình của task 2, giữ đúng lời hứa "nhấn nút là deploy thành công".
