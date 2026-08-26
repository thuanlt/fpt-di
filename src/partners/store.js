"use strict";

// Partner onboarding — store 2 backend qua env PARTNERS_BACKEND
// (mặc định theo ENDPOINTS_BACKEND):
//   - file    : JSON trên disk (data/partners.json) — dev/preview không có PG
//   - postgres: bảng partners (migration 014)
// Giữ signatures đồng nhất: file sync, postgres async — callers luôn `await`.
// Export { list, create, getById } (task FR-ONB-017/018/021).

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const BACKEND = (process.env.PARTNERS_BACKEND || process.env.ENDPOINTS_BACKEND || "file").toLowerCase();
const ALL_STATUSES = ["pending", "trialing", "active", "on hold"];
const DEFAULT_STATUS = "pending";

// Seed 7 partner mock (DATA.partners trong app.js) — dùng cho file backend lần đầu.
const SEED_PARTNERS = [
  { name: "FPT.AI", models: 14, top: "FPT-LLM 8B (vi)", share: 22, integration: "Native", status: "active", contact: "ai-partners@fpt.com", since: "2024-03", note: "Flagship Vietnamese LLM family. Tightest latency integration in catalog." },
  { name: "Qwen (Alibaba)", models: 9, top: "Qwen3-235B-A22B", share: 18, integration: "vLLM + OpenAI API", status: "active", contact: "partners@qwen.org", since: "2024-07", note: "Highest-volume open-weights family. Batch discount program applies." },
  { name: "Meta Llama", models: 6, top: "Llama-3.3-70B", share: 15, integration: "Triton + vLLM", status: "active", contact: "llama-ops@meta.com", since: "2024-05", note: "Community license verified for all deployment sizes." },
  { name: "DeepSeek", models: 4, top: "DeepSeek-R1", share: 11, integration: "SGLang", status: "active", contact: "bd@deepseek.com", since: "2025-02", note: "Reasoning workloads. Long-context KV cache tuning in progress." },
  { name: "Mistral AI", models: 5, top: "Mistral-Large-2", share: 8, integration: "vLLM", status: "trialing", contact: "partnerships@mistral.ai", since: "2026-06", note: "Trial for EU-headquartered customers in Vietnam." },
  { name: "Cohere", models: 3, top: "Command-R+", share: 5, integration: "Pending", status: "on hold", contact: "apac@cohere.com", since: "2026-07", note: "On hold pending enterprise compliance pack (SOC2 scope review)." },
  { name: "Zhipu GLM", models: 4, top: "GLM-4.6", share: 6, integration: "vLLM", status: "active", contact: "bd@zhipuai.ai", since: "2025-09", note: "Strong coding + agent benchmarks. Growing in dev-tool segment." },
  { name: "VinAI", models: 3, top: "PhoGPT-4B", share: 4, integration: "Native", status: "active", contact: "api@vinai.io", since: "2024-11", note: "Vietnamese specialist models for on-prem edge deployments." },
];

// YYYY-MM hiện tại (UTC) — dùng cho `since` của partner mới (FR-ONB-021)
function currentYM() {
  const d = new Date();
  return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0");
}

// Chuẩn hoá record → shape trả về cho API (đồng nhất 2 backend)
function toShape(p) {
  return {
    id: p.id,
    name: p.name,
    contact: p.contact,
    top: p.top || "",
    integration: p.integration || "",
    status: p.status || DEFAULT_STATUS,
    note: p.note || "",
    since: p.since,
    models: p.models != null ? Number(p.models) : 0,
    share: p.share != null ? Number(p.share) : 0,
    createdAt: p.createdAt,
  };
}

// ─────────────── FILE BACKEND (mặc định) ───────────────
const FILE_DATA_DIR = process.env.PARTNERS_STORAGE_DIR || path.join(__dirname, "data");
const FILE_DATA_FILE = path.join(FILE_DATA_DIR, "partners.json");

function fileEnsure() {
  if (!fs.existsSync(FILE_DATA_DIR)) fs.mkdirSync(FILE_DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE_DATA_FILE)) {
    const now = new Date().toISOString();
    const seeded = SEED_PARTNERS.map((p) => ({
      id: crypto.randomUUID(),
      name: p.name, contact: p.contact, top: p.top, integration: p.integration,
      status: p.status, note: p.note, since: p.since, models: p.models, share: p.share,
      createdAt: now,
    }));
    fs.writeFileSync(FILE_DATA_FILE, JSON.stringify(seeded, null, 2), "utf8");
  }
}
function fileReadAll() { fileEnsure(); return JSON.parse(fs.readFileSync(FILE_DATA_FILE, "utf8")); }
function fileWriteAll(items) {
  fileEnsure();
  const tmp = FILE_DATA_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(items, null, 2), "utf8");
  fs.renameSync(tmp, FILE_DATA_FILE);
}

