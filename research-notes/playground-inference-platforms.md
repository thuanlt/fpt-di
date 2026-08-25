# Playground & Sandbox UI trên các nền tảng inference-hosting chuyên dụng

> Memo nghiên cứu (tiếng Việt, văn xuôi, inline sources). Tập trung vào UI/feature playground mà developer dùng để thử model trước khi deploy dedicated/serverless. Ưu tiên nguồn chính thức + blog feature 2024-2026.

## Outline các phần

1. **Modal** — playground, Functions/apps, file/vision, caching, secret env-editor
2. **Replicate** — prediction playground, "Try", API snippets, schema editor
3. **Together AI** — playground chat/structured + fine-tune sheet
4. **Fireworks AI** — playground, function calling, JSON mode, AI Gateway
5. **Hugging Face** — Inference Endpoints UI, HuggingChat, Inference API, Spaces, Inference Providers (router model)
6. **Baseten** — model explorer, vLLM playground
7. **Anyscale** — Workspaces + playground vLLM + Endpoints
8. **Banana.dev / Beam.cloud / Tensorlake** — kiểm tra còn hoạt động không
9. **RunPod** — Serverless endpoint UI + "Try endpoint"
10. **DigitalOcean / Vultr GPU inference** — kiểm tra
11. **OpenRouter** — orchestrator playground so sánh nhiều model

## Tóm tắt các feature phổ biến — tổng hợp

Xem bảng consolidated đầy đủ ở cuối memo (mục **"5 feature phổ biến nhất và ai thiếu gì"**), phần **"5 yếu tố playground phổ biến (consolidated)"** — bảng đó đã điền đủ thông tin cho tất cả 11 nền tảng. Bảng dưới đây chỉ là outline tham chiếu nhanh.

| Feature | Modal | Replicate | Together | Fireworks | HF | Baseten | Anyscale | RunPod | DO/Vultr | OpenRouter |
|---|---|---|---|---|---|---|---|---|---|---|
| Chat demo | ❌ | ✅ | ✅ | ⚠ logprob-debug | ✅ | ✅ attach deploy | ❌ (đã sunset) | ⚠ JSON Run | ❌ | ✅ 500+ compare |
| Try không đăng ký | ❌ | ⚠ cần sign-in | ❌ | ⚠ cần API key | ⚠ free HF token | ❌ | ❌ | ❌ | ❌ | ✅ free 33 models |
| BYOM upload UI | ❌ code | ✅ Cog push | ⚠ fine-tune base | ⚠ fine-tune | ✅ Hub + container | ✅ CLI + Docker | ❌ | ✅ Docker | ❌ | ❌ orchestrator |
| One-click deploy từ playground | ⚠ modal serve | ✅ | ✅ fine-tune → API | ✅ | ✅ | ✅ | ❌ | ✅ Try → Deploy | ⚠ riêng biệt | ❌ |
| Default | serverless | serverless | serverless | serverless + dedicated | dedicated + serverless | dedicated | enterprise (Ray) | serverless + Pod | VM-GPU / dual | orchestrator |

## 1. Modal

