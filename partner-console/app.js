/* ═══════════════════════════════════════════════
   FPT DDI Partner Console — data + rendering
   ═══════════════════════════════════════════════ */
"use strict";

/* ── API key holder — lưu trong localStorage, tự động đính kèm vào mọi fetch /v1/* operational ── */
const _origFetch = window.fetch.bind(window);
let ACTIVE_API_KEY = localStorage.getItem("fptDdiKey") || "";
const AUTH_PATHS = ["/v1/batch", "/v1/models", "/v1/endpoints", "/v1/skills", "/v1/chat", "/v1/byom", "/v1/audit", "/v1/price-packs", "/v1/dashboard"];
let _lastAuthToast = 0;
function authFailToast(status, json) {
  const now = Date.now();
  if (now - _lastAuthToast < 8000) return; // debounce — tránh spam khi poll
  _lastAuthToast = now;
  if (status === 401) {
    toast("401 — API key không hợp lệ hoặc đã bị thu hồi. Tạo key mới ở tab API Keys rồi Set key lại.");
  } else if (status === 403) {
    toast(`403 — key thiếu quyền: ${(json && json.error) || "scope không đủ"}. Tạo key có đúng scope.`);
  }
  if (typeof setKeyBadge === "function") setKeyBadge("bad", "key lỗi");
}
window.fetch = function (input, init) {
  const url = typeof input === "string" ? input : (input && input.url) || "";
  const needsAuth = AUTH_PATHS.some((p) => url.includes(p));
  if (needsAuth && ACTIVE_API_KEY) {
    init = init || {};
    const headers = new Headers(init.headers || {});
    if (!headers.has("Authorization")) headers.set("Authorization", "Bearer " + ACTIVE_API_KEY);
    init.headers = headers;
  }
  const p = _origFetch(input, init);
  if (needsAuth) {
    p.then((res) => {
      if (res.status === 401 || res.status === 403) {
        res.clone().json().catch(() => ({})).then((j) => authFailToast(res.status, j));
      }
    }).catch(() => {});
  }
  return p;
};

/* ── Xác thực key + badge trạng thái ─────────────────────────── */
async function verifyKey(key) {
  const res = await _origFetch("/v1/keys/verify", { headers: { Authorization: "Bearer " + key } });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}
function setKeyBadge(state, label) {
  const b = $("#keyStatusBadge");
  if (!b) return;
  if (!state) { b.hidden = true; b.textContent = ""; return; }
  b.hidden = false;
  b.className = "key-status " + state;
  b.textContent = label;
}
async function ensureKey() {
  setKeyBadge("check", "đang kiểm tra…");
  if (ACTIVE_API_KEY) {
    const r = await verifyKey(ACTIVE_API_KEY);
    if (r.ok && r.json.valid) {
      setKeyBadge("ok", "✓ " + (r.json.name || "key hợp lệ"));
      return;
    }
    // key đã lưu nhưng không hợp lệ (cũ/sai/đã revoke) → tự thay bằng demo key mới
  }
  // Tự tạo demo key đủ scope — user không cần tạo/dán key thủ công
  try {
    const sRes = await _origFetch("/v1/keys/_/scopes");
    const sJson = await sRes.json().catch(() => ({ data: [] }));
    const scopes = (sJson.data && sJson.data.length) ? sJson.data : ["chat", "endpoints", "batch", "byom", "playground"];
    const name = "demo-" + Date.now().toString(36);
    const res = await _origFetch("/v1/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, scopes }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.full_key) {
      ACTIVE_API_KEY = json.full_key;
      localStorage.setItem("fptDdiKey", json.full_key);
      const inp = $("#apiKeyInput");
      if (inp) { inp.value = json.full_key; inp.style.borderColor = "var(--nv)"; }
      setKeyBadge("ok", "✓ " + (json.name || "demo key"));
      toast("Đã tự tạo demo key đủ scope — sẵn sàng dùng, không cần dán key.");
    } else {
      setKeyBadge("bad", "không tạo được key");
      toast("Không tự tạo được demo key — tạo thủ công ở tab API Keys.");
    }
  } catch (e) {
    setKeyBadge("bad", "lỗi");
    toast("Không tự tạo được demo key: " + e.message);
  }
}

/* ── Mock data ─────────────────────────────── */
const DATA = {
  partners: [
    { name: "FPT.AI", models: 14, top: "FPT-LLM 8B (vi)", share: 22, integration: "Native", status: "active", contact: "ai-partners@fpt.com", since: "2024-03", note: "Flagship Vietnamese LLM family. Tightest latency integration in catalog." },
    { name: "Qwen (Alibaba)", models: 9, top: "Qwen3-235B-A22B", share: 18, integration: "vLLM + OpenAI API", status: "active", contact: "partners@qwen.org", since: "2024-07", note: "Highest-volume open-weights family. Batch discount program applies." },
    { name: "Meta Llama", models: 6, top: "Llama-3.3-70B", share: 15, integration: "Triton + vLLM", status: "active", contact: "llama-ops@meta.com", since: "2024-05", note: "Community license verified for all deployment sizes." },
    { name: "DeepSeek", models: 4, top: "DeepSeek-R1", share: 11, integration: "SGLang", status: "active", contact: "bd@deepseek.com", since: "2025-02", note: "Reasoning workloads. Long-context KV cache tuning in progress." },
    { name: "Mistral AI", models: 5, top: "Mistral-Large-2", share: 8, integration: "vLLM", status: "trialing", contact: " partnerships@mistral.ai", since: "2026-06", note: "Trial for EU-headquartered customers in Vietnam." },
    { name: "Cohere", models: 3, top: "Command-R+", share: 5, integration: "Pending", status: "on hold", contact: "apac@cohere.com", since: "2026-07", note: "On hold pending enterprise compliance pack (SOC2 scope review)." },
    { name: "Zhipu GLM", models: 4, top: "GLM-4.6", share: 6, integration: "vLLM", status: "active", contact: "bd@zhipuai.ai", since: "2025-09", note: "Strong coding + agent benchmarks. Growing in dev-tool segment." },
    { name: "VinAI", models: 3, top: "PhoGPT-4B", share: 4, integration: "Native", status: "active", contact: "api@vinai.io", since: "2024-11", note: "Vietnamese specialist models for on-prem edge deployments." }
  ],

  endpoints: [
    { name: "qwen3-235b-a22b", model: "Qwen3-235B-A22B", gpu: "H200", region: "SGN-1", tpm: "1.82M", p95: 212, rep: "6/6", cost: "18.40", status: "running" },
    { name: "fpt-llm-8b-vi", model: "FPT-LLM 8B (vi)", gpu: "L40S", region: "HAN-1", tpm: "960K", p95: 118, rep: "4/4", cost: "4.10", status: "running" },
    { name: "llama-3.3-70b", model: "Llama-3.3-70B", gpu: "H100", region: "HAN-1", tpm: "1.24M", p95: 189, rep: "5/6", cost: "12.75", status: "running" },
    { name: "deepseek-r1", model: "DeepSeek-R1", gpu: "H200", region: "SGN-1", tpm: "415K", p95: 640, rep: "3/4", cost: "9.60", status: "degraded" },
    { name: "glm-4.6", model: "GLM-4.6", gpu: "H100", region: "HAN-2", tpm: "702K", p95: 246, rep: "4/4", cost: "8.50", status: "running" },
    { name: "phogpt-4b", model: "PhoGPT-4B", gpu: "A30", region: "HAN-2", tpm: "184K", p95: 96, rep: "1/2", cost: "1.20", status: "paused" },
    { name: "command-r-plus", model: "Command-R+", gpu: "H100", region: "SGN-1", tpm: "52K", p95: 310, rep: "1/2", cost: "6.30", status: "paused" }
  ],

  gpus: [
    { name: "H100 SXM", nodes: 24, util: 71, state: "Allocated", note: "Primary production accelerator" },
    { name: "H200 SXM", nodes: 12, util: 64, state: "Allocated", note: "Large-context + reasoning workloads" },
    { name: "B300", nodes: 6, util: 38, state: "Pilot", note: "Phase-2 premium tier, enterprise reserved" },
    { name: "A30", nodes: 18, util: 52, state: "Allocated", note: "Entry-point tier for SMEs" }
  ],

  nodes: [
    { node: "hn1-gpu-014", gpu: "H100 ×8", region: "HAN-1", util: 78, tenant: "BFSI — VietBank", status: "running" },
    { node: "hn1-gpu-021", gpu: "H200 ×8", region: "HAN-1", util: 66, tenant: "Mid-tech — FinSaaS JSC", status: "running" },
    { node: "hn2-gpu-003", gpu: "A30 ×8", region: "HAN-2", util: 54, tenant: "Shared — serverless pool", status: "running" },
    { node: "sg1-gpu-007", gpu: "H200 ×8", region: "SGN-1", util: 92, tenant: "BFSI — SaigonInsurance", status: "running" },
    { node: "sg1-gpu-009", gpu: "H100 ×8", region: "SGN-1", util: 88, tenant: "Retail — MegaMart VN", status: "running" },
    { node: "sg1-gpu-011", gpu: "B300 ×8", region: "SGN-1", util: 24, tenant: "Reserved — Phase 2 pilot", status: "maint" },
    { node: "hn2-gpu-006", gpu: "A30 ×8", region: "HAN-2", util: 12, tenant: "Unallocated", status: "paused" }
  ],

  nvPrograms: [
    { tag: "NCP", title: "NVIDIA Cloud Partner", body: "Certified cloud partner since 2025. DDI fleet eligible for NVIDIA enterprise support and early-release drivers.", stats: [["Tier", "Certified"], ["Renewal", "2027-01"]] },
    { tag: "AI FACTORY", title: "FPT AI Factory", body: "$200M joint investment with NVIDIA. 43 cloud AI services launched on Green architecture.", stats: [["Investment", "$200M"], ["Services", "43"]] },
    { tag: "NGC", title: "NGC Catalog Access", body: "Private registry mirror in Vietnam for containerized AI workloads — NGC containers serve from HAN-2.", stats: [["Mirror", "HAN-2"], ["Containers", "118"]] },
    { tag: "NIM", title: "NVIDIA NIM Rollout", body: "NIM microservices bundled with dedicated deployments for BFSI customers in compliance mode.", stats: [["Pilots", "3"], ["GA", "Phase 2"]] }
  ],

  nvContacts: [
    { name: "Alan Tsai", role: "Alliance Manager, NVIDIA APAC" },
    { name: "Priya Nair", role: "Cloud Partner Engineering" },
    { name: "Minh Vo", role: "FPT × NVIDIA Program Office" }
  ],

  nvTimeline: [
    { date: "SEP 2026", text: "B300 nodes enter enterprise pilot" },
    { date: "NOV 2026", text: "NIM microservices GA for BFSI tier" },
    { date: "Q1 2027", text: "GB200 rack evaluation with AI Factory team" },
    { date: "2027", text: "Multi-region ASEAN expansion review" }
  ],

  attention: [
    { sev: "high", text: "sg1-gpu-007 at 92% utilization — capacity review needed before Retail peak season (Nov)." },
    { sev: "high", text: "Cohere integration on hold — SOC2 scope letter outstanding for 12 days." },
    { sev: "med", text: "deepseek-r1 endpoint degraded — p95 at 640 ms, above 300 ms target." },
    { sev: "low", text: "H200/B300 list pricing still awaiting final approval before Phase 2 launch." }
  ],

  activity: [
    { time: "09:42", text: "<b>Qwen3-235B-A22B</b> scaled to 6 replicas on SGN-1" },
    { time: "09:15", text: "<b>Mistral AI</b> trial endpoint deployed for EU-customer evaluation" },
    { time: "08:50", text: "<b>NVIDIA NIM</b> bundle passed compliance review for BFSI tier" },
    { time: "08:31", text: "New savings plan committed — <b>FinSaaS JSC</b>, 6-month H200 reservation" },
    { time: "07:58", text: "<b>GLM-4.6</b> added to the serverless catalog (HAN-2)" }
  ],

  milestones: [
    { date: "SEP 30", text: "Phase 1 exit review — 10 pilot customers, 20 models" },
    { date: "OCT 15", text: "Data residency certification audit (Decree 13/2023)" },
    { date: "NOV 01", text: "Retail peak-season capacity freeze" },
    { date: "Q1 2027", text: "Phase 2 launch — H200/B300 general availability" }
  ],

  regions: [
    { name: "Hanoi — HAN-1", detail: "Primary · AI Factory campus", cap: "24 nodes · 99.95%" },
    { name: "Hanoi — HAN-2", detail: "Secondary · NGC mirror + A30 pool", cap: "14 nodes · 99.9%" },
    { name: "Ho Chi Minh — SGN-1", detail: "Expansion · H200/B300 tier", cap: "10 nodes · 99.9%" }
  ],

  maintenance: [
    { name: "hn1-gpu-018 — firmware patch", detail: "Sep 12 · 02:00–04:00 ICT" },
    { name: "SGN-1 network fabric upgrade", detail: "Sep 21 · 01:00–05:00 ICT" },
    { name: "NGC mirror sync window", detail: "Weekly · Sunday 03:00 ICT" }
  ],

  dedicated: [
    { name: "fraud-detect-bfsi", model: "FPT-LLM 8B (vi)", gpu: "H100", mode: "k8s", region: "HAN-1", rep: "3/8", rate: "5.48", commit: "91-180", status: "running" },
    { name: "qwen3-235b-reserved", model: "Qwen3-235B-A22B", gpu: "H200", mode: "k8s", region: "SGN-1", rep: "6/6", rate: "18.08", commit: "7-30", status: "running" },
    { name: "phogpt-edge", model: "PhoGPT-4B", gpu: "A30", mode: "container", region: "HAN-2", rep: "2/2", rate: "0.90", commit: "on-demand", status: "running" },
    { name: "glm-coding-ded", model: "GLM-4.6", gpu: "H100", mode: "container", region: "HAN-1", rep: "4/4", rate: "2.50", commit: "on-demand", status: "running" }
  ],

  /* ── Gap features (vs Together AI) ─────────── */

  // Gap #12/#13/#14/#15 — Model catalog: frontier + long context + multi-modal + BYOM
  catalog: [
    { model: "Llama 4 Maverick", vendor: "Meta", ctx: "524K", modal: "text+vision", size: "400B MoE", status: "new", note: "Frontier multimodal, long context" },
    { model: "Llama 4 Scout", vendor: "Meta", ctx: "327K", modal: "text+vision", size: "109B MoE", status: "new", note: "Faster sibling of Maverick" },
    { model: "DeepSeek V4 Pro", vendor: "DeepSeek", ctx: "512K", modal: "text", size: "685B", status: "new", note: "384K output window, reasoning" },
    { model: "DeepSeek V4 Pro 0813", vendor: "DeepSeek", ctx: "512K", modal: "text", size: "685B", status: "new", note: "Latest reasoning refresh" },
    { model: "Qwen 3.8-Max", vendor: "Alibaba", ctx: "1M", modal: "text", size: "2.4T-A95B", status: "new", note: "Largest open-weights, 1M ctx" },
    { model: "Qwen 3.7 Plus", vendor: "Alibaba", ctx: "1M", modal: "text", size: "118B", status: "active", note: "1M context budget tier" },
    { model: "GLM-5.3", vendor: "Zhipu", ctx: "1M", modal: "text+code", size: "355B", status: "new", note: "Coding + agent benchmarks" },
    { model: "GLM-5.2", vendor: "Zhipu", ctx: "256K", modal: "text+code", size: "320B", status: "active", note: "Stable coding workhorse" },
    { model: "Kimi K3", vendor: "Moonshot", ctx: "256K", modal: "text", size: "671B", status: "active", note: "Agentic long-horizon" },
    { model: "MiniMax M3", vendor: "MiniMax", ctx: "1M", modal: "text+audio", size: "456B", status: "active", note: "1M ctx, voice-native" },
    { model: "Nemotron 3.5 Lightning", vendor: "NVIDIA", ctx: "128K", modal: "text", size: "49B", status: "new", note: "Dedicated-only, low latency" },
    { model: "Cogito v2.1", vendor: "DeepCognito", ctx: "256K", modal: "text", size: "671B", status: "new", note: "Reasoning + agentic" },
    { model: "Muse Glimmer 30B", vendor: "Meta", ctx: "128K", modal: "image", size: "30B", status: "new", note: "Image generation" },
    { model: "Whisper Large v3", vendor: "OpenAI", ctx: "—", modal: "audio", size: "1.5B", status: "active", note: "Speech-to-text" },
    { model: "Pika Video v2", vendor: "Pika", ctx: "—", modal: "video", size: "—", status: "new", note: "Text-to-video generation" },
    { model: "FPT-LLM 8B (vi)", vendor: "FPT.AI", ctx: "128K", modal: "text", size: "8B", status: "active", note: "Vietnamese specialist" },
    { model: "PhoGPT-4B", vendor: "VinAI", ctx: "64K", modal: "text", size: "4B", status: "active", note: "Edge Vietnamese model" },
    { model: "Gemma 4 31B", vendor: "Google", ctx: "256K", modal: "text", size: "31B", status: "active", note: "Efficient open weights" }
  ],

  // Gap #7 — Fine-tuning: LoRA / full / DPO + one-click deploy
  fineTune: [
    { job: "ft-bfsi-fraud-v3", base: "FPT-LLM 8B (vi)", method: "LoRA", status: "deployed", target: "fraud-detect-bfsi", cost: "1.92", progress: 100, note: "One-click deployed to dedicated" },
    { job: "ft-coding-glm", base: "GLM-5.2", method: "Full", status: "running", target: "—", cost: "28.40", progress: 64, note: "Multi-node training, 4 H100" },
    { job: "ft-rag-qwen", base: "Qwen 3.7 Plus", method: "DPO", status: "running", target: "—", cost: "6.10", progress: 38, note: "Preference alignment for RAG" },
    { job: "ft-vi-llama", base: "Llama 3.3 70B", method: "LoRA", status: "queued", target: "—", cost: "0.00", progress: 0, note: "Queued — awaiting GPU allocation" }
  ],
  ftPricing: [
    { method: "LoRA", small: "0.48", mid: "1.20", large: "2.40", note: "Cheapest, most common" },
    { method: "Full", small: "2.00", mid: "4.80", large: "8.00", note: "Full weight update" },
    { method: "DPO", small: "0.54", mid: "1.34", large: "2.69", note: "+~12% over LoRA" }
  ],

  // Gap #6 — Batch API: async, -50%
  batch: [
    { job: "batch-rag-ingest", model: "GLM-5.2", requests: "48,200", status: "completed", submitted: "Aug 21 02:10", window: "3h 12m", savings: "−52%" },
    { job: "batch-label-fraud", model: "FPT-LLM 8B (vi)", requests: "12,800", status: "running", submitted: "Aug 22 01:45", window: "—", savings: "−50%" },
    { job: "batch-translation", model: "Qwen 3.7 Plus", requests: "50,000", status: "running", submitted: "Aug 22 03:02", window: "—", savings: "−50%" },
    { job: "batch-summarize", model: "DeepSeek V4 Pro", requests: "8,400", status: "queued", submitted: "Aug 22 06:30", window: "—", savings: "−50%" }
  ],

  // Gap #4/#5 — SLA + PTU
  sla: {
    uptime: "99.9%",
    creditTiers: [
      { below: "99.9", credit: "10%", desc: "Below committed uptime" },
      { below: "99.0", credit: "25%", desc: "Material downtime" },
      { below: "95.0", credit: "50%", desc: "Major incident" }
    ]
  },
  ptu: [
    { plan: "BFSI — VietBank", model: "FPT-LLM 8B (vi)", tpm: "120K", rate: "6.00", commit: "91–180d", status: "active" },
    { plan: "Retail — MegaMart", model: "GLM-5.2", tpm: "200K", rate: "10.00", commit: "31–90d", status: "active" },
    { plan: "FinSaaS — Tier", model: "Qwen 3.7 Plus", tpm: "350K", rate: "17.50", commit: "7–30d", status: "trialing" }
  ],

  // Gap #31/#32 — Experiments: A/B + shadow
  experiments: [
    { name: "fraud-model-ab", type: "A/B", control: "FPT-LLM 8B (vi)", variants: 4, traffic: "control 50% / 4×12.5%", status: "running", note: "Ramp variant #2 to 25%" },
    { name: "rag-rewrite-shadow", type: "Shadow", control: "GLM-5.2", variants: 1, traffic: "mirror, not served", status: "running", note: "Safe rollout eval" },
    { name: "coding-glm-vs-qwen", type: "A/B", control: "GLM-5.2", variants: 1, traffic: "50/50", status: "promoted", note: "Variant promoted to prod" },
    { name: "vi-llama-eval", type: "Shadow", control: "FPT-LLM 8B (vi)", variants: 3, traffic: "mirror, not served", status: "paused", note: "Paused for dataset refresh" }
  ],

  // Gap #26 — Public pricing (transparent GPU/hr)
  pricingTiers: [
    { gpu: "A30", onDemand: "0.90", d730: "0.82", d3190: "—", d180: "—", hyperscaler: "n/a", note: "Entry — SME" },
    { gpu: "H100", onDemand: "2.50", d730: "2.28", d3190: "2.10", d180: "1.83", hyperscaler: "6.16", note: "Primary production" },
    { gpu: "H200", onDemand: "3.30", d730: "3.00", d3190: "2.77", d180: "2.41", hyperscaler: "7.91", note: "Long context + reasoning" },
    { gpu: "B300", onDemand: "5.50", d730: "5.01", d3190: "4.63", d180: "4.04", hyperscaler: "—", note: "Premium, reserved" }
  ],

  // Gap #30 — Social proof
  customers: [
    { name: "VietBank", sector: "BFSI" },
    { name: "SaigonInsurance", sector: "BFSI" },
    { name: "FinSaaS JSC", sector: "FinTech" },
    { name: "MegaMart VN", sector: "Retail" },
    { name: "Mobifone", sector: "Telco" },
    { name: "Hanoi Med", sector: "Healthcare" }
  ],

  // Gap #10 — GPU clusters (bare-metal + InfiniBand) + #25 multi-region + #36 headroom
  clusters: [
    { name: "hn1-baremetal-01", gpu: "H100 ×8", fabric: "InfiniBand 400G", region: "HAN-1", util: 74, status: "running", tenant: "Training — BFSI fraud" },
    { name: "sg1-baremetal-03", gpu: "H200 ×8", fabric: "InfiniBand 400G", region: "SGN-1", util: 41, status: "running", tenant: "Multi-node training" },
    { name: "jp1-cluster-01", gpu: "B300 ×8", fabric: "NVLink + IB", region: "JP-1", util: 12, status: "pilot", tenant: "Reserved — JP pilot" }
  ],
  regionsExtra: [
    { name: "Hanoi — HAN-1", detail: "Primary · AI Factory campus", cap: "24 nodes · 99.95%", status: "active" },
    { name: "Hanoi — HAN-2", detail: "Secondary · NGC mirror + A30 pool", cap: "14 nodes · 99.9%", status: "active" },
    { name: "Ho Chi Minh — SGN-1", detail: "Expansion · H200/B300 tier", cap: "10 nodes · 99.9%", status: "active" },
    { name: "Japan — JP-1", detail: "Phase 3 · ASEAN expansion", cap: "8 nodes · 99.9%", status: "pilot" },
    { name: "Korea — KR-1", detail: "Phase 3 · planned", cap: "— · planned", status: "planned" }
  ],

  // Gap #24 — CLI
  cli: {
    install: "curl -fsSL https://fpt.ai/ddi/install.sh | sh",
    installPip: "pipx install fpt-ddi",
    installBrew: "brew install fpt-ai/tap/fpt-ddi",
    cmds: [
      { cmd: "fpt ddi auth login", desc: "Authenticate via FPT ID or API key" },
      { cmd: "fpt ddi configure", desc: "Set default region, project, output format" },
      { cmd: "fpt ddi endpoint list", desc: "List dedicated endpoints" },
      { cmd: "fpt ddi endpoint create --model llama-4-maverick --gpu H100 --replicas 2", desc: "Create a dedicated endpoint" },
      { cmd: "fpt ddi endpoint scale --name fraud-bfsi --replicas 4", desc: "Scale replica count" },
      { cmd: "fpt ddi endpoint logs --name fraud-bfsi --tail", desc: "Stream endpoint logs" }
    ],
    cmds2: [
      { cmd: "fpt ddi batch submit --file jobs.jsonl", desc: "Submit a batch job (−50% pricing)" },
      { cmd: "fpt ddi batch status --job batch-rag-ingest", desc: "Track batch progress" },
      { cmd: "fpt ddi ft start --base glm-5.2 --method lora", desc: "Start a fine-tune job" },
      { cmd: "fpt ddi ft deploy --job ft-bfsi-fraud-v3", desc: "One-click deploy FT model → endpoint" },
      { cmd: "fpt ddi cluster create --gpu H200 --nodes 4", desc: "Provision a bare-metal cluster" },
      { cmd: "fpt ddi headroom --gpu H100 --region HAN-1", desc: "Query capacity headroom" }
    ]
  },

  // Gap #35 — Agent skills
  agentSkills: [
    { name: "fpt-ddi-endpoint-ops", desc: "Agent tự list/run/scale/stop dedicated endpoints", status: "available", invocations: 12842, lastRun: "2m ago", invokeAction: "endpoint list" },
    { name: "fpt-ddi-batch-runner", desc: "Agent gửi & theo dõi batch job, cảnh báo khi xong", status: "available", invocations: 4910, lastRun: "14m ago", invokeAction: "batch submit demo.jsonl" },
    { name: "fpt-ddi-ft-pipeline", desc: "Agent chạy fine-tune → deploy lên dedicated", status: "beta", invocations: 612, lastRun: "1h ago", invokeAction: "ft start --base glm-5.2 --method lora" },
    { name: "fpt-ddi-cost-watch", desc: "Agent giám sát burn rate & đề xuất commit term", status: "beta", invocations: 178, lastRun: "3h ago", invokeAction: "cost report" },
    { name: "fpt-ddi-capacity-planner", desc: "Agent đo headroom & gợi ý region/GPU tối ưu", status: "available", invocations: 2093, lastRun: "27m ago", invokeAction: "headroom --gpu H100" },
    { name: "fpt-ddi-experiment-runner", desc: "Agent chạy A/B test, ramp & promote variant", status: "beta", invocations: 88, lastRun: "yesterday", invokeAction: "experiment start --ab fraud-model-ab" }
  ],

  // Gap #36 — Headroom API (capacity per region)
  headroom: [
    { region: "HAN-1", h100: 6, h200: 2, b300: 0, a30: 11, status: "active",   note: "H100 headroom for burst" },
    { region: "HAN-2", h100: 3, h200: 0, b300: 0, a30: 5,  status: "active",   note: "A30 pool available" },
    { region: "SGN-1", h100: 2, h200: 4, b300: 2, a30: 0,  status: "active",   note: "H200/B300 reserved tier" },
    { region: "JP-1", h100: 0, h200: 0, b300: 6, a30: 0,  status: "pilot",    note: "Pilot — B300 only" }
  ],

  // SDK code samples ( showcases OpenAI-compat + 4 native SDKs )
  sdk: {
    openai: `# Drop-in for any OpenAI SDK — point at FPT DDI
from openai import OpenAI
client = OpenAI(
    base_url="https://api.ddi.fpt.vn/v1",
    api_key="ddi-••••••••••••••••••••••••••••••"
)
resp = client.chat.completions.create(
    model="llama-4-maverick",
    messages=[{"role": "user", "content": "Xin chào!"}],
    stream=True
)`,
    python: `from fpt_ddi import DDI

client = DDI.from_env()

ep = client.endpoints.create(
    name="fraud-detect-bfsi",
    model="llama-4-maverick",
    gpu="H100",
    replicas=(1, 4),
    region="HAN-1",
)
stream = client.chat.stream(
    endpoint=ep.name,
    messages=[{"role": "user", "content": "Bạn có khỏe không?"}],
)
for chunk in stream:
    print(chunk.choices[0].delta.content, end="", flush=True)`,
    typescript: `import { DDI } from "@fpt-ddi/sdk";

const ddi = new DDI({ apiKey: process.env.FPT_DDI_KEY });

const ep = await ddi.endpoints.create({
  name: "fraud-detect-bfsi",
  model: "llama-4-maverick",
  gpu: "H100",
  replicas: [1, 4],
  region: "HAN-1",
});

const stream = await ddi.chat.stream({
  endpoint: ep.name,
  messages: [{ role: "user", content: "Bạn có khỏe không?" }],
});
for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? "");
}`,
    go: `package main

import (
    "context"
    "fmt"
    "fpt.ai/ddi-go"
)

func main() {
    client := ddi.New(os.Getenv("FPT_DDI_KEY"))
    ctx := context.Background()
    ep, _ := client.Endpoints.Create(ctx, &ddi.EndpointSpec{
        Name:  "fraud-detect-bfsi",
        Model: "llama-4-maverick",
        GPU:   "H100",
        Region: "HAN-1",
    })
    fmt.Printf("endpoint %s is %s", ep.Name, ep.Status)
}`,
    rust: `use fpt_ddi::DDI;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = DDI::from_env()?;

    let ep = client
        .endpoints()
        .create("fraud-detect-bfsi", "llama-4-maverick", "H100")
        .region("HAN-1")
        .send()
        .await?;

    println!("endpoint {} is {}", ep.name, ep.status);
    Ok(())
}`
  },

  docs: [
    { title: "Quickstart", desc: "Deploy your first endpoint in 5 minutes", url: "docs.ddi.fpt.vn/quickstart" },
    { title: "API reference", desc: "REST + streaming + batch + fine-tune", url: "docs.ddi.fpt.vn/api" },
    { title: "OpenAI compatibility", desc: "Migrate from OpenAI / Together in ≤1 line", url: "docs.ddi.fpt.vn/openai-compat" },
    { title: "Data residency", desc: "Nghị định 13/2023 — in-country storage & egress", url: "docs.ddi.fpt.vn/residency" },
    { title: "CLI reference", desc: "Every fpt-ddi command", url: "docs.ddi.fpt.vn/cli" },
    { title: "Webhooks & events", desc: "Endpoint lifecycle, batch, fine-tune events", url: "docs.ddi.fpt.vn/webhooks" }
  ],

  // API keys — scoped & revocable with audit trail
  apiKeys: [
    { name: "prod-server", keyPrefix: "ddi-live-a91f2c", scopes: ["chat", "endpoints", "batch"], created: "2026-06-12", lastUsed: "just now", status: "active" },
    { name: "dev-local", keyPrefix: "ddi-live-3b8e07", scopes: ["chat", "playground"], created: "2026-08-01", lastUsed: "2h ago", status: "active" },
    { name: "ci-runner", keyPrefix: "ddi-live-7c4d1a", scopes: ["endpoints"], created: "2026-07-22", lastUsed: "yesterday", status: "active" },
    { name: "legacy-mobile", keyPrefix: "ddi-live-0e2f5b", scopes: ["chat"], created: "2025-12-04", lastUsed: "120 days ago", status: "revoked" }
  ],
  apiKeyScopes: ["chat", "endpoints", "batch", "byom", "fine-tune", "clusters", "playground", "billing", "admin"],

  // US-01 — NVIDIA NIM model catalog (fallback khi GET /v1/catalog lỗi)
  nimCatalog: [
    { id: "nim-deepseek-coder-33b", name: "DeepSeek-Coder-33B", family: "llm", segments: ["coding"], source: "nim", nimVersion: "25.01", gpuCompatible: ["H100", "H200", "A30"], maxContext: 16384, quantizations: ["bf16", "fp8"], status: "available" },
    { id: "nim-llama-3-3-70b", name: "Llama-3.3-70B", family: "llm", segments: ["general", "coding"], source: "nim", nimVersion: "25.02", gpuCompatible: ["H100", "H200"], maxContext: 131072, quantizations: ["bf16", "fp8", "awq"], status: "available" },
    { id: "nim-qwen-coder-32b", name: "Qwen-Coder-32B", family: "llm", segments: ["coding"], source: "nim", nimVersion: "25.01", gpuCompatible: ["H100", "H200", "A30"], maxContext: 32768, quantizations: ["bf16", "fp8"], status: "available" }
  ],

  // US-05 — Audit trail (fallback khi GET /v1/audit lỗi / thiếu scope admin)
  auditLog: [
    { id: "aud-9012", ts: "2026-08-25T06:00:00Z", actor: "thuan@fpt.ai", role: "admin", action: "endpoint.create", entityId: "ep-1234", entityType: "endpoint", result: "success", ip: "203.113.1.24" },
    { id: "aud-9011", ts: "2026-08-25T05:58:00Z", actor: "thuan@fpt.ai", role: "admin", action: "key.create", entityId: "key-8f3a", entityType: "key", result: "success", ip: "203.113.1.24" },
    { id: "aud-9010", ts: "2026-08-25T05:40:00Z", actor: "ops-bot", role: "operator", action: "endpoint.guardrails", entityId: "ep-1234", entityType: "endpoint", result: "success", ip: "10.0.0.9" },
    { id: "aud-9009", ts: "2026-08-25T05:12:00Z", actor: "thuan@fpt.ai", role: "admin", action: "key.revoke", entityId: "key-1b2c", entityType: "key", result: "success", ip: "203.113.1.24" },
    { id: "aud-9008", ts: "2026-08-25T04:30:00Z", actor: "ops-bot", role: "operator", action: "endpoint.create", entityId: "ep-0987", entityType: "endpoint", result: "failure", ip: "10.0.0.9" }
  ]
};

