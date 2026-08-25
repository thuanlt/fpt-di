"use strict";

// US-06 — Gói giá theo phân khúc.
//   POST /v1/price-packs (scope admin) — tạo gói, 409 nếu trùng (segment+gpu+region)
//   GET  /v1/price-packs (scope admin) — danh sách, lọc segment/gpu/region

const express = require("express");
const store = require("./store");
const audit = require("../audit/store");

const router = express.Router();

function actorOf(req) { return (req.apiKey && req.apiKey.name) || "unknown"; }
function roleOf(req) { return (req.apiKey && req.apiKey.role) || "viewer"; }
function ipOf(req) { return req.ip || req.headers["x-forwarded-for"] || null; }

router.post("/price-packs", async (req, res) => {
  try {
    const pack = await store.create(req.body || {});
    await audit.record({
      actor: actorOf(req), role: roleOf(req), action: "price_pack.create",
      entityId: pack.id, entityType: "price_pack", result: "success", ip: ipOf(req),
      meta: { segment: pack.segment, gpu: pack.gpu, region: pack.region, ratePerHour: pack.ratePerHour, quotaRpm: pack.quotaRpm, quotaTpm: pack.quotaTpm },
    });
    res.status(201).json({ data: pack });
  } catch (e) {
    const dup = /đã tồn tại/.test(e.message);
    await audit.record({
      actor: actorOf(req), role: roleOf(req), action: "price_pack.create",
      entityType: "price_pack", result: "failure", ip: ipOf(req), meta: { error: e.message },
    });
    res.status(dup ? 409 : 400).json({ error: e.message });
  }
});

router.get("/price-packs", async (req, res) => {
  try {
    const { segment, gpu, region } = req.query || {};
    const data = await store.list({ segment, gpu, region });
    res.json({ count: data.length, data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;