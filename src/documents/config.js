"use strict";

// US-04 — Documents config (trích xuất tài liệu bảo hiểm).
// File upload luôn lưu trên disk tại <storage.root>/<jobId>/<filename>.

const fs = require("fs");

const cfg = {
  storage: {
    root: process.env.DOCUMENTS_STORAGE_ROOT || "/data/documents",
    maxFileSizeBytes: 50 * 1024 * 1024, // 50MB
    // Định dạng hỗ trợ (text/JSON parse trực tiếp; PDF mock trong preview)
    allowedExts: [".txt", ".json", ".pdf", ".csv", ".md"],
  },
  worker: {
    pollIntervalMs: parseInt(process.env.DOCUMENTS_WORKER_POLL_MS || "2000", 10),
    concurrent: parseInt(process.env.DOCUMENTS_WORKER_CONCURRENCY || "2", 10),
  },
  docTypes: ["contract", "claim"],
  segments: ["insurance", "general"],
  lifecycle: ["queued", "processing", "completed", "failed"],
};

// Đảm bảo root tồn tại (health check + worker + saveFile)
try { fs.mkdirSync(cfg.storage.root, { recursive: true }); } catch (_) {}

module.exports = cfg;