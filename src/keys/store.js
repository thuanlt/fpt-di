"use strict";

// API keys store — hỗ trợ 2 backend qua env KEYS_BACKEND:
//   - file    (mặc định): JSON trên disk (hành vi cũ, dùng cho preview/dev)
//   - postgres: bảng api_keys + key_usage_audit (Gap 1, dùng cho prod scale ngang)
// Giữ nguyên signatures của tất cả hàm exported để callers (keys/routes.js, server.js auth)
// không phải đổi.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const BACKEND = (process.env.KEYS_BACKEND || "file").toLowerCase();
const ALL_SCOPES = ["chat", "endpoints", "batch", "byom", "fine-tune", "clusters", "playground", "billing", "admin"];
// US-10 — phân quyền theo vai trò
const ALL_ROLES = ["admin", "operator", "viewer"];
const DEFAULT_ROLE = "viewer";
const KEY_PREFIX = "ddi-live-";

function normalizeRole(role) {
  const r = (role === undefined || role === null || role === "") ? DEFAULT_ROLE : String(role);
  if (!ALL_ROLES.includes(r)) throw new Error(`role phải thuộc ${ALL_ROLES.join(", ")}`);
  return r;
}

// ─── helpers chung ───
function genKey() {
  const rand = crypto.randomBytes(20).toString("hex");
  return KEY_PREFIX + rand;
}
function hashKey(key) {
  return crypto.createHash("sha256").update(key).digest("hex");
}
function prefix(key) {
  return key.slice(0, 13) + "•••";
}

// ───────────────────────── FILE BACKEND (mặc định) ─────────────────────────
const FILE_DATA_DIR = process.env.KEYS_STORAGE_DIR || path.join(__dirname, "data");
const FILE_DATA_FILE = path.join(FILE_DATA_DIR, "keys.json");
const FILE_USAGE_FILE = path.join(FILE_DATA_DIR, "keys-usage.json");

function fileEnsure() {
  if (!fs.existsSync(FILE_DATA_DIR)) fs.mkdirSync(FILE_DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE_DATA_FILE)) fs.writeFileSync(FILE_DATA_FILE, JSON.stringify([], null, 2), "utf8");
  if (!fs.existsSync(FILE_USAGE_FILE)) fs.writeFileSync(FILE_USAGE_FILE, JSON.stringify({}, null, 2), "utf8");
}
function fileReadAll() { fileEnsure(); return JSON.parse(fs.readFileSync(FILE_DATA_FILE, "utf8")); }
function fileWriteAll(items) {
  fileEnsure();
  const tmp = FILE_DATA_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(items, null, 2), "utf8");
  fs.renameSync(tmp, FILE_DATA_FILE);
}
function fileReadUsage() { fileEnsure(); return JSON.parse(fs.readFileSync(FILE_USAGE_FILE, "utf8")); }
function fileWriteUsage(obj) {
  fileEnsure();
  const tmp = FILE_USAGE_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), "utf8");
  fs.renameSync(tmp, FILE_USAGE_FILE);
}

