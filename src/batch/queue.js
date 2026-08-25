"use strict";

const Redis = require("ioredis");
const cfg = require("./config");

const pub = new Redis(cfg.redis);
pub.on("error", (e) => console.error("[redis:pub]", e.message));

let groupReady = null;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function ensureGroup() {
  if (groupReady) return groupReady;
  groupReady = (async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        console.log(`[queue] attempt ${attempt}: XGROUP CREATE ${cfg.queue.stream} ${cfg.queue.consumerGroup} $ MKSTREAM`);
        await pub.xgroup("CREATE", cfg.queue.stream, cfg.queue.consumerGroup, "$", "MKSTREAM");
        console.log(`[queue] ✓ tạo consumer group "${cfg.queue.consumerGroup}" thành công`);
        // verify
        const info = await pub.xinfo("STREAM", cfg.queue.stream).catch(() => null);
        console.log(`[queue] verify stream exists:`, info ? "yes" : "no");
        return true;
      } catch (e) {
        const msg = String(e.message);
        if (msg.includes("BUSYGROUP")) {
          console.log(`[queue] group đã tồn tại → bỏ qua`);
          return true;
        }
        if (msg.includes("NOGROUP")) {
          console.log(`[queue] NOGROUP — DEL + retry`);
          await pub.del(cfg.queue.stream).catch(() => {});
          await sleep(100 * (attempt + 1));
          groupReady = null;
          continue;
        }
        console.error("[queue] ensureGroup failed", msg);
        return false;
      }
    }
    return false;
  })();
  return groupReady;
}

async function enqueue(jobId, payload) {
  await ensureGroup();
  await pub.xadd(cfg.queue.stream, "*",
    "jobId", jobId,
    "payload", JSON.stringify(payload)
  );
  await pub.hset("ddi:batch:jobs", jobId, JSON.stringify(payload.meta));
  await pub.incr("ddi:batch:stats:submitted");
  return jobId;
}

async function readPendingForConsumer(consumerName) {
  await ensureGroup();
  const r = new Redis(cfg.redis);
  r.on("error", (e) => console.error("[redis:worker]", e.message));
  try {
    const out = [];
    let res = null;
    try {
      res = await r.xreadgroup(
        "GROUP", cfg.queue.consumerGroup, consumerName,
        "COUNT", 1, "BLOCK", cfg.queue.blockMs, "STREAMS", cfg.queue.stream, ">"
      );
    } catch (e) {
      if (!String(e.message).includes("NOGROUP")) throw e;
      groupReady = null;
      await ensureGroup();
      res = await r.xreadgroup(
        "GROUP", cfg.queue.consumerGroup, consumerName,
        "COUNT", 1, "BLOCK", cfg.queue.blockMs, "STREAMS", cfg.queue.stream, ">"
      );
    }
    if (res && res.length) {
      const [, entries] = res[0];
      for (const [id, fields] of entries) {
        const obj = {};
        for (let i = 0; i < fields.length; i += 2) obj[fields[i]] = fields[i + 1];
        out.push({ id, jobId: obj.jobId, payload: JSON.parse(obj.payload) });
      }
    }
    return out;
  } finally {
    await r.quit().catch(() => {});
  }
}

async function ack(id) {
  await pub.xack(cfg.queue.stream, cfg.queue.consumerGroup, id);
}

async function updateJobMeta(jobId, patch) {
  const cur = await pub.hget("ddi:batch:jobs", jobId);
  const meta = cur ? JSON.parse(cur) : {};
  const next = { ...meta, ...patch };
  await pub.hset("ddi:batch:jobs", jobId, JSON.stringify(next));
  return next;
}

async function getJobMeta(jobId) {
  const cur = await pub.hget("ddi:batch:jobs", jobId);
  return cur ? JSON.parse(cur) : null;
}

async function listJobs({ status, limit = 100 } = {}) {
  const all = await pub.hgetall("ddi:batch:jobs");
  let arr = Object.entries(all).map(([id, v]) => ({ id, ...(JSON.parse(v)) }));
  if (status) arr = arr.filter((j) => j.status === status);
  arr.sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));
  return arr.slice(0, limit);
}

async function incrStat(key) {
  return pub.incr(`ddi:batch:stats:${key}`);
}

async function getStats() {
  const keys = ["submitted", "completed", "failed", "requestsProcessed", "requestsFailed"];
  const out = {};
  for (const k of keys) out[k] = parseInt((await pub.get(`ddi:batch:stats:${k}`)) || "0", 10);
  const queued = await pub.xlen(cfg.queue.stream);
  out.queued = queued;
  return out;
}

async function shutdown() {
  await pub.quit().catch(() => {});
}

async function ping() {
  let r;
  try {
    r = new Redis({ ...cfg.redis, connectTimeout: 1000, lazyConnect: true, maxRetriesPerRequest: 0, retryStrategy: () => null });
    r.on("error", () => {});
    await r.connect({ timeout: 1000 });
    await r.ping();
    return true;
  } catch (_) {
    return false;
  } finally {
    if (r) await r.quit().catch(() => {});
  }
}

module.exports = {
  ensureGroup,
  enqueue,
  readPendingForConsumer,
  ack,
  updateJobMeta,
  getJobMeta,
  listJobs,
  incrStat,
  getStats,
  shutdown,
  ping,
};