const fileBackend = {
  list() {
    return fileReadAll()
      .slice()
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "") || a.name.localeCompare(b.name))
      .map(toShape);
  },
  getById(id) {
    const p = fileReadAll().find((x) => x.id === id);
    return p ? toShape(p) : null;
  },
  create({ name, contact, top, integration, status, note }) {
    if (!name || typeof name !== "string" || name.trim().length === 0) throw new Error("name bắt buộc");
    if (!contact || typeof contact !== "string" || contact.trim().length === 0) throw new Error("contact bắt buộc");
    const normStatus = status || DEFAULT_STATUS;
    if (!ALL_STATUSES.includes(normStatus)) throw new Error(`status phải thuộc ${ALL_STATUSES.join(", ")}`);
    const items = fileReadAll();
    if (items.some((p) => p.name === name)) throw new Error("Partner đã tồn tại");
    const record = {
      id: crypto.randomUUID(),
      name, contact, top: top || "", integration: integration || "",
      status: normStatus, note: note || "",
      since: currentYM(), models: 0, share: 0,
      createdAt: new Date().toISOString(),
    };
    items.push(record);
    fileWriteAll(items);
    return toShape(record);
  },
};

// ─────────────── POSTGRES BACKEND ───────────────
const pgBackend = (() => {
  let _db = null;
  function db() { if (!_db) _db = require("../db/pool"); return _db; }
  // Phòng thủ: đảm bảo bảng tồn tại (kèm schema đúng) kể cả khi migration chưa chạy.
  async function ensureTable() {
    await db().query(`
      CREATE TABLE IF NOT EXISTS partners (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        TEXT NOT NULL UNIQUE,
        contact     TEXT NOT NULL,
        top         TEXT NOT NULL DEFAULT '',
        integration TEXT NOT NULL DEFAULT '',
        status      TEXT NOT NULL DEFAULT 'pending',
        note        TEXT NOT NULL DEFAULT '',
        since       TEXT NOT NULL,
        models      INTEGER NOT NULL DEFAULT 0,
        share       INTEGER NOT NULL DEFAULT 0,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
  }
  function rowToPartner(r) {
    return {
      id: r.id, name: r.name, contact: r.contact, top: r.top || "",
      integration: r.integration || "", status: r.status || DEFAULT_STATUS,
      note: r.note || "", since: r.since,
      models: r.models != null ? Number(r.models) : 0,
      share: r.share != null ? Number(r.share) : 0,
      createdAt: r.created_at,
    };
  }
  return {
    async list() {
      await ensureTable();
      const { rows } = await db().query(`SELECT * FROM partners ORDER BY created_at DESC, name ASC`);
      return rows.map(rowToPartner);
    },
    async getById(id) {
      await ensureTable();
      const { rows } = await db().query(`SELECT * FROM partners WHERE id=$1`, [id]);
      return rows[0] ? rowToPartner(rows[0]) : null;
    },
    async create({ name, contact, top, integration, status, note }) {
      if (!name || typeof name !== "string" || name.trim().length === 0) throw new Error("name bắt buộc");
      if (!contact || typeof contact !== "string" || contact.trim().length === 0) throw new Error("contact bắt buộc");
      const normStatus = status || DEFAULT_STATUS;
      if (!ALL_STATUSES.includes(normStatus)) throw new Error(`status phải thuộc ${ALL_STATUSES.join(", ")}`);
      await ensureTable();
      const now = new Date().toISOString();
      try {
        const { rows } = await db().query(
          `INSERT INTO partners (name, contact, top, integration, status, note, since, models, share, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,0,0,$8)
           RETURNING *`,
          [name, contact, top || "", integration || "", normStatus, note || "", currentYM(), now]
        );
        return rowToPartner(rows[0]);
      } catch (e) {
        if (e.code === "23505") throw new Error("Partner đã tồn tại"); // unique violation
        throw e;
      }
    },
  };
})();

// ─────────────── DISPATCH ───────────────
function pick(name) {
  return BACKEND === "postgres" ? pgBackend[name] : fileBackend[name];
}

module.exports = {
  backend: BACKEND,
  ALL_STATUSES,
  DEFAULT_STATUS,
  list: (...a) => pick("list")(...a),
  getById: (...a) => pick("getById")(...a),
  create: (...a) => pick("create")(...a),
};