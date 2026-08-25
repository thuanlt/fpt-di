"use strict";

// Backfill: đọc keys/endpoints cũ từ file-store (JSON) → INSERT vào Postgres (Gap 1).
// Idempotent — chạy lại không tạo duplicate (ON CONFLICT DO NOTHING).
// Sạch: KHÔNG xoá file cũ, để backup 24–48h (rollback).
//
// Cách chạy:
//   node db/scripts/migrate-keys-endpoints.js --apply
//   node db/scripts/migrate-keys-endpoints.js --apply --target=prod
//   node db/scripts/migrate-keys-endpoints.js --dry-run       # không ghi, chỉ in
//
// Env: PG_HOST/PG_PORT/PG_DB/PG_USER/PG_PASSWORD (từ compose prod) + KEYS_STORAGE_DIR (mặc định src/keys/data)

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const db = require("../../src/db/pool");

const KEYS_DIR = process.env.KEYS_STORAGE_DIR || path.join(__dirname, "../../src/keys/data");
const ENDPOINTS_DIR = process.env.ENDPOINTS_STORAGE_DIR || path.join(__dirname, "../../src/endpoints/data");
const KEYS_FILE = path.join(KEYS_DIR, "keys.json");
const ENDPOINTS_FILE = path.join(ENDPOINTS_DIR, "endpoints.json");

const DRY_RUN = process.argv.includes("--dry-run");
const APPLY = process.argv.includes("--apply");

if (!DRY_RUN && !APPLY) {
  console.error("Cần flag --dry-run hoặc --apply");
  process.exit(1);
}

function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (_) {
    return null;
  }
}

function hashKey(key) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

(async () => {
  const keys = readJsonSafe(KEYS_FILE) || [];
  const endpoints = readJsonSafe(ENDPOINTS_FILE) || [];
  console.log(`[backfill] mode=${DRY_RUN ? "DRY-RUN" : "APPLY"} · ${keys.length} keys, ${endpoints.length} endpoints`);
  console.log(`[backfill] source: ${KEYS_FILE} + ${ENDPOINTS_FILE}`);

  if (DRY_RUN) {
    console.log("-- dry-run keys --");
    keys.forEach((k) => console.log(`  ${k.id} ${k.name} status=${k.status} scopes=${(k.scopes || []).join("+")}`));
    console.log("-- dry-run endpoints --");
    endpoints.forEach((e) => console.log(`  ${e.id} ${e.name} model=${e.model} status=${e.status}`));
    console.log("[backfill] dry-run xong — không ghi DB.");
    await db.shutdown();
    return;
  }

  // APPLY
  let keysInserted = 0, endpointsInserted = 0, eventsInserted = 0;
  for (const k of keys) {
    try {
      // file-store có sẵn key_hash; nếu thiếu, hash từ... không có full key (chỉ hash), nên dùng sẵn
      const { rows } = await db.query(
        `INSERT INTO api_keys (id, name, key_hash, key_prefix, scopes, status, created_at, revoked_at, rotated_at, scopes_updated_at, last_used_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (id) DO NOTHING
         RETURNING id`,
        [k.id, k.name, k.keyHash || hashKey(k.keyPrefix || ""), k.keyPrefix, k.scopes || [],
         k.status, k.createdAt, k.revokedAt || null, k.rotatedAt || null, k.scopesUpdatedAt || null, k.lastUsedAt || null]
      );
      if (rows[0]) keysInserted++;
    } catch (e) { console.error(`[backfill] key ${k.id} lỗi:`, e.message); }
  }

  for (const e of endpoints) {
    try {
      const { rows } = await db.query(
        `INSERT INTO endpoint_entities (id, name, model, gpu, region, mode, commit, replicas, desired_replicas, max_replicas, rate, commit_label, image, port, status, created_at, updated_at, started_at, stopped_at, failed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
         ON CONFLICT (id) DO NOTHING
         RETURNING id`,
        [e.id, e.name, e.model, e.gpu, e.region, e.mode, e.commit, e.replicas,
         e.desiredReplicas, e.maxReplicas, e.rate, e.commitLabel, e.image, e.port, e.status,
         e.createdAt, e.updatedAt, e.startedAt || null, e.stoppedAt || null, e.failedAt || null]
      );
      if (rows[0]) endpointsInserted++;
      // backfill events
      for (const ev of (e.events || [])) {
        try {
          await db.query(
            `INSERT INTO endpoint_events (endpoint_id, at, from_state, to_state, msg)
             VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
            [e.id, ev.at, ev.from || null, ev.to, ev.msg || ""]
          );
          eventsInserted++;
        } catch (_) {}
      }
    } catch (e) { console.error(`[backfill] endpoint ${e.id} lỗi:`, e.message); }
  }

  console.log(`[backfill] xong — inserted ${keysInserted} keys, ${endpointsInserted} endpoints, ${eventsInserted} events.`);
  console.log(`[backfill] file cũ giữ nguyên (rollback tại env KEYS_BACKEND=file).`);
  await db.shutdown();
})().catch((e) => { console.error("[backfill] fatal:", e.message); process.exit(1); });