const GPU_BASE_RATE = { A30: 0.9, H100: 2.5, H200: 3.3, B300: 5.5 };
const COMMIT_MULT = { "on-demand": 1, "7-30": 0.91, "91-180": 0.73 };
const COMMIT_LABEL = { "on-demand": "On-demand", "7-30": "7–30d", "91-180": "91–180d" };

/* ── Helpers ───────────────────────────────── */
const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function statusLabel(s) {
  return { running: "Running", paused: "Paused", degraded: "Degraded", deploying: "Deploying", active: "Active", trialing: "Trialing", "on hold": "On hold", maint: "Maintenance", failed: "Failed", cancelled: "Cancelled", queued: "Queued", completed: "Completed", validating: "Validating", in_progress: "In progress", finalizing: "Finalizing" }[s] || s;
}

function utilBar(util) {
  const cls = util >= 85 ? "err" : util >= 70 ? "warn" : "";
  return `<div class="util-cell"><span class="util-bar"><i class="${cls}" style="width:${util}%"></i></span><span class="num">${util}%</span></div>`;
}

function toast(msg) {
  const box = $("#toasts");
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

/* ── Fleet ribbon (signature) ──────────────── */
function renderFleet() {
  const blocks = $("#fleetBlocks");
  const nodes = DATA.nodes;
  const utils = nodes.map((n) => n.util);
  const avg = utils.length ? Math.round(utils.reduce((a, b) => a + b, 0) / utils.length) : 0;
  blocks.innerHTML = nodes.map((n) => {
    const state = n.status === "paused" ? "idle" : n.util >= 85 ? "err" : n.util >= 70 ? "warn" : "ok";
    const h = 8 + Math.round((n.util / 100) * 22);
    return `<span class="fleet-block" data-state="${state}" style="height:${h}px" title="${esc(n.node)} · ${n.util}% · ${esc(n.tenant)}"></span>`;
  }).join("");
  $("#fleetMeta").textContent = `${nodes.length} nodes · ${avg}% util avg`;
}

/* ── Load toàn bộ data thật từ Postgres qua /v1/data/* ──
   Ghi đè các field DATA.* mock → dữ liệu thật; render functions giữ nguyên đọc DATA.* */
async function fetchJson(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function loadAllRealData() {
  const tasks = [
    ["partners", "/v1/data/partners", (r) => r.data],
    ["catalog", "/v1/data/catalog_models", (r) => r.data],
    ["endpoints", "/v1/data/serverless_endpoints", (r) => r.data],
    ["gpus", "/v1/data/gpu_cards", (r) => r.data],
    ["nodes", "/v1/data/nodes", (r) => r.data],
    ["nvPrograms", "/v1/data/nv_programs/_/formatted", (r) => r.data],
    ["nvContacts", "/v1/data/nv_contacts", (r) => r.data],
    ["nvTimeline", "/v1/data/nv_timeline", (r) => r.data],
    ["attention", "/v1/data/attention", (r) => r.data],
    ["activity", "/v1/data/activity", (r) => r.data],
    ["milestones", "/v1/data/milestones", (r) => r.data],
    ["regions", "/v1/data/regions", (r) => r.data],
    ["regionsExtra", "/v1/data/regions_extra", (r) => r.data],
    ["maintenance", "/v1/data/maintenance", (r) => r.data],
    ["clusters", "/v1/data/clusters", (r) => r.data],
    ["customers", "/v1/data/customers", (r) => r.data],
    ["fineTune", "/v1/data/ft_jobs", (r) => r.data],
    ["ftPricing", "/v1/data/ft_pricing", (r) => r.data],
    ["pricingTiers", "/v1/data/pricing_tiers", (r) => r.data],
    ["experiments", "/v1/data/experiments", (r) => r.data],
    ["headroom", "/v1/data/headroom", (r) => r.data],
    ["headroomStatus", "/v1/data/headroom", (r) => r.data],
    ["docs", "/v1/data/docs", (r) => r.data],
    ["agentSkills", "/v1/data/agent_skills", (r) => r.data.map((s) => ({
      name: s.name,
      desc: s.description,
      status: s.status,
      invocations: s.invocations || 0,
      lastRun: s.last_run || "—",
      invokeAction: s.name.includes("endpoint") ? "endpoint list" : s.name.includes("batch") ? "batch submit demo.jsonl" : s.name.includes("ft") ? "ft start" : s.name.includes("cost") ? "cost report" : s.name.includes("capacity") ? "headroom --gpu H100" : "experiment start",
    }))],
  ];
  // SLA + PTU + CLI phải format đặc biệt
  const special = [
    ["sla+ptu", "/v1/data/sla/_/full", (r) => {
      DATA.sla.uptime = r.data.uptime;
      DATA.sla.creditTiers = r.data.creditTiers;
      DATA.ptu = r.data.ptuPlans;
    }],
    ["cli", "/v1/data/cli/_/full", (r) => {
      DATA.cli.install = r.data.install;
      DATA.cli.installPip = r.data.installPip;
      DATA.cli.installBrew = r.data.installBrew;
      DATA.cli.cmds = r.data.cmds;
      DATA.cli.cmds2 = r.data.cmds2;
    }],
    ["sdk-openai", "/v1/data/sdk_samples", (r) => {
      const map = {};
      for (const row of r.data) map[row.language] = row.code;
      DATA.sdk.openai = map.openai || DATA.sdk.openai;
      DATA.sdk.python = map.python || DATA.sdk.python;
      DATA.sdk.typescript = map.typescript || DATA.sdk.typescript;
      DATA.sdk.go = map.go || DATA.sdk.go;
      DATA.sdk.rust = map.rust || DATA.sdk.rust;
    }],
  ];
  const all = [...tasks, ...special];
  await Promise.all(all.map(async ([field, path, apply]) => {
    try {
      const json = await fetchJson(path);
      if (field === "headroomStatus") {
        // giữ luôn
      } else if (field === "sla+ptu" || field === "cli" || field === "sdk-openai") {
        apply(json);
      } else {
        DATA[field] = apply(json);
      }
    } catch (e) {
      console.warn(`[data] load "${field}" lỗi:`, e.message);
    }
  }));
}


/* ── Overview ──────────────────────────────── */
function renderOverview() {
  $("#kpiPartners").textContent = DATA.partners.length;
  $("#kpiEndpoints").textContent = DATA.endpoints.length;
  const utils = DATA.nodes.map((n) => n.util);
  $("#kpiUtil").textContent = Math.round(utils.reduce((a, b) => a + b, 0) / utils.length) + "%";

  $("#attentionList").innerHTML = DATA.attention.map((a) =>
    `<li><span class="sev sev-${a.sev}">${a.sev.toUpperCase()}</span><span>${esc(a.text)}</span></li>`
  ).join("");

  $("#activityList").innerHTML = DATA.activity.map((a) =>
    `<li><span class="activity-time">${a.time}</span><span class="activity-text">${a.text}</span></li>`
  ).join("");

  $("#milestoneList").innerHTML = DATA.milestones.map((m) =>
    `<li><span class="mile-date">${esc(m.date)}</span><b>${esc(m.text)}</b></li>`
  ).join("");

  // Gap #30 — social proof (customer logos)
  $("#customerStrip").innerHTML = DATA.customers.map((c) =>
    `<span class="logo-chip"><b>${esc(c.name)}</b><em>${esc(c.sector)}</em></span>`
  ).join("");
}

/* ── NVIDIA view ───────────────────────────── */
function renderNvidia() {
  $("#nvPrograms").innerHTML = DATA.nvPrograms.map((p) => `
    <div class="card">
      <span class="card-tag">${esc(p.tag)}</span>
      <h3>${esc(p.title)}</h3>
      <p>${esc(p.body)}</p>
      <div class="card-stats">${p.stats.map(([k, v]) => `<div><b>${esc(v)}</b><span>${esc(k)}</span></div>`).join("")}</div>
    </div>`).join("");

  $("#nvContacts").innerHTML = DATA.nvContacts.map((c) => {
    const initials = c.name.split(" ").map((w) => w[0]).slice(0, 2).join("");
    return `<li><span class="avatar">${esc(initials)}</span><div><div class="contact-name">${esc(c.name)}</div><div class="contact-role">${esc(c.role)}</div></div></li>`;
  }).join("");

  $("#nvTimeline").innerHTML = DATA.nvTimeline.map((t) =>
    `<li><span class="mile-date">${esc(t.date)}</span><b>${esc(t.text)}</b></li>`
  ).join("");
}

/* ── Partners view ─────────────────────────── */
let partnerQuery = "";
let partnerFilter = "all";

function renderPartners() {
  const q = partnerQuery.trim().toLowerCase();
  const rows = DATA.partners.filter((p) => {
    const matchQ = !q || p.name.toLowerCase().includes(q) || p.top.toLowerCase().includes(q);
    const matchF = partnerFilter === "all" || p.status === partnerFilter;
    return matchQ && matchF;
  });

  $("#partnerRows").innerHTML = rows.map((p) => `
    <tr class="row-link" data-partner="${esc(p.name)}" tabindex="0">
      <td>${esc(p.name)}</td>
      <td class="num">${p.models}</td>
      <td>${esc(p.top)}</td>
      <td class="num">${p.share}%</td>
      <td>${esc(p.integration)}</td>
      <td><span class="status s-${esc(p.status)}">${statusLabel(p.status)}</span></td>
    </tr>`).join("");

  $("#partnerEmpty").hidden = rows.length > 0;
}

function openPartnerDrawer(name) {
  const p = DATA.partners.find((x) => x.name === name);
  if (!p) return;
  $("#drawerTitle").textContent = p.name;
  $("#drawerBody").innerHTML = `
    <h3>Integration</h3>
    <dl class="kv">
      <dt>Status</dt><dd><span class="status s-${esc(p.status)}">${statusLabel(p.status)}</span></dd>
      <dt>Models in catalog</dt><dd class="num">${p.models}</dd>
      <dt>Catalog share</dt><dd class="num">${p.share}%</dd>
      <dt>Serving stack</dt><dd>${esc(p.integration)}</dd>
      <dt>Partner since</dt><dd class="num">${esc(p.since)}</dd>
      <dt>Contact</dt><dd class="num">${esc(p.contact)}</dd>
    </dl>
    <h3>Notes</h3>
    <p style="font-size:13px;color:var(--ink-dim)">${esc(p.note)}</p>`;
  $("#drawer").hidden = false;
  $("#drawerOverlay").hidden = false;
  $("#drawerClose").focus();
}

function closeDrawer() {
  $("#drawer").hidden = true;
  $("#drawerOverlay").hidden = true;
}

/* ── Serverless view ───────────────────────── */
async function fetchServerlessTelemetry() {
  try {
    const r = await fetch("/v1/data/_/telemetry");
    if (!r.ok) throw new Error("HTTP " + r.status);
    const json = await r.json();
    return json.data;
  } catch (e) { return null; }
}

async function renderServerless() {
  const running = DATA.endpoints.filter((e) => e.status === "running").length;
  const paused = DATA.endpoints.length - running;
  const t = await fetchServerlessTelemetry() || {};
  const reqMin = t.reqMin || 0;
  const errRate = t.errRate || "—";
  const p95 = t.p95 || "—";

  $("#kpiReqMin").textContent = reqMin.toLocaleString("en-US");
  $("#kpiErrRate").textContent = errRate;
  $("#kpiP95").textContent = p95;
  $("#kpiRunning").textContent = `${running}/${DATA.endpoints.length}`;
  $("#kpiPaused").textContent = `${paused} paused`;

  $("#endpointRows").innerHTML = DATA.endpoints.map((e) => `
    <tr>
      <td class="num">${esc(e.name)}</td>
      <td>${esc(e.model)}</td>
      <td class="num">${esc(e.gpu)}</td>
      <td class="num">${esc(e.region)}</td>
      <td class="num">${esc(e.tpm)}</td>
      <td class="num">${e.p95} ms</td>
      <td class="num">${esc(e.rep)}</td>
      <td class="num">$${esc(e.cost)}</td>
      <td><span class="status s-${esc(e.status)}">${statusLabel(e.status)}</span></td>
      <td><button class="btn btn-ghost btn-sm" data-action="logs" data-name="${esc(e.name)}">Logs</button></td>
    </tr>`).join("");

  // Gap #33 — Prometheus-compatible metrics endpoint
  const epUrl = "https://metrics.ddi.fpt.vn/metrics";
  $("#promEpUrl").textContent = epUrl;
  const epStatus = ["edge", "router", "worker"];
  $("#promTargets").innerHTML = epStatus.map((t) =>
    `<span class="prom-target"><i class="prom-dot"></i>${esc(t)}</span>`
  ).join("");
}

/* ── Deploy workflow visualization ─────────── */
const WORKFLOWS = {
  k8s: [
    { t: "Validate config & generate manifests", o: "Auto", d: "Helm values from form: GPU, replicas, quantization", dur: "~1s" },
    { t: "Apply manifests to cluster", o: "Platform", d: "GitOps sync (ArgoCD) or kubectl apply", dur: "~2s" },
    { t: "Schedule pods on GPU node", o: "Platform", d: "nodeSelector + tolerations for GPU pool", dur: "~2s" },
    { t: "Init: pull model weights", o: "AI Eng", d: "Object storage VN → NVMe (data residency)", dur: "30–90s" },
    { t: "Start serving container", o: "AI Eng", d: "vLLM / SGLang image from private registry", dur: "~10s" },
    { t: "Load model + warmup", o: "AI Eng", d: "Startup probe until weights loaded & KV cache ready", dur: "1–3m" },
    { t: "Readiness pass → expose endpoint", o: "Platform", d: "Service + Ingress, TLS, API-key auth", dur: "~2s" },
    { t: "Running — serving traffic", o: "Auto", d: "Metrics on: TTFT, p95, GPU util, GPU-hours", dur: "" }
  ],
  container: [
    { t: "Validate config & generate spec", o: "Auto", d: "Container spec: image, port, restart policy", dur: "~1s" },
    { t: "Pull image + weights", o: "AI Eng", d: "Private registry + object storage VN", dur: "30–60s" },
    { t: "Start container + warmup", o: "AI Eng", d: "Startup probe until model ready", dur: "1–2m" },
    { t: "Expose & running", o: "Platform", d: "Port mapping, TLS, API-key auth", dur: "~2s" }
  ]
};
let wfTimer = null;

function renderWorkflow(mode, states, liveText) {
  const steps = WORKFLOWS[mode];
  $("#wfTitle").textContent = "Deploy workflow — " + (mode === "k8s" ? "Kubernetes" : "Container");
  $("#wfLive").textContent = liveText || "";
  $("#workflowList").innerHTML = steps.map((s, i) => {
    const st = states && states[i] ? states[i] : "pending";
    const ownerCls = s.o === "AI Eng" ? "ai" : s.o === "Platform" ? "plat" : "auto";
    return `<li class="wf-${st}">
      <div class="wf-step"><b>${esc(s.t)}</b><span class="owner ${ownerCls}">${esc(s.o)}</span>${s.dur ? `<span class="wf-dur">${esc(s.dur)}</span>` : ""}</div>
      <small>${esc(s.d)}</small>
    </li>`;
  }).join("");
}

function startWorkflow(mode, ep) {
  if (wfTimer) clearInterval(wfTimer);
  const steps = WORKFLOWS[mode];
  const states = steps.map(() => "pending");
  let i = 0;
  renderWorkflow(mode, states, `deploying ${ep.name}…`);
  wfTimer = setInterval(() => {
    if (i > 0) states[i - 1] = "done";
    if (i < steps.length) {
      states[i] = "active";
      i++;
      renderWorkflow(mode, states, `step ${i}/${steps.length} — ${steps[i - 1].t}`);
    } else {
      clearInterval(wfTimer);
      wfTimer = null;
      renderWorkflow(mode, states, "deploy succeeded");
      ep.status = "running";
      renderDedicated();
      toast(`Endpoint ${ep.name} is running`);
    }
  }, 1100);
}

/* ── Dedicated inference view ──────────────── */
let dedFilter = "all";
let dedicatedEndpoints = [];
let dedPollTimer = null;

async function fetchDedicated() {
  try {
    const res = await fetch("/v1/endpoints" + (dedFilter !== "all" ? `?mode=${dedFilter}` : ""));
    if (!res.ok) throw new Error("HTTP " + res.status);
    const json = await res.json();
    dedicatedEndpoints = json.data || [];
  } catch (e) {
    console.warn("[dedicated] fetch lỗi:", e.message);
    dedicatedEndpoints = [];
  }
  renderDedicated();
}

/* ── T4.2 — p95 cold-start thật (O4) — fetch /v1/metrics/cold-start + render ── */
let coldStartTimer = null;
let coldStartData = null;

async function fetchColdStart() {
  try {
    const r = await fetch("/v1/metrics/cold-start");
    if (!r.ok) throw new Error("HTTP " + r.status);
    coldStartData = await r.json();
  } catch (e) {
    console.warn("[cold-start] fetch lỗi:", e.message);
    coldStartData = null;
  }
  renderColdStart();
}

function renderColdStart() {
  const grid = $("#coldStartMetrics");
  if (!grid) return;
  const live = $("#coldStartLive");
  if (!coldStartData) {
    grid.innerHTML = `<p class="prom-note">Chưa có mẫu cold-start — playground preview pool chưa nhận request nào.</p>`;
    if (live) live.textContent = "idle";
    return;
  }
  const d = coldStartData;
  const p50 = (d.p50_ms ?? 0).toFixed(0);
  const p95 = (d.p95_ms ?? 0).toFixed(0);
  const p99 = (d.p99_ms ?? 0).toFixed(0);
  const max = (d.max_ms ?? 0).toFixed(0);
  const samples = d.samples ?? 0;
  const cls95 = p95 <= 200 ? "" : p95 <= 600 ? "warn" : "err";
  const cells = [
    { name: "samples", value: samples, tgt: "ring buffer 200" },
    { name: "p50 cold-start", value: p50 + " ms", tgt: "≤ 100 ms", cls: p50 <= 100 ? "" : "warn" },
    { name: "p95 cold-start (SLA public)", value: p95 + " ms", tgt: "≤ 200 ms (warm pool)", cls: cls95 },
    { name: "p99 cold-start", value: p99 + " ms", tgt: "≤ 600 ms (cold start)", cls: p99 <= 600 ? "" : "err" },
    { name: "max cold-start", value: max + " ms", tgt: "first-request warming", cls: "" },
  ];
  grid.innerHTML = cells.map((c) => `
    <div class="slo-cell">
      <span class="slo-name">${esc(c.name)}</span>
      <b class="mono${c.cls ? " " + c.cls : ""}">${esc(c.value)}</b>
      <span class="slo-tgt">target ${esc(c.tgt)}</span>
    </div>`).join("");
  if (live) {
    const ts = new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour12: false });
    live.textContent = `${samples} samples · ${ts}`;
  }
}

