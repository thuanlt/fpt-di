# API Specification — Mở rộng FPT DDI với NVIDIA

**Phiên bản:** 1.0
**Ngày:** 25/08/2026
**Trạng thái:** Approved
**Chủ sở hữu:** Thuan Luu Thi (BA/PO)
**Liên quan:** `srs-nvidia-partner-expansion.md`, `user-stories-nvidia-partner-expansion.md`

> Đặc tả API mức **WHAT** (hợp đồng) — đội BE triển khai, đội FE tiêu thụ. Base path: `/v1`. Xác thực: `Authorization: Bearer <api_key>`. Mọi endpoint operational yêu cầu key hợp lệ + scope đúng (401/403).

---

## 1. Quy ước chung

- **Định dạng:** JSON.
- **Lỗi chuẩn:** `{ "error": "<message>" }`.
- **Mã lỗi:** 400 (sai input), 401 (key không hợp lệ), 403 (thiếu scope), 404 (không tìm thấy), 409 (xung đột), 422 (không thể xử lý), 429 (vượt quota), 500 (lỗi server).
- **Scope:** `endpoints`, `byom`, `batch`, `chat`, `playground`, `admin`.

---

## 2. Endpoint mới

### 2.1 `GET /v1/catalog` — Danh mục model (US-01)

Trả về danh mục model, lọc theo phân khúc/source/GPU.

**Query params:**
| Param | Type | Bắt buộc | Mô tả |
|-------|------|----------|-------|
| `segment` | enum | No | `coding`, `banking`, `securities`, `insurance`, `general` |
| `source` | enum | No | `nvidia_nim`, `huggingface`, `fpt` |
| `gpu` | enum | No | `H100`, `H200`, `A30`, `B300` |

**Response 200:**
```json
{
  "count": 2,
  "data": [
    {
      "id": "mod-1234",
      "name": "deepseek-coder-33b",
      "family": "code",
      "segments": ["coding"],
      "source": "nvidia_nim",
      "nim_version": "1.3.0",
      "gpu_compatible": ["H100", "H200", "A30"],
      "max_context": 32768,
      "quantizations": ["bf16", "fp8", "awq"]
    }
  ]
}
```

**Lỗi:** 401 (thiếu key), 403 (thiếu scope `endpoints`).

### 2.2 `POST /v1/endpoints` — Deploy endpoint (mở rộng, US-01/US-09)

Body bổ sung các trường mới (ngoài các trường hiện có).

**Body:**
```json
{
  "name": "deepseek-coder-33b-prod",
  "model": "deepseek-coder-33b",
  "gpu": "H100",
  "region": "HAN-1",
  "mode": "k8s",
  "commit": "on-demand",
  "minReplicas": 1,
  "maxReplicas": 4,
  "segment": "coding",
  "engine": "vllm",
  "guardrailsEnabled": false,
  "codePrivacy": true,
  "allowGpuSwap": false
}
```

**Validation:**
| Trường | Ràng buộc |
|--------|-----------|
| `name` | regex `^[a-z0-9][a-z0-9-]{1,62}$` |
| `engine` | enum: `vllm`, `triton`, `tensorrt-llm`, `nim` |
| `segment` | enum hợp lệ |
| `region` | phải thuộc VN nếu segment = banking/insurance (data residency) |

**Response 201:**
```json
{
  "data": {
    "id": "ep-1234",
    "name": "deepseek-coder-33b-prod",
    "status": "deploying",
    "segment": "coding",
    "engine": "vllm",
    "guardrailsEnabled": false,
    "codePrivacy": true,
    "rate": "2.50"
  }
}
```

**Lỗi:** 400 (validation), 401, 403, 409 (tên trùng / model đã deploy).

### 2.3 `PATCH /v1/endpoints/{id}/guardrails` — Cấu hình guardrails (US-02)

**Body:**
```json
{
  "enabled": true,
  "template": "banking",
  "rules": ["pii", "prompt_injection", "financial_advice"]
}
```

**Response 200:**
```json
{
  "data": {
    "id": "ep-1234",
    "guardrailsEnabled": true,
    "template": "banking",
    "rules": ["pii", "prompt_injection", "financial_advice"],
    "status": "updated"
  }
}
```

**Lỗi:** 400 (template không hợp lệ), 401, 403 (thiếu scope), 404.

### 2.4 `GET /v1/endpoints/{id}/guardrails/events` — Sự kiện guardrails (US-02/US-07)

**Query params:**
| Param | Type | Bắt buộc | Mô tả |
|-------|------|----------|-------|
| `range` | enum | No | `1h`, `24h`, `7d` (mặc định `24h`) |
| `rule` | enum | No | Lọc theo rule |

