-- Migration 002 — endpoint usage tracking
-- Ghi lại mỗi lần endpoint được gọi (token, giá, latency) để user xem usage thật

CREATE TABLE IF NOT EXISTS endpoint_usage (
  id BIGSERIAL PRIMARY KEY,
  endpoint_id TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INT NOT NULL,
  completion_tokens INT NOT NULL,
  total_tokens INT NOT NULL,
  cost_usd NUMERIC(10,6) NOT NULL,
  latency_ms INT NOT NULL,
  status_code INT NOT NULL DEFAULT 200,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_endpoint_usage_ep ON endpoint_usage(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_endpoint_usage_time ON endpoint_usage(created_at);

INSERT INTO _schema_version (version) VALUES (2) ON CONFLICT DO NOTHING;
