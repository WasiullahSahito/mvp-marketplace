// Mini Marketplace API + static hosting for the web app and the PWA (one backend, one DB).
try { process.loadEnvFile && process.loadEnvFile(require('path').join(__dirname, '..', '.env')); } catch {}
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { db, tx, round2 } = require('./db');
const { hashPassword, verifyPassword, sign, loadUser, requireRole } = require('./auth');
const { HttpError, saveProduct, loadProduct, isVisible, priceSelection, titleFor } = require('./products');
const { bedSvg } = require('./placeholder');
const { describeProduct, similarProducts } = require('./ai');

const app = express();
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// CORS so the mobile app (Expo web / other origins) can call the API. Auth uses bearer tokens, not cookies.
app.use((req, res, next) => {
  res.set({ 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' });
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: '1mb' }));
app.use(loadUser);
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

const api = express.Router();
const wrap = (fn) => (req, res, next) => { try { const r = fn(req, res); if (r && r.catch) r.catch(next); } catch (e) { next(e); } };

// ---------- placeholder images (tinted by colour) ----------
api.get('/placeholder', (req, res) => {
  res.type('image/svg+xml').set('Cache-Control', 'public, max-age=86400').send(bedSvg(Number(req.query.view) || 1, req.query.hex));
});

// ---------- auth ----------
api.post('/auth/signup', wrap((req, res) => {
  const { email, password, name, role, shop_name } = req.body || {};
  if (!/^\S+@\S+\.\S+$/.test(email || '')) throw new HttpError(400, 'Enter a valid email');
  if (!password || password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
  if (!name || !String(name).trim()) throw new HttpError(400, 'Name is required');
  const r = role === 'seller' ? 'seller' : 'buyer'; // admins can never self-register
  if (r === 'seller' && !String(shop_name || '').trim()) throw new HttpError(400, 'Shop name is required for sellers');
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email.toLowerCase())) throw new HttpError(409, 'Email already registered');
  const { salt, hash } = hashPassword(password);
  const id = Number(db.prepare('INSERT INTO users (email,name,password_hash,salt,role,shop_name,status) VALUES (?,?,?,?,?,?,?)')
    .run(email.toLowerCase(), String(name).trim(), hash, salt, r, r === 'seller' ? String(shop_name).trim() : null, r === 'seller' ? 'pending' : 'approved').lastInsertRowid);
  res.json({ token: sign(id), user: db.prepare('SELECT id,email,name,role,shop_name,status FROM users WHERE id=?').get(id) });
}));
api.post('/auth/login', wrap((req, res) => {
  const { email, password } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(String(email || '').toLowerCase());
  if (!u || !verifyPassword(String(password || ''), u.salt, u.password_hash)) throw new HttpError(401, 'Wrong email or password');
  const { password_hash, salt, ...safe } = u;
  res.json({ token: sign(u.id), user: safe });
}));
api.get('/me', (req, res) => res.json({ user: req.user }));

// ---------- catalogue ----------
api.get('/categories', (_req, res) => res.json(db.prepare('SELECT id,name,parent_id FROM categories ORDER BY name').all()));

function listCard(p) {
  const colours = db.prepare(`SELECT v.label,v.hex FROM option_values v JOIN option_groups g ON g.id=v.group_id WHERE g.product_id=? AND g.type='swatch' ORDER BY v.position`).all(p.id);
  const img = db.prepare('SELECT url FROM product_images WHERE product_id=? ORDER BY position LIMIT 1').get(p.id);
  return { id: p.id, title: p.title, base_price: p.base_price, compare_at_price: p.compare_at_price,
    discount_percent: p.compare_at_price > p.base_price ? Math.round((1 - p.base_price / p.compare_at_price) * 100) : 0,
    image: img ? img.url : null, shop_name: p.shop_name, category_name: p.category_name, colours };
}

