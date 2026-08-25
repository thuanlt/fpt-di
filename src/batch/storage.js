"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { pipeline } = require("stream/promises");
const cfg = require("./config");

function jobDir(jobId) {
  return path.join(cfg.storage.root, jobId);
}
function inputPath(jobId) {
  return path.join(jobDir(jobId), cfg.storage.inputDir, "input.jsonl");
}
function outputPath(jobId) {
  return path.join(jobDir(jobId), cfg.storage.outputDir, "output.jsonl");
}
function metaPath(jobId) {
  return path.join(jobDir(jobId), "meta.json");
}

function ensureJobDir(jobId) {
  fs.mkdirSync(path.join(jobDir(jobId), cfg.storage.inputDir), { recursive: true });
  fs.mkdirSync(path.join(jobDir(jobId), cfg.storage.outputDir), { recursive: true });
}

async function saveUpload(jobId, fileStream) {
  ensureJobDir(jobId);
  const tmp = inputPath(jobId) + ".tmp";
  const out = fs.createWriteStream(tmp, { flags: "w" });
  let size = 0;
  fileStream.on("data", (c) => { size += c.length; if (size > cfg.storage.maxJobSizeBytes) out.destroy(new Error("FILE_TOO_LARGE")); });
  try {
    await pipeline(fileStream, out);
    if (size > cfg.storage.maxJobSizeBytes) throw new Error("FILE_TOO_LARGE");
    fs.renameSync(tmp, inputPath(jobId));
    return { size };
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch (_) {}
    throw e;
  }
}

function writeMeta(jobId, meta) {
  fs.writeFileSync(metaPath(jobId), JSON.stringify(meta, null, 2));
}

function readMeta(jobId) {
  const p = metaPath(jobId);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function appendOutput(jobId, line) {
  fs.appendFileSync(outputPath(jobId), line + "\n");
}

function readInputLines(jobId, fromLine = 0) {
  const p = inputPath(jobId);
  if (!fs.existsSync(p)) return [];
  const content = fs.readFileSync(p, "utf8");
  const all = content.split(/\r?\n/).filter(Boolean);
  return all.slice(fromLine);
}

function readOutputStats(jobId) {
  const p = outputPath(jobId);
  if (!fs.existsSync(p)) return { lines: 0, sizeBytes: 0 };
  const stat = fs.statSync(p);
  let lines = 0;
  const buf = fs.readFileSync(p, "utf8");
  if (buf.length) lines = buf.split(/\r?\n/).filter(Boolean).length;
  return { lines, sizeBytes: stat.size };
}

function deleteJobDir(jobId) {
  const dir = jobDir(jobId);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function safeJobId() {
  return "b-" + crypto.randomBytes(6).toString("hex");
}

module.exports = {
  safeJobId,
  ensureJobDir,
  saveUpload,
  writeMeta,
  readMeta,
  appendOutput,
  readInputLines,
  readOutputStats,
  deleteJobDir,
  inputPath,
  outputPath,
  metaPath,
  jobDir,
};
