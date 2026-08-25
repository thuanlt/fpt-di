"use strict";

const express = require("express");
const store = require("./store");
const audit = require("../audit/store");

const router = express.Router();

function actorOf(req) {
  return (req.apiKey && req.apiKey.name) || "unknown";
}
function roleOf(req) {
  return (req.apiKey && req.apiKey.role) || "viewer";
}
function ipOf(req) {
  return req.ip || req.headers["x-forwarded-for"] || null;
}

router.get("/endpoints", async (req, res) => {
  const { status, mode } = req.query;
  const data = await store.list({ status, mode });
  res.json({ count: data.length, data });
});

router.post("/endpoints", async (req, res) => {
  try {
    const ep = await store.create(req.body || {});
    await audit.record({
      actor: actorOf(req), role: roleOf(req), action: "endpoint.create",
      entityId: ep.id, entityType: "endpoint", result: "success", ip: ipOf(req),
      meta: { name: ep.name, model: ep.model, gpu: ep.gpu, segment: ep.segment, engine: ep.engine },
    });
    res.status(201).json({ data: ep });
  } catch (e) {
    const dup = /đã tồn tại/.test(e.message);
    await audit.record({
      actor: actorOf(req), role: roleOf(req), action: "endpoint.create",
      entityType: "endpoint", result: "failure", ip: ipOf(req), meta: { error: e.message },
    });
    res.status(dup ? 409 : 400).json({ error: e.message });
  }
});

// US-08 — PATCH /endpoints/:id cập nhật codePrivacy
router.patch("/endpoints/:id", async (req, res) => {
  try {
    const { codePrivacy } = req.body || {};
    if (codePrivacy === undefined) {
      return res.status(400).json({ error: "Cần truyền codePrivacy" });
    }
    const ep = await store.updateCodePrivacy(req.params.id, codePrivacy);
    if (!ep) return res.status(404).json({ error: "Không tìm thấy endpoint" });
    await audit.record({
      actor: actorOf(req), role: roleOf(req), action: "endpoint.update",
      entityId: ep.id, entityType: "endpoint", result: "success", ip: ipOf(req),
      meta: { codePrivacy: !!codePrivacy },
    });
    res.json({ data: ep });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// US-02 — PATCH /endpoints/:id/guardrails cấu hình guardrails
router.patch("/endpoints/:id/guardrails", async (req, res) => {
  try {
    const { enabled, template, rules } = req.body || {};
    const ep = await store.updateGuardrails(req.params.id, { enabled, template, rules });
    if (!ep) return res.status(404).json({ error: "Không tìm thấy endpoint" });
    await audit.record({
      actor: actorOf(req), role: roleOf(req), action: "endpoint.guardrails",
      entityId: ep.id, entityType: "endpoint", result: "success", ip: ipOf(req),
      meta: { enabled: ep.guardrailsEnabled, template: ep.guardrailsTemplate },
    });
    res.json({ data: ep });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// US-02 — GET /endpoints/:id/guardrails/events — đếm blocked theo rule
router.get("/endpoints/:id/guardrails/events", async (req, res) => {
  try {
    const db = require("../db/pool");
    const { rows } = await db.query(
      `SELECT rule, severity, count(*)::int AS blocked
       FROM guardrail_event WHERE endpoint_id=$1 AND blocked=TRUE
       GROUP BY rule, severity ORDER BY blocked DESC`,
      [req.params.id]
    );
    res.json({ data: { endpointId: req.params.id, rules: rows } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/endpoints/:id", async (req, res) => {
  const ep = await store.getById(req.params.id);
  if (!ep) return res.status(404).json({ error: "Không tìm thấy endpoint" });
  res.json({ data: ep });
});

router.post("/endpoints/:id/scale", async (req, res) => {
  try {
    const { replicas } = req.body || {};
    const ep = await store.scale(req.params.id, replicas);
    if (!ep) return res.status(404).json({ error: "Không tìm thấy endpoint" });
    res.json({ data: ep });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Sprint 3 (T3.3) — swap GPU giữa kỳ, chỉ khi endpoint allowGpuSwap=true
router.post("/endpoints/:id/swap-gpu", async (req, res) => {
  try {
    const { gpu } = req.body || {};
    const ep = await store.swapGpu(req.params.id, gpu);
    if (!ep) return res.status(404).json({ error: "Không tìm thấy endpoint" });
    res.json({ data: ep });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// P0 — cấu hình sau deploy (hot-update): đổi scaling metric/target + context length
// P2 — thêm sampling defaults (temperature/top_p/max_tokens)
router.put("/endpoints/:id/config", async (req, res) => {
  try {
    const { scalingMetric, scalingTarget, maxModelLen, samplingDefaults } = req.body || {};
    const ep = await store.config(req.params.id, { scalingMetric, scalingTarget, maxModelLen, samplingDefaults });
    if (!ep) return res.status(404).json({ error: "Không tìm thấy endpoint" });
    res.json({ data: ep });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// P1 — đổi GPU count (tensor parallel) / quantization — immutable, bắt redeploy
// P2 — thêm host KV cache (immutable)
router.put("/endpoints/:id/redeploy-config", async (req, res) => {
  try {
    const { gpuCount, quantization, hostKvCache } = req.body || {};
    const ep = await store.redeployConfig(req.params.id, { gpuCount, quantization, hostKvCache });
    if (!ep) return res.status(404).json({ error: "Không tìm thấy endpoint" });
    res.json({ data: ep });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/endpoints/:id/start", async (req, res) => {
  try {
    const ep = await store.start(req.params.id);
    if (!ep) return res.status(404).json({ error: "Không tìm thấy endpoint" });
    res.json({ data: ep });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/endpoints/:id/stop", async (req, res) => {
  try {
    const ep = await store.stop(req.params.id);
    if (!ep) return res.status(404).json({ error: "Không tìm thấy endpoint" });
    res.json({ data: ep });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.put("/endpoints/:id/status", async (req, res) => {
  try {
    const { status, msg } = req.body || {};
    const ep = await store.transition(req.params.id, status, msg);
    if (!ep) return res.status(404).json({ error: "Không tìm thấy endpoint" });
    res.json({ data: ep });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete("/endpoints/:id", async (req, res) => {
  const ok = await store.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: "Không tìm thấy endpoint" });
  await audit.record({
    actor: actorOf(req), role: roleOf(req), action: "endpoint.delete",
    entityId: req.params.id, entityType: "endpoint", result: "success", ip: ipOf(req),
  });
  res.json({ message: "Đã xóa endpoint" });
});

module.exports = router;
