-- Migration 006 — P2: host KV cache (immutable, đổi phải redeploy) + sampling defaults (hot-update)
-- Gap #3 (post-deploy config): host KV cache cho context dài; sampling defaults (temperature/top_p/max_tokens).

BEGIN;

ALTER TABLE endpoint_entities
  ADD COLUMN IF NOT EXISTS host_kv_cache BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sampling_defaults JSONB;

INSERT INTO _schema_version (version) VALUES (6) ON CONFLICT DO NOTHING;

COMMIT;