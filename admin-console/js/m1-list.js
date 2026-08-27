/* M1 — Danh sách Model Catalog (list + filter + phân trang + actions theo role). */
"use strict";

const M1 = {
  state: { catalogType: "public", status: "", category: "", query: "", page: 1, limit: 20, total: 0, role: "admin" },

  async render(view) {
    view.innerHTML = `
      <div class="page-head">
        <div><h1>Model Catalog</h1><div class="sub">Khai báo & quản lý model cho Dedicated Inference</div></div>
        <div class="btn-row">
          <a class="btn" href="#/new?source=hf">+ Add Model (HF)</a>
          <a class="btn btn-primary" href="#/new?source=manual">+ Add Model (Manual)</a>
        </div>
      </div>
      <div class="tabs" id="catTabs">
        <button data-ct="public" class="active">Public Catalog</button>
        <button data-ct="proprietary">Proprietary Catalog</button>
      </div>
      <div class="filterbar">
        <select id="fStatus">
          <option value="">Status: Tất cả</option>
          <option value="draft">draft</option>
          <option value="pending_review">pending_review</option>
          <option value="active">active</option>
          <option value="inactive">inactive</option>
        </select>
        <select id="fCategory"><option value="">Category: Tất cả</option></select>
        <input type="search" id="fQuery" placeholder="Tìm theo id / tên / hf_model_id…" />
        <button class="btn btn-ghost" id="fReset">Xóa bộ lọc</button>
      </div>
      <div id="listBody"><div class="loading-screen"><div class="spinner"></div></div></div>
    `;

    document.querySelectorAll("#catTabs button").forEach((b) => {
      b.onclick = () => {
        document.querySelectorAll("#catTabs button").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        this.state.catalogType = b.dataset.ct;
        this.state.page = 1;
        this.load();
      };
    });
    const fs = document.getElementById("fStatus");
    fs.onchange = () => { this.state.status = fs.value; this.state.page = 1; this.load(); };
    const fc = document.getElementById("fCategory");
    const cats = await api("GET", "/admin/catalog/categories").catch(() => ({ data: [] }));
    (cats.data || []).forEach((c) => {
      const o = document.createElement("option");
      o.value = c.code; o.textContent = c.displayName;
      fc.appendChild(o);
    });
    fc.onchange = () => { this.state.category = fc.value; this.state.page = 1; this.load(); };
    let deb;
    document.getElementById("fQuery").oninput = (e) => {
      clearTimeout(deb);
      deb = setTimeout(() => { this.state.query = e.target.value.trim(); this.state.page = 1; this.load(); }, 350);
    };
    document.getElementById("fReset").onclick = () => {
      this.state.status = this.state.category = this.state.query = "";
      this.state.page = 1;
      fs.value = ""; fc.value = ""; document.getElementById("fQuery").value = "";
      this.load();
    };
    this.load();
  },

  async load() {
    const s = this.state;
    const body = document.getElementById("listBody");
    if (!body) return;
    body.innerHTML = `<div class="loading-screen"><div class="spinner"></div></div>`;
    try {
      const off = (s.page - 1) * s.limit;
      const r = await api("GET", `/admin/catalog/entries?catalog_type=${s.catalogType}&status=${encodeURIComponent(s.status)}&category=${encodeURIComponent(s.category)}&query=${encodeURIComponent(s.query)}&limit=${s.limit}&offset=${off}`);
      this.renderTable(r);
    } catch (e) {
      body.innerHTML = `<div class="banner error">Không thể tải danh sách: ${esc(e.message)} — <a href="#/">thử lại</a></div>`;
    }
  },

  renderTable(r) {
    const s = this.state;
    const body = document.getElementById("listBody");
    if (!body) return;
    const rows = r.data || [];
    if (!rows.length) {
      body.innerHTML = `<div class="table-wrap"><div class="empty"><div class="big">🗂</div>Chưa có model nào trong catalog này.<br><br><a class="btn btn-primary" href="#/new?source=hf">+ Add Model (HF)</a></div></div>`;
      return;
    }
    const pages = Math.max(1, Math.ceil((r.total || rows.length) / s.limit));
    body.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>ID</th><th>Display name</th><th>Status</th><th>Weight</th><th>Price</th><th>Updated</th><th></th>
          </tr></thead>
          <tbody>
            ${rows.map((e) => `
              <tr>
                <td class="mono"><a href="#/entry/${esc(e.id)}">${esc(e.id)}</a></td>
                <td>${esc(e.displayName)}<div class="dim mono">${esc(e.hfModelId)}</div></td>
                <td>${badge(e.status, STATUS_LABELS[e.status])}</td>
                <td>${badge(e.weightStatus, STATUS_LABELS[e.weightStatus])}</td>
                <td>${money(e.fromPrice)}</td>
                <td class="dim">${timeAgo(e.updatedAt)}</td>
                <td><button class="icon-btn" data-act="menu" data-id="${esc(e.id)}" data-status="${esc(e.status)}" title="Hành động">⋯</button></td>
              </tr>`).join("")}
          </tbody>
        </table>
        <div class="pager">
          Trang ${s.page}/${pages} · ${r.total || 0} entry
          <span style="flex:1"></span>
          <button data-pg="prev" ${s.page <= 1 ? "disabled" : ""}>‹</button>
          <button data-pg="next" ${s.page >= pages ? "disabled" : ""}>›</button>
        </div>
      </div>`;
    body.querySelectorAll("[data-pg]").forEach((b) => {
      b.onclick = () => { s.page += b.dataset.pg === "next" ? 1 : -1; this.load(); };
    });
    body.querySelectorAll("[data-act=menu]").forEach((b) => {
      b.onclick = () => this.menu(b.dataset.id, b.dataset.status, b);
    });
  },

  async menu(id, status, anchor) {
    const role = this.state.role;
    const items = [
      { label: "Xem chi tiết", href: `#/entry/${id}`, show: true },
      { label: "Sửa", href: `#/entry/${id}?edit=1`, show: (status === "draft" || status === "inactive") && role === "admin" },
      { label: "Submit để duyệt", act: "submit", show: status === "draft" && role === "admin" },
      { label: "Approve", act: "approve", show: status === "pending_review" && role !== "viewer" },
      { label: "Reject", act: "reject", show: status === "pending_review" && role !== "viewer" },
      { label: "Disable", act: "disable", show: status === "active" && role === "admin" },
      { label: "Enable", act: "enable", show: status === "inactive" && role === "admin" },
      { label: "Xóa", act: "delete", show: status === "draft" && role === "admin" },
    ].filter((i) => i.show);

    const menu = document.createElement("div");
    menu.className = "menu-pop";
    menu.style.cssText = "position:fixed;z-index:300;background:var(--bg-elev);border:1px solid var(--line-strong);border-radius:8px;min-width:170px;box-shadow:0 8px 24px rgba(0,0,0,.5)";
    const rect = anchor.getBoundingClientRect();
    menu.style.top = rect.bottom + 4 + "px";
    menu.style.right = "14px";
    menu.style.left = "auto";
    items.forEach((i) => {
      const el = document.createElement(i.href ? "a" : "button");
      if (i.href) el.href = i.href;
      el.textContent = i.label;
      el.style.cssText = "display:block;width:100%;text-align:left;padding:8px 14px;background:none;border:none;color:var(--ink);cursor:pointer;font-size:13px;border-radius:0";
      el.onmouseenter = () => (el.style.background = "var(--bg-panel)");
      el.onmouseleave = () => (el.style.background = "none");
      if (i.act) el.onclick = async () => { menu.remove(); await this.action(i.act, id); };
      menu.appendChild(el);
    });
    document.body.appendChild(menu);
    const close = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener("click", close); } };
    setTimeout(() => document.addEventListener("click", close), 0);
  },

  async action(act, id) {
    try {
      if (act === "submit") {
        const r = await api("POST", `/admin/catalog/entries/${id}/submit`);
        toast("Đã submit — chờ duyệt.", "ok");
      } else if (act === "approve") {
        const r = await api("POST", `/admin/catalog/entries/${id}/approve`);
        toast(`Đã approve. Publish: ${r.publish && r.publish.ok ? (r.publish.dryRun ? "dry-run" : "ok") : "FAIL — xem log"}.`, r.publish && r.publish.ok ? "ok" : "error");
      } else if (act === "reject") {
        const host = document.getElementById("modalHost");
        // dùng prompt đơn giản qua modal
        const reason = await new Promise((res) => {
          const t = document.getElementById("modalTitle");
          const b = document.getElementById("modalBody");
          const cancel = document.getElementById("modalCancel");
          const confirm = document.getElementById("modalConfirm");
          t.textContent = "Reject entry";
          b.innerHTML = "";
          const ta = document.createElement("textarea");
          ta.placeholder = "Lý do từ chối (bắt buộc, ≥ 5 ký tự)…";
          ta.style.cssText = "width:100%;background:var(--bg);color:var(--ink);border:1px solid var(--line-strong);border-radius:7px;padding:8px 10px;font-size:13px;margin-bottom:10px;font-family:inherit";
          b.appendChild(ta);
          confirm.textContent = "Reject";
          host.hidden = false;
          cancel.onclick = () => { host.hidden = true; res(null); };
          confirm.onclick = () => { host.hidden = true; res(ta.value.trim()); };
        });
        if (!reason) return;
        await api("POST", `/admin/catalog/entries/${id}/reject`, { reason });
        toast("Đã reject — entry về draft.", "ok");
      } else if (act === "disable") {
        const ok = await confirmModal("Disable model?", "Model sẽ ẩn khỏi catalog khách. Endpoint đang chạy vẫn hoạt động.", { confirmLabel: "Disable" });
        if (!ok) return;
        await api("POST", `/admin/catalog/entries/${id}/disable`);
        toast("Đã disable.", "ok");
      } else if (act === "enable") {
        await api("POST", `/admin/catalog/entries/${id}/enable`);
        toast("Đã enable.", "ok");
      } else if (act === "delete") {
        const ok = await confirmModal("Xóa entry?", "Hành động không thể hoàn tác.", { confirmLabel: "Xóa", danger: true });
        if (!ok) return;
        await api("DELETE", `/admin/catalog/entries/${id}`);
        toast("Đã xóa.", "ok");
      }
      this.load();
    } catch (e) {
      toast(e.message, "error");
    }
  },
};