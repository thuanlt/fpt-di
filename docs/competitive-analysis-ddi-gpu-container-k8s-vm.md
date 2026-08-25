# Competitive Analysis — Đối thủ Serving/Deploy Model Tự động trên GPU Container, Kubernetes & GPU VM

**Phiên bản:** 1.0
**Ngày:** 18/08/2026
**Trạng thái:** Draft
**Chủ sở hữu:** Thuan Luu Thi (BA/PO)
**Phạm vi:** Phân tích các đối thủ cung cấp giải pháp **deploy/serving model tự động** trên cả ba hình thức hạ tầng: **GPU Container**, **Kubernetes (k8s)**, và **GPU VM** — để định vị FPT DDI.
**Liên quan:** `docs/market-research-fpt-ddi.md`, `docs/srs-ddi-my-endpoints.md`

---

## 1. Câu hỏi nghiên cứu & Phương pháp

**Câu hỏi:** Đối thủ nào hiện đang serving/deploy model tự động trên giải pháp tổng quan (comprehensive) phủ cả **GPU container**, **Kubernetes**, và **GPU VM**?

**Tiêu chí đánh giá "giải pháp tổng quan":**
- **GPU Container**: deploy model dạng container (Docker) trên GPU — tự động hóa runtime, dependency, inference code
- **Kubernetes (k8s)**: orchestration, auto-scaling, GPU scheduling (NVIDIA GPU Operator), quản lý cluster
- **GPU VM**: cấp phát máy ảo GPU riêng (dedicated VM / node pool) cho workload
- **Tự động hóa**: khả năng deploy model tự động (serverless endpoint, 1-click cluster, auto-scaling, BYOC)

---

## 2. Bảng tổng hợp mức độ phủ 3 hình thức

| Provider | GPU Container | Kubernetes (k8s) | GPU VM | Deploy tự động | Mức độ tổng quan |
|----------|:---:|:---:|:---:|:---:|:---:|
| **Together AI** | ✅ | ✅ | ✅ | ✅ | ★★★★★ Cao |
| **Fireworks AI** | ✅ | ✅ (BYOC) | ✅ (Virtual Cloud) | ✅ | ★★★★★ Cao |
| **Baseten** | ✅ | ✅ (EKS+Karpenter) | ✅ | ✅ | ★★★★★ Cao |
| **RunPod** | ✅ | ⚠️ (native, chưa k8s trực tiếp) | ✅ (GPU Pods) | ✅ (serverless) | ★★★★ Trung-Cao |
| **Lambda** | ✅ | ✅ (MK8s) | ✅ (bare metal + VM) | ⚠️ (manual capacity) | ★★★★ Trung-Cao |
| **CoreWeave** | ✅ | ✅ (k8s-native) | ✅ | ⚠️ | ★★★★ Trung-Cao |
| **Replicate** | ✅ | ⚠️ (abstract) | ⚠️ | ✅ | ★★★ Trung |
| **DeepInfra** | ✅ | ⚠️ | ⚠️ | ✅ | ★★★ Trung |
| **Hyperscaler (AWS/Azure/GCP)** | ✅ | ✅ | ✅ | ⚠️ (cần tự build) | ★★★★ Trung-Cao |

> **Kết luận sơ bộ:** Không có đối thủ nào phủ **hoàn hảo** cả ba lớp với deploy hoàn toàn tự động. Nhóm **Together AI, Fireworks, Baseten** là gần nhất với "giải pháp tổng quan". **RunPod/Lambda** mạnh về compute nhưng thiếu một phần orchestration/serverless tự động.

---

## 3. Phân tích chi tiết từng đối thủ

### 3.1 Together AI — ★★★★★ (gần nhất với "tổng quan")