const fileBackend = {
  list() {
    return fileReadAll().map((k) => ({
      id: k.id, name: k.name, keyPrefix: k.keyPrefix, scopes: k.scopes,
      status: k.status, createdAt: k.createdAt, lastUsedAt: k.lastUsedAt || null, usage: k.usage || 0,
      role: k.role || DEFAULT_ROLE, roleUpdatedAt: k.roleUpdatedAt || null,
    }));
  },
  listWithUsage() {
    const all = fileReadAll();
    const usage = fileReadUsage();
    return all.map((k) => ({
      id: k.id, name: k.name, keyPrefix: k.keyPrefix, scopes: k.scopes,
      status: k.status, createdAt: k.createdAt, lastUsedAt: k.lastUsedAt || null,
      usage: usage[k.id] || 0,
      role: k.role || DEFAULT_ROLE, roleUpdatedAt: k.roleUpdatedAt || null,
    }));
  },
  create({ name, scopes, role }) {
    if (!name || typeof name !== "string" || name.trim().length === 0) throw new Error("name bắt buộc");
    if (!Array.isArray(scopes) || scopes.length === 0) throw new Error("scopes bắt buộc, ít nhất 1");
    const invalid = scopes.filter((s) => !ALL_SCOPES.includes(s));
    if (invalid.length) throw new Error(`scope không hợp lệ: ${invalid.join(", ")}`);
    const normRole = normalizeRole(role);
    const items = fileReadAll();
    if (items.some((k) => k.name === name && k.status === "active")) {
      throw new Error(`key tên "${name}" đã tồn tại và đang active`);
    }
    const fullKey = genKey();
    const id = "key-" + crypto.randomBytes(4).toString("hex");
    const now = new Date().toISOString();
    const record = {
      id, name: name.trim(), keyHash: hashKey(fullKey), keyPrefix: prefix(fullKey),
      scopes, status: "active", createdAt: now, lastUsedAt: null,
      role: normRole, roleUpdatedAt: now,
    };
    items.push(record);
    fileWriteAll(items);
    return { id, fullKey, record };
  },
  updateRole(id, role) {
    const normRole = normalizeRole(role);
    const items = fileReadAll();
    const idx = items.findIndex((k) => k.id === id);
    if (idx === -1) return null;
    if (items[idx].status !== "active") throw new Error("key đã bị revoke, không thể update");
    items[idx].role = normRole;
    items[idx].roleUpdatedAt = new Date().toISOString();
    fileWriteAll(items);
    return items[idx];
  },
  getById(id) { return fileReadAll().find((k) => k.id === id) || null; },
  verify(key) {
    if (!key || typeof key !== "string") return null;
    const items = fileReadAll();
    const h = hashKey(key);
    const found = items.find((k) => k.keyHash === h && k.status === "active");
    return found || null;
  },
  recordUsage(id) {
    const usage = fileReadUsage();
    usage[id] = (usage[id] || 0) + 1;
    fileWriteUsage(usage);
    const items = fileReadAll();
    const idx = items.findIndex((k) => k.id === id);
    if (idx >= 0) { items[idx].lastUsedAt = new Date().toISOString(); fileWriteAll(items); }
  },
  revoke(id) {
    const items = fileReadAll();
    const idx = items.findIndex((k) => k.id === id);
    if (idx === -1) return null;
    if (items[idx].status === "revoked") return items[idx];
    items[idx].status = "revoked";
    items[idx].revokedAt = new Date().toISOString();
    fileWriteAll(items);
    return items[idx];
  },
  rotate(id) {
    const items = fileReadAll();
    const idx = items.findIndex((k) => k.id === id);
    if (idx === -1) return null;
    if (items[idx].status !== "active") throw new Error("key đã bị revoke, không thể rotate");
    const fullKey = genKey();
    items[idx].keyHash = hashKey(fullKey);
    items[idx].keyPrefix = prefix(fullKey);
    items[idx].rotatedAt = new Date().toISOString();
    fileWriteAll(items);
    return { id, fullKey, record: items[idx] };
  },
  updateScopes(id, scopes) {
    if (!Array.isArray(scopes) || scopes.length === 0) throw new Error("scopes bắt buộc, ít nhất 1");
    const invalid = scopes.filter((s) => !ALL_SCOPES.includes(s));
    if (invalid.length) throw new Error(`scope không hợp lệ: ${invalid.join(", ")}`);
    const items = fileReadAll();
    const idx = items.findIndex((k) => k.id === id);
    if (idx === -1) return null;
    if (items[idx].status !== "active") throw new Error("key đã bị revoke, không thể update");
    items[idx].scopes = scopes;
    items[idx].scopesUpdatedAt = new Date().toISOString();
    fileWriteAll(items);
    return items[idx];
  },
  remove(id) {
    const items = fileReadAll();
    const idx = items.findIndex((k) => k.id === id);
    if (idx === -1) return false;
    items.splice(idx, 1);
    fileWriteAll(items);
    const usage = fileReadUsage();
    delete usage[id];
    fileWriteUsage(usage);
    return true;
  },
  hasScope(keyRecord, scope) {
    return Array.isArray(keyRecord.scopes) && keyRecord.scopes.includes(scope);
  },
  readUsage() { return fileReadUsage(); },
};

