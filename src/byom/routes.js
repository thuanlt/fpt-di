"use strict";

const express = require("express");
const cfg = require("./config");
const store = require("./store");
const endpointsStore = require("../endpoints/store");
const { fetchHfRepoInfo } = require("./processor");

const router = express.Router();

function isHfRepo(s) {
  return /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(s) && !/^https?:\/\//.test(s);
}
function isS3Url(s) {
  return /^https?:\/\//.test(s);
}

// POST /byom — submit upload job (HF repo or S3 presigned URL)
router.post("/byom", async (req, res) => {
  try {
    const { modelSource, modelName, hfToken, description, type } = req.body || {};
    if (!modelSource || typeof modelSource !== "string") {
      return res.status(400).json({ error: "modelSource bắt buộc (HF repo path hoặc S3 presigned URL)" });
    }
    let resolvedType = type;
    if (!resolvedType) {
      resolvedType = isHfRepo(modelSource) ? "huggingface" : isS3Url(modelSource) ? "s3" : null;
    }
    if (!resolvedType || !["huggingface", "s3"].includes(resolvedType)) {
      return res.status(400).json({ error: "modelSource phải là HF repo (org/name) hoặc URL https" });
    }
    if (!modelName || typeof modelName !== "string" || !/^[a-z0-9][a-z0-9-]{1,62}$/.test(modelName)) {
      return res.status(400).json({ error: "modelName bắt buộc, chỉ chữ thường/số/gạch nối, 2-63 ký tự" });
    }
    const existing = store.listAll().find((j) => j.modelName === modelName && j.status !== "failed" && j.status !== "cancelled");
    if (existing) return res.status(409).json({ error: `modelName "${modelName}" đã tồn tại (job ${existing.id})` });

    // HF: verify repo reachable trước khi enqueue
    if (resolvedType === "huggingface") {
      try {
        const info = await fetchHfRepoInfo({ repo: modelSource, hfToken });
        const pipeline = (info.pipeline_tag || "text-generation").toLowerCase();
        if (!["text-generation", "feature-extraction", "text2text-generation", "embedding", null, ""].includes(pipeline)) {
          return res.status(400).json({ error: `HF pipeline "${pipeline}" không hỗ trợ (chỉ text-generation/embedding)` });
        }
      } catch (e) {
        if (e.code === "HF_REPO_NOT_FOUND") return res.status(404).json({ error: `HF repo "${modelSource}" không tồn tại` });
        if (e.code === "HF_AUTH_FAILED") return res.status(401).json({ error: "HF token không hợp lệ hoặc thiếu quyền" });
        return res.status(502).json({ error: `verify HF repo thất bại: ${e.message}` });
      }
    }

    // S3: kiểm tra ext archive
    if (resolvedType === "s3") {
      const clean = modelSource.split("?")[0].toLowerCase();
      const ok = cfg.storage.allowedArchiveExts.some((ext) => clean.endsWith(ext));
      if (!ok) return res.status(400).json({ error: `S3 source phải là archive ${cfg.storage.allowedArchiveExts.join(", ")}` });
    }

    const jobId = store.safeJobId();
    const now = new Date().toISOString();
    const meta = {
      id: jobId,
      modelName,
      modelSource,
      type: resolvedType,
      description: description || "",
      status: "queued",
      createdAt: now,
      updatedAt: now,
      events: [{ at: now, from: null, to: "queued", msg: `queued for ${resolvedType} fetch` }],
      payload: { type: resolvedType, modelSource, modelName, hfToken: hfToken || null },
    };
    store.writeMeta(jobId, meta);

    res.status(201).json({
      id: jobId,
      status: "queued",
      modelName,
      type: resolvedType,
      message: "Upload job đã queue. Poll GET /byom/:id để xem trạng thái.",
    });
  } catch (e) {
    console.error("[byom] POST /byom error", e);
    res.status(500).json({ error: "Lỗi máy chủ", details: [e.message] });
  }
});

// GET /byom — list all upload jobs
router.get("/byom", (req, res) => {
  try {
    const { status } = req.query;
    let jobs = store.listAll();
    if (status) jobs = jobs.filter((j) => j.status === status);
    const clean = jobs.map((j) => ({
      id: j.id, modelName: j.modelName, type: j.type, modelSource: j.modelSource,
      status: j.status, createdAt: j.createdAt, updatedAt: j.updatedAt,
      readyAt: j.readyAt || null, failedAt: j.failedAt || null,
      download: j.download || null, validation: j.validation || null,
      error: j.error || null,
    }));
    res.json({ count: clean.length, data: clean });
  } catch (e) {
    res.status(500).json({ error: "Lỗi máy chủ" });
  }
});