async function renderDedicated() {
  const rows = dedicatedEndpoints;
  const all = dedicatedEndpoints;
  const k8sCount = all.filter((d) => d.mode === "k8s").length;
  const gpus = all.reduce((sum, d) => sum + parseInt(String(d.replicas || "").split("/")[1] || "1", 10), 0);
  const burn = all.reduce((sum, d) => sum + parseFloat(d.rate || 0), 0);

  $("#kpiDedCount").textContent = all.length;
  $("#kpiDedModes").textContent = `${k8sCount} k8s · ${all.length - k8sCount} container`;
  $("#kpiDedGpus").textContent = gpus;
  $("#kpiDedRate").textContent = "$" + burn.toFixed(2);

  if (!rows.length) {
    $("#dedicatedRows").innerHTML = `<tr><td colspan="10" style="text-align:center;color:var(--ink-faint);padding:30px">Chưa có dedicated endpoint. Bấm "+ Create endpoint" để deploy.</td></tr>`;
  } else {
    $("#dedicatedRows").innerHTML = rows.map((d) => `
      <tr class="row-link" data-endpoint-id="${esc(d.id)}" tabindex="0">
        <td class="num">${esc(d.name)}</td>
        <td>${esc(d.model)}</td>
        <td class="num">${esc(d.gpu)}</td>
        <td><span class="mode-badge ${esc(d.mode)}">${d.mode === "k8s" ? "K8s" : "Container"}</span></td>
        <td class="num">${esc(d.region)}</td>
        <td class="num">${esc(d.replicas)}</td>
        <td class="num">$${esc(d.rate)}</td>
        <td class="num">${esc(d.commitLabel || d.commit)}</td>
        <td><span class="status s-${esc(d.status === "queued" ? "paused" : d.status === "deploying" ? "trialing" : d.status === "running" ? "running" : d.status === "stopped" ? "paused" : d.status)}">${statusLabel(d.status)}</span></td>
        <td>
          ${d.status === "running" ? `<button class="btn btn-ghost btn-sm" data-action="ded-stop" data-id="${esc(d.id)}">Stop</button>` : ""}
          ${d.status === "stopped" ? `<button class="btn btn-ghost btn-sm" data-action="ded-start" data-id="${esc(d.id)}">Start</button>` : ""}
          <button class="btn btn-ghost btn-sm" data-action="ded-del" data-id="${esc(d.id)}">Delete</button>
        </td>
      </tr>`).join("");
  }

  // Monitoring — metrics thật từ /metrics (aggregate theo time range) — mô phỏng Together.ai
  const running = all.filter((d) => d.status === "running");
  let sloCells = "";
  if (running.length) {
    // aggregate tổng từ endpoint running đầu tiên (có usage)
    const ep = running[0];
    try {
      const r = await fetch(`/v1/endpoints/${encodeURIComponent(ep.id)}/metrics?range=24h`);
      if (r.ok) {
        const t = (await r.json()).data?.totals || {};
        sloCells = `
          <div class="slo-cell"><span class="slo-name">Requests</span><b class="mono">${(t.requests ?? 0).toLocaleString("en-US")}</b><span class="slo-tgt">24h</span></div>
          <div class="slo-cell"><span class="slo-name">Errors</span><b class="mono">${t.errors ?? 0} <span style="color:${(t.error_rate ?? 0) > 5 ? "var(--danger,#e5484d)" : "inherit"}">(${(t.error_rate ?? 0)}%)</span></b><span class="slo-tgt">error rate</span></div>
          <div class="slo-cell"><span class="slo-name">Total tokens</span><b class="mono">${(t.total_tokens ?? 0).toLocaleString("en-US")}</b><span class="slo-tgt">${(t.tokens_per_sec ?? 0)} tok/s</span></div>
          <div class="slo-cell"><span class="slo-name">Latency avg</span><b class="mono">${t.avg_latency_ms ?? 0} ms</b><span class="slo-tgt">p50 ${t.p50 ?? 0}</span></div>
          <div class="slo-cell"><span class="slo-name">Latency p95</span><b class="mono">${t.p95 ?? 0} ms</b><span class="slo-tgt">p99 ${t.p99 ?? 0}</span></div>
          <div class="slo-cell"><span class="slo-name">Input tokens</span><b class="mono">${(t.prompt_tokens ?? 0).toLocaleString("en-US")}</b><span class="slo-tgt">output ${(t.completion_tokens ?? 0).toLocaleString("en-US")}</span></div>
          <div class="slo-cell"><span class="slo-name">Cost</span><b class="mono">$${t.cost_usd ?? "0.000000"}</b><span class="slo-tgt">24h</span></div>`;
      }
    } catch (_) {}
  }
  if (sloCells) {
    $("#sloMetrics").innerHTML = sloCells;
  } else {
    $("#sloMetrics").innerHTML = `<p class="prom-note">Tạo 1 endpoint và đợi tới trạng thái running để xem metrics (thật từ usage).</p>`;
  }
}