// ───────────────────────── POSTGRES BACKEND (Gap 1) ─────────────────────────
const pgBackend = (() => {
  let _db = null;
  function db() {
    if (!_db) _db = require("../db/pool");
    return _db;
  }
  async function audit(keyId, action, actor, meta) {
    try {
      await db().query(
        `INSERT INTO key_usage_audit (key_id, action, actor, meta) VALUES ($1,$2,$3,$4)`,
        [keyId, action, actor || null, meta ? JSON.stringify(meta) : null]
      );
    } catch (e) { console.error("[keys:pg] audit lỗi:", e.message); }
  }
  // chuẩn hoá row sang record shape giống file backend
  function rowToRecord(r) {
    return {
      id: r.id, name: r.name, keyHash: r.key_hash, keyPrefix: r.key_prefix,
      scopes: r.scopes, status: r.status, createdAt: r.created_at,
      lastUsedAt: r.last_used_at, revokedAt: r.revoked_at, rotatedAt: r.rotated_at,
      scopesUpdatedAt: r.scopes_updated_at,
      role: r.role || DEFAULT_ROLE, roleUpdatedAt: r.role_updated_at || null,
    };
  }
  return {
    async list() {
      const { rows } = await db().query(`SELECT * FROM api_keys ORDER BY created_at DESC`);
      // usage = count verify trong audit (số lần dùng)
      const out = [];
      for (const r of rows) {
        const u = await db().query(`SELECT count(*)::int AS c FROM key_usage_audit WHERE key_id=$1 AND action='verify'`, [r.id]);
        out.push({
          id: r.id, name: r.name, keyPrefix: r.key_prefix, scopes: r.scopes,
          status: r.status, createdAt: r.created_at, lastUsedAt: r.last_used_at, usage: u.rows[0].c,
          role: r.role || DEFAULT_ROLE, roleUpdatedAt: r.role_updated_at || null,
        });
      }
      return out;
    },
    async listWithUsage() { return pgBackend.list(); },
    async create({ name, scopes, role }) {
      if (!name || typeof name !== "string" || name.trim().length === 0) throw new Error("name bắt buộc");
      if (!Array.isArray(scopes) || scopes.length === 0) throw new Error("scopes bắt buộc, ít nhất 1");
      const invalid = scopes.filter((s) => !ALL_SCOPES.includes(s));
      if (invalid.length) throw new Error(`scope không hợp lệ: ${invalid.join(", ")}`);
      const normRole = normalizeRole(role);
      const fullKey = genKey();
      const id = "key-" + crypto.randomBytes(4).toString("hex");
      const now = new Date().toISOString();
      const record = {
        id, name: name.trim(), keyHash: hashKey(fullKey), keyPrefix: prefix(fullKey),
        scopes, status: "active", createdAt: now, lastUsedAt: null,
        role: normRole, roleUpdatedAt: now,
      };
      try {
        await db().query(
          `INSERT INTO api_keys (id, name, key_hash, key_prefix, scopes, status, role, created_at)
           VALUES ($1,$2,$3,$4,$5,'active',$6,$7)`,
          [id, record.name, record.keyHash, record.keyPrefix, scopes, normRole, now]
        );
        await audit(id, "create", null, { name: record.name, scopes, role: normRole });
      } catch (e) {
        if (e.code === "23505") throw new Error(`key tên "${name}" đã tồn tại và đang active`);
        throw e;
      }
      return { id, fullKey, record };
    },
    async updateRole(id, role) {
      const normRole = normalizeRole(role);
      const cur = await pgBackend.getById(id);
      if (!cur) return null;
      if (cur.status !== "active") throw new Error("key đã bị revoke, không thể update");
      const now = new Date().toISOString();
      await db().query(
        `UPDATE api_keys SET role=$2, role_updated_at=$3, updated_at=$3 WHERE id=$1`,
        [id, normRole, now]
      );
      await audit(id, "role_update", null, { role: normRole });
      return { ...cur, role: normRole, roleUpdatedAt: now };
    },
    async getById(id) {
      const { rows } = await db().query(`SELECT * FROM api_keys WHERE id=$1`, [id]);
      return rows[0] ? rowToRecord(rows[0]) : null;
    },
    async verify(key) {
      if (!key || typeof key !== "string") return null;
      const h = hashKey(key);
      const { rows } = await db().query(
        `SELECT * FROM api_keys WHERE key_hash=$1 AND status='active'`, [h]
      );
      return rows[0] ? rowToRecord(rows[0]) : null;
    },
    async recordUsage(id) {
      const now = new Date().toISOString();
      await db().query(`UPDATE api_keys SET last_used_at=$2 WHERE id=$1`, [id, now]);
      await audit(id, "verify", null, null);
    },
    async revoke(id) {
      const cur = await pgBackend.getById(id);
      if (!cur) return null;
      if (cur.status === "revoked") return cur;
      const now = new Date().toISOString();
      await db().query(`UPDATE api_keys SET status='revoked', revoked_at=$2, updated_at=$2 WHERE id=$1`, [id, now]);
      await audit(id, "revoke", null, null);
      return { ...cur, status: "revoked", revokedAt: now };
    },
    async rotate(id) {
      const cur = await pgBackend.getById(id);
      if (!cur) return null;
      if (cur.status !== "active") throw new Error("key đã bị revoke, không thể rotate");
      const fullKey = genKey();
      const now = new Date().toISOString();
      await db().query(
        `UPDATE api_keys SET key_hash=$2, key_prefix=$3, rotated_at=$4, updated_at=$4 WHERE id=$1`,
        [id, hashKey(fullKey), prefix(fullKey), now]
      );
      await audit(id, "rotate", null, null);
      const record = { ...cur, keyHash: hashKey(fullKey), keyPrefix: prefix(fullKey), rotatedAt: now };
      return { id, fullKey, record };
    },
    async updateScopes(id, scopes) {
      if (!Array.isArray(scopes) || scopes.length === 0) throw new Error("scopes bắt buộc, ít nhất 1");
      const invalid = scopes.filter((s) => !ALL_SCOPES.includes(s));
      if (invalid.length) throw new Error(`scope không hợp lệ: ${invalid.join(", ")}`);
      const cur = await pgBackend.getById(id);
      if (!cur) return null;
      if (cur.status !== "active") throw new Error("key đã bị revoke, không thể update");
      const now = new Date().toISOString();
      await db().query(
        `UPDATE api_keys SET scopes=$2, scopes_updated_at=$3, updated_at=$3 WHERE id=$1`,
        [id, scopes, now]
      );
      await audit(id, "scope_update", null, { scopes });
      return { ...cur, scopes, scopesUpdatedAt: now };
    },
    async remove(id) {
      const { rowCount } = await db().query(`DELETE FROM api_keys WHERE id=$1`, [id]);
      if (rowCount > 0) await audit(id, "delete", null, null);
      return rowCount > 0;
    },
    hasScope(keyRecord, scope) {
      return Array.isArray(keyRecord.scopes) && keyRecord.scopes.includes(scope);
    },
    async readUsage() {
      const { rows } = await db().query(
        `SELECT key_id, count(*)::int AS c FROM key_usage_audit WHERE action='verify' GROUP BY key_id`
      );
      return rows.reduce((acc, r) => { acc[r.key_id] = r.c; return acc; }, {});
    },
  };
})();

