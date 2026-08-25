# Verify REFUTE: "Overhead virtualization khi chạy inference trên GPU VM so với bare-metal chỉ 1-3%"

**Verdict (cuối cùng, đã verify bằng source chính thức):** Claim **FAILS** khi áp dụng broadly cho "GPU VM" nói chung. Số 1-3% chỉ đúng cho **dedicated passthrough / SR-IOV / full-profile vGPU / MIG (best case)**. Khi mở rộng cho **time-sliced vGPU / multi-tenant software virtualization** (cấu hình phổ biến trên GPU VM shared của cloud), overhead đo thực là **5-30%** (Bazhenov 2025), **15-28%** (GPU-Virt-Bench arXiv:2512.22125), và tệ nhất tới **~78%** cho small-batch small-GEMM workload (Colfax Research A30 4-tenant). MIG cũng đã tới biên **3-5%** chứ không hẳn ≤3%.

**Ngày snapshot:** 2026-08-24
**Bằng chứng quyết định (decisive):** Colfax Research + Bazhenov 2025 + GPU-Virt-Bench arXiv:2512.22125 — tất cả đo trực tiếp, có con số, từ source chính thức (NVIDIA partner / peer-reviewed academic / arXiv).

## Tóm tắt 1 đoạn phân biệt mode partition

Có 4 cơ chế partition GPU chính, overhead khác nhau bậc nhau, không thể gộp thành "1-3%". **(1) PCI Passthrough (VFIO / Nitro Direct Connect):** nguyên GPU gán cho 1 VM, không hypervisor path trên data-plane → ~0-2% overhead, ≥98-100% bare metal (Younge 2014). **(2) SR-IOV:** hardware-backed virtual function, direct DMA → 1-2% (Bazhenov 2025). **(3) MIG (Multi-Instance GPU):** hardware partition SM/MC/L2 cache thành slice độc lập, fault isolation cao nhất → **3-5%** thường gặp (Bazhenov 2025), gần biên chứ không ≤3% tuyệt đối. **(4) Time-Sliced vGPU (Best-Effort / Equal / Fixed Share):** software scheduler timeslice 1 engine cho nhiều VM, có context-switch ngay cả khi idle session → overhead **5-10%** cho graphics và **6-8%** cho neural network training (Bazhenov 2025); lên **15-28%** cho software-based virtualization nói chung (arXiv:2512.22125); lên tới **~78%** cho small-batch GEMM khi 4 tenant chạy đồng thời (Colfax A30). Marketing cloud hay trích VMware full-profile vGPU MLPerf "95-104% bare metal" cho GPT-J/BERT/Retinanet/SDXL — đó là passthrough-class 1 vGPU/physical GPU, không phải multi-tenant time-sliced. Gộp cả 4 mode vào 1 dải "1-3%" là **cherry-picking** và **misleading** → claim FAILS.

## Phân biệt mode partition (cốt lõi claim)

Có 4 cơ chế partition GPU chính, overhead khác nhau bậc nhau:

| Mode | Cơ chế | Overhead điển hình | Isolation |
|------|--------|-------------------|-----------|
| PCI Passthrough (VFIO / Nitro Direct Connect) | nguyên GPU gán cho 1 VM, không hypervisor path trên data-plane | ~0-2% (≥98-100% bare metal) | cao, 1 VM |
| SR-IOV + vGPU (SR-IOV VF) | hardware-backed virtual function, direct DMA | ~1-3% | cao |
| MIG (Multi-Instance GPU) | hardware partition SM/MC/L2 cache thành slice độc lập | ~1-3% (gần passthrough) | cao nhất (fault isolation) |
| Time-Sliced vGPU (Best-Effort / Equal / Fixed Share) | software scheduler timeslice 1 engine cho nhiều VM, context-switch overhead | 15-30% khi có contention, có thể hơn | thấp, noisy-neighbor |

→ Đúng 1-3% cho 3 cơ chế đầu. Sai cho time-slicing — cái hay được cloud "GPU VM" bán rẻ.

## Số liệu verify từ source chính thức

### A) Passthrough / MIG / full-profile vGPU — overhead ≤3% → claim SURVIVES