async function openEndpointDrawer(id) {
  const local = dedicatedEndpoints.find((e) => e.id === id);
  if (!local) return;
  $("#drawerTitle").textContent = local.name;

  let ep = local;
  try {
    const r = await fetch(`/v1/endpoints/${encodeURIComponent(id)}`);
    if (r.ok) { const j = await r.json(); if (j.data) ep = j.data; }
  } catch (_) {}

  const baseUrl = `${location.origin}/v1`;
  const endpointUrl = `${baseUrl}/endpoints/${ep.id}/chat/completions`;

  const evts = (ep.events || []).map((e) =>
    `<li style="display:flex;gap:10px;padding:5px 0;border-bottom:1px solid var(--line);font-size:12px;">
      <span class="mono" style="color:var(--nv);min-width:64px;">${esc(skillTime(e.at))}</span>
      <span style="color:var(--ink-dim);">${esc(e.from || "—")} → <b style="color:var(--ink)">${esc(e.to)}</b></span>
      <span style="color:var(--ink-faint);margin-left:auto;">${esc(e.msg || "")}</span>
    </li>`).join("");

  // Usage thật từ Postgres
  let usageHtml = "";
  try {
    const r = await fetch(`/v1/endpoints/${encodeURIComponent(id)}/usage`);
    if (r.ok) {
      const j = await r.json();
      const u = j.data?.totals || {};
      usageHtml = `
      <h3>Usage (thật)</h3>
      <dl class="kv">
        <dt>Requests</dt><dd class="num">${(u.requests ?? 0).toLocaleString("en-US")}</dd>
        <dt>Total tokens</dt><dd class="num">${(u.total_tokens ?? 0).toLocaleString("en-US")}</dd>
        <dt>Cost</dt><dd class="num">$${u.cost_usd ?? "0.000000"}</dd>
        <dt>Avg latency</dt><dd class="num">${u.avg_latency_ms ?? 0} ms</dd>
      </dl>`;
    }
  } catch (_) {}

  let metricsHtml = "";
  if (ep.status === "running") {
    try {
      const r = await fetch(`/v1/endpoints/${encodeURIComponent(id)}/metrics?range=24h`);
      if (r.ok) {
        const j = await r.json();
        const m = j.data?.totals || {};
        const tp = j.data?.throughput;
        const tpHtml = tp ? `
          <dt>Throughput</dt><dd class="num">${tp.tps} tok/s <span class="mono" style="color:var(--ink-faint)">(baseline ${tp.baseline_tps})</span></dd>
          <dt>Engine improvement</dt><dd class="num">${tp.improvement_pct >= 0 ? "+" : ""}${tp.improvement_pct}% vs vLLM</dd>` : "";
        metricsHtml = `
        <h3>Metrics (thật — 24h)</h3>
        <dl class="kv">
          <dt>Requests</dt><dd class="num">${(m.requests ?? 0).toLocaleString("en-US")}</dd>
          <dt>Error rate</dt><dd class="num">${m.error_rate ?? 0}% <span class="mono" style="color:var(--ink-faint)">(${m.errors ?? 0} err)</span></dd>
          <dt>Latency avg</dt><dd class="num">${m.avg_latency_ms ?? 0} ms</dd>
          <dt>Latency p95</dt><dd class="num">${m.p95 ?? 0} ms</dd>
          <dt>Latency p99</dt><dd class="num">${m.p99 ?? 0} ms</dd>
          <dt>Total tokens</dt><dd class="num">${(m.total_tokens ?? 0).toLocaleString("en-US")}</dd>
          <dt>Tokens / sec</dt><dd class="num">${m.tokens_per_sec ?? 0}</dd>
          <dt>Cost</dt><dd class="num">$${m.cost_usd ?? "0.000000"}</dd>
          ${tpHtml}
        </dl>`;
      }
    } catch (_) {}
  }

  // Code samples — copy được ngay
  const curlSample = `curl -X POST '${endpointUrl}' \\
  -H 'Authorization: Bearer $FPT_DDI_KEY' \\
  -H 'Content-Type: application/json' \\
  -d '{"model": "${esc(ep.model)}", "messages": [{"role": "user", "content": "Xin chào"}]}'`;
  const pySample = `from openai import OpenAI

client = OpenAI(
    base_url="${baseUrl}/endpoints/${ep.id}",
    api_key="ddi-live-..."  # API key của bạn
)
resp = client.chat.completions.create(
    model="${esc(ep.model)}",
    messages=[{"role": "user", "content": "Xin chào"}]
)
print(resp.choices[0].message.content)`;
  const jsSample = `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${baseUrl}/endpoints/${ep.id}",
  apiKey: process.env.FPT_DDI_KEY,
});
const resp = await client.chat.completions.create({
  model: "${esc(ep.model)}",
  messages: [{ role: "user", content: "Xin chào" }],
});
console.log(resp.choices[0].message.content);`;

  $("#drawerBody").innerHTML = `
    <h3>Thông tin endpoint</h3>
    <dl class="kv">
      <dt>ID</dt><dd class="num">${esc(ep.id)}</dd>
      <dt>Trạng thái</dt><dd><span class="status s-${esc(ep.status === "queued" ? "paused" : ep.status === "deploying" ? "trialing" : ep.status === "running" ? "running" : ep.status === "stopped" ? "paused" : ep.status)}">${statusLabel(ep.status)}</span></dd>
      <dt>Model</dt><dd>${esc(ep.model)}</dd>
      <dt>GPU</dt><dd class="num">${esc(ep.gpu)}</dd>
      <dt>Region</dt><dd class="num">${esc(ep.region)}</dd>
      <dt>Chế độ</dt><dd>${ep.mode === "k8s" ? "Kubernetes" : "Container"}</dd>
      <dt>Replicas</dt><dd class="num">${esc(ep.replicas)}</dd>
      <dt>Giá</dt><dd class="num">$${esc(ep.rate)}/hr</dd>
      <dt>Cam kết</dt><dd class="num">${esc(ep.commitLabel || ep.commit)}</dd>
      <dt>Scaling metric</dt><dd class="num">${esc(ep.scalingMetric || "inflight")} <span class="mono" style="color:var(--ink-faint)">target ${esc(ep.scalingTarget ?? "—")}</span></dd>
      <dt>Context length</dt><dd class="num">${ep.maxModelLen ? esc(ep.maxModelLen) + " tokens" : "model default"}</dd>
      <dt>GPU count</dt><dd class="num">${esc(ep.gpuCount ?? 1)} (tensor parallel)</dd>
      <dt>Quantization</dt><dd class="num">${esc((ep.quantization || "bf16").toUpperCase())}</dd>
      <dt>Host KV cache</dt><dd class="num">${ep.hostKvCache ? "On" : "Off"}</dd>
      <dt>Sampling defaults</dt><dd class="num">${esc((ep.samplingDefaults?.temperature ?? 1.0) + " / " + (ep.samplingDefaults?.top_p ?? 1.0) + " / " + (ep.samplingDefaults?.max_tokens ?? 1024))}</dd>
      <dt>Tạo lúc</dt><dd class="num">${esc(skillTime(ep.createdAt))}</dd>
      ${ep.image ? `<dt>Image</dt><dd class="num" style="word-break:break-all">${esc(ep.image)}</dd>` : ""}
      <dt>Engine</dt><dd class="num">${esc(ep.engine || "vllm")}</dd>
      <dt>Segment</dt><dd class="num">${esc(ep.segment || "—")}</dd>
      <dt>Code privacy</dt><dd>${ep.codePrivacy ? '<span class="savings">ON</span> — không log mã nguồn' : '<span style="color:var(--ink-faint)">OFF</span>'}</dd>
      <dt>Guardrails</dt><dd>${ep.guardrailsEnabled ? `<span class="status s-running">Enabled</span> · ${esc(ep.guardrailsTemplate || "banking")}` : '<span style="color:var(--ink-faint)">Disabled</span>'}</dd>
    </dl>

    <h3>Guardrails (NeMo)</h3>
    <div class="field-row" style="gap:8px">
      <label class="field">
        <span>Template</span>
        <select id="grTemplate">
          <option value="banking" ${(ep.guardrailsTemplate || "banking") === "banking" ? "selected" : ""}>Banking</option>
          <option value="insurance" ${ep.guardrailsTemplate === "insurance" ? "selected" : ""}>Insurance</option>
          <option value="general" ${ep.guardrailsTemplate === "general" ? "selected" : ""}>General</option>
        </select>
      </label>
      <label class="field">
        <span>Enabled</span>
        <label class="checkbox-pill" style="margin-top:4px">
          <input type="checkbox" id="grEnabled" ${ep.guardrailsEnabled ? "checked" : ""}>
          <span>Bật guardrails</span>
        </label>
      </label>
    </div>
    <fieldset class="field" style="margin-top:4px">
      <span>Rules</span>
      <div class="checkbox-grid" id="grRules">
        ${Object.keys(GUARDRAIL_RULE_LABEL).map((r) => `
          <label class="checkbox-pill"><input type="checkbox" value="${esc(r)}" ${ep.guardrailsEnabled ? "checked" : ""}><span>${esc(GUARDRAIL_RULE_LABEL[r])}</span></label>`).join("")}
      </div>
    </fieldset>
    <div style="display:flex;gap:8px;margin-top:8px;align-items:center">
      <button class="btn btn-ghost btn-sm" id="grSaveBtn" data-endpoint-id="${esc(ep.id)}">Save guardrails</button>
      <span class="devtools-hint mono" style="font-size:11px">Blocked events: <b id="grBlockedCount">—</b></span>
      <button class="btn btn-ghost btn-sm" id="grViewLog" style="margin-left:auto">View log</button>
    </div>
    <div id="grEventsBox" class="mono" style="margin-top:8px;font-size:11px;color:var(--ink-dim)"></div>

    <h3>Cấu hình sau deploy</h3>
    <div class="field-row" style="gap:8px">
      <label class="field">
        <span>Scaling metric</span>
        <select id="cfgScalingMetric">
          <option value="inflight" ${(ep.scalingMetric || "inflight") === "inflight" ? "selected" : ""}>Inflight requests</option>
          <option value="gpu_util" ${ep.scalingMetric === "gpu_util" ? "selected" : ""}>GPU utilization (%)</option>
          <option value="e2e_latency" ${ep.scalingMetric === "e2e_latency" ? "selected" : ""}>E2E latency p95 (ms)</option>
        </select>
      </label>
      <label class="field">
        <span>Scaling target</span>
        <input type="number" id="cfgScalingTarget" value="${esc(ep.scalingTarget ?? 2000)}" min="1">
      </label>
      <label class="field">
        <span>Context length (max_model_len)</span>
        <input type="number" id="cfgMaxModelLen" value="${ep.maxModelLen ? esc(ep.maxModelLen) : ""}" placeholder="blank = default">
      </label>
    </div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn btn-ghost btn-sm" id="cfgSaveBtn" data-endpoint-id="${esc(ep.id)}">Apply config (hot-update)</button>
      <span class="devtools-hint mono" style="font-size:11px;align-self:center">Không downtime · ghi event vào audit</span>
    </div>

    <h3>Sampling defaults (hot-update)</h3>
    <div class="field-row" style="gap:8px">
      <label class="field">
        <span>Temperature</span>
        <input type="number" id="cfgTemp" value="${esc(ep.samplingDefaults?.temperature ?? 1.0)}" min="0" max="2" step="0.1">
      </label>
      <label class="field">
        <span>Top_p</span>
        <input type="number" id="cfgTopP" value="${esc(ep.samplingDefaults?.top_p ?? 1.0)}" min="0.1" max="1" step="0.05">
      </label>
      <label class="field">
        <span>Max tokens</span>
        <input type="number" id="cfgMaxTok" value="${esc(ep.samplingDefaults?.max_tokens ?? 1024)}" min="1">
      </label>
    </div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn btn-ghost btn-sm" id="cfgSamplingBtn" data-endpoint-id="${esc(ep.id)}">Apply sampling defaults</button>
      <span class="devtools-hint mono" style="font-size:11px;align-self:center">Request không truyền thì dùng default · request truyền thì override</span>
    </div>

    <h3>GPU / Quantization / Host KV (redeploy)</h3>
    <div class="field-row" style="gap:8px">
      <label class="field">
        <span>GPU count (tensor parallel)</span>
        <select id="rdGpuCount">
          <option value="1" ${(ep.gpuCount ?? 1) === 1 ? "selected" : ""}>1 GPU</option>
          <option value="2" ${ep.gpuCount === 2 ? "selected" : ""}>2 GPUs</option>
          <option value="4" ${ep.gpuCount === 4 ? "selected" : ""}>4 GPUs</option>
          <option value="8" ${ep.gpuCount === 8 ? "selected" : ""}>8 GPUs</option>
        </select>
      </label>
      <label class="field">
        <span>Quantization</span>
        <select id="rdQuantization">
          <option value="bf16" ${(ep.quantization || "bf16") === "bf16" ? "selected" : ""}>BF16</option>
          <option value="fp8" ${ep.quantization === "fp8" ? "selected" : ""}>FP8</option>
          <option value="awq" ${ep.quantization === "awq" ? "selected" : ""}>AWQ</option>
        </select>
      </label>
      <label class="field">
        <span>Host KV cache</span>
        <select id="rdHostKvCache">
          <option value="false" ${!ep.hostKvCache ? "selected" : ""}>Off</option>
          <option value="true" ${ep.hostKvCache ? "selected" : ""}>On (context dài)</option>
        </select>
      </label>
    </div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn btn-ghost btn-sm" id="rdSaveBtn" data-endpoint-id="${esc(ep.id)}">Apply & redeploy</button>
      <span class="devtools-hint mono" style="font-size:11px;align-self:center">Immutable · endpoint về deploying rồi chạy lại</span>
    </div>

    <h3>Endpoint URL</h3>
    <div class="code-shell">
      <code class="mono" style="font-size:10.5px;word-break:break-all">${esc(endpointUrl)}</code>
      <button class="btn btn-ghost btn-sm copy-btn" data-copy-val="${esc(endpointUrl)}">Copy</button>
    </div>
    <p class="devtools-hint mono" style="margin-top:6px">OpenAI-compatible · cần Authorization Bearer key</p>

    ${usageHtml}
    ${metricsHtml}

    <h3>Code samples</h3>
    <div class="cli-cmd">
      <div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:11px;color:var(--ink-faint)">CURL</b><button class="btn btn-ghost btn-sm copy-btn" data-copy-val="${esc(curlSample)}">Copy</button></div>
      <pre class="code-block mono small" style="margin:6px 0"><code>${esc(curlSample)}</code></pre>
    </div>
    <div class="cli-cmd">
      <div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:11px;color:var(--ink-faint)">PYTHON (OpenAI SDK)</b><button class="btn btn-ghost btn-sm copy-btn" data-copy-val="${esc(pySample)}">Copy</button></div>
      <pre class="code-block mono small" style="margin:6px 0"><code>${esc(pySample)}</code></pre>
    </div>
    <div class="cli-cmd">
      <div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:11px;color:var(--ink-faint)">JAVASCRIPT (OpenAI SDK)</b><button class="btn btn-ghost btn-sm copy-btn" data-copy-val="${esc(jsSample)}">Copy</button></div>
      <pre class="code-block mono small" style="margin:6px 0"><code>${esc(jsSample)}</code></pre>
    </div>

    <h3>Lifecycle events (${(ep.events || []).length})</h3>
    <ul style="list-style:none;padding:0;">${evts || "<li style='color:var(--ink-faint)'>Chưa có event</li>"}</ul>

    <div style="display:flex;gap:8px;margin-top:16px;">
      <button class="btn btn-primary btn-sm" id="drawerTestPlayground" data-endpoint-id="${esc(ep.id)}">Test in Playground</button>
    </div>`;
  $("#drawer").hidden = false;
  $("#drawerOverlay").hidden = false;
  $("#drawerClose").focus();
  // Guardrails (US-02/WF-03) — sync rules theo template + save + view log + events
  const grSaveBtn = $("#grSaveBtn");
  if (grSaveBtn) {
    grSaveBtn.addEventListener("click", () => saveGuardrails(ep.id));
  }
  const grTemplate = $("#grTemplate");
  if (grTemplate) {
    grTemplate.addEventListener("change", () => {
      const tpl = grTemplate.value;
      const rules = GUARDRAIL_TEMPLATES[tpl] || [];
      document.querySelectorAll("#grRules input").forEach((cb) => {
        cb.checked = rules.includes(cb.value);
      });
    });
  }
  const grViewLog = $("#grViewLog");
  if (grViewLog) {
    grViewLog.addEventListener("click", () => {
      closeDrawer();
      location.hash = "#/audit";
      toast("Xem audit log — lọc theo endpoint/action nếu cần");
    });
  }
  fetchGuardrailEvents(ep.id);
  const tpBtn = $("#drawerTestPlayground");
  if (tpBtn) {
    tpBtn.addEventListener("click", () => {
      closeDrawer();
      // chuyển sang tab Playground + chọn endpoint này
      location.hash = "#/devtools";
      document.querySelectorAll("#devtoolsTabs .tab").forEach((t) => {
        const on = t.dataset.tab === "playground";
        t.classList.toggle("is-on", on);
        t.setAttribute("aria-selected", String(on));
      });
      document.querySelectorAll(".devtools-panel").forEach((p) => { p.hidden = p.id !== "dt-playground"; });
      fetchPlaygroundEndpoints().then(() => {
        const sel = $("#pgEndpoint");
        if (sel) { sel.value = ep.id; syncPlaygroundModel(); updatePgCurl(); }
        $("#pgPrompt").focus();
      });
      toast(`Đã chọn endpoint "${ep.name}" trong Playground — bấm Run để test`);
    });
  }
  const cfgBtn = $("#cfgSaveBtn");
  if (cfgBtn) {
    cfgBtn.addEventListener("click", async () => {
      const body = {
        scalingMetric: $("#cfgScalingMetric").value,
        scalingTarget: parseInt($("#cfgScalingTarget").value, 10),
      };
      const ml = $("#cfgMaxModelLen").value.trim();
      body.maxModelLen = ml === "" ? null : parseInt(ml, 10);
      try {
        const r = await fetch(`/v1/endpoints/${encodeURIComponent(ep.id)}/config`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const j = await r.json();
        if (!r.ok) { toast(`Lỗi ${r.status}: ${j.error || ""}`); return; }
        toast(`Đã áp dụng config cho "${ep.name}" (không downtime)`);
        closeDrawer();
        fetchDedicated();
      } catch (err) {
        toast(`Network error: ${err.message}`);
      }
    });
  }
  const cfgSamplingBtn = $("#cfgSamplingBtn");
  if (cfgSamplingBtn) {
    cfgSamplingBtn.addEventListener("click", async () => {
      const body = {
        samplingDefaults: {
          temperature: parseFloat($("#cfgTemp").value),
          top_p: parseFloat($("#cfgTopP").value),
          max_tokens: parseInt($("#cfgMaxTok").value, 10),
        },
      };
      try {
        const r = await fetch(`/v1/endpoints/${encodeURIComponent(ep.id)}/config`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const j = await r.json();
        if (!r.ok) { toast(`Lỗi ${r.status}: ${j.error || ""}`); return; }
        toast(`Đã áp dụng sampling defaults cho "${ep.name}"`);
        closeDrawer();
        fetchDedicated();
      } catch (err) {
        toast(`Network error: ${err.message}`);
      }
    });
  }
  const rdBtn = $("#rdSaveBtn");
  if (rdBtn) {
    rdBtn.addEventListener("click", async () => {
      const body = {
        gpuCount: parseInt($("#rdGpuCount").value, 10),
        quantization: $("#rdQuantization").value,
        hostKvCache: $("#rdHostKvCache").value === "true",
      };
      try {
        const r = await fetch(`/v1/endpoints/${encodeURIComponent(ep.id)}/redeploy-config`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const j = await r.json();
        if (!r.ok) { toast(`Lỗi ${r.status}: ${j.error || ""}`); return; }
        toast(`Đã áp dụng GPU/quantization cho "${ep.name}" — đang redeploy…`);
        closeDrawer();
        fetchDedicated();
      } catch (err) {
        toast(`Network error: ${err.message}`);
      }
    });
  }
}

function modalRate() {
  const gpu = $("#fGpu").value;
  const commit = $("#fCommit").value;
  return GPU_BASE_RATE[gpu] * COMMIT_MULT[commit];
}

function updatePricePreview() {
  $("#pricePreview").textContent = "$" + modalRate().toFixed(2) + "/hr";
  updatePricePackHint();
}

async function updatePricePackHint() {
  const el = $("#pricePackHint");
  if (!el) return;
  const seg = $("#fSegment").value;
  const gpu = $("#fGpu").value;
  const region = $("#fRegion").value;
  try {
    const res = await fetch("/v1/price-packs?segment=" + encodeURIComponent(seg) + "&gpu=" + encodeURIComponent(gpu) + "&region=" + encodeURIComponent(region));
    if (!res.ok) { el.hidden = true; return; }
    const json = await res.json();
    const pack = (json.data || [])[0];
    if (pack) {
      const quota = [];
      if (pack.quotaRpm != null) quota.push("RPM " + pack.quotaRpm);
      if (pack.quotaTpm != null) quota.push("TPM " + Number(pack.quotaTpm).toLocaleString());
      const disc = pack.discountPct != null && Number(pack.discountPct) > 0 ? " · chiết " + pack.discountPct + "%" : "";
      el.innerHTML = "Gói giá <b>" + esc(seg) + " / " + esc(gpu) + " / " + esc(region) + "</b>: $" + Number(pack.ratePerHour).toFixed(2) + "/hr" + disc + (quota.length ? " · quota " + quota.join(", ") : "");
      el.hidden = false;
    } else {
      el.innerHTML = '<span class="pph-none">Không có gói giá cho ' + esc(seg) + " / " + esc(gpu) + " / " + esc(region) + " — dùng rate mặc định.</span>";
      el.hidden = false;
    }
  } catch (e) {
    el.hidden = true;
  }
}

function setMode(mode) {
  $("#k8sFields").hidden = mode !== "k8s";
  $("#containerFields").hidden = mode !== "container";
  document.querySelectorAll("#fModeCards .radio-card").forEach((c) => {
    c.classList.toggle("is-on", c.querySelector("input").value === mode);
  });
}

function openCreateModal() {
  const models = DATA.partners.map((p) => p.top);
  $("#fModel").innerHTML = models.map((m) => `<option>${esc(m)}</option>`).join("");
  $("#fName").value = "";
  setMode("k8s");
  const allowBox = $("#fAllowSwap"); if (allowBox) allowBox.checked = false;
  updatePricePreview();
  $("#createModal").hidden = false;
  $("#modalOverlay").hidden = false;
  $("#fName").focus();
}

function closeCreateModal() {
  $("#createModal").hidden = true;
  $("#modalOverlay").hidden = true;
}

async function submitEndpoint(e) {
  e.preventDefault();
  const name = $("#fName").value.trim().toLowerCase().replace(/\s+/g, "-");
  if (!name) { toast("Endpoint name is required"); $("#fName").focus(); return; }

  const mode = document.querySelector('input[name="fMode"]:checked').value;
  const maxRep = mode === "k8s" ? Math.max(1, parseInt($("#fMaxRep").value, 10) || 1) : 1;
  const minRep = mode === "k8s" ? Math.max(1, parseInt($("#fMinRep").value, 10) || 1) : 1;

  const body = {
    name,
    model: $("#fModel").value,
    gpu: $("#fGpu").value,
    mode,
    region: $("#fRegion").value,
    commit: $("#fCommit").value,
    minReplicas: minRep,
    maxReplicas: maxRep,
    allowGpuSwap: !!$("#fAllowSwap").checked,
    // Phase 1 (US-01/US-02/US-08) — engine, segment, guardrails, code privacy
    engine: $("#fEngine").value,
    segment: $("#fSegment").value,
    codePrivacy: !!$("#fCodePrivacy").checked,
  };
  const grTemplate = $("#fGuardrailsTemplate").value;
  body.guardrailsEnabled = !!grTemplate;
  if (grTemplate) body.guardrailsTemplate = grTemplate;
  // P0 — SLO-driven autoscaling + context length
  if (mode === "k8s") {
    body.scalingMetric = $("#fScalingMetric").value;
    const st = parseInt($("#fScalingTarget").value, 10);
    if (st > 0) body.scalingTarget = st;
    const ml = $("#fMaxModelLen").value.trim();
    if (ml !== "") body.maxModelLen = parseInt(ml, 10);
    // P1 — GPU count (tensor parallel) + quantization
    body.gpuCount = parseInt($("#fGpuCount").value, 10);
    body.quantization = $("#fQuantization").value;
    // P2 — host KV cache + sampling defaults
    body.hostKvCache = $("#fHostKvCache").value === "true";
    body.samplingDefaults = {
      temperature: parseFloat($("#fDefTemp").value) || 1.0,
      top_p: parseFloat($("#fDefTopP").value) || 1.0,
      max_tokens: parseInt($("#fDefMaxTok").value, 10) || 1024,
    };
  }
  if (mode === "container") {
    body.image = $("#fImage").value || "";
    body.port = parseInt($("#fPort").value, 10) || 8000;
  }

  const btn = $("#createForm").querySelector("button[type=submit]");
  if (btn) { btn.disabled = true; btn.textContent = "Deploying…"; }
  try {
    const res = await fetch("/v1/endpoints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
      toast(`Lỗi ${res.status}: ${json.error || ""}`);
      return;
    }
    closeCreateModal();
    renderWorkflow(mode, mode === "k8s" ? WORKFLOWS.k8s.map(() => "pending") : WORKFLOWS.container.map(() => "pending"), `deploying ${name}…`);
    startWorkflowLive(mode, name);
    toast(`Deploying ${name} via ${mode === "k8s" ? "Kubernetes" : "container"}…`);
    await fetchDedicated();
  } catch (err) {
    toast(`Network error: ${err.message}`);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Deploy endpoint"; }
  }
}

// Workflow live — poll endpoint state từ backend thay vì giả lập timer
function startWorkflowLive(mode, name) {
  if (wfTimer) clearInterval(wfTimer);
  const steps = WORKFLOWS[mode];
  const states = steps.map(() => "pending");
  let phase = 0;
  renderWorkflow(mode, states, `deploying ${name}…`);
  wfTimer = setInterval(async () => {
    const res = await fetch(`/v1/endpoints?status=running&mode=${mode}`).catch(() => null);
    const list = res && res.ok ? (await res.json().catch(() => ({ data: [] })) ).data : [];
    const allres = await fetch("/v1/endpoints").catch(() => null);
    const all = allres && allres.ok ? (await allres.json().catch(() => ({ data: [] })) ).data : [];
    const ep = all.find((d) => d.name === name);
    if (!ep) return;
    if (ep.status === "deploying" && phase < 1) {
      states[0] = "done"; states[1] = "active"; phase = 1;
      renderWorkflow(mode, states, `step 2/${steps.length} — ${steps[1].t}`);
    } else if (ep.status === "running" && phase < 2) {
      for (let i = 0; i < states.length; i++) states[i] = "done";
      phase = 2;
      renderWorkflow(mode, states, "deploy succeeded");
      clearInterval(wfTimer);
      wfTimer = null;
      toast(`Endpoint ${name} is running`);
      fetchDedicated();
    } else if (ep.status === "failed" || ep.status === "stopped") {
      clearInterval(wfTimer);
      wfTimer = null;
      renderWorkflow(mode, states, `deploy ${ep.status}`);
      toast(`Endpoint ${name} ${ep.status}`);
      fetchDedicated();
    }
  }, 1500);
}

async function stopEndpoint(id) {
  try {
    const res = await fetch(`/v1/endpoints/${encodeURIComponent(id)}/stop`, { method: "POST" });
    if (!res.ok) { const j = await res.json().catch(() => ({})); toast(`Lỗi: ${j.error || res.status}`); return; }
    toast("Endpoint stopped");
    fetchDedicated();
  } catch (e) { toast(`Network error: ${e.message}`); }
}

async function startEndpoint(id) {
  try {
    const res = await fetch(`/v1/endpoints/${encodeURIComponent(id)}/start`, { method: "POST" });
    if (!res.ok) { const j = await res.json().catch(() => ({})); toast(`Lỗi: ${j.error || res.status}`); return; }
    toast("Endpoint started");
    fetchDedicated();
  } catch (e) { toast(`Network error: ${e.message}`); }
}

async function deleteEndpoint(id) {
  if (!confirm("Xóa endpoint này?")) return;
  try {
    const res = await fetch(`/v1/endpoints/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) { const j = await res.json().catch(() => ({})); toast(`Lỗi: ${j.error || res.status}`); return; }
    toast("Endpoint removed");
    fetchDedicated();
  } catch (e) { toast(`Network error: ${e.message}`); }
}

/* ── Infra view ────────────────────────────── */
function renderInfra() {
  $("#gpuCards").innerHTML = DATA.gpus.map((g) => `
    <div class="card">
      <h3>${esc(g.name)}</h3>
      <p>${esc(g.note)}</p>
      <div class="card-stats">
        <div><b>${g.nodes}</b><span>nodes</span></div>
        <div><b>${g.util}%</b><span>utilization</span></div>
        <div><b>${esc(g.state)}</b><span>state</span></div>
      </div>
    </div>`).join("");

  // Gap #25 — multi-region (incl. JP-1 pilot, KR-1 planned)
  $("#regionList").innerHTML = DATA.regionsExtra.map((r) =>
    `<li><div class="region-name"><b>${esc(r.name)}</b><span>${esc(r.detail)}</span></div><div class="region-right"><span class="region-cap">${esc(r.cap)}</span><span class="status s-${esc(r.status === "planned" ? "paused" : r.status === "pilot" ? "trialing" : "active")}">${statusLabel(r.status)}</span></div></li>`
  ).join("");

  $("#maintList").innerHTML = DATA.maintenance.map((m) =>
    `<li><div class="region-name"><b>${esc(m.name)}</b><span>${esc(m.detail)}</span></div></li>`
  ).join("");

  $("#nodeRows").innerHTML = DATA.nodes.map((n) => `
    <tr>
      <td class="num">${esc(n.node)}</td>
      <td class="num">${esc(n.gpu)}</td>
      <td class="num">${esc(n.region)}</td>
      <td>${utilBar(n.util)}</td>
      <td>${esc(n.tenant)}</td>
      <td><span class="status s-${esc(n.status)}">${statusLabel(n.status)}</span></td>
    </tr>`).join("");

  // Gap #10 — GPU clusters bare-metal + InfiniBand
  $("#clusterRows").innerHTML = DATA.clusters.map((c) => `
    <tr>
      <td class="num">${esc(c.name)}</td>
      <td class="num">${esc(c.gpu)}</td>
      <td class="num">${esc(c.fabric)}</td>
      <td class="num">${esc(c.region)}</td>
      <td>${utilBar(c.util)}</td>
      <td>${esc(c.tenant)}</td>
      <td><span class="status s-${esc(c.status)}">${statusLabel(c.status)}</span></td>
    </tr>`).join("");
}

/* ── Catalog view (gap: frontier models, long ctx, multi-modal, BYOM) ── */
let catalogFilter = "all";

function renderCatalog() {
  const multimodal = DATA.catalog.filter((m) => m.modal !== "text" && m.modal !== "text+code");
  const frontier = DATA.catalog.filter((m) => m.status === "new");
  const maxCtx = DATA.catalog.reduce((mx, m) => {
    const n = parseInt(m.ctx, 10) || 0;
    return Math.max(mx, n);
  }, 0);

  $("#kpiCatTotal").textContent = DATA.catalog.length + (DATA.catalog.length >= 20 ? "" : "");
  $("#kpiCatFrontier").textContent = frontier.length;
  $("#kpiCatModal").textContent = multimodal.length;
  $("#kpiCatCtx").textContent = (maxCtx >= 1000 ? (maxCtx / 1000) + "M" : maxCtx + "K");

  const q = catalogFilter;
  const rows = DATA.catalog.filter((m) => q === "all" || m.modal === q || (q === "multimodal" && m.modal !== "text" && m.modal !== "text+code"));

  $("#catalogGrid").innerHTML = rows.map((m) => {
    const ctxBadge = m.ctx === "—" ? "" : `<span class="card-tag t-blue">${esc(m.ctx)} ctx</span>`;
    const modalBadge = (m.modal === "text" || m.modal === "text+code") ? "" : `<span class="card-tag t-amber">${esc(m.modal)}</span>`;
    const newBadge = m.status === "new" ? `<span class="card-tag">NEW</span>` : "";
    return `<div class="card model-card">
      <div class="model-head">${newBadge}${ctxBadge}${modalBadge}</div>
      <h3>${esc(m.model)}</h3>
      <p>${esc(m.vendor)} · ${esc(m.size)}</p>
      <p class="model-note">${esc(m.note)}</p>
      <div class="card-stats">
        <div><b>${esc(m.ctx)}</b><span>context</span></div>
        <div><b>${esc(m.modal)}</b><span>modality</span></div>
      </div>
    </div>`;
  }).join("");

  $("#catalogEmpty").hidden = rows.length > 0;
}

/* ── Fine-tuning view (gap: LoRA/Full/DPO + one-click deploy) ── */
function renderFineTuning() {
  const running = DATA.fineTune.filter((f) => f.status === "running").length;
  const spent = DATA.fineTune.reduce((s, f) => s + parseFloat(f.cost), 0).toFixed(2);

  $("#kpiFtJobs").textContent = DATA.fineTune.length;
  $("#kpiFtRunning").textContent = running;
  $("#kpiFtMethods").textContent = "3 (LoRA · Full · DPO)";
  $("#kpiFtSpent").textContent = "$" + spent;

  $("#ftRows").innerHTML = DATA.fineTune.map((f) => {
    const prog = f.progress > 0 ? `<div class="util-bar"><i style="width:${f.progress}%"></i></div>` : "";
    return `<tr>
      <td class="num">${esc(f.job)}</td>
      <td>${esc(f.base)}</td>
      <td><span class="mode-badge ${f.method === "LoRA" ? "k8s" : f.method === "Full" ? "container" : ""}">${esc(f.method)}</span></td>
      <td>${prog ? prog + '<span class="num" style="margin-left:8px">' + f.progress + '%</span>' : '<span class="num" style="color:var(--ink-faint)">—</span>'}</td>
      <td class="num">$${esc(f.cost)}</td>
      <td>${f.target === "—" ? '<span style="color:var(--ink-faint)">—</span>' : '<span class="status s-running">' + esc(f.target) + '</span>'}</td>
      <td><span class="status s-${esc(f.status === "deployed" ? "running" : f.status === "queued" ? "paused" : f.status)}">${statusLabel(f.status)}</span></td>
    </tr>`;
  }).join("");

  $("#ftPricingRows").innerHTML = DATA.ftPricing.map((p) => `
    <tr>
      <td class="num">${esc(p.method)}</td>
      <td class="num">$${esc(p.small)}</td>
      <td class="num">$${esc(p.mid)}</td>
      <td class="num">$${esc(p.large)}</td>
      <td style="color:var(--ink-faint)">${esc(p.note)}</td>
    </tr>`).join("");
}

/* ── Batch view (gaps: async batch API, -50%) — live từ /v1/batch thật ── */
let batchJobs = [];
let batchPollTimer = null;

async function fetchBatchJobs() {
  try {
    const res = await fetch("/v1/batch?limit=100");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    batchJobs = json.data || [];
  } catch (e) {
    console.warn("[batch] fetch lỗi", e.message);
    batchJobs = [];
  }
  renderBatch();
}

function fmtSubmitted(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
}

function fmtElapsed(meta) {
  if (meta.window && meta.window !== "—") return meta.window;
  if (meta.status === "queued") return "—";
  const start = meta.startedAt ? Date.parse(meta.startedAt) : null;
  const end = meta.completedAt ? Date.parse(meta.completedAt) : Date.now();
  if (start == null) return "—";
  const sec = Math.max(0, Math.round((end - start) / 1000));
  if (sec < 60) return sec + "s";
  if (sec < 3600) return Math.floor(sec / 60) + "m " + (sec % 60) + "s";
  return (sec / 3600).toFixed(2) + "h";
}

function renderBatch() {
  const running = batchJobs.filter((b) => b.status === "running").length;
  const totalReq = batchJobs.reduce((s, b) => s + (parseInt(b.requests, 10) || 0), 0);

  $("#kpiBatJobs").textContent = batchJobs.length;
  $("#kpiBatRunning").textContent = running;
  $("#kpiBatReq").textContent = totalReq.toLocaleString("en-US");
  $("#kpiBatDisc").textContent = "−50%";

  if (!batchJobs.length) {
    $("#batchRows").innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--ink-faint);padding:30px">Chưa có batch job. Click "Upload JSONL batch" để gửi job đầu tiên.</td></tr>`;
    return;
  }

  $("#batchRows").innerHTML = batchJobs.map((b) => {
    const savings = b.savings || "−50%";
    const statusCls = b.status === "completed" ? "s-running"
      : b.status === "failed" ? "s-failed"
      : b.status === "cancelled" ? "s-failed"
      : (b.status === "running" || b.status === "validating" || b.status === "in_progress" || b.status === "finalizing") ? "s-trialing"
      : "s-paused";
    const reqs = (parseInt(b.requests, 10) || 0).toLocaleString("en-US");
    return `<tr data-job-id="${esc(b.id)}">
      <td class="num">${esc(b.id)}</td>
      <td>${esc(b.model)}</td>
      <td class="num">${reqs}</td>
      <td class="num">${esc(fmtSubmitted(b.submittedAt))}</td>
      <td class="num">${fmtElapsed(b) === "—" ? '<span style="color:var(--ink-faint)">in progress</span>' : esc(fmtElapsed(b))}</td>
      <td><span class="savings">${esc(savings)}</span></td>
      <td>
        <span class="status ${statusCls}">${statusLabel(b.status)}</span>
        ${(b.status === "completed" || b.status === "failed")
          ? ` <button class="btn btn-ghost btn-sm" data-action="bat-output" data-id="${esc(b.id)}" style="margin-left:6px">Download</button>`
          : ""}
      </td>
    </tr>`;
  }).join("");
}

/* ── Batch upload modal — submit thật tới /v1/batch ── */
let batchModelOptions = ["FPT-LLM 8B (vi)", "GLM-5.2", "Qwen 3.7 Plus", "DeepSeek V4 Pro", "DeepSeek-R1", "Llama-3.3-70B", "PhoGPT-4B"];

function openBatchModal() {
  $("#batchModel").innerHTML = batchModelOptions.map((m) => `<option>${esc(m)}</option>`).join("");
  $("#batchModel").value = "PhoGPT-4B";
  $("#batchFile").value = "";
  $("#batchFileLbl").textContent = "Chưa chọn file · giới hạn 100MB / 100K requests";
  $("#batchPreview").textContent = "";
  $("#batchMaxTok").value = "512";
  $("#batchModal").hidden = false;
  $("#batchModalOverlay").hidden = false;
  $("#batchFile").focus();
}

function closeBatchModal() {
  $("#batchModal").hidden = true;
  $("#batchModalOverlay").hidden = true;
}

function previewBatchFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = String(e.target.result || "");
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
    let valid = 0, invalid = 0;
    for (const l of lines.slice(0, 200)) {
      try { JSON.parse(l); valid++; } catch (_) { invalid++; }
    }
    const tooLong = lines.length > 100000;
    $("#batchPreview").innerHTML = `
      <span class="${tooLong || invalid > 0 ? "pg-meta-err" : ""}">
        ${lines.length.toLocaleString()} dòng · ${valid} JSON hợp lệ${invalid > 0 ? ` · ${invalid} lỗi` : ""}
        ${tooLong ? " · ⚠ vượt 100K requests/job" : ""}
      </span>`;
  };
  reader.readAsText(file.slice(0, 5 * 1024 * 1024));
}

async function submitBatchJob(e) {
  e.preventDefault();
  const file = $("#batchFile").files[0];
  if (!file) { toast("Chọn file JSONL trước"); $("#batchFile").focus(); return; }
  const model = $("#batchModel").value;
  const maxTokens = parseInt($("#batchMaxTok").value, 10) || 512;

  const fd = new FormData();
  fd.append("model", model);
  fd.append("max_tokens", String(maxTokens));
  fd.append("file", file, file.name);

  $("#batchSubmitBtn").disabled = true;
  $("#batchSubmitBtn").textContent = "Đang upload…";
  try {
    const res = await fetch("/v1/batch", { method: "POST", body: fd });
    const json = await res.json();
    if (!res.ok) {
      const detail = json.details ? json.details.join("; ") : json.error;
      toast(`Lỗi ${res.status}: ${detail}`);
      return;
    }
    toast(`Job ${json.id} đã queue · ${json.requests} requests · ${json.discount}`);
    closeBatchModal();
    await fetchBatchJobs();
  } catch (err) {
    toast(`Network error: ${err.message}`);
  } finally {
    $("#batchSubmitBtn").disabled = false;
    $("#batchSubmitBtn").textContent = "Submit batch";
  }
}

/* ── Bring your own model — modal + list + poll (live từ /v1/byom thật) ── */
let byomJobs = [];
let byomPollTimer = null;

function openByomModal() {
  $("#byomType").value = "huggingface";
  $("#byomSource").value = "";
  $("#byomHfToken").value = "";
  $("#byomModelName").value = "";
  $("#byomDescription").value = "";
  syncByomSourceLabel();
  $("#byomModal").hidden = false;
  $("#byomModalOverlay").hidden = false;
  $("#byomSource").focus();
}

function closeByomModal() {
  $("#byomModal").hidden = true;
  $("#byomModalOverlay").hidden = true;
}

function syncByomSourceLabel() {
  const type = $("#byomType").value;
  const lbl = $("#byomSourceLabel");
  const input = $("#byomSource");
  if (type === "huggingface") {
    lbl.textContent = "HF repo path";
    input.placeholder = "meta-llama/Llama-3.3-70B-Instruct";
  } else {
    lbl.textContent = "S3 presigned URL (.zip / .tar.gz)";
    input.placeholder = "https://s3.ap-southeast-1.amazonaws.com/bucket/model.tar.gz?X-Amz-Expires=7200";
  }
  $("#byomHfTokenField").style.display = type === "huggingface" ? "" : "none";
}

async function fetchByomJobs() {
  try {
    const res = await fetch("/v1/byom");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    byomJobs = json.data || [];
  } catch (e) {
    console.warn("[byom] fetch lỗi", e.message);
    byomJobs = [];
  }
  renderByom();
}

function fmtBytes(n) {
  if (!n) return "0 B";
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + " MB";
  return (n / 1024 / 1024 / 1024).toFixed(2) + " GB";
}

function renderByom() {
  const ready = byomJobs.filter((j) => j.status === "ready").length;
  const running = byomJobs.filter((j) => ["queued", "downloading", "validating"].includes(j.status)).length;
  const failed = byomJobs.filter((j) => j.status === "failed").length;
  $("#kpiByomTotal").textContent = byomJobs.length;
  $("#kpiByomReady").textContent = ready;
  $("#kpiByomRunning").textContent = running;
  $("#kpiByomFailed").textContent = failed;

  if (!byomJobs.length) {
    $("#byomRows").innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--ink-faint);padding:30px">Chưa có upload job. Click "Bring your own model" để upload đầu tiên.</td></tr>`;
    return;
  }

  $("#byomRows").innerHTML = byomJobs.map((j) => {
    const statusCls = j.status === "ready" ? "s-running"
      : j.status === "failed" ? "s-failed"
      : j.status === "cancelled" ? "s-failed"
      : ["queued", "downloading", "validating"].includes(j.status) ? "s-trialing"
      : "s-paused";
    const files = j.validation?.files ?? j.download?.files ?? "—";
    const size = (j.validation?.totalBytes || j.download?.totalBytes) || 0;
    const source = j.type === "huggingface" ? `HF · ${esc(j.modelSource)}` : `S3 · ${esc((j.modelSource || "").split("?")[0].split("/").pop() || "")}`;
    const statusExtra = j.error?.message ? `<div class="mono" style="font-size:10.5px;color:var(--ink-faint);margin-top:3px">${esc(j.error.message).slice(0, 100)}</div>` : "";
    const ready = j.status === "ready";
    const inProgress = ["queued", "downloading", "validating"].includes(j.status);
    return `<tr data-job-id="${esc(j.id)}">
      <td class="num">${esc(j.id)}</td>
      <td>${esc(j.modelName)}</td>
      <td class="mono" style="font-size:11px">${source}</td>
      <td class="num">${files}</td>
      <td class="num">${fmtBytes(size)}</td>
      <td>
        <span class="status ${statusCls}">${statusLabel(j.status)}</span>
        ${statusExtra}
      </td>
      <td>
        ${ready ? `<button class="btn btn-primary btn-sm" data-action="byom-deploy" data-id="${esc(j.id)}" data-name="${esc(j.modelName)}">Deploy</button> <button class="btn btn-ghost btn-sm" data-action="byom-playground" data-id="${esc(j.id)}" data-name="${esc(j.modelName)}" title="Thử model bằng playground chat">Playground</button>` : ""}
        ${inProgress ? `<button class="btn btn-ghost btn-sm" data-action="byom-cancel" data-id="${esc(j.id)}">Cancel</button>` : ""}
        <button class="btn btn-ghost btn-sm" data-action="byom-delete" data-id="${esc(j.id)}">Delete</button>
      </td>
    </tr>`;
  }).join("");
}

async function submitByomJob(e) {
  e.preventDefault();
  const type = $("#byomType").value;
  const modelSource = $("#byomSource").value.trim();
  const modelName = $("#byomModelName").value.trim();
  const description = $("#byomDescription").value.trim();
  const hfToken = $("#byomHfToken").value.trim();
  if (!modelSource) { toast("Source bắt buộc"); $("#byomSource").focus(); return; }
  if (!modelName) { toast("Model name bắt buộc"); $("#byomModelName").focus(); return; }
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(modelName)) { toast("Model name chỉ chữ thường+số+gạch nối, 2-63 ký tự"); $("#byomModelName").focus(); return; }

  const body = { modelSource, modelName, type, description };
  if (type === "huggingface" && hfToken) body.hfToken = hfToken;

  $("#byomSubmitBtn").disabled = true;
  $("#byomSubmitBtn").textContent = "Đang submit…";
  try {
    const res = await fetch("/v1/byom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
      const detail = json.error || (json.details || []).join("; ");
      toast(`Lỗi ${res.status}: ${detail}`);
      return;
    }
    toast(`BYOM job ${json.id} đã queue · ${json.type} → ${json.modelName}`);
    closeByomModal();
    await fetchByomJobs();
    startByomPolling();
  } catch (err) {
    toast(`Network error: ${err.message}`);
  } finally {
    $("#byomSubmitBtn").disabled = false;
    $("#byomSubmitBtn").textContent = "Upload";
  }
}

