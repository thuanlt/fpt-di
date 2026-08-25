-- Migration 007 — US-10 Phân quyền theo vai trò (admin/operator/viewer)
-- Idempotent: preview Postgres volume persist, initdb không chạy lại.

ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'viewer';
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS role_updated_at TIMESTAMPTZ;