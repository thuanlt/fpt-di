"use strict";

// US-06 — Gói giá theo phân khúc (price_pack).
// 2 backend qua env PRICING_BACKEND (mặc định theo ENDPOINTS_BACKEND):
//   - file    : JSON trên disk (preview/dev không cần Postgres)
//   - postgres: bảng price_pack (migration 011)
// Giữ signatures đồng nhất giữa 2 backend: file sync, postgres async —
// callers luôn `await` (await value thường vẫn an toàn).

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const BACKEND = (process.env.PRICING_BACKEND || process.env.ENDPOINTS_BACKEND || "file").toLowerCase();

// Enums validate — lấy từ endpoints store (một nguồn sự thật, tránh lệch)
const { SEGMENTS, GPU_TIERS, REGIONS, COMMITS } = require("../endpoints/store");

// ─────────────── FILE BACKEND (mặc định) ───────────────
const DATA_DIR = process.env.PRICING_STORAGE_DIR || path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "price-packs.json");

function fileEnsure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), "utf8");
}
function fileReadAll() { fileEnsure(); return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
function fileWriteAll(items) {
  fileEnsure();
  const tmp = DATA_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(items, null, 2), "utf8");
  fs.renameSync(tmp, DATA_FILE);
}

function validatePack({ segment, gpu, region, rate_per_hour, rate_per_token, commitment, discount_pct, quota_rpm, quota_tpm }) {
  const seg = segment || "general";
  if (!SEGMENTS.includes(seg)) throw new Error(`segment phải thuộc ${SEGMENTS.join(", ")}`);
  if (!GPU_TIERS.includes(gpu)) throw new Error(`gpu phải thuộc ${GPU_TIERS.join(", ")}`);
  if (!REGIONS.includes(region)) throw new Error(`region phải thuộc ${REGIONS.join(", ")}`);
  const rph = parseFloat(rate_per_hour);
  if (!(rph > 0)) throw new Error("rate_per_hour phải là số dương");
  let rpt = null;
  if (rate_per_token != null && rate_per_token !== "") {
    rpt = parseFloat(rate_per_token);
    if (!(rpt >= 0)) throw new Error("rate_per_token phải là số >= 0");
  }
  const cm = commitment || "on-demand";
  if (!COMMITS.includes(cm)) throw new Error(`commitment phải thuộc ${COMMITS.join(", ")}`);
  let disc = 0;
  if (discount_pct != null && discount_pct !== "") {
    disc = parseFloat(discount_pct);
    if (!(disc >= 0 && disc <= 100)) throw new Error("discount_pct phải trong [0,100]");
  }
  let qRpm = null, qTpm = null;
  if (quota_rpm != null && quota_rpm !== "") {
    qRpm = parseInt(quota_rpm, 10);
    if (!(qRpm > 0)) throw new Error("quota_rpm phải là số nguyên dương");
  }
  if (quota_tpm != null && quota_tpm !== "") {
    qTpm = parseInt(quota_tpm, 10);
    if (!(qTpm > 0)) throw new Error("quota_tpm phải là số nguyên dương");
  }
  return { segment: seg, gpu, region, rate_per_hour: rph, rate_per_token: rpt, commitment: cm, discount_pct: disc, quota_rpm: qRpm, quota_tpm: qTpm };
}

const fileBackend = {
  list({ segment, gpu, region } = {}) {
    let items = fileReadAll();
    if (segment) items = items.filter((p) => p.segment === segment);
    if (gpu) items = items.filter((p) => p.gpu === gpu);
    if (region) items = items.filter((p) => p.region === region);
    return items;
  },
  getById(id) { return fileReadAll().find((p) => p.id === id) || null; },
  getBySegmentGpuRegion(segment, gpu, region) {
    return fileReadAll().find((p) => p.segment === segment && p.gpu === gpu && p.region === region) || null;
  },
  create({ segment, gpu, region, rate_per_hour, rate_per_token, commitment, discount_pct, quota_rpm, quota_tpm }) {
    const v = validatePack({ segment, gpu, region, rate_per_hour, rate_per_token, commitment, discount_pct, quota_rpm, quota_tpm });
    if (fileBackend.getBySegmentGpuRegion(v.segment, v.gpu, v.region)) {
      throw new Error(`gói giá (${v.segment}, ${v.gpu}, ${v.region}) đã tồn tại`);
    }
    const pack = {
      id: "pp-" + crypto.randomBytes(4).toString("hex"),
      ...v,
      createdAt: new Date().toISOString(),
    };
    const items = fileReadAll();
    items.unshift(pack);
    fileWriteAll(items);
    return pack;
  },
};

