/* M5 — Quản lý Categories (CRUD, chặn xóa category đang có model). */
"use strict";

const M5 = {
  async render(view) {
    view.innerHTML = `
      <div class="page-head">
        <div><h1>Categories</h1><div class="sub">Phân loại model trong catalog</div></div>
        <button class="btn btn-primary" id="btnAddCat">+ Thêm category</button>
      </div>
      <div id="catBody"><div class="loading-screen"><div class="spinner"></div></div></div>
    `;
    document.getElementById("btnAddCat").onclick = () => this.addModal();
    this.load();
  },

  async load() {
    const body = document.getElementById("catBody");
    if (!body) return;
    body.innerHTML = `<div class="loading-screen"><div class="spinner"></div></div>`;
    try {
      const r = await api("GET", "/admin/catalog/categories");
      const rows = r.data || [];
      body.innerHTML = `<div class="table-wrap"><table>
        <thead><tr><th>Code</th><th>Display name</th><th>Sort</th><th></th></tr></thead>
        <tbody>${rows.map((c) => `
          <tr>
            <td class="mono">${esc(c.code)}</td>
            <td>${esc(c.displayName)}</td>
            <td>${c.sortOrder}</td>
            <td class="btn-row" style="justify-content:flex-end">
              <button class="btn btn-sm" data-edit="${esc(c.code)}">Sửa</button>
              <button class="btn btn-sm btn-danger" data-del="${esc(c.code)}">Xóa</button>
            </td>
          </tr>`).join("")}
        </tbody></table></div>`;
      body.querySelectorAll("[data-edit]").forEach((b) => {
        b.onclick = () => this.addModal(rows.find((c) => c.code === b.dataset.edit));
      });
      body.querySelectorAll("[data-del]").forEach((b) => {
        b.onclick = async () => {
          const ok = await confirmModal("Xóa category?", `Xóa category "${b.dataset.del}".`, { confirmLabel: "Xóa", danger: true });
          if (!ok) return;
          try {
            await api("DELETE", `/admin/catalog/categories/${b.dataset.del}`);
            toast("Đã xóa.", "ok");
            this.load();
          } catch (e) {
            toast(e.message, "error");
          }
        };
      });
    } catch (e) {
      body.innerHTML = `<div class="banner error">${esc(e.message)}</div>`;
    }
  },

  addModal(existing) {
    const host = document.getElementById("modalHost");
    const t = document.getElementById("modalTitle");
    const b = document.getElementById("modalBody");
    const cancel = document.getElementById("modalCancel");
    const confirm = document.getElementById("modalConfirm");
    t.textContent = existing ? "Sửa category" : "Thêm category";
    b.innerHTML = `
      <div class="field" style="margin-bottom:10px"><label>Code *</label>
        <input id="mcCode" class="mc-code" value="${esc(existing?.code || "")}" ${existing ? "readonly" : ""} placeholder="code-gen" style="width:100%;background:var(--bg);color:var(--ink);border:1px solid var(--line-strong);border-radius:7px;padding:8px 10px;font-size:13px" />
        ${existing ? '<div class="hint">code không đổi được khi đã có model dùng</div>' : ""}
      </div>
      <div class="field" style="margin-bottom:10px"><label>Display name *</label>
        <input id="mcName" value="${esc(existing?.displayName || "")}" placeholder="Code Generation" style="width:100%;background:var(--bg);color:var(--ink);border:1px solid var(--line-strong);border-radius:7px;padding:8px 10px;font-size:13px" />
      </div>
      <div class="field"><label>Sort order</label>
        <input id="mcSort" type="number" value="${existing?.sortOrder ?? 0}" style="width:100%;background:var(--bg);color:var(--ink);border:1px solid var(--line-strong);border-radius:7px;padding:8px 10px;font-size:13px" />
      </div>`;
    confirm.textContent = existing ? "Lưu" : "Thêm";
    host.hidden = false;
    cancel.onclick = () => { host.hidden = true; };
    confirm.onclick = async () => {
      const code = document.getElementById("mcCode").value.trim();
      const name = document.getElementById("mcName").value.trim();
      const sort = parseInt(document.getElementById("mcSort").value, 10) || 0;
      if (!code || !name) { toast("Thiếu code hoặc display_name.", "error"); return; }
      try {
        if (existing) {
          await api("PUT", `/admin/catalog/categories/${code}`, { display_name: name, sort_order: sort });
        } else {
          await api("POST", "/admin/catalog/categories", { code, display_name: name, sort_order: sort });
        }
        host.hidden = true;
        toast("Đã lưu category.", "ok");
        this.load();
      } catch (e) {
        toast(e.message, "error");
      }
    };
  },
};