api.get('/products', wrap((req, res) => {
  const { q, minPrice, maxPrice, colour, size, category, sort } = req.query;
  const where = ["p.status='active'", "u.status='approved'"]; const args = [];
  if (q) { where.push('(p.title LIKE ? OR p.description LIKE ?)'); args.push(`%${q}%`, `%${q}%`); }
  if (minPrice !== undefined && minPrice !== '') { where.push('p.base_price >= ?'); args.push(Number(minPrice)); }
  if (maxPrice !== undefined && maxPrice !== '') { where.push('p.base_price <= ?'); args.push(Number(maxPrice)); }
  if (category) { where.push('(p.category_id = ? OR c.parent_id = ?)'); args.push(Number(category), Number(category)); }
  if (colour) { where.push(`EXISTS (SELECT 1 FROM option_groups g JOIN option_values v ON v.group_id=g.id WHERE g.product_id=p.id AND g.type='swatch' AND v.label LIKE ?)`); args.push(`%${colour}%`); }
  if (size) { where.push(`EXISTS (SELECT 1 FROM option_groups g JOIN option_values v ON v.group_id=g.id WHERE g.product_id=p.id AND lower(g.name)='size' AND v.label LIKE ?)`); args.push(`%${size}%`); }
  const order = { price_asc: 'p.base_price ASC', price_desc: 'p.base_price DESC' }[sort] || 'p.id DESC';
  const rows = db.prepare(`SELECT p.*, u.shop_name, c.name AS category_name FROM products p JOIN users u ON u.id=p.seller_id
    LEFT JOIN categories c ON c.id=p.category_id WHERE ${where.join(' AND ')} ORDER BY ${order}`).all(...args);
  res.json(rows.map(listCard));
}));

// Filter facets are built from the DB (not hard-coded)
api.get('/facets', (_req, res) => {
  const vis = `p.status='active' AND u.status='approved'`;
  const vals = (type, nameFilter) => db.prepare(`SELECT DISTINCT v.label, v.hex FROM option_values v JOIN option_groups g ON g.id=v.group_id
    JOIN products p ON p.id=g.product_id JOIN users u ON u.id=p.seller_id WHERE ${vis} AND ${type ? `g.type='${type}'` : `lower(g.name)='${nameFilter}'`} ORDER BY v.label`).all();
  res.json({ colours: vals('swatch'), sizes: vals(null, 'size'), categories: db.prepare('SELECT id,name,parent_id FROM categories ORDER BY name').all() });
});

api.get('/products/:id', wrap((req, res) => {
  const p = loadProduct(Number(req.params.id));
  const mine = req.user && (req.user.id === p?.seller_id || req.user.role === 'admin');
  if (!p || (!isVisible(p) && !mine)) throw new HttpError(404, 'Product not found');
  p.similar = similarProducts(p, listCard);
  res.json(p);
}));

// Live price quote (same function the cart uses) so app and web always agree
api.post('/products/:id/price', wrap((req, res) => {
  const p = loadProduct(Number(req.params.id));
  if (!p) throw new HttpError(404, 'Product not found');
  const s = priceSelection(p, req.body.value_ids);
  res.json({ unit_price: s.unitPrice, options: s.options, title: titleFor(p, s.colour) });
}));

