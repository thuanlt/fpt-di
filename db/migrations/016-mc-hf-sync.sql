-- Migration 016 — HF Auto-Sync (Model Catalog Admin)
-- Theo dõi fetch model mới + kiểm tra revision từ HuggingFace theo định kỳ.
-- Idempotent: IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.

-- Cột theo dõi HF trên entry
ALTER TABLE mc_entries ADD COLUMN IF NOT EXISTS hf_last_checked_at TIMESTAMPTZ;
ALTER TABLE mc_entries ADD COLUMN IF NOT EXISTS hf_discovered BOOLEAN NOT NULL DEFAULT FALSE;

-- Bảng ghi lịch sử lần chạy HF sync
CREATE TABLE IF NOT EXISTS mc_sync_runs (
  id            TEXT PRIMARY KEY,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at   TIMESTAMPTZ,
  discovered    INT NOT NULL DEFAULT 0,
  new_revisions INT NOT NULL DEFAULT 0,
  errors        INT NOT NULL DEFAULT 0,
  detail        JSONB NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_mc_sync_runs_started ON mc_sync_runs(started_at DESC);