-- Migration 011 — US-06 Gói giá theo phân khúc (price pack)
-- Bảng price_pack + seed gói mẫu; ALTER endpoint_entities thêm price_pack_id.
-- US-07: thêm index cho aggregate dashboard (không bảng mới).

CREATE TABLE IF NOT EXISTS price_pack (
  id             TEXT PRIMARY KEY,
  segment        TEXT NOT NULL,
  gpu            TEXT NOT NULL,
  region         TEXT NOT NULL,
  rate_per_hour  NUMERIC(10,4) NOT NULL,
  rate_per_token NUMERIC(14,8),
  commitment     TEXT NOT NULL DEFAULT 'on-demand',
  discount_pct   NUMERIC(5,2) DEFAULT 0,
  quota_rpm      INT,
  quota_tpm      INT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (segment, gpu, region)
);

-- Seed gói mẫu (idempotent) — banking H100 HAN-1, coding H100 HAN-1, securities H200 SGN-1
INSERT INTO price_pack (id, segment, gpu, region, rate_per_hour, rate_per_token, commitment, discount_pct, quota_rpm, quota_tpm) VALUES
  ('pp-banking-h100-han1',    'banking',    'H100', 'HAN-1', 12.50,  0.000001,  '91-180',    20.0, 1000, 1000000),
  ('pp-coding-h100-han1',     'coding',     'H100', 'HAN-1', 2.50,   0.0000005, 'on-demand',  0.0, NULL, NULL),
  ('pp-securities-h200-sgn1', 'securities', 'H200', 'SGN-1', 3.30,   0.0000008, 'on-demand',  0.0,  500,  500000)
ON CONFLICT (segment, gpu, region) DO NOTHING;

-- US-06 — endpoint gắn với gói giá đã resolve (segment, gpu, region)
ALTER TABLE endpoint_entities ADD COLUMN IF NOT EXISTS price_pack_id TEXT;

-- US-07 — index cho aggregate dashboard hiệu quả (không full scan lớn)
CREATE INDEX IF NOT EXISTS idx_endpoint_usage_ep_time   ON endpoint_usage(endpoint_id, created_at);
CREATE INDEX IF NOT EXISTS idx_endpoint_entities_segment ON endpoint_entities(segment);
CREATE INDEX IF NOT EXISTS idx_guardrail_event_ts        ON guardrail_event(ts);

INSERT INTO _schema_version (version) VALUES (11) ON CONFLICT DO NOTHING;