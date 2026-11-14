// Product, option and pricing logic. The server is the source of truth for prices.
const { db, tx, round2 } = require('./db');

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function num(v, name, { min = 0, required = true } = {}) {
  if (v === '' || v === null || v === undefined) {
    if (required) throw new HttpError(400, `${name} is required`);
    return null;
  }
  const n = Number(v);
  if (!Number.isFinite(n)) throw new HttpError(400, `${name} must be a number`);
  if (min !== null && n < min) throw new HttpError(400, `${name} must be at least ${min}`);
  return round2(n);
}

function validate(p) {
  if (!p || typeof p !== 'object') throw new HttpError(400, 'Invalid body');
  const title = String(p.title || '').trim();
  if (!title) throw new HttpError(400, 'Title is required');
  const out = {
    title,
    description: String(p.description || '').trim(),
    category_id: p.category_id ? Number(p.category_id) : null,
    base_price: num(p.base_price, 'Base price', { min: 0.01 }),
    compare_at_price: num(p.compare_at_price, 'Compare-at price', { required: false }),
    images: (Array.isArray(p.images) ? p.images : []).map((u) => String(u).trim()).filter(Boolean),
    groups: [],
  };
  if (out.compare_at_price !== null && out.compare_at_price <= out.base_price)
    throw new HttpError(400, 'Compare-at price must be higher than the base price');
  (Array.isArray(p.groups) ? p.groups : []).forEach((g, gi) => {
    const name = String(g.name || '').trim();
    if (!name) throw new HttpError(400, `Option group #${gi + 1} needs a name`);
    const type = ['swatch', 'select', 'checkbox'].includes(g.type) ? g.type : 'select';
    const values = (Array.isArray(g.values) ? g.values : []).map((v, vi) => {
      const label = String(v.label || '').trim();
      if (!label) throw new HttpError(400, `Option "${name}" has a value with no label`);
      let hex = v.hex ? String(v.hex).trim() : null;
      if (hex && !/^#[0-9a-fA-F]{6}$/.test(hex)) throw new HttpError(400, `Bad colour code for ${label}`);
      return {
        id: v.id ? Number(v.id) : null,
        label,
        price_delta: num(v.price_delta === undefined ? 0 : v.price_delta, `Price for ${label}`, { min: null }),
        hex,
        image_url: v.image_url ? String(v.image_url).trim() : null,
        position: vi,
      };
    });
    if (!values.length) throw new HttpError(400, `Option "${name}" needs at least one value`);
    out.groups.push({ id: g.id ? Number(g.id) : null, name, type, required: g.required === false || g.required === 0 ? 0 : 1, values, position: gi });
  });
  return out;
}

async function saveProduct(sellerId, payload, productId = null) {
  const p = validate(payload);
  return tx(async (t) => {
    let id = productId;
    if (id) {
      const own = await t.get('SELECT id FROM products WHERE id=? AND seller_id=?', [id, sellerId]);
      if (!own) throw new HttpError(404, 'Product not found');
      await t.run('UPDATE products SET title=?, description=?, category_id=?, base_price=?, compare_at_price=? WHERE id=?',
        [p.title, p.description, p.category_id, p.base_price, p.compare_at_price, id]);
    } else {
      id = await t.insert('INSERT INTO products (seller_id,title,description,category_id,base_price,compare_at_price) VALUES (?,?,?,?,?,?)',
        [sellerId, p.title, p.description, p.category_id, p.base_price, p.compare_at_price]);
    }
    await t.run('DELETE FROM product_images WHERE product_id=?', [id]);
    for (let i = 0; i < p.images.length; i++) await t.run('INSERT INTO product_images (product_id,url,position) VALUES (?,?,?)', [id, p.images[i], i]);

    // upsert groups/values by id; delete the ones the seller removed
    const keepG = [];
    for (const g of p.groups) {
      let gid = g.id && (await t.get('SELECT id FROM option_groups WHERE id=? AND product_id=?', [g.id, id])) ? g.id : null;
      if (gid) await t.run('UPDATE option_groups SET name=?, type=?, required=?, position=? WHERE id=?', [g.name, g.type, g.required, g.position, gid]);
      else gid = await t.insert('INSERT INTO option_groups (product_id,name,type,required,position) VALUES (?,?,?,?,?)', [id, g.name, g.type, g.required, g.position]);
      keepG.push(gid);
      const keepV = [];
      for (const v of g.values) {
        let vid = v.id && (await t.get('SELECT id FROM option_values WHERE id=? AND group_id=?', [v.id, gid])) ? v.id : null;
        if (vid) await t.run('UPDATE option_values SET label=?, price_delta=?, hex=?, image_url=?, position=? WHERE id=?', [v.label, v.price_delta, v.hex, v.image_url, v.position, vid]);
        else vid = await t.insert('INSERT INTO option_values (group_id,label,price_delta,hex,image_url,position) VALUES (?,?,?,?,?,?)', [gid, v.label, v.price_delta, v.hex, v.image_url, v.position]);
        keepV.push(vid);
      }
      await t.run(`DELETE FROM option_values WHERE group_id=? AND id NOT IN (${keepV.map(Number).join(',')})`, [gid]);
    }
    if (keepG.length) await t.run(`DELETE FROM option_groups WHERE product_id=? AND id NOT IN (${keepG.map(Number).join(',')})`, [id]);
    else await t.run('DELETE FROM option_groups WHERE product_id=?', [id]);
    return id;
  });
}

async function loadProduct(id) {
  const p = await db.get(`SELECT p.*, u.shop_name, u.status AS seller_status, c.name AS category_name
    FROM products p JOIN users u ON u.id=p.seller_id LEFT JOIN categories c ON c.id=p.category_id WHERE p.id=?`, [id]);
  if (!p) return null;
  p.images = (await db.all('SELECT url FROM product_images WHERE product_id=? ORDER BY position', [id])).map((r) => r.url);
  p.groups = await db.all('SELECT * FROM option_groups WHERE product_id=? ORDER BY position, id', [id]);
  for (const g of p.groups) {
    g.values = await db.all('SELECT id,label,price_delta,hex,image_url FROM option_values WHERE group_id=? ORDER BY position, id', [g.id]);
    g.required = !!g.required;
  }
  p.discount_percent = p.compare_at_price && p.compare_at_price > p.base_price
    ? Math.round((1 - p.base_price / p.compare_at_price) * 100) : 0;
  return p;
}

const isVisible = (p) => p && p.status === 'active' && p.seller_status === 'approved';

/**
 * Validate a set of chosen option_value ids against the product and compute the price.
 * Returns { valueIds (sorted), options:[{group,label,price_delta}], unitPrice, colour }
 */
function priceSelection(product, valueIds) {
  const chosen = new Set((valueIds || []).map(Number));
  const options = [];
  let total = product.base_price;
  let colour = null;
  for (const g of product.groups) {
    const picked = g.values.filter((v) => chosen.has(v.id));
    if (picked.length > 1) throw new HttpError(400, `Choose only one ${g.name}`);
    if (!picked.length) {
      if (g.required) throw new HttpError(400, `Please choose a ${g.name}`);
      continue;
    }
    const v = picked[0];
    total += v.price_delta;
    options.push({ group: g.name, label: v.label, price_delta: v.price_delta, hex: v.hex || null, type: g.type });
    if (g.type === 'swatch') colour = v;
    chosen.delete(v.id);
  }
  if (chosen.size) throw new HttpError(400, 'Invalid option selected');
  const sorted = (valueIds || []).map(Number).sort((a, b) => a - b);
  return { valueIds: sorted, options, unitPrice: round2(total), colour };
}

// Title shown for a chosen colour, e.g. "Prague Divan Bed – Grey Naples"
function titleFor(product, colour) {
  return colour ? `${product.title.split(' – ')[0]} – ${colour.label}` : product.title;
}

module.exports = { HttpError, saveProduct, loadProduct, isVisible, priceSelection, titleFor, validate };