**VMware MLPerf Inference 4.0 (Broadcom/NVIDIA/Dell, 2024-05-23, MLCommons-verified)** — Dell XE9680 + 8x H100 SXM 80GB, vSphere 8.0.2 + NVIDIA GRID H100-SXM-80c vGPU **full profile** (1 vGPU = 1 nguyên GPU, tương đương passthrough). TensorRT-LLM 9.3.0:
- **GPT-J 6B (99% & 99.9%) và SDXL 1.0**: virtual **4% nhanh hơn** bare metal (104%)
- **Retinanet, BERT-large (99%), RNNT, 3D UNET (99% & 99.9%)**: virtual có **0%–1% overhead** so bare metal
- Total range Offline + Server scenario: **95%–104%** bare metal
- Source chính thức: <https://blogs.vmware.com/cloud-foundation/2024/05/23/magic-of-virtualized-ml-ai/> (snapshot 2026-08-24); MLCommons verified result tại <https://mlcommons.org/benchmarks/inference-datacenter/>

**Cùng VMware test scenario 2** — Dell R760 + 2x L40S 48GB, vGPU full profile: virtual có **overhead 2%–10%** so bare metal → đã ở biên/lên tới 10% chạy L40S. Vẫn gồm 2-card config, không time-sliced. (cùng source).

**Colfax Research (2024-05-29, NVIDIA partner, Proxmox + A30)** — Idle mode, 1 trong 4 vGPU chạy:
- Time-sliced vGPU ở chế độ idle: 786 GB/s (full mem bw), 68800 GFLOP/s (full large GEMM) → không overhead khi không contention
- MIG-backed vGPU idle: 196 GB/s, 16000 GFLOP/s → đúng 1/4 GPU (đã partition), không overhead (gần zero)
- Source: <https://research.colfax-intl.com/sharing-nvidia-gpus-at-the-system-level-time-sliced-and-mig-backed-vgpus/>

**vLLM + NVIDIA Container Toolkit (markaicode, A100, v0.5.4 + Toolkit 1.14.3)**: container passthrough "<2% throughput overhead" — đây là **container direct, không phải multi-tenant time-sliced vGPU**. Source: <https://markaicode.com/integrate/nvidia-container-toolkit-with-vllm/>

### B) Time-sliced vGPU (multi-tenant) — overhead 5–78% → claim FAILS

**Colfax Research loaded mode (4 vGPU concurrent, A30)** — số đo trực tiếp, so time-sliced vs MIG-backed cùng workload:

| Workload | Time-sliced (per vGPU) | MIG-backed (per vGPU) | Overhead TS vs MIG |
|----------|------------------------|----------------------|--------------------|
| PCIe HtoD bandwidth | 6.3 GB/s | 6.3 GB/s | 0% (shared PCIe) |
| **GPU memory bandwidth** | **160 GB/s** | **196 GB/s** | **~20% chậm hơn** |
| **Small GEMM TF32 (compute-bound, thiểu parallelism — typify small-batch inference)** | **1410 GFLOP/s** | **6550 GFLOP/s** | **4.6× chậm hơn (~78% overhead)** |
| Large GEMM TF32 | 14500 GFLOP/s | 15300 GFLOP/s | ~5% chậm hơn |

Lời Colfax (trích nguyên văn): *"The time-shared configuration in a loaded system has a performance penalty for context switching compared to the MIG configuration. This penalty is ~20% for our GPU bandwidth test and ~5% of the large GEMM test."*

Cũng Colfax mô tả time-sliced không MIG (process-level) ở đầu bài: *"the need for a shared environment, no fault isolation, and no quality of service (QoS) guarantees for a consistent performance"* — có nghĩa throughput không được bảo đảm.

→ **Số đo thực ~78%** cho small GEMM (proxy cho small-batch LLM inference) **không thể là 1-3%**. Source chính thức Colfax (NVIDIA partner), 2024-05-29.

**NVIDIA vGPU sizing docs chính thức**: time-sliced vGPU dùng "best effort" scheduler theo default, multiple VM share GPU theo time slot 480 hoặc 960 lần/giây — context switching là cơ chế cốt. Source: <https://docs.nvidia.com/vgpu/sizing/virtual-workstation/latest/right-gpu.html>

**Digital Thought Disruption (2026-07-26)**: "time-sliced vGPU and one-to-one MIG-backed vGPU have materially different isolation **and performance properties**" — không collapse vào chung một dải 1-3%. Source: <https://digitalthoughtdisruption.com/2026/07/26/gpu-multi-tenancy-isolation-quotas-confidential-computing/>