function startByomPolling() {
  stopByomPolling();
  const hasPending = byomJobs.some((j) => ["queued", "downloading", "validating"].includes(j.status));
  if (!hasPending) return;
  byomPollTimer = setInterval(async () => {
    await fetchByomJobs();
    const stillPending = byomJobs.some((j) => ["queued", "downloading", "validating"].includes(j.status));
    if (!stillPending) stopByomPolling();
  }, 3000);
}

function stopByomPolling() {
  if (byomPollTimer) clearInterval(byomPollTimer);
  byomPollTimer = null;
}

async function byomAction(action, jobId, modelName) {
  if (action === "byom-cancel") {
    const r = await fetch(`/v1/byom/${jobId}/cancel`, { method: "POST" });
    toast(r.ok ? `Đã hủy ${jobId}` : `Lỗi ${r.status}`);
  } else if (action === "byom-delete") {
    if (!confirm(`Xóa job ${jobId} và toàn bộ weights?`)) return;
    const r = await fetch(`/v1/byom/${jobId}`, { method: "DELETE" });
    toast(r.ok ? `Đã xóa ${jobId}` : `Lỗi ${r.status}`);
  } else if (action === "byom-playground") {
    openPlayground(jobId, modelName);
  } else if (action === "byom-deploy") {
    const r = await fetch(`/v1/byom/${jobId}/deploy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const json = await r.json().catch(() => ({}));
    if (!r.ok) {
      toast(`Lỗi ${r.status}: ${json.error || ""}`);
    } else {
      toast(`Đã deploy ${modelName} → endpoint "${json.data.name}" (xem tab Dedicated)`);
      location.hash = "#/dedicated";
      fetchDedicated();
    }
  }
  await fetchByomJobs();
}

/* ── Playground chat (O1 — BYOM upload → playground → deploy) ── */
let pgAbort = null;
function openPlayground(jobId, modelName) {
  $("#pgJobId").value = jobId;
  $("#pgModel").value = `byom-${jobId}`;
  $("#pgModelName").textContent = modelName;
  $("#pgSystem").value = "Bạn là trợ lý hữu ích, trả lời clearly và đúng trọng tâm.";
  $("#pgTemp").value = 0.7;
  $("#pgTempVal").textContent = "0.7";
  $("#pgMaxTok").value = 256;
  $("#pgMessages").innerHTML = `<div style="color:var(--ink-faint);padding:20px;text-align:center">Gửi message đầu tiên để khởi động model.<br>First request có thể chậm ~30-60s (warming preview pool).</div>`;
  $("#pgInput").value = "";
  $("#pgHint").textContent = "";
  $("#playgroundOverlay").hidden = false;
  $("#playgroundModal").hidden = false;
  buildSnippet();
  $("#pgInput").focus();
}
function closePlayground() {
  if (pgAbort) { try { pgAbort.abort(); } catch (_) {} pgAbort = null; }
  $("#playgroundOverlay").hidden = true;
  $("#playgroundModal").hidden = true;
}
function pgAppend(role, content) {
  const cls = role === "user" ? "color:var(--ink)" : "color:var(--accent)";
  $("#pgMessages").innerHTML += `<div style="margin:8px 0;padding:6px 10px;border:1px solid var(--line);border-radius:4px;${cls}"><b>${role}:</b> ${esc(content)}</div>`;
  $("#pgMessages").scrollTop = $("#pgMessages").scrollHeight;
}
async function pgSend() {
  const input = $("#pgInput").value.trim();
  if (!input) return;
  $("#pgInput").value = "";
  pgAppend("user", input);
  const model = $("#pgModel").value;
  const sys = $("#pgSystem").value.trim();
  const temperature = parseFloat($("#pgTemp").value);
  const max_tokens = parseInt($("#pgMaxTok").value, 10);
  const messages = [];
  if (sys) messages.push({ role: "system", content: sys });
  messages.push({ role: "user", content: input });

  pgAppend("assistant", "");
  const idx = $("#pgMessages").children.length - 1;
  const target = $("#pgMessages").children[idx];
  target.innerHTML = `<b>assistant:</b> <span style="color:var(--ink-faint)">⏳ warming pool…</span>`;

  pgAbort = new AbortController();
  try {
    const resp = await fetch("/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + ACTIVE_API_KEY },
      body: JSON.stringify({ model, messages, temperature, max_tokens, stream: true }),
      signal: pgAbort.signal,
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      target.innerHTML = `<b>assistant:</b> <span style="color:var(--danger)">Lỗi ${resp.status}: ${err.error?.message || err.error || ""}</span>`;
      $("#pgHint").textContent = `HTTP ${resp.status}`;
      return;
    }
    target.innerHTML = `<b>assistant:</b> `;
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let acc = "";
    let buffer = "";
    let firstChunk = true;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        if (data === "[DONE]") continue;
        try {
          const obj = JSON.parse(data);
          const delta = obj.choices?.[0]?.delta?.content;
          if (delta) {
            if (firstChunk) { target.innerHTML = `<b>assistant:</b> `; firstChunk = false; }
            acc += delta;
            target.innerHTML += esc(delta);
            $("#pgMessages").scrollTop = $("#pgMessages").scrollHeight;
          }
        } catch (_) {}
      }
    }
    $("#pgHint").textContent = `⟂ ${acc.length} chars · model=${model}`;
  } catch (e) {
    if (e.name === "AbortError") { target.innerHTML += ` <span style="color:var(--ink-faint)">[cancelled]</span>`; }
    else target.innerHTML = `<b>assistant:</b> <span style="color:var(--danger)">Network: ${e.message}</span>`;
  } finally {
    pgAbort = null;
  }
}
function pgClear() {
  $("#pgMessages").innerHTML = `<div style="color:var(--ink-faint);padding:20px;text-align:center">Đã clear. Gửi message mới.</div>`;
  $("#pgHint").textContent = "";
}
function pgSnippetLang(lang) {
  const model = $("#pgModel").value;
  const sys = $("#pgSystem").value.trim();
  const temperature = parseFloat($("#pgTemp").value);
  const max_tokens = parseInt($("#pgMaxTok").value, 10);
  const url = location.origin + "/v1/chat/completions";
  const sysLine = sys ? `    {"role":"system","content":${JSON.stringify(sys)}},\n` : "";
  if (lang === "curl") {
    return `curl -X POST ${url} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $DDI_KEY" \\
  -d '${JSON.stringify({ model, messages: sys ? [{role:"system",content:sys},{role:"user",content:"Hello"}] : [{role:"user",content:"Hello"}], temperature, max_tokens, stream: false })}'`;
  }
  if (lang === "python") {
    return `import requests
resp = requests.post(
    "${url}",
    headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
    json={
        "model": ${JSON.stringify(model)},
        "messages": ${JSON.stringify(sys ? [{role:"system",content:sys},{role:"user",content:"Hello"}] : [{role:"user",content:"Hello"}], null, 2)},
        "temperature": ${temperature},
        "max_tokens": ${max_tokens},
    },
)
print(resp.json()["choices"][0]["message"]["content"])`;
  }
  return `const resp = await fetch("${url}", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
  body: JSON.stringify({
    model: ${JSON.stringify(model)},
    messages: ${JSON.stringify(sys ? [{role:"system",content:sys},{role:"user",content:"Hello"}] : [{role:"user",content:"Hello"}])},
    temperature: ${temperature},
    max_tokens: ${max_tokens},
  }),
});
const data = await resp.json();
console.log(data.choices[0].message.content);`;
}
function buildSnippet(lang) {
  lang = lang || (document.querySelector(".pg-snippet-tab[aria-pressed='true']")?.dataset.lang || "curl");
  $("#pgSnippet").textContent = pgSnippetLang(lang);
}
function pgDeploy() {
  openPgDeployModal();
}

/* ── Playground → Deploy modal (O1 T2.6 — POST /v1/byom/:id/deploy) ── */
function pgDeployRate() {
  const gpu = $("#pgDeployGpu").value;
  const commit = $("#pgDeployCommit").value;
  return GPU_BASE_RATE[gpu] * COMMIT_MULT[commit];
}
function updatePgDeployPrice() {
  $("#pgDeployPricePreview").textContent = "$" + pgDeployRate().toFixed(2) + "/hr";
}
function openPgDeployModal() {
  const jobId = $("#pgJobId").value;
  if (!jobId) { toast("Chưa có BYOM job — mở Playground từ một model ready"); return; }
  const modelName = $("#pgModelName").textContent || "byom-model";
  const suggested = "byom-" + modelName.replace(/[^a-z0-9-]/gi, "-").toLowerCase().replace(/^-+|-+$/g, "").slice(0, 58);
  $("#pgDeployModelName").textContent = modelName;
  $("#pgDeployName").value = suggested;
  $("#pgDeployGpu").value = "H100";
  $("#pgDeployRegion").value = "HAN-2";
  $("#pgDeployCommit").value = "on-demand";
  $("#pgDeployMaxRep").value = "1";
  $("#pgDeployAllowSwap").checked = false;
  updatePgDeployPrice();
  $("#pgDeployModal").hidden = false;
  $("#pgDeployOverlay").hidden = false;
  $("#pgDeployName").focus();
}
function closePgDeployModal() {
  $("#pgDeployModal").hidden = true;
  $("#pgDeployOverlay").hidden = true;
}
async function submitPgDeploy(e) {
  e.preventDefault();
  const jobId = $("#pgJobId").value;
  const modelName = $("#pgModelName").textContent;
  if (!jobId) { toast("Thiếu jobId"); return; }
  const name = $("#pgDeployName").value.trim().toLowerCase().replace(/\s+/g, "-");
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(name)) {
    toast("Endpoint name chỉ chữ thường+số+gạch nối, 2-63 ký tự");
    $("#pgDeployName").focus();
    return;
  }
  const body = {
    name,
    gpu: $("#pgDeployGpu").value,
    region: $("#pgDeployRegion").value,
    commit: $("#pgDeployCommit").value,
    mode: "k8s",
    minReplicas: 1,
    maxReplicas: Math.max(1, parseInt($("#pgDeployMaxRep").value, 10) || 1),
    allowGpuSwap: !!$("#pgDeployAllowSwap").checked,
  };
  const btn = $("#pgDeploySubmit");
  btn.disabled = true;
  btn.textContent = "Deploying…";
  try {
    const res = await fetch(`/v1/byom/${encodeURIComponent(jobId)}/deploy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      // AC6/L4: 409 model đã deploy → hỏi đè
      if (res.status === 409 && /đã có endpoint|đã có/i.test(json.error || "")) {
        if (confirm(`Model "${modelName}" đã có endpoint. Deploy đè sẽ thu hồi endpoint cũ. Tiếp tục?`)) {
          // retry với query ?force=1 nếu backend hỗ trợ; nếu không thì yêu cầu user xóa trước
          const retry = await fetch(`/v1/byom/${encodeURIComponent(jobId)}/deploy?force=1`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const rj = await retry.json().catch(() => ({}));
          if (!retry.ok) { toast(`Vẫn lỗi ${retry.status}: ${rj.error || ""}`); return; }
          toast(`Đã đè endpoint cũ → "${rj.data?.name || name}" (queued)`);
          closePgDeployModal();
          closePlayground();
          await fetchByomJobs();
          await fetchDedicated();
          location.hash = "#/dedicated";
          return;
        }
        return;
      }
      toast(`Lỗi ${res.status}: ${json.error || ""}`);
      return;
    }
    toast(`Đã deploy ${modelName} → endpoint "${json.data?.name || name}" (queued)`);
    closePgDeployModal();
    closePlayground();
    await fetchByomJobs();
    await fetchDedicated();
    location.hash = "#/dedicated";
  } catch (err) {
    toast(`Network error: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = "Deploy endpoint";
  }
}
/* ── SLA & PTU view (gap: committed SLA + provisioned throughput + calculator) ── */
function ptuCalc() {
  const tpm = parseInt($("#ptuTpm").value, 10) || 0;
  const perPtu = 0.05;
  const ptu = Math.ceil(tpm / 1000);
  const serverlessEquiv = tpm * 0.0008 * 730;
  const ptuCost = ptu * perPtu * 60 * 730;
  const savings = serverlessEquiv > 0 ? Math.max(0, (1 - ptuCost / serverlessEquiv) * 100) : 0;
  $("#ptuOutUnits").textContent = ptu + " PTU";
  $("#ptuOutCost").textContent = "$" + ptuCost.toLocaleString("en-US", { maximumFractionDigits: 0 }) + "/mo";
  $("#ptuOutSrv").textContent = "$" + serverlessEquiv.toLocaleString("en-US", { maximumFractionDigits: 0 }) + "/mo";
  $("#ptuOutSave").textContent = savings.toFixed(0) + "%";
}

function renderSlaPtu() {
  $("#kpiSlaUptime").textContent = DATA.sla.uptime;
  $("#kpiSlaCredit").textContent = "3 tiers";
  $("#kpiPtuPlans").textContent = DATA.ptu.length;
  $("#kpiPtuRate").textContent = "$0.05/PTU";

  $("#slaCreditRows").innerHTML = DATA.sla.creditTiers.map((t) => `
    <tr>
      <td class="num">< ${esc(t.below)}%</td>
      <td><span class="savings">${esc(t.credit)}</span> service credit</td>
      <td style="color:var(--ink-faint)">${esc(t.desc)}</td>
    </tr>`).join("");

  $("#ptuRows").innerHTML = DATA.ptu.map((p) => `
    <tr>
      <td>${esc(p.plan)}</td>
      <td>${esc(p.model)}</td>
      <td class="num">${esc(p.tpm)}</td>
      <td class="num">$${esc(p.rate)}/hr</td>
      <td class="num">${esc(p.commit)}</td>
      <td><span class="status s-${esc(p.status === "trialing" ? "trialing" : "active")}">${statusLabel(p.status)}</span></td>
    </tr>`).join("");

  ptuCalc();
}

/* ── Experiments view (gap: A/B test + shadow) ── */
function renderExperiments() {
  const ab = DATA.experiments.filter((e) => e.type === "A/B").length;
  const shadow = DATA.experiments.length - ab;
  const running = DATA.experiments.filter((e) => e.status === "running").length;

  $("#kpiExpTotal").textContent = DATA.experiments.length;
  $("#kpiExpAb").textContent = ab;
  $("#kpiExpShadow").textContent = shadow;
  $("#kpiExpRunning").textContent = running;

  $("#expRows").innerHTML = DATA.experiments.map((e) => `
    <tr>
      <td class="num">${esc(e.name)}</td>
      <td><span class="mode-badge ${e.type === "A/B" ? "k8s" : "container"}">${esc(e.type)}</span></td>
      <td>${esc(e.control)}</td>
      <td class="num">${esc(e.variants)}</td>
      <td style="color:var(--ink-dim)">${esc(e.traffic)}</td>
      <td style="color:var(--ink-faint)">${esc(e.note)}</td>
      <td><span class="status s-${esc(e.status === "promoted" ? "active" : e.status === "paused" ? "paused" : "running")}">${statusLabel(e.status)}</span></td>
    </tr>`).join("");
}

/* ── Pricing view (gap: public transparent GPU/hr) ── */
function renderPricing() {
  const cheapest = "0.90";
  const discount = "−27%";

  $("#kpiPrCheap").textContent = "$" + cheapest + "/hr";
  $("#kpiPrDisc").textContent = discount;
  $("#kpiPrGpus").textContent = "4 tiers";
  $("#kpiPrVs").textContent = "−60% vs hyperscaler";

  $("#priceRows").innerHTML = DATA.pricingTiers.map((t) => `
    <tr>
      <td class="num">${esc(t.gpu)}</td>
      <td class="num">$${esc(t.onDemand)}</td>
      <td class="num">$${esc(t.d730)}</td>
      <td class="num">${t.d3190 === "—" ? '<span style="color:var(--ink-faint)">—</span>' : "$" + esc(t.d3190)}</td>
      <td class="num">${t.d180 === "—" ? '<span style="color:var(--ink-faint)">—</span>' : "$" + esc(t.d180)}</td>
      <td class="num" style="color:var(--ink-faint)">${t.hyperscaler === "n/a" ? "—" : "$" + esc(t.hyperscaler)}</td>
      <td style="color:var(--ink-faint)">${esc(t.note)}</td>
    </tr>`).join("");
}

/* ── US-06 Billing / Price packs ────────────── */
let bpkData = [];
async function renderBilling() {
  const seg = $("#bpkSegment") ? $("#bpkSegment").value : "";
  const url = "/v1/price-packs" + (seg ? "?segment=" + encodeURIComponent(seg) : "");
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const json = await res.json();
    bpkData = json.data || [];
  } catch (e) {
    bpkData = [];
  }
  const n = bpkData.length;
  $("#bpkCount").textContent = String(n);
  const avgRate = n ? bpkData.reduce((s, p) => s + (Number(p.ratePerHour) || 0), 0) / n : 0;
  $("#bpkAvgRate").textContent = "$" + avgRate.toFixed(2) + "/hr";
  const withQuota = bpkData.filter((p) => p.quotaRpm != null || p.quotaTpm != null).length;
  $("#bpkQuota").textContent = String(withQuota);
  const disc = bpkData.filter((p) => p.discountPct != null && Number(p.discountPct) > 0);
  const avgDisc = disc.length ? disc.reduce((s, p) => s + Number(p.discountPct), 0) / disc.length : 0;
  $("#bpkDiscount").textContent = avgDisc.toFixed(1) + "%";
  $("#bpkRows").innerHTML = bpkData.map((p) => `
    <tr>
      <td>${esc(p.segment)}</td>
      <td class="num">${esc(p.gpu)}</td>
      <td class="num">${esc(p.region)}</td>
      <td class="num">$${Number(p.ratePerHour).toFixed(2)}</td>
      <td class="num">${p.ratePerToken != null ? Number(p.ratePerToken).toExponential(2) : "—"}</td>
      <td>${esc(p.commitment || "on-demand")}</td>
      <td class="num">${p.discountPct != null && Number(p.discountPct) > 0 ? p.discountPct + "%" : "—"}</td>
      <td class="num">${p.quotaRpm != null ? p.quotaRpm : "—"}</td>
      <td class="num">${p.quotaTpm != null ? Number(p.quotaTpm).toLocaleString() : "—"}</td>
    </tr>`).join("");
  $("#bpkEmpty").hidden = n > 0;
}

/* ── US-07 Dashboard KPI ────────────────────── */
let dashData = null;
async function renderDashboard() {
  const seg = $("#dashSegment") ? $("#dashSegment").value : "";
  const range = $("#dashRange") ? $("#dashRange").value : "24h";
  const url = "/v1/dashboard?range=" + encodeURIComponent(range) + (seg ? "&segment=" + encodeURIComponent(seg) : "");
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    dashData = await res.json();
  } catch (e) {
    dashData = null;
  }
  const k = (dashData && dashData.kpis) || {};
  $("#dashRequests").textContent = k.requests != null ? Number(k.requests).toLocaleString() : "—";
  $("#dashRequestsSub").textContent = range + (seg ? " · " + seg : " · all");
  $("#dashCost").textContent = k.cost_usd != null ? "$" + Number(k.cost_usd).toFixed(2) : "—";
  $("#dashP95").textContent = k.p95_latency_ms != null ? Math.round(k.p95_latency_ms) + "ms" : "—";
  $("#dashErrRate").textContent = k.error_rate != null ? (Number(k.error_rate) * 100).toFixed(2) + "%" : "—";
  $("#dashGuard").textContent = k.guardrail_blocks != null ? String(k.guardrail_blocks) : "—";
  const rules = (dashData && dashData.guardrail_by_rule) || [];
  $("#dashGuardSub").textContent = rules.length + " rules";
  $("#dashGuardRules").innerHTML = rules.map((r) =>
    `<li><b>${esc(r.rule)}</b><span class="mono" style="margin-left:auto">${r.blocked}</span></li>`).join("");
  $("#dashGuardEmpty").hidden = rules.length > 0;
  const series = (dashData && dashData.series) || [];
  $("#dashSeriesRows").innerHTML = series.map((s) => `
    <tr>
      <td class="mono">${esc(s.ts)}</td>
      <td class="num">${Number(s.requests).toLocaleString()}</td>
      <td class="num">$${Number(s.cost_usd).toFixed(2)}</td>
      <td class="num">${s.p95_latency_ms != null ? Math.round(s.p95_latency_ms) + "ms" : "—"}</td>
    </tr>`).join("");
  $("#dashSeriesEmpty").hidden = series.length > 0;
  renderDashChart(series);
}

function renderDashChart(series) {
  const el = $("#dashChart");
  if (!el) return;
  if (!series || !series.length) {
    el.innerHTML = '<span class="dc-empty">Chưa có dữ liệu trong khoảng thời gian này.</span>';
    return;
  }
  const W = 560, H = 240, padL = 46, padR = 16, padT = 16, padB = 28;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const reqs = series.map((s) => Number(s.requests) || 0);
  const costs = series.map((s) => Number(s.cost_usd) || 0);
  const maxReq = Math.max.apply(null, reqs.concat([1]));
  const maxCost = Math.max.apply(null, costs.concat([1]));
  const n = series.length;
  const x = (i) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yReq = (v) => padT + plotH - (v / maxReq) * plotH;
  const yCost = (v) => padT + plotH - (v / maxCost) * plotH;
  const lineReq = series.map((s, i) => (i ? "L" : "M") + x(i).toFixed(1) + "," + yReq(Number(s.requests) || 0).toFixed(1)).join(" ");
  const lineCost = series.map((s, i) => (i ? "L" : "M") + x(i).toFixed(1) + "," + yCost(Number(s.cost_usd) || 0).toFixed(1)).join(" ");
  let grid = "";
  for (let g = 0; g <= 4; g++) {
    const gy = padT + (g / 4) * plotH;
    grid += `<line class="dc-grid" x1="${padL}" y1="${gy}" x2="${W - padR}" y2="${gy}"/>`;
  }
  const idxs = [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i);
  const xlabels = idxs.map((i) =>
    `<text class="dc-label" x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(String(series[i].ts).slice(5, 16))}</text>`).join("");
  const ylabels = [0, 0.5, 1].map((f) =>
    `<text class="dc-label" x="${padL - 6}" y="${(padT + plotH - f * plotH) + 3}" text-anchor="end">${Math.round(maxReq * f).toLocaleString()}</text>`).join("");
  el.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Requests and cost over time">
      ${grid}
      <line class="dc-axis" x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}"/>
      <path d="${lineReq}" fill="none" class="dc-line-req" stroke-width="2"/>
      <path d="${lineCost}" fill="none" class="dc-line-cost" stroke-width="2" stroke-dasharray="4 3"/>
      ${xlabels}
      ${ylabels}
    </svg>
    <div class="dc-legend">
      <span><i style="background:var(--nv)"></i>Requests</span>
      <span><i style="background:#7c5cff"></i>Cost (USD)</span>
    </div>`;
}

/* ── US-06 New pack modal ───────────────────── */
function openPackModal() {
  $("#packOverlay").hidden = false;
  $("#packModal").hidden = false;
  $("#pkSegment").value = "general";
  $("#pkGpu").value = "H100";
  $("#pkRegion").value = "HAN-1";
  $("#pkRate").value = "2.50";
  $("#pkRateToken").value = "0.0000005";
  $("#pkCommit").value = "on-demand";
  $("#pkDiscount").value = "0";
  $("#pkQuotaRpm").value = "";
  $("#pkQuotaTpm").value = "";
  $("#pkError").hidden = true;
}
function closePackModal() {
  $("#packOverlay").hidden = true;
  $("#packModal").hidden = true;
}
async function submitPack(e) {
  e.preventDefault();
  const body = {
    segment: $("#pkSegment").value,
    gpu: $("#pkGpu").value,
    region: $("#pkRegion").value,
    rate_per_hour: parseFloat($("#pkRate").value),
    rate_per_token: $("#pkRateToken").value ? parseFloat($("#pkRateToken").value) : 0,
    commitment: $("#pkCommit").value,
    discount_pct: parseFloat($("#pkDiscount").value) || 0,
    quota_rpm: $("#pkQuotaRpm").value ? parseInt($("#pkQuotaRpm").value, 10) : null,
    quota_tpm: $("#pkQuotaTpm").value ? parseInt($("#pkQuotaTpm").value, 10) : null,
  };
  try {
    const res = await fetch("/v1/price-packs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      $("#pkError").textContent = (json && json.error) || ("HTTP " + res.status);
      $("#pkError").hidden = false;
      return;
    }
    closePackModal();
    toast("Đã tạo gói giá " + body.segment + " / " + body.gpu + " / " + body.region);
    renderBilling();
  } catch (err) {
    $("#pkError").textContent = err.message;
    $("#pkError").hidden = false;
  }
}

/* ── US-07 Export CSV ───────────────────────── */
async function exportDashboardCsv() {
  const seg = $("#dashSegment") ? $("#dashSegment").value : "";
  const range = $("#dashRange") ? $("#dashRange").value : "24h";
  const url = "/v1/dashboard?range=" + encodeURIComponent(range) + (seg ? "&segment=" + encodeURIComponent(seg) : "") + "&format=csv";
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();
    const blob = new Blob([text], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "dashboard-" + (seg || "all") + "-" + range + ".csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  } catch (e) {
    toast("Lỗi xuất CSV: " + e.message);
  }
}

/* ── Developer tools view — parity+ vs Together AI ── */
let devtoolsTab = "cli";
let pgStreamTimer = null;
let pgCtx = { running: false };
let termHistory = [];
let termHistSel = -1;

function renderDevTools() {
  // KPI
  const totalRpm = 4000 + Math.floor(Math.random() * 1600);
  $("#kpiSdkLangs").textContent = "4";
  $("#kpiApiRpm").textContent = totalRpm.toLocaleString("en-US");
  $("#kpiApiRpmDelta").textContent = "↑ " + (Math.floor(Math.random() * 14) + 3) + "% vs last hour";
  $("#kpiSkillTotal").textContent = DATA.agentSkills.length;
  $("#kpiHeadRegions").textContent = DATA.headroom.length;

  renderCliTab();
  renderSdkTab();
  renderPlaygroundTab();
  fetchKeys();
  renderSkillsTab();
  renderHeadroomTab();
}

function renderCliTab() {
  $("#cliInstall").textContent = DATA.cli.install;

  const rowHtml = (list) => list.map((c) => `
    <div class="cli-cmd">
      <code class="mono">${esc(c.cmd)}</code>
      <span>${esc(c.desc)}</span>
    </div>`).join("");

  $("#cliCmds").innerHTML = rowHtml(DATA.cli.cmds);
  $("#cliCmds2").innerHTML = rowHtml(DATA.cli.cmds2);

  if (!termHistory.length) {
    termPrint("fpt-ddi v2.4.0 — type 'help' for commands, 'clear' to reset", "hint");
  }
}

function termPrint(text, cls) {
  const body = $("#termBody");
  const span = document.createElement("div");
  span.className = "term-line" + (cls ? " t-" + cls : "");
  span.textContent = text;
  body.appendChild(span);
  body.scrollTop = body.scrollHeight;
}

function termRun(line) {
  const cmd = line.trim();
  if (!cmd) return;
  termPrint("fpt ddi ❯ " + cmd, "cmd");
  termHistory.unshift(cmd);
  termHistSel = -1;
  const [sub, action, target] = cmd.toLowerCase().split(/\s+/);

  const cmds = {
    "help": () => termPrintLines([
      "Commands:",
      "  endpoint list                       List dedicated endpoints",
      "  endpoint create <name> —gpu H100    Create endpoint",
      "  endpoint scale <name> —replicas 4  Scale replicas",
      "  batch submit <file.jsonl>           Submit batch job (−50%)",
      "  batch status <job>                  Track batch progress",
      "  ft start —base glm-5.2 —method lora Start fine-tune",
      "  ft deploy <job>                     One-click deploy to endpoint",
      "  cluster create —gpu H200 —nodes 4  Provision bare-metal cluster",
      "  headroom —gpu H100                  Query capacity headroom",
      "  auth login                          Authenticate via FPT ID",
      "  configure                           Set default region & project",
      "  clear                               Clear terminal",
    ], "out"),
    "clear": () => { $("#termBody").innerHTML = ""; },
    "endpoint": () => {
      if (!action) return termPrint("endpoint: missing action (list | create | scale | logs)", "err");
      if (action === "list") {
        termPrintLines([
          "ID                          MODEL              GPU   REGION  REPLICAS  STATUS",
          ...DATA.dedicated.map((d) =>
            `${d.name.padEnd(27)} ${d.model.padEnd(18)} ${d.gpu.padEnd(5)} ${d.region.padEnd(7)} ${(d.rep + "").padEnd(8)} ${d.status}`),
          "", `→ ${DATA.dedicated.length} endpoints`
        ], "out");
      } else if (action === "create") {
        const re = /(--model\s+(\S+)|--gpu\s+(\S+)|--replicas\s+(\d+))/g;
        const m = Object.fromEntries([...cmd.matchAll(re)].map((x) => [x[1].split(/\s+/)[0].slice(2), x[2] || x[3] || x[4]]));
        const name = target || ("ep-" + Math.random().toString(36).slice(2, 8));
        termPrintLines([
          `✓ creating endpoint "${name}"`,
          `  model: ${m.model || "llama-4-maverick"}`,
          `  gpu:   ${m.gpu || "H100"}`,
          `  region: HAN-1`,
          "  ✓ manifests generated",
          "  ✓ pods scheduled on gpu-h100 pool",
          "  ▸ pulling weights from storage.fpt.vn (data residency ✓)",
          "  ▸ warming KV cache …",
          "  ✓ ready — endpoint https://api.ddi.fpt.vn/v1/" + name,
        ], "out");
      } else if (action === "scale") {
        termPrintLines([
          `✓ scaling ${target || "endpoint"} to ${m_of(cmd) || 4} replicas`,
          "  ✓ rollout progressing — 4/4 ready",
        ], "out");
      } else if (action === "logs") {
        termPrintLines([
          `[${new Date().toLocaleTimeString("en-GB")}] INFO  vllm: serving ${target || "endpoint"} on :8000`,
          "[…] INFO  router: 6 concurrent requests · p95 184ms",
          "[…] INFO  autoscaler: inflight=480 / 2000 — within target",
          "— streaming — Ctrl+C to stop (mock)",
        ], "out");
      } else {
        termPrint("endpoint: unknown action '" + action + "'", "err");
      }
    },
    "batch": () => {
      if (action === "submit") {
        termPrintLines([
          `✓ batch job submitted: ${target || "demo.jsonl"}`,
          "  requests: 100,000 (limit 100K/job)",
          "  discount: −50% vs serverless",
          "  window:   up to 24h",
          "  status:   queued → running (in ~3s)",
          "  → b-8f3a91 · track via: batch status b-8f3a91",
        ], "out");
      } else if (action === "status") {
        const job = target && DATA.batch.find((b) => b.job === target) ? DATA.batch.find((b) => b.job === target) : DATA.batch[0];
        termPrintLines([
          `job:      ${job.job}`,
          `model:    ${job.model}`,
          `requests: ${job.requests}`,
          `status:   ${job.status === "completed" ? "completed" : "running"}`,
          `window:   ${job.window}`,
          `savings:  ${job.savings} vs serverless`,
        ], "out");
      } else {
        termPrint("batch: missing action (submit | status)", "err");
      }
    },
    "ft": () => {
      if (action === "start") {
        const m = /--base\s+(\S+)/.exec(cmd);
        const base = m ? m[1] : "glm-5.2";
        const method = /--method\s+(\w+)/.exec(cmd);
        termPrintLines([
          `✓ fine-tune job started: ft-${Math.random().toString(36).slice(2, 8)}`,
          `  base:   ${base}`,
          `  method: ${(method && method[1]) || "lora"}`,
          "  ▸ allocating 4× H100 · multi-node enabled",
          "  → progress at: ft status <job>",
        ], "out");
      } else if (action === "deploy") {
        termPrintLines([
          `✓ deploying ${target || "<job>"} → dedicated endpoint`,
          "  ✓ adapter merged",
          "  ✓ weights staged to data-residency storage",
          "  ✓ endpoint running — https://api.ddi.fpt.vn/v1/" + (target || "ft-deployed"),
        ], "out");
      } else {
        termPrint("ft: missing action (start | deploy | status)", "err");
      }
    },
    "cluster": () => {
      const gpu = /--gpu\s+(\S+)/.exec(cmd);
      const nodes = /--nodes\s+(\d+)/.exec(cmd);
      termPrintLines([
        `✓ provisioning bare-metal cluster`,
        `  gpu:    ${(gpu && gpu[1]) || "H200"}`,
        `  nodes:  ${(nodes && nodes[1]) || 4}`,
        "  fabric: InfiniBand 400G",
        "  region: HAN-1",
        "  → cluster ready in ~12 min",
      ], "out");
    },
    "headroom": () => {
      const gpu = (/--gpu\s+(\S+)/.exec(cmd) || [, "H100"])[1];
      const region = /--region\s+(\S+)/.exec(cmd);
      termPrintLines([
        "REGION   H100  H200  B300  A30",
        ...DATA.headroom.map((h) =>
          `${h.region.padEnd(8)} ${String(h.h100).padEnd(5)} ${String(h.h200).padEnd(5)} ${String(h.b300).padEnd(5)} ${h.a30}` +
          (region && h.region !== region[1] ? "" : "")),
        "",
        `→ ${gpu === "H100" ? "HAN-1 has 6 H100 headroom for burst" : "HAN-2 has 3 H100 headroom"}`,
      ], "out");
    },
    "auth": () => termPrintLines([
      "Opening FPT ID for sign-in…",
      "✓ authenticated as thuan@fpt.ai — project: ddi-prod (HAN-1)",
    ], "out"),
    "configure": () => termPrintLines([
      "Default region [HAN-1]: HAN-1",
      "Default project [ddi-prod]: ddi-prod",
      "Output format [table]: table",
      "✓ saved to ~/.fpt-ddi/config.toml",
    ], "out"),
  };
  if (cmds[sub]) {
    cmds[sub]();
  } else if (sub) {
    termPrintLines([
      `command not found: ${sub}`,
      "type 'help' for available commands",
    ], "err");
  }
  $("#termBody").scrollTop = $("#termBody").scrollHeight;
}

function termPrintLines(lines, cls) {
  lines.forEach((l, i) => setTimeout(() => termPrint(l, cls), i * 90));
}

function m_of(cmd) {
  const m = /--replicas\s+(\d+)/.exec(cmd);
  return m ? m[1] : null;
}

function renderSdkTab() {
  const set = (id, txt) => { const el = $("#" + id); if (el) el.textContent = txt; };
  set("sdkOpenAi", DATA.sdk.openai);
  set("sdkPython", DATA.sdk.python);
  set("sdkTypescript", DATA.sdk.typescript);
  set("sdkGo", DATA.sdk.go);
  set("sdkRust", DATA.sdk.rust);

  $("#docList").innerHTML = DATA.docs.map((d) => `
    <a class="doc-card" href="#" data-doc="${esc(d.url)}">
      <b>${esc(d.title)}</b>
      <span>${esc(d.desc)}</span>
      <code class="mono">${esc(d.url)}</code>
    </a>`).join("");
}

let playgroundEndpoints = [];

async function fetchPlaygroundEndpoints() {
  try {
    const res = await fetch("/v1/endpoints?status=running");
    if (!res.ok) throw new Error("HTTP " + res.status);
    const json = await res.json();
    playgroundEndpoints = json.data || [];
  } catch (e) {
    console.warn("[playground] fetch endpoints lỗi:", e.message);
    playgroundEndpoints = [];
  }
  renderPlaygroundEndpoints();
}

function renderPlaygroundEndpoints() {
  const sel = $("#pgEndpoint");
  if (!sel) return;
  const cur = sel.value;
  const opts = [`<option value="">— Serverless (không qua endpoint) —</option>`]
    .concat(playgroundEndpoints.map((ep) =>
      `<option value="${esc(ep.id)}">${esc(ep.name)} · ${esc(ep.model)} · ${esc(ep.gpu)}</option>`));
  sel.innerHTML = opts.join("");
  if (cur && playgroundEndpoints.some((ep) => ep.id === cur)) sel.value = cur;
  // Model auto-fill theo endpoint chọn
  syncPlaygroundModel();
}

function syncPlaygroundModel() {
  const epId = $("#pgEndpoint") ? $("#pgEndpoint").value : "";
  if (epId) {
    const ep = playgroundEndpoints.find((e) => e.id === epId);
    if (ep) {
      const sel = $("#pgModel");
      const has = Array.from(sel.options).some((o) => o.value === ep.model || o.textContent === ep.model);
      if (!has) {
        const opt = document.createElement("option");
        opt.textContent = ep.model;
        sel.appendChild(opt);
      }
      sel.value = ep.model;
    }
  }
}

function renderPlaygroundTab() {
  const models = DATA.catalog.map((m) => m.model).concat(DATA.partners.map((p) => p.top));
  const unique = Array.from(new Set(models));
  if (!$("#pgModel").dataset.populated) {
    $("#pgModel").innerHTML = unique.map((m) => `<option>${esc(m)}</option>`).join("");
    $("#pgModel").value = "FPT-LLM 8B (vi)";
    $("#pgModel").dataset.populated = "1";
  }
  fetchPlaygroundEndpoints();
  updatePgCurl();
}

function updatePgCurl() {
  const model = $("#pgModel").value;
  const temp = $("#pgTemp").value;
  const maxTok = $("#pgMaxTok").value;
  const stream = $("#pgStream").checked;
  const system = $("#pgSystem").value;
  const prompt = $("#pgPrompt").value;
  const epId = $("#pgEndpoint") ? $("#pgEndpoint").value : "";
  const url = epId ? `/v1/endpoints/${epId}/chat/completions` : "/v1/chat/completions";
  const bodyObj = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    temperature: parseFloat(temp),
    max_tokens: parseInt(maxTok, 10),
    stream,
  };
  if ($("#pgStructured").checked) {
    try {
      const raw = $("#pgSchema").value.trim();
      const schema = raw ? JSON.parse(raw) : { type: "object" };
      bodyObj.response_format = { type: "json_schema", json_schema: { name: "pg_output", schema } };
    } catch (_) { /* schema lỗi — bỏ qua trong curl preview */ }
  }
  const body = JSON.stringify(bodyObj, null, 2);
  const curl = `curl ${location.origin}${url} \\
  -H "Authorization: Bearer $FPT_DDI_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${body.replace(/'/g, "'\\''")}'`;
  $("#pgCurl").textContent = curl;
}

