/* FPT DDI Model Catalog Admin — hash router + boot. */
"use strict";

window.MC_ROLE = "admin";

function parseHash() {
  const h = location.hash.replace(/^#\/?/, "");
  const [pathPart, queryPart] = h.split("?");
  const params = new URLSearchParams(queryPart || "");
  const segs = pathPart.split("/").filter(Boolean);
  if (segs.length === 0) return { view: "list" };
  if (segs[0] === "new") return { view: "new", params };
  if (segs[0] === "entry" && segs[1]) return { view: "entry", id: segs[1], params };
  if (segs[0] === "categories") return { view: "categories" };
  if (segs[0] === "sync") return { view: "sync" };
  return { view: "list" };
}

function setActiveNav(name) {
  document.querySelectorAll(".nav a").forEach((a) => a.classList.toggle("active", a.dataset.nav === name));
}

async function route() {
  const view = document.getElementById("view");
  M6.destroy();
  const r = parseHash();
  const navMap = { list: "list", new: "list", entry: "list", categories: "categories", sync: "sync" };
  setActiveNav(navMap[r.view] || "list");
  try {
    if (r.view === "list") {
      M1.state.role = window.MC_ROLE;
      await M1.render(view);
    } else if (r.view === "new") {
      await M2.render(view, r.params);
    } else if (r.view === "entry") {
      await M4.render(view, r.params, r.id);
    } else if (r.view === "categories") {
      await M5.render(view);
    } else if (r.view === "sync") {
      await M6.render(view);
    } else {
      view.innerHTML = `<div class="banner error">Trang không tồn tại.</div>`;
    }
  } catch (e) {
    view.innerHTML = `<div class="banner error">Lỗi tải trang: ${esc(e.message)}</div>`;
  }
}

async function boot() {
  bindKeyInput();
  await ensureKey();
  window.addEventListener("hashchange", route);
  await route();
}

document.addEventListener("DOMContentLoaded", boot);