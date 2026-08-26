"use strict";

// Partner onboarding — REST API.
//   GET  /v1/partners  (scope endpoints) — danh sách partner
//   POST /v1/partners  (scope endpoints + role operator/admin) — tạo partner
// Auth gate (scope) ở server.js (pathScope → 'endpoints'); role POST enforce ở
// roleRequirement (server.js). Router này chỉ validate + gọi store + audit.

const express = require("express");
const store = require("./store");
const audit = require("../audit/store");

const router = express.Router();

function actorOf(req) { return (req.apiKey && req.apiKey.name) || "unknown"; }
function roleOf(req) { return (req.apiKey && req.apiKey.role) || "viewer"; }
function ipOf(req) { return req.ip || req.headers["x-forwarded-for"] || null; }

// Email cơ bản (FR-ONB-004) — đủ chặt cho onboarding, không over-validate.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Validate body POST /partners → trả về { value, details }.
// details = [{ field, message }] — rỗng nếu hợp lệ (FR-ONB-015).
function validateBody(body) {
  const b = body || {};
  const details = [];
  const value = {};

  // name — required, non-empty (trim), max 100 (FR-ONB-003)
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) details.push({ field: "name", message: "name bắt buộc" });
  else if (name.length > 100) details.push({ field: "name", message: "name tối đa 100 ký tự" });
  value.name = name;

  // contact — required, email hợp lệ, max 100 (FR-ONB-004)
  const contact = typeof b.contact === "string" ? b.contact.trim() : "";
  if (!contact) details.push({ field: "contact", message: "contact bắt buộc" });
  else if (!EMAIL_RE.test(contact)) details.push({ field: "contact", message: "contact phải là email hợp lệ" });
  else if (contact.length > 100) details.push({ field: "contact", message: "contact tối đa 100 ký tự" });
  value.contact = contact;

  // top — optional, max 100 (FR-ONB-005)
  const top = typeof b.top === "string" ? b.top.trim() : "";
  if (top.length > 100) details.push({ field: "top", message: "top tối đa 100 ký tự" });
  value.top = top;

  // integration — optional, max 100 (FR-ONB-006)
  const integration = typeof b.integration === "string" ? b.integration.trim() : "";
  if (integration.length > 100) details.push({ field: "integration", message: "integration tối đa 100 ký tự" });
  value.integration = integration;

  // status — optional, enum, default pending (FR-ONB-007)
  const status = typeof b.status === "string" && b.status.trim() !== "" ? b.status.trim() : store.DEFAULT_STATUS;
  if (!store.ALL_STATUSES.includes(status)) {
    details.push({ field: "status", message: `status phải thuộc ${store.ALL_STATUSES.join(", ")}` });
  }
  value.status = status;

  // note — optional, max 500 (FR-ONB-008)
  const note = typeof b.note === "string" ? b.note.trim() : "";
  if (note.length > 500) details.push({ field: "note", message: "note tối đa 500 ký tự" });
  value.note = note;

  return { value, details };
}

// GET /partners — danh sách (mọi role, cần scope endpoints)
router.get("/partners", async (req, res) => {
  try {
    const data = await store.list();
    res.json({ count: data.length, data });
  } catch (e) {
    console.error("[partners] GET /partners error", e);
    res.status(500).json({ error: "Lỗi máy chủ", details: [e.message] });
  }
});

// POST /partners — tạo mới (role operator/admin, cần scope endpoints)
router.post("/partners", async (req, res) => {
  const { value, details } = validateBody(req.body);
  if (details.length) {
    return res.status(400).json({ error: "validation", details });
  }
  try {
    const partner = await store.create(value);
    await audit.record({
      actor: actorOf(req), role: roleOf(req), action: "partner_create",
      entityId: partner.id, entityType: "partner", result: "success", ip: ipOf(req),
      meta: { name: partner.name, status: partner.status },
    });
    res.status(201).json(partner);
  } catch (e) {
    const dup = /đã tồn tại/.test(e.message);
    await audit.record({
      actor: actorOf(req), role: roleOf(req), action: "partner_create",
      entityType: "partner", result: "failure", ip: ipOf(req),
      meta: { name: value.name, error: e.message },
    });
    if (dup) return res.status(409).json({ error: "conflict", message: "Partner đã tồn tại" });
    console.error("[partners] POST /partners error", e);
    res.status(500).json({ error: "Lỗi máy chủ", details: [e.message] });
  }
});

module.exports = router;