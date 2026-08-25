# Prototype Wireframe v2 — Redesign Homepage FPT AI Marketplace
## Provider-Centric Design

**Phiên bản:** 2.0
**Ngày:** 17/08/2026
**Trạng thái:** Draft — chờ review
**Loại:** Low-fidelity wireframe + click-through prototype (dạng tài liệu)
**Liên quan:** BRD v1.0 (đã cập nhật theo screenshot thực tế), SRS v1.0

> **Thay đổi so với v1:** Thiết kế hoàn toàn xoay quanh **Provider** — provider phải là yếu tố nổi bật nhất trên homepage, xuất hiện ở hero, filter, card, và có section showcase riêng.

---

## 1. Provider Showcase — Section mới (trên cùng, ngay dưới Hero)

Đây là section **quan trọng nhất** — giới thiệu các provider uy tín, tạo niềm tin và cho phép người dùng click vào provider để xem model của họ.

```
┌──────────────────────────────────────────────────────────────────────┐
│  TRUSTED PROVIDERS                                                    │
│  Các model từ những nhà cung cấp hàng đầu thế giới                   │
│                                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │  ◈ FPT   │ │  ◈Google │ │◈ Alibaba │ │◈DeepSeek │ │  ◈Z.AI  │  │
│  │          │ │          │ │          │ │          │ │          │  │
│  │  FPT.ai  │ │ DeepMind │ │  Qwen    │ │  V4-Flash│ │  GLM     │  │
│  │  5 models│ │ Gemini   │ │  Qwen2.5 │ │  3 models│ │  2 models│  │
│  │          │ │  3 models│ │  2 models│ │          │ │          │  │
│  │ [Explore]│ │ [Explore]│ │ [Explore]│ │ [Explore]│ │ [Explore]│  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│                                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                             │
│  │◈ MiniMax │ │◈ Anthropic│ │◈ OpenAI  │                             │
│  │          │ │           │ │          │                             │
│  │  M3-VN   │ │  Claude   │ │ Whisper  │                             │
│  │  2 models│ │  2 models │ │  2 models│                             │
│  │          │ │           │ │          │                             │
│  │ [Explore]│ │ [Explore] │ │ [Explore]│                             │
│  └──────────┘ └──────────┘ └──────────┘                             │
└──────────────────────────────────────────────────────────────────────┘
```

**Annotation:**
- Mỗi provider card có: logo lớn (48×48px), tên provider, model nổi bật nhất, số model trên marketplace, nút "Explore" → lọc danh sách theo provider đó.
- Card provider nổi bật, có hover effect (shadow, scale).
- Provider FPT được đặt đầu tiên (thương hiệu chủ nhà).
- Section có heading "Trusted Providers" — tạo niềm tin.

---

## 2. Wireframe tổng thể v2 (Desktop 1440px)

```
┌──────────────────────────────────────────────────────────────────────┐
│  FPT AI MARKETPLACE   Products ▾   Pricing   Docs    [Sign in]      │ ← Header
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Your Production-Grade Gateway                                      │ ┐
│   to World-Class AI Models                                           │ │
│   Access frontier models from Anthropic, OpenAI, Google, Alibaba,    │ │
│   DeepSeek, and FPT-hosted models through a unified gateway.         │ │ Hero
│                                                                      │ │
│   [ Get Your API Key → ]   [ Explore Models ↓ ]                      │ │
│                                                                      │ ┘
├──────────────────────────────────────────────────────────────────────┤
│  TRUSTED PROVIDERS  [See all →]                                      │ ┐
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐          │ │
│  │FPT │ │Ggl │ │Ali │ │DSk │ │Z.AI│ │Mnx │ │Anth│ │OAI │          │ │ Provider
│  │ 5  │ │ 3  │ │ 2  │ │ 3  │ │ 2  │ │ 2  │ │ 2  │ │ 2  │          │ │ Showcase
│  └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘          │ │
│                                                                      │ ┘
├──────────────────────────────────────────────────────────────────────┤
│  🔍 Search models or providers...                                    │ ← Search
│  Provider: [All][FPT][Google][Alibaba][DeepSeek][Z.AI][MiniMax]...  │ ← Provider
│  Category: [All][LLM][VLM][TTS][STT][Embedding]                     │ ← Filter
├──────────────────────────────────────────────────────────────────────┤
│  Showing 1–12 of 19 models  [Grid ⊞] [List ▤]                       │
│                                                                      │
│  ┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────┐│
│  │ ┌─────────────────┐ │ │ ┌─────────────────┐ │ │ ┌─────────────┐ ││
│  │ │ ◈ Google        │ │ │ │ ◈ Alibaba       │ │ │ │ ◈ FPT       │ ││
│  │ │ Google Gemini-3 │ │ │ │ Qwen2.5-VL-7B   │ │ │ │ FPT.AI-VITs │ ││
│  │ └─────────────────┘ │ │ └─────────────────┘ │ │ └─────────────┘ ││
│  │ [VLM]  Context 128K │ │ [VLM]  Context 160K │ │ [TTS]  Context  ││
│  │ Input $0.45/1M      │ │ Input $0.30/1M      │ │ Input $0.12/1M  ││
│  │ Output $1.35/1M     │ │ Output $0.90/1M     │ │ Output $0.18/1M ││
│  │ ⚡ Fast              │ │ ⚡ Fast              │ │ ⚡ Medium        ││
│  │ [View Details] ☐    │ │ [View Details] ☐    │ │ [View Details] ☐││
│  └─────────────────────┘ └─────────────────────┘ └─────────────────┘│
│                                                                      │
│              ‹ Prev   1   2   Next ›                                 │ ← Pagination
├──────────────────────────────────────────────────────────────────────┤
│  FOOTER: About | Pricing | Docs | Contact | © 2026 FPT Smart Cloud   │
└──────────────────────────────────────────────────────────────────────┘
```

