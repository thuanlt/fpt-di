-- Migration 004 — P0: SLO-driven autoscaling (scaling metric/target) + context length (max_model_len)
-- Gap #3 (post-deploy config): cho phép chỉnh scaling metric/target + max_model_len sau khi deploy.

BEGIN;

ALTER TABLE endpoint_entities
  ADD COLUMN IF NOT EXISTS scaling_metric TEXT NOT NULL DEFAULT 'inflight',
  ADD COLUMN IF NOT EXISTS scaling_target INT,
  ADD COLUMN IF NOT EXISTS max_model_len INT;

INSERT INTO _schema_version (version) VALUES (4) ON CONFLICT DO NOTHING;

COMMIT;