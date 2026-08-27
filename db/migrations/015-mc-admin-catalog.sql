-- Migration 015 — Model Catalog Admin (DDI)
-- Bảng workflow nội bộ cho admin Model Catalog: entry, category, mirror jobs, pending updates.
-- Audit tái dụng bảng audit_log (migration 008) với entity_type='mc_entry'.
-- Idempotent: IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS mc_entries (
  id                     TEXT PRIMARY KEY,
  catalog_type           TEXT NOT NULL DEFAULT 'public' CHECK (catalog_type IN ('public','proprietary')),
  status_code            TEXT NOT NULL DEFAULT 'draft' CHECK (status_code IN ('draft','pending_review','active','inactive')),
  hf_model_id            TEXT NOT NULL,
  revision               TEXT,
  display_name           TEXT NOT NULL,
  short_description      TEXT,
  parameters_display     TEXT,
  context_length_display TEXT,
  license                TEXT NOT NULL,
  badge_code             TEXT,
  sort_order             INT NOT NULL DEFAULT 0,
  from_price             NUMERIC(10,2),
  categories             TEXT[] NOT NULL DEFAULT '{}',
  benchmarks             JSONB NOT NULL DEFAULT '[]',
  hardware_profiles      JSONB NOT NULL DEFAULT '[]',
  weight_status          TEXT NOT NULL DEFAULT 'not_mirrored' CHECK (weight_status IN ('not_mirrored','mirroring','mirrored','mirror_failed')),
  mirror_path            TEXT,
  mirror_checksum        TEXT,
  sync_enabled           BOOLEAN NOT NULL DEFAULT TRUE,
  version                INT NOT NULL DEFAULT 1,
  published_at           TIMESTAMPTZ,
  created_by             TEXT NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mc_entries_status      ON mc_entries(status_code);
CREATE INDEX IF NOT EXISTS idx_mc_entries_catalog_type ON mc_entries(catalog_type);
CREATE INDEX IF NOT EXISTS idx_mc_entries_hf_model_id ON mc_entries(hf_model_id);
CREATE INDEX IF NOT EXISTS idx_mc_entries_hw          ON mc_entries USING GIN (hardware_profiles);

CREATE TABLE IF NOT EXISTS mc_categories (
  code          TEXT PRIMARY KEY,
  display_name  TEXT NOT NULL,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mc_mirror_jobs (
  id            TEXT PRIMARY KEY,
  entry_id      TEXT NOT NULL REFERENCES mc_entries(id) ON DELETE CASCADE,
  revision      TEXT,
  status        TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','downloading','mirrored','failed','cancelled')),
  progress_pct  INT NOT NULL DEFAULT 0,
  attempts      INT NOT NULL DEFAULT 0,
  error         TEXT,
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_mc_mirror_jobs_status ON mc_mirror_jobs(status);
CREATE INDEX IF NOT EXISTS idx_mc_mirror_jobs_entry  ON mc_mirror_jobs(entry_id);

-- Phase 2 — đề xuất revision mới từ auto-sync HF
CREATE TABLE IF NOT EXISTS mc_pending_updates (
  id             TEXT PRIMARY KEY,
  entry_id       TEXT NOT NULL REFERENCES mc_entries(id) ON DELETE CASCADE,
  old_revision   TEXT,
  new_revision   TEXT,
  detected_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  decided_by     TEXT,
  decided_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_mc_pending_updates_status ON mc_pending_updates(status);

-- Seed category mặc định (khớp ví dụ BFF: chat, reasoning, code, vision, agent)
INSERT INTO mc_categories (code, display_name, sort_order) VALUES
  ('chat', 'Chat & Conversation', 0),
  ('reasoning', 'Reasoning', 1),
  ('code', 'Code', 2),
  ('vision', 'Vision', 3),
  ('agent', 'Agent', 4)
ON CONFLICT (code) DO NOTHING;