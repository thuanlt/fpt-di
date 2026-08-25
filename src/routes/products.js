const express = require('express');
const store = require('../store');
const { validateProduct } = require('../validate');

const router = express.Router();

router.get('/', (req, res) => {
  const items = store.list();
  const search = (req.query.search || '').trim().toLowerCase();
  if (!search) {
    return res.json({ count: items.length, data: items });
  }
  const filtered = items.filter(
    (p) =>
      p.name.toLowerCase().includes(search) ||
      (p.description || '').toLowerCase().includes(search)
  );
  res.json({ count: filtered.length, data: filtered });
});

router.get('/:id', (req, res) => {
  const product = store.getById(req.params.id);
  if (!product) {
    return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
  }
  res.json({ data: product });
});

router.post('/', (req, res) => {
  const { errors, value } = validateProduct(req.body || {});
  if (errors.length) {
    return res.status(400).json({ error: 'Dữ liệu không hợp lệ', details: errors });
  }
  const product = store.create(value);
  res.status(201).json({ data: product });
});

router.put('/:id', (req, res) => {
  const existing = store.getById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
  }
  const { errors, value } = validateProduct(req.body || {}, { partial: true });
  if (errors.length) {
    return res.status(400).json({ error: 'Dữ liệu không hợp lệ', details: errors });
  }
  const updated = store.update(req.params.id, value);
  res.json({ data: updated });
});

router.delete('/:id', (req, res) => {
  const removed = store.remove(req.params.id);
  if (!removed) {
    return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
  }
  res.json({ message: 'Đã xóa sản phẩm' });
});

module.exports = router;