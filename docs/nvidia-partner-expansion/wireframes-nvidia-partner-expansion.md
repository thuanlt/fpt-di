# Wireframe — Mở rộng FPT DDI Partner Console với NVIDIA

**Phiên bản:** 1.0
**Ngày:** 25/08/2026
**Trạng thái:** Approved (draft chi tiết)
**Chủ sở hữu:** Thuan Luu Thi (BA/PO)
**Liên quan:** `user-stories-nvidia-partner-expansion.md`, `srs-nvidia-partner-expansion.md`

> Wireframe dạng ASCII/mô tả — dùng làm blueprint cho đội FE. Mỗi màn hình kèm thành phần, hành vi, và story liên quan.

---

## WF-01 — Catalog model NVIDIA NIM (US-01)

### Layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│ FPT DDI Partner Console            [🔑 ddi-live-••• ✓]  [Sync]  [00:00]   │
├────────────┬───────────────────────────────────────────────────────────────┤
│ Sidebar    │  Model Catalog                                    [+ Filter] │
│ ▸ Overview │  ┌─────────────────────────────────────────────────────────┐ │
│ ▸ Catalog  │  │ Segment: [All ▾]  Source: [All ▾]  GPU: [All ▾]  Search │ │
│ ▸ Endpoints│  ├─────────────────────────────────────────────────────────┤ │
│ ▸ BYOM     │  │ Model              Segments        GPU      Action       │ │
│ ▸ Batch    │  │ DeepSeek-Coder-33B  coding          H100     [Deploy]    │ │
│ ▸ API Keys │  │ Llama-3.3-70B       coding,banking  H200     [Deploy]    │ │
│ ▸ Playground│ │ Qwen-Coder-32B      coding          A30      [Deploy]    │ │
│ ▸ Billing  │  │ ...                                                   │ │
└────────────┴───────────────────────────────────────────────────────────────┘
```

### Thành phần & hành vi
| Thành phần | Hành vi |
|------------|---------|
| Dropdown Segment | Lọc model theo phân khúc (FR-SEG-001.2) |
| Dropdown Source | Lọc theo `nvidia_nim`, `huggingface`, `fpt` |
| Nút Deploy | Mở modal deploy (WF-02); yêu cầu key scope `endpoints` |
| Badge Segments | Hiển thị tag phân khúc của model |

### Story liên quan
US-01

---

## WF-02 — Modal Deploy NVIDIA NIM (US-01, US-09)

### Layout

```
┌──────────────────────────────────────────────────────────────┐
│  Deploy model                                   [✕]          │
│  Model: DeepSeek-Coder-33B (NIM v1.3.0)                      │
│  ──────────────────────────────────────────────────────────── │
│  Name:        [ deepseek-coder-33b-prod        ]             │
│  GPU:         [ H100 ▾ ]   Region: [ HAN-1 ▾ ]               │
│  Engine:      (•) vLLM   ( ) Triton   ( ) TensorRT-LLM       │
│  Segment:     [ coding ▾ ]                                   │
│  Min/Max Repl:[ 1 ] [ 4 ]   Allow GPU swap [ ]               │
│  Guardrails:  [ None ▾ ]                                     │
│  Code privacy:[x] Không log mã nguồn                         │
│  Commit:      [ on-demand ▾ ]                                │
│  ──────────────────────────────────────────────────────────── │
│  Estimated: $2.50/hr · p95 ~780ms                            │
│                              [ Cancel ]  [ Deploy ]          │
└──────────────────────────────────────────────────────────────┘
```

### Thành phần & hành vi
| Thành phần | Hành vi |
|------------|---------|
| Select Engine | Chọn vllm/triton/tensorrt-llm (FR-TRT-001.1) |
| Select Segment | Gắn phân khúc cho endpoint (FR-SEG-001) |
| Code privacy checkbox | Bật chế độ bảo mật mã nguồn (FR-SEG-002.2) |
| Estimated | Preview giá theo gói + commitment (FR-PRICE-001) |
| Deploy | Gọi POST /v1/endpoints; chuyển trạng thái deploying |

### Story liên quan
US-01, US-09

---

## WF-03 — Chi tiết Endpoint + Guardrails (US-02, US-05)

### Layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Endpoint: deepseek-coder-33b-prod                    [Running ●]  [Stop]   │
│ ┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐        │
│ │ Overview │ Metrics  │ Usage    │ Config   │ Guardrails│ Audit    │        │
│ ├──────────┴──────────┴──────────┴──────────┴──────────┴──────────┤        │
│ │ Guardrails (NeMo)                                                │        │
│ │  Template: [ Banking ▾ ]   Enabled: [x]                          │        │
│ │  Rules:                                                        │        │
│ │   [x] Chặn PII (CCCD/CMND)                                      │        │
│ │   [x] Chặn prompt injection                                     │        │
│ │   [x] Chặn lời khuyên tài chính trái phép                       │        │
│ │   [ ] Chặn thông tin y tế                                       │        │
│ │  Blocked events (24h): 12   [View log]                          │        │
│ └─────────────────────────────────────────────────────────────────┘        │
└────────────────────────────────────────────────────────────────────────────┘
```

