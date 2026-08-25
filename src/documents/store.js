"use strict";

// US-04 — Document jobs store — 2 backend qua env DOCUMENTS_BACKEND
// (mặc định theo ENDPOINTS_BACKEND):
//   - file    : JSON trên disk (data/documents/<jobId>/meta.json)
//   - postgres: bảng document_job (migration 012)
// File upload LUÔN lưu trên disk tại data/documents/<jobId>/<filename>
// (processor cần đọc file để trích xuất, không phụ thuộc backend metadata).
// Giữ signatures đồng nhất: file sync, postgres async — callers luôn `await`.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const cfg = require("./config");

const BACKEND = (process.env.DOCUMENTS_BACKEND || process.env.ENDPOINTS_BACKEND || "file").toLowerCase();

// ─────────────── PATH HELPERS ───────────────
function jobDir(jobId) {
  return path.join(cfg.storage.root, jobId);
}
function metaPath(jobId) {
  return path.join(jobDir(jobId), "meta.json");
}
function ensureJobDir(jobId) {
  fs.mkdirSync(jobDir(jobId), { recursive: true });
}
function safeJobId() {
  return "doc-" + crypto.randomBytes(4).toString("hex");
}

// ─────────────── FILE STORAGE (shared, always on disk) ───────────────
// Lưu file upload vào jobDir (tương tự byom jobDir). basename chống path traversal.
function saveFile(jobId, filename, buffer) {
  ensureJobDir(jobId);
  const safe = path.basename(filename);
  fs.writeFileSync(path.join(jobDir(jobId), safe), buffer);
  return safe;
}
function readFile(jobId, filename) {
  const safe = path.basename(filename);
  const p = path.join(jobDir(jobId), safe);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p);
}

// ─────────────── FILE BACKEND (mặc định) ───────────────
function writeMeta(jobId, meta) {
  ensureJobDir(jobId);
  fs.writeFileSync(metaPath(jobId), JSON.stringify(meta, null, 2));
}
function readMeta(jobId) {
  const p = metaPath(jobId);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
function listAllMeta() {
  if (!fs.existsSync(cfg.storage.root)) return [];
  return fs.readdirSync(cfg.storage.root)
    .filter((d) => d.startsWith("doc-"))
    .map((id) => {
      const m = readMeta(id);
      return m ? { id, ...m } : null;
    })
    .filter(Boolean)
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

const fileBackend = {
  create({ endpoint_id, segment, doc_type, filename, file_size }) {
    const id = safeJobId();
    const now = new Date().toISOString();
    const meta = {
      id,
      endpointId: endpoint_id || null,
      segment: segment || "insurance",
      docType: doc_type || "contract",
      filename,
      fileSize: file_size != null ? parseInt(file_size, 10) : null,
      status: "queued",
      fields: null,
      confidence: null,
      redacted: false,
      error: null,
      createdAt: now,
      updatedAt: now,
    };
    writeMeta(id, meta);
    return meta;
  },
  getById(id) {
    const m = readMeta(id);
    return m ? { id, ...m } : null;
  },
  list({ segment, status, limit } = {}) {
    let items = listAllMeta();
    if (segment) items = items.filter((j) => j.segment === segment);
    if (status) items = items.filter((j) => j.status === status);
    const lim = limit ? parseInt(limit, 10) : 100;
    return items.slice(0, lim);
  },
  update(id, patch) {
    const cur = readMeta(id);
    if (!cur) return null;
    const next = { ...cur, ...patch, id, updatedAt: new Date().toISOString() };
    writeMeta(id, next);
    return { id, ...next };
  },
};

// ─────────────── POSTGRES BACKEND ───────────────
const pgBackend = (() => {
  let _db = null;
  function db() { if (!_db) _db = require("../db/pool"); return _db; }
  function rowToJob(r) {
    return {
      id: r.id,
      endpointId: r.endpoint_id || null,
      segment: r.segment,
      docType: r.doc_type,
      filename: r.filename,
      fileSize: r.file_size != null ? Number(r.file_size) : null,
      status: r.status,
      fields: r.fields || null,
      confidence: r.confidence != null ? Number(r.confidence) : null,
      redacted: !!r.redacted,
      error: r.error || null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
  return {
    async create({ endpoint_id, segment, doc_type, filename, file_size }) {
      const id = safeJobId();
      const now = new Date().toISOString();
      await db().query(
        `INSERT INTO document_job (id, endpoint_id, segment, doc_type, filename, file_size, status, redacted, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,'queued',FALSE,$7,$7)`,
        [id, endpoint_id || null, segment || "insurance", doc_type || "contract", filename,
         file_size != null ? parseInt(file_size, 10) : null, now]
      );
      return {
        id,
        endpointId: endpoint_id || null,
        segment: segment || "insurance",
        docType: doc_type || "contract",
        filename,
        fileSize: file_size != null ? parseInt(file_size, 10) : null,
        status: "queued",
        fields: null,
        confidence: null,
        redacted: false,
        error: null,
        createdAt: now,
        updatedAt: now,
      };
    },
    async getById(id) {
      const { rows } = await db().query(`SELECT * FROM document_job WHERE id=$1`, [id]);
      return rows[0] ? rowToJob(rows[0]) : null;
    },
    async list({ segment, status, limit } = {}) {
      const cond = [], args = [];
      if (segment) { cond.push(`segment=$${args.length + 1}`); args.push(segment); }
      if (status) { cond.push(`status=$${args.length + 1}`); args.push(status); }
      let sql = `SELECT * FROM document_job`;
      if (cond.length) sql += ` WHERE ` + cond.join(" AND ");
      sql += ` ORDER BY created_at DESC`;
      const lim = Math.min(parseInt(limit, 10) || 100, 500);
      sql += ` LIMIT ${lim}`;
      const { rows } = await db().query(sql, args);
      return rows.map(rowToJob);
    },
    async update(id, patch) {
      const sets = [], args = [id];
      const colMap = {
        endpointId: "endpoint_id", segment: "segment", docType: "doc_type",
        filename: "filename", fileSize: "file_size", status: "status",
        fields: "fields", confidence: "confidence", redacted: "redacted", error: "error",
      };
      for (const [k, col] of Object.entries(colMap)) {
        if (patch[k] !== undefined) {
          args.push(k === "fields" ? JSON.stringify(patch[k]) : patch[k]);
          sets.push(`${col}=$${args.length}`);
        }
      }
      if (!sets.length) return pgBackend.getById(id);
      args.push(new Date().toISOString());
      sets.push(`updated_at=$${args.length}`);
      const { rows } = await db().query(
        `UPDATE document_job SET ${sets.join(", ")} WHERE id=$1 RETURNING *`, args
      );
      return rows[0] ? rowToJob(rows[0]) : null;
    },
  };
})();

// ─────────────── DISPATCH ───────────────
function pick(name) {
  return BACKEND === "postgres" ? pgBackend[name] : fileBackend[name];
}

module.exports = {
  backend: BACKEND,
  jobDir, metaPath, ensureJobDir, safeJobId,
  saveFile, readFile,
  create: (...a) => pick("create")(...a),
  getById: (...a) => pick("getById")(...a),
  list: (...a) => pick("list")(...a),
  update: (...a) => pick("update")(...a),
};