// ---------- cart ----------
function cartView(userId) {
  const rows = db.prepare('SELECT * FROM cart_items WHERE user_id=? ORDER BY id').all(userId);
  const lines = []; let total = 0;
  for (const r of rows) {
    const p = loadProduct(r.product_id);
    let s;
    try { s = priceSelection(p, JSON.parse(r.value_ids)); } catch { db.prepare('DELETE FROM cart_items WHERE id=?').run(r.id); continue; }
    const img = s.colour && s.colour.image_url ? s.colour.image_url : (p.images[0] ? tint(p.images[0], s.colour) : null);
    const line_total = round2(s.unitPrice * r.qty);
    total += line_total;
    lines.push({ id: r.id, product_id: p.id, title: titleFor(p, s.colour), image: img, options: s.options, qty: r.qty,
      unit_price: s.unitPrice, line_total, available: isVisible(p) });
  }
  return { lines, total: round2(total), count: lines.reduce((a, l) => a + l.qty, 0) };
}
function tint(url, colour) {
  return colour && colour.hex && url.startsWith('/api/placeholder') ? `${url}&hex=${encodeURIComponent(colour.hex)}` : url;
}
api.get('/cart', requireRole('buyer', 'seller', 'admin'), wrap((req, res) => res.json(cartView(req.user.id))));
api.post('/cart', requireRole('buyer', 'seller', 'admin'), wrap((req, res) => {
  const p = loadProduct(Number(req.body.product_id));
  if (!isVisible(p)) throw new HttpError(404, 'Product not available');
  const s = priceSelection(p, req.body.value_ids);
  const qty = Math.max(1, Math.min(20, parseInt(req.body.qty, 10) || 1));
  const key = `${p.id}:${s.valueIds.join(',')}`; // different option combos => different cart lines
  db.prepare(`INSERT INTO cart_items (user_id,product_id,variant_key,value_ids,qty) VALUES (?,?,?,?,?)
    ON CONFLICT(user_id,variant_key) DO UPDATE SET qty=MIN(20, qty+excluded.qty)`).run(req.user.id, p.id, key, JSON.stringify(s.valueIds), qty);
  res.json(cartView(req.user.id));
}));
api.patch('/cart/:id', requireRole('buyer', 'seller', 'admin'), wrap((req, res) => {
  const qty = parseInt(req.body.qty, 10);
  if (!(qty >= 1 && qty <= 20)) throw new HttpError(400, 'Quantity must be 1-20');
  db.prepare('UPDATE cart_items SET qty=? WHERE id=? AND user_id=?').run(qty, req.params.id, req.user.id);
  res.json(cartView(req.user.id));
}));
api.delete('/cart/:id', requireRole('buyer', 'seller', 'admin'), wrap((req, res) => {
  db.prepare('DELETE FROM cart_items WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json(cartView(req.user.id));
}));

// ---------- checkout (fake payment) ----------
api.post('/checkout', requireRole('buyer', 'seller', 'admin'), wrap((req, res) => {
  const { name, address, phone } = req.body || {};
  if (!String(name || '').trim() || !String(address || '').trim()) throw new HttpError(400, 'Name and address are required');
  const cart = cartView(req.user.id);
  if (!cart.lines.length) throw new HttpError(400, 'Your basket is empty');
  if (cart.lines.some((l) => !l.available)) throw new HttpError(400, 'An item in your basket is no longer available');
  const ids = tx(() => {
    const bySeller = new Map();
    for (const l of cart.lines) {
      const sid = db.prepare('SELECT seller_id FROM products WHERE id=?').get(l.product_id).seller_id;
      if (!bySeller.has(sid)) bySeller.set(sid, []);
      bySeller.get(sid).push(l);
    }
    const out = [];
    for (const [sid, lines] of bySeller) {
      const total = round2(lines.reduce((a, l) => a + l.line_total, 0));
      const oid = Number(db.prepare('INSERT INTO orders (buyer_id,seller_id,total,ship_name,ship_address,ship_phone) VALUES (?,?,?,?,?,?)')
        .run(req.user.id, sid, total, String(name).trim(), String(address).trim(), String(phone || '').trim()).lastInsertRowid);
      for (const l of lines)
        db.prepare('INSERT INTO order_items (order_id,product_id,title,image_url,options_json,qty,unit_price) VALUES (?,?,?,?,?,?,?)')
          .run(oid, l.product_id, l.title, l.image, JSON.stringify(l.options), l.qty, l.unit_price);
      out.push(oid);
    }
    db.prepare('DELETE FROM cart_items WHERE user_id=?').run(req.user.id);
    return out;
  });
  res.json({ order_ids: ids });
}));

function ordersFor(where, arg) {
  const orders = db.prepare(`SELECT o.*, b.name AS buyer_name, s.shop_name FROM orders o JOIN users b ON b.id=o.buyer_id
    JOIN users s ON s.id=o.seller_id WHERE ${where} ORDER BY o.id DESC`).all(arg);
  for (const o of orders) {
    o.items = db.prepare('SELECT * FROM order_items WHERE order_id=?').all(o.id).map((i) => ({ ...i, options: JSON.parse(i.options_json) }));
    o.items.forEach((i) => delete i.options_json);
  }
  return orders;
}
api.get('/orders', requireRole('buyer', 'seller', 'admin'), wrap((req, res) => res.json(ordersFor('o.buyer_id=?', req.user.id))));

// ---------- seller ----------
const seller = requireRole('seller');
api.get('/seller/products', seller, wrap((req, res) => {
  res.json(db.prepare('SELECT id FROM products WHERE seller_id=? ORDER BY id DESC').all(req.user.id).map((r) => loadProduct(r.id)));
}));
api.post('/seller/products', seller, wrap((req, res) => res.json({ id: saveProduct(req.user.id, req.body) })));
api.put('/seller/products/:id', seller, wrap((req, res) => res.json({ id: saveProduct(req.user.id, req.body, Number(req.params.id)) })));
api.patch('/seller/products/:id', seller, wrap((req, res) => {
  const st = req.body.status === 'hidden' ? 'hidden' : 'active';
  db.prepare('UPDATE products SET status=? WHERE id=? AND seller_id=?').run(st, req.params.id, req.user.id);
  res.json({ ok: true });
}));
api.get('/seller/orders', seller, wrap((req, res) => res.json(ordersFor('o.seller_id=?', req.user.id))));
const STATUSES = ['New', 'Confirmed', 'Shipped', 'Delivered'];
api.patch('/seller/orders/:id', seller, wrap((req, res) => {
  if (!STATUSES.includes(req.body.status)) throw new HttpError(400, 'Invalid status');
  const r = db.prepare("UPDATE orders SET status=?, updated_at=datetime('now') WHERE id=? AND seller_id=?").run(req.body.status, req.params.id, req.user.id);
  if (!r.changes) throw new HttpError(404, 'Order not found');
  res.json({ ok: true });
}));

const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
api.post('/seller/upload', seller, express.raw({ type: Object.keys(EXT), limit: '4mb' }), wrap((req, res) => {
  const ext = EXT[req.headers['content-type']?.split(';')[0]];
  if (!ext || !Buffer.isBuffer(req.body) || !req.body.length) throw new HttpError(400, 'Upload a PNG, JPG, WebP or GIF (max 4MB)');
  const name = crypto.randomBytes(12).toString('hex') + '.' + ext;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), req.body);
  res.json({ url: '/uploads/' + name });
}));

