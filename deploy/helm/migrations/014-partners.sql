-- Migration 014 — Partner onboarding (bảng partners)
-- Nâng cấp bảng partners từ schema cũ (migration 001: id SERIAL, share NUMERIC,
-- không có created_at) sang schema mới cho tính năng onboarding:
--   id UUID (gen_random_uuid), có created_at, có default, share INTEGER.
-- Idempotent: an toàn chạy nhiều lần (IF NOT EXISTS + ON CONFLICT DO NOTHING + DO guard).
-- Wrapped trong 1 transaction (DDL ở Postgres là transactional) — rebuild bảng là nguyên tử.

BEGIN;

-- 1) Bảng cũ (id SERIAL, chưa có cột created_at) → rebuild sang schema mới, giữ data.
DO $$
BEGIN
  -- Dọn bảng tạm còn sót từ lần chạy bị gián đoạn (nếu có) để rename không đụng hàng.
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'partners_old_001'
  ) THEN
    DROP TABLE partners_old_001;
  END IF;

  IF EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'partners'
     )
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'partners' AND column_name = 'created_at'
     )
  THEN
    ALTER TABLE partners RENAME TO partners_old_001;
    CREATE TABLE partners (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name        TEXT NOT NULL UNIQUE,
      contact     TEXT NOT NULL,
      top         TEXT NOT NULL DEFAULT '',
      integration TEXT NOT NULL DEFAULT '',
      status      TEXT NOT NULL DEFAULT 'pending',  -- pending | trialing | active | on hold
      note        TEXT NOT NULL DEFAULT '',
      since       TEXT NOT NULL,                    -- YYYY-MM
      models      INTEGER NOT NULL DEFAULT 0,
      share       INTEGER NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    INSERT INTO partners (name, contact, top, integration, status, note, since, models, share)
      SELECT name, contact, top, integration, status, note, since, models, share::integer
      FROM partners_old_001;
    DROP TABLE partners_old_001;
  END IF;
END $$;

-- 2) Nếu bảng chưa tồn tại (chưa chạy 001) → tạo mới.
CREATE TABLE IF NOT EXISTS partners (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  contact     TEXT NOT NULL,
  top         TEXT NOT NULL DEFAULT '',
  integration TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'pending',  -- pending | trialing | active | on hold
  note        TEXT NOT NULL DEFAULT '',
  since       TEXT NOT NULL,                    -- YYYY-MM
  models      INTEGER NOT NULL DEFAULT 0,
  share       INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partners_status  ON partners(status);
CREATE INDEX IF NOT EXISTS idx_partners_created ON partners(created_at);

-- 3) Seed 7 partner mock (DATA.partners trong app.js). ON CONFLICT DO NOTHING → idempotent.
INSERT INTO partners (name, contact, top, integration, status, note, since, models, share) VALUES
  ('FPT.AI', 'ai-partners@fpt.com', 'FPT-LLM 8B (vi)', 'Native', 'active', 'Flagship Vietnamese LLM family. Tightest latency integration in catalog.', '2024-03', 14, 22),
  ('Qwen (Alibaba)', 'partners@qwen.org', 'Qwen3-235B-A22B', 'vLLM + OpenAI API', 'active', 'Highest-volume open-weights family. Batch discount program applies.', '2024-07', 9, 18),
  ('Meta Llama', 'llama-ops@meta.com', 'Llama-3.3-70B', 'Triton + vLLM', 'active', 'Community license verified for all deployment sizes.', '2024-05', 6, 15),
  ('DeepSeek', 'bd@deepseek.com', 'DeepSeek-R1', 'SGLang', 'active', 'Reasoning workloads. Long-context KV cache tuning in progress.', '2025-02', 4, 11),
  ('Mistral AI', 'partnerships@mistral.ai', 'Mistral-Large-2', 'vLLM', 'trialing', 'Trial for EU-headquartered customers in Vietnam.', '2026-06', 5, 8),
  ('Cohere', 'apac@cohere.com', 'Command-R+', 'Pending', 'on hold', 'On hold pending enterprise compliance pack (SOC2 scope review).', '2026-07', 3, 5),
  ('Zhipu GLM', 'bd@zhipuai.ai', 'GLM-4.6', 'vLLM', 'active', 'Strong coding + agent benchmarks. Growing in dev-tool segment.', '2025-09', 4, 6),
  ('VinAI', 'api@vinai.io', 'PhoGPT-4B', 'Native', 'active', 'Vietnamese specialist models for on-prem edge deployments.', '2024-11', 3, 4)
ON CONFLICT (name) DO NOTHING;

INSERT INTO _schema_version (version) VALUES (14) ON CONFLICT DO NOTHING;

COMMIT;