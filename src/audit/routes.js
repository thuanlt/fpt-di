"use strict";

// US-05 — GET /v1/audit — audit trail (yêu cầu scope admin + role admin, enforce ở server.js)

const express = require("express");
const store = require("./store");

const router = express.Router();

router.get("/audit", async (req, res) => {
  try {
    const { from, to, actor, action, limit, offset } = req.query || {};
    const data = await store.list({ from, to, actor, action, limit, offset });
    res.json({ count: data.length, data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;