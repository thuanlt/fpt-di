"use strict";

// US-01 — GET /v1/catalog — lọc theo segment/source/gpu

const express = require("express");
const store = require("./store");

const router = express.Router();

router.get("/catalog", async (req, res) => {
  try {
    const { segment, source, gpu } = req.query || {};
    const data = await store.list({ segment, source, gpu });
    res.json({ count: data.length, data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;