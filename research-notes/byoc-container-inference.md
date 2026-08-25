# BYOC cho Inference trên các nền tảng Managed — Nghiên cứu

Tài liệu thu thập trải nghiệm lập trình (developer UX), thời gian khởi động nguội (cold-start), và mô hình giá (pricing) của phương pháp "bring-your-own-container" (BYOC) cho inference trên các nền tảng managed. Nguồn ưu tiên 2024–2026, docs chính + benchmark third-party.

> **Ghi chú về độ tin cậy**: Những con số cụ thể (p95 cold-start, $/GPU-h, memory cap) được trích từ docs chính hoặc benchmark third-party với link inline. Nếu không tìm được số chính xác, ghi "không xác định" thay vì bịa.

---

## 1. AWS SageMaker Real-time inference BYOC (ECR image + InferenceSpec)

**Cách upload runtime**: BYOC trên SageMaker thực hiện qua Docker image đẩy lên Amazon ECR rồi tham chiếu trong `CreateModel`. Từ ~2023–2024, SDK SageMaker Python SDK v3 giới thiệu `ModelBuilder` + `InferenceSpec` cho phép tách rời "model artifact" (weights, tar package push lên S3) khỏi container code. (Link: [docs.aws.amazon.com — Real-time inference](https://docs.aws.amazon.com/sagemaker/latest/dg/realtime-endpoints.html), [SageMaker V3 InferenceSpec example](https://sagemaker.readthedocs.io/en/stable/v3-examples/inference-examples/inference-spec-example.html))

**InferenceSpec vs BYOC nguyên bản**: `InferenceSpec` cho dev cung cấp logic `load_model`/`invoke` bằng Python thuần bên trong `ModelBuilder` — SageMaker tự build image với base sagemaker-serving-toolkit. BYOC nguyên bản (pre-built image đẩy lên ECR) phù hợp khi cần phụ thuộc hệ điều hành/binary riêng. (Link: [Adapt inference container](https://docs.aws.amazon.com/sagemaker/latest/dg/adapt-inference-container.html))

**vLLM template**: Tháng 11/2025 AWS open-sourced `ml-container-creator` — toolkit BYOC cho SageMaker có sẵn template container cho vLLM và SGLang (transformer-based). (Link: [AWS blog — ml-container-creator](https://aws.amazon.com/blogs/opensource/announcing-ml-container-creator-for-easy-byoc-on-sagemaker/), [awslabs.github.io/ml-container-creator](https://awslabs.github.io/ml-container-creator/aws-sagemaker/))

**Autoscale**: Real-time endpoint hỗ trợ `InstanceCount` min/max + `AutoScalingPolicy` trên CloudWatch `Invocations`/`ApproximateBacklogSize`. Không có scale-to-zero nguyên bản trên real-time (phải dùng Serverless hoặc Async để scale-to-zero). (Link: [Real-time docs](https://docs.aws.amazon.com/sagemaker/latest/dg/realtime-endpoints.html))

## 2. AWS SageMaker Serverless Inference

**Cách upload runtime**: Có thể dùng SageMaker-provided container hoặc BYOC (cùng image như real-time endpoint). Hạn chế: image tối đa 10 GB, không hỗ trợ GPU, không hỗ trợ private Docker registry. (Link: [docs.aws.amazon.com — Serverless endpoints](https://docs.aws.amazon.com/sagemaker/latest/dg/serverless-endpoints.html))

**Memory cap**: RAM từ 1024 MB đến **6144 MB (6 GB)**, các bước nhảy 1024/2048/3072/4096/5120/6144 MB. Kèm 5 GB ephemeral disk. **Quan trọng**: KHÔNG hỗ trợ GPU trên Serverless Inference — đây là hạn chế lớn cho LLM inference. Khuyến nghị "một container — một worker — một model copy". (Link: [serverless-endpoints docs, phần Memory size](https://docs.aws.amazon.com/sagemaker/latest/dg/serverless-endpoints.html))

**Concurrency**: Max 200/endpoint, 50 endpoints/region, tổng 500-1000 concurrency/region tùy region. (Link: [serverless-endpoints docs, phần Concurrent invocations](https://docs.aws.amazon.com/sagemaker/latest/dg/serverless-endpoints.html))

**Cold-start**: Docs chính không đưa con số p95 cụ thể, nhưng công nhận "cold start time phụ thuộc model size, thời gian download model, container startup". CloudWatch metric `OverheadLatency` dùng đo. Có thể giảm bằng **Provisioned Concurrency** (giữ endpoint warm, response trong "milliseconds") — tốn phí thêm. (Link: [Minimizing cold starts](https://docs.aws.amazon.com/sagemaker/latest/dg/serverless-endpoints.html))

**Third-party**: Dev.to báo cáo cold start 60-90 giây cho Whisper trên AWS Lambda EFS, gọi "6GB memory wall" là hạn chế cho LLM. (Link: [Dev.to — Whisper cold starts](https://dev.to/aws-builders/from-3-minute-cold-starts-to-20-seconds-whisper-on-aws-lambda-efs-for-openclaw-9c5))

**Autoscale + scale-to-zero**: Tự động scale lên/xuống theo traffic, **scale-to-zero khi không có request** (docs chính xác nhận). Provisioned Concurrency có thể auto-scale qua Application Auto Scaling. (Link: [Serverless docs](https://docs.aws.amazon.com/sagemaker/latest/dg/serverless-endpoints.html))

**Feature exclusions**: KHÔNG hỗ trợ GPU, Marketplace model packages, private Docker registry, Multi-Model Endpoints, VPC config, network isolation, data capture, multi-variant, Model Monitor, inference pipelines. (Link: [Feature exclusions](https://docs.aws.amazon.com/sagemaker/latest/dg/serverless-endpoints.html))

**Pricing**: Pay-per-use billing theo millisecond + dữ liệu xử lý. Provisioned Concurrency tốn thêm phí theo memory × duration × concurrency. Định mức theo memory increment (1024MB rẻ nhất, 6144MB đắt nhất). (Link: [SageMaker Pricing](https://aws.amazon.com/sagemaker/pricing/))

## 3. AWS SageMaker Async Inference (queue)

_Sắp điền_

## 4. GCP Vertex AI — custom container prediction + Model Registry

**Cách upload runtime**: Vertex AI custom container prediction yêu cầu 2 phần tách rời: (1) **Docker image** build local rồi push lên **Artifact Registry** (`pkg.dev`/`us-docker.pkg.dev`); (2) **Model artifact** (weights) upload lên **Cloud Storage** (`gs://`). Khi deploy online endpoint, Vertex AI combine image + Cloud Storage artifact path qua `Model` resource. (Link: [Colab — SDK_Custom_Container_Prediction.ipynb](https://colab.research.google.com/github/GoogleCloudPlatform/vertex-ai-samples/blob/main/notebooks/official/custom/SDK_Custom_Container_Prediction.ipynb), [Adswerve — Vertex AI Custom Container](https://adswerve.com/blog/how-to-build-a-customized-vertex-ai-container))

**Model Registry**: Vertex AI Model Registry là private registry cho versioned model — pickle/weights file gắn với metadata + container image. Khi deploy lên endpoint, Vertex reference cả image Artifact Registry + model artifact Cloud Storage. (Link: [Vertex AI release notes](https://docs.cloud.google.com/vertex-ai/docs/core-release-notes), [getML Vertex AI — Model Registry](https://getml.com/latest/examples/integrations/vertexai/vertexai/))

**Vertex BYOC hạn chế thực tế**: Một user trên GitHub (AswiniGowda) báo cáo "Vertex's Google-managed prebuilt sklearn container was blocked by an org permission, and Vertex won't serve from Docker Hub — so the model is served by our own image in Artifact Registry". → Vertex AI **chỉ chấp nhận image từ Artifact Registry**, không dùng được Docker Hub trực tiếp. (Link: [github.com/AswiniGowda/vertex-ai-end-to-end](https://github.com/AswiniGowda/vertex-ai-end-to-end))

**Custom Prediction Routines (CPR)**: Tính năng mới cho phép dev viết Python class (thay vì Docker full) implement `load`/`predict` methods, Vertex SDK tự build image từ CPR — gần giống `InferenceSpec` của SageMaker. (Link: [oneuptime — Custom Prediction Routines 2026](https://oneuptime.com/blog/post/2026-02-17-how-to-implement-custom-prediction-routines-with-pre-processing-and-post-processing-on-vertex-ai/view))

**vLLM template**: Không có template vLLM "official" từ Vertex AI tìm được trong lần search này — phải BYO image vLLM từ Artifact Registry.

## 8. Hugging Face Inference Endpoints — custom Docker image

**Cách upload runtime**: HF Inference Endpoints có 2 chế độ — (1) **prebuilt model**: deploy 1-click từ HF Hub; (2) **custom container**: chọn "custom" trong Advanced Configuration UI, chỉ định image (VD `philschmi/vllm-hf-inference-endpoints`) + env vars. Model weights mount từ HF Hub vào `/repository` trong container. (Link: [philschmid.de — vLLM on HF Inference Endpoints](https://www.philschmid.de/vllm-inference-endpoints), [HF docs huggingface_hub — inference_endpoints custom_image](https://huggingface.co/docs/huggingface_hub/v1.1.7/package_reference/inference_endpoints))

**vLLM template**: VD chính thức — Philipp Schmid publish image Docker `philschmi/vllm-hf-inference-endpoints` đóng gói vLLM + path `/repository` cho HF model mount. vLLM docs chính cũng có page deployment riêng cho HF Inference Endpoints với "models optimized for vLLM". Khác với Modal/Baseten, HF **không tự maintain template vLLM "official"**: dev phải BYO image (như philschmi) hoặc dùng community-prebuilt. (Link: [philschmid vLLM HF tutorial](https://www.philschmid.de/vllm-inference-endpoints), [vLLM docs — HF Inference Endpoints](https://docs.vllm.ai/en/v0.16.0/deployment/frameworks/hf_inference_endpoints/))

**Endpoint UI + GPU tier**: UI HF có wizard "Advanced Configuration" cho chọn instance type (T4, A10G, A100, H100, H200), vendor (AWS/GCP), region. Dedicated GPU instances billed **per-hour** (NOT per-request): $0.50–$0.60/hour cho GPU tier thấp, $0.03/hour cho CPU. (Link: [Spheron — HF Inference Endpoints Pricing 2026](https://www.spheron.network/blog/hugging-face-inference-endpoints-pricing-2026/), [HF Hub home — pricing](https://huggingface.co/))

**Cold-start**: Theo Markaicode, HF Inference API thường **không có cold start** vì luôn warm serverless shared. Markaicode vs Modal report: "Hugging Face Inference API is typically faster because there is no cold start. Modal's warm containers match HF latency, but first request after idle may be slower." Lưu ý: cho **dedicated custom endpoints** chính thức cold-start chưa có số p95 từ docs — cần benchmark riêng. (Link: [Markaicode Modal vs HF](https://markaicode.com/vs/modal-vs-huggingface/))

**Autoscale + scale-to-zero**: HF docs chính xác nhận có **scale-to-zero** ("reducing infrastructure costs with scale-to-zero" theo Philipp Schmid blog trích HF docs). Custom container endpoints hỗ trợ min/max replica configuration. (Link: [philschmid vLLM HF tutorial](https://www.philschmid.de/vllm-inference-endpoints))

## 5. Azure ML online endpoints — custom container

**Cách upload runtime**: Azure ML custom container BYOC cho online endpoint (managed hoặc Kubernetes) qua `Environment` với `image` + `inference_config` (liveness/readiness/scoring routes). Có thể dùng Docker Hub image (ví dụ docs chính dùng `docker.io/tensorflow/serving:latest`) hoặc image từ Azure Container Registry. **Model weights tách khỏi image**: Azure mount model vào `/var/azureml-app/azureml-models/<model-name>/<version>` (hoặc `model_mount_path` tùy chọn) — không cần bake weights vào image. (Link: [learn.microsoft.com — how-to-deploy-custom-container](https://learn.microsoft.com/en-us/azure/machine-learning/how-to-deploy-custom-container?view=azureml-api-2))

**YAML pattern chính thức**: Docs chính cung cấp template với `model: {name, version, path}` + `environment: {image, inference_config: {liveness_route, readiness_route, scoring_route}}` + `instance_type` + `instance_count`. Có thể deploy và invoke qua CLI (`az ml online-deployment create -f deploy.yml --all-traffic`) hoặc Python SDK v2 (`ManagedOnlineDeployment`). (Link: [Azure ML custom container docs](https://learn.microsoft.com/en-us/azure/machine-learning/how-to-deploy-custom-container?view=azureml-api-2))

**vLLM trên Azure ML**: Third-party tutorial (Clemens Siebler) mô tả deploy HuggingFace vLLM trên Managed Online Endpoints qua `az ml online-deployment create -f deployment.yml --all-traffic`. Không có template vLLM "official" từ Microsoft — chỉ có template cho TF Serving, TorchServe, Triton trong `azureml-examples`. (Link: [Clemens Siebler — vLLM on Azure ML](https://clemenssiebler.com/posts/vllm-on-azure-machine-learning-managed-online-endpoints-deployment/))

**Cold-start**: Không có số p95 từ docs chính. Endpoints show SLA trong Azure portal; cần kiểm tra monitoring docs. Không rõ có scale-to-zero nguyên bản không (Managed Online Endpoints yêu cầu `instance_count >= 1`).

**Pricing**: Pay-per-hour theo `instance_type` (Standard_DS3_v2, NC-series GPU v.v.). Có chi phí endpoint + chi phí workspace. Xem chi tiết tại [Azure ML Pricing](https://azure.microsoft.com/en-us/pricing/details/machine-learning/). Cần verify $/GPU-h cụ thể.

## 6. Modal — vLLM template + serverless function

**Cách upload runtime**: Modal dùng `modal.Image.from_registry()` cộng thêm `.uv_pip_install()` / `.env()` để xây image trực tiếp trong Python script — KHÔNG cần Dockerfile riêng. Modal tự build và cache image cluster-side; dev push bằng `modal deploy vllm_inference.py`. (Link: [Modal docs/examples/vllm_inference](https://modal.com/docs/examples/vllm_inference))

**vLLM template có sẵn (chính thức)**: Modal publish example "OpenAI-compatible LLM inference with Gemma and vLLM" dùng `@app.server` decorator với `image=vllm_image`, `gpu="H200:N_GPU"`, `scaledown_window=15*MINUTES`, `startup_timeout=10*MINUTES`. Pattern chính:
```python
vllm_image = (
    modal.Image.from_registry("nvidia/cuda:12.9.0-devel-ubuntu22.04", add_python="3.12")
    .entrypoint([])
    .uv_pip_install("vllm==0.21.0")
    .env({"HF_XET_HIGH_PERFORMANCE": "1", "VLLM_LOG_STATS_INTERVAL": "1"})
)
@app.server(image=vllm_image, gpu="H200:1", scaledown_window=15*60, ...)
class Server: ...
```
(Link: [Modal docs vllm_inference](https://modal.com/docs/examples/vllm_inference), [vLLM docs — Modal](https://docs.vllm.ai/en/v0.8.2/deployment/frameworks/modal.html))

**FAST_BOOT flag**: Modal example cung cấp flag `FAST_BOOT` cho phép bật `--enforce-eager` để bỏ qua Torch compile + CUDA graph capture, giảm cold start từ "vài phút" xuống "khoảng 10 giây" khi load từ cache. Ngoài ra Modal có **GPU memory snapshots** để rút ngắn cold start thêm. (Link: [Modal docs vllm_inference — FAST_BOOT section](https://modal.com/docs/examples/vllm_inference))

**Cold-start (third-party)**: Markaicode báo cáo Modal T4 GPU cold start trung bình ~22s, 90% request đầu tiên timeout nếu không có keep-warm. Effloow (2026) báo cáo Modal có "GPU Snapshotting" ở 2025–2026 giảm cold start từ 60-120s xuống thấp hơn. (Link: [Markaicode Modal vLLM Stack](https://markaicode.com/stack/modal-vllm-stack/), [Effloow Modal Labs guide 2026](https://effloow.com/articles/modal-labs-serverless-gpu-vllm-zero-yaml-guide-2026))

**Autoscale + scale-to-zero**: `@app.server` sẽ scale-to-zero khi hết container (`scaledown_window` = thời gian hold ấm). Khi không còn container, request trả **503 Service Unavailable** — client phải retry (pattern trong docs có loop `/health` cho đến khi receive 200). `target_concurrency=100` (số request một replica phục vụ). `MIN_CONTAINERS`/`max_containers` qua `@app.function`. (Link: [Modal docs vllm_inference — testing section](https://modal.com/docs/examples/vllm_inference))

**Container tách weights**: Pattern Modal tách **container image** (CUDA + vLLM binary) khỏi **model weights** — weights lưu ở `modal.Volume` (shared network disk) mount vào `/root/.cache/huggingface` và `/root/.cache/vllm`. Đây GIỐNG pattern BYOM-archive của chúng ta ("image nhỏ, weights tách"). (Link: [Modal docs vllm_inference — Volumes](https://modal.com/docs/examples/vllm_inference))

**Pricing**: Không tìm được $/GPU-h chính thức trong lần fetch này — ghi "không xác định". H100 ~$3.95/hr theo Morphllm comparison (third-party, cần verify docs Modal). (Link: [Morphllm Baseten vs Modal 2026](https://www.morphllm.com/comparisons/baseten-vs-modal))

## 7. Replicate — cog + Dockerfile

**Cách upload runtime**: Replicate dùng Cog (open-source tool) đóng gói model thành container chuẩn — `cog.yaml` (image config) + `cog.py` (predictor interface), Cog tự sinh Dockerfile. Dev chạy `cog login && cog push r8.im/<user>/<model>` để push image về Replicate registry. (Link: [Replicate docs — push-a-model](https://replicate.com/docs/guides/build/push-a-model))

**vLLM template có sẵn**: `replicate/cog-vllm` là repo chính thức cho chạy vLLM qua Cog — đóng gói vLLM thành "Replicate model" chuẩn. (Link: [github.com/replicate/cog-vllm](https://github.com/replicate/cog-vllm))

**Cold-start**: Theo benchmark third-party (Markaicode), Replicate cold start "<1 giây" trên always-warm dedicated deployment, nhưng **10–60 giây cho large models trên shared hardware**. Fixdevs cũng xác nhận "cold starts on shared hardware can run 10–60 seconds for large models". (Link: [Markaicode Replicate vs Modal](https://markaicode.com/vs/replicate-vs-modal/), [Fixdevs — Replicate troubleshooting](https://fixdevs.com/blog/replicate-not-working/))

**Autoscale + scale-to-zero**: Replicate có 2 chế độ — (1) shared/official model: per-prediction queue, scale tự động; (2) **dedicated deployments** (always-on): per-second billing theo GPU class, không có scale-to-zero (always warm). Per Replicate docs, "Always-on dedicated deployment pricing is per-second of GPU time on the selected hardware class". (Link: [aipromptshub — Replicate Rate Limits](https://aipromptshub.co/limits/replicate-rate-limits), [Spheron — Replicate Pricing 2026](https://www.spheron.network/blog/replicate-pricing-2026-per-second-cost/))

**Pricing**: Per-second GPU time, $0.00024/GPU-second cho H100 (third-party, ~$0.864/hr — cần verify docs chính). Không có minimum increment publish. (Link: [DeployBase — Serverless GPU Guide 2026](https://deploybase.ai/articles/serverless-gpu), [Spheron — Replicate Pricing 2026](https://www.spheron.network/blog/replicate-pricing-2026-per-second-cost/))

## 8. Hugging Face Inference Endpoints — custom Docker image

_Sắp điền_

## 9. Baseten Onyx + Standard vLLM template

**Cách upload runtime**: Baseten dùng [Truss](https://pypi.org/project/truss/) (open-source package) — dev tạo thư mục với `config.yaml` mô tả `base_image`, `weights`, `resources`, `docker_server.start_command`, rồi `uvx truss push <dir>`. Baseten build và cache image cluster-side, mirror weights từ `hf://...` qua **Baseten Delivery Network (BDN)**. (Link: [docs.baseten.co/examples/vllm](https://docs.baseten.co/examples/vllm))

**vLLM template (chính thức, copy-paste)**: Docs chính Baseten có YAML pattern chính thức cho vLLM:
```yaml
base_image: { image: "vllm/vllm-openai:v0.12.0" }
docker_server:
  start_command: "vllm serve /models/qwen --served-model-name Qwen/Qwen2.5-3B-Instruct --host 0.0.0.0 --port 8000 --enable-prefix-caching"
  readiness_endpoint: /health
  liveness_endpoint: /health
  predict_endpoint: /v1/chat/completions
  server_port: 8000
weights:
  - source: "hf://Qwen/Qwen2.5-3B-Instruct@aa8e72537993ba99e69dfaafa59ed015b17504d1"
    mount_location: "/models/qwen"
    auth: { auth_secret_name: "hf_access_token" }
resources: { accelerator: L4, use_gpu: true }
runtime: { predict_concurrency: 256, health_checks: {...} }
```
Pattern này **đúng bằng pattern BYOM-archive của FPT**: image nhỏ (`vllm/vllm-openai` từ Docker Hub), weights mount từ HF qua BDN. (Link: [Baseten docs vllm](https://docs.baseten.co/examples/vllm))

**Weights tách image**: BDN mirror model từ Hugging Face về mount vào container trước khi start — "The `weights` block uses the BDN to mirror the model from Hugging Face and mount it at `/models/qwen` before the container starts. vLLM reads weights directly from that path." Về cơ bản là cùng pattern với Modal Volumes. (Link: [Baseten docs vllm](https://docs.baseten.co/examples/vllm))

**Cold-start**: Baseten docs chính công nhận first deploy "mất vài phút" vì pull base image; **scale-up sau sẽ nhanh hơn nhiều vì cache image**. Third-party (Runpod) báo cáo Baseten cold start 5-10 giây cho standard container worker, có thể giảm xuống "sub-200ms" trên FlashBoot-optimized Serverless workers (sau khi BDN release tháng 3/2026). (Link: [Runpod vs Baseten](https://www.runpod.io/articles/guides/runpod-vs-baseten), [Baseten docs vllm — deploy section](https://docs.baseten.co/examples/vllm))

**Pricing**: H100 $6.50/hr (third-party Morphllm 2026) — đắt hơn Modal ($3.95/hr) nhưng cộng thêm per-token Model APIs + tuned serving stack. Cần verify $/GPU-h chính thức từ docs Baseten. (Link: [Morphllm Baseten vs Modal 2026](https://www.morphllm.com/comparisons/baseten-vs-modal))

**Onyx**: "Baseten Onyx" là serving engine riêng của Baseten (private, không tìm được template vLLM riêng cho Onyx trong lần search này — chưa xác nhận có tồn tại như một template public hay chỉ là internal engine). Khuyến nghị: ghi "không xác định" cho Onyx template công khai.

## 10. Anyscale Endpoints — custom container; cluster mode

**Cách upload runtime**: Anyscale docs mô tả "Container-driven development" — dùng **managed base image** có sẵn Python/Ray, hoặc mở rộng base image với phụ thuộc riêng qua Dockerfile/Containerfile. Anyscale support **custom image build** qua Terraform resource `anyscale_container_image_build` (build từ Containerfile). Trên Azure, Anyscale tích hợp Azure Container Registry. (Link: [docs.anyscale.com/development/containers](https://docs.anyscale.com/development/containers), [Terraform anyscale_container_image_build](https://registry.terraform.io/providers/anyscale/anyscale/latest/docs/resources/container_image_build))

**vLLM template**: Anyscale docs vLLM chính thức chỉ ra "Anyscale can rapidly provision production-ready HTTPS endpoints or fault-tolerant batch inference jobs" cho vLLM — chủ yếu dựa trên **Ray Serve** pattern (Ray Serve LLM templates). Docs chính có "Serve LLMs with Anyscale services" với template cho single-GPU đến multi-node cluster. (Link: [vLLM docs — Anyscale](https://docs.vllm.cc/en/latest/deployment/frameworks/anyscale.html), [docs.anyscale.com/llm/serving](https://docs.anyscale.com/llm/serving))

**Cluster mode**: Anyscale = managed Ray, nên inference endpoint chạy trên Ray Serve cluster (single-node hoặc multi-node). Tích hợp Anyscale Jobs (batch) + Anyscale Services (HTTP endpoint). (Link: [docs.anyscale.com/jobs/manage](https://docs.anyscale.com/jobs/manage), [Anyscale on Azure docs](https://learn.microsoft.com/en-us/azure/anyscale-on-azure/))

**Pricing + cold-start**: Không có số p95 hoặc $/GPU-h-specific trong docs chính thức tìm được — Anyscale dùng pricing model "compute resource consumption" + cloud provider billing (chạy trên AKS/GKE + Azure Container Registry billing). Ghi "không xác định" cho con số BYOC pricing cụ thể.

## 11. Beam.cloud / Tensorlake (stateful)

**Beam.cloud**:
- **Cách upload runtime**: Beam cho chạy GPU serverless function qua Python decorator (`@beamvolume`/`@app.endpoint`) — image build tự động từ requirements.txt + Python code. Cũng có hỗ trợ custom Docker image. (Link: [Beam blog — Batch Inference on Serverless GPU](https://www.beam.cloud/blog/batch-inference-serverless-gpu))
- **Scale-to-zero**: Beam support scale-to-zero + per-second billing, tương tự Modal và RunPod. (Link: [Beam blog — Batch Inference on Serverless GPU](https://www.beam.cloud/blog/batch-inference-serverless-gpu), [APIScout Modal vs Beam vs RunPod 2026](https://apiscout.dev/guides/modal-vs-beam-vs-runpod-gpu-inference-api-2026))
- **Cold-start + pricing**: Theo APIScout comparison third-party, Beam có cold start tương tự Modal (vài giây–vài chục giây) — cần verify docs chính cho p95. Cũng theo Morphllm comparison Modal H100 $3.95/hr vs Baseten $6.50/hr nhưng Beam chưa có số authoritative trong lần tìm này — ghi "không xác định".

**Tensorlake**:
- **Cách upload runtime**: Tensorlake serve "stateful Firecracker MicroVMs" cho AI agent, không phải inference engine kiểu vLLM. Sandbox API cho phép code Python chạy trong Firecracker μVM với suspend/resume + snapshot + clone. (Link: [tensorlake.ai](https://www.tensorlake.ai/), [github.com/tensorlakeai/tensorlake](https://github.com/tensorlakeai/tensorlake))
- **Cold-start**: Docs chính Tensorlake public "84ms cold start" cho SQLite benchmark — so với Modal/E2B/Daytona/Vercel — nhưng đây là **sandbox cold start (Firecracker μVM)**, không phải inference engine cold start. LLM serving trên Tensorlake chưa có benchmark public (August 2026). Khuyến nghị dùng số này cẩn thận — **không phải tương đương vLLM cold start**. (Link: [tensorlake.ai — homepage benchmark](https://www.tensorlake.ai/))
- **Stateful**: Điểm khác biệt chính — Tensorlake có **state persist giữa requests** (suspend/resume/snapshot/clone), trong khi Modal/Replicate/RunPod server-hot đều stateless hoặc dùng Volume/Disk riêng. Đây phù hợp cho AI agent với long-running session, **không phù hợp trực tiếp** cho vLLM throughput batch serving. (Link: [ottermind — tensorlake skills](https://ottermind.ai/skills/tensorlake-skills), [tensorlake.ai](https://www.tensorlake.ai/))
- **Pricing**: Có free tier, không tìm thấy $/GPU-h chính thức trong lần search này — ghi "không xác định". (Link: [saasworthy — Tensorlake pricing](https://www.saasworthy.com/product/tensorlake-ai))

## 3. AWS SageMaker Async Inference (queue)

**Cách upload runtime**: Cùng pattern BYOC như Real-time — Docker image đẩy lên ECR, model artifact S3, tham chiếu qua `CreateModel`. (Link: [SageMaker AI Real-time docs](https://docs.aws.amazon.com/sagemaker/latest/dg/realtime-endpoints.html))

**Autoscale + scale-to-zero**: **Async là tùy chọn duy nhất trên SageMaker có scale-to-zero nguyên bản** (Real-time thì không). Hỗ trợ target-tracking policy (scale theo queue depth qua metric `ApproximateBacklogSize`) hoặc step-scaling policy (wake endpoint từ zero ngay khi có backlog). Docs chính HF + AWS re:Post xác nhận pattern này. (Link: [Autoscale an asynchronous endpoint](https://docs.aws.amazon.com/sagemaker/latest/dg/async-inference-autoscale.html), [HF docs — Async Inference embedding TEI](https://huggingface.co/docs/sagemaker/examples/sagemaker-sdk-async-inference-embedding-tei), [Deepgram docs — auto-scaling sagemaker async](https://developers.deepgram.com/docs/auto-scaling-sagemaker-async))

**Cold-start**: Vì hỗ trợ scale-to-zero → async **chấp nhận cold start** để đổi cost zero. Cold start cho async bao gồm cả thời gian download model + start container + load model — không có số p95 chính thức từ docs. Thread trên AWS re:Post báo "SageMaker async doesn't scale down to zero" — nguyên nhân là cấu hình sai `min_capacity=0` và scale-in time; cần đặt đúng. (Link: [AWS re:Post — async scaling issue](https://repost.aws/questions/QU-VVoSpScTIKZ_VMDkBR3lA/sagemaker-async-inference-doesn-t-scale-down-to-zero))

**Pattern request**: Mỗi inference request, SageMaker queue → return S3 output location → khi complete, output cũng vào S3. Client poll S3 hoặc configure SNS notification. (Link: [readmedium — Deploying LLMs with SageMaker Async](https://readmedium.com/deploying-large-language-models-with-sagemaker-asynchronous-inference-c00038b70b3e))

## 10. Anyscale Endpoints — custom container; cluster mode

_Sắp điền_

## 11. Beam.cloud / Tensorlake (stateful)

_Sắp điền_

---

## Pattern BYOC dominant (sắp tổng hợp)

**Pattern dominant BYOC cho inference** là "image nhỏ + weights tách": Gần như toàn bộ các nền tảng 2024–2026 đều đi theo cùng một kiến trúc:

1. **Container image (code + runtime binary)** nhỏ, có thể tái sử dụng giữa nhiều model — đẩy lên registry riêng (SageMaker ECR, Vertex AI Artifact Registry, Azure ML ACR, Anyscale ACR) hoặc registry managed của platform (Modal cluster-side, Replicate Cog registry, Baseten BDN).
2. **Model weights tách rời container image** — lưu tại object storage (S3, GCS, Azure Blob) hoặc HF Hub, mount/snapshot vào container khi boot:
   - **Modal**: `modal.Volume` mount vào `/root/.cache/huggingface` + `/root/.cache/vllm` (cache compilation) — docs chính thức pattern ([Modal docs vllm_inference](https://modal.com/docs/examples/vllm_inference)).
   - **Baseten**: `weights` block trong `config.yaml` mirror từ `hf://...` qua BDN mount vào `/models/<name>` trước khi container start — docs chính thức ([Baseten docs vllm](https://docs.baseten.co/examples/vllm)).
   - **HF Inference Endpoints**: mount HF Hub model vào `/repository` trong container — pattern Philipp Schmid ([philschmid vLLM HF](https://www.philschmid.de/vllm-inference-endpoints)).
   - **Replicate**: Cog bake weights vào image (pattern "cog.yaml + weights同居") — đây là khác biệt đáng kể vs phần còn lại; Replicate tar cả weights + code trong image Cog.
   - **SageMaker Real-time**: model artifact (.tar.gz trên S3) tách khỏi ECR image — same as FPT BYOM-archive pattern.
3. **SageMaker `InferenceSpec` + Vertex CPR + Azure ML PAD** đại diện trend mới hơn: dev viết **Python class** thay vì Docker full, platform tự build image. Đây giảm friction nhưng giảm control (cho pattern inference đơn giản).

**4 template vLLM copy-paste chính thức** (verify trực tiếp từ docs chính):
1. **Modal** `@app.server(image=vllm_image, gpu="H200:1", scaledown_window=15*60)` — image build Python inline, weights qua `modal.Volume`, có `FAST_BOOT` flag cho `--enforce-eager`. ([Modal docs vllm_inference](https://modal.com/docs/examples/vllm_inference))
2. **Baseten** YAML `base_image: vllm/vllm-openai:v0.12.0` + `weights.source: hf://...@<rev>` + `docker_server.start_command: vllm serve /models/qwen` — pattern "image nhỏ — weights mount". ([Baseten docs vllm](https://docs.baseten.co/examples/vllm))
3. **Replicate** `cog-vllm` repo official: đóng gói vLLM qua Cog (`cog.yaml + cog.py`), nhưng weights同居 trong image. ([github.com/replicate/cog-vllm](https://github.com/replicate/cog-vllm))
4. **AWS SageMaker** `ml-container-creator` template vLLM/SGLang (open-source Nov 2025) — BYOC toolkit cho SageMaker. ([AWS blog ml-container-creator](https://aws.amazon.com/blogs/opensource/announcing-ml-container-creator-for-easy-byoc-on-sagemaker/))

HF và Vertex/Anyscale không có template vLLM "official copy-paste" — dev phải BYO image (HF dùng community `philschmi/vllm-hf-inference-endpoints`).

## So sánh pattern BYOM-archive .tar.gz (FPT) vs các nền tảng

Pattern "model artifact là .tar.gz upload + image runtime riêng" của FPT cực kỳ phù hợp với trend **"image nhỏ + weights tách"** dominant của 2024–2026. Cụ thể:

- **Modal Volume** = tương đương FPT's .tar.gz weights ở shared disk. Modal dùng HF cache format, FPT có thể đóng .tar.gz URI-eable tương tự (`hf_cache_vol` raw mount).
- **Baseten BDN** = tương đương FPT's model registry/provider — mirror weights từ HF về mount qua path cố định.
- **SageMaker Real-time BYOC** = pattern gần nhất với FPT: ECR image + S3 artifact (.tar.gz) tách rời. Đây là pattern chính thức docs.
- **Vertex AI custom container** = tới gần: Artifact Registry image + Cloud Storage artifact path.

**Recommendation cho FPT community side-harness**:

1. **Target Modal hoặc Baseten làm reference platform** vì có pattern BYOM-archive gần nhất, docs chính thức có template vLLM copy-paste, weights mount vào path cố định. Mapping: FPT's BYOM archive ≡ Modal/Baseten "weights block" → minimal glue code.
2. **Cho cold-start**: Modal có `FAST_BOOT` + GPU memory snapshots; Baseten có BDN flash-boot (<200ms worker warp-up). FPT nên áp dụng cùng kỹ thuật (cache compilation, snapshot GPU memory state) để reduce cold-start.
3. **Cho scale-to-zero + queue**: SageMaker Async (queue + S3), Modal Serverless (auto-scale-by-concurrency), HF Inference Endpoints (scale-to-zero chính thức) là 3 gợi ý cho workload batch/spikey.
4. **Cho pure per-request (như Replicate)**: phù hợp cho model catalog có prediction queue — không scale-to-zero nhưng có concurrency queue.
5. **Cho stateful AI agent**: Tensorlake Firecracker μVM (84ms cold start sandbox, suspend/resume) phù hợp cho AI agent với state — không phù hợp cho vLLM batch serving.

**Hole осталось không xác định** từ docs chính:
- SageMaker Real-time $/GPU-h cụ thể (pricing page cần fetch trực tiếp).
- Modal $/GPU-h chính thức (docs chỉ nói "per-second billing", "from $X"; comparison third-party H100 $3.95/hr — cần verify docs Modal).
- Anyscale cold-start + $/GPU-h.
- Tensorlake $/GPU-h.
- HF Inference Endpoints p95 cold-start cho dedicated custom endpoint (existing benchmark chỉ cho shared Inference API).

## Source list

**SageMaker Real-time / BYOC / InferenceSpec**
- https://docs.aws.amazon.com/sagemaker/latest/dg/realtime-endpoints.html (2026 docs AWS, fetched 2026-08)
- https://docs.aws.amazon.com/sagemaker/latest/dg/adapt-inference-container.html (2026 docs AWS)
- https://sagemaker.readthedocs.io/en/stable/v3-examples/inference-examples/inference-spec-example.html (SageMaker V3 InferenceSpec example)
- https://docs.aws.amazon.com/sagemaker/latest/dg/how-it-works-modelbuilder-creation.html (ModelBuilder BYOC docs)
- https://aws.amazon.com/blogs/opensource/announcing-ml-container-creator-for-easy-byoc-on-sagemaker/ (Nov 20, 2025 — template vLLM/SGLang)
- https://awslabs.github.io/ml-container-creator/aws-sagemaker/ (ml-container-creator docs)
- https://repost.aws/articles/ARn-6JxSDfTGOj-YNVsV9Abg/how-do-i-use-sagemaker-inference-toolkit-with-bring-your-own-container

**SageMaker Serverless Inference**
- https://docs.aws.amazon.com/sagemaker/latest/dg/serverless-endpoints.html (2026 docs chính, fetched full)
- https://aws.amazon.com/sagemaker/ai/pricing/ (SageMaker Pricing)
- https://dev.to/aws-builders/from-3-minute-cold-starts-to-20-seconds-whisper-on-aws-lambda-efs-for-openclaw-9c5 (Whisper cold start 60-90s, 6GB wall)
- https://oneuptime.com/blog/post/2026-02-12-sagemaker-serverless-inference/view
- https://deploybase.ai/articles/sagemaker-serverless-inference-gpu (2026)

**SageMaker Async Inference**
- https://docs.aws.amazon.com/sagemaker/latest/dg/async-inference-autoscale.html (docs chính — scale-to-zero)
- https://huggingface.co/docs/sagemaker/examples/sagemaker-sdk-async-inference-embedding-tei (HF docs — scale-to-zero pattern)
- https://developers.deepgram.com/docs/auto-scaling-sagemaker-async (Deepgram — async scaling)
- https://repost.aws/questions/QU-VVoSpScTIKZ_VMDkBR3lA/sagemaker-async-inference-doesn-t-scale-down-to-zero (troubleshooting)
- https://readmedium.com/deploying-large-language-models-with-sagemaker-asynchronous-inference-c00038b70b3e (LLM async)
- https://aws.amazon.com/blogs/machine-learning/configuring-autoscaling-inference-endpoints-in-sagemaker/ (autoscaling blog)

**Vertex AI**
- https://colab.research.google.com/github/GoogleCloudPlatform/vertex-ai-samples/blob/main/notebooks/official/custom/SDK_Custom_Container_Prediction.ipynb (Vertex custom container tutorial)
- https://adswerve.com/blog/how-to-build-a-customized-vertex-ai-container (Adswerve — Vertex custom container)
- https://github.com/AswiniGowda/vertex-ai-end-to-end (Vertex BYOC example)
- https://docs.cloud.google.com/vertex-ai/docs/core-release-notes (Vertex release notes — Model Registry sync Dataplex)
- https://oneuptime.com/blog/post/2026-02-17-how-to-implement-custom-prediction-routines-with-pre-processing-and-post-processing-on-vertex-ai/view (Vertex CPR 2026)
- https://getml.com/latest/examples/integrations/vertexai/vertexai/ (getML Vertex — Model Registry)

**Azure ML**
- https://learn.microsoft.com/en-us/azure/machine-learning/how-to-deploy-custom-container?view=azureml-api-2 (Microsoft Learn — custom container docs, fetched full)
- https://learn.microsoft.com/en-us/azure/machine-learning/how-to-deploy-online-endpoints?view=azureml-api-2 (online endpoints docs)
- https://azure.microsoft.com/en-us/pricing/details/machine-learning/ (Azure ML Pricing)
- https://clemenssiebler.com/posts/vllm-on-azure-machine-learning-managed-online-endpoints-deployment/ (vLLM on Azure ML — third-party)
- https://github.com/Azure/azureml-examples/tree/main/cli/endpoints/online/custom-container (azureml-examples custom container)

**Modal**
- https://modal.com/docs/examples/vllm_inference (Modal docs chính thức — vLLM template fetched full)
- https://docs.vllm.ai/en/v0.8.2/deployment/frameworks/modal.html (vLLM docs Modal)
- https://markaicode.com/stack/modal-vllm-stack/ (benchmark T4 22s)
- https://effloow.com/articles/modal-labs-serverless-gpu-vllm-zero-yaml-guide-2026 (GPU snapshotting 2025-2026)
- https://modal.com/ (Modal home — per-second billing)
- https://www.morphllm.com/comparisons/baseten-vs-modal (H100 $3.95/hr Modal vs $6.50 Baseten — third-party)

**Replicate**
- https://replicate.com/docs/guides/build/push-a-model (Cog + push docs)
- https://github.com/replicate/cog-vllm (cog-vllm official repo)
- https://markaicode.com/vs/replicate-vs-modal/ (benchmark — cold start 10-60s large models)
- https://fixdevs.com/blog/replicate-not-working/ (cold starts 10-60s shared)
- https://www.spheron.network/blog/replicate-pricing-2026-per-second-cost/ (per-second pricing 2026)
- https://aipromptshub.co/limits/replicate-rate-limits (dedicated deployment pricing)
- https://library.noroff.dev/ai-ml/replicate-case-study/ (Noroff Case Study — per-second billing)

**Hugging Face Inference Endpoints**
- https://www.philschmid.de/vllm-inference-endpoints (Philipp Schmid — vLLM on HF Endpoints, fetched full)
- https://huggingface.co/docs/huggingface_hub/v1.1.7/package_reference/inference_endpoints (huggingface_hub API)
- https://docs.vllm.ai/en/v0.16.0/deployment/frameworks/hf_inference_endpoints/ (vLLM docs HF Endpoints)
- https://www.spheron.network/blog/hugging-face-inference-endpoints-pricing-2026/ (HF Endpoints Pricing 2026)
- https://markaicode.com/vs/modal-vs-huggingface/ (Modal vs HF cold start comparison)
- https://huggingface.co/ (HF home — pricing starts $0.60/h GPU)

**Baseten**
- https://docs.baseten.co/examples/vllm (Baseten docs chính thức — vLLM template fetched full)
- https://www.morphllm.com/comparisons/baseten-vs-modal (Baseten vs Modal 2026 — pricing)
- https://www.runpod.io/articles/guides/runpod-vs-baseten (Baseten cold start 5-10s, FlashBoot sub-200ms)

**Anyscale**
- https://docs.anyscale.com/development/containers (Anyscale container docs)
- https://docs.vllm.cc/en/latest/deployment/frameworks/anyscale.html (vLLM docs Anyscale)
- https://docs.anyscale.com/llm/serving (Anyscale LLM serving)
- https://registry.terraform.io/providers/anyscale/anyscale/latest/docs/resources/container_image_build (Terraform image build)
- https://learn.microsoft.com/en-us/azure/anyscale-on-azure/ (Anyscale on Azure)
- https://docs.anyscale.com/jobs/manage (Anyscale Jobs)

**Beam.cloud / Tensorlake**
- https://www.beam.cloud/blog/batch-inference-serverless-gpu (Beam — Batch Inference)
- https://apiscout.dev/guides/modal-vs-beam-vs-runpod-gpu-inference-api-2026 (Modal vs Beam vs RunPod 2026)
- https://www.tensorlake.ai/ (Tensorlake home — 84ms cold start SQLite benchmark)
- https://github.com/tensorlakeai/tensorlake (Tensorlake GitHub)
- https://ottermind.ai/skills/tensorlake-skills (Tensorlake Sandbox API)
- https://www.saasworthy.com/product/tensorlake-ai (Tensorlake pricing SaaSworthy)


