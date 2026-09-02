/* FPT DDI Model Catalog Admin — API client.
   Admin console dùng key RIÊNG trong localStorage (fptDdiAdminKey) — tách khỏi
   partner-console (fptDdiKey) để không dính role viewer. Tự tạo demo key
   scope=admin, role=admin nếu chưa có. Key đọc ĐỘNG mỗi request (không const cũ). */
"use strict";

const MC_KEY_STORAGE = "fptDdiAdminKey";
const MC_ROLE_STORAGE = "fptDdiAdminRole";
const MC_AUTH_PATHS = ["/v1/admin/catalog"];

function mcKey() { return localStorage.getItem(MC_KEY_STORAGE) || ""; }

const _origFetch = window.fetch.bind(window);
window.fetch = function (input, init) {
  const url = typeof input === "string" ? input : (input && input.url) || "";
  const needsAuth = MC_AUTH_PATHS.some((p) => url.includes(p));
  if (needsAuth) {
    init = init || {};
    const headers = new Headers(init.headers || {});
    const key = mcKey();
    if (!headers.has("Authorization") && key) headers.set("Authorization", "Bearer " + key);
    init.headers = headers;
  }
  return _origFetch(input, init);
};

async function api(method, path, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch("/v1" + path, opts);
  let json = null;
  try { json = await res.json(); } catch (_) {}
  if (!res.ok) {
    const msg = (json && json.error && (json.error.message || json.error)) || res.statusText;
    const err = new Error(msg);
    err.status = res.status;
    err.code = json && json.error && json.error.code;
    throw err;
  }
  return json;
}

function setKeyBadge(state, label) {
  const b = document.getElementById("keyBadge");
  if (!b) return;
  if (!state) { b.hidden = true; b.textContent = ""; return; }
  b.hidden = false;
  b.className = "key-badge " + state;
  b.textContent = label;
}

function setRoleBadge(role) {
  const b = document.getElementById("roleBadge");
  if (!b) return;
  b.hidden = false;
  b.textContent = "role: " + role;
}

async function verifyKey(key) {
  try {
    const res = await _origFetch("/v1/keys/verify", { headers: { Authorization: "Bearer " + key } });
    const json = await res.json().catch(() => ({}));
    return res.ok && json.valid ? json : null;
  } catch (_) { return null; }
}

async function ensureKey() {
  setKeyBadge("check", "đang kiểm tra key…");
  const existing = mcKey();
  if (existing) {
    const v = await verifyKey(existing);
    if (v) {
      const role = v.role || localStorage.getItem(MC_ROLE_STORAGE) || "viewer";
      window.MC_ROLE = role;
      setRoleBadge(role);
      if (role === "admin" || role === "approver") {
        setKeyBadge("ok", "✓ " + role);
        return true;
      }
      setKeyBadge("bad", "role " + role + " — chỉ đọc");
      toast("Key hiện tại role=" + role + " (chỉ xem). Dán key role admin/approver vào ô API key để quản lý.", "error");
      return true;
    }
    localStorage.removeItem(MC_KEY_STORAGE);
  }
  // Tự tạo demo key scope admin + role admin (chỉ dev/preview)
  try {
    const res = await _origFetch("/v1/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "mc-admin-" + Date.now().toString(36), scopes: ["admin"], role: "admin" }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.full_key) {
      localStorage.setItem(MC_KEY_STORAGE, json.full_key);
      localStorage.setItem(MC_ROLE_STORAGE, json.role || "admin");
      window.MC_ROLE = json.role || "admin";
      setKeyBadge("ok", "✓ " + (json.role || "admin"));
      setRoleBadge(window.MC_ROLE);
      toast("Đã tự tạo demo key role=admin cho admin console.", "ok");
      return true;
    }
    setKeyBadge("bad", "tạo key lỗi");
    toast("Không tự tạo được demo key (" + ((json && json.error) || res.status) + "). Dán key scope=admin vào ô API key.", "error");
    return false;
  } catch (e) {
    setKeyBadge("bad", "lỗi");
    toast("Lỗi tạo demo key: " + e.message, "error");
    return false;
  }
}

/* Ô dán key thủ công (fallback) — lưu vào storage riêng của admin console */
function bindKeyInput() {
  const inp = document.getElementById("apiKeyInput");
  if (!inp) return;
  inp.addEventListener("change", () => {
    const v = inp.value.trim();
    if (v) {
      localStorage.setItem(MC_KEY_STORAGE, v);
      localStorage.removeItem(MC_ROLE_STORAGE);
      location.reload();
    }
  });
}