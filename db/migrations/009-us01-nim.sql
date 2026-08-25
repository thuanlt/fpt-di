-- Migration 009 — US-01 Deploy NVIDIA NIM 1-click
-- Bảng model_catalog + seed NIM mẫu; ALTER endpoint_entities thêm cột NIM/guardrails/privacy.

CREATE TABLE IF NOT EXISTS model_catalog (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  family         TEXT NOT NULL DEFAULT 'llm',
  segments       TEXT[] NOT NULL DEFAULT '{}',
  source         TEXT NOT NULL DEFAULT 'fpt',
  nim_version    TEXT,
  gpu_compatible TEXT[] NOT NULL DEFAULT '{}',
  max_context    INT,
  quantizations  TEXT[] NOT NULL DEFAULT '{}',
  status         TEXT NOT NULL DEFAULT 'available'
);

-- Seed NIM mẫu (idempotent)
INSERT INTO model_catalog (id, name, family, segments, source, nim_version, gpu_compatible, max_context, quantizations, status) VALUES
  ('nim-deepseek-coder-33b', 'DeepSeek-Coder-33B', 'llm', '{coding}',            'nim', '25.01', '{H100,H200,A30}', 16384,  '{bf16,fp8}',     'available'),
  ('nim-llama-3-3-70b',      'Llama-3.3-70B',      'llm', '{general,coding}',    'nim', '25.02', '{H100,H200}',      131072, '{bf16,fp8,awq}', 'available'),
  ('nim-qwen-coder-32b',     'Qwen-Coder-32B',     'llm', '{coding}',            'nim', '25.01', '{H100,H200,A30}', 32768,  '{bf16,fp8}',     'available')
ON CONFLICT (id) DO NOTHING;

-- Cột mới cho endpoint_entities (US-01 + US-08 + US-02)
ALTER TABLE endpoint_entities ADD COLUMN IF NOT EXISTS segment             TEXT;
ALTER TABLE endpoint_entities ADD COLUMN IF NOT EXISTS engine              TEXT DEFAULT 'vllm';
ALTER TABLE endpoint_entities ADD COLUMN IF NOT EXISTS code_privacy        BOOLEAN DEFAULT FALSE;
ALTER TABLE endpoint_entities ADD COLUMN IF NOT EXISTS guardrails_enabled  BOOLEAN DEFAULT FALSE;
ALTER TABLE endpoint_entities ADD COLUMN IF NOT EXISTS guardrails_template TEXT;
ALTER TABLE endpoint_entities ADD COLUMN IF NOT EXISTS data_residency      TEXT DEFAULT 'VN';