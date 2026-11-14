// Seeds demo accounts, the category and the Prague Divan Bed. Safe to run repeatedly.
// `node server/seed.js --reset` wipes all tables first.
const { db, init, reset } = require('./db');
const { hashPassword } = require('./auth');
const { saveProduct } = require('./products');

async function user(email, name, password, role, shop, status = 'approved') {
  const ex = await db.get('SELECT id FROM users WHERE email=?', [email]);
  if (ex) return ex.id;
  const { salt, hash } = hashPassword(password);
  return db.insert('INSERT INTO users (email,name,password_hash,salt,role,shop_name,status) VALUES (?,?,?,?,?,?,?)', [email, name, hash, salt, role, shop, status]);
}

const PRAGUE = {
  title: 'Prague Divan Bed – Cream Naples',
  description: 'A classic upholstered divan bed with a deep-buttoned headboard, finished in soft Naples fabric. Choose your size, storage layout, headboard and base strength. (Demo listing – placeholder images.)',
  base_price: 269.99,
  compare_at_price: 539.98,
  images: [1, 2, 3, 4, 5].map((v) => `/api/placeholder?view=${v}`),
  groups: [
    { name: 'Colour', type: 'swatch', required: true, values: [
      ['Cream Naples', '#e9dfc7'], ['Grey Naples', '#9a9a9a'], ['Silver Naples', '#c7c9cc'], ['Black Naples', '#2b2b2d'],
      ['Steel Naples', '#5f6b7a'], ['Mink Naples', '#8c7b6b'], ['Teal Naples', '#2f7f86'], ['Pink Naples', '#d9a5b3'],
    ].map(([label, hex]) => ({ label, hex, price_delta: 0 })) },
    { name: 'Size', type: 'select', required: true, values: [
      ['Small Single 2FT6', 90], ['Single 3FT', 95], ['Small Double 4FT', 100], ['Double 4FT6', 110], ['King 5FT', 125], ['Super King 6FT', 150],
    ].map(([label, price_delta]) => ({ label, price_delta })) },
    { name: 'Storage', type: 'select', required: true, values: [
      ['No Storage', 0], ['2 Drawers Left Side', 50], ['2 Drawers Right Side', 45], ['2 Drawers Foot End', 155], ['4 Drawers', 210],
    ].map(([label, price_delta]) => ({ label, price_delta })) },
    { name: 'Headboard', type: 'select', required: true, values: [
      ['FREE 26" Headboard', 0], ['54" Floor Standing Headboard', 10],
    ].map(([label, price_delta]) => ({ label, price_delta })) },
    { name: 'Base', type: 'select', required: true, values: [
      ['Standard Base (holds 50 stone)', 0], ['Reinforced Base (holds 100 stone)', 25],
    ].map(([label, price_delta]) => ({ label, price_delta })) },
    { name: 'Professional Assembly', type: 'checkbox', required: false, values: [{ label: 'Add professional assembly', price_delta: 39.99 }] },
  ],
};

async function seed() {
  await user('admin@demo.test', 'Demo Admin', 'admin123', 'admin', null);
  const seller = await user('seller@demo.test', 'Demo Seller', 'seller123', 'seller', 'Demo Seller');
  await user('pending@demo.test', 'New Seller', 'seller123', 'seller', 'Pending Shop', 'pending');
  await user('buyer@demo.test', 'Demo Buyer', 'buyer123', 'buyer', null);

  let cat = await db.get("SELECT id FROM categories WHERE name='Furniture'");
  if (!cat) cat = { id: await db.insert("INSERT INTO categories (name) VALUES ('Furniture')") };
  let sub = await db.get("SELECT id FROM categories WHERE name='Divan Beds'");
  if (!sub) sub = { id: await db.insert("INSERT INTO categories (name,parent_id) VALUES ('Divan Beds',?)", [cat.id]) };

  if (!(await db.get('SELECT id FROM products WHERE title=?', [PRAGUE.title]))) {
    await saveProduct(seller, { ...PRAGUE, category_id: sub.id });
    console.log('Seeded Prague Divan Bed');
  }
}

module.exports = { seed };

if (require.main === module) {
  (async () => {
    if (process.argv.includes('--reset')) await reset(); else await init();
    await seed();
    console.log('Seed complete. Accounts: admin@demo.test/admin123, seller@demo.test/seller123, buyer@demo.test/buyer123');
    process.exit(0);
  })().catch((e) => { console.error(e); process.exit(1); });
}
