"use strict";

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cfg = require("./config");
const storage = require("./storage");
const queue = require("./queue");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: cfg.storage.maxJobSizeBytes },
});

function validateBody(body) {
  const errors = [];
  const out = {};
  if (!body.model || typeof body.model !== "string") {
    errors.push("model: bắt buộc");
  } else if (!cfg.models.includes(body.model)) {
    errors.push(`model: phải thuộc ${cfg.models.join(", ")}`);
  } else {
    out.model = body.model;
  }
  if (body.temperature !== undefined) {
    const t = Number(body.temperature);
    if (!Number.isFinite(t) || t < 0 || t > 2) errors.push("temperature: 0–2");
    else out.temperature = t;
  }
  if (body.max_tokens !== undefined) {
    const m = Number(body.max_tokens);
    if (!Number.isInteger(m) || m < 1 || m > 32000) errors.push("max_tokens: 1–32000");
    else out.max_tokens = m;
  }
  if (body.webhook_url !== undefined) {
    try { new URL(body.webhook_url); out.webhookUrl = body.webhook_url; }
    catch (_) { errors.push("webhook_url: URL không hợp lệ"); }
  }
  return { errors, value: out };
}

function parseJsonl(buffer) {
  const text = buffer.toString("utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  if (lines.length === 0) throw new Error("JSONL rỗng");
  if (lines.length > cfg.limits.maxRequestsPerJob) {
    throw new Error(`vượt giới hạn ${cfg.limits.maxRequestsPerJob} requests/job (có ${lines.length})`);
  }
  const parsed = [];
  for (let i = 0; i < lines.length; i++) {
    try { parsed.push(JSON.parse(lines[i])); }
    catch (e) { throw new Error(`dòng ${i + 1}: JSON không hợp lệ — ${e.message}`); }
  }
  for (let i = 0; i < parsed.length; i++) {
    const r = parsed[i];
    const hasMsgs = Array.isArray(r.messages) && r.messages.length > 0;
    const hasPrompt = typeof r.prompt === "string" && r.prompt.length > 0;
    if (!hasMsgs && !hasPrompt) {
      throw new Error(`dòng ${i + 1}: phải có 'messages' (array) hoặc 'prompt' (string)`);
    }
  }
  return { lines: parsed, size: buffer.length };
}

router.post("/batch", upload.single("file"), async (req, res) => {
  try {
    const fields = req.body || {};
    const { errors, value } = validateBody(fields);
    if (errors.length) return res.status(400).json({ error: "Dữ liệu không hợp lệ", details: errors });

    if (!req.file) return res.status(400).json({ error: "Thiếu file JSONL (trường 'file')" });

    let parsed;
    try { parsed = parseJsonl(req.file.buffer); }
    catch (e) { return res.status(400).json({ error: "File không hợp lệ", details: [e.message] }); }

    const jobId = storage.safeJobId();
    storage.ensureJobDir(jobId);
    fs.writeFileSync(storage.inputPath(jobId), req.file.buffer);

    const meta = {
      id: jobId,
      model: value.model,
      requests: parsed.lines.length,
      submittedAt: new Date().toISOString(),
      status: "queued",
      window: "—",
      webhookUrl: value.webhookUrl || null,
      temperature: value.temperature,
      maxTokens: value.max_tokens,
      fileSizeBytes: parsed.size,
      savings: "−50%",
    };
    storage.writeMeta(jobId, meta);

    await queue.enqueue(jobId, {
      model: value.model,
      temperature: value.temperature,
      max_tokens: value.max_tokens,
      webhookUrl: value.webhookUrl,
      meta,
    });

    res.status(201).json({
      id: jobId,
      status: "queued",
      model: value.model,
      requests: parsed.lines.length,
      window: `tối đa ${cfg.limits.completionWindowH}h`,
      discount: `−${(cfg.pricing.batchDiscount * 100).toFixed(0)}%`,
      submittedAt: meta.submittedAt,
    });
  } catch (e) {
    console.error("[batch] POST /batch error", e);
    res.status(500).json({ error: "Lỗi máy chủ", details: [e.message] });
  }
});

router.get("/batch", async (req, res) => {
  try {
    const status = req.query.status || undefined;
    const jobs = await queue.listJobs({ status });
    res.json({ count: jobs.length, data: jobs });
  } catch (e) {
    console.error("[batch] GET /batch error", e);
    res.status(500).json({ error: "Lỗi máy chủ" });
  }
});

router.get("/batch/:id", async (req, res) => {
  try {
    const meta = await queue.getJobMeta(req.params.id);
    if (!meta) return res.status(404).json({ error: "Không tìm thấy job" });
    const stats = storage.readOutputStats(req.params.id);
    res.json({
      data: {
        ...meta,
        outputLines: stats.lines,
        outputSizeBytes: stats.sizeBytes,
        inputPath: storage.inputPath(req.params.id),
        outputPath: storage.outputPath(req.params.id),
      },
    });
  } catch (e) {
    res.status(500).json({ error: "Lỗi máy chủ" });
  }
});

router.get("/batch/:id/output", async (req, res) => {
  try {
    const meta = await queue.getJobMeta(req.params.id);
    if (!meta) return res.status(404).json({ error: "Không tìm thấy job" });
    if (meta.status !== "completed" && meta.status !== "failed") {
      return res.status(409).json({ error: `Job chưa hoàn thành (hiện ${meta.status})` });
    }
    const p = storage.outputPath(req.params.id);
    if (!fs.existsSync(p)) return res.status(404).json({ error: "Output chưa có" });
    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Content-Disposition", `attachment; filename="${req.params.id}-output.jsonl"`);
    fs.createReadStream(p).pipe(res);
  } catch (e) {
    res.status(500).json({ error: "Lỗi máy chủ" });
  }
});

router.get("/batch/_/stats", async (req, res) => {
  try {
    const stats = await queue.getStats();
    res.json({ data: stats });
  } catch (e) {
    res.status(500).json({ error: "Lỗi máy chủ" });
  }
});

router.get("/models", (req, res) => {
  res.json({
    count: cfg.models.length,
    data: cfg.models.map((m) => ({
      id: m,
      batch_supported: true,
      in_per_million: cfg.pricing.ratePerMillionIn[m] || 0,
      out_per_million: cfg.pricing.ratePerMillionOut[m] || 0,
      discount: `${(cfg.pricing.batchDiscount * 100).toFixed(0)}%`,
    })),
  });
});

module.exports = router;