// GET /byom/:id — chi tiết job
router.get("/byom/:id", (req, res) => {
  const j = store.getById(req.params.id);
  if (!j) return res.status(404).json({ error: "Không tìm thấy upload job" });
  res.json({ data: j });
});

// GET /byom/:id/files — list weights files
router.get("/byom/:id/files", (req, res) => {
  const j = store.getById(req.params.id);
  if (!j) return res.status(404).json({ error: "Không tìm thấy upload job" });
  const w = store.weightsInfo(req.params.id);
  res.json({ data: { jobId: j.id, modelName: j.modelName, status: j.status, ...w } });
});

// DELETE /byom/:id — xóa job + weights
router.delete("/byom/:id", (req, res) => {
  const j = store.getById(req.params.id);
  if (!j) return res.status(404).json({ error: "Không tìm thấy upload job" });
  const ok = store.removeJob(req.params.id);
  res.json({ message: ok ? `Đã xóa job ${j.id}` : "Job không có file để xóa" });
});

// POST /byom/:id/cancel — hủy job queued/downloading
router.post("/byom/:id/cancel", (req, res) => {
  const j = store.getById(req.params.id);
  if (!j) return res.status(404).json({ error: "Không tìm thấy upload job" });
  if (!["queued", "downloading", "validating"].includes(j.status)) {
    return res.status(409).json({ error: `không thể hủy job ở trạng thái ${j.status}` });
  }
  store.updateMeta(req.params.id, {
    status: "cancelled",
    statusMsg: "user cancelled",
    cancelledAt: new Date().toISOString(),
  });
  res.json({ data: store.getById(req.params.id) });
});

// POST /byom/:id/deploy — tạo dedicated endpoint từ model BYOM đã ready
router.post("/byom/:id/deploy", async (req, res) => {
  const j = store.getById(req.params.id);
  if (!j) return res.status(404).json({ error: "Không tìm thấy upload job" });
  if (j.status !== "ready") {
    return res.status(409).json({ error: `job đang ở trạng thái "${j.status}" — chỉ deploy được khi ready` });
  }
  const eps = await endpointsStore.list();
  const existing = eps.find(
    (e) => e.model === j.modelName && !["stopped", "failed"].includes(e.status)
  );
  if (existing) {
    return res.status(409).json({ error: `model "${j.modelName}" đã có endpoint ${existing.name} (${existing.id})` });
  }
  try {
    const body = req.body || {};
    const ep = await endpointsStore.create({
      name: body.name || `byom-${j.modelName}`,
      model: j.modelName,
      gpu: body.gpu || "H100",
      region: body.region || "HAN-2",
      mode: body.mode || "k8s",
      commit: body.commit || "on-demand",
      minReplicas: body.minReplicas || 1,
      maxReplicas: body.maxReplicas || 1,
    });
    store.updateMeta(req.params.id, {
      status: "deployed",
      statusMsg: `deployed as endpoint ${ep.name}`,
      deployedAt: new Date().toISOString(),
      endpointId: ep.id,
      endpointName: ep.name,
    });
    res.status(201).json({
      data: ep,
      message: `Đã tạo endpoint "${ep.name}" cho model "${j.modelName}" — endpoint sẽ chuyển running trong vài giây.`,
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// GET /byom/:id/playground-preflight — kiểm tra job ready, trả preview endpoint cho UI playground gọi
router.get("/byom/:id/playground-preflight", (req, res) => {
  const j = store.getById(req.params.id);
  if (!j) return res.status(404).json({ error: "Không tìm thấy upload job" });
  if (j.status !== "ready") {
    return res.status(409).json({ error: `job đang ở "${j.status}" — chỉ playground được khi ready` });
  }
  res.json({
    data: {
      jobId: j.id,
      modelName: j.modelName,
      status: j.status,
      previewEndpoint: {
        model: `byom-${j.id}`,
        url: `${process.env.VLLM_BASE_URL || "http://vllm-adapter:8000"}/v1/chat/completions`,
        chatPath: "/v1/chat/completions",
        streaming: true,
        coldStartEstimateMs: 30000,
      },
    },
  });
});

// GET /byom/_/lifecycle — list trạng thái hợp lệ
router.get("/byom/_/lifecycle", (req, res) => {
  res.json({ data: cfg.lifecycle });
});

module.exports = router;
