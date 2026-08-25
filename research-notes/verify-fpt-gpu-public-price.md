# Verify REFUTE — FPT SmartCloud GPU public pricing

**Sub-question (claim cần refute):** "FPT SmartCloud chỉ công khai giá cho 2 SKU GPU raw — RTX PRO 6000 Blackwell ở $2.19/GPU·h và HGX B300 ở $6.99/GPU·h. Mọi SKU container/serverless/dedicated đều 'contact sales' / cần login."

**Ngày verify:** 2026-08-24
**Nguồn chính:** fptcloud.com, factory.fpt.ai, ai.fptcloud.com, marketplace.fptcloud.com (tất cả ở loudly public domain, không cần login để xem trang landing/pricing).

## TL;DR kết luận

Claim **SURVIVES naturaleza đồ hoá** cho phát biểu chặt: chỉ có đúng 2 SKU GPU raw có **bảng giá công khai theo tier (1x/2x/4x/8x) trên một trang public** — B300 ($6.99-55.92/GPU·h) và RTX PRO 6000 Blackwell ($2.19-17.51/GPU·h). H100/H200 không có bảng giá theo SKU công khai; giá "starting at $2.5/hr" có xuất hiện trên trang GPU Container nhưng không phải bảng SKU đầy đủ. Bảng đầy đủ_rent-button_ dẫn tới login portal (`ai.fptcloud.com`, `ai.fptcloud.jp`).

Tuy nhiên claim **FAILS một phần** ở mệnh đề "Mọi SKU container/serverless đều contact sales / cần login": (i) trên trang `factory.fpt.ai/gpu-container` có hiển thị công khai một con số "$2.5/hour starting" cho H100/H200; (ii) `marketplace.fptcloud.com` công khai giá serverless inference theo output (e.g. FPT.AI whisper-large-v3-turbo: $0.0297/minute public), không phải "contact sales".

Do đó claim SURVIVES cho phát biểu chính (chỉ 2 SKU raw GPU có bảng giá công khai theo giờ) nhưng FAILS cho mệnh đề phụ "mọi serverless đều cần login".

## Bằng chứng chính — trang `factory.fpt.ai/gpu-virtual-machine`

