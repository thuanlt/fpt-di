"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const cfg = require("./config");

function jobDir(jobId) {
  return path.join(cfg.storage.root, jobId);
}
function weightsDir(jobId) {
  return path.join(jobDir(jobId), cfg.storage.weightsDir);
}
function tmpDir(jobId) {
  return path.join(jobDir(jobId), cfg.storage.tempDir);
}
function metaPath(jobId) {
  return path.join(jobDir(jobId), "meta.json");
}

function ensureJobDir(jobId) {
  fs.mkdirSync(weightsDir(jobId), { recursive: true });
  fs.mkdirSync(tmpDir(jobId), { recursive: true });
}

function safeJobId() {
  return "m-" + crypto.randomBytes(4).toString("hex");
}

function writeMeta(jobId, meta) {
  ensureJobDir(jobId);
  fs.writeFileSync(metaPath(jobId), JSON.stringify(meta, null, 2));
}

function readMeta(jobId) {
  const p = metaPath(jobId);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function listAll() {
  if (!fs.existsSync(cfg.storage.root)) return [];
  return fs.readdirSync(cfg.storage.root)
    .filter((d) => d.startsWith("m-"))
    .map((id) => {
      const m = readMeta(id);
      return m ? { id, ...m } : null;
    })
    .filter(Boolean)
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

function getById(id) {
  const m = readMeta(id);
  return m ? { id, ...m } : null;
}

function updateMeta(jobId, patch) {
  const cur = readMeta(jobId) || { id: jobId };
  const next = { ...cur, ...patch };
  if (patch.status && patch.status !== cur.status) {
    next.events = [...(cur.events || []), {
      at: new Date().toISOString(),
      from: cur.status || null,
      to: patch.status,
      msg: patch.statusMsg || "",
    }];
    delete next.statusMsg;
  }
  writeMeta(jobId, next);
  return next;
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFiles(full).map((f) => ({ ...f, name: entry.name + "/" + f.name })));
    } else {
      const stat = fs.statSync(full);
      out.push({ name: entry.name, sizeBytes: stat.size, mtime: stat.mtime.toISOString() });
    }
  }
  return out;
}

function weightsInfo(jobId) {
  const dir = weightsDir(jobId);
  const files = listFiles(dir);
  const totalBytes = files.reduce((s, f) => s + f.sizeBytes, 0);
  return { files, count: files.length, totalBytes };
}

function removeJob(id) {
  const dir = jobDir(id);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    return true;
  }
  return false;
}

module.exports = {
  jobDir, weightsDir, tmpDir, metaPath,
  ensureJobDir, safeJobId,
  writeMeta, readMeta, updateMeta,
  listAll, getById,
  listFiles, weightsInfo,
  removeJob,
};
