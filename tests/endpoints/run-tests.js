"use strict";

const http = require("http");

const BASE = process.env.DDI_BASE || "http://localhost:5173";

// Tạo 1 key có scope endpoints để auth mọi call trong test này
let authKey = null;

let pass = 0, fail = 0;
const results = [];

function req(method, urlPath, { body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + urlPath);
    let payload = null;
    const h = { ...headers };
    if (body) {
      payload = JSON.stringify(body);
      h["Content-Type"] = "application/json";
      h["Content-Length"] = Buffer.byteLength(payload);
    }
    if (authKey && !h.Authorization) h.Authorization = `Bearer ${authKey}`;
    const r = http.request({ hostname: url.hostname, port: url.port, path: url.pathname + url.search, method, headers: h }, (res) => {
      let buf = "";
      res.on("data", (c) => (buf += c));
      res.on("end", () => {
        let json = null;
        try { json = buf ? JSON.parse(buf) : null; } catch (_) {}
        resolve({ status: res.statusCode, body: buf, json });
      });
    });
    r.on("error", reject);
    if (payload) r.write(payload);
    r.end();
  });
}

function check(name, ok, detail) {
  results.push({ name, ok, detail: detail || "" });
  if (ok) { pass++; console.log(`  ✓ ${name}`); }
  else    { fail++; console.log(`  ✗ ${name} — ${detail || ""}`); }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function name() { return "ep-e2e-" + Math.random().toString(36).slice(2, 8); }

async function main() {
  console.log(`\n=== FPT DDI Dedicated Endpoints — e2e test (BE thật + lifecycle worker) ===`);
  console.log(`base=${BASE}\n`);

  // 0. Tạo key có scope endpoints để dùng xuyên suốt
  {
    const uniqueNm = "e2e-endpoints-" + Date.now();
    const r = await req("POST", "/v1/keys", { body: { name: uniqueNm, scopes: ["endpoints"], role: "operator" } });
    if (r.status !== 201 || !r.json?.full_key) {
      // fallback: list existing keys, tìm 1 key có scope endpoints + active
      const lst = await req("GET", "/v1/keys");
      const found = (lst.json?.data || []).find((k) => k.status === "active" && (k.scopes || []).includes("endpoints"));
      if (found) {
        // rotate để lấy full_key mới (vì không có cách recover full_key cũ)
        const rr = await req("POST", `/v1/keys/${found.id}/rotate`);
        authKey = rr.json?.full_key;
      }
      if (!authKey) {
        console.error("Không tạo được key test và cũng không tìm key cũ để rotate");
        console.error("POST /v1/keys →", r.status, r.body?.slice(0, 300));
        process.exit(2);
      }
      console.log(`[setup] reuse + rotate key ${found.id} (prefix ${found.keyPrefix})\n`);
    } else {
      authKey = r.json.full_key;
      console.log(`[setup] key ${uniqueNm} tạo xong (prefix ${r.json.keyPrefix})\n`);
    }
  }

  let epId = null;

  // 1. GET /endpoints ban đầu
  console.log("[1] GET /v1/endpoints — list ban đầu");
  {
    const r = await req("GET", "/v1/endpoints");
    check("status 200", r.status === 200, `got ${r.status}`);
    check("data là array", Array.isArray(r.json?.data), "—");
  }

  // 2. POST /endpoints — tạo endpoint k8s hợp lệ
  console.log("\n[2] POST /v1/endpoints — tạo endpoint k8s mới");
  {
    const nm = name();
    const r = await req("POST", "/v1/endpoints", { body: {
      name: nm, model: "GLM-5.2", gpu: "H100", region: "HAN-1",
      mode: "k8s", commit: "7-30", minReplicas: 1, maxReplicas: 4,
    }});
    check("status 201", r.status === 201, `got ${r.status} — ${r.body?.slice(0, 200)}`);
    check("trả id", typeof r.json?.data?.id === "string", "—");
    check("status=queued", r.json?.data?.status === "queued", "—");
    check("replicas '1/4'", r.json?.data?.replicas === "1/4", `got ${r.json?.data?.replicas}`);
    check("rate $2.27 (H100 × 0.91)", r.json?.data?.rate === "2.27", `got ${r.json?.data?.rate}`);
    check("commitLabel '7–30d'", r.json?.data?.commitLabel === "7–30d", "—");
    check("events có 1 entry queued", r.json?.data?.events?.length === 1, "—");
    if (r.json?.data?.id) epId = r.json.data.id;
  }

  // 3. POST /endpoints — thiếu name
  console.log("\n[3] POST /v1/endpoints — thiếu name → 400");
  {
    const r = await req("POST", "/v1/endpoints", { body: { model: "GLM-5.2", gpu: "H100", region: "HAN-1", mode: "k8s", commit: "on-demand" } });
    check("status 400", r.status === 400, `got ${r.status}`);
  }

  // 4. POST /endpoints — gpu hay region không hợp lệ
  console.log("\n[4] POST /v1/endpoints — region không hợp lệ → 400");
  {
    const r = await req("POST", "/v1/endpoints", { body: { name: name(), model: "X", gpu: "H100", region: "MARS", mode: "k8s", commit: "on-demand" } });
    check("status 400", r.status === 400, `got ${r.status}`);
  }

  // 5. POST /endpoints — trùng name
console.log("\n[5] POST /v1/endpoints — trùng tên → 409");
  {
    const nm = name();
    const first = await req("POST", "/v1/endpoints", { body: {
      name: nm, model: "GLM-5.2", gpu: "H100", region: "HAN-1",
      mode: "k8s", commit: "7-30", minReplicas: 1, maxReplicas: 4,
    }});
    check("tạo lần 1 201", first.status === 201, `got ${first.status}`);
    const r = await req("POST", "/v1/endpoints", { body: {
      name: nm, model: "GLM-5.2", gpu: "H100", region: "HAN-1",
      mode: "k8s", commit: "7-30", minReplicas: 1, maxReplicas: 4,
    }});
    check("status 409 — trùng tên", r.status === 409, `got ${r.status}`);
  }

  // 6. GET /v1/endpoints — thấy endpoint mới
  console.log("\n[6] GET /v1/endpoints — thấy endpoint vừa tạo");
  {
    const r = await req("GET", "/v1/endpoints");
    check("≥1 endpoint", r.json?.data?.length >= 1, `got ${r.json?.data?.length}`);
    check("có id của mình", r.json?.data?.some((e) => e.id === epId), "—");
  }

  // 7. Lifecycle worker — poll trở thành running (bounded 30s)
  console.log("\n[7] Lifecycle worker — queued → deploying → running (tối đa 30s)");
  {
    let finalStatus = "queued";
    const t0 = Date.now();
    while (Date.now() - t0 < 30000) {
      const r = await req("GET", `/v1/endpoints/${epId}`);
      finalStatus = r.json?.data?.status;
      if (finalStatus === "running") break;
      await sleep(800);
    }
    check("đạt running", finalStatus === "running", `hiện ${finalStatus}`);
    const detail = await req("GET", `/v1/endpoints/${epId}`);
    const events = detail.json?.data?.events || [];
    const types = events.map((e) => e.to);
    check("events có queued → deploying → running", types.join("→").includes("queued") && types.includes("deploying") && types.includes("running"), types.join("→"));
    check("≥3 events (queued/deploying/running)", events.length >= 3, `got ${events.length}`);
    check("startedAt có khi running", !!detail.json?.data?.startedAt, "—");
  }

  // 8. GET /v1/endpoints/:id/metrics — metrics thật (aggregate từ usage)
  console.log("\n[8] GET /v1/endpoints/:id/metrics — metrics runtime");
  {
    const r = await req("GET", `/v1/endpoints/${epId}/metrics?range=24h`);
    check("status 200", r.status === 200, `got ${r.status}`);
    const t = r.json?.data?.totals || {};
    check("requests là số", typeof t.requests === "number", "—");
    check("total_tokens là số", typeof t.total_tokens === "number", "—");
    check("avg_latency_ms là số", typeof t.avg_latency_ms === "number", "—");
    check("p95 là số", typeof t.p95 === "number", "—");
    check("series là array", Array.isArray(r.json?.data?.series), "—");
  }

  // 9. Scale endpoint
  console.log("\n[9] POST /v1/endpoints/:id/scale — scale 1→3 replicas");
  {
    const r = await req("POST", `/v1/endpoints/${epId}/scale`, { body: { replicas: 3 } });
    check("status 200", r.status === 200, `got ${r.status}`);
    check("replicas='3/4'", r.json?.data?.replicas === "3/4", `got ${r.json?.data?.replicas}`);
    check("desiredReplicas=3", r.json?.data?.desiredReplicas === 3, "—");
    const lastEv = (r.json?.data?.events || []).slice(-1)[0];
    check("events có 'scaled to 3 replicas'", (lastEv?.msg || "").includes("scaled to 3"), lastEv?.msg);
  }

  // 10. Scale vượt max → 400
  console.log("\n[10] POST /v1/endpoints/:id/scale — scale vượt max (5) → 400");
  {
    const r = await req("POST", `/v1/endpoints/${epId}/scale`, { body: { replicas: 5 } });
    check("status 400", r.status === 400, `got ${r.status}`);
  }

  // 11. Scale endpoint không running → fail (tạo 1 endpoint mới container mode, gom scale trước chạy)
  console.log("\n[11] Scale endpoint không running → 400");
  {
    const c = await req("POST", "/v1/endpoints", { body: {
      name: name(), model: "PhoGPT-4B", gpu: "A30", region: "HAN-2",
      mode: "container", commit: "on-demand",
    }});
    const newId = c.json?.data?.id;
    // ngay lập tức scale khi còn queued
    const r = await req("POST", `/v1/endpoints/${newId}/scale`, { body: { replicas: 2 } });
    check("status 400 — chưa running", r.status === 400, `got ${r.status}`);
  }

  // 12. POST /v1/endpoints/:id/stop — stop endpoint running
  console.log("\n[12] POST /v1/endpoints/:id/stop — stop endpoint đang running");
  {
    const r = await req("POST", `/v1/endpoints/${epId}/stop`);
    check("status 200", r.status === 200, `got ${r.status}`);
    check("status=stopped", r.json?.data?.status === "stopped", "—");
    check("stoppedAt có", !!r.json?.data?.stoppedAt, "—");
  }

  // 13. Stop endpoint đã stopped → 400
  console.log("\n[13] POST /v1/endpoints/:id/stop — stop lần 2 → 400");
  {
    const r = await req("POST", `/v1/endpoints/${epId}/stop`);
    check("status 400", r.status === 400, `got ${r.status}`);
  }

  // 14. POST /v1/endpoints/:id/start — start endpoint stopped
  console.log("\n[14] POST /v1/endpoints/:id/start — start endpoint từ stopped");
  {
    const r = await req("POST", `/v1/endpoints/${epId}/start`);
    check("status 200", r.status === 200, `got ${r.status}`);
    check("status=running", r.json?.data?.status === "running", "—");
  }

  // 15. Scale endpoint stopped (đang running) — phải chạy
  console.log("\n[15] Stop→Scale nhanh không được vì running");
  {
    // endpoint đang running từ bước 14 → scale lại về 2 OK
    const r = await req("POST", `/v1/endpoints/${epId}/scale`, { body: { replicas: 2 } });
    check("status 200 (running có thể scale)", r.status === 200, `got ${r.status}`);
    check("replicas='2/4'", r.json?.data?.replicas === "2/4", `got ${r.json?.data?.replicas}`);
  }

  // 16. DELETE endpoint đang running — được phép (force stop)
  console.log("\n[16] DELETE /v1/endpoints/:id — xóa endpoint đang running");
  {
    const r = await req("DELETE", `/v1/endpoints/${epId}`);
    check("status 200", r.status === 200, `got ${r.status}`);
    const after = await req("GET", `/v1/endpoints/${epId}`);
    check("GET sau delete → 404", after.status === 404, `got ${after.status}`);
  }

  // 17. GET /v1/endpoints có filter
  console.log("\n[17] GET /v1/endpoints?status=running — filter status");
  {
    // tạo thêm 1 endpoint rồi đợi tới running
    const c = await req("POST", "/v1/endpoints", { body: {
      name: name(), model: "GLM-5.2", gpu: "H100", region: "HAN-1",
      mode: "k8s", commit: "on-demand",
    }});
    const newId = c.json?.data?.id;
    // đợi tới running
    for (let i = 0; i < 15; i++) {
      const d = await req("GET", `/v1/endpoints/${newId}`);
      if (d.json?.data?.status === "running") break;
      await sleep(800);
    }
    const all = await req("GET", "/v1/endpoints?status=running");
    check("status 200", all.status === 200);
    check("tất cả đều running", (all.json?.data || []).every((e) => e.status === "running"), "có endpoint không running");
    const queued = await req("GET", "/v1/endpoints?status=queued");
    check("filter queued → tất cả queued", (queued.json?.data || []).every((e) => e.status === "queued"), "—");
  }

  // 18. GET /v1/endpoints?mode=k8s
  console.log("\n[18] GET /v1/endpoints?mode=k8s — filter mode");
  {
    const r = await req("GET", "/v1/endpoints?mode=k8s");
    check("status 200", r.status === 200);
    check("tất cả k8s mode", (r.json?.data || []).every((e) => e.mode === "k8s"), "—");
  }

  // 19. Container mode endpoint — không cho phép scale > 1 thật sự (max=1)
  console.log("\n[19] Container mode — maxReplicas=1, replicas='1/1'");
  {
    const c = await req("POST", "/v1/endpoints", { body: {
      name: name(), model: "PhoGPT-4B", gpu: "A30", region: "HAN-2",
      mode: "container", commit: "on-demand",
    }});
    check("trả '1/1' cho container mode", c.json?.data?.replicas === "1/1", `got ${c.json?.data?.replicas}`);
    check("rate '0.90' (A30 × 1)", c.json?.data?.rate === "0.90", `got ${c.json?.data?.rate}`);
    if (c.json?.data?.id) await req("DELETE", `/v1/endpoints/${c.json.data.id}`);
  }

  // 20. Auth — không key gọi /v1/endpoints → 401
  console.log("\n[20] Auth — không key → 401");
  {
    const saved = authKey; authKey = null;
    const r = await req("GET", "/v1/endpoints", { headers: {} });
    check("status 401", r.status === 401, `got ${r.status}`);
    authKey = saved;
  }

  // 21. Pricing calculation — verify mọi combo (H100 91-180d = $1.83)
  console.log("\n[21] Pricing matrix — H100 thời gian dài");
  {
    const c = await req("POST", "/v1/endpoints", { body: {
      name: name(), model: "GLM-5.2", gpu: "H100", region: "HAN-1",
      mode: "k8s", commit: "91-180",
    }});
    check("rate '1.82' (H100 × 0.73)", c.json?.data?.rate === "1.82", `got ${c.json?.data?.rate}`);
    if (c.json?.data?.id) await req("DELETE", `/v1/endpoints/${c.json.data.id}`);
  }

  // 22. 404 — get endpoint không tồn tại
  console.log("\n[22] GET /v1/endpoints/ep-khongtontai → 404");
  {
    const r = await req("GET", "/v1/endpoints/ep-khongtontai");
    check("status 404", r.status === 404, `got ${r.status}`);
  }

  console.log(`\n=== Tóm tắt ===`);
  console.log(`Pass: ${pass} · Fail: ${fail}`);
  if (fail > 0) {
    console.log("Cases thất bại:");
    results.filter((r) => !r.ok).forEach((r) => console.log(`  ✗ ${r.name} — ${r.detail}`));
  }
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error("FATAL", e); process.exit(2); });