// ─────────────── POSTGRES BACKEND ───────────────
const pgBackend = (() => {
  let _db = null;
  function db() { if (!_db) _db = require("../db/pool"); return _db; }
  function rowToPack(r) {
    return {
      id: r.id, segment: r.segment, gpu: r.gpu, region: r.region,
      ratePerHour: Number(r.rate_per_hour),
      ratePerToken: r.rate_per_token != null ? Number(r.rate_per_token) : null,
      commitment: r.commitment,
      discountPct: Number(r.discount_pct || 0),
      quotaRpm: r.quota_rpm != null ? parseInt(r.quota_rpm, 10) : null,
      quotaTpm: r.quota_tpm != null ? parseInt(r.quota_tpm, 10) : null,
      createdAt: r.created_at,
    };
  }
  // US-06 — cache in-memory cho quota check (tránh 1 DB query/request — không N+1)
  const packCache = new Map();
  let cacheClearedAt = Date.now();
  const CACHE_TTL_MS = 60000;
  function cacheGet(id) {
    if (Date.now() - cacheClearedAt > CACHE_TTL_MS) { packCache.clear(); cacheClearedAt = Date.now(); }
    return packCache.get(id) || null;
  }
  function cacheSet(id, pack) { packCache.set(id, pack); }
  function cacheClear() { packCache.clear(); cacheClearedAt = Date.now(); }

  return {
    async list({ segment, gpu, region } = {}) {
      const cond = [], args = [];
      if (segment) { cond.push(`segment=$${args.length + 1}`); args.push(segment); }
      if (gpu) { cond.push(`gpu=$${args.length + 1}`); args.push(gpu); }
      if (region) { cond.push(`region=$${args.length + 1}`); args.push(region); }
      let sql = `SELECT * FROM price_pack`;
      if (cond.length) sql += ` WHERE ` + cond.join(" AND ");
      sql += ` ORDER BY segment, gpu, region`;
      const { rows } = await db().query(sql, args);
      return rows.map(rowToPack);
    },
    async getById(id) {
      const cached = cacheGet(id);
      if (cached) return cached;
      const { rows } = await db().query(`SELECT * FROM price_pack WHERE id=$1`, [id]);
      if (!rows[0]) return null;
      const pack = rowToPack(rows[0]);
      cacheSet(id, pack);
      return pack;
    },
    async getBySegmentGpuRegion(segment, gpu, region) {
      const { rows } = await db().query(
        `SELECT * FROM price_pack WHERE segment=$1 AND gpu=$2 AND region=$3`,
        [segment, gpu, region]
      );
      if (!rows[0]) return null;
      const pack = rowToPack(rows[0]);
      cacheSet(pack.id, pack);
      return pack;
    },
    async create({ segment, gpu, region, rate_per_hour, rate_per_token, commitment, discount_pct, quota_rpm, quota_tpm }) {
      const v = validatePack({ segment, gpu, region, rate_per_hour, rate_per_token, commitment, discount_pct, quota_rpm, quota_tpm });
      const id = "pp-" + crypto.randomBytes(4).toString("hex");
      const now = new Date().toISOString();
      try {
        await db().query(
          `INSERT INTO price_pack (id, segment, gpu, region, rate_per_hour, rate_per_token, commitment, discount_pct, quota_rpm, quota_tpm, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [id, v.segment, v.gpu, v.region, v.rate_per_hour, v.rate_per_token, v.commitment, v.discount_pct, v.quota_rpm, v.quota_tpm, now]
        );
      } catch (e) {
        if (e.code === "23505") throw new Error(`gói giá (${v.segment}, ${v.gpu}, ${v.region}) đã tồn tại`);
        throw e;
      }
      cacheClear();
      return {
        id, segment: v.segment, gpu: v.gpu, region: v.region,
        ratePerHour: v.rate_per_hour, ratePerToken: v.rate_per_token,
        commitment: v.commitment, discountPct: v.discount_pct,
        quotaRpm: v.quota_rpm, quotaTpm: v.quota_tpm, createdAt: now,
      };
    },
  };
})();

// ─────────────── DISPATCH ───────────────
function pick(name) {
  return BACKEND === "postgres" ? pgBackend[name] : fileBackend[name];
}

module.exports = {
  backend: BACKEND,
  list: (...a) => pick("list")(...a),
  getById: (...a) => pick("getById")(...a),
  getBySegmentGpuRegion: (...a) => pick("getBySegmentGpuRegion")(...a),
  create: (...a) => pick("create")(...a),
};