const PG_RESPONSES = [
  "Dữ liệu của bạn ở Việt Nam. Inference dành riêng cho bạn.",
  "Dedicated GPU, không sharing, không rate limit — dữ liệu lưu tại Việt Nam.",
  "Reserved throughput cho BFSI: 99.9% SLA, latency thấp, data residency NĐ 13/2023.",
  "Hạ tầng FPT × NVIDIA: together-like features, một nửa giá, full data residency.",
];

async function runPlayground() {
  if (pgCtx.running) return;
  pgCtx.running = true;
  $("#pgRunBtn").disabled = true;
  $("#pgOutput").textContent = "";
  const epId = $("#pgEndpoint") ? $("#pgEndpoint").value : "";
  const target = epId ? `/v1/endpoints/${epId}/chat/completions` : "/v1/chat/completions";
  $("#pgMeta").textContent = `gọi ${target}…`;
  const t0 = performance.now();
  if (pgStreamTimer) { clearInterval(pgStreamTimer); pgStreamTimer = null; }

  const model = $("#pgModel").value;
  const system = $("#pgSystem").value;
  const prompt = $("#pgPrompt").value;
  const stream = $("#pgStream").checked;
  const maxTokens = parseInt($("#pgMaxTok").value, 10) || 512;
  const temp = parseFloat($("#pgTemp").value) || 0.7;
  const messages = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });

  // US-03 — structured output (JSON Schema)
  let response_format = null;
  if ($("#pgStructured").checked) {
    const raw = $("#pgSchema").value.trim();
    try {
      const schema = raw ? JSON.parse(raw) : { type: "object" };
      response_format = { type: "json_schema", json_schema: { name: "pg_output", schema } };
    } catch (e) {
      $("#pgOutput").textContent = "JSON Schema không hợp lệ: " + e.message;
      $("#pgMeta").textContent = "schema lỗi";
      pgCtx.running = false;
      $("#pgRunBtn").disabled = false;
      return;
    }
  }
  const pgBody = (extra) => Object.assign({ model, messages, temperature: temp, max_tokens: maxTokens }, extra, response_format ? { response_format } : {});

  try {
    if (stream) {
      const res = await fetch(target, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pgBody({ stream: true })),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        $("#pgOutput").textContent = `Lỗi ${res.status}: ${err.error?.message || ""}`;
        $("#pgMeta").textContent = `lỗi ${res.status}`;
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let total = 0;
      let buf = "";
      let usage = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          try {
            const obj = JSON.parse(data);
            if (obj.usage) usage = obj.usage;
            const delta = obj.choices?.[0]?.delta?.content || "";
            if (delta) { $("#pgOutput").textContent += delta; total += delta.length; }
          } catch (_) {}
        }
      }
      const ms = Math.round(performance.now() - t0);
      const toks = usage?.total_tokens ?? Math.ceil(total / 4);
      const epLabel = res.headers.get("x-endpoint-id") ? ` · endpoint ${res.headers.get("x-endpoint-id")}` : "";
      $("#pgMeta").textContent = `✓ stream · ${toks} tok · ${(ms / 1000).toFixed(2)}s · ${(toks / (ms / 1000)).toFixed(1)} tok/s${epLabel}`;
    } else {
      const res = await fetch(target, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pgBody({ stream: false })),
      });
      const json = await res.json();
      if (!res.ok) {
        $("#pgOutput").textContent = `Lỗi ${res.status}: ${json.error?.message || ""}`;
        $("#pgMeta").textContent = `lỗi ${res.status}`;
        return;
      }
      const content = json.choices?.[0]?.message?.content || "";
      $("#pgOutput").textContent = content;
      const toks = json.usage?.total_tokens || 0;
      const cost = json.cost_usd || "0.000000";
      const epLabel = json.endpoint ? ` · endpoint ${json.endpoint.name}` : "";
      $("#pgMeta").textContent = `✓ ${toks} tok · $${cost} · ${json.model}${epLabel}`;
    }
  } catch (e) {
    $("#pgOutput").textContent = `Network error: ${e.message}`;
    $("#pgMeta").textContent = "network error";
  } finally {
    pgCtx.running = false;
    $("#pgRunBtn").disabled = false;
  }
}

