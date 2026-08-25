# Sandbox/Playground/Console của các nhà cung cấp LLM API lớn

Memo này tổng hợp các tính năng sandbox/playground/console mà các nhà cung cấp LLM API lớn (OpenAI, Anthropic, Google, Cohere, Mistral, AI21, Together AI, Fireworks AI) cung cấp để người dùng thử và so sánh model. Mỗi nền tảng được phân tích theo bốn trục: (1) các tab/feature UI có sẵn, (2) định mức miễn phí và cách dẫn dắt sang trả phí, (3) tính năng model explorer/compare, (4) liên kết tới fine-tune/eval và playground gọi fine-tuned model. Nguồn ưu tiên là docs chính thức và blog phát hành feature trong khoảng 2024-2026.

> Trạng thái memo: đang được bổ sung từng phần. Một số mục (Together AI, Fireworks AI, AI21 Studio) còn trống — sẽ làm rõ xác nhận hay "không tìm thấy" ở cuối.

---

## 1. OpenAI Platform — Prompts Playground

OpenAI đổi tên "Chat Playground" thành **Prompts Playground** vào khoảng tháng 3/2025 ([thông báo cộng đồng OpenAI, 14/3/2025](https://community.openai.com/t/the-chat-playground-is-now-the-prompts-playground/1142740)). Cùng với đổi tên, OpenAI cho phép **lưu và chia sẻ cấu hình** model + system message + tools dưới dạng URL công khai (ví dụ starter prompt gpt-4o-mini với web search: <https://platform.openai.com/playground/p/T4U6rwVjng3kKl4UjaPr2CCZ?mode=chat>).

**Prompt management**: theo [OpenAI Help Center — Prompt management in Playground](https://help.openai.com/en/articles/9824968-prompt-management-in-playground), luồng là Playground → Prompts → Create New, có hỗ trợ biến `{variables}` trong prompt, và có nút **Generate** để ChatGPT tự đề xuất prompt/function definition/output schema dựa trên mô tả task. Nút Generate tương tự được công bố rộng rãi hơn trong bài [New Playground features: Generate in the Playground (1/10/2024)](https://community.openai.com/t/new-playground-features-generate-in-the-playground/963949).

*(phần còn lại: structured output tab, params, code export, free tier, model compare, fine-tune UI — sẽ bổ sung sau)*

---

## 2. Anthropic Console — Workbench + Prompt Library

Anthropic redesign Console thành "một nơi để build, test, iterate" theo blog [Get to production faster with the upgraded Anthropic Console](https://claude.com/blog/upgraded-anthropic-console). Console có các tab chính: **Dashboard, Workbench, Batches, Documentation** ([console.anthropic.com](https://console.anthropic.com/settings/admin-keys)).

**Workbench** là playground trình duyệt miễn phí cho thử prompt với mọi model Claude (Opus 4.7, Sonnet 4.6, Haiku 4.5) —([Beginners in AI — Anthropic Workbench guide](https://beginnersinai.org/anthropic-workbench/)). Có thể tinh chỉnh model setting và temperature ([Toolify note về Anthropic Prompt Generator](https://www.toolify.ai/ai-news/anthropics-new-prompt-generator-revolutionizing-ai-prompt-engineering-3712641)).

**Evaluation**: theo [LinkedIn pulse — A view on the Anthropic console (Valentina Adami)](https://www.linkedin.com/pulse/view-anthropic-console-valentina-adami-xsatf), Console có công cụ **evaluate chất lượng prompt quy mô lớn**, yêu cầu prompt phải có 1-2 biến để chạy được evaluator.

*(phần còn lại: prompt library công khai, code export, monitoring tab, free tier, fine-tune — sẽ bổ sung sau)*

---

## 3. Google AI Studio + Vertex AI Studio

Google AI Studio cho "build software by simply describing your UI and requirements" và truy cập các model Gemini mới nhất (như Gemini 3) ([Gemini 3 trên aistudio.google.com](https://aistudio.google.com/models/gemini-3)). Tên model theo quy ước stable/preview/latest/experimental tính đến 9/2025 ([Gemini API — Models docs](https://ai.google.dev/gemini-api/docs/models)).

*(phần còn lại: tab UI chi tiết, free tier so với Vertex, deploy to endpoint, code export, model compare — sẽ bổ sung sau)*

---

## 4. Cohere Dashboard — Playground

Cohere Playground hiển thị trong dashboard của nhà phát triển, dùng để "test nhanh khả năng của Cohere models" ([DataCamp — Cohere API Tutorial: Getting Started With Cohere Models](https://www.datacamp.com/tutorial/cohere-api-tutorial)). Cohere hiện cung cấp dòng **Command** (high-performance generative AI cho real-world applications) ([cohere.com](https://cohere.com/)).

*(phần còn lại: tab chat/structured/compare Coral vs Command, code export, free tier trial — sẽ bổ sung sau)*

---

## 5. Mistral La Plateforme — Le Playground & Console

Mistral Console ở [console.mistral.ai](https://console.mistral.ai/). Đã công bố **Mistral Agents API** (27/5/2025) ([Mistral blog — Build AI agents with the Mistral Agents API](https://mistral.ai/news/agents-api/)) và **Mistral AI Studio** (khoảng 25/10/2025) cho tạo agent, fine-tune với dataset riêng, observe conversation real-time, evaluate performance ([Avenue Delia — Mistral AI Studio FR](https://avenuedelia.com/fr/actu/mistral-ai-introduit-mistral-ai-studio-plateforme-production-ia/)).

La Plateforme có 7 model free, không cần credit card ([Free LLM — Mistral La Plateforme Free API Key](https://free-llm.com/api/mistral-ai)).

*(phần còn lại: Le Playground UI chi tiết, tab chat/params, code export curl/Python/JS, model compare, fine-tune UI — sẽ bổ sung sau)*

---

## 6. AI21 Studio

*(chưa có dữ liệu — sẽ tìm kiếm)*

---

## 7. Together AI

*(chưa có dữ liệu — sẽ tìm kiếm)*

---

## 8. Fireworks AI

*(chưa có dữ liệu — sẽ tìm kiếm)*

---

## Tiêu chí so sánh chéo (sẽ điền sau)

Bảng tổng hợp cross-vendor về: model explorer/compare, code export ngôn ngữ, free tier, fine-tune UI.

## Nguồn (sẽ gom đầy đủ ở cuối)

- OpenAI Help Center — Prompt management: https://help.openai.com/en/articles/9824968-prompt-management-in-playground
- OpenAI Dev Community — Prompts Playground rename (14/3/2025): https://community.openai.com/t/the-chat-playground-is-now-the-prompts-playground/1142740
- OpenAI Dev Community — Generate in the Playground (1/10/2024): https://community.openai.com/t/new-playground-features-generate-in-the-playground/963949
- Anthropic blog — Upgraded Console: https://claude.com/blog/upgraded-anthropic-console
- Anthropic Console: https://console.anthropic.com/settings/admin-keys
- Beginners in AI — Anthropic Workbench: https://beginnersinai.org/anthropic-workbench/
- Gemma 4 31B free trên OpenRouter (do Google AI Studio serve): https://openrouter.ai/google/gemma-4-31b-it:free
- Gemini API Models docs: https://ai.google.dev/gemini-api/docs/models
- Gemini 3 trên Google AI Studio: https://aistudio.google.com/models/gemini-3
- Cohere homepage: https://cohere.com/
- DataCamp — Cohere API Tutorial: https://www.datacamp.com/tutorial/cohere-api-tutorial
- Mistral Console: https://console.mistral.ai/
- Mistral blog — Agents API (27/5/2025): https://mistral.ai/news/agents-api/
- Avenue Delia — Mistral AI Studio (25/10/2025): https://avenuedelia.com/fr/actu/mistral-ai-introduit-mistral-ai-studio-plateforme-production-ia/
