const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'products.json');

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
  }
}

function readAll() {
  ensureStore();
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

function writeAll(items) {
  ensureStore();
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(items, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

function list() {
  return readAll();
}

function getById(id) {
  return readAll().find((p) => p.id === id) || null;
}

function create(data) {
  const items = readAll();
  const now = new Date().toISOString();
  const product = {
    id: crypto.randomUUID(),
    name: data.name,
    description: data.description || '',
    price: data.price,
    stock: data.stock,
    createdAt: now,
    updatedAt: now,
  };
  items.push(product);
  writeAll(items);
  return product;
}

function update(id, data) {
  const items = readAll();
  const idx = items.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  const current = items[idx];
  const updated = {
    ...current,
    name: data.name !== undefined ? data.name : current.name,
    description: data.description !== undefined ? data.description : current.description,
    price: data.price !== undefined ? data.price : current.price,
    stock: data.stock !== undefined ? data.stock : current.stock,
    updatedAt: new Date().toISOString(),
  };
  items[idx] = updated;
  writeAll(items);
  return updated;
}

function remove(id) {
  const items = readAll();
  const idx = items.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  items.splice(idx, 1);
  writeAll(items);
  return true;
}

module.exports = { list, getById, create, update, remove };