let apiKeys = [];

async function fetchKeys() {
  try {
    const res = await fetch("/v1/keys");
    if (!res.ok) throw new Error("HTTP " + res.status);
    const json = await res.json();
    apiKeys = json.data || [];
  } catch (e) {
    console.warn("[keys] fetch lỗi:", e.message);
    apiKeys = [];
  }
  renderKeysTab();
}

function renderKeysTab() {
  $("#keyCountLbl").textContent = `${apiKeys.length} keys · ${apiKeys.filter((k) => k.status === "active").length} active`;
  if (!apiKeys.length) {
    $("#keyRows").innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--ink-faint);padding:30px">Chưa có API key. Bấm "+ Create API key" để tạo.</td></tr>`;
  } else {
    $("#keyRows").innerHTML = apiKeys.map((k) => `
      <tr>
        <td>${esc(k.name)}</td>
        <td class="mono"><span class="key-prefix">${esc(k.keyPrefix)}</span><span class="key-mask">••••••••</span></td>
        <td>${(k.scopes || []).map((s) => `<span class="scope-chip">${esc(s)}</span>`).join(" ")}</td>
        <td>
          <select class="key-role-select" data-key-id="${esc(k.id)}" data-key-name="${esc(k.name)}" title="Cập nhật role (PATCH /v1/keys/:id)">
            <option value="admin" ${k.role === "admin" ? "selected" : ""}>admin</option>
            <option value="operator" ${k.role === "operator" ? "selected" : ""}>operator</option>
            <option value="viewer" ${!k.role || k.role === "viewer" ? "selected" : ""}>viewer</option>
          </select>
        </td>
        <td class="num">${esc((k.createdAt || "").slice(0, 10))}</td>
        <td class="num">${k.lastUsedAt ? esc(k.lastUsedAt.slice(11, 19)) : '<span style="color:var(--ink-faint)">—</span>'}</td>
        <td><span class="status s-${k.status === "revoked" ? "failed" : "running"}">${k.status === "revoked" ? "Revoked" : "Active"}</span></td>
        <td>
          ${k.status === "active"
            ? `<button class="btn btn-ghost btn-sm" data-action="key-scopes" data-key-id="${esc(k.id)}" style="margin-right:4px">Scopes</button><button class="btn btn-ghost btn-sm" data-action="key-revoke" data-key-id="${esc(k.id)}">Revoke</button>`
            : `<button class="btn btn-ghost btn-sm" data-action="key-del" data-key-id="${esc(k.id)}">Delete</button>`}
        </td>
      </tr>`).join("");
  }

  $("#fkScopeList").innerHTML = `
    <label class="checkbox-pill" style="grid-column:1/-1;font-weight:600">
      <input type="checkbox" id="fkScopeAll">
      <span>Select all (${DATA.apiKeyScopes.length} scopes)</span>
    </label>` + DATA.apiKeyScopes.map((s) => `
    <label class="checkbox-pill">
      <input type="checkbox" value="${esc(s)}" class="fk-scope-item" ${["chat", "endpoints"].includes(s) ? "checked" : ""}>
      <span>${esc(s)}</span>
    </label>`).join("");
  const allBox = $("#fkScopeAll");
  const items = $("#fkScopeList").querySelectorAll(".fk-scope-item");
  const syncAll = () => { allBox.checked = Array.from(items).every((c) => c.checked); };
  const setAll = (v) => { items.forEach((c) => { c.checked = v; }); };
  allBox.addEventListener("change", () => { setAll(allBox.checked); });
  items.forEach((c) => c.addEventListener("change", syncAll));
  syncAll();
}

function openKeyModal() {
  $("#fkName").value = "";
  const roleSel = $("#fkRole"); if (roleSel) roleSel.value = "viewer";
  $("#fkScopeList").querySelectorAll(".fk-scope-item").forEach((c) => {
    c.checked = ["chat", "endpoints"].includes(c.value);
  });
  const allBox = $("#fkScopeAll");
  if (allBox) {
    const items = $("#fkScopeList").querySelectorAll(".fk-scope-item");
    allBox.checked = Array.from(items).every((c) => c.checked);
  }
  $("#keyModal").hidden = false;
  $("#keyModalOverlay").hidden = false;
  $("#fkName").focus();
}

function closeKeyModal() {
  $("#keyModal").hidden = true;
  $("#keyModalOverlay").hidden = true;
}

async function submitKey(e) {
  e.preventDefault();
  const name = $("#fkName").value.trim();
  if (!name) { toast("Key name is required"); return; }
  const scopes = Array.from($("#fkScopeList").querySelectorAll(".fk-scope-item:checked")).map((c) => c.value);
  if (!scopes.length) { toast("Select at least one scope"); return; }
  const role = $("#fkRole").value || "viewer";

  const btn = $("#keyForm").querySelector("button[type=submit]");
  if (btn) { btn.disabled = true; btn.textContent = "Creating…"; }
  try {
    const res = await fetch("/v1/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, scopes, role }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast(`Lỗi ${res.status}: ${json.error || ""}`);
      return;
    }
    closeKeyModal();
    await fetchKeys();
    $("#keyRevealVal").textContent = json.full_key;
    $("#keyReveal").hidden = false;
    $("#keyRevealOverlay").hidden = false;
    toast(`API key "${name}" created — copy it now`);
  } catch (err) {
    toast(`Network error: ${err.message}`);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Create key"; }
  }
}

function closeKeyReveal() {
  $("#keyReveal").hidden = true;
  $("#keyRevealOverlay").hidden = true;
  $("#keyRevealVal").textContent = "";
}

async function revokeKey(id) {
  try {
    const res = await fetch(`/v1/keys/${encodeURIComponent(id)}/revoke`, { method: "POST" });
    if (!res.ok) { const j = await res.json().catch(() => ({})); toast(`Lỗi: ${j.error || res.status}`); return; }
    toast(`Key revoked`);
    await fetchKeys();
  } catch (e) { toast(`Network error: ${e.message}`); }
}

async function deleteKey(id) {
  try {
    const res = await fetch(`/v1/keys/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) { const j = await res.json().catch(() => ({})); toast(`Lỗi: ${j.error || res.status}`); return; }
    toast(`Key removed`);
    await fetchKeys();
  } catch (e) { toast(`Network error: ${e.message}`); }
}

async function editKeyScopes(id) {
  const k = apiKeys.find((x) => x.id === id);
  if (!k) return;
  const allScopes = DATA.apiKeyScopes;
  const cur = k.scopes || [];
  const checked = allScopes.map((s) => cur.includes(s) ? "x" : " ").join("");
  const input = prompt(
    `Edit scopes cho key "${k.name}". Gõ tên scope cách nhau bởi dấu phẩy.\n\nScope khả dụng: ${allScopes.join(", ")}\nScope hiện tại: ${cur.join(", ")}`,
    cur.join(", ")
  );
  if (input === null) return;
  const next = input.split(",").map((s) => s.trim().toLowerCase()).filter((s) => allScopes.includes(s));
  if (!next.length) { toast("Phải chọn ít nhất 1 scope"); return; }
  try {
    const res = await fetch(`/v1/keys/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scopes: next }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { toast(`Lỗi: ${j.error || res.status}`); return; }
    toast(`Đã cập nhật scope: ${next.join(", ")}`);
    await fetchKeys();
  } catch (e) { toast(`Network error: ${e.message}`); }
}

// US-10 — PATCH /v1/keys/:id cập nhật role
async function updateKeyRole(id, role) {
  if (!role) return;
  try {
    const res = await fetch(`/v1/keys/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { toast(`Lỗi: ${j.error || res.status}`); await fetchKeys(); return; }
    toast(`Đã cập nhật role → ${role}`);
    await fetchKeys();
  } catch (e) { toast(`Network error: ${e.message}`); await fetchKeys(); }
}

function renderSkillsTab() {
  const avail = DATA.agentSkills.filter((a) => a.status === "available").length;
  $("#skillCards").innerHTML = DATA.agentSkills.map((s, i) => {
    const invocations = s.invocations.toLocaleString("en-US");
    return `<div class="card skill-card" data-skill="${i}">
      <div class="skill-head">
        <span class="card-tag ${s.status === "available" ? "" : "t-amber"}">${esc(s.name)}</span>
        <span class="status s-${s.status === "available" ? "active" : "trialing"}">${s.status === "available" ? "Available" : "Beta"}</span>
      </div>
      <p>${esc(s.desc)}</p>
      <div class="card-stats">
        <div><b>${invocations}</b><span>invocations</span></div>
        <div><b>${esc(s.lastRun)}</b><span>last run</span></div>
      </div>
      <button class="btn btn-primary btn-sm skill-invoke" data-action="skill-invoke" data-skill="${i}">Invoke</button>
    </div>`;
  }).join("");

  const mcp = {
    type: "function",
    function: {
      name: "fpt_ddi_endpoint_ops",
      description: "List, scale, start, or stop dedicated inference endpoints on FPT DDI.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "scale", "start", "stop"] },
          name: { type: "string", description: "Endpoint name (omit for list)" },
          replicas: { type: "integer", description: "Target replica count (for scale)" },
          model: { type: "string", description: "Model ID (for start)" },
          gpu: { type: "string", enum: ["A30", "H100", "H200", "B300"] },
          region: { type: "string", enum: ["HAN-1", "HAN-2", "SGN-1"] },
        },
      },
    },
  };
  $("#skillMcp").textContent = JSON.stringify(mcp, null, 2);
}

async function invokeSkill(i) {
  const s = DATA.agentSkills[i];
  if (!s) return;
  const btn = document.querySelector(`[data-action='skill-invoke'][data-skill='${i}']`);
  if (btn) { btn.disabled = true; btn.textContent = "Invoking…"; }

  skillLogClear();
  $("#skillLogLive").textContent = `invoking ${s.name}…`;
  skillLog(`▸ invoking skill ${s.name} (gọi zenflow backend thật)`, "cmd");

  let runId = null;
  try {
    const res = await fetch(`/v1/skills/${encodeURIComponent(s.name)}/invoke`);
    const json = await res.json();
    if (!res.ok) {
      skillLog(`✗ invoke lỗi: ${json.error || res.status}`, "err");
      toast(`Invoke thất bại: ${json.error || res.status}`);
      $("#skillLogLive").textContent = "invoke lỗi";
      return;
    }
    runId = json.id;
    s.invocations++;
    s.lastRun = "just now";
    renderSkillsTab();
    toast(`Skill "${s.name}" invoked — run ${runId}`);
  } catch (e) {
    skillLog(`✗ network error: ${e.message}`, "err");
    toast(`Network error: ${e.message}`);
    $("#skillLogLive").textContent = "network error";
    return;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Invoke"; }
  }

  $("#skillLogLive").textContent = `running • ${runId}`;

  let lastSeen = 0;
  let run = null;
  for (let attempt = 0; attempt < 90; attempt++) {
    let json;
    try {
      const r = await fetch(`/v1/skills/runs/${encodeURIComponent(runId)}`);
      json = await r.json();
    } catch (_) { await sleep(800); continue; }
    run = json.data;
    if (!run) break;
    const events = run.events || [];
    while (lastSeen < events.length) {
      const e = events[lastSeen++];
      renderSkillEvent(s.name, e);
    }
    if (run.status === "completed" || run.status === "failed") {
      skillLog(`✓ skill ${s.name} → ${run.status} (exitCode=${run.exitCode ?? "n/a"})`, run.status === "completed" ? "out" : "err");
      const statusIcon = run.status === "completed" ? "✓" : "✗";
      $("#skillLogLive").textContent = `${statusIcon} ${run.status} • ${run.events?.length || 0} events • ${run.exitCode ?? "n/a"}`;
      break;
    }
    await sleep(700);
  }
  if (run && run.status === "running") $("#skillLogLive").textContent = "timeout (vẫn running)";
}

function skillLog(text, cls) {
  const body = $("#skillLogBody");
  if (!body) return;
  const span = document.createElement("div");
  span.className = "term-line" + (cls ? " t-" + cls : "");
  span.textContent = text;
  body.appendChild(span);
  body.scrollTop = body.scrollHeight;
}

function skillLogClear() {
  const body = $("#skillLogBody");
  if (body) body.innerHTML = "";
  $("#skillLogLive").textContent = "idle";
}

function skillTime(ts) {
  const d = ts ? new Date(ts) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour12: false });
}

function renderSkillEvent(skillName, e) {
  const ts = skillTime(e.timestamp);
  switch (e.type) {
    case "plan_ready":
      skillLog(`${ts}  plan ready — ${skillName}`, "hint");
      break;
    case "workflow_start":
      skillLog(`${ts}  workflow start · ${e.data?.total || "?"} steps`, "out");
      break;
    case "step_start":
      skillLog(`${ts}  ▸ ${e.stepId} (${(e.data?.index ?? 0) + 1}/${e.data?.total ?? "?"})`, "out");
      break;
    case "step_end":
      skillLog(`${ts}  ✓ ${e.stepId} (${e.duration || ""})`, "out");
      break;
    case "tool_call":
      if (e.data?.phase === "start") skillLog(`${ts}  ↳ tool: ${e.data?.tool || "?"}`, "hint");
      break;
    case "coordinator_narration":
    case "coordinator_message":
      skillLog(`${ts}  ≋ ${e.message || e.type}`, "hint");
      break;
    case "message_dropped":
      skillLog(`${ts}  ⚠ message dropped: ${e.data?.reason}`, "err");
      break;
    case "error":
      skillLog(`${ts}  ✗ error: ${e.message || e.error}`, "err");
      break;
    case "workflow_end":
      skillLog(`${ts}  workflow end · tokens=${e.tokens?.TotalTokens || 0} · ${e.duration || ""}`, "out");
      break;
    case "process_exit":
      skillLog(`${ts}  zenflow exited (${e.exitCode})`, "hint");
      break;
    case "stderr":
    case "raw":
      if (e.message && e.message.trim()) {
        skillLog(`${ts}  ${e.type}: ${e.message.trim().slice(0, 120)}`, "hint");
      }
      break;
  }
}

async function downloadBatchOutput(jobId) {
  try {
    const res = await fetch(`/v1/batch/${encodeURIComponent(jobId)}/output`);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast(`Lỗi ${res.status}: ${j.error || ""}`);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${jobId}-output.jsonl`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast(`Đã tải ${jobId}-output.jsonl`);
  } catch (e) {
    toast(`Network error: ${e.message}`);
  }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function fetchActiveRun() {
  skillLog(`▸ poll — lấy run mới nhất từ backend`, "cmd");
  let json;
  try {
    const r = await fetch("/v1/skills/runs");
    json = await r.json();
  } catch (e) {
    skillLog(`✗ network error: ${e.message}`, "err");
    return;
  }
  const runs = json.data || [];
  if (!runs.length) {
    skillLog("— chưa có run nào. Bấm Invoke trên một skill ở trên để tạo run.", "hint");
    $("#skillLogLive").textContent = "no runs";
    return;
  }
  const latest = runs[0];
  skillLog(`▸ run mới nhất: ${latest.id} (${latest.skill}) — ${latest.status}, ${latest.eventCount} events`, "out");
  // tải events đầy đủ
  const evRes = await fetch(`/v1/skills/runs/${encodeURIComponent(latest.id)}/events`);
  const evJson = await evRes.json();
  const events = evJson.data || [];
  skillLogClear();
  skillLog(`▸ replay ${events.length} events từ run ${latest.id}`, "cmd");
  for (const e of events) renderSkillEvent(latest.skill, e);
  skillLog(`✓ replay xong — ${latest.status}`, latest.status === "completed" ? "out" : "err");
  $("#skillLogLive").textContent = `replay • ${latest.id} • ${latest.status}`;
}

function renderHeadroomTab() {
  $("#headRows").innerHTML = DATA.headroom.map((h) => `
    <tr>
      <td class="num">${esc(h.region)}</td>
      <td class="num">${h.h100}</td>
      <td class="num">${h.h200}</td>
      <td class="num">${h.b300}</td>
      <td class="num">${h.a30}</td>
      <td><span class="status s-${esc(h.status === "pilot" ? "trialing" : "active")}">${statusLabel(h.status)}</span></td>
      <td style="color:var(--ink-faint)">${esc(h.note)}</td>
    </tr>`).join("");

  $("#headReq").textContent = `GET /v1/headroom?gpu=H100 HTTP/1.1
Host: api.ddi.fpt.vn
Authorization: Bearer ddi-live-••••••••
Accept: application/json`;

  const json = JSON.stringify({
    gpu: "H100",
    regions: DATA.headroom.map((h) => ({
      region: h.region,
      available: h.h100,
      status: h.status,
      recommended_for: h.note,
    })),
    note: "Capacity for burst & new endpoint placement. Refreshed every 60s.",
  }, null, 2);
  $("#headResp").textContent = `HTTP/1.1 200 OK
Content-Type: application/json

${json}`;
}

function copyToClipboard(id) {
  const el = $("#" + id);
  if (!el) return;
  const text = el.textContent;
  const done = () => toast("Copied to clipboard");
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
}

function copyToClipboardValue(text) {
  const done = () => toast("Copied to clipboard");
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
}

function fallbackCopy(text, done) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); done(); } catch (_) {}
  ta.remove();
}

/* ── NVIDIA NIM catalog (US-01 / WF-01) — live từ GET /v1/catalog ── */
let nimCatalog = [];
let nimFilters = { segment: "", source: "", gpu: "" };

async function fetchNimCatalog() {
  const params = new URLSearchParams();
  if (nimFilters.segment) params.set("segment", nimFilters.segment);
  if (nimFilters.source) params.set("source", nimFilters.source);
  if (nimFilters.gpu) params.set("gpu", nimFilters.gpu);
  const qs = params.toString();
  try {
    const res = await fetch("/v1/catalog" + (qs ? "?" + qs : ""));
    if (!res.ok) throw new Error("HTTP " + res.status);
    const json = await res.json();
    nimCatalog = json.data || [];
  } catch (e) {
    console.warn("[nim] fetch lỗi:", e.message);
    nimCatalog = DATA.nimCatalog;
  }
  renderNimCatalog();
}

function nimSrcLabel(s) {
  return { nim: "NVIDIA NIM", nvidia_nim: "NVIDIA NIM", huggingface: "Hugging Face", fpt: "FPT" }[s] || s || "—";
}

function nimCtxLabel(n) {
  const num = parseInt(n, 10);
  if (!num) return "—";
  return (num >= 1000 ? (num / 1000) + "K" : num) + " tok";
}

function renderNimCatalog() {
  const total = nimCatalog.length;
  const segs = Array.from(new Set(nimCatalog.flatMap((m) => m.segments || [])));
  const maxCtx = nimCatalog.reduce((mx, m) => Math.max(mx, parseInt(m.maxContext, 10) || 0), 0);
  $("#kpiNimTotal").textContent = total;
  $("#kpiNimSegments").textContent = segs.length ? segs.join(" · ") : "—";
  $("#kpiNimCtx").textContent = maxCtx ? nimCtxLabel(maxCtx) : "—";
  $("#kpiNimSource").textContent = Array.from(new Set(nimCatalog.map((m) => m.source).filter(Boolean))).map(nimSrcLabel).join(" · ") || "—";

  if (!total) {
    $("#nimRows").innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--ink-faint);padding:30px">Không có model NIM trong catalog.</td></tr>`;
    $("#nimEmpty").hidden = true;
    return;
  }
  $("#nimRows").innerHTML = nimCatalog.map((m) => {
    const gpus = (m.gpuCompatible || []).map((g) => `<span class="scope-chip">${esc(g)}</span>`).join(" ");
    const segsBadges = (m.segments || []).map((s) => `<span class="mode-badge k8s">${esc(s)}</span>`).join(" ");
    return `<tr data-nim-id="${esc(m.id)}">
      <td><b>${esc(m.name)}</b>${m.family ? `<div class="mono" style="font-size:10.5px;color:var(--ink-faint)">${esc(m.family)}</div>` : ""}</td>
      <td>${segsBadges || '<span style="color:var(--ink-faint)">—</span>'}</td>
      <td>${esc(nimSrcLabel(m.source))}</td>
      <td class="num">${m.nimVersion ? esc(m.nimVersion) : '<span style="color:var(--ink-faint)">—</span>'}</td>
      <td>${gpus || '<span style="color:var(--ink-faint)">—</span>'}</td>
      <td class="num">${nimCtxLabel(m.maxContext)}</td>
      <td><span class="status s-${m.status === "available" ? "running" : "paused"}">${statusLabel(m.status)}</span></td>
      <td><button class="btn btn-primary btn-sm" data-action="nim-deploy" data-id="${esc(m.id)}">Deploy</button></td>
    </tr>`;
  }).join("");
  $("#nimEmpty").hidden = true;
}

// Mở modal deploy (WF-02) prefill từ model catalog
function openDeployFromCatalog(modelId) {
  const m = nimCatalog.find((x) => x.id === modelId);
  if (!m) return;
  const sel = $("#fModel");
  const has = Array.from(sel.options).some((o) => o.textContent === m.name || o.value === m.name);
  if (!has) {
    const opt = document.createElement("option");
    opt.textContent = m.name;
    sel.appendChild(opt);
  }
  sel.value = m.name;
  $("#fName").value = (m.name || "nim-model").toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "").slice(0, 58);
  const gpu = (m.gpuCompatible && m.gpuCompatible[0]) || "H100";
  const gpuSel = $("#fGpu");
  if (Array.from(gpuSel.options).some((o) => o.value === gpu)) gpuSel.value = gpu;
  const seg = (m.segments && m.segments[0]) || "general";
  const segSel = $("#fSegment");
  if (segSel && Array.from(segSel.options).some((o) => o.value === seg)) segSel.value = seg;
  const engSel = $("#fEngine");
  if (engSel && (m.source === "nim" || m.source === "nvidia_nim")) engSel.value = "nim";
  const cp = $("#fCodePrivacy"); if (cp) cp.checked = false;
  const gt = $("#fGuardrailsTemplate"); if (gt) gt.value = "";
  setMode("k8s");
  updatePricePreview();
  $("#createModal").hidden = false;
  $("#modalOverlay").hidden = false;
  $("#fName").focus();
  toast(`Deploy ${m.name} — điền cấu hình rồi bấm Deploy`);
}

