// Mini Marketplace API (Express + PostgreSQL) + static hosting for the React web app / PWA.
try { process.loadEnvFile && process.loadEnvFile(require('path').join(__dirname, '..', '.env')); } catch {}
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { db, tx, init, round2, mode } = require('./db');
const { hashPassword, verifyPassword, sign, loadUser, requireRole } = require('./auth');
const { HttpError, saveProduct, loadProduct, isVisible, priceSelection, titleFor } = require('./products');
const { bedSvg } = require('./placeholder');
const { describeProduct, similarProducts } = require('./ai');
const { seed } = require('./seed');

const app = express();
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const DIST = path.join(__dirname, '..', 'web', 'dist');

// CORS so the mobile app (Expo web / other origins) can call the API. Auth uses bearer tokens, not cookies.
app.use((req, res, next) => {
  res.set({ 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' });
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: '1mb' }));
app.use('/api', loadUser);
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));

const api = express.Router();
const wrap = (fn) => (req, res, next) => { Promise.resolve().then(() => fn(req, res)).catch(next); };

// ---------- placeholder images (tinted by colour) ----------
api.get('/placeholder', (req, res) => {
  res.type('image/svg+xml').set('Cache-Control', 'public, max-age=86400').send(bedSvg(Number(req.query.view) || 1, req.query.hex));
});
api.get('/health', wrap(async (_req, res) => { await db.get('SELECT 1 AS ok'); res.json({ ok: true, database: mode }); }));

