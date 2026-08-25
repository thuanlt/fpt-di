-- Migration 013 — BR-05.4 DGX Cloud scaffold (roadmap)
-- Chỉ scaffold cột deployment_target (onprem | dgx_cloud) — chưa tích hợp API NVIDIA
-- (cần thỏa thuận + API key NVIDIA, chưa có trong preview).
-- Frontend: option "DGX Cloud" trong modal deploy hiển thị "coming soon" (disabled).

ALTER TABLE endpoint_entities ADD COLUMN IF NOT EXISTS deployment_target TEXT DEFAULT 'onprem';
ALTER TABLE price_pack ADD COLUMN IF NOT EXISTS deployment_target TEXT DEFAULT 'onprem';

INSERT INTO _schema_version (version) VALUES (13) ON CONFLICT DO NOTHING;