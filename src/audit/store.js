"use strict";

// US-05 — Audit trail bất biến (append-only).
// Ghi vào bảng audit_log (Postgres). Không có UPDATE/DELETE — chỉ INSERT.
// Module dùng db pool trực tiếp (không phụ thuộc backend file/postgres của keys/endpoints).

const crypto = require("crypto");
const db = require("../db/pool");

function genId() {
  return "aud-" + crypto.randomBytes(8).toString("hex");
}

// record(entry) — append-only insert. entry: { actor, role, action, entityId, entityType, result, ip, meta }
async function record(entry = {}) {
  const {
    actor, role, action, entityId, entityType, result, ip, meta,
  } = entry;
  try {
    await db.query(
      `INSERT INTO audit_log (id, actor, role, action, entity_id, entity_type, result, ip, meta)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        genId(),
        actor || "unknown",
        role || null,
        action || "unknown",
        entityId || null,
        entityType || null,
        result || "success",
        ip || null,
        meta !== undefined ? JSON.stringify(meta) : null,
      ]
    );
  } catch (e) {
    console.error("[audit] ghi lỗi:", e.message);
  }
}

// list({ from, to, actor, action, limit, offset }) — query có lọc
async function list({ from, to, actor, action, limit, offset } = {}) {
  const cond = [];
  const args = [];
  if (from) { cond.push(`ts >= $${args.length + 1}`); args.push(from); }
  if (to) { cond.push(`ts <= $${args.length + 1}`); args.push(to); }
  if (actor) { cond.push(`actor = $${args.length + 1}`); args.push(actor); }
  if (action) { cond.push(`action = $${args.length + 1}`); args.push(action); }
  let sql = `SELECT * FROM audit_log`;
  if (cond.length) sql += ` WHERE ` + cond.join(" AND ");
  const lim = Math.min(parseInt(limit, 10) || 100, 500);
  const off = parseInt(offset, 10) || 0;
  sql += ` ORDER BY ts DESC LIMIT ${lim} OFFSET ${off}`;
  const { rows } = await db.query(sql, args);
  return rows.map((r) => ({
    id: r.id, ts: r.ts, actor: r.actor, role: r.role, action: r.action,
    entityId: r.entity_id, entityType: r.entity_type, result: r.result,
    ip: r.ip, meta: r.meta,
  }));
}

module.exports = { record, list };