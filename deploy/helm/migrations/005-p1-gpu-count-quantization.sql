-- Migration 005 — P1: GPU count (tensor parallel) + quantization (immutable — đổi phải redeploy)
-- Gap #3 (post-deploy config): cho phép chỉnh gpuCount/quantization, đổi → endpoint redeploy.

BEGIN;

ALTER TABLE endpoint_entities
  ADD COLUMN IF NOT EXISTS gpu_count INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS quantization TEXT NOT NULL DEFAULT 'bf16';

INSERT INTO _schema_version (version) VALUES (5) ON CONFLICT DO NOTHING;

COMMIT;