| Tiêu chí | Đánh giá |
|----------|----------|
| **GPU Container** | ✅ **Dedicated Container Inference** — đóng gói runtime, dependency, inference code trong Docker container |
| **Kubernetes** | ✅ GPU Clusters dựng trên k8s (control plane + worker node GPU + InfiniBand + persistent storage); hỗ trợ Slurm-on-K8s (Slinky) |
| **GPU VM** | ✅ On-demand GPU clusters, reserved clusters |
| **Deploy tự động** | ✅ Provisioning nhanh, flexible scaling; **hạn chế:** horizontal node autoscaling cho managed k8s đang phát triển, có báo cáo reliability với cluster lớn |
| **Ghi chú** | Mạnh nhất về "container + k8s + VM" trọn gói. Điểm yếu: autoscaling ngang chưa hoàn thiện |

### 3.2 Fireworks AI — ★★★★★

| Tiêu chí | Đánh giá |
|----------|----------|
| **GPU Container** | ✅ Container-based inference, engine tối ưu (vLLM + custom) |
| **Kubernetes** | ✅ **Bring-Your-Own-Cluster (BYOC)** — khách hàng tự cấp k8s cluster + NVIDIA GPU nodes, Fireworks cài serving stack qua Helm/GitOps, cấu hình networking/DNS |
| **GPU VM** | ✅ "Virtual Cloud" — bare-metal GPU deployment, che giấu phức tạp phần cứng |
| **Deploy tự động** | ✅ Serverless + dedicated, auto-scaling |
| **Ghi chú** | BYOC là điểm khác biệt — khách hàng giữ quyền kiểm soát hạ tầng, Fireworks lo phần serving |

### 3.3 Baseten — ★★★★★

| Tiêu chí | Đánh giá |
|----------|----------|
| **GPU Container** | ✅ Deploy model server trực tiếp từ Docker image bằng YAML đơn giản |
| **Kubernetes** | ✅ Dùng **EKS + Karpenter** cho cluster scaling theo nhu cầu |
| **GPU VM** | ✅ Cross-cloud autoscaling (nhiều cloud provider) |
| **Deploy tự động** | ✅ Serverless + dedicated, Inference Stack tối ưu |
| **Ghi chú** | Mạnh về tự động hóa autoscaling đa cloud, tiết kiệm chi phí qua tối ưu GPU utilization |

### 3.4 RunPod — ★★★★

| Tiêu chí | Đánh giá |
|----------|----------|
| **GPU Container** | ✅ GPU Pods — containerized workload, PyTorch/TensorFlow |
| **Kubernetes** | ⚠️ Clusters dùng orchestration native của RunPod, **chưa hỗ trợ k8s trực tiếp** |
| **GPU VM** | ✅ Dedicated GPU instances (Pods), spot instances |
| **Deploy tự động** | ✅ Serverless GPU Endpoints (FlashBoot khởi động nhanh, auto-scaling) |
| **Ghi chú** | Mạnh về compute utility (pod/VM), nhưng **thiếu lớp orchestration k8s** — người dùng tự lo inference optimization, orchestration, observability |

### 3.5 Lambda — ★★★★

| Tiêu chí | Đánh giá |
|----------|----------|
| **GPU Container** | ✅ Container deployment |
| **Kubernetes** | ✅ **Managed Kubernetes (MK8s)** — 1-Click Clusters, pre-configured NVIDIA GPU Operator + Network Operator + Container Toolkit |
| **GPU VM** | ✅ Bare metal + VM, giá cạnh tranh (B200 $3,49/GPU/hr) |
| **Deploy tự động** | ⚠️ MK8s có automated node remediation, nhưng **thiếu serverless GPU / auto-scaling event-driven** — cần manual capacity planning |
| **Ghi chú** | Mạnh về foundation GPU k8s, yếu về serverless/auto-scaling tự động |

### 3.6 CoreWeave — ★★★★

| Tiêu chí | Đánh giá |
|----------|----------|
| **GPU Container** | ✅ |
| **Kubernetes** | ✅ Kubernetes-native cloud, tối ưu training quy mô lớn |
| **GPU VM** | ✅ Reserved pricing B200, InfiniBand |
| **Deploy tự động** | ⚠️ Tập trung training hơn inference tự động |
| **Ghi chú** | Mạnh về training cluster, ít tập trung vào managed inference endpoint |

### 3.7 Replicate — ★★★

