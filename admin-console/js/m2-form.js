/* M2/M3 — Form Add Model (source=hf | manual). 4 bước: fetch HF → metadata → hardware → benchmarks. */
"use strict";

const M2 = {
  source: "manual",

  async render(view, params) {
    this.source = params.get("source") === "hf" ? "hf" : "manual";
    const isHf = this.source === "hf";
    view.innerHTML = `
      <div class="page-head">
        <div>
          <h1>Add Model — ${isHf ? "From Hugging Face" : "Manual"}</h1>
          <div class="sub">${isHf ? "Nhập HF Model ID, hệ thống tự lấy metadata" : "Khai báo thủ công — model độc quyền dùng identifier nội bộ fpt-internal/<model>"}</div>
        </div>
        <a class="btn btn-ghost" href="#/">← Quay lại</a>
      </div>
      ${isHf ? `
      <div class="form-panel">
        <h2><span class="step">1</span>Fetch từ Hugging Face</h2>
        <div class="field">
          <label>HF Model ID <span class="req">*</span></label>
          <input id="hfId" placeholder="publisher/model-name (ví dụ: nvidia/Llama-3.3-70B-Instruct-FP8)" />
          <div class="hint">Hệ thống gọi HF Hub API lấy metadata + validate config.json (timeout 10s)</div>
        </div>
        <div id="hfStatus"></div>
        <div class="btn-row mt8"><button class="btn btn-primary" id="btnFetch">Fetch from Hugging Face</button></div>
      </div>` : `
      <div class="banner warn">Mode manual — nhập toàn bộ thông tin thủ công. Model không có trên HF công khai: dùng <span class="mono">fpt-internal/<model-name></span> cho hf_model_id.</div>`}
      <div class="form-panel">
        <h2><span class="step">${isHf ? "2" : "1"}</span>Metadata model</h2>
        <div class="form-grid">
          <div class="field"><label>ID entry <span class="req">*</span></label><input id="fId" placeholder="llama-3-3-70b-instruct-fp8" /></div>
          <div class="field"><label>HF Model ID <span class="req">*</span></label><input id="fHfId" ${isHf ? "readonly" : ""} placeholder="nvidia/Llama-3.3-70B-Instruct-FP8" /></div>
          <div class="field"><label>Display name <span class="req">*</span></label><input id="fName" placeholder="Llama 3.3 70B Instruct" /></div>
          <div class="field"><label>License <span class="req">*</span></label><input id="fLicense" placeholder="llama3.3 / mit / apache-2.0" /></div>
          <div class="field full"><label>Short description <span class="req">*</span></label><textarea id="fDesc" placeholder="Mô tả ngắn model…"></textarea></div>
          <div class="field"><label>Parameters <span class="req">*</span></label><input id="fParams" placeholder="70B dense" /></div>
          <div class="field"><label>Context length <span class="req">*</span></label><input id="fCtx" placeholder="128K" /></div>
          <div class="field"><label>Catalog type <span class="req">*</span></label>
            <select id="fCatType"><option value="public">Public Catalog</option><option value="proprietary">Proprietary Catalog</option></select>
          </div>
          <div class="field"><label>Badge</label><select id="fBadge"><option value="">—</option><option value="new">new</option><option value="hot">hot</option><option value="beta">beta</option></select></div>
          <div class="field"><label>Categories <span class="req">*</span></label><div id="fCats" class="cat-picks"></div></div>
          <div class="field"><label>Sort order</label><input id="fSort" type="number" value="0" /></div>
          <div class="field"><label>From price (USD) <span class="hint">tự tính = min giá GPU profile</span></label><input id="fPrice" type="number" step="0.01" min="0" placeholder="3.29" /></div>
        </div>
      </div>
      <div class="form-panel">
        <h2><span class="step">${isHf ? "3" : "2"}</span>Hardware profiles (GPU)</h2>
        <div id="hwRows"></div>
        <div class="btn-row"><button class="btn btn-ghost" id="btnAddHw">+ Thêm profile</button></div>
        <div class="hint mt8">Tối thiểu 1 profile, đúng 1 profile đánh dấu "recommended". Giá nhập USD/GPU/hour.</div>
      </div>
      <div class="form-panel">
        <h2><span class="step">${isHf ? "4" : "3"}</span>Benchmarks (tuỳ chọn)</h2>
        <div id="bmRows"></div>
        <div class="btn-row"><button class="btn btn-ghost" id="btnAddBm">+ Thêm benchmark</button></div>
      </div>
      <div class="form-footer">
        <a class="btn btn-ghost" href="#/">Hủy</a>
        <button class="btn" id="btnSaveDraft">Lưu draft</button>
        <button class="btn btn-primary" id="btnSaveSubmit">Lưu & Submit để duyệt</button>
      </div>
    `;

    this.loadCategories();
    this.addHwRow();
    if (isHf) this.bindFetch();
    document.getElementById("btnAddHw").onclick = () => this.addHwRow();
    document.getElementById("btnAddBm").onclick = () => this.addBmRow();
    document.getElementById("btnSaveDraft").onclick = () => this.save(false);
    document.getElementById("btnSaveSubmit").onclick = () => this.save(true);
  },

  async loadCategories() {
    const r = await api("GET", "/admin/catalog/categories").catch(() => ({ data: [] }));
    const host = document.getElementById("fCats");
    if (!host) return;
    host.style.display = "flex";
    host.style.flexWrap = "wrap";
    host.style.gap = "6px";
    (r.data || []).forEach((c) => {
      const el = document.createElement("label");
      el.style.cssText = "display:flex;align-items:center;gap:5px;font-size:12.5px;color:var(--ink-dim);background:var(--bg-panel);border:1px solid var(--line);border-radius:999px;padding:4px 10px;cursor:pointer";
      el.innerHTML = `<input type="checkbox" value="${esc(c.code)}" style="accent-color:var(--accent)"> ${esc(c.displayName)}`;
      host.appendChild(el);
    });
  },

  bindFetch() {
    const btn = document.getElementById("btnFetch");
    const status = document.getElementById("hfStatus");
    btn.onclick = async () => {
      const id = document.getElementById("hfId").value.trim();
      if (!id) { toast("Nhập HF Model ID trước.", "error"); return; }
      btn.disabled = true;
      btn.textContent = "Đang lấy metadata từ HF…";
      status.innerHTML = "";
      try {
        const r = await api("POST", "/admin/catalog/hf-fetch", { hf_model_id: id });
        const d = r.data;
        document.getElementById("fHfId").value = d.hfModelId;
        if (!document.getElementById("fId").value) document.getElementById("fId").value = d.hfModelId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        document.getElementById("fName").value = d.displayName || "";
        document.getElementById("fDesc").value = d.shortDescription || "";
        document.getElementById("fParams").value = d.parametersDisplay || "";
        document.getElementById("fCtx").value = d.contextLengthDisplay || "";
        document.getElementById("fLicense").value = d.license || "";
        const cats = document.querySelectorAll("#fCats input[type=checkbox]");
        cats.forEach((c) => { c.checked = (d.suggestedCategories || []).includes(c.value); });
        status.innerHTML = `<div class="banner ok mt8">✓ Đã lấy metadata từ HF (revision: <span class="mono">${esc(d.revision || "main")}</span>) — kiểm tra & bổ sung trước khi lưu.</div>`;
        this._revision = d.revision || null;
        toast("Đã prefill metadata từ HF.", "ok");
      } catch (e) {
        status.innerHTML = `<div class="banner error mt8">${esc(e.message)}</div>`;
      } finally {
        btn.disabled = false;
        btn.textContent = "Fetch from Hugging Face";
      }
    };
  },

  addHwRow(data) {
    const host = document.getElementById("hwRows");
    const row = document.createElement("div");
    row.className = "dyn-row";
    row.innerHTML = `
      <div class="field"><label>GPU SKU</label><input class="hw-sku" placeholder="l40s" value="${esc(data?.gpu_sku_code || "")}" /></div>
      <div class="field"><label>GPUs/instance</label><input class="hw-gpu" type="number" min="1" value="${data?.gpus_per_instance ?? 1}" /></div>
      <div class="field"><label>Precision</label><select class="hw-prec"><option>fp8</option><option>fp16</option><option>bf16</option><option>int8</option></select></div>
      <div class="field"><label>VRAM (GB)</label><input class="hw-vram" type="number" min="0" value="${data?.vram_required_gb ?? ""}" /></div>
      <div class="field"><label>Giá USD/GPU/h</label><input class="hw-price" type="number" min="0" step="0.01" value="${data?.priceUsd ?? ""}" /></div>
      <label class="chk"><input type="checkbox" class="hw-rec" ${data?.is_recommended ? "checked" : ""}> recommended</label>
      <button class="icon-btn hw-del" title="Xóa">✕</button>`;
    if (data) row.querySelector(".hw-prec").value = data.precision || "fp8";
    row.querySelector(".hw-del").onclick = () => { if (host.children.length > 1) row.remove(); };
    host.appendChild(row);
  },

  addBmRow(data) {
    const host = document.getElementById("bmRows");
    const row = document.createElement("div");
    row.className = "dyn-row";
    row.style.gridTemplateColumns = "2fr 1fr 1fr 1fr auto";
    row.innerHTML = `
      <div class="field"><label>Benchmark</label><input class="bm-name" placeholder="SWE-bench Verified" value="${esc(data?.benchmark_name || "")}" /></div>
      <div class="field"><label>Score</label><input class="bm-score" type="number" step="0.1" value="${data?.score ?? ""}" /></div>
      <div class="field"><label>Max</label><input class="bm-max" type="number" value="${data?.max_score ?? 100}" /></div>
      <div class="field"><label>Sort</label><input class="bm-sort" type="number" value="${data?.sort_order ?? 0}" /></div>
      <button class="icon-btn bm-del" title="Xóa">✕</button>`;
    row.querySelector(".bm-del").onclick = () => row.remove();
    host.appendChild(row);
  },

  collect() {
    const v = (id) => document.getElementById(id).value.trim();
    const errors = [];
    const required = [["fId", "id"], ["fHfId", "hf_model_id"], ["fName", "display_name"], ["fDesc", "short_description"], ["fParams", "parameters"], ["fCtx", "context_length"], ["fLicense", "license"]];
    required.forEach(([id, name]) => {
      const el = document.getElementById(id);
      if (!el.value.trim()) { el.classList.add("invalid"); errors.push(name); }
      else el.classList.remove("invalid");
    });
    const cats = [...document.querySelectorAll("#fCats input:checked")].map((c) => c.value);
    if (!cats.length) errors.push("categories");

    const hw = [...document.querySelectorAll("#hwRows .dyn-row")].map((row, i) => {
      const price = parseFloat(row.querySelector(".hw-price").value);
      return {
        gpu_sku_code: row.querySelector(".hw-sku").value.trim(),
        gpus_per_instance: parseInt(row.querySelector(".hw-gpu").value, 10) || 1,
        precision: row.querySelector(".hw-prec").value,
        vram_required_gb: parseFloat(row.querySelector(".hw-vram").value) || null,
        per_gpu_hourly_price_usd_micros: isNaN(price) ? 0 : Math.round(price * 1e6),
        is_recommended: row.querySelector(".hw-rec").checked,
        sort_order: i,
      };
    }).filter((p) => p.gpu_sku_code);
    if (!hw.length) errors.push("hardware profile");
    if (hw.filter((p) => p.is_recommended).length !== 1) errors.push("đúng 1 profile recommended");

    const benchmarks = [...document.querySelectorAll("#bmRows .dyn-row")].map((row, i) => ({
      benchmark_name: row.querySelector(".bm-name").value.trim(),
      score: parseFloat(row.querySelector(".bm-score").value) || 0,
      max_score: parseFloat(row.querySelector(".bm-max").value) || 100,
      sort_order: parseInt(row.querySelector(".bm-sort").value, 10) || i,
    })).filter((b) => b.benchmark_name);

    const priceVal = parseFloat(document.getElementById("fPrice").value);
    const payload = {
      id: v("fId"),
      hfModelId: v("fHfId"),
      displayName: v("fName"),
      shortDescription: v("fDesc"),
      parametersDisplay: v("fParams"),
      contextLengthDisplay: v("fCtx"),
      license: v("fLicense"),
      badgeCode: v("fBadge") || null,
      catalogType: document.getElementById("fCatType").value,
      categories: cats,
      sortOrder: parseInt(document.getElementById("fSort").value, 10) || 0,
      fromPrice: isNaN(priceVal) ? (hw.length ? Math.min(...hw.map((p) => p.per_gpu_hourly_price_usd_micros / 1e6)) : null) : priceVal,
      hardwareProfiles: hw,
      benchmarks,
    };
    if (this._revision) payload.revision = this._revision;
    return { payload, errors };
  },

  async save(submit) {
    const { payload, errors } = this.collect();
    if (errors.length) { toast("Thiếu/sai: " + errors.join(", "), "error"); return; }
    try {
      let r = await api("POST", "/admin/catalog/entries", payload);
      toast("Đã tạo entry (draft).", "ok");
      if (submit) {
        try {
          await api("POST", `/admin/catalog/entries/${payload.id}/submit`);
          toast("Đã submit — chờ duyệt.", "ok");
        } catch (e) {
          toast("Đã tạo draft nhưng submit lỗi: " + e.message, "error");
        }
      }
      location.hash = "#/";
    } catch (e) {
      toast(e.message, "error");
    }
  },
};