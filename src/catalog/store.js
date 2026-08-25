"use strict";

// US-01 — Model catalog (NIM). Đọc từ bảng model_catalog (Postgres), seed từ migration 009.

const db = require("../db/pool");

function rowToModel(r) {
  return {
    id: r.id, name: r.name, family: r.family, segments: r.segments, source: r.source,
    nimVersion: r.nim_version, gpuCompatible: r.gpu_compatible, maxContext: r.max_context,
    quantizations: r.quantizations, status: r.status,
  };
}

// list({ segment, source, gpu }) — lọc theo segment/source/gpu
async function list({ segment, source, gpu } = {}) {
  const cond = [];
  const args = [];
  if (segment) { cond.push(`$${args.length + 1} = ANY(segments)`); args.push(segment); }
  if (source) { cond.push(`source = $${args.length + 1}`); args.push(source); }
  if (gpu) { cond.push(`$${args.length + 1} = ANY(gpu_compatible)`); args.push(gpu); }
  let sql = `SELECT * FROM model_catalog`;
  if (cond.length) sql += ` WHERE ` + cond.join(" AND ");
  sql += ` ORDER BY name`;
  const { rows } = await db.query(sql, args);
  return rows.map(rowToModel);
}

module.exports = { list };