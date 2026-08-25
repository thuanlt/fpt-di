-- Migration 012 — US-04 Trích xuất tài liệu bảo hiểm (document_job)
-- Bảng document_job + index trên status, segment, created_at.
-- endpoint_entities không đổi (dùng segment=insurance có sẵn).

CREATE TABLE IF NOT EXISTS document_job (
  id            TEXT PRIMARY KEY,
  endpoint_id   TEXT,              -- endpoint insurance dùng để trích xuất (tuỳ chọn)
  segment       TEXT NOT NULL DEFAULT 'insurance',
  doc_type      TEXT NOT NULL DEFAULT 'contract',  -- contract | claim
  filename      TEXT NOT NULL,
  file_size     INT,
  status        TEXT NOT NULL DEFAULT 'queued',    -- queued|processing|completed|failed
  fields        JSONB,             -- kết quả trích xuất
  confidence    NUMERIC(5,4),      -- độ tin cậy tổng
  redacted      BOOLEAN DEFAULT FALSE,  -- có che thông tin nhạy cảm không
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_job_status   ON document_job(status);
CREATE INDEX IF NOT EXISTS idx_document_job_segment  ON document_job(segment);
CREATE INDEX IF NOT EXISTS idx_document_job_created  ON document_job(created_at);

INSERT INTO _schema_version (version) VALUES (12) ON CONFLICT DO NOTHING;