| Tiêu chí | Đánh giá |
|----------|----------|
| **GPU Container** | ✅ Custom model deployment (BYO Docker) |
| **Kubernetes** | ⚠️ Abstract hóa, không lộ k8s cho người dùng |
| **GPU VM** | ⚠️ Quản lý nội bộ, không cho thuê VM trực tiếp |
| **Deploy tự động** | ✅ Serverless, webhook |
| **Ghi chú** | Mạnh về UX/multi-modal, nhưng không phải hạ tầng "tổng quan" |

### 3.8 DeepInfra — ★★★

| Tiêu chí | Đánh giá |
|----------|----------|
| **GPU Container** | ✅ |
| **Kubernetes** | ⚠️ Nội bộ, không lộ |
| **GPU VM** | ⚠️ |
| **Deploy tự động** | ✅ Serverless, giá rẻ nhất |
| **Ghi chú** | Tập trung giá rẻ serverless, không phải nền tảng hạ tầng tổng quan |

### 3.9 Hyperscaler (AWS / Azure / GCP) — ★★★★ (nhưng không "tự động trọn gói")

| Tiêu chí | AWS | Azure | GCP |
|----------|-----|-------|-----|
| **GPU Container** | ✅ Deep Learning Containers (vLLM) | ✅ | ✅ |
| **Kubernetes** | ✅ EKS | ✅ AKS (GPU node pool, MIG) | ✅ GKE |
| **GPU VM** | ✅ A100/H100 instances | ✅ V100/A100/H100 | ✅ A3 (H100) |
| **Deploy tự động** | ⚠️ Cần tự build stack (Helm, KEDA, vLLM) | ⚠️ NVIDIA NIM qua Helm | ⚠️ Vertex AI managed endpoints |
| **Ghi chú** | Cung cấp **nền tảng** chứ không phải **managed inference trọn gói** — khách hàng phải tự lắp ráp orchestration + serving |

---

## 4. Công nghệ nền tảng (tự động hóa deploy)

Các đối thủ dùng chung hạ tầng công nghệ sau để tự động hóa deploy trên k8s:

| Công nghệ | Vai trò |
|-----------|---------|
| **NVIDIA GPU Operator** | Quản lý driver, Container Toolkit, Device Plugin — expose GPU cho k8s scheduler |
| **Kubernetes Operators / CRDs** | NVIDIA K8s LLM Operator, LLMKube, KubeAI — định nghĩa model/inference service kiểu k8s-native |
| **vLLM** | Inference engine hiệu năng cao, chuẩn ngành |
| **KEDA** | Event-driven autoscaling (GPU metrics, queue depth, time-to-first-token) |
| **MIG / GPU time-slicing** | Chia sẻ GPU, tối ưu chi phí |
| **Helm / GitOps** | Đóng gói & triển khai serving stack (Fireworks BYOC dùng) |

---

## 5. Đánh giá & Định vị FPT DDI

### 5.1 Khoảng trống thị trường

| Hình thức | Ai phủ mạnh | Khoảng trống |
|-----------|-------------|--------------|
| **GPU Container** | Together, Baseten, RunPod | Ít khoảng trống — chuẩn ngành |
| **Kubernetes** | Together, Fireworks (BYOC), Lambda (MK8s), Baseten | FPT có thể tận dụng để cung cấp managed k8s cho enterprise |
| **GPU VM** | RunPod, Lambda, CoreWeave | FPT có hạ tầng AI Factory (H100/H200) — cạnh tranh giá |
| **Deploy tự động** | Baseten, Fireworks, Together | FPT cần bắt kịp serverless/auto-scaling |
| **Data residency VN + tiếng Việt** | **Không ai** | ✅ **Khoảng trống duy nhất của FPT** |

### 5.2 Điểm khác biệt đề xuất cho FPT DDI