// ---------- AI ----------
api.post('/ai/describe', seller, wrap(async (req, res) => res.json(await describeProduct(req.body || {}))));

// ---------- admin ----------
const admin = requireRole('admin');
api.get('/admin/sellers', admin, (_req, res) => res.json(db.prepare(`SELECT id,email,name,shop_name,status,created_at,
  (SELECT COUNT(*) FROM products WHERE seller_id=users.id) AS product_count FROM users WHERE role='seller' ORDER BY id DESC`).all()));
api.patch('/admin/sellers/:id', admin, wrap((req, res) => {
  if (!['approved', 'pending', 'hidden'].includes(req.body.status)) throw new HttpError(400, 'Invalid status');
  db.prepare("UPDATE users SET status=? WHERE id=? AND role='seller'").run(req.body.status, req.params.id);
  res.json({ ok: true });
}));
api.get('/admin/products', admin, (_req, res) => res.json(db.prepare(`SELECT p.id,p.title,p.base_price,p.status,u.shop_name,u.status AS seller_status
  FROM products p JOIN users u ON u.id=p.seller_id ORDER BY p.id DESC`).all()));
api.patch('/admin/products/:id', admin, wrap((req, res) => {
  db.prepare('UPDATE products SET status=? WHERE id=?').run(req.body.status === 'hidden' ? 'hidden' : 'active', req.params.id);
  res.json({ ok: true });
}));

app.use('/api', api);
app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found')));
app.use((err, _req, res, _next) => {
  if (!(err instanceof HttpError)) console.error(err);
  res.status(err.status || 500).json({ error: err instanceof HttpError ? err.message : 'Something went wrong' });
});

// first run: seed demo data automatically
if (!db.prepare('SELECT 1 FROM users LIMIT 1').get()) require('./seed');

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Marketplace running on http://localhost:${PORT}`));
