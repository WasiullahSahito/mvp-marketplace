// AI features.
// 1) describeProduct: "describe my product photo" -> title + description (uses Claude vision when
//    ANTHROPIC_API_KEY is set, otherwise a rule-based fallback so the feature always works).
// 2) similarProducts: "recommend similar products" scored on category, price closeness and shared words.
const fs = require('fs');
const path = require('path');
const { db } = require('./db');
const { HttpError } = require('./products');

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';

async function describeProduct({ image_url, hint, category }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (key) {
    const content = [];
    if (image_url && image_url.startsWith('/uploads/')) {
      const file = path.join(__dirname, '..', 'uploads', path.basename(image_url));
      if (fs.existsSync(file)) {
        const ext = path.extname(file).slice(1).replace('jpg', 'jpeg');
        content.push({ type: 'image', source: { type: 'base64', media_type: `image/${ext}`, data: fs.readFileSync(file).toString('base64') } });
      }
    }
    content.push({ type: 'text', text: `You write product listings for a furniture marketplace. ${hint ? `Seller notes: ${hint}. ` : ''}${category ? `Category: ${category}. ` : ''}Return ONLY JSON: {"title": string (max 70 chars), "description": string (2-3 sentences, plain, no brand names)}.` });
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 400, messages: [{ role: 'user', content }] }),
    });
    if (!r.ok) throw new HttpError(502, 'AI service error – try again');
    const data = await r.json();
    const text = (data.content || []).map((c) => c.text || '').join('');
    const m = text.match(/\{[\s\S]*\}/);
    if (m) { try { const j = JSON.parse(m[0]); return { title: j.title, description: j.description, source: 'claude' }; } catch {} }
  }
  // Fallback (no key / no parse): build copy from the seller's hint
  const h = (hint || 'item').trim();
  const t = h.replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 70);
  return { title: t, description: `${t}${category ? ` in our ${category} range` : ''}. Well made, easy to look after, and available in a choice of options so you can get exactly the fit you want. Check the options above for sizes, colours and extras.`, source: 'template' };
}

const words = (s) => new Set(String(s).toLowerCase().match(/[a-z]{3,}/g) || []);
async function similarProducts(p, card) {
  const rows = await db.all(`SELECT p.*, u.shop_name, c.name AS category_name FROM products p JOIN users u ON u.id=p.seller_id
    LEFT JOIN categories c ON c.id=p.category_id WHERE p.id<>? AND p.status='active' AND u.status='approved'`, [p.id]);
  const tw = words(p.title + ' ' + p.description);
  const ranked = rows.map((r) => {
    let score = r.category_id === p.category_id ? 3 : 0;
    score += 2 / (1 + Math.abs(r.base_price - p.base_price) / Math.max(p.base_price, 1));
    const rw = words(r.title + ' ' + r.description);
    score += [...rw].filter((w) => tw.has(w)).length * 0.3;
    return { score, r };
  }).sort((a, b) => b.score - a.score).slice(0, 4);
  return Promise.all(ranked.map((x) => card(x.r)));
}
module.exports = { describeProduct, similarProducts };
