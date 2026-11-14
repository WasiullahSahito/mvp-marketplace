// Checks 6 option combinations against the live API (server must be running: npm start).
// Usage: node scripts/test-pricing.js [baseUrl]
const base = process.argv[2] || 'http://localhost:3000';
const cases = [
  [['Cream Naples', 'Small Single 2FT6', 'No Storage', 'FREE 26" Headboard', 'Standard Base (holds 50 stone)'], 359.99],
  [['Grey Naples', 'Single 3FT', '2 Drawers Left Side', 'FREE 26" Headboard', 'Standard Base (holds 50 stone)'], 414.99],
  [['Black Naples', 'Small Double 4FT', '2 Drawers Right Side', '54" Floor Standing Headboard', 'Standard Base (holds 50 stone)'], 424.99],
  [['Teal Naples', 'Double 4FT6', '2 Drawers Foot End', 'FREE 26" Headboard', 'Reinforced Base (holds 100 stone)'], 559.99],
  [['Steel Naples', 'King 5FT', '4 Drawers', '54" Floor Standing Headboard', 'Reinforced Base (holds 100 stone)', 'Add professional assembly'], 679.98],
  [['Pink Naples', 'Super King 6FT', 'No Storage', 'FREE 26" Headboard', 'Reinforced Base (holds 100 stone)', 'Add professional assembly'], 484.98],
];
(async () => {
  const [{ id }] = await (await fetch(base + '/api/products')).json();
  const p = await (await fetch(`${base}/api/products/${id}`)).json();
  const all = p.groups.flatMap((g) => g.values);
  let bad = 0;
  for (const [labels, want] of cases) {
    const ids = labels.map((l) => all.find((v) => v.label === l).id);
    const r = await (await fetch(`${base}/api/products/${id}/price`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ value_ids: ids }) })).json();
    const ok = r.unit_price === want; if (!ok) bad++;
    console.log(ok ? 'PASS' : 'FAIL', want, '->', r.unit_price, '|', r.title);
  }
  process.exit(bad ? 1 : 0);
})();
