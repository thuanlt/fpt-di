-- Migration 004 — O3 song song: carryover 20% quota + GPU swap
-- THÊM 2 trường vào endpoint_entities cho phép khách chưa dùng hết quota cam kết
-- thì chuyển giờ còn lại sang kỳ tiếp (carryover), và đổi GPU giữa kỳ (allow_gpu_swap).

BEGIN;

ALTER TABLE endpoint_entities
  ADD COLUMN IF NOT EXISTS carryover_quota_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS allow_gpu_swap        BOOLEAN NOT NULL DEFAULT FALSE;

-- Lịch sử carryover/swap để audit (tách khỏi endpoint_events cho dễ query)
CREATE TABLE IF NOT EXISTS endpoint_carryover_events (
  id          BIGSERIAL PRIMARY KEY,
  endpoint_id TEXT NOT NULL REFERENCES endpoint_entities(id) ON DELETE CASCADE,
  at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  type        TEXT NOT NULL,            -- carryover_credited | carryover_applied | gpu_swap
  hours       NUMERIC(10,2),
  from_gpu    TEXT,
  to_gpu      TEXT,
  old_rate    NUMERIC(10,2),
  new_rate    NUMERIC(10,2),
  msg         TEXT
);
CREATE INDEX IF NOT EXISTS idx_carryover_ep ON endpoint_carryover_events(endpoint_id, at);

INSERT INTO _schema_version (version) VALUES (4) ON CONFLICT DO NOTHING;

COMMIT;