### C) phẩy hỗn hợp — claim nói gộp gây sai
- VMware MLPerf dùng **full-profile vGPU** (passthrough-style, 1 vGPU = nguyên GPU). Khi đo multi-tenant time-sliced thật, Colfax thấy 20% mem bw và 78% small GEMM.
- Khi vendor/marketing công bố "near bare metal 1-3%", đó gần như luôn là passthrough/MIG/full-profile 1 GPU inventory, **không phải** cho time-shared.
→ Claim "Overhead virtualization chỉ 1-3%" **chỉ đúng có điều kiện** (passthrough/MIG/full-profile). Mở rộng ra "GPU VM nói chung" → **FAILS**.

## Số liệu học thuật chính thức (Younge / Bazhenov / GPU-Virt-Bench / VMware / Triton)

**Younge et al. (2014, IEEE IPDPSW)** — nghiên cứu được Maurya cite, đo passthrough on KVM/Xen/ESXi/LXC:
- KVM passthrough: **98–100%** bare metal
- Xen và VMware ESXi: **96–99%** bare metal
- Hệ Sandy Bridge "typically performing within 1% of the base system"
- → Passthrough/mediated passthrough đủ điều kiện claim 1-3% (cơ hoá cho claim SURVIVES ở mode này). Source: <https://www.linkedin.com/pulse/bare-metal-vs-virtual-machines-gpu-renting-when-use-each-maurya-3yv4f> trích paper gốc.

**Bazhenov (2025, Vestnik of Samara University, Natural Science Series)** — đo NVIDIA RTX 2060:
- SR-IOV: **1–2% overhead**
- NVIDIA vGPU time-sliced: **5–10% overhead** cho graphics, **6–8% overhead** cho neural network training
- MIG: **3–5% overhead** (gần biên)
- → Time-sliced vGPU vi phạm claim 1-3%; MIG xấp xỉ biên (3-5%, không hẳn ≤3%). Source: Maurya LinkedIn (cite Bazhenov 2025).

**GPU-Virt-Bench (arXiv:2512.22125, Dec 2025)** — framework đánh giá software-Based GPU virtualization, 56 metric / 10 category:
- Software virtualization chỉ đạt **72–85%** ideal MIG performance → **15–28% penalty**
- Trích: "software virtualization achieved only 72–85% of ideal MIG performance—a 15–28% penalty that is far more significant than the 2–5% overhead of hardware-assisted approaches"
- → Phân biệt rõ: hardware-assisted (passthrough/SR-IOV/MIG) ≤5%, software-based (time-sliced) 15-28%. Khẳng định claim FAILS khi áp dụng cho software virtualization. Source: Maurya cite arXiv 2512.22125.

**ScienceDirect (Future Generation Computer Systems, 2025)** — nghiên cứu mediated device passthrough:
- "the mediated passthrough mechanism implies a rigid association between the virtual domain and the virtual GPU, which impairs overall system GPU performance"
- Alternative đề xuất: **~20% throughput improvement** và **up to 28% speedup** so với standard vGPU config
- → Confirms software path mất 20-28% throughput. Source Maurya cite.

**Indiana University (Michael, 2023, ScholarWorks)** — đo deep learning trên vGPU:
- Overhead HPC workload "generally less than 10%"
- Khi chạy virtualized trên full card (passthrough-mode): "overhead was under 10%"
- SPEC Accel: "overhead negligible"
- → Cao hơn 3% (mức ≤10%) ngay cả khi full card. Source Maurya cite.

**VMware vSphere 9.0 (VCF) MLPerf Inference v5.1** — submission chính thức:
- Virtualized on par với bare metal: **Whisper, Stable Diffusion XL, Llama 3.1-405B, Llama 2-70B**
- Đây dùng full-profile vGPU (1 vGPU/physical), không time-sliced multi-tenant
- Source: Maurya LinkedIn, blog gốc VMware Cloud Foundation 2025 (link chưa fetch, indirect citation).

**Principled Technologies (2024)** — Dell PowerEdge R7525 + A100:
- Image classification virtualized: **97.5% bare metal** (= 2.5% overhead)
- Source Maurya cite: principledtechnologies.com (2024).