// ───────────────────────── DISPATCH ─────────────────────────
// pg backend là async — bọcProm promises cho callers gọi theo kiểu sync (file) nếu cần.
// Để giữ contract với keys/routes.js (đang gọi tạo = const { id, fullKey, record } = store.create(...)),
// pg backend KHÔNG thả promise về routes — routes phải await. Vì vậy caller keys/routes.js
// cũng cần await. Giải pháp: chuyển routes dùng await (đã là async) + bọc cả file backend return
// thành promise đồng nhất.
// → Triển khai: mọi hàm exported luôn return promise khi BACKEND=postgres, value khi file.
// Callers routes.js thêm await (xem patch routes.js kèm theo).

function pick(name) {
  return BACKEND === "postgres" ? pgBackend[name] : fileBackend[name];
}

module.exports = {
  ALL_SCOPES,
  ALL_ROLES,
  DEFAULT_ROLE,
  backend: BACKEND,
  list: (...a) => pick("list")(...a),
  listWithUsage: (...a) => pick("listWithUsage")(...a),
  create: (...a) => pick("create")(...a),
  getById: (...a) => pick("getById")(...a),
  verify: (...a) => pick("verify")(...a),
  recordUsage: (...a) => pick("recordUsage")(...a),
  revoke: (...a) => pick("revoke")(...a),
  rotate: (...a) => pick("rotate")(...a),
  updateScopes: (...a) => pick("updateScopes")(...a),
  updateRole: (...a) => pick("updateRole")(...a),
  remove: (...a) => pick("remove")(...a),
  hasScope: (r, s) => pick("hasScope")(r, s),
  readUsage: (...a) => pick("readUsage")(...a),
};
