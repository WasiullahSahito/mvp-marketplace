// End-to-end API test: roles, cart lines, checkout, orders, status change, admin, product edit.
// Usage: node scripts/test-flow.js [baseUrl]   (server must be running)
const base = process.argv[2] || 'http://localhost:3000';
let fails = 0;
const check = (name, ok, extra = '') => { if (!ok) fails++; console.log(ok ? 'PASS' : 'FAIL', name, ok ? '' : extra); };
async function call(method, path, body, token) {
  const r = await fetch(base + '/api' + path, { method, headers: { 'content-type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}
const login = async (email, password) => (await call('POST', '/auth/login', { email, password })).data.token;

(async () => {
  const B = await login('buyer@demo.test', 'buyer123'), S = await login('seller@demo.test', 'seller123'), A = await login('admin@demo.test', 'admin123');
  check('logins', B && S && A);
  const list = (await call('GET', '/products')).data; const pid = list[0].id;
  const p = (await call('GET', '/products/' + pid)).data;
  const all = Object.fromEntries(p.groups.flatMap((g) => g.values.map((v) => [v.label, v.id])));
  const A1 = ['Cream Naples', 'Small Single 2FT6', 'No Storage', 'FREE 26" Headboard', 'Standard Base (holds 50 stone)'].map((l) => all[l]);
  const A2 = ['Grey Naples', 'King 5FT', '4 Drawers', '54" Floor Standing Headboard', 'Reinforced Base (holds 100 stone)', 'Add professional assembly'].map((l) => all[l]);
  check('prices are numbers', typeof p.base_price === 'number' && typeof p.groups[1].values[0].price_delta === 'number');

  check('guest cart blocked', (await call('GET', '/cart')).status === 401);
  check('buyer cannot use seller API', (await call('GET', '/seller/orders', null, B)).status === 403);
  check('buyer cannot use admin API', (await call('GET', '/admin/sellers', null, B)).status === 403);
  check('missing required option rejected', (await call('POST', '/cart', { product_id: pid, value_ids: [all['Cream Naples']] }, B)).status === 400);

  await call('POST', '/cart', { product_id: pid, value_ids: A1, qty: 1 }, B);
  await call('POST', '/cart', { product_id: pid, value_ids: A2, qty: 2 }, B);
  let cart = (await call('POST', '/cart', { product_id: pid, value_ids: A1, qty: 1 }, B)).data;
  check('two combos = two lines', cart.lines.length === 2, JSON.stringify(cart.lines.length));
  check('same combo merges qty', cart.lines.find((l) => l.unit_price === 359.99).qty === 2);
  check('cart shows all options', cart.lines.find((l) => l.unit_price === 679.98).options.length === 6);
  check('cart total', cart.total === 2 * 359.99 + 2 * 679.98, cart.total);

  const co = await call('POST', '/checkout', { name: 'Test Buyer', address: '1 Test St', phone: '07000' }, B);
  check('checkout', co.status === 200 && co.data.order_ids.length === 1, JSON.stringify(co.data));
  const oid = co.data.order_ids[0];
  check('cart emptied', (await call('GET', '/cart', null, B)).data.lines.length === 0);
  const sOrders = (await call('GET', '/seller/orders', null, S)).data;
  check('seller sees order as New', sOrders.find((o) => o.id === oid)?.status === 'New');
  check('seller sets Shipped', (await call('PATCH', '/seller/orders/' + oid, { status: 'Shipped' }, S)).status === 200);
  check('bad status rejected', (await call('PATCH', '/seller/orders/' + oid, { status: 'Nope' }, S)).status === 400);
  const bOrders = (await call('GET', '/orders', null, B)).data;
  check('buyer sees Shipped', bOrders.find((o) => o.id === oid)?.status === 'Shipped');
  check('order keeps option snapshot', bOrders[0].items[0].options.length >= 5);

  // seller signup -> pending -> hidden until admin approves
  const email = `t${Date.now()}@demo.test`;
  const su = await call('POST', '/auth/signup', { email, password: 'secret1', name: 'T', role: 'seller', shop_name: 'T Shop' });
  check('seller signup is pending', su.data.user?.status === 'pending');
  const np = await call('POST', '/seller/products', { title: 'Test Chair', base_price: 10, images: [], groups: [{ name: 'Size', type: 'select', values: [{ label: 'S', price_delta: 1 }] }] }, su.data.token);
  check('pending seller can create', np.status === 200, JSON.stringify(np.data));
  check('not public until approved', (await call('GET', '/products/' + np.data.id)).status === 404);
  const sellers = (await call('GET', '/admin/sellers', null, A)).data; const me = sellers.find((s) => s.email === email);
  await call('PATCH', '/admin/sellers/' + me.id, { status: 'approved' }, A);
  check('public after admin approves', (await call('GET', '/products/' + np.data.id)).status === 200);
  await call('PATCH', '/admin/products/' + np.data.id, { status: 'hidden' }, A);
  check('admin can hide listing', (await call('GET', '/products/' + np.data.id)).status === 404);

  // edit product keeps option ids, prices update
  const edit = await call('PUT', '/seller/products/' + pid, { ...p, base_price: 269.99, groups: p.groups.map((g) => ({ ...g, values: g.values.map((v) => ({ ...v })) })) }, S);
  check('seller edits product', edit.status === 200, JSON.stringify(edit.data));
  check('other seller cannot edit', (await call('PUT', '/seller/products/' + pid, p, su.data.token)).status === 404);
  const f = (await call('GET', '/products?colour=Teal&size=King&minPrice=100&maxPrice=300&category=' + p.category_id)).data;
  check('filters work', f.length === 1);
  check('search works', (await call('GET', '/products?q=prague')).data.length === 1 && (await call('GET', '/products?q=zzz')).data.length === 0);
  const sim = (await call('GET', '/products/' + pid)).data.similar;
  check('similar products endpoint', Array.isArray(sim));
  console.log(fails ? `\n${fails} FAILED` : '\nAll flow checks passed');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
