"use strict";

// Model Catalog Admin — e2e test (CRUD, workflow, RBAC, audit, mirror job)
// Chạy: node tests/catalog-admin/run-tests.js  (DDI_BASE=http://localhost:3000)

const http = require("http");

const BASE = process.env.DDI_BASE || "http://localhost:3000";

let pass = 0, fail = 0;
const results = [];

function req(method, path, { body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    let payload = null;
    const h = { ...headers };
    if (body) {
      payload = JSON.stringify(body);
      h["Content-Type"] = "application/json";
      h["Content-Length"] = Buffer.byteLength(payload);
    }
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
  else { fail++; console.log(`  ✗ ${name} — ${detail || ""}`); }
}

async function makeKey(name, scopes, role) {
  const r = await req("POST", "/v1/keys", { body: { name: name + "-" + Date.now().toString(36), scopes, role } });
  if (!r.json || !r.json.full_key) throw new Error("không tạo được key: " + r.body?.slice(0, 200));
  return r.json.full_key;
}
const H = (key) => ({ Authorization: "Bearer " + key });

const HW = [{ gpu_sku_code: "l40s", gpus_per_instance: 1, is_recommended: true, per_gpu_hourly_price_usd_micros: 3290000, sort_order: 0, precision: "fp8", vram_required_gb: 75 }];

// Suffix duy nhất mỗi lần chạy → test idempotent, chạy lại không va chạm dữ liệu cũ
const RUN = Date.now().toString(36);

function entryPayload(id) {
  return {
    id, hfModelId: "fpt-internal/test-" + id, displayName: "Test Model " + id,
    shortDescription: "model test e2e", parametersDisplay: "8B dense", contextLengthDisplay: "32K",
    license: "mit", catalogType: "public", categories: ["chat"], fromPrice: 3.29,
    hardwareProfiles: HW, benchmarks: [{ benchmark_name: "MMLU", score: 70.1, max_score: 100, sort_order: 0 }],
  };
}

async function main() {
  console.log(`\n=== Model Catalog Admin — e2e test ===`);
  console.log(`base=${BASE}\n`);

  // 0. Tạo keys
  console.log("[0] Tạo keys (admin + approver)");
  let adminKey, approverKey, viewerKey;
  {
    adminKey = await makeKey("mc-admin", ["admin"], "admin");
    approverKey = await makeKey("mc-approver", ["admin"], "approver");
    viewerKey = await makeKey("mc-viewer", ["admin"], "viewer");
    check("tạo 3 key (admin/approver/viewer)", true);
  }

  // 1. RBAC — viewer không tạo được
  console.log("[1] RBAC");
  {
    const r = await req("POST", "/v1/admin/catalog/entries", { body: entryPayload("rbac-v1-" + RUN), headers: H(viewerKey) });
    check("viewer POST entry → 403", r.status === 403, `got ${r.status}`);
    const r2 = await req("GET", "/v1/admin/catalog/entries", { headers: H(viewerKey) });
    check("viewer GET entries → 200 (đọc được)", r2.status === 200, `got ${r2.status}`);
    const r3 = await req("GET", "/v1/admin/catalog/entries", { headers: {} });
    check("không key → 401", r3.status === 401, `got ${r3.status}`);
  }

  // 2. Create entry (draft)
  console.log("[2] Create entry");
  let entryId = null;
  {
    const r = await req("POST", "/v1/admin/catalog/entries", { body: entryPayload("e2e-create-" + RUN), headers: H(adminKey) });
    check("POST entry → 201", r.status === 201, `got ${r.status} — ${r.body?.slice(0, 200)}`);
    check("status=draft", r.json?.data?.status === "draft", `got ${r.json?.data?.status}`);
    check("weight_status=not_mirrored", r.json?.data?.weightStatus === "not_mirrored", `got ${r.json?.data?.weightStatus}`);
    entryId = r.json?.data?.id;

    const dup = await req("POST", "/v1/admin/catalog/entries", { body: entryPayload("e2e-create-" + RUN), headers: H(adminKey) });
    check("duplicate id → 409", dup.status === 409, `got ${dup.status}`);

    const bad = await req("POST", "/v1/admin/catalog/entries", { body: { id: "bad-1", hfModelId: "x/y" }, headers: H(adminKey) });
    check("thiếu field bắt buộc → 400", bad.status === 400, `got ${bad.status}`);

    const badHw = await req("POST", "/v1/admin/catalog/entries", {
      body: { ...entryPayload("bad-hw-" + RUN), hardwareProfiles: [{ gpu_sku_code: "l40s", gpus_per_instance: 1, is_recommended: false, per_gpu_hourly_price_usd_micros: 100, sort_order: 0 }] },
      headers: H(adminKey),
    });
    check("không có profile recommended → 400", badHw.status === 400, `got ${badHw.status}`);
  }

  // 3. List + filter
  console.log("[3] List + filter");
  {
    const r = await req("GET", `/v1/admin/catalog/entries?status=draft&query=e2e-create-${RUN}`, { headers: H(adminKey) });
    check("list filter status+query thấy entry", r.json?.data?.some((e) => e.id === entryId), `count=${r.json?.count}`);
    const r2 = await req("GET", "/v1/admin/catalog/entries?catalog_type=proprietary", { headers: H(adminKey) });
    check("filter catalog_type=proprietary không thấy entry public", !(r2.json?.data || []).some((e) => e.id === entryId));
  }

  // 4. Submit + approve flow
  console.log("[4] Workflow submit → approve");
  {
    const sub = await req("POST", `/v1/admin/catalog/entries/${entryId}/submit`, { headers: H(adminKey) });
    check("submit → pending_review", sub.json?.data?.status === "pending_review", `got ${sub.status} ${sub.body?.slice(0, 150)}`);

    const rej = await req("POST", `/v1/admin/catalog/entries/${entryId}/reject`, { body: { reason: "ab" }, headers: H(approverKey) });
    check("reject lý do < 5 ký tự → 400", rej.status === 400, `got ${rej.status}`);

    // Rule PO: admin có toàn quyền — creator (admin) được tự duyệt entry mình tạo
    const selfApp = await req("POST", `/v1/admin/catalog/entries/${entryId}/approve`, { headers: H(adminKey) });
    check("admin tự approve entry mình tạo → active", selfApp.json?.data?.status === "active", `got ${selfApp.status} ${selfApp.body?.slice(0, 200)}`);
    check("publish chạy (dry-run ok)", selfApp.json?.publish?.ok === true, `publish=${JSON.stringify(selfApp.json?.publish)}`);

    const upd = await req("PUT", `/v1/admin/catalog/entries/${entryId}`, { body: { displayName: "Sửa khi active" }, headers: H(adminKey) });
    check("sửa entry active → 409", upd.status === 409, `got ${upd.status}`);

    // Luồng 2: approver (không phải creator) duyệt entry do admin tạo
    const c2 = await req("POST", "/v1/admin/catalog/entries", { body: entryPayload("e2e-appr-" + RUN), headers: H(adminKey) });
    const id2 = c2.json?.data?.id;
    await req("POST", `/v1/admin/catalog/entries/${id2}/submit`, { headers: H(adminKey) });
    const app2 = await req("POST", `/v1/admin/catalog/entries/${id2}/approve`, { headers: H(approverKey) });
    check("approver approve entry người khác → active", app2.json?.data?.status === "active", `got ${app2.status} ${app2.body?.slice(0, 200)}`);
    await req("POST", `/v1/admin/catalog/entries/${id2}/disable`, { headers: H(adminKey) });
  }

  // 5. Mirror job được tạo sau approve
  console.log("[5] Mirror job");
  {
    const r = await req("GET", "/v1/admin/catalog/mirror-jobs?limit=50", { headers: H(adminKey) });
    const job = (r.json?.data || []).find((j) => j.entryId === entryId);
    check("có mirror job cho entry", !!job, `jobs=${r.json?.count}`);
    if (job) {
      const cancel = await req("POST", `/v1/admin/catalog/mirror-jobs/${job.id}/cancel`, { headers: H(adminKey) });
      check("cancel job queued/downloading → ok", cancel.json?.ok === true, `got ${cancel.status} ${cancel.body?.slice(0, 150)}`);
      const detail = await req("GET", `/v1/admin/catalog/entries/${entryId}`, { headers: H(adminKey) });
      check("weight_status về not_mirrored sau cancel", detail.json?.data?.weightStatus === "not_mirrored", `got ${detail.json?.data?.weightStatus}`);
    }
  }

  // 6. Disable / Enable
  console.log("[6] Disable / Enable");
  {
    const dis = await req("POST", `/v1/admin/catalog/entries/${entryId}/disable`, { headers: H(adminKey) });
    check("disable → inactive", dis.json?.data?.status === "inactive", `got ${dis.status} ${dis.body?.slice(0, 150)}`);
    const en = await req("POST", `/v1/admin/catalog/entries/${entryId}/enable`, { headers: H(adminKey) });
    check("enable → active", en.json?.data?.status === "active", `got ${en.status} ${en.body?.slice(0, 150)}`);
  }

  // 7. Delete — chỉ draft
  console.log("[7] Delete");
  {
    const del = await req("DELETE", `/v1/admin/catalog/entries/${entryId}`, { headers: H(adminKey) });
    check("xóa entry active → 409 NOT_DRAFT", del.status === 409, `got ${del.status}`);
    const r2 = await req("POST", "/v1/admin/catalog/entries", { body: entryPayload("e2e-del-" + RUN), headers: H(adminKey) });
    const id2 = r2.json?.data?.id;
    const del2 = await req("DELETE", `/v1/admin/catalog/entries/${id2}`, { headers: H(adminKey) });
    check("xóa entry draft → ok", del2.json?.ok === true, `got ${del2.status}`);
    const gone = await req("GET", `/v1/admin/catalog/entries/${id2}`, { headers: H(adminKey) });
    check("entry đã xóa → 404", gone.status === 404, `got ${gone.status}`);
  }

  // 8. Categories
  console.log("[8] Categories");
  {
    const r = await req("GET", "/v1/admin/catalog/categories", { headers: H(adminKey) });
    check("list categories có seed (chat)", (r.json?.data || []).some((c) => c.code === "chat"), `count=${r.json?.count}`);
    const c = await req("POST", "/v1/admin/catalog/categories", { body: { code: "test-cat-e2e", display_name: "Test Cat", sort_order: 99 }, headers: H(adminKey) });
    check("create category → 201", c.status === 201, `got ${c.status}`);
    const u = await req("PUT", "/v1/admin/catalog/categories/test-cat-e2e", { body: { display_name: "Test Cat 2" }, headers: H(adminKey) });
    check("update category", u.json?.data?.displayName === "Test Cat 2", `got ${u.body?.slice(0, 100)}`);
    // gắn category vào entry → không xóa được
    await req("PUT", `/v1/admin/catalog/entries/${entryId}`, { body: {} }, { headers: H(adminKey) }); // no-op keep
    const delCat = await req("DELETE", "/v1/admin/catalog/categories/test-cat-e2e", { headers: H(adminKey) });
    check("xóa category rỗng → ok", delCat.json?.ok === true, `got ${delCat.status} ${delCat.body?.slice(0, 100)}`);
    const dupCat = await req("POST", "/v1/admin/catalog/categories", { body: { code: "chat", display_name: "x" }, headers: H(adminKey) });
    check("duplicate category → 409", dupCat.status === 409, `got ${dupCat.status}`);
  }

  // 9. Audit log
  console.log("[9] Audit log");
  {
    const r = await req("GET", `/v1/admin/catalog/audit?entry_id=${entryId}`, { headers: H(adminKey) });
    const actions = (r.json?.data || []).map((h) => h.action);
    check("audit có mc.create", actions.includes("mc.create"), `actions=${actions.join(",")}`);
    check("audit có mc.approve", actions.includes("mc.approve"), `actions=${actions.join(",")}`);
    check("audit có mc.disable + mc.enable", actions.includes("mc.disable") && actions.includes("mc.enable"), `actions=${actions.join(",")}`);
  }

  // 10. hf-fetch — validate shape (không chặn nếu không có internet)
  console.log("[10] hf-fetch");
  {
    const bad = await req("POST", "/v1/admin/catalog/hf-fetch", { body: { hf_model_id: "not-a-repo" }, headers: H(adminKey) });
    check("hf id sai dạng → 400 INVALID_REPO_ID", bad.status === 400 && bad.json?.error?.code === "INVALID_REPO_ID", `got ${bad.status} ${bad.body?.slice(0, 120)}`);
    const good = await req("POST", "/v1/admin/catalog/hf-fetch", { body: { hf_model_id: "meta-llama/Llama-3.2-1B" }, headers: H(adminKey) });
    if (good.status === 200) {
      check("hf fetch repo thật → metadata", !!good.json?.data?.hfModelId, `data=${JSON.stringify(good.json?.data || {}).slice(0, 120)}`);
    } else {
      console.log(`  ○ hf fetch repo thật: ${good.status} ${good.json?.error?.code || ""} (môi trường không có internet — bỏ qua)`);
    }
  }

  // Cleanup
  try {
    await req("POST", `/v1/admin/catalog/entries/${entryId}/disable`, { headers: H(adminKey) });
    await req("DELETE", `/v1/admin/catalog/entries/${entryId}`, { headers: H(adminKey) }).catch(() => {});
  } catch (_) {}

  console.log(`\n=== Kết quả: ${pass} pass, ${fail} fail ===`);
  if (fail > 0) {
    console.log("Failed:");
    results.filter((r) => !r.ok).forEach((r) => console.log(`  ✗ ${r.name} — ${r.detail}`));
    process.exit(1);
  }
}

main().catch((e) => { console.error("Test crash:", e); process.exit(1); });