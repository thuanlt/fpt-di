-- Migration 003 — migrate keys/endpoints từ file-store sang Postgres (Gap 1)
-- Bảng auth + audit cho phép scale ngang và có vết admin action.

BEGIN;

CREATE TABLE IF NOT EXISTS api_keys (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL UNIQUE,
  key_hash     TEXT NOT NULL UNIQUE,                 -- sha256(full_key)
  key_prefix   TEXT NOT NULL,                         -- "ddi-live-xxx•••"
  scopes       TEXT[] NOT NULL DEFAULT '{}',
  status       TEXT NOT NULL DEFAULT 'active',        -- active | revoked
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at   TIMESTAMPTZ,
  rotated_at   TIMESTAMPTZ,
  scopes_updated_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash) WHERE status='active';
CREATE INDEX IF NOT EXISTS idx_api_keys_name ON api_keys(name);

CREATE TABLE IF NOT EXISTS endpoint_entities (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL UNIQUE,
  model            TEXT NOT NULL,
  gpu              TEXT NOT NULL,
  region           TEXT NOT NULL,
  mode             TEXT NOT NULL,
  commit           TEXT NOT NULL,
  replicas         TEXT NOT NULL,
  desired_replicas INT NOT NULL,
  max_replicas     INT NOT NULL,
  rate             NUMERIC(10,2) NOT NULL,
  commit_label     TEXT NOT NULL,
  image            TEXT,
  port             INT,
  status           TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ,
  started_at       TIMESTAMPTZ,
  stopped_at       TIMESTAMPTZ,
  failed_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_endpoints_status ON endpoint_entities(status);
CREATE INDEX IF NOT EXISTS idx_endpoints_model  ON endpoint_entities(model);

CREATE TABLE IF NOT EXISTS endpoint_events (
  id          BIGSERIAL PRIMARY KEY,
  endpoint_id TEXT NOT NULL REFERENCES endpoint_entities(id) ON DELETE CASCADE,
  at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  from_state  TEXT,
  to_state    TEXT NOT NULL,
  msg         TEXT
);
CREATE INDEX IF NOT EXISTS idx_endpoint_events_ep ON endpoint_events(endpoint_id, at);

CREATE TABLE IF NOT EXISTS key_usage_audit (
  id      BIGSERIAL PRIMARY KEY,
  key_id  TEXT NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  action  TEXT NOT NULL,            -- create | verify | revoke | rotate | scope_update | delete
  actor   TEXT,
  meta    JSONB
);
CREATE INDEX IF NOT EXISTS idx_key_audit_key ON key_usage_audit(key_id, at);

INSERT INTO _schema_version (version) VALUES (3) ON CONFLICT DO NOTHING;

COMMIT;
