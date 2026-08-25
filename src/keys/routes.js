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

function extractKey(req) {
  const h = req.headers.authorization || "";
  if (h.startsWith("Bearer ")) return h.slice(7);
  return req.query.api_key || req.headers["x-api-key"] || "";
}

// auth() — async vì store.verify() có thể là promise (backend postgres)
function auth(scope) {
  return async (req, res, next) => {
    const key = extractKey(req);
    const rec = await store.verify(key);
    if (!rec) return res.status(401).json({ error: "API key không hợp lệ hoặc đã revoke" });
    if (!store.hasScope(rec, scope)) {
      return res.status(403).json({ error: `Key thiếu scope "${scope}"` });
    }
    req.apiKey = rec;
    await store.recordUsage(rec.id);
    next();
  };
}

router.get("/keys", async (req, res) => {
  const data = await store.listWithUsage();
  res.json({ count: data.length, data });
});

router.post("/keys", async (req, res) => {
  try {
    const { name, scopes, role } = req.body || {};
    const { id, fullKey, record } = await store.create({ name, scopes, role });
    await audit.record({
      actor: actorOf(req), role: roleOf(req), action: "key.create",
      entityId: id, entityType: "key", result: "success", ip: ipOf(req),
      meta: { name: record.name, scopes, role: record.role },
    });
    res.status(201).json({
      id,
      full_key: fullKey,
      name: record.name,
      keyPrefix: record.keyPrefix,
      scopes: record.scopes,
      role: record.role,
      status: record.status,
      createdAt: record.createdAt,
      message: "Lưu full_key ngay — không hiển thị lại được.",
    });
  } catch (e) {
    await audit.record({
      actor: actorOf(req), role: roleOf(req), action: "key.create",
      entityType: "key", result: "failure", ip: ipOf(req), meta: { error: e.message },
    });
    res.status(400).json({ error: e.message });
  }
});

// GET /keys/verify — xác thực key hiện tại (không ghi usage). Luôn public để
// console có thể check key người dùng đã set mà không cần quyền admin.
// Đặt TRƯỚC /keys/:id để không bị match nhầm id="verify".
router.get("/keys/verify", async (req, res) => {
  const key = extractKey(req);
  const rec = await store.verify(key);
  if (!rec) {
    return res.status(401).json({ valid: false, error: "API key không hợp lệ hoặc đã bị thu hồi" });
  }
  res.json({ valid: true, id: rec.id, name: rec.name, scopes: rec.scopes, status: rec.status });
});

router.get("/keys/:id", async (req, res) => {
  const k = await store.getById(req.params.id);
  if (!k) return res.status(404).json({ error: "Không tìm thấy key" });
  const usage = store.readUsage ? await store.readUsage() : {};
  res.json({ data: { ...k, keyHash: undefined, usage: usage[k.id] || 0 } });
});

router.post("/keys/:id/revoke", async (req, res) => {
  const k = await store.revoke(req.params.id);
  if (!k) return res.status(404).json({ error: "Không tìm thấy key" });
  await audit.record({
    actor: actorOf(req), role: roleOf(req), action: "key.revoke",
    entityId: k.id, entityType: "key", result: "success", ip: ipOf(req),
  });
  res.json({ data: { id: k.id, status: k.status, revokedAt: k.revokedAt } });
});

router.post("/keys/:id/rotate", async (req, res) => {
  try {
    const r = await store.rotate(req.params.id);
    if (!r) return res.status(404).json({ error: "Không tìm thấy key" });
    await audit.record({
      actor: actorOf(req), role: roleOf(req), action: "key.rotate",
      entityId: r.id, entityType: "key", result: "success", ip: ipOf(req),
    });
    res.json({
      id: r.id,
      full_key: r.fullKey,
      keyPrefix: r.record.keyPrefix,
      rotatedAt: r.record.rotatedAt,
      message: "Lưu full_key mới ngay — không hiển thị lại được.",
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.patch("/keys/:id", async (req, res) => {
  try {
    const { scopes, role } = req.body || {};
    let k = null;
    if (role !== undefined) {
      k = await store.updateRole(req.params.id, role);
    } else if (scopes !== undefined) {
      k = await store.updateScopes(req.params.id, scopes);
    } else {
      return res.status(400).json({ error: "Cần truyền scopes hoặc role để cập nhật" });
    }
    if (!k) return res.status(404).json({ error: "Không tìm thấy key" });
    await audit.record({
      actor: actorOf(req), role: roleOf(req), action: "key.update",
      entityId: k.id, entityType: "key", result: "success", ip: ipOf(req),
      meta: { scopes: k.scopes, role: k.role },
    });
    res.json({
      data: {
        id: k.id,
        name: k.name,
        keyPrefix: k.keyPrefix,
        scopes: k.scopes,
        role: k.role,
        status: k.status,
        scopesUpdatedAt: k.scopesUpdatedAt,
        roleUpdatedAt: k.roleUpdatedAt,
      },
      message: "Đã cập nhật key. Key giữ nguyên full_key cũ.",
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete("/keys/:id", async (req, res) => {
  const ok = await store.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: "Không tìm thấy key" });
  res.json({ message: "Đã xóa key" });
});

router.get("/keys/_/scopes", (req, res) => {
  res.json({ data: store.ALL_SCOPES });
});

module.exports = { router, auth };
