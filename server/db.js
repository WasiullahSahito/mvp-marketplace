// PostgreSQL data layer.
//  - DATABASE_URL set  -> real PostgreSQL via `pg` (Render, Neon, Supabase, Railway, local install…)
//  - DATABASE_URL unset -> embedded PostgreSQL (PGlite) stored in ./data/pgdata, so `npm start` works with zero setup.
// Both speak the same SQL. Queries use `?` placeholders which are converted to $1, $2…
const path = require('path');
const fs = require('fs');

const DATABASE_URL = process.env.DATABASE_URL;
const NUMERIC = 1700;
let exec, execMany, runTx, mode;

if (DATABASE_URL) {
  const { Pool, types } = require('pg');
  types.setTypeParser(NUMERIC, parseFloat); // prices come back as JS numbers, not strings
  const local = /localhost|127\.0\.0\.1/.test(DATABASE_URL);
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: local || process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false } });
  mode = 'postgres';
  exec = (sql, p) => pool.query(sql, p);
  execMany = (sql) => pool.query(sql);
  runTx = async (fn) => {
    const c = await pool.connect();
    try { await c.query('BEGIN'); const r = await fn((sql, p) => c.query(sql, p)); await c.query('COMMIT'); return r; }
    catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; }
    finally { c.release(); }
  };
} else {
  const { PGlite } = require('@electric-sql/pglite');
  const dir = process.env.PGLITE_DIR || path.join(__dirname, '..', 'data', 'pgdata');
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  const lite = new PGlite(dir, { parsers: { [NUMERIC]: parseFloat } });
  mode = 'embedded';
  exec = (sql, p) => lite.query(sql, p);
  execMany = (sql) => lite.exec(sql);
  runTx = (fn) => lite.transaction((t) => fn((sql, p) => t.query(sql, p)));
}

const conv = (sql) => { let i = 0; return sql.replace(/\?/g, () => '$' + ++i); };
const rowsOf = (r) => r.rows;
const countOf = (r) => (r.rowCount ?? r.affectedRows ?? 0);

function helpers(q) {
  return {
    all: async (sql, p = []) => rowsOf(await q(conv(sql), p)),
    get: async (sql, p = []) => rowsOf(await q(conv(sql), p))[0],
    run: async (sql, p = []) => { const r = await q(conv(sql), p); return { changes: countOf(r), rows: rowsOf(r) }; },
    insert: async (sql, p = []) => rowsOf(await q(conv(sql) + ' RETURNING id', p))[0].id, // returns new id
  };
}
const db = helpers(exec);
const tx = (fn) => runTx((q) => fn(helpers(q)));

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('buyer','seller','admin')),
  shop_name TEXT,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved','pending','hidden')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id INTEGER REFERENCES categories(id)
);
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  seller_id INTEGER NOT NULL REFERENCES users(id),
  category_id INTEGER REFERENCES categories(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  base_price NUMERIC(10,2) NOT NULL CHECK (base_price > 0),
  compare_at_price NUMERIC(10,2),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','hidden')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS product_images (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);
-- type: swatch (colour circles) | select (choice buttons) | checkbox (optional add-on)
CREATE TABLE IF NOT EXISTS option_groups (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('swatch','select','checkbox')),
  required INTEGER NOT NULL DEFAULT 1,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS option_values (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES option_groups(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  price_delta NUMERIC(10,2) NOT NULL DEFAULT 0,
  hex TEXT,
  image_url TEXT,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS cart_items (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_key TEXT NOT NULL,
  value_ids TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  UNIQUE (user_id, variant_key)
);
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  buyer_id INTEGER NOT NULL REFERENCES users(id),
  seller_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New','Confirmed','Shipped','Delivered')),
  total NUMERIC(10,2) NOT NULL,
  ship_name TEXT, ship_address TEXT, ship_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER,
  title TEXT NOT NULL,
  image_url TEXT,
  options_json TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_products_seller ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_groups_product ON option_groups(product_id);
CREATE INDEX IF NOT EXISTS idx_values_group ON option_values(group_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id);
`;

const init = () => execMany(SCHEMA);
const reset = async () => { await execMany('DROP SCHEMA public CASCADE; CREATE SCHEMA public;'); await init(); };
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

module.exports = { db, tx, init, reset, round2, mode };
