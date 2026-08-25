# Sandbox / Trial Economics — Các nền tảng LLM API thương mại

> Tiểu mục ghi chú nghiên cứu (memo). Tất cả số liệu dưới đây phải có nguồn inline; nếu chưa kiểm chứng được thì ghi "chưa xác nhận".

## Đề cương (các phần sẽ lấp đầy)

1. Bảng tổng quan credit miễn phí + thẻ tín dụng + thời hạn theo nhà cung cấp (OpenAI, Anthropic, Google AI Studio, Cohere, Mistral, Together AI, Fireworks, Modal, Replicate, HF Inference, RunPod, Lambda Labs, OpenRouter, AI/ML API).
2. Rate-limit sandbox so với trả phí.
3. Coupon-style vs recurring credit; seasonal promo; "free forever" tier.
4. Cơ chế lock-in: model giới hạn, không fine-tune, không production.
5. Conversion sandbox → trả phí (số liệu analyst nếu có).
6. Khuyến nghị pattern cho FPT (free bandwidth theo token/GPU-giờ, KYC, voucher).

## Phần 1 — Credit miễn phí & onboarding (draft, đang kiểm chứng)

- **OpenAI**: Số nguồn blog bên thứ ba (Tenorshare, CodeStorez) cho biết OpenAI từng cấp $5 credit trong 3 tháng cho tài khoản mới, *không cần* thẻ tín dụng (xem [ai.tenorshare.com](https://ai.tenorshare.com/ai-analytics/openai-api-key-free)). Ghi chú: cần xác nhận trên docs chính thức vì chính sách có thể đã đổi sau 2024.
- **Anthropic**: Một số blog (yangmao.ai, jameskillick) nói trial $5, không có free tier vĩnh viễn. Cần xác nhận trên console.anthropic.com chính thức.

(còn bổ sung các nhà cung cấp khác sau khi webfetch docs)