**Response 200:**
```json
{
  "totals": { "blocked": 12, "by_rule": { "pii": 8, "prompt_injection": 3, "financial_advice": 1 } },
  "series": [
    { "ts": "2026-08-25T05:00:00Z", "blocked": 2 }
  ]
}
```

### 2.5 `GET /v1/audit` — Audit log bất biến (US-05)

**Query params:**
| Param | Type | Bắt buộc | Mô tả |
|-------|------|----------|-------|
| `from` | datetime | No | Bắt đầu |
| `to` | datetime | No | Kết thúc |
| `actor` | string | No | Lọc theo actor |
| `action` | enum | No | Lọc theo action |

**Response 200:**
```json
{
  "count": 2,
  "data": [
    {
      "id": "aud-9012",
      "timestamp": "2026-08-25T06:00:00Z",
      "actor": "user-xyz",
      "role": "admin",
      "action": "endpoint.create",
      "entity_id": "ep-1234",
      "result": "success",
      "ip": "203.113.x.x",
      "immutable": true
    }
  ]
}
```

**Lưu ý:** Audit log append-only — không có endpoint xóa/sửa. Yêu cầu scope `admin`.

### 2.6 `POST /v1/price-packs` — Tạo gói giá (US-06)

**Body:**
```json
{
  "segment": "banking",
  "gpu": "H100",
  "region": "HAN-1",
  "rate_per_hour": 12.50,
  "rate_per_token": 0.000001,
  "commitment": "91-180",
  "discount_pct": 20.0,
  "quota_rpm": 1000,
  "quota_tpm": 1000000
}
```

**Response 201:** trả về `price_pack` đã tạo. **Lỗi:** 409 nếu trùng (segment+gpu+region).

### 2.7 `GET /v1/price-packs` — Danh sách gói giá (US-06)

**Query params:** `segment`, `gpu`, `region`.

**Response 200:** `{ "count": n, "data": [...] }`.

### 2.8 `GET /v1/dashboard` — Dashboard KPI theo phân khúc (US-07)

**Query params:**
| Param | Type | Bắt buộc | Mô tả |
|-------|------|----------|-------|
| `segment` | enum | No | Lọc phân khúc |
| `range` | enum | No | `24h`, `7d`, `30d` |
| `format` | enum | No | `json` (mặc định), `csv` |

**Response 200 (json):**
```json
{
  "segment": "banking",
  "range": "24h",
  "kpis": { "requests": 1200000, "cost_usd": 8400, "p95_latency_ms": 620, "error_rate": 0.004, "guardrail_blocks": 12 },
  "series": [
    { "ts": "2026-08-25T05:00:00Z", "requests": 52000, "cost_usd": 360, "p95_latency_ms": 610 }
  ]
}
```

### 2.9 `POST /v1/keys` — Tạo key (mở rộng, US-10)

Body bổ sung `role`:
```json
{
  "name": "prod-bank",
  "scopes": ["endpoints", "byom"],
  "role": "admin"
}
```

**Validation:** `role` ∈ {`admin`, `operator`, `viewer`}. Mặc định `viewer` nếu không truyền.

### 2.10 `POST /v1/endpoints/{id}/chat/completions` — Inference (hiện có, không đổi)

Hỗ trợ thêm `response_format` (JSON Schema) cho structured output (US-03):
```json
{
  "model": "deepseek-coder-33b",
  "messages": [{ "role": "user", "content": "..." }],
  "response_format": {
    "type": "json_schema",
    "json_schema": { "name": "trade", "strict": true, "schema": { "type": "object", "properties": { "symbol": {"type":"string"}, "price": {"type":"number"} } } }
  }
}
```

---

## 3. Thay đổi entity hiện có

| Entity | Thay đổi |
|--------|----------|
| `endpoint` | Thêm `segment`, `guardrails_enabled`, `guardrails_template`, `engine`, `code_privacy`, `structured_output`, `price_pack_id`, `data_residency` |
| `api_keys` | Thêm `role` |
| `model_catalog` | Mới (danh mục model NIM) |
| `guardrail_event` | Mới (sự kiện chặn) |
| `audit_log` | Mới (bất biến) |
| `price_pack` | Mới (gói giá) |

---

## 4. Ma trận API ↔ Story ↔ Scope

| API | Story | Scope cần |
|-----|-------|-----------|
| GET /v1/catalog | US-01 | endpoints |
| POST /v1/endpoints | US-01, US-09 | endpoints |
| PATCH /v1/endpoints/{id}/guardrails | US-02 | endpoints |
| GET /v1/endpoints/{id}/guardrails/events | US-02, US-07 | endpoints |
| GET /v1/audit | US-05 | admin |
| POST/GET /v1/price-packs | US-06 | admin |
| GET /v1/dashboard | US-07 | endpoints |
| POST /v1/keys | US-10 | (public preview / admin prod) |
| POST /v1/endpoints/{id}/chat/completions | US-03 | endpoints |