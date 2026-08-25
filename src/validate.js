function validateProduct(body, { partial = false } = {}) {
  const errors = [];
  const out = {};

  if (body.name !== undefined || !partial) {
    if (typeof body.name !== 'string' || body.name.trim() === '') {
      errors.push('name: bắt buộc, phải là chuỗi không rỗng');
    } else {
      out.name = body.name.trim();
    }
  }

  if (body.description !== undefined) {
    if (typeof body.description !== 'string') {
      errors.push('description: phải là chuỗi');
    } else {
      out.description = body.description;
    }
  } else if (!partial) {
    out.description = '';
  }

  if (body.price !== undefined || !partial) {
    const price = Number(body.price);
    if (body.price === undefined || body.price === '' || Number.isNaN(price) || price < 0) {
      errors.push('price: bắt buộc, phải là số >= 0');
    } else {
      out.price = price;
    }
  }

  if (body.stock !== undefined || !partial) {
    const stock = Number(body.stock);
    if (body.stock === undefined || body.stock === '' || !Number.isInteger(stock) || stock < 0) {
      errors.push('stock: bắt buộc, phải là số nguyên >= 0');
    } else {
      out.stock = stock;
    }
  }

  return { errors, value: out };
}

module.exports = { validateProduct };