Trang [GPU Virtual Machine](https://factory.fpt.ai/gpu-virtual-machine) (public, không login, fetch 2026-08-24) hiển thị hai sản phẩm có **bảng giá đầy đủ theo 1x/2x/4x/8x tier**:

**NVIDIA HGX B300** — "Get instant access to NVIDIA HGX B300 GPU Cloud. Starting from **$6.99/GPU hour**":
- 1x GPU B300 (288GB GPU Memory, 192GB RAM, 28 cores CPU): **$6.99/Hour**
- 2x GPU B300 (384GB RAM, 56 cores CPU): **$13.98/Hour**
- 4x GPU B300 (768GB RAM, 112 cores CPU): **$27.96/Hour**
- 8x GPU B300 (2.2 TB GPU Memory, 1536GB RAM, 224 cores CPU): **$55.92/Hour**

Nút [Rent] → `https://ai.fptcloud.com/gpu-virtual-machine` (portal login).

**NVIDIA RTX PRO 6000 Blackwell Server Edition** — "Access NVIDIA RTX PRO 6000 GPU Cloud On Demand. Starting from **$2.19/GPU hour**":
- 1x RTX PRO 6000 (96GB HBM3, 192GB RAM, 28 cores CPU): **$2.19/Hour**
- 2x: **$4.38/Hour**
- 4x: **$8.76/Hour**
- 8x: **$17.51/Hour**

Nút [Rent] → `https://neo.fpt.ai/login` (login portal).

**Phần H100/H200 trên cùng trang** có **bảng SKU đầy đủ theo tier nhưng KHÔNG có cột Price** — chỉ có nút [Rent] dẫn tới `ai.fptcloud.com/pricing/gpu-virtual-machine` (đây là SPA React, webfetch chỉ trả `<div id="root">` rỗng — giá phải render sau khi login/JS). Mô tả: "Tap into cutting-edge NVIDIA GPUs like the H100 and H200". Tên tier "H100 GPU VM" / "H200 GPU VM" ở header, nhưng trong bảng chỉ thấy specification (e.g. "1x GPU H100 SXM5, 80GB HBM3, 192GB RAM | 16 cores CPU | 3TB NVMe") — **không có số dollar**.

Đây là bằng chứng trực tiếp cho claim: bảng giá đầy đủ theo SKU public chỉ tồn tại cho 2 SKU Blackwell. H100/H200 có bảng spec và nút Rent, không có price cell.

## Bằng chứng bổ sung — trang `factory.fpt.ai/gpu-container`

Trang [GPU Container](https://factory.fpt.ai/gpu-container) (public, fetch 2026-08-24) — đây là trang product cho SKU container chạy H100/H200. Tiêu đề marketing: "Tap into cutting-edge NVIDIA GPUs like the H100 and H200, starting at just **$2.5 per hour**." Đây là **một con số публично visible** — không cần login. Tuy nhiên:

- Bảng SKU H200 GPU Instance hiển thị 8 tier (1x→8x GPU H200 SXM5, 141GB HBM3 each) với specification đầy đủ (RAM, cores, NVMe) nhưng **cột Price không có dữ liệu** — chỉ có nút [Rent] → `ai.fptcloud.jp/gpu-containers` (portal Nhật, login required).
- Bảng H100 GPU Instance được tham chiếu trong toggle "H200 GPU Instance / H100 GPU Instance / Storage" nhưng webfetch không capture nội dung bảng H100 — có nghĩa là nó render động (JS) hoặc cũng không có price cell.

Vì vậy $2.5/hr là **con số marketing "starting at"**, không phải bảng per-SKU công khai. Khẳng định của claim rằng SKU container cần login để xem giá đầy đủ là chính xác; nhưng mệnh đề "contact sales / cần login" **không áp dụng tuyệt đối** vì $2.5/hr đã được công khai trên landing page.

## Bằng chứng marketplace — `marketplace.fptcloud.com`

Trang [FPT AI Marketplace](https://marketplace.fptcloud.com/) (public, không login) hiển thị danh sách model serverless inference. Ví dụ giá công khai theo output không cần login:

- [FPT.AI-whisper-large-v3-turbo](https://marketplace.fptcloud.com/en/models/fpt-ai-whisper-large-v3-turbo): "Hosted by FPT, **$0.0297/Minute**, Try in Playground, Request Dedicated Inference" — mô tả "Speech to Text".

Đây là giá **serverless inference theo output (per minute / per token)**, không phải giá GPU raw theo giờ. Do đó:

- Mệnh đề "Mọi SKU serverless đều contact sales / cần login" **FAILS** — marketplace công khai giá inference per-output.
- Nhưng vì đây là giá model inference (per-min/per-token), không phải giá GPU SKU raw (per-GPU·h), nó **không trực tiếp mâu thuẫn** phát biểu chính của claim về "2 SKU GPU raw công khai theo giờ". Dedicated Inference trên marketplace vẫn "[Request Dedicated Inference]" (contact sales).

## News FPT AI Factory — "GPU VM with On-Demand Pricing"

Bài viết [GPU Virtual Machine is Now Available with On-Demand Pricing on FPT AI Factory](https://factory.fpt.ai/news/gpu-virtual-machine-is-now-available-with-on-demand-pricing-on-fpt-ai-factory) (Jan 29, 2026) cho biết GPU VM (H100/H200) chính thức có **"Pay-As-You-Go pricing, second-level billing"** — tuy nhiên bài viết **không công bố con số giá cụ thể**; CTA dẫn tới `ai.fptcloud.com/undefined/gpu-virtual-machine` (portal login) và trang pricing SPA `ai.fptcloud.com/pricing/gpu-virtual-machine` (JS-rendered, không scrape được không login). Điều này **ủng hộ claim**: H100/H200 có on-demand pricing về mặt sản phẩm nhưng con số chỉ hiển thị sau khi đăng nhập.

Bài insight [GPU as a Service](https://factory.fpt.ai/ai-insights/gpu-as-a-service) nhắc "12-month H100 commitment around $2,448/month per GPU vs $3000-4500 in hourly charges" — đây là *estimation ví dụ* trong blog về so sánh hourly vs reserved, không phải bảng giá SKU chính thức, và cũng không nằm trên trang pricing chính thức.

## Product name "FPT.GPUaas" / "FPT GPU as a Service"

Không tìm thấy SKU/brand chính thức nào có tên "FPT.GPUaas" hay "FPT GPUaas" trên các trang FPT công khai. Tên sản phẩm chính thức là **"FPT GPU Cloud"** với 4 sub-product: GPU Container, GPU Virtual Machine, Metal Cloud (contact sales), GPU Cluster (contact sales). [factory.fpt.ai](https://factory.fpt.ai/) và [ai.fptcloud.com](https://ai.fptcloud.com/) dùng tên "FPT AI Factory" / "FPT GPU Cloud". Truy vấn "FPT.GPUaas" / "FPT GPUaas" / "GPU a as a service" trên web search không trả về sản phẩm có tên đó — có vẻ là cách gọi informal cho [GPU as a Service insight blog](https://factory.fpt.ai/ai-insights/gpu-as-a-service), không phải product SKU. **Premise "FPT.GPUaas" tồn tại như product riêng — không được xác nhận**.

## A100 / L4 / L40S

Search "fptcloud.com A100", "fptcloud.com L40S", "fptcloud.com L4", và trang product FPT không trả về SKU nào với tên A100, L4, hay L40S trên public pricing. Công khai chỉ đề cập L40S trong bài [RTX PRO 6000 Blackwell news](https://factory.fpt.ai/news/nvidia-rtx-pro-6000-blackwell-powering-ai-rendering-and-simulation) như đối chiếu ("~4X faster vs L40S") — FPT không bán L40S riêng theo giá giờ public. A100, L4 cũng không xuất hiện trên pricing page công khai. **Không có bằng chứng FPT công khai giá A100/L4/L40S**.

## Phân loại sản phẩm FPT GPU Cloud — bảng đối chiếu claim

| Sản phẩm | SKU | Giá công khai per-GPU·h? | Liên kết |
|---|---|---|---|
| GPU Virtual Machine | RTX PRO 6000 Blackwell | **CÓ** ($2.19-17.51) | [factory.fpt.ai/gpu-virtual-machine](https://factory.fpt.ai/gpu-virtual-machine) |
| GPU Virtual Machine | HGX B300 | **CÓ** ($6.99-55.92) | [factory.fpt.ai/gpu-virtual-machine](https://factory.fpt.ai/gpu-virtual-machine) |
| GPU Virtual Machine | H100 SXM5 | KHÔNG (login portal) | [ai.fptcloud.com/pricing/gpu-virtual-machine](https://ai.fptcloud.com/pricing/gpu-virtual-machine) |
| GPU Virtual Machine | H200 SXM5 | KHÔNG (login portal) | [ai.fptcloud.com/pricing/gpu-virtual-machine](https://ai.fptcloud.com/pricing/gpu-virtual-machine) |
| GPU Container | H100 / H200 | "$2.5/hr starting" marketing, full grid login | [factory.fpt.ai/gpu-container](https://factory.fpt.ai/gpu-container) |
| Metal Cloud | H100/H200 bare metal | KHÔNG (contact sales) | [factory.fpt.ai/contact-us](https://factory.fpt.ai/contact-us) |
| GPU Cluster | reserved capacity | KHÔNG (contact sales) | [factory.fpt.ai/gpu-cluster](https://factory.fpt.ai/gpu-cluster) |
| Serverless Inference (Marketplace) | theo model (whisper, etc.) | CÓ giá per-output ($0.0297/min) | [marketplace.fptcloud.com](https://marketplace.fptcloud.com/) |
| Dedicated Inference | theo model, private | KHÔNG (contact sales) | [factory.fpt.ai/contact-us](https://factory.fpt.ai/contact-us) |

## Kết luận

**Claim SURVIVES** cho phát biểu chính và chặt: FPT công khai **bảng giá theo tier (per-GPU·hour) cho đúng 2 SKU GPU raw** — RTX PRO 6000 Blackwell ($2.19/GPU·h starting) và HGX B300 ($6.99/GPU·h starting) — trên [factory.fpt.ai/gpu-virtual-machine](https://factory.fpt.ai/gpu-virtual-machine). Mọi SKU H100/H200/A100/L4/L40S không có bảng giá per-SKU công khai (cần login portal `neo.fpt.ai` hoặc `ai.fptcloud.com(.jp)`).

**Claim FAILS một phần** cho mệnh đề phụ "Mọi SKU container/serverless/dedicated đều contact sales / cần login":
- (i) `factory.fpt.ai/gpu-container` công khai con số "starting at $2.5/hour" cho H100/H200 trên landing không cần login (tuy chỉ là starting price, không phải full grid).
- (ii) `marketplace.fptcloud.com` công khai giá serverless inference per-output (e.g. [whisper $0.0297/min](https://marketplace.fptcloud.com/en/models/fpt-ai-whisper-large-v3-turbo)) — mâu thuẫn với "serverless cần login".

"Premise FPT.GPUaas là tên product riêng" — không được xác nhận; tên chính thức là "FPT GPU Cloud" / "FPT AI Factory".

## Nguồn

- [factory.fpt.ai/gpu-virtual-machine](https://factory.fpt.ai/gpu-virtual-machine) — trang public với bảng giá B300 + RTX PRO 6000 đầy đủ, fetch 2026-08-24.
- [factory.fpt.ai/gpu-container](https://factory.fpt.ai/gpu-container) — trang public H100/H200 container, "starting at $2.5/hour", grid login-gated, fetch 2026-08-24.
- [factory.fpt.ai/news/gpu-virtual-machine-is-now-available-with-on-demand-pricing-on-fpt-ai-factory](https://factory.fpt.ai/news/gpu-virtual-machine-is-now-available-with-on-demand-pricing-on-fpt-ai-factory) — Jan 29, 2026, công bố H100/H200 on-demand nhưng không có con số giá.
- [factory.fpt.ai/ai-insights/gpu-as-a-service](https://factory.fpt.ai/ai-insights/gpu-as-a-service) — blog ví dụ H100 reserved $2,448/mo vs $3000-4500 hourly.
- [ai.fptcloud.com/pricing](https://ai.fptcloud.com/pricing) — SPA React, không scrape được không login.
- [ai.fptcloud.com/pricing/gpu-virtual-machine](https://ai.fptcloud.com/pricing/gpu-virtual-machine) — SPA, login-gated.
- [marketplace.fptcloud.com](https://marketplace.fptcloud.com/) — serverless inference marketplace public.
- [marketplace.fptcloud.com/en/models/fpt-ai-whisper-large-v3-turbo](https://marketplace.fptcloud.com/en/models/fpt-ai-whisper-large-v3-turbo) — public price $0.0297/min.
- [factory.fpt.ai/news/nvidia-rtx-pro-6000-blackwell-powering-ai-rendering-and-simulation](https://factory.fpt.ai/news/nvidia-rtx-pro-6000-blackwell-powering-ai-rendering-and-simulation) — đề cập L40S như đối chiếu, FPT không bán L40S public.
- [fptcloud.com/en/pricing](https://fptcloud.com/en/pricing/) — trang pricing tenant FPT SmartCloud, hiển thị "H200 Enterprise-Grade Cloud GPUs Built for AI Contact" — H200 contact sales ở tenant khác.
