"use strict";

// US-04 — Documents REST API.
//   POST /v1/documents            (scope endpoints) — upload multipart + metadata → tạo job
//   GET  /v1/documents            (scope endpoints) — list, lọc segment/status
//   GET  /v1/documents/:id        (scope endpoints) — chi tiết job + fields
//   POST /v1/documents/:id/confirm (scope endpoints + role operator/admin) — xác nhận/sửa thủ công fields
// Auth gate (scope) ở server.js; role confirm enforce ở roleRequirement (server.js).

const express = require("express");
const path = require("path");
const multer = require("multer");
const cfg = require("./config");
const store = require("./store");
const audit = require("../audit/store");

const router = express.Router();

// Multer — memory storage, rồi ghi vào jobDir (tránh file tạm rác)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: cfg.storage.maxFileSizeBytes },
});

function actorOf(req) { return (req.apiKey && req.apiKey.name) || "unknown"; }
function roleOf(req) { return (req.apiKey && req.apiKey.role) || "viewer"; }
function ipOf(req) { return req.ip || req.headers["x-forwarded-for"] || null; }

// POST /documents — upload file + metadata → tạo job queued
router.post("/documents", upload.single("file"), async (req, res) => {
  try {
    const { doc_type, segment, endpoint_id } = req.body || {};
    if (!req.file) return res.status(400).json({ error: "Thiếu file (field 'file')" });
    const docType = doc_type || "contract";
    if (!cfg.docTypes.includes(docType)) {
      return res.status(400).json({ error: `doc_type phải thuộc ${cfg.docTypes.join(", ")}` });
    }
    const seg = segment || "insurance";
    if (!cfg.segments.includes(seg)) {
      return res.status(400).json({ error: `segment phải thuộc ${cfg.segments.join(", ")}` });
    }
    const ext = path.extname(req.file.originalname || "").toLowerCase();
    if (!cfg.storage.allowedExts.includes(ext)) {
      return res.status(400).json({ error: `Định dạng không hỗ trợ: ${ext || "(không có đuôi)"} (cho phép ${cfg.storage.allowedExts.join(", ")})` });
    }
    const job = await store.create({
      endpoint_id: endpoint_id || null,
      segment: seg,
      doc_type: docType,
      filename: req.file.originalname,
      file_size: req.file.size,
    });
    store.saveFile(job.id, req.file.originalname, req.file.buffer);
    await audit.record({
      actor: actorOf(req), role: roleOf(req), action: "document.create",
      entityId: job.id, entityType: "document_job", result: "success", ip: ipOf(req),
      meta: { docType, segment: seg, filename: req.file.originalname, fileSize: req.file.size },
    });
    res.status(201).json({
      id: job.id, status: job.status, docType: job.docType, segment: job.segment,
      message: "Document job đã queue. Poll GET /v1/documents/:id để xem kết quả.",
    });
  } catch (e) {
    console.error("[documents] POST /documents error", e);
    res.status(500).json({ error: "Lỗi máy chủ", details: [e.message] });
  }
});

// GET /documents — list job, lọc segment/status
router.get("/documents", async (req, res) => {
  try {
    const { segment, status, limit } = req.query || {};
    const data = await store.list({ segment, status, limit });
    res.json({ count: data.length, data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /documents/:id — chi tiết job + fields
router.get("/documents/:id", async (req, res) => {
  const job = await store.getById(req.params.id);
  if (!job) return res.status(404).json({ error: "Không tìm thấy document job" });
  res.json({ data: job });
});

// POST /documents/:id/confirm — xác nhận / sửa thủ công fields → lưu lại
router.post("/documents/:id/confirm", async (req, res) => {
  try {
    const job = await store.getById(req.params.id);
    if (!job) return res.status(404).json({ error: "Không tìm thấy document job" });
    const { fields } = req.body || {};
    if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
      return res.status(400).json({ error: "Cần truyền fields (object) để xác nhận/sửa" });
    }
    const updated = await store.update(req.params.id, { fields });
    await audit.record({
      actor: actorOf(req), role: roleOf(req), action: "document.confirm",
      entityId: req.params.id, entityType: "document_job", result: "success", ip: ipOf(req),
      meta: { fields },
    });
    res.json({ data: updated });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;