/* ── Audit log (US-05 / WF-03) — live từ GET /v1/audit ── */
let auditRowsData = [];
let auditFilters = { actor: "", action: "", range: "" };
let auditActorTimer = null;

function auditSince(range) {
  if (!range) return "";
  const map = { "1h": 3600e3, "24h": 86400e3, "7d": 7 * 86400e3 };
  return new Date(Date.now() - (map[range] || 0)).toISOString();
}

async function fetchAudit() {
  const params = new URLSearchParams();
  if (auditFilters.actor) params.set("actor", auditFilters.actor);
  if (auditFilters.action) params.set("action", auditFilters.action);
  const from = auditSince(auditFilters.range);
  if (from) params.set("from", from);
  params.set("limit", "200");
  const qs = params.toString();
  try {
    const res = await fetch("/v1/audit" + (qs ? "?" + qs : ""));
    if (!res.ok) throw new Error("HTTP " + res.status);
    const json = await res.json();
    auditRowsData = json.data || [];
  } catch (e) {
    console.warn("[audit] fetch lỗi:", e.message);
    auditRowsData = DATA.auditLog;
  }
  renderAudit();
}

function fmtAuditTs(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString("en-GB", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function renderAudit() {
  $("#auditCountLbl").textContent = `${auditRowsData.length} entries`;
  if (!auditRowsData.length) {
    $("#auditRows").innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--ink-faint);padding:30px">Không có audit entry. Cần key scope <code>admin</code> để xem log thật.</td></tr>`;
    $("#auditEmpty").hidden = true;
    return;
  }
  $("#auditRows").innerHTML = auditRowsData.map((a) => `
    <tr>
      <td class="mono" style="font-size:11px">${esc(fmtAuditTs(a.ts))}</td>
      <td>${esc(a.actor || "—")}</td>
      <td>${a.role ? `<span class="mode-badge ${a.role === "admin" ? "k8s" : a.role === "operator" ? "container" : ""}">${esc(a.role)}</span>` : '<span style="color:var(--ink-faint)">—</span>'}</td>
      <td class="mono" style="font-size:11px">${esc(a.action || "—")}</td>
      <td class="mono" style="font-size:11px">${a.entityId ? esc((a.entityType || "entity") + ":" + a.entityId) : '<span style="color:var(--ink-faint)">—</span>'}</td>
      <td><span class="status s-${a.result === "success" ? "running" : "failed"}">${esc(a.result)}</span></td>
      <td class="mono" style="font-size:11px">${esc(a.ip || "—")}</td>
    </tr>`).join("");
  $("#auditEmpty").hidden = true;
}

/* ── Guardrails (US-02 / WF-03) — PATCH + events trên chi tiết endpoint ── */
const GUARDRAIL_TEMPLATES = {
  banking: ["pii", "prompt_injection", "financial_advice"],
  insurance: ["pii", "prompt_injection", "financial_advice", "medical"],
  general: ["pii", "prompt_injection"]
};
const GUARDRAIL_RULE_LABEL = {
  pii: "Chặn PII (CCCD/CMND)",
  prompt_injection: "Chặn prompt injection",
  financial_advice: "Chặn lời khuyên tài chính trái phép",
  medical: "Chặn thông tin y tế"
};

async function saveGuardrails(id) {
  const enabled = $("#grEnabled").checked;
  const template = $("#grTemplate").value;
  const rules = Array.from(document.querySelectorAll("#grRules input:checked")).map((c) => c.value);
  try {
    const r = await fetch(`/v1/endpoints/${encodeURIComponent(id)}/guardrails`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled, template, rules }),
    });
    const j = await r.json();
    if (!r.ok) { toast(`Lỗi ${r.status}: ${j.error || ""}`); return; }
    toast(`Guardrails ${enabled ? "bật" : "tắt"} (${template}) — ${rules.length} rules`);
    fetchGuardrailEvents(id);
    fetchDedicated();
  } catch (e) { toast(`Network error: ${e.message}`); }
}

async function fetchGuardrailEvents(id) {
  const box = $("#grEventsBox");
  const cnt = $("#grBlockedCount");
  if (!box && !cnt) return;
  let total = 0, byRule = [];
  try {
    const r = await fetch(`/v1/endpoints/${encodeURIComponent(id)}/guardrails/events`);
    if (r.ok) {
      const j = await r.json();
      const d = j.data || {};
      byRule = d.rules || [];
      total = byRule.reduce((s, x) => s + (x.blocked || 0), 0);
    }
  } catch (e) { console.warn("[gr] events lỗi:", e.message); }
  if (cnt) cnt.textContent = total;
  if (box) {
    box.innerHTML = byRule.length
      ? byRule.map((x) => `<span class="scope-chip">${esc(x.rule)}: ${x.blocked}</span>`).join(" ")
      : '<span style="color:var(--ink-faint)">Chưa có sự kiện bị chặn.</span>';
  }
}

/* ── Routing ───────────────────────────────── */
const VIEWS = ["overview", "dashboard", "nvidia", "partners", "catalog", "nim", "serverless", "dedicated", "fine-tuning", "batch", "experiments", "sla-ptu", "pricing", "billing", "infra", "devtools", "audit"];

function route() {
  const hash = (location.hash || "#/overview").replace("#/", "");
  const view = VIEWS.includes(hash) ? hash : "overview";
  VIEWS.forEach((v) => { $("#view-" + v).hidden = v !== view; });
  document.querySelectorAll(".rail-item").forEach((a) => {
    a.classList.toggle("is-active", a.dataset.view === view);
  });
  $("#main").focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

/* ── Init ──────────────────────────────────── */
async function init() {
  // Đảm bảo có key hợp lệ TRƯỚC khi fetch operational (tự tạo demo key nếu chưa có)
  await ensureKey();
  // Load toàn bộ data thật từ Postgres → ghi đè DATA.* mock, rồi re-render tất cả
  loadAllRealData().catch((e) => console.warn("[init] loadAllRealData lỗi:", e.message)).finally(() => {
    renderFleet();
    renderOverview();
    renderNvidia();
    renderPartners();
    renderCatalog();
    renderServerless();
    renderFineTuning();
    renderExperiments();
    renderSlaPtu();
    renderPricing();
    renderBilling();
    renderDashboard();
    renderInfra();
    renderDevTools();
  });
  fetchDedicated();
  fetchBatchJobs();
  fetchKeys();
  fetchColdStart();
  renderWorkflow("k8s");
  route();
  window.addEventListener("hashchange", route);

  // US-06 — price packs: filter + refresh + new pack
  $("#bpkSegment").addEventListener("change", () => renderBilling().catch((e) => console.warn("[billing]", e.message)));
  $("#bpkRefresh").addEventListener("click", () => renderBilling().catch((e) => console.warn("[billing]", e.message)));
  $("#bpkNewBtn").addEventListener("click", openPackModal);

  // US-07 — dashboard: segment + range + refresh + csv
  $("#dashSegment").addEventListener("change", () => renderDashboard().catch((e) => console.warn("[dashboard]", e.message)));
  $("#dashRange").addEventListener("change", () => renderDashboard().catch((e) => console.warn("[dashboard]", e.message)));
  $("#dashRefresh").addEventListener("click", () => renderDashboard().catch((e) => console.warn("[dashboard]", e.message)));
  $("#dashCsv").addEventListener("click", exportDashboardCsv);

  // US-06 — pack modal: close + submit
  $("#packClose").addEventListener("click", closePackModal);
  $("#packOverlay").addEventListener("click", closePackModal);
  $("#packForm").addEventListener("submit", submitPack);

  // clock — 30s (đỡ tải) — dùng locale time, không cần tick từng giây
  const tick = () => { $("#clock").textContent = new Date().toLocaleTimeString("en-GB"); };
  tick();
  setInterval(tick, 30000);

  // live serverless figures — 8s, chỉ fetch khi đang xem view-serverless
  setInterval(() => { if (!$("#view-serverless").hidden) renderServerless().catch((e) => console.warn("[serverless] poll lỗi:", e.message)); }, 8000);

  // rail toggle
  $("#railToggle").addEventListener("click", () => {
    const collapsed = document.body.classList.toggle("rail-collapsed");
    $("#railToggle").setAttribute("aria-expanded", String(!collapsed));
  });

  // sync
  let syncCount = 0;
  $("#syncBtn").addEventListener("click", () => {
    syncCount++;
    renderFleet();
    renderServerless();
    $("#syncAgo").textContent = "0m";
    toast("Partner data synced — 0 conflicts");
  });

  // API key input — lưu vào localStorage, tự động đính kèm vào mọi fetch /v1/* operational
  if (ACTIVE_API_KEY) {
    $("#apiKeyInput").value = ACTIVE_API_KEY;
    $("#apiKeyInput").style.borderColor = "var(--nv)";
  }
  $("#apiKeySetBtn").addEventListener("click", async () => {
    const v = $("#apiKeyInput").value.trim();
    if (!v) {
      ACTIVE_API_KEY = "";
      localStorage.removeItem("fptDdiKey");
      $("#apiKeyInput").style.borderColor = "";
      setKeyBadge(null);
      toast("Đã xóa API key — các API operational sẽ trả 401");
      return;
    }
    // Xác thực key TRƯỚC khi lưu — tránh user set key sai/cũ rồi mới gặp 401
    setKeyBadge("check", "đang kiểm tra…");
    const r = await verifyKey(v);
    if (!r.ok || !r.json.valid) {
      $("#apiKeyInput").style.borderColor = "var(--err, #e5484d)";
      setKeyBadge("bad", "key không hợp lệ");
      toast("API key không hợp lệ hoặc đã bị thu hồi — chưa lưu. Kiểm tra lại key (đừng copy phần •••).");
      return;
    }
    ACTIVE_API_KEY = v;
    localStorage.setItem("fptDdiKey", v);
    $("#apiKeyInput").style.borderColor = "var(--nv)";
    setKeyBadge("ok", "✓ " + (r.json.name || "key hợp lệ"));
    toast("API key hợp lệ — " + (r.json.name || "đã lưu") + " · scopes: " + (r.json.scopes || []).join(", "));
    // re-fetch tất cả operational data ngay sau khi set key
    fetchDedicated();
    fetchBatchJobs();
    fetchKeys();
  });
  $("#apiKeyInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("#apiKeySetBtn").click();
  });

  // partner search + filters
  $("#partnerSearch").addEventListener("input", (e) => { partnerQuery = e.target.value; renderPartners(); });
  $("#partnerChips").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    partnerFilter = chip.dataset.filter;
    document.querySelectorAll("#partnerChips .chip").forEach((c) => c.classList.toggle("is-on", c === chip));
    renderPartners();
  });
  $("#addPartnerBtn").addEventListener("click", () => toast("Onboarding request drafted — partner team will follow up"));

  // partner drawer (click + keyboard)
  $("#partnerRows").addEventListener("click", (e) => {
    const row = e.target.closest("[data-partner]");
    if (row) openPartnerDrawer(row.dataset.partner);
  });
  $("#partnerRows").addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      const row = e.target.closest("[data-partner]");
      if (row) { e.preventDefault(); openPartnerDrawer(row.dataset.partner); }
    }
  });
  $("#drawerClose").addEventListener("click", closeDrawer);
  $("#drawerOverlay").addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeDrawer(); closeCreateModal(); } });

  // endpoint logs buttons
  $("#endpointRows").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action='logs']");
    if (btn) toast(`Streaming logs for ${btn.dataset.name} …`);
  });

  // dedicated inference
  $("#dedChips").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    dedFilter = chip.dataset.dedfilter;
    document.querySelectorAll("#dedChips .chip").forEach((c) => c.classList.toggle("is-on", c === chip));
    fetchDedicated();
  });
  $("#createEndpointBtn").addEventListener("click", openCreateModal);
  $("#modalClose").addEventListener("click", closeCreateModal);
  $("#modalOverlay").addEventListener("click", closeCreateModal);
  $("#fModeCards").addEventListener("change", (e) => setMode(e.target.value));
  $("#fGpu").addEventListener("change", updatePricePreview);
  $("#fSegment").addEventListener("change", updatePricePreview);
  $("#fRegion").addEventListener("change", updatePricePreview);

  // poll dedicated mỗi 8s khi đang xem view (để cập nhật lifecycle worker)
  if (dedPollTimer) clearInterval(dedPollTimer);
  dedPollTimer = setInterval(() => {
    if (!$("#view-dedicated").hidden) fetchDedicated();
  }, 8000);
  // T4.2 — poll p95 cold-start mỗi 30s (O4 asset) khi đang xem view-dedicated
  if (coldStartTimer) clearInterval(coldStartTimer);
  coldStartTimer = setInterval(() => {
    if (!$("#view-dedicated").hidden) fetchColdStart();
  }, 30000);
  $("#fCommit").addEventListener("change", updatePricePreview);
  $("#createForm").addEventListener("submit", submitEndpoint);
  $("#dedicatedRows").addEventListener("click", (e) => {
    const stopBtn = e.target.closest("[data-action='ded-stop']");
    if (stopBtn) { stopEndpoint(stopBtn.dataset.id); return; }
    const startBtn = e.target.closest("[data-action='ded-start']");
    if (startBtn) { startEndpoint(startBtn.dataset.id); return; }
    const delBtn = e.target.closest("[data-action='ded-del']");
    if (delBtn) { deleteEndpoint(delBtn.dataset.id); return; }
    // click vào hàng (không phải nút) → mở drawer chi tiết
    const row = e.target.closest("[data-endpoint-id]");
    if (row) openEndpointDrawer(row.dataset.endpointId);
  });
  $("#dedicatedRows").addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      const row = e.target.closest("[data-endpoint-id]");
      if (row) { e.preventDefault(); openEndpointDrawer(row.dataset.endpointId); }
    }
  });

  // catalog filters (gap #12 — model catalog)
  $("#catChips").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    catalogFilter = chip.dataset.catfilter;
    document.querySelectorAll("#catChips .chip").forEach((c) => c.classList.toggle("is-on", c === chip));
    renderCatalog();
  });

  // NVIDIA NIM catalog (US-01 / WF-01) — live từ /v1/catalog
  fetchNimCatalog();
  $("#nimSegment").addEventListener("change", (e) => { nimFilters.segment = e.target.value; fetchNimCatalog(); });
  $("#nimSource").addEventListener("change", (e) => { nimFilters.source = e.target.value; fetchNimCatalog(); });
  $("#nimGpu").addEventListener("change", (e) => { nimFilters.gpu = e.target.value; fetchNimCatalog(); });
  $("#nimRows").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action='nim-deploy']");
    if (btn) openDeployFromCatalog(btn.dataset.id);
  });

  // Audit log (US-05 / WF-03) — live từ /v1/audit
  fetchAudit();
  $("#auditActor").addEventListener("input", () => {
    clearTimeout(auditActorTimer);
    auditActorTimer = setTimeout(() => { auditFilters.actor = $("#auditActor").value.trim(); fetchAudit(); }, 400);
  });
  $("#auditAction").addEventListener("change", (e) => { auditFilters.action = e.target.value; fetchAudit(); });
  $("#auditRange").addEventListener("change", (e) => { auditFilters.range = e.target.value; fetchAudit(); });
  $("#auditRefresh").addEventListener("click", fetchAudit);

  $("#byomBtn").addEventListener("click", openByomModal);
  $("#byomModalClose").addEventListener("click", closeByomModal);
  $("#byomModalCloseFoot").addEventListener("click", closeByomModal);
  $("#byomModalOverlay").addEventListener("click", closeByomModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("#byomModal").hidden) closeByomModal();
    if (e.key === "Escape" && !$("#playgroundModal").hidden) closePlayground();
  });

  // Playground chat (O1)
  $("#playgroundClose").addEventListener("click", closePlayground);
  $("#playgroundOverlay").addEventListener("click", closePlayground);
  $("#pgSend").addEventListener("click", pgSend);
  $("#pgInput").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); pgSend(); } });
  $("#pgClearChat").addEventListener("click", pgClear);
  $("#pgDeploy").addEventListener("click", pgDeploy);
  $("#pgTemp").addEventListener("input", (e) => { $("#pgTempVal").textContent = e.target.value; buildSnippet(); });
  $("#pgSystem").addEventListener("input", () => buildSnippet());
  $("#pgMaxTok").addEventListener("input", () => buildSnippet());
  document.querySelectorAll(".pg-snippet-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".pg-snippet-tab").forEach((t) => t.setAttribute("aria-pressed", "false"));
      tab.setAttribute("aria-pressed", "true");
      buildSnippet(tab.dataset.lang);
    });
  });
  $("#pgCopySnippet").addEventListener("click", () => {
    navigator.clipboard.writeText($("#pgSnippet").textContent).then(() => toast("Snippet đã copy"));
  });

  // Playground → Deploy modal (T2.6)
  $("#pgDeployClose").addEventListener("click", closePgDeployModal);
  $("#pgDeployOverlay").addEventListener("click", closePgDeployModal);
  $("#pgDeployGpu").addEventListener("change", updatePgDeployPrice);
  $("#pgDeployCommit").addEventListener("change", updatePgDeployPrice);
  $("#pgDeployForm").addEventListener("submit", submitPgDeploy);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("#pgDeployModal").hidden) closePgDeployModal();
  });
  $("#byomType").addEventListener("change", syncByomSourceLabel);
  $("#byomForm").addEventListener("submit", submitByomJob);
  $("#byomRows").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    byomAction(btn.dataset.action, btn.dataset.id, btn.dataset.name);
  });

  // fine-tuning one-click deploy (gap #7)
  $("#ftRows").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action='ft-deploy']");
    if (btn) toast(`One-click deploy ${btn.dataset.job} → dedicated endpoint`);
  });
  $("#newFtBtn").addEventListener("click", () => toast("New fine-tune job — choose LoRA / Full / DPO"));

  // batch upload thật (gap #6) — modal + submit tới /v1/batch
  $("#batchUploadBtn").addEventListener("click", openBatchModal);
  $("#batchModalClose").addEventListener("click", closeBatchModal);
  $("#batchModalCloseFoot").addEventListener("click", closeBatchModal);
  $("#batchModalOverlay").addEventListener("click", closeBatchModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("#batchModal").hidden) closeBatchModal();
  });
  $("#batchFile").addEventListener("change", (e) => {
    const f = e.target.files[0];
    if (!f) return;
    $("#batchFileLbl").textContent = `${f.name} · ${(f.size / 1024).toFixed(1)} KB`;
    previewBatchFile(f);
  });
  $("#batchForm").addEventListener("submit", submitBatchJob);
  $("#batchRows").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action='bat-output']");
    if (btn) downloadBatchOutput(btn.dataset.id);
  });

  // poll batch mỗi 8s khi đang xem view batch
  if (batchPollTimer) clearInterval(batchPollTimer);
  batchPollTimer = setInterval(() => {
    if (!$("#view-batch").hidden) fetchBatchJobs();
    if (!$("#view-catalog").hidden) { fetchByomJobs(); startByomPolling(); }
  }, 8000);

  // PTU calculator (gap #5/#34)
  $("#ptuTpm").addEventListener("input", ptuCalc);
  $("#ptuContactBtn").addEventListener("click", () => toast("PTU sales request drafted — committed TPM with SLA"));

  // experiments (gap #31/#32)
  $("#expRows").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action='exp-promote']");
    if (btn) toast(`Promoted variant in ${btn.dataset.name} → now serving 100%`);
  });
  $("#newExpBtn").addEventListener("click", () => toast("New experiment — A/B (1 control + up to 19 variants) or shadow"));

  // ── Developer tools (parity+ vs Together AI) ─
  $("#devtoolsTabs").addEventListener("click", (e) => {
    const tab = e.target.closest(".tab");
    if (!tab) return;
    devtoolsTab = tab.dataset.tab;
    document.querySelectorAll("#devtoolsTabs .tab").forEach((t) => {
      const on = t === tab;
      t.classList.toggle("is-on", on);
      t.setAttribute("aria-selected", String(on));
    });
    document.querySelectorAll(".devtools-panel").forEach((p) => {
      p.hidden = p.id !== "dt-" + devtoolsTab;
    });
  });

  // CLI interactive terminal
  $("#termForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = $("#termInput").value;
    $("#termInput").value = "";
    termRun(v);
  });
  $("#termInput").addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      termHistSel = Math.min(termHistSel + 1, termHistory.length - 1);
      if (termHistory[termHistSel]) $("#termInput").value = termHistory[termHistSel];
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      termHistSel = Math.max(termHistSel - 1, -1);
      $("#termInput").value = termHistSel < 0 ? "" : termHistory[termHistSel];
    }
  });

  // Copy buttons (delegated across whole console)
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".copy-btn");
    if (btn && btn.dataset.copy) copyToClipboard(btn.dataset.copy);
    if (btn && btn.dataset.copyVal) copyToClipboardValue(btn.dataset.copyVal);
  });

  // Playground
  ["pgModel", "pgTemp", "pgMaxTok", "pgSystem", "pgPrompt"].forEach((id) =>
    $("#" + id).addEventListener("input", updatePgCurl)
  );
  $("#pgEndpoint").addEventListener("change", () => { syncPlaygroundModel(); updatePgCurl(); });
  $("#pgStream").addEventListener("change", updatePgCurl);
  $("#pgStructured").addEventListener("change", () => {
    $("#pgSchemaField").hidden = !$("#pgStructured").checked;
    updatePgCurl();
  });
  $("#pgSchema").addEventListener("input", updatePgCurl);
  $("#pgRunBtn").addEventListener("click", runPlayground);
  $("#pgClearBtn").addEventListener("click", () => {
    $("#pgOutput").textContent = "";
    $("#pgMeta").textContent = "idle";
    if (pgStreamTimer) { clearInterval(pgStreamTimer); pgStreamTimer = null; pgCtx.running = false; $("#pgRunBtn").disabled = false; }
  });

  // API keys
  $("#newKeyBtn").addEventListener("click", openKeyModal);
  $("#keyModalClose").addEventListener("click", closeKeyModal);
  $("#keyModalOverlay").addEventListener("click", closeKeyModal);
  $("#keyForm").addEventListener("submit", submitKey);
  $("#keyRevealClose").addEventListener("click", closeKeyReveal);
  $("#keyRevealOverlay").addEventListener("click", closeKeyReveal);
  $("#keyRows").addEventListener("click", (e) => {
    const rev = e.target.closest("[data-action='key-revoke']");
    if (rev) { revokeKey(rev.dataset.keyId); return; }
    const del = e.target.closest("[data-action='key-del']");
    if (del) deleteKey(del.dataset.keyId);
    const sc = e.target.closest("[data-action='key-scopes']");
    if (sc) editKeyScopes(sc.dataset.keyId);
  });
  // US-10 — cập nhật role qua select trong bảng (PATCH /v1/keys/:id)
  $("#keyRows").addEventListener("change", (e) => {
    const sel = e.target.closest(".key-role-select");
    if (sel) updateKeyRole(sel.dataset.keyId, sel.value);
  });

  // Agent skills
  $("#skillCards").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action='skill-invoke']");
    if (btn) invokeSkill(parseInt(btn.dataset.skill, 10));
  });
  $("#newSkillBtn").addEventListener("click", () => toast("Register skill — paste MCP-style tool definition or OpenAPI schema"));
  $("#skillLogClear").addEventListener("click", skillLogClear);
  $("#skillLogPoll").addEventListener("click", fetchActiveRun);

  // live KPI refresh for devtools — 15s, chỉ khi đang xem view-devtools
  setInterval(() => {
    if (!$("#view-devtools").hidden) {
      const rpm = 4000 + Math.floor(Math.random() * 1600);
      $("#kpiApiRpm").textContent = rpm.toLocaleString("en-US");
      $("#kpiApiRpmDelta").textContent = "↑ " + (Math.floor(Math.random() * 14) + 3) + "% vs last hour";
    }
  }, 15000);
}

document.addEventListener("DOMContentLoaded", init);