// ---------- auth ----------
api.post('/auth/signup', wrap(async (req, res) => {
  const { email, password, name, role, shop_name } = req.body || {};
  if (!/^\S+@\S+\.\S+$/.test(email || '')) throw new HttpError(400, 'Enter a valid email');
  if (!password || password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
  if (!name || !String(name).trim()) throw new HttpError(400, 'Name is required');
  const r = role === 'seller' ? 'seller' : 'buyer'; // admins can never self-register
  if (r === 'seller' && !String(shop_name || '').trim()) throw new HttpError(400, 'Shop name is required for sellers');
  if (await db.get('SELECT 1 FROM users WHERE email=?', [email.toLowerCase()])) throw new HttpError(409, 'Email already registered');
  const { salt, hash } = hashPassword(password);
  const id = await db.insert('INSERT INTO users (email,name,password_hash,salt,role,shop_name,status) VALUES (?,?,?,?,?,?,?)',
    [email.toLowerCase(), String(name).trim(), hash, salt, r, r === 'seller' ? String(shop_name).trim() : null, r === 'seller' ? 'pending' : 'approved']);
  res.json({ token: sign(id), user: await db.get('SELECT id,email,name,role,shop_name,status FROM users WHERE id=?', [id]) });
}));
api.post('/auth/login', wrap(async (req, res) => {
  const { email, password } = req.body || {};
  const u = await db.get('SELECT * FROM users WHERE email=?', [String(email || '').toLowerCase()]);
  if (!u || !verifyPassword(String(password || ''), u.salt, u.password_hash)) throw new HttpError(401, 'Wrong email or password');
  const { password_hash, salt, ...safe } = u;
  res.json({ token: sign(u.id), user: safe });
}));
api.get('/me', (req, res) => res.json({ user: req.user }));

// ---------- catalogue ----------
api.get('/categories', wrap(async (_req, res) => res.json(await db.all('SELECT id,name,parent_id FROM categories ORDER BY name'))));

async function listCard(p) {
  const colours = await db.all(`SELECT v.label,v.hex FROM option_values v JOIN option_groups g ON g.id=v.group_id WHERE g.product_id=? AND g.type='swatch' ORDER BY v.position`, [p.id]);
  const img = await db.get('SELECT url FROM product_images WHERE product_id=? ORDER BY position LIMIT 1', [p.id]);
  return { id: p.id, title: p.title, base_price: p.base_price, compare_at_price: p.compare_at_price,
    discount_percent: p.compare_at_price > p.base_price ? Math.round((1 - p.base_price / p.compare_at_price) * 100) : 0,
    image: img ? img.url : null, shop_name: p.shop_name, category_name: p.category_name, colours };
}

api.get('/products', wrap(async (req, res) => {
  const { q, minPrice, maxPrice, colour, size, category, sort } = req.query;
  const where = ["p.status='active'", "u.status='approved'"]; const args = [];
  if (q) { where.push('(p.title ILIKE ? OR p.description ILIKE ?)'); args.push(`%${q}%`, `%${q}%`); }
  if (minPrice !== undefined && minPrice !== '' && Number.isFinite(Number(minPrice))) { where.push('p.base_price >= ?'); args.push(Number(minPrice)); }
  if (maxPrice !== undefined && maxPrice !== '' && Number.isFinite(Number(maxPrice))) { where.push('p.base_price <= ?'); args.push(Number(maxPrice)); }
  if (category && Number.isInteger(Number(category))) { where.push('(p.category_id = ? OR c.parent_id = ?)'); args.push(Number(category), Number(category)); }
  if (colour) { where.push(`EXISTS (SELECT 1 FROM option_groups g JOIN option_values v ON v.group_id=g.id WHERE g.product_id=p.id AND g.type='swatch' AND v.label ILIKE ?)`); args.push(`%${colour}%`); }
  if (size) { where.push(`EXISTS (SELECT 1 FROM option_groups g JOIN option_values v ON v.group_id=g.id WHERE g.product_id=p.id AND lower(g.name)='size' AND v.label ILIKE ?)`); args.push(`%${size}%`); }
  const order = { price_asc: 'p.base_price ASC', price_desc: 'p.base_price DESC' }[sort] || 'p.id DESC';
  const rows = await db.all(`SELECT p.*, u.shop_name, c.name AS category_name FROM products p JOIN users u ON u.id=p.seller_id
    LEFT JOIN categories c ON c.id=p.category_id WHERE ${where.join(' AND ')} ORDER BY ${order}`, args);
  res.json(await Promise.all(rows.map(listCard)));
}));

// Filter facets are built from the DB (not hard-coded)
api.get('/facets', wrap(async (_req, res) => {
  const vis = `p.status='active' AND u.status='approved'`;
  const vals = (cond) => db.all(`SELECT DISTINCT v.label, v.hex FROM option_values v JOIN option_groups g ON g.id=v.group_id
    JOIN products p ON p.id=g.product_id JOIN users u ON u.id=p.seller_id WHERE ${vis} AND ${cond} ORDER BY v.label`);
  res.json({ colours: await vals(`g.type='swatch'`), sizes: await vals(`lower(g.name)='size'`), categories: await db.all('SELECT id,name,parent_id FROM categories ORDER BY name') });
}));

api.get('/products/:id', wrap(async (req, res) => {
  const p = Number.isInteger(Number(req.params.id)) ? await loadProduct(Number(req.params.id)) : null;
  const mine = req.user && p && (req.user.id === p.seller_id || req.user.role === 'admin');
  if (!p || (!isVisible(p) && !mine)) throw new HttpError(404, 'Product not found');
  p.similar = await similarProducts(p, listCard);
  res.json(p);
}));

// Live price quote (same function the cart uses) so app and web always agree
api.post('/products/:id/price', wrap(async (req, res) => {
  const p = await loadProduct(Number(req.params.id));
  if (!p) throw new HttpError(404, 'Product not found');
  const s = priceSelection(p, req.body.value_ids);
  res.json({ unit_price: s.unitPrice, options: s.options, title: titleFor(p, s.colour) });
}));

// ---------- cart ----------
const tint = (url, colour) => (colour && colour.hex && url.startsWith('/api/placeholder') ? `${url}&hex=${encodeURIComponent(colour.hex)}` : url);
async function cartView(userId) {
  const rows = await db.all('SELECT * FROM cart_items WHERE user_id=? ORDER BY id', [userId]);
  const lines = []; let total = 0;
  for (const r of rows) {
    const p = await loadProduct(r.product_id);
    let s;
    try { s = priceSelection(p, JSON.parse(r.value_ids)); } catch { await db.run('DELETE FROM cart_items WHERE id=?', [r.id]); continue; }
    const img = s.colour && s.colour.image_url ? s.colour.image_url : (p.images[0] ? tint(p.images[0], s.colour) : null);
    const line_total = round2(s.unitPrice * r.qty);
    total += line_total;
    lines.push({ id: r.id, product_id: p.id, title: titleFor(p, s.colour), image: img, options: s.options, qty: r.qty,
      unit_price: s.unitPrice, line_total, available: isVisible(p) });
  }
  return { lines, total: round2(total), count: lines.reduce((a, l) => a + l.qty, 0) };
}
const anyUser = requireRole('buyer', 'seller', 'admin');
api.get('/cart', anyUser, wrap(async (req, res) => res.json(await cartView(req.user.id))));
api.post('/cart', anyUser, wrap(async (req, res) => {
  const p = await loadProduct(Number(req.body.product_id));
  if (!p || !isVisible(p)) throw new HttpError(404, 'Product not available');
  const s = priceSelection(p, req.body.value_ids);
  const qty = Math.max(1, Math.min(20, parseInt(req.body.qty, 10) || 1));
  const key = `${p.id}:${s.valueIds.join(',')}`; // different option combos => different cart lines
  await db.run(`INSERT INTO cart_items (user_id,product_id,variant_key,value_ids,qty) VALUES (?,?,?,?,?)
    ON CONFLICT (user_id,variant_key) DO UPDATE SET qty=LEAST(20, cart_items.qty+EXCLUDED.qty)`, [req.user.id, p.id, key, JSON.stringify(s.valueIds), qty]);
  res.json(await cartView(req.user.id));
}));
api.patch('/cart/:id', anyUser, wrap(async (req, res) => {
  const qty = parseInt(req.body.qty, 10);
  if (!(qty >= 1 && qty <= 20)) throw new HttpError(400, 'Quantity must be 1-20');
  await db.run('UPDATE cart_items SET qty=? WHERE id=? AND user_id=?', [qty, Number(req.params.id), req.user.id]);
  res.json(await cartView(req.user.id));
}));
api.delete('/cart/:id', anyUser, wrap(async (req, res) => {
  await db.run('DELETE FROM cart_items WHERE id=? AND user_id=?', [Number(req.params.id), req.user.id]);
  res.json(await cartView(req.user.id));
}));

// ---------- checkout (fake payment) ----------
api.post('/checkout', anyUser, wrap(async (req, res) => {
  const { name, address, phone } = req.body || {};
  if (!String(name || '').trim() || !String(address || '').trim()) throw new HttpError(400, 'Name and address are required');
  const cart = await cartView(req.user.id);
  if (!cart.lines.length) throw new HttpError(400, 'Your basket is empty');
  if (cart.lines.some((l) => !l.available)) throw new HttpError(400, 'An item in your basket is no longer available');
  const bySeller = new Map();
  for (const l of cart.lines) {
    const sid = (await db.get('SELECT seller_id FROM products WHERE id=?', [l.product_id])).seller_id;
    if (!bySeller.has(sid)) bySeller.set(sid, []);
    bySeller.get(sid).push(l);
  }
  const ids = await tx(async (t) => {
    const out = [];
    for (const [sid, lines] of bySeller) {
      const total = round2(lines.reduce((a, l) => a + l.line_total, 0));
      const oid = await t.insert('INSERT INTO orders (buyer_id,seller_id,total,ship_name,ship_address,ship_phone) VALUES (?,?,?,?,?,?)',
        [req.user.id, sid, total, String(name).trim(), String(address).trim(), String(phone || '').trim()]);
      for (const l of lines)
        await t.run('INSERT INTO order_items (order_id,product_id,title,image_url,options_json,qty,unit_price) VALUES (?,?,?,?,?,?,?)',
          [oid, l.product_id, l.title, l.image, JSON.stringify(l.options), l.qty, l.unit_price]);
      out.push(oid);
    }
    await t.run('DELETE FROM cart_items WHERE user_id=?', [req.user.id]);
    return out;
  });
  res.json({ order_ids: ids });
}));

async function ordersFor(col, id) {
  const orders = await db.all(`SELECT o.*, b.name AS buyer_name, s.shop_name FROM orders o JOIN users b ON b.id=o.buyer_id
    JOIN users s ON s.id=o.seller_id WHERE o.${col}=? ORDER BY o.id DESC`, [id]);
  for (const o of orders) {
    o.items = (await db.all('SELECT * FROM order_items WHERE order_id=? ORDER BY id', [o.id])).map((i) => { const { options_json, ...rest } = i; return { ...rest, options: JSON.parse(options_json) }; });
  }
  return orders;
}
api.get('/orders', anyUser, wrap(async (req, res) => res.json(await ordersFor('buyer_id', req.user.id))));

// ---------- seller ----------
const seller = requireRole('seller');
api.get('/seller/products', seller, wrap(async (req, res) => {
  const ids = await db.all('SELECT id FROM products WHERE seller_id=? ORDER BY id DESC', [req.user.id]);
  res.json(await Promise.all(ids.map((r) => loadProduct(r.id))));
}));
api.post('/seller/products', seller, wrap(async (req, res) => res.json({ id: await saveProduct(req.user.id, req.body) })));
api.put('/seller/products/:id', seller, wrap(async (req, res) => res.json({ id: await saveProduct(req.user.id, req.body, Number(req.params.id)) })));
api.patch('/seller/products/:id', seller, wrap(async (req, res) => {
  await db.run('UPDATE products SET status=? WHERE id=? AND seller_id=?', [req.body.status === 'hidden' ? 'hidden' : 'active', Number(req.params.id), req.user.id]);
  res.json({ ok: true });
}));
api.get('/seller/orders', seller, wrap(async (req, res) => res.json(await ordersFor('seller_id', req.user.id))));
const STATUSES = ['New', 'Confirmed', 'Shipped', 'Delivered'];
api.patch('/seller/orders/:id', seller, wrap(async (req, res) => {
  if (!STATUSES.includes(req.body.status)) throw new HttpError(400, 'Invalid status');
  const r = await db.run('UPDATE orders SET status=?, updated_at=NOW() WHERE id=? AND seller_id=?', [req.body.status, Number(req.params.id), req.user.id]);
  if (!r.changes) throw new HttpError(404, 'Order not found');
  res.json({ ok: true });
}));

const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
api.post('/seller/upload', seller, express.raw({ type: Object.keys(EXT), limit: '4mb' }), wrap(async (req, res) => {
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
api.get('/admin/sellers', admin, wrap(async (_req, res) => res.json(await db.all(`SELECT id,email,name,shop_name,status,created_at,
  (SELECT COUNT(*)::int FROM products WHERE seller_id=users.id) AS product_count FROM users WHERE role='seller' ORDER BY id DESC`))));
api.patch('/admin/sellers/:id', admin, wrap(async (req, res) => {
  if (!['approved', 'pending', 'hidden'].includes(req.body.status)) throw new HttpError(400, 'Invalid status');
  await db.run("UPDATE users SET status=? WHERE id=? AND role='seller'", [req.body.status, Number(req.params.id)]);
  res.json({ ok: true });
}));
api.get('/admin/products', admin, wrap(async (_req, res) => res.json(await db.all(`SELECT p.id,p.title,p.base_price,p.status,u.shop_name,u.status AS seller_status
  FROM products p JOIN users u ON u.id=p.seller_id ORDER BY p.id DESC`))));
api.patch('/admin/products/:id', admin, wrap(async (req, res) => {
  await db.run('UPDATE products SET status=? WHERE id=?', [req.body.status === 'hidden' ? 'hidden' : 'active', Number(req.params.id)]);
  res.json({ ok: true });
}));

app.use('/api', api);
app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found')));

// ---------- React app (built by Vite into web/dist); SPA fallback for client-side routes ----------
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST, { index: false, maxAge: '1h' }));
  app.get(/^\/(?!api\/|uploads\/).*/, (_req, res) => res.sendFile(path.join(DIST, 'index.html')));
} else {
  app.get('/', (_req, res) => res.type('text').send('API is running. Build the web app first: npm run build (or run `npm run dev` for development).'));
}

app.use((err, _req, res, _next) => {
  if (!(err instanceof HttpError)) console.error(err);
  res.status(err.status || 500).json({ error: err instanceof HttpError ? err.message : 'Something went wrong' });
});

(async () => {
  await init();
  if (!(await db.get('SELECT 1 FROM users LIMIT 1'))) await seed(); // first run: demo data
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Marketplace running on http://localhost:${PORT} (database: ${mode})`));
})().catch((e) => { console.error('Failed to start:', e); process.exit(1); });
