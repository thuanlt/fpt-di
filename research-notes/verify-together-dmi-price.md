# Verify: Together AI Dedicated Inference giá H100 $5.49/hr & B200 $8.99/hr

**Kết luận:** SURVIVES. Claim ĐÚNG — cả hai số đều công khai trên trang pricing chính của Together AI (kể cả docs và marketing page), không phải "contact sales" cho 2 GPU này.

## Nguồn 1 — Docs chính thức (primary, technical)

Trang [docs.together.ai/docs/dedicated-endpoints/pricing](https://docs.together.ai/docs/dedicated-endpoints/pricing) (snapshot 24/08/2026). Đây là trang "Pricing" chính thức cho Dedicated Model Inference (DMI), mô tả cơ chế billing-by-the-minute, per-replica. Bảng "Supported hardware" liệt kê trực tiếp hai giá:

> | GPU         | Hardware ID            | Cost/hour |
> | ----------- | ---------------------- | --------- |
> | H100 80GB   | `1xnvidia-h100-80gb`   | $5.49     |
> | H200 141GB  | `1xnvidia-h200-141gb`  | [Contact sales](https://www.together.ai/contact-sales) |
> | B200 180GB  | `1xnvidia-b200-180gb`  | $8.99     |
> | GB300 280GB | `1xnvidia-gb300-280gb` | [Contact sales] |
> | B300 280GB  | `1xnvidia-b300-280gb`  | [Contact sales] |

Trang cũng nhắc lại trong body: *"A single H100 replica at $5.49/hour costs about $132/day, or roughly $3,950 over a 30-day month, if running continuously."* — xác nhận con số H100 được dùng làm ví dụ chính thức. B200 $8.99 cũng public, không bị che bởi "contact sales" (chỉ H200, GB300, B300 mới yêu cầu contact).

## Nguồn 2 — Trang marketing pricing (together.ai/pricing)

Trang [together.ai/pricing](https://www.together.ai/pricing) (snapshot 24/08/2026), mục "Dedicated Inference", bảng "All prices per gpu per hour":

> | Hardware             | On-demand (Pay as you go) | Reserved      |
> | -------------------- | ------------------------- | ------------- |
> | NVIDIA HGX H100      | **$5.49**                 | Contact sales |
> | NVIDIA HGX B200      | **$8.99**                 | Contact sales |
> | NVIDIA GB200 NVL72   | Contact us                | Contact sales |

Trong JSON-LD/schema markup của trang này cũng lưu `"lowPrice": "5.49"` cho mục `"name": "Dedicated Inference"` — xác nhận đây là giá on-demand public, không giá reservation.

## Phân biệt với sản phẩm khác (tránh nhầm)

Lưu ý: cùng trang together.ai/pricing liệt kê **GPU Clusters** (sản phẩm khác, raw-GPU rental, user tự serve) với giá thấp hơn: H100 $3.99/hr, B200 $8.19/hr on-demand. Đây KHÔNG phải Dedicated Container/DMI — DMI là managed inference (Together phục vụ model cho user), còn GPU Cluster là raw VM. Claim ban đầu nói rõ "Dedicated Container Inference" → Bezug tới DMI $5.49/$8.99, không phải Cluster $3.99/$8.19. Cần cẩn thận để không trích nhầm con số cluster.

Một số nguồn third-party (aipedia.wiki) đưa giá khác (H100 $6.49, B200 $11.95) — có vẻ là dữ liệu cũ hoặc dùng cho sku khác. Nguồn chính của Together AI hiện tại (snapshot hôm nay) đồng nhất $5.49/$8.99 cho on-demand, không cho_reserve (reserve = "contact sales"). Usagepricing.com cũng xác nhận có đợt cut giá tháng 07/2026 hạ H100 xuống $5.49 và B200 xuống $8.99.

## Kết luận cuối

**SURVIVES** — Claim "Together AI Dedicated Container Inference công bố giá H100 $5.49/hr và B200 $8.99/hr public" chính xác theo snapshot 24/08/2026:
- H100 80GB on-demand: **$5.49/hr** (công khai, không contact-only)
- B200 180GB on-demand: **$8.99/hr** (công khai, không contact-only)
- Reserved capacity cho cả hai: "Contact sales" — claim không đụng tới phần reserved nên không ảnh hưởng
- Hai giá trên hiện diện đồng thời trên docs kỹ thuật và trang marketing pricing, khớp nhau

Không có dấu hiệu claim bị thổi phồng, không yêu cầu đăng nhập, không paywall. Source primary, current.

## Sources

- [https://docs.together.ai/docs/dedicated-endpoints/pricing](https://docs.together.ai/docs/dedicated-endpoints/pricing) — Pricing docs cho DMI, truy cập 24/08/2026
- [https://www.together.ai/pricing](https://www.together.ai/pricing) — Trang pricing marketing, mục "Dedicated Inference", truy cập 24/08/2026
- [https://www.usagepricing.com/blueprint/together-ai](https://www.usagepricing.com/blueprint/together-ai) — Third-party confirm cut giá tháng 07/2026 (H100→$5.49, B200→$8.99)