### Thành phần & hành vi
| Thành phần | Hành vi |
|------------|---------|
| Tab Guardrails | Bật/tắt + chọn template + rule (FR-GRD-001) |
| Blocked events | Đếm sự kiện chặn từ guardrail_event (FR-GRD-002) |
| View log | Mở audit log liên quan (FR-COMP-001) |

### Story liên quan
US-02, US-05

---

## WF-04 — Billing / Gói giá theo phân khúc (US-06)

### Layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Billing & Pricing                                              [New pack] │
│ ┌───────────────────────────────────────────────────────────────────────┐ │
│ │ Segment │ GPU   │ Region │ Rate/hr │ Rate/token │ Commit │ Discount │ │
│ │ banking │ H100  │ HAN-1  │ $12.50  │ $0.000001  │ 91-180 │ 20%      │ │
│ │ coding  │ H100  │ HAN-1  │ $2.50   │ $0.0000005 │ on-dem │ 0%       │ │
│ │ ...     │       │        │         │            │        │          │ │
│ └───────────────────────────────────────────────────────────────────────┘ │
│  [Export CSV]                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### Thành phần & hành vi
| Thành phần | Hành vi |
|------------|---------|
| New pack | Mở modal tạo gói giá (FR-PRICE-001) |
| Export CSV | Xuất báo cáo (FR-DASH-001.3) |

### Story liên quan
US-06

---

## WF-05 — Playground Code (US-08)

### Layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Playground — Code                                          [code privacy:ON]│
│ ┌──────────────────────────────────────┬───────────────────────────────────┐│
│ │ System prompt                        │  Output                           ││
│ │ [ You are a senior Python engineer ] │  ```python                       ││
│ │ Temperature [0.2] Max tokens [2048]  │  def fib(n):                     ││
│ │                                      │      return n if n<2 else ...    ││
│ │ User:                                │  ```                             ││
│ │ [ Write a fibonacci function ] [Send]│  tokens: 45 · latency: 210ms     ││
│ └──────────────────────────────────────┴───────────────────────────────────┘│
└────────────────────────────────────────────────────────────────────────────┘
```

### Thành phần & hành vi
| Thành phần | Hành vi |
|------------|---------|
| Code privacy ON | Không log prompt chứa mã nguồn (FR-SEG-002.2) |
| Highlight syntax | Hiển thị output code có màu (FR-SEG-002.1) |
| Token/latency | Hiển thị usage (FR-SEG-002.1) |

### Story liên quan
US-08

---

## WF-06 — Dashboard theo phân khúc (US-07)

### Layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Dashboard                                  Segment: [banking ▾] [Export]  │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐              │
│ │ Requests│ │ Cost    │ │ p95 Lat │ │ Err Rate│ │ Guard   │              │
│ │ 1.2M    │ │ $8,400  │ │ 620ms   │ │ 0.4%    │ │ 12      │              │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘              │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │  Line chart: Requests & Cost over time (24h/7d)                    │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│  Guardrail blocks by rule:  PII ████████  Inj ███  Fin ██                │
└────────────────────────────────────────────────────────────────────────────┘
```

### Thành phần & hành vi
| Thành phần | Hành vi |
|------------|---------|
| Dropdown Segment | Lọc KPI theo phân khúc (FR-DASH-001.2) |
| Export | Xuất CSV (FR-DASH-001.3) |
| Guardrail blocks | Đọc từ guardrail_event (FR-GRD-002) |

### Story liên quan
US-07

---

## WF-07 — Phân quyền / API Keys (US-10)

### Layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│ API Keys & Roles                                             [+ New key]  │
│ ┌───────────────────────────────────────────────────────────────────────┐ │
│ │ Name      │ Prefix        │ Scopes              │ Role    │ Status    │ │
│ │ prod-bank │ ddi-live-4a5a │ endpoints,byom      │ admin   │ active    │ │
│ │ dev-local │ ddi-live-3b8e │ chat,playground     │ viewer  │ active    │ │
│ │ ...       │               │                     │         │           │ │
│ └───────────────────────────────────────────────────────────────────────┘ │
│  Role: admin = full · operator = manage endpoints · viewer = read-only    │
└────────────────────────────────────────────────────────────────────────────┘
```

### Thành phần & hành vi
| Thành phần | Hành vi |
|------------|---------|
| Role column | Gán vai trò cho key/user (FR-COMP-003) |
| New key | Tạo key với scope + role (FR-COMP-003.1) |

### Story liên quan
US-10

---

## Checklist FE theo wireframe

| WF | Màn hình | Story | Ưu tiên |
|----|----------|-------|---------|
| WF-01 | Catalog NIM | US-01 | M |
| WF-02 | Modal Deploy | US-01, US-09 | M |
| WF-03 | Endpoint + Guardrails | US-02, US-05 | M |
| WF-05 | Playground Code | US-08 | M |
| WF-07 | API Keys + Roles | US-10 | M |
| WF-04 | Billing/Gói giá | US-06 | S |
| WF-06 | Dashboard | US-07 | S |