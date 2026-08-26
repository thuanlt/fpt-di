-- Migration 010 — US-02 Guardrails banking (NeMo)
-- Bảng guardrail_event + index; thêm cột lưu rules đã resolve cho endpoint.

CREATE TABLE IF NOT EXISTS guardrail_event (
  id          TEXT PRIMARY KEY,
  endpoint_id TEXT NOT NULL,
  ts          TIMESTAMPTZ NOT NULL DEFAULT now(),
  rule        TEXT NOT NULL,
  severity    TEXT NOT NULL DEFAULT 'warn',
  blocked     BOOLEAN NOT NULL DEFAULT TRUE,
  reason      TEXT
);
CREATE INDEX IF NOT EXISTS idx_guardrail_event_ep   ON guardrail_event(endpoint_id, ts);
CREATE INDEX IF NOT EXISTS idx_guardrail_event_rule ON guardrail_event(rule);

-- Lưu rules đã resolve (template + custom) cho endpoint — phục vụ kiểm tra trong invoke.js
ALTER TABLE endpoint_entities ADD COLUMN IF NOT EXISTS guardrails_rules JSONB;