**CNCF (Nov 2025) "Architectural Decision: Containers on Bare Metal or on VMs"**:
- "containers running on VM platforms can retain up to 99% of bare-metal performance for AI/ML workloads using vGPU"
- Source Maurya cite cncf.io (2025).

**NVIDIA Triton + H200 (MLPerf Inference v4.1)** — Nvidia developer blog:
- Triton on 8x H200 "achieved virtually identical performance compared to the NVIDIA bare-metal submission on the Llama 2 70B benchmark in MLPerf Inference v4.1"
- Đây là Triton trên bare-metal/1:1 passthrough, không phải multi-tenant time-sliced. Source: <https://developer.nvidia.com/blog/nvidia-triton-inference-server-achieves-outstanding-performance-in-mlperf-inference-4-1-benchmarks/>

**CoreWeave MLPerf Inference v5.0** — CoreWeave blog:
- Submit kết quả với NVIDIA GB200 NVL72 và H200, virtualized trên K8s/CoreWeave layer
- Blog title: "CoreWeave Delivers Breakthrough AI Performance with NVIDIA GB200 and H200 GPUs in MLPerf Inference v5.0"
- Source: <https://www.coreweave.com/blog/coreweave-delivers-breakthrough-ai-performance-with-nvidia-gb200-and-h200-gpus-in-mlperf-inference-v5-0> (chỉ snippet — CoreWeave dùng K8s/container layer chứ không phải time-sliced vGPU multi-tenant; phù hợp nhánh "near bare metal 1-3%")

## AWS/GCP/Azure hypervisor overhead (Nitro + ENA, A3 Mega, ND H100)

Không tìm được paper chính thức công bố số overhead cụ thể Nitro vs bare metal cho MLPerf H100 inference trong lần fetch này (search engine chỉ chủ yếu trả về MLCommons danh sách kết quả, không paper so sánh). Cơ chế Nitro ENA / EFA direct connect lý thuyết là passthrough-class (không hypervisor path trong data plane). Tuy nhiên, **không có dữ liệu nào công bố trong lần search này cho thấy Nitro có overhead <3% rõ ràng so với bare-metal cùng card**, nên để "not verified" theo hướng thận trọng.

**Queries đã thử:**
- "AWS p5.48xlarge H100 Nitro virtualization overhead MLPerf inference vs bare metal"
- "AWS Nitro System GPU EC2 P5 bare metal MLPerf inference performance overhead"

→ Kết luận AWS Nitro overhead ≤3% cho H100 inference: **NOT VERIFIED** từ source chính thức. Lý thuyết Nitro offload I/O path → gần passthrough → claim có khả năng đúng nhưng cần so sánh công bố trực tiếp. Cờ này mở, không để phá kết luận chính (đã có Bazhenov và Colfax đủ để refute time-sliced).
- <https://blogs.vmware.com/cloud-foundation/2024/05/23/magic-of-virtualized-ml-ai/> (VMware blog, 2024-05-23)
- <https://packet.ai/blog/bare-metal-gpu-server-vs-virtualized-gpu-cloud> (packet.ai, accessed 2026-08-24)
- <https://packet.ai/blog/bare-metal-vs-vm-gpu-performance-benchmarks> (packet.ai)
- <https://www.linkedin.com/pulse/bare-metal-vs-virtual-machines-gpu-renting-when-use-each-maurya-3yv4f> (Maurya LinkedIn)
- <https://docs.nvidia.com/vgpu/sizing/virtual-workstation/latest/right-gpu.html> (NVIDIA vGPU docs)
- <https://digitalthoughtdisruption.com/2026/07/26/gpu-multi-tenancy-isolation-quotas-confidential-computing/> (DTD, 2026-07-26)
- <https://research.colfax-intl.com/sharing-nvidia-gpus-at-the-system-level-time-sliced-and-mig-backed-vgpus/> (Colfax)
- <https://markaicode.com/integrate/nvidia-container-toolkit-with-vllm/>
- <https://www.linkedin.com/pulse/deep-dive-nvidia-gpu-virtualization-passthrough-mig-vgpu-markevich-xt2ze>
- <https://mlcommons.org/benchmarks/inference-datacenter/> (MLCommons)
- <https://infohub.delltechnologies.com/en-us/p/mlperf-tm-v1-1-inference-on-virtualized-and-multi-instance-gpus/> (Dell)