| Yếu tố | Đối thủ | FPT DDI đề xuất |
|--------|---------|-----------------|
| **GPU Container** | Chuẩn ngành | ✅ Bắt kịp chuẩn ngành (Docker + vLLM) |
| **Kubernetes** | Together/Fireworks/Lambda | ✅ Cung cấp managed k8s + NVIDIA GPU Operator |
| **GPU VM** | RunPod/Lambda/CoreWeave | ✅ Tận dụng AI Factory (H100/H200/B300/A30) |
| **Deploy tự động** | Baseten/Fireworks | ✅ Serverless + dedicated + auto-scaling |
| **Data residency VN** | ✗ Không ai | ✅ **Độc quyền** — tuân thủ Nghị định 13/2023 |
| **Model tiếng Việt** | ✗ Không ai | ✅ FPT.AI model riêng |
| **BYOC** | Fireworks | ✅ (tùy chọn roadmap) |

### 5.3 Khuyến nghị

| Ưu tiên | Khuyến nghị | Lý do |
|----------|-------------|-------|
| **Must** | Phủ đủ 3 lớp: GPU container + managed k8s + GPU VM | Để được coi là "giải pháp tổng quan" ngang Together/Fireworks/Baseten |
| **Must** | Auto-scaling serverless + dedicated | Baseten/Fireworks làm tốt — tiêu chuẩn ngành |
| **Must** | NVIDIA GPU Operator + vLLM làm nền tảng | Chuẩn ngành, giảm chi phí phát triển |
| **Should** | Highlight data residency VN + model tiếng Việt | Khoảng trống độc quyền, không đối thủ nào có |
| **Should** | BYOC (bring-your-own-cluster) như Fireworks | Giữ chân enterprise muốn kiểm soát hạ tầng |
| **Could** | MIG/GPU time-slicing để tối ưu chi phí | Cạnh tranh giá, tăng GPU utilization |

---

## 6. Kết luận

**Không có đối thủ nào phủ hoàn hảo cả ba hình thức (GPU container + k8s + GPU VM) với deploy 100% tự động.**

- **Gần nhất với "giải pháp tổng quan"**: **Together AI**, **Fireworks AI**, **Baseten** — phủ đủ 3 lớp, deploy tự động tốt.
- **Mạnh về compute nhưng thiếu orchestration/serverless**: **RunPod** (thiếu k8s trực tiếp), **Lambda** (thiếu serverless auto-scaling).
- **Hyperscaler** cung cấp nền tảng (EKS/AKS/GKE + GPU VM) nhưng **không phải managed inference trọn gói** — khách hàng phải tự lắp ráp.

**Cơ hội cho FPT DDI:** trở thành đối thủ duy nhất tại Việt Nam/SEA cung cấp **giải pháp tổng quan (3 lớp) + data residency + model tiếng Việt**, học theo mô hình Together/Fireworks/Baseten về tự động hóa, tận dụng hạ tầng AI Factory NVIDIA.

**Top đối thủ cần theo dõi sát:**
1. **Together AI** — benchmark "container + k8s + VM" trọn gói
2. **Fireworks AI** — benchmark BYOC + Virtual Cloud
3. **Baseten** — benchmark auto-scaling đa cloud
4. **Lambda** — benchmark managed k8s (MK8s) + giá GPU VM

---

## PHỤ LỤC — Nguồn dữ liệu

- Together AI — Dedicated Container Inference, GPU Clusters (k8s), Slurm-on-K8s
- Fireworks AI — Virtual Cloud, Bring-Your-Own-Cluster (BYOC), Helm/GitOps
- Baseten — EKS + Karpenter, Docker/YAML deployment, cross-cloud autoscaling
- RunPod — GPU Pods, Serverless Endpoints, FlashBoot, native orchestration
- Lambda — Managed Kubernetes (MK8s), 1-Click Clusters, NVIDIA GPU Operator
- CoreWeave — k8s-native cloud, reserved B200, InfiniBand
- AWS EKS/DLC, Azure AKS/MIG/NVIDIA NIM, GCP GKE/A3 — hyperscaler GPU k8s
- NVIDIA GPU Operator, vLLM, KEDA, MIG — công nghệ nền tảng tự động hóa

> **Lưu ý:** Thông tin đối thủ là tổng hợp từ nguồn công khai (2026), có thể thay đổi nhanh do thị trường biến động. Nên xác minh trực tiếp trên website đối thủ trước khi dùng cho quyết định chiến lược chính thức.