Modal (modal.com) định vị là "high-performance AI infrastructure" với mô hình serverless GPU: route workload qua nhiều cloud/region, lấy GPU trong vài giây, scale-to-zero giữa các request, burst để xử lý demand đột biến ([modal.com homepage](https://modal.com/)). Homepage nhấn mạnh "Run any model or inference engine on H100s, A100s, A10Gs and more" — default rõ ràng là **serverless**, không có chế độ VM-GPU dài hạn kiểu Jupyter; "scale to zero between requests, burst to handle demand" chính là câu marketing cốt lõi.

**Về playground/sandbox UI**: Modal **không có một hosted "playground" UI tập trung** để chat/so sánh model như Replicate hay Together AI. Cách developer tương tác trực diện là qua **Modal Sandbox** — secure container chạy code không tin cậy trên gVisor, với outbound blocking, CIDR allowlist, encrypted tunnels, đã trở thành item cấp API (xem `modal.Sandbox`) ([modal.com/docs/guide/sandboxes](https://modal.com/docs/guide/sandboxes), [morphllm phân tích Modal Sandbox 2026](https://www.morphllm.com/modal-sandbox)). Tính năng này được dùng nhiều cho **agent code execution** hơn là chat playground ([pydantic.dev/docs/ai/harness/modal-sandbox](https://pydantic.dev/docs/ai/harness/modal-sandbox/), [mastra.ai/integrations/sandboxes/modal](https://mastra.ai/integrations/sandboxes/modal)).

Cách "thử model" chuẩn mà docs Modal đề xuất là viết `@modal.function()` + `@modal.web_endpoint(docs=True)` hoặc `@modal.fastapi_endpoint(docs=True)` — `docs=True` thêm "interactive documentation in the browser" (Swagger UI auto-sinh) ([modal.com/docs/examples/basic_web](https://modal.com/docs/examples/basic_web)). Khi đó `modal serve basic_web.py` chạy local và tự hot-reload khi code đổi. Đây là cách "interactive web UI" duy nhất Modal cung cấp out-of-the-box — không phải chat demo hay compare-model.

BKET endpoint example `modal.com/glm-5-endpoint` minh hoạ flow "tạo token cho endpoint" ([source](https://modal.com/glm-5-endpoint)).

Caching, secret env-editor: Modal có `modal.Secret.from_name(...)` cho secret management, dùng được trong Sandbox ([modal-examples anthropic_computer_use.py](https://github.com/modal-labs/modal-examples/blob/main/13_sandboxes/anthropic_computer_use.py)). Tuy nhiên đây là SDK/config, không phải UI bảng điền env — không thấy secret env-editor visual UI trên docs chính thức.

Tóm tắt Modal: chuẩn dev-first, **không có hosted playground UI** để compare model — mô hình "viết code → serve → Swagger UI" thay thế cho playground. Default serverless, không có chế độ VM-GPU per-session (Pod) như RunPod.

## 2. Replicate

Replicate có **Playground** riêng tại `replicate.com/playground` — tagline "Run and compare models. A space to generate media on Replicate, the playground encourages rapid-fire experimentation, fast-feedback loops, and easy comparison of models" ([replicate.com/playground](https://replicate.com/playground)). Trang Playground liệt kê 3 chế độ: "Compare models / Rapidly prototype / Tweak and refine". Tuy nhiên trang web fetch trực tiếp yêu cầu **desktop/laptop** (không hỗ trợ mobile) và nút duy nhất là "Sign in to begin" — **không dùng được không đăng nhập** qua gateway `/playground`, vì trang tự động redirect tới `replicate.com/signin?next=/playground` ([replicate.com/playground](https://replicate.com/playground), verify ngày 24 Aug 2026).

Bên cạnh Playground tập trung, mỗi **model page** cũng có UI điền input và "Run" prediction trực tiếp (so với mô tả blog secondary "the playground on the Replicate website. No account is needed to test models this way — just open a model page" ([doc.techparlons.com](https://doc.techparlons.com/docs/replicate/))). Nguồn Enterprise DNA 2026 cho biết "New accounts typically receive a small amount of free credit so you can run a handful of test predictions without adding a card" ([enterprisedna.co Replicate guide](https://enterprisedna.co/resources/guides/guide-replicate-api-tutorial/)) — tức **có thể thử free với credit welcome, không cần credit card** lúc đăng ký nhưng vẫn cần sign in. Homepage khẳng định "no credit card required" cho storyboard workflow ([storylineforge.com](https://storylineforge.com/blog/free-ai-storyboard-tool-how-to-use-replicate-with-no-subscription/)).

Replicate hỗ trợ **autoscale** serverless với mô tả "model can take a while to become ready", có "cold boot" cho model ít dùng ([replicate.com/docs run-a-model](https://replicate.com/docs/topics/models/run-a-model)). Predictions có object JSON đầy đủ với `metrics.predict_time` và `total_time`, `status` (succeeded/failed/canceled), `urls.cancel/get` ([replicate.com/docs/topics/predictions](https://replicate.com/docs/topics/predictions)) — đây là đặc trưng endpoint serverless prediction-oriented.

**Code snippet & hooks**: Docs Replicate có trang chủ đề riêng cho [Streaming output](https://replicate.com/docs/topics/predictions/streaming), [Webhooks](https://replicate.com/docs/topics/webhooks), [OpenAPI schema](https://replicate.com/docs/reference/openapi) và [HTTP API](https://replicate.com/docs/reference/http) — xem cây sidebar của docs. Có SDK Node.js, Python, Google Colab với "Get started" guide riêng ([replicate.com/docs](https://replicate.com/docs)). SDK client support realtime/output streaming và webhook verification đều có trang docs riêng.

**BYOM / custom deploy**: Replicate dùng **Cog** (open-source) để đóng gói custom model thành container có thể deploy. Docs có [Deploy a custom model](https://replicate.com/docs/get-started/deploy-a-custom-model) và [Push your own model](https://replicate.com/docs/guides/build/push-a-model) — luồng là: viết `cog.yaml` + `predict.py` → `cog push` → model xuất hiện trên Hub. Đây chính là BYOM bằng **Docker image được Cog quản lý**, không trực tiếp upload .safetensors. Banana.dev sunset blog cũng xác nhận: "Replicate also support custom deployments via Cog" ([banana.dev/blog/sunset](https://www.banana.dev/blog/sunset)).

**Deployments** (dedicated): Replicate có khái niệm [Deployments](https://replicate.com/docs/topics/deployments) riêng (Create/View/Monitor/Delete) — đây là chế độ dedicated vs prediction serverless default. Tuy nhiên Default vẫn là multi-tenant serverless với cold boot.

Tóm tắt Replicate: có cả Playground tập trung (compare) + try-on-model-page + Docs snippet đa ngôn ngữ + streaming + webhook + BYOM qua Cog + Deployments dedicated — feature-rich, **default là serverless multi-tenant**, sign in cần thiết.

## 3. Together AI

Cùng với Together AI có **Playground** là web app để khách chạy inference mà không dùng API: "The Playground is a web application offered by together.ai to allow our customers to run inference without having to use our API. The playground can be used with standard models, or a selection of fine-tuned models" ([support.together.ai](https://support.together.ai/articles/1539893583-what-is-the-together-ai-playground)).

Có **2 mode** Playground phân tách rõ: chat (`api.together.ai/playground?display_type=chat`) và fine-tuning (`api.together.xyz/playground/finetuning`) — Together định vị tách bạch rõ giữa inference playground và fine-tune sheet ([api.together.ai/playground](https://api.together.ai/playground?display_type=chat), [api.together.xyz/playground/finetuning](https://api.together.xyz/playground/finetuning)).

Yêu cầu **đăng nhập** (Google/LinkedIn/GitHub) — homepage nói rõ "Inference on leading open-source models. No daily rate limits. Fine-tune with your own private data" ([api.together.xyz/playground/finetuning](https://api.together.xyz/playground/finetuning)). Không có try-without-signup.

Fine-tune UI tách rành: homepage nói "Fine-tune large open-source models like Kimi-K2 and GLM-4.7 for tool use, reasoning, and agentic tasks. Drive advanced model behavior through a single API without managing underlying training infrastructure" ([together.ai/fine-tuning](https://www.together.ai/fine-tuning)). Docs fine-tune có dedicated quickstart ([docs.together.ai/docs/fine-tuning/quickstart](https://docs.together.ai/docs/fine-tuning/quickstart)).

**Default serverless**: Together là full-stack AI platform inference + fine-tuning + GPU clusters ([together.ai homepage](https://www.together.ai/)) — default cho model-as-API là serverless multi-tenant.

**BYOM upload UI**: docs fine-tune cho phép upload dataset riêng ("Fine-tune with your own private data") nhưng **BYOM ở dạng upload .safetensors không thấy trong docs chính thức** — Together tập trung vào fine-tune từ base model có sẵn catalog. Sau fine-tune trên Together, model tinh chỉnh có thể deploy ngay qua API — đây là **flow "Try playground → fine-tune → deploy as API"** gần nhất với one-click deploy.

## 4. Fireworks AI

Fireworks có **Generation Playground** tại `demos.fireworks.ai/generation-playground.html` — đây là một demo UI đặc biệt **không phải chat demo bình thường**: cho "see exactly how the Fireworks API tokenizes your prompt before it reaches the model, and inspect the per-token logprobs of the completion. It's pre-loaded with a prompt injection demo that shows how `safe_tokenization` defends against control-token smuggling" ([demos.fireworks.ai/generation-playground.html](https://demos.fireworks.ai/generation-playground.html)).

Yêu cầu **Fireworks API key** nhập vào panel "Configuration" để chạy (chưa verify hết được liệu có cần signup hay dùng trial, phải có api-key). Khi nhấn "Run" playground gửi request với `echo: true` và `logprobs` auto-inject. Có toggle **Safe Tokenization** on/off và **Compare Grammar**: "Compare the Effect of Grammar" + "Disable Grammar" — đây là **JSON mode / grammar-guided generation** debug UI, độc đáo so với các playground chat bình thường. Response hiển thị tokens màu theo confidence (xanh=cao, đỏ=thấp), hover xem logprobs & top-5 alternatives.

Trang Demos tổng hợp `demos.fireworks.ai` mô tả: "Visualize how chat templates tokenize your prompts, explore completion logprobs with confidence colors, and compare safe vs. unsafe tokenization side-by-side" ([demos.fireworks.ai](https://demos.fireworks.ai/)).

**Function calling & JSON mode**: là đặc trưng cốt lõi: "Fireworks specializes in compound AI systems with features like function calling, JSON mode, and grammar-guided generation" ([respan.ai](https://www.respan.ai/market-map/compare/fireworks-ai-vs-runpod)). "FireFunction is Fireworks AI's optimized function calling inference offering" ([ithub.directory](https://www.ithub.directory/ai-platforms-generative-ai/fireworks-ai)). Docs hoàn chỉnh cho completions API và chat completions API ([docs.fireworks.ai/guides/completions-api](https://docs.fireworks.ai/guides/completions-api), [docs.fireworks.ai/guides/querying-text-models](https://docs.fireworks.ai/guides/querying-text-models)).

**Serverless + Dedicated**: docs nói rõ "Query models via serverless inference or dedicated deployments using the chat completions API (recommended), completions API, or responses API" — nghĩa là Fireworks toggle giữa hai chế độ trong cùng docs flow ([docs.fireworks.ai/guides/querying-text-models](https://docs.fireworks.ai/guides/querying-text-models)). Catalog models tại `fireworks.ai/models` ([fireworks.ai/models](https://fireworks.ai/models)).

**AI Gateway UI**: chưa verify được UI cụ thể qua fetch; cần thêm điều tra docs chính thức.

## 5. Hugging Face

Hugging Face phân bố feature playground thành các sản phẩm tách biệt:

### a) Inference Endpoints (dedicated)

Inference Endpoints là "managed service to deploy your AI model to production" — có UI deploy tại `endpoints.huggingface.co` ([huggingface.co/docs/inference-endpoints/index](https://huggingface.co/docs/inference-endpoints/index), [endpoints.huggingface.co](https://endpoints.huggingface.co/)). Trang endpoint có tùy chọn container: "The Default container is the easiest way to deploy endpoints, and is very flexible thanks to custom Inference Handlers. You can also select a container optimized for Text-Generation inference, or link your own Custom container" ([endpoints.huggingface.co/new?repository=llm-wizard/router_llm](https://endpoints.huggingface.co/new?repository=llm-wizard/router_llm)).

Có thể deploy bất kỳ model nào trên Hub vào endpoint trong vài phút, bằng prompt với coding agent: "Use your favorite coding agent to spin up an optimized Hugging Face Inference Endpoint for any Hugging Face model, in a single prompt". Có hỗ trợ **vLLM engine** cho Inference Endpoints dedicated: "vLLM is a high-performance, memory-efficient inference engine for open-source LLMs. It delivers efficient scheduling, KV-cache handling, batching, and decoding—all wrapped in a production-ready server" ([huggingface.co/docs/inference-endpoints/engines/vllm](https://huggingface.co/docs/inference-endpoints/engines/vllm)). Đây chính là **BYOM uploader pattern** của HF: chọn model từ Hub → chọn container/engine → deploy.

### b) Inference Providers (router model — gần đây)

Inference Providers là HF's unified platform cho serverless inference qua các third-party providers, ra mắt trong 2024-2025 ([deepwiki 2026-07-30](https://deepwiki.com/huggingface/hub-docs/4.2-inference-providers)). Đặc trưng: "Instant Access to Cutting-Edge Models", "Zero Vendor Lock-in" (multi-provider), **OpenAI-compatible** drop-in cho chat completions. Các partner có: Baseten, Cerebras, Cohere, DeepInfra, Fal AI, Featherless AI, Fireworks, Groq, Novita, Nscale, OVHcloud, Public AI, Replicate, Scaleway, Together, WaveSpeedAI, Z.ai ([huggingface.co/docs/inference-providers/index](https://huggingface.co/docs/inference-providers/index)).

**Provider selection policy**: `:fastest` (default — highest throughput), `:cheapest` (lowest price/output token), `:preferred` (theo preference order user set). Truy cập qua `https://router.huggingface.co/v1/...` OpenAI-compatible, hoặc SDK `@huggingface/inference` JS + `huggingface_hub` Python ([docs chính thức](https://huggingface.co/docs/inference-providers/index)).

**Free tier**: "Inference Providers includes a generous free tier, with additional credits for PRO users and Team & Enterprise organizations". Forum confirm router đôi khi có divergence giữa UI và router thực tế khi backend có cached snapshot / override (e.g. Fireworks) ([discuss.huggingface.co](https://discuss.huggingface.co/t/hugging-face-inference-providers-inference-through-cheapest-variant-does-not-work-correctly/171851/1)).

### c) Inference Playground

Docs chính thức nói: "explore models interactively with our [Inference Playground](https://huggingface.co/playground). Test different chat completion models with your prompts and compare responses to find the perfect fit for your use case" ([docs Inference Providers](https://huggingface.co/docs/inference-providers/index)). Đây là **playground web UI** để thử chat completion qua nhiều provider. Cũng có thể list model từ CLI: `hf models ls --warm` (model được serve bởi ≥1 provider).

### d) HuggingChat & Spaces

HuggingChat là chat app riêng cho橱 thị model open (đã có từ lâu). Spaces là hosted app demo cho cộng đồng — không phải trực tiếp playground "try model before deploy".

Tóm tắt HF: HAI lớp tách bạch — **Inference Endpoints (dedicated)** để deploy và **Inference Providers (serverless router multi-provider)** để try API, với **Inference Playground** làm UI tương tác thử model chat. BYOM qua Hub upload model + chọn container/custom handler. Default Inference Endpoints là dedicated VM, còn Inference Providers là serverless multi-tenant.

## 6. Baseten

Baseten ra mắt **Playground** chính thức ngày **20 Aug 2024** — đây là bản "enhanced and rebranded" của dialog "Call Model" cũ: "We're excited to announce the launch of the **Playground** — an enhanced and rebranded version of the 'Call Model' dialog. The Playground is now accessible from anywhere within a model, allowing you to interact with your deployments seamlessly while viewing logs and metrics, streamlining the debugging process and making it easier to iterate and test your models" ([baseten.co/resources/changelog/model-playground](https://www.baseten.co/resources/changelog/model-playground/)). Đặc trưng nổi bật là **"interact with your deployments while viewing logs and metrics"** — Playground gắn với deployment đã có sẵn, debug song song, không chỉ chat khô.

Baseten định vị là "Inference Platform: Deploy AI models in production" — "Serve open-source, custom, and fine-tuned AI models on infra purpose-built for high-performance inference at massive scale. Test new workloads, prototype products, or evaluate the latest AI models optimized to be the fastest in production — instantly" ([baseten.co homepage](https://www.baseten.co/)). Sản phẩm chính: **Dedicated Inference**, **Model APIs** (serverless multi-tenant cho model catalog), **Training**, **Model Labs**. Có **Model library** công khai (`/library/`) với DeepSeek V4 Pro 0813, Kimi K3, GLM-5.2 Fast, DeepSeek-V4-Flash-0731, Whisper Large V3, Qwen3.8-27B ([baseten changelog](https://www.baseten.co/resources/changelog/model-playground/)).

**BYOM via vLLM/SGLang/custom Docker**: docs nói "You can select an engine in config.yaml, let Baseten select one for a supported architecture, or run a server such as vLLM or SGLang in a custom Docker container" ([docs.baseten.co/overview](https://docs.baseten.co/overview)). Tutorial cụ thể: "Deploy Qwen 2.5 3B Instruct on an L4 with vLLM's OpenAI-compatible API. You'll define the model in config.yaml, then use the Baseten CLI to deploy and manage it" ([docs.baseten.co/development/model/build-your-first-model](https://docs.baseten.co/development/model/build-your-first-model)) — tức BYOM qua config.yaml + CLI, không phải UI upload file trực tiếp.

**Deployment options**: Cloud, Self-hosted, Hybrid ([baseten.co](https://www.baseten.co/)). SOC 2 Type II, HIPAA compliant. Uptime 99.94% ([status.baseten.co](https://status.baseten.co/)). HF Inference Providers cũng partner với Baseten cho chat/VLM ([huggingface.co/docs/inference-providers/index](https://huggingface.co/docs/inference-providers/index)).

Tóm tắt Baseten: có Playground gắn với deployment (logs/metrics song song), BYOM qua CLI/config.yaml + vLLM/SGLang/custom Docker, default có cả Dedicated Inference (VM-GPU warm) lẫn Model APIs (serverless) — định vị **default là dedicated**, serverless chỉ cho model catalog Model APIs.

## 7. Anyscale

**Quan trọng**: Anyscale đã **sunset multi-tenant Endpoints API vào August 2024**. "Anyscale sunset its multi-tenant Endpoints API in August 2024. For displaced users looking for an OpenAI-compatible private LLM endpoint without enterprise contracts, Auxen is a direct migration target" ([auxen.ai/compare/anyscale](https://auxen.ai/compare/anyscale)). Vì vậy mọi tài liệu cũ về "Anyscale Endpoints playground chat" đều **đã lỗi thời** — Endpoints không còn multi-tenant, giờ là sản phẩm enterprise.

Anyscale giờ tập trung vào **Anyscale Workspaces** — "A Scalable Interactive ML Development Environment with Zero Setup" (Ray Summit talk) ([classcentral description](https://www.classcentral.com/course/youtube-anyscale-workspaces-a-scalable-interactive-ml-development-environment-with-zero-setup-319374), [toolify tóm tắt 2025](https://www.toolify.ai/ai-news/experience-the-power-of-anyscale-workspaces-simplifying-ml-development-with-zero-setup-2297134)): "workspaces within the Any Scale platform make it possible for developers to enjoy the simplicity of local development while seamlessly transitioning into production when they're ready to scale. Endpoints: Simplifying the API Experience".

Workspaces là môi trường dev interactive dựa trên **Ray** (Ray Serve cho inference production): "Anyscale uses Ray Serve on the backend to offer fast and high throughput model inference" ([datacamp LLMOps tools 2026](https://www.datacamp.com/blog/llmops-tools)). Workspace-level observability built-in: "use Anyscale's workspace-level observability to see what's happening on the cluster itself in real time without changing the training code" ([docs.anyscale.com/llm/fine-tuning/observability-and-tracking](https://docs.anyscale.com/llm/fine-tuning/observability-and-tracking)).

Tóm tắt Anyscale: **không còn playground chat công khai** từ sau Aug 2024 (multi-tenant Endpoints đã sunset). Sản phẩm chính cho dev là **Anyscale Workspaces** (interactive dev env dựa trên Ray), không phải hosted try-before-deploy playground như Replicate/Together. Default là enterprise-dedicated trên Ray/Kubernetes, không phải serverless multi-tenant.

## 8. Banana.dev / Beam.cloud / Tensorlake

### Banana.dev — ĐÃ SUNSET

Banana đã **sunset serverless GPU platform**: blog chính thức "Sunsetting Serverless GPUs" đăng ngày **1 Feb 2024** với thông báo "On March 31st, in two months, Banana infrastructure will be shut down at noon PST. Please ensure that your GPU services are migrated to a new provider by this time" ([banana.dev/blog/sunset](https://www.banana.dev/blog/sunset)). Lý do: "Given current runway, traction, retention, shifting AI macro trends, supply-constrained GPU markets, and a deeper understanding of the engineering required, we've realized that we do not have the time and resources to hit that spec [reliable, cost-effective, fast, easy]".

Banana gợi ý migration sang: (model-as-API) OpenAI, Replicate, Anyscale Endpoints, Together.ai, Fireworks.ai; (custom code serverless) **Runpod Serverless** ("the easiest, most 'banana-like' experience"), Replicate (via Cog), **Modal** ("Python/data platform that's recently become adored by its users for GPU hosting"); (VM) Shadeform, Brev.dev ([banana.dev/blog/sunset](https://www.banana.dev/blog/sunset)). Homepage hiện tại vẫn hiển thị trang cũ nhưng tất cả CTA "Get Started" link tới `/blog/sunset` — tức toàn bộ onboarding đã inactive (verify 24 Aug 2026).

### Beam.cloud — vẫn active

Beam.cloud vẫn active mạnh. Homepage tagline: "Serverless GPUs and Sandboxes — Run inference, agents, and task queues on our cloud, or bring your own AWS, GCP, or bare metal. Sub-second cold starts, no rate limits. 4090s from $0.69/hr" ([beam.cloud](https://www.beam.cloud/)). Sản phẩm: **Inference** (serverless endpoints), **Task Queues**, **Sandboxes** (secure code execution). Định vị: "On-Demand AI Compute — Run sandboxes, task queues, and custom model inference with ultrafast boot times, instant autoscaling, and a developer experience that just works" ([beam.cloud](https://www.beam.cloud/)).

**Code-first, không có hosted playground UI**: pattern tương tự Modal — `from beam import Image, endpoint` + `@endpoint(gpu="H100", image=Image().add_python_packages(["vllm"]))` + `$ beam deploy`. Docs khẳng định "Beam lets you run functions, REST APIs, task queues, and sandboxes on CPUs and GPUs, end to end. There's no infrastructure to manage and no YAML to write: you define everything in code, and Beam runs it in containers that launch in under a second" ([docs.beam.cloud/v2/getting-started/introduction](https://docs.beam.cloud/v2/getting-started/introduction)). Có runtime open-source `beta9` ([github.com/beam-cloud/beta9](https://github.com/beam-cloud/beta9)).

**BYOM**: "Host any custom model on GPU or CPU. Bring your own image" ([beam.cloud](https://www.beam.cloud/)). Có support ComfyUI, vLLM, Whisper ([/use-cases/llm-inference](https://www.beam.cloud/use-cases/llm-inference), [/use-cases/comfyui](https://www.beam.cloud/use-cases/comfyui)). Có $30 free credit refreshed monthly ([beam.cloud homepage footer](https://www.beam.cloud/)). Tóm tắt Beam: **default serverless**, code-first, không có playground chat UI hosted.

### Tensorlake — đã pivot

Tensorlake đã **pivot hoàn toàn** khỏi inference-hosting. Định vị mới (2025-2026): "Tensorlake Cloud is a platform for document ingestion and data orchestration. Parse real-world documents with human-like layout understanding and build Python-based workflows at scale and ready for production" ([producthunt awards 2025](https://www.producthunt.com/products/tensorlake/awards)). Sản phẩm giờ là **Sandboxes** (microVMs), **Snapshots** (pause/fork/resume), **Cloud Volumes** ([tensorlake.ai](https://www.tensorlake.ai/)). Product Hunt ranking #5 of day, May 16 2025, với category dữ liệu không cấu trúc — không phải inference ([aipure.ai product review](https://aipure.ai/products/tensorlake)).

Tóm tắt: trong phạm vi "inference-hosting playground", **Tensorlake không còn phù hợp** — đã pivot sang document workflow + AI agent sandboxes.

## 9. RunPod

RunPod có **Serverless Endpoint UI** với "Try" tích hợp — docs chính thức minh hoạ flow tạo endpoint: chọn "+ New Endpoint" → "Import from Docker Registry" → nhập container image URL → chọn GPU → "Deploy Endpoint" ([docs.runpod.io/serverless/get-started](https://docs.runpod.io/serverless/get-started)).

Sau khi endpoint active, có tab **Requests** trong endpoint detail page — đây chính là **"Try endpoint" UI**: "On the left you should see the default test request" (JSON input `{"input": {"prompt": "Hello World"}}`), click **Run** — kết quả trả về bên phải với `delayTime`, `executionTime`, `workerId`, `status` ([docs.runpod.io/serverless/get-started](https://docs.runpod.io/serverless/get-started)).

**BYOM tất-cả-qua-Docker**: RunPod serverless yêu cầu worker code đóng gói thành Docker image, push lên Docker Hub, rồi import URL vào endpoint: "Build your Docker image" + "Push the image to your container registry" + "Import from Docker Registry" ([docs.runpod.io/serverless/get-started](https://docs.runpod.io/serverless/get-started)). Có thể deploy từ GitHub repository. Có sẵn worker templates cho vLLM (`runpod/worker-v1-vllm`), ComfyUI, SDXL ([github.com/runpod-workers](https://github.com/orgs/runpod-workers/repositories)). Auto-scaling, **docker-native workflow**, **template marketplace** ([vultr-vs-runpod comparison](https://www.aimadetools.com/blog/vultr-vs-runpod-gpu-cloud/)).

**Cả serverless + Pod (VM-GPU on-demand)**: RunPod có cả Serverless (mới, recommended) và Pods (GPU VM / JupyterLab / Web terminal) ([aimadetools comparison](https://www.aimadetools.com/blog/vultr-vs-runpod-gpu-cloud/)). Default cho thử model là Serverless với "Try endpoint" UI như trên. Cần tạo RunPod account trước ([docs.runpod.io/serverless/get-started](https://docs.runpod.io/serverless/get-started)).

## 10. DigitalOcean / Vultr GPU inference

### DigitalOcean — "1-Click Models" trên GPU Droplets

DigitalOcean (DO) ra mắt **1-Click Models** trên GPU Droplets collaboration với Hugging Face: "Getting Started with 1-Click Models on GPU Droplets - A Guide to Llama 3.1 with Hugging Face" ([DO GPU Droplets](https://www.digitalocean.com/products/gpu-droplets)). Đây là collaboration với Hugging Face HUGS — "Choose 1-Click Models on DigitalOcean. Configure the remaining options, and click on 'Create GPU Droplet'" ([huggingface.co/docs/hugs/how-to/cloud/digital-ocean](https://huggingface.co/docs/hugs/how-to/cloud/digital-ocean)).

Sau khi GPU Droplet chạy, user tương tác qua **cURL, Python requests, hoặc OpenAI library syntax**: "users can interact with the deployed models using cURL, the Python requests library, or the OpenAI library syntax" ([DediRock blog 2025](https://dedirock.com/blog/transforming-your-1-click-model-gpu-droplets-into-a-smart-personal-assistant/)). GPU Droplets mesh với DOKS (Kubernetes), CLI, API, Terraform ([DO GPU Droplets](https://www.digitalocean.com/products/gpu-droplets)). NVIDIA H100, RTX 4000 Ada, RTX 6000 Ada, L40S ([hostscore](https://hostscore.net/choose/best-gpu-server-hosting/)). Có **GPU Observability** mới ra 2025 ([cloudaz.io](https://cloudaz.io/gpu-observability-hieu-sau-hon-ve-droplets-va-doks-clusters/)). Có DeepSeek R1, ERNIE 4.5, Llama Vision-Instruct ([block.nqigeek 2025](https://block.nqigeek.space/blog/JamesDigitalOcean/digitalocean-vision-instruct-gpu-droplets), [linkedin ERNIE 4.5 1-Click](https://www.linkedin.com/pulse/translating-bulk-documents-ernie-45-1-click-gpu-droplets-xrzjc)).

Tóm tắt DO: 1-Click Models là **deployed VM endpoint**, không phải hosted playground để compare nhiều model. Default là **VM-GPU Droplet** (khi bật), không phải serverless. Cần account + đăng ký.

### Vultr — Serverless Inference (2024-2026)

Vultr ra mắt **Serverless Inference** ngày **17 Oct 2024**: "With Vultr Serverless Inference, you can intelligently deploy models without the complexities of infrastructure management or model training, enabling seamless scalability and enhanced performance for modern AI applications" ([blogs.vultr.com/serverless-inference](https://blogs.vultr.com/serverless-inference)). Sản phẩm: "Vultr Serverless Inference enables a hassle-free global inference process" — supports models developed trên Vultr Cloud GPU, on-prem, hoặc cloud khác ([vultr.com/products/cloud-inference](https://www.vultr.com/products/cloud-inference/)). Trước đó ra Cloud Inference ngày 18 Mar 2024 ([businesswire 2024-03-18](https://www.businesswire.com/news/home/20240318972363/en/Vultr-Launches-Cloud-Inference-to-Simplify-Model-Deployment-and-Automatically-Scale-AI-Applications-Globally/)).

Vultr có cả **Cloud GPU** VMs (NVIDIA/AMD, 33 locations) và **Serverless Inference** — dual mode. Provision guide docs có ([docs.vultr.com/products/compute/serverless-inference/provisioning](https://docs.vultr.com/products/compute/serverless-inference/provisioning)). Tuy nhiên GitHub issue 2026 phản ánh: "Outdated model names and missing UI element to add custom models or remove obsolete ones" ([github.com/anomalyco/opencode/issues/27947](https://github.com/anomalyco/opencode/issues/27947)) — chưa verify playground chat UI tính năng đầy đủ.

So sánh với RunPod: quan điểm trái chiều "RunPod offers a serverless GPU option that Vultr simply doesn't have" ([aimadetools](https://www.aimadetools.com/blog/vultr-vs-runpod-gpu-cloud/)). Default cho developer với workload playground: có thể là Serverless Inference subscription, không có try-without-signup.

Cả DO và Vultr đều **không có hosted playground UI** để compare nhiều model — chỉ có 1-click deploy / serverless inference endpoint. Cần đăng ký + setup trước.

## 11. OpenRouter (orchestrator playground)

OpenRouter là orchestrator/comparison playground mạnh nhất cho thử nhiều model trên cùng UI. Trang `openrouter.ai/chat` tagline: "Compare LLMs on a single prompt with OpenRouter. Test and evaluate responses from OpenAI, Google, Anthropic, and 500+ AI models in one chat interface" ([openrouter.ai/chat](https://openrouter.ai/chat)).

Có thể so sánh song song: "Compare 500+ LLMs from OpenAI, Anthropic, Google, Meta and more — pricing, context length, and benchmarks side by side, all through one API" ([openrouter.ai/models](https://openrouter.ai/models)). Mỗi model có **/playground** riêng với metadata đầy đủ (release date, knowledge cutoff, context, $/M tokens) — ví dụ `openrouter-web.vercel.app/google/gemma-3-4b-it/playground` ([source](https://openrouter-web.vercel.app/google/gemma-3-4b-it/playground)). Có chức năng "Compare" tách biệt ngoài "Chat".

**Free tier lớn**: "33 free models available — no credit card required" cho OpenRouter API key ([free-model.com 2026](https://free-model.com/providers/openrouter/)). Có **Free Models Router** dynamically chọn từ 25 free models, "smartly filtering for models that support the features needed for each request — image understanding, tool calling, and structured outputs" ([freellm.net](https://freellm.net/models/openrouter/openrouter-free)). Secondary source: "OpenRouter Playground provides chat service with 25+ free AI models, including GPT-4, Claude 3.5, Gemini Pro and more top models. Run multiple models simultaneously. Compare output quality. Compare response speed" ([getfreeai.net](https://getfreeai.net/en/services/chatbot/openrouter/)). Có hiện sẵn docs quickstart, Apps, Benchmarks, Rankings ([openrouter.ai/chat nav](https://openrouter.ai/chat)).

**Streaming**: API implement SSE streaming (OpenAI-compatible `stream: true`).

**OpenRouter không phải inference-hosting**: đây là **API gateway/orchestrator** route request tới OpenAI, Anthropic, Google, Together, Fireworks, Groq, v.v. — không tự deploy model. Không có BYOM upload UI, không có "one-click deploy to endpoint".

Tóm tắt: OpenRouter mạnh nhất cho thử nhiều model trên cùng UI, có free tier lớn không cần credit card, default là **orchestrator** (serverless-ish multi-tenant của các upstream provider).

## 5 feature phổ biến nhất và ai thiếu gì

Dựa trên 11 nền tảng đã nghiên cứu, 5 feature playground phổ biến nhất:

1. **Chat demo thử model (input → output text)** — có ở: Replicate, Together, HF Inference Playground, Baseten, OpenRouter, Fireworks (Generation Playground dạng logprob debug). **Thiếu**: Modal, Beam.cloud, Anyscale, RunPod (chỉ có "Run" JSON input, không phải chat UX), DigitalOcean, Vultr.

2. **Code snippet đa ngôn ngữ (curl / Python / JS)** — có ở: Replicate (docs đa SDK + SDK Python/Node/Colab), Together, Fireworks, HF Inference Providers (4 cách Python + JS + cURL + http), Baseten (CLI + config), RunPod (handler.py + Dockerfile template), OpenRouter. Modal/Beam dùng SDK Python vì code-first, không có tab snippet do không có hosted playground. DigitalOcean có cURL/Python/OpenAI client sau deploy.

3. **Streaming server-sent events** — có ở: Replicate (trang Streaming Output riêng), Together (OpenAI-compatible stream), Fireworks, HF Inference Providers, OpenRouter, Baseten, RunPod (dedicated worker vLLM). Modal/Beam/streaming nằm trong SDK code, không hiện thị trong UI.

4. **So sánh nhiều model song song ("Compare")** — có mạnh ở: OpenRouter (Compare + /chat UI 500+ model), HF Inference Playground, Fireworks (Generation Playground with grammar compare). Replicate có `/playground` với focus compare. **Thiếu**: Modal, Beam, Baseten (single-deployment), Together (single chat không compare nhiều), RunPod, DO, Vultr.

5. **Tools gắn với deploy ("Try → one-click deploy to endpoint")** — có ở: RunPod (Try endpoint UI + Deploy Endpoint đặt cạnh nhau), Replicate (Cog push → Deployments), Baseten (Playground gắn với deployment đã có + logs/metrics), HF (Inference Playground → Inference Endpoints), Fireworks (Playground → serverless/dedicated). Together có flow fine-tune → deploy. Modal/Beam dùng `modal serve`/`beam deploy` từ code → endpoint auto. **Thiếu ở**: Anyscale (đã sunset Endpoints multi-tenant), OpenRouter (orchestrator thuần, không deploy), DigitalOcean/Vultr (1-click deploy là OK nhưng không có "playground → deploy" cùng UI seamless).

**Ai thiếu gì rõ ràng nhất**:

- **Modal & Beam.cloud**: thiếu hosted playground UI hoàn toàn — code-first thuần. Muốn "thử model trước deploy" phải viết code hàm + `modal serve` (Modal) hoặc `beam deploy` (Beam).
- **Anyscale**: thiếu playground chat public kể từ Aug 2024 — đã sunset multi-tenant Endpoints, giờ chỉ còn Workspaces enterprise.
- **Banana.dev**: đã shutdown hoàn toàn (Mar 2024), không còn tồn tại.
- **Tensorlake**: đã pivot khỏi inference, sang document ingestion/sandbox cho agent.
- **DigitalOcean & Vultr**: có 1-Click Models / Serverless Inference nhưng không có playground chat so sánh — đã đăng ký + 1-click deploy mới chạy được.
- **OpenRouter**: mạnh playground nhưng thiếu BYOM/deploy — không bao giờ tự host model.
- **Fireworks**: Generation Playground chỉ debug tokenizer/logprob/grammar, không phải chat "thử" thông thường — niche technique debug, khó dùng như chat demo đại trà.

**5 yếu tố playground phổ biến (consolidated)**:

| Feature | Modal | Replicate | Together | Fireworks | HF | Baseten | Anyscale | RunPod | DO/Vultr | OpenRouter |
|---|---|---|---|---|---|---|---|---|---|---|
| Chat demo | ❌ (code-first) | ✅ Playground + page | ✅ chat mode | ⚠ logprob-debug | ✅ Inference Playground | ✅ attach deployment | ❌ (đã sunset) | ⚠ JSON Run (không chat) | ❌ (1-click deploy) | ✅ 500+ compare |
| Param control | qua code | ✅ inputs + versions | ✅ trong Playground | ✅ (request body) | ✅ Playground | ✅ + logs/metrics | ❌ | ✅ input JSON | ❌ qua API | ✅ |
| Snippet curl/py/js | trong docs | ✅ đa SDK docs | ✅ docs | ✅ docs | ✅ 4 cách + SDK | ⚠ CLI/config | ❌ | ✅ Docker + handler template | ✅ post-deploy | ✅ (quickstart) |
| Streaming | trong SDK | ✅ trang riêng + webhook | ✅ OpenAI-compat | ✅ | ✅ OpenAI-compat | ✅ + logs stream | ❌ | ✅ worker vLLM | ⚠ post-deploy | ✅ SSE |
| Save/load session | ❌ | ⚠ Share Prediction | ❌ chưa xác nhận | ❌ | ❌ | ✅ workspace persistent | ⚠ workspace snapshot | ❌ | ❌ | ⚠ Conversation history |
| Try không đăng ký | ❌ | ⚠ cần sign-in (lỗi nguồn blog) | ❌ cần sign-in | ⚠ cần API key | ⚠ free tier HF token | ❌ | ❌ | ❌ | ❌ | ✅ free models (33) |
| BYOM upload UI | ❌ code | ✅ Cog push | ⚠ fine-tune from base | ⚠ via fine-tune | ✅ Hub upload + container choice | ✅ CLI + custom Docker | ❌ | ✅ Docker image | ❌ | ❌ thuần orchestrator |
| One-click deploy từ playground | ⚠ modal serve | ✅ Cog push + Deployments | ✅ fine-tune → API | ✅ serverless/dedicated | ✅ Playground → Endpoints | ✅ Playground → deployment | ❌ | ✅ Try → Deploy | ⚠ 1-click deploy riêng | ❌ |
| Default VM-GPU vs serverless | serverless | serverless (multi-tenant) | serverless | serverless + dedicated | dedicated (Endpoints) + serverless (Providers) | dedicated | enterprise (Ray) | serverless + Pod | VM-GPU (DO) / dual (Vultr) | orchestrator (request routing) |

## Nguồn (verify ngày 24 Aug 2026)

**Modal**
- https://modal.com/ — homepage
- https://modal.com/glm-5-endpoint
- https://modal.com/docs/guide/sandboxes
- https://modal.com/docs/examples/basic_web
- https://www.morphllm.com/modal-sandbox
- https://mastra.ai/integrations/sandboxes/modal
- https://github.com/modal-labs/modal-examples/blob/main/13_sandboxes/anthropic_computer_use.py
- https://markaicode.com/tutorial/modal-tutorial-production-setup-guide/

**Replicate**
- https://replicate.com/playground (fetch 24 Aug 2026)
- https://replicate.com/explore
- https://replicate.com/docs/topics/predictions
- https://replicate.com/docs/topics/predictions/streaming
- https://replicate.com/docs/topics/webhooks
- https://replicate.com/docs/topics/deployments
- https://replicate.com/docs/get-started/deploy-a-custom-model
- https://replicate.com/docs/guides/build/push-a-model
- https://replicate.com/docs/topics/models/run-a-model.md
- https://sdks.replicate.com/resources/predictions/
- https://enterprisedna.co/resources/guides/guide-replicate-api-tutorial/ (secondary)
- https://storylineforge.com/blog/free-ai-storyboard-tool-how-to-use-replicate-with-no-subscription/ (secondary)
- https://doc.techparlons.com/docs/replicate/ (blog secondary — chưa verify)

**Together AI**
- https://www.together.ai/ — homepage
- https://www.together.ai/fine-tuning
- https://support.together.ai/articles/1539893583-what-is-the-together-ai-playground
- https://api.together.ai/playground?display_type=chat
- https://api.together.xyz/playground/finetuning
- https://docs.together.ai/docs/fine-tuning/quickstart

**Fireworks AI**
- https://fireworks.ai/models
- https://demos.fireworks.ai/generation-playground.html (fetch 24 Aug 2026)
- https://demos.fireworks.ai/
- https://docs.fireworks.ai/guides/completions-api
- https://docs.fireworks.ai/guides/querying-text-models
- https://www.respan.ai/market-map/compare/fireworks-ai-vs-runpod (comparison)
- https://ithub.directory/ai-platforms-generative-ai/fireworks-ai (directory)

**Hugging Face**
- https://huggingface.co/docs/inference-endpoints/index
- https://huggingface.co/docs/inference-providers/index (fetch 24 Aug 2026)
- https://huggingface.co/docs/inference-endpoints/engines/vllm
- https://endpoints.huggingface.co/
- https://endpoints.huggingface.co/new?repository=llm-wizard/router_llm
- https://huggingface.co/docs/hugs/how-to/cloud/digital-ocean
- https://github.com/huggingface/huggingface_hub (docs inference_endpoints)
- https://deepwiki.com/huggingface/hub-docs/4.2-inference-providers
- https://discuss.huggingface.co/t/hugging-face-inference-providers-inference-through-cheapest-variant-does-not-work-correctly/171851/1

**Baseten**
- https://www.baseten.co/ — homepage
- https://www.baseten.co/resources/changelog/model-playground/ (fetch 24 Aug 2026, post 20 Aug 2024)
- https://docs.baseten.co/overview
- https://docs.baseten.co/development/model/build-your-first-model
- https://status.baseten.co/

**Anyscale**
- https://auxen.ai/compare/anyscale (sunset Aug 2024)
- https://docs.anyscale.com/llm/fine-tuning/observability-and-tracking
- https://www.classcentral.com/course/youtube-anyscale-workspaces-...
- https://www.toolify.ai/ai-news/experience-the-power-of-anyscale-workspaces-...
- https://www.datacamp.com/blog/llmops-tools (Ray Serve backend)
- https://costbench.com/software/llm-api-providers/anyscale/ (pricing 2026)

**Banana.dev / Beam.cloud / Tensorlake**
- https://www.banana.dev/blog/sunset (fetch 24 Aug 2026 — sunset 1 Feb 2024)
- https://www.beam.cloud/ (fetch 24 Aug 2026)
- https://docs.beam.cloud/v2/getting-started/introduction
- https://github.com/beam-cloud/beta9
- https://www.tensorlake.ai/
- https://www.producthunt.com/products/tensorlake/awards (Product Hunt 2025)
- https://aipure.ai/products/tensorlake

**RunPod**
- https://docs.runpod.io/serverless/get-started (fetch 24 Aug 2026)
- https://github.com/orgs/runpod-workers/repositories
- https://www.aimadetools.com/blog/vultr-vs-runpod-gpu-cloud/

**DigitalOcean / Vultr**
- https://www.digitalocean.com/products/gpu-droplets
- https://www.digitalocean.com/products/gpu-droplets (1-Click Models + HF Llama 3.1)
- https://dedirock.com/blog/transforming-your-1-click-model-gpu-droplets-into-a-smart-personal-assistant/
- https://block.nqigeek.space/blog/JamesDigitalOcean/digitalocean-vision-instruct-gpu-droplets
- https://cloudaz.io/gpu-observability-hieu-sau-hon-ve-droplets-va-doks-clusters/
- https://hostscore.net/choose/best-gpu-server-hosting/
- https://blogs.vultr.com/serverless-inference (ra mắt 17 Oct 2024)
- https://www.vultr.com/products/cloud-inference/
- https://www.vultr.com/products/cloud-gpu/
- https://docs.vultr.com/products/compute/serverless-inference/provisioning
- https://www.businesswire.com/news/home/20240318972363/en/Vultr-Launches-Cloud-Inference... (2024-03-18)
- https://github.com/anomalyco/opencode/issues/27947 (outdated model UI 2026)
- https://www.vultrbonus.com.br/en/blog/vultr-vs-digitalocean-gpu (so sánh 2026)

**OpenRouter**
- https://openrouter.ai/chat (fetch 24 Aug 2026)
- https://openrouter.ai/models
- https://openrouter-web.vercel.app/google/gemma-3-4b-it/playground
- https://free-model.com/providers/openrouter/ (free tier 33 models)
- https://freellm.net/models/openrouter/openrouter-free (Free Models Router)
- https://getfreeai.net/en/services/chatbot/openrouter/ (secondary)

**Cross-platform / so sánh chung**
- https://introl.com/blog/serverless-gpu-platforms-runpod-modal-beam-comparison-guide-2025
- https://github.com/thu-ml/SageAttention (ICLR/ICML 2025, không liên quan direct)
- https://vllm.ai/blog/2026-01-02-introducing-vllm-playground (vLLM Playground reference)

## Ghi chú về độ tin cậy và gap nghiên cứu

- **Anyscale Endpoints**: tài liệu chính thức gốc về "Anyscale Endpoints console / playground chat" trước Aug 2024 không còn trực tiếp truy cập được qua search; kết luận dựa trên blog Auxen (post-2024) + Ray Summit talks + DataCamp 2026. Đây là **dead product**, không truy cập lại UI được.
- **Banana.dev**: toàn bộ blog sunset vẫn còn up; screenshots UI cũ có thể khác lúc còn sống. UI hiện tại ở `/features` và `/pricing` vẫn render các page marketing cũ nhưng CTA "Get Started" đều link tới `/blog/sunset`, nghĩa là onboarding đã inactive.
- **Fireworks AI Gateway UI**: chưa verify được UI cụ thể của "AI Gateway" qua fetch; docs focus vào API completions/chat completions, gateway feature có thể nằm trong phần account/dashboard không public.
- **Vultr Serverless Inference playground UI**: GitHub issue 2026 phản ánh "missing UI element to add custom models" — tức playground/settings có nhưng không hoàn chỉnh; chưa fetch trực tiếp console do cần đăng nhập.
- **Together AI chat playground param control / streaming/save session**: trong memo đánh dấu "chưa xác nhận" vì webfetch các URL playground redirect tới sign-in page (`api.together.ai/playground?display_type=chat` không public content, phải authenticated).
- **Replicate "no account needed for try":** mâu thuẫn giữa blog secondary `doc.techparlons.com` (no account needed) và webfetch trực tiếp `replicate.com/playground` (yêu cầu "Sign in to begin"). Kết luận: trang `/playground` chắc chắn cần sign in; chỉ ra model page riêng "Try" có thể không cần, nhưng welcome credit vẫn yêu cầu account tạo (theo Enterprise DNA 2026).

