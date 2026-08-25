"use strict";

// Bootstrap admin API key — chạy 1 lần duy nhất trên prod để lấy key đầu tiên
// (vì sau khi bật KEYS_ADMIN_REQUIRED=true, /v1/keys/* cần scope 'admin' mà chưa có key nào).
//
// Cách chạy:
//   BOOTSTRAP_ADMIN_TOKEN=$SECRET node db/scripts/bootstrap-admin-key.js --name "bootstrap-admin"
// hoặc qua web (sẽ cần route bootstrap riêng — TODO nếu muốn UI):
//   POST /v1/keys/_/bootstrap  Header: X-Bootstrap-Token: $SECRET  body: {name}
//
// Sinh full_key, ghi vào store với scopes=['admin', 'chat', 'endpoints', 'batch', 'byom', 'playground'],
// in ra full_key MỘT LẦN — copy ngay.

const store = require("../../src/keys/store");

const BOOTSTRAP_TOKEN = process.env.BOOTSTRAP_ADMIN_TOKEN || "";
const name = process.argv.includes("--name")
  ? process.argv[process.argv.indexOf("--name") + 1]
  : "bootstrap-admin";

if (!BOOTSTRAP_TOKEN) {
  console.error("BOOTSTRAP_ADMIN_TOKEN env bắt buộc — set 1 secret ngẫu nhiên dài ≥32 ký tự.");
  process.exit(1);
}

try {
  // scope 'admin' để qua gate /keys/*, kèm các scope nghiệp vụ để key này dùng được API luôn
  const { id, fullKey, record } = store.create({
    name,
    scopes: ["admin", "chat", "endpoints", "batch", "byom", "playground"],
  });
  console.log("Bootstrap admin key created:");
  console.log("  id:", id);
  console.log("  name:", record.name);
  console.log("  scopes:", record.scopes.join(", "));
  console.log("  full_key (COPY NGAY — không hiển thị lại):");
  console.log("  " + fullKey);
} catch (e) {
  console.error("Bootstrap lỗi:", e.message);
  process.exit(1);
}