**Thay đổi so với v1:**
- **Mới:** Section "Trusted Providers" ngay dưới Hero — 8 provider cards nổi bật.
- **Mới:** Provider filter bar ngay dưới search — các chip provider dễ click.
- **Cải thiện:** Card model có header provider nổi bật (logo + tên) ở phần trên cùng của card.
- **Cải thiện:** Layout sáng, thoáng, nhiều khoảng trắng — dễ quét.

---

## 3. Model Card v2 — Provider First

```
┌──────────────────────────────────────┐
│  ┌──────────────────────────────────┐│
│  │  ◈ Google                        ││ ← Provider header (nổi bật)
│  │  Gemini-3.1-Pro-Preview          ││ ← Tên model
│  └──────────────────────────────────┘│
│                                      │
│  [VLM]                                │ ← Modality tag
│                                      │
│  Context window    128K              │
│  Input price       $0.45 / 1M tokens │
│  Output price      $1.35 / 1M tokens │
│  Latency           ⚡ Fast            │
│  FPT-hosted        ✗                 │ ← Badge data residency
│                                      │
│  [ View Details → ]   ☐ Compare      │
└──────────────────────────────────────┘
```

**Annotation:**
- **Provider header:** Logo + tên provider ở phần trên cùng card, nổi bật với background nhẹ.
- **Thông số kỹ thuật:** Dạng 2 cột (label + value), dễ quét.
- **Nút CTA:** "View Details" + checkbox Compare ở dưới cùng.
- **Khoảng trắng:** Padding lớn, không dense như hiện tại.

---

## 4. Provider Filter Bar

```
┌──────────────────────────────────────────────────────────────────────┐
│  🔍 Search models or providers...                    [Layout: ⊞ ▤]  │
│                                                                      │
│  Provider:   [All] [FPT] [Google] [Alibaba] [DeepSeek] [Z.AI]       │
│              [MiniMax] [Anthropic] [OpenAI]       [Clear all]        │
│                                                                      │
│  Category:   [All] [LLM] [VLM] [TTS] [STT] [Embedding]              │
└──────────────────────────────────────────────────────────────────────┘
```

**Tương tác:**
- Click provider chip → highlight chip + filter danh sách model.
- Multi-select → OR logic (hiển thị model của bất kỳ provider được chọn).
- Click "All" → reset về toàn bộ.
- Click "Clear all" → reset toàn bộ filter.

---

## 5. Provider Detail View (khi click "Explore" từ showcase)

```
┌──────────────────────────────────────────────────────────────────────┐
│  ◈ Google          ← Provider header
│  Google DeepMind                                      [← Back]     │
│  Frontier AI models for reasoning, vision, and code.                │
│  3 models available                                              │
├──────────────────────────────────────────────────────────────────────┤
│  [Card 1] [Card 2] [Card 3]   ← Chỉ hiển thị model của Google     │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 6. Checklist chốt prototype v2

| # | Hạng mục | Trạng thái |
|---|----------|-----------|
| 1 | Provider Showcase section (8 cards) | ☐ |
| 2 | Provider header trên mỗi model card | ☐ |
| 3 | Provider filter bar (chip multi-select) | ☐ |
| 4 | Model card thoáng, dễ quét | ☐ |
| 5 | Hero sáng, CTA nổi bật | ☐ |
| 6 | Search + autocomplete | ☐ |
| 7 | Compare bar (max 4) | ☐ |
| 8 | Pagination + "Showing X–Y of Z" | ☐ |
| 9 | Empty state | ☐ |
| 10 | Responsive mobile | ☐ |
| 11 | Accessibility WCAG 2.1 AA | ☐ |