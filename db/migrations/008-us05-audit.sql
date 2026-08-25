-- Migration 008 — US-05 Audit trail bất biến (append-only)
-- Không có UPDATE/DELETE — chỉ INSERT (append-only). Không expose API xóa.

CREATE TABLE IF NOT EXISTS audit_log (
  id          TEXT PRIMARY KEY,
  ts          TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor       TEXT NOT NULL,
  role        TEXT,
  action      TEXT NOT NULL,
  entity_id   TEXT,
  entity_type TEXT,
  result      TEXT NOT NULL DEFAULT 'success',
  ip          TEXT,
  meta        JSONB
);
CREATE INDEX IF NOT EXISTS idx_audit_ts     ON audit_log(ts);
CREATE INDEX IF NOT EXISTS idx_audit_actor  ON audit_log(actor);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);