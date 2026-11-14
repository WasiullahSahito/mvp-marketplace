// Mini Marketplace front end (web + installable PWA). Plain JS, no build step.
// All data comes from the same REST API the whole system uses.
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const view = $('#view');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => '£' + Number(n).toFixed(2);
const signed = (n) => (n > 0 ? ' +' + money(n) : '');

// ---------- state & API ----------
let token = localStorage.getItem('mm_token') || '';
let me = null;
let cartCount = 0;

async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (token) headers.Authorization = 'Bearer ' + token;
  let body = opts.body;
  if (body && typeof body === 'object' && !(body instanceof Blob)) { body = JSON.stringify(body); headers['Content-Type'] = 'application/json'; }
  const r = await fetch('/api' + path, { method: opts.method || 'GET', headers, body });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(data.error || 'Request failed'); e.status = r.status; throw e; }
  return data;
}
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2400); }
function setSession(t, u) { token = t || ''; me = u || null; t ? localStorage.setItem('mm_token', t) : localStorage.removeItem('mm_token'); }
async function loadMe() {
  if (!token) { me = null; return; }
  try { me = (await api('/me')).user; } catch { me = null; }
  if (!me) setSession('', null);
}
async function refreshCartCount() {
  if (!me) { cartCount = 0; return; }
  try { cartCount = (await api('/cart')).count; } catch { cartCount = 0; }
}
function needLogin(next) { sessionStorage.setItem('mm_next', next || location.hash); location.hash = '#/login'; }

// ---------- chrome (header links + bottom tab bar) ----------
function renderChrome() {
  const role = me?.role;
  const links = [['#/', 'Shop'], ['#/cart', `Basket${cartCount ? ' (' + cartCount + ')' : ''}`]];
  if (me) links.push(['#/orders', 'My orders']);
  if (role === 'seller') links.push(['#/seller', 'Seller']);
  if (role === 'admin') links.push(['#/admin', 'Admin']);
  $('#nav').innerHTML = links.map(([h, t]) => `<a href="${h}">${t}</a>`).join('') +
    (me ? `<button id="logoutBtn">Log out (${esc(me.name.split(' ')[0])})</button>` : '<a href="#/login">Log in</a>');
  const tabs = [['#/', '🏠', 'Shop'], ['#/cart', '🛒', 'Basket'], ['#/orders', '📦', 'Orders']];
  if (role === 'seller') tabs.push(['#/seller', '🏪', 'Seller']);
  else if (role === 'admin') tabs.push(['#/admin', '🛡️', 'Admin']);
  tabs.push([me ? '#/account' : '#/login', '👤', me ? 'Account' : 'Log in']);
  const cur = location.hash || '#/';
  $('#tabbar').innerHTML = tabs.map(([h, i, t]) =>
    `<a href="${h}" class="${cur === h || (h !== '#/' && cur.startsWith(h)) ? 'on' : ''}"><span>${i}</span>${t}${h === '#/cart' && cartCount ? `<i class="badge">${cartCount}</i>` : ''}</a>`).join('');
  const lo = $('#logoutBtn'); if (lo) lo.onclick = logout;
}
function logout() { setSession('', null); cartCount = 0; toast('Logged out'); location.hash = '#/'; route(); }

$('#topSearch').onsubmit = (e) => { e.preventDefault(); location.hash = '#/?q=' + encodeURIComponent($('#q').value.trim()); };

// ---------- router ----------
const routes = [];
const on = (re, fn) => routes.push([re, fn]);
async function route() {
  const hash = location.hash || '#/';
  const [path, qs] = hash.slice(1).split('?');
  const params = Object.fromEntries(new URLSearchParams(qs || ''));
  for (const [re, fn] of routes) {
    const m = path.match(re);
    if (m) {
      try { await fn(m, params); } catch (e) {
        if (e.status === 401) return needLogin(hash);
        view.innerHTML = `<div class="card err">${esc(e.message)}</div>`;
      }
      break;
    }
  }
  window.scrollTo(0, 0);
  await refreshCartCount(); renderChrome();
}
window.addEventListener('hashchange', route);

const guard = (...roles) => { if (!me) { needLogin(); return false; } if (!roles.includes(me.role)) { view.innerHTML = '<div class="card err">You do not have access to this page.</div>'; return false; } return true; };

// ---------- helpers ----------
function priceHtml(p) {
  return `<span class="price">${money(p.base_price)}</span>${p.compare_at_price ? `<span class="was">${money(p.compare_at_price)}</span>` : ''}`;
}
function cardHtml(p) {
  return `<a class="pcard" href="#/p/${p.id}">${p.discount_percent ? `<span class="off">${p.discount_percent}% OFF</span>` : ''}
    <img src="${esc(p.image || '')}" alt="${esc(p.title)}" loading="lazy">
    <div class="b"><h3>${esc(p.title)}</h3><div class="small muted">from</div>${priceHtml(p)}
    <div class="dots">${p.colours.map((c) => `<i title="${esc(c.label)}" style="background:${esc(c.hex)}"></i>`).join('')}</div>
    <div class="small muted" style="margin-top:4px">${esc(p.shop_name || '')}</div></div></a>`;
}
const statusPill = (s) => `<span class="pill ${esc(s)}">${esc(s)}</span>`;
const withTint = (url, hex) => (url && url.startsWith('/api/placeholder') && hex ? `${url}&hex=${encodeURIComponent(hex)}` : url);

// ============ SHOP: browse / search / filters ============
on(/^\/?$/, async (_m, params) => {
  const f = await api('/facets');
  $('#q').value = params.q || '';
  const sel = (name, list, cur, map = (x) => x) => `<label class="f">${name}</label><select data-f="${name.toLowerCase()}"><option value="">All</option>${list.map((x) => `<option value="${esc(map(x).v)}" ${String(cur) === String(map(x).v) ? 'selected' : ''}>${esc(map(x).t)}</option>`).join('')}</select>`;
  view.innerHTML = `<div class="layout">
    <details class="filters card" ${window.innerWidth >= 800 ? 'open' : ''}><summary>Filters</summary>
      <div class="row"><div><label class="f">Min £</label><input type="number" min="0" id="fmin" value="${esc(params.minPrice || '')}"></div>
      <div><label class="f">Max £</label><input type="number" min="0" id="fmax" value="${esc(params.maxPrice || '')}"></div></div>
      ${sel('Category', f.categories, params.category, (c) => ({ v: c.id, t: (c.parent_id ? '— ' : '') + c.name }))}
      ${sel('Colour', f.colours, params.colour, (c) => ({ v: c.label, t: c.label }))}
      ${sel('Size', f.sizes, params.size, (c) => ({ v: c.label, t: c.label }))}
      ${sel('Sort', [{ v: 'price_asc', t: 'Price: low to high' }, { v: 'price_desc', t: 'Price: high to low' }], params.sort, (x) => x)}
      <button class="btn block" style="margin-top:12px" id="applyF">Apply</button>
      <a class="btn alt block" style="margin-top:8px" href="#/">Clear</a></details>
    <section><h1>${params.q ? `Results for “${esc(params.q)}”` : 'All products'}</h1><div id="results" class="muted">Loading…</div></section></div>`;
  $('#applyF').onclick = () => {
    const p = new URLSearchParams();
    if ($('#q').value.trim()) p.set('q', $('#q').value.trim());
    if ($('#fmin').value) p.set('minPrice', $('#fmin').value);
    if ($('#fmax').value) p.set('maxPrice', $('#fmax').value);
    view.querySelectorAll('select[data-f]').forEach((s) => s.value && p.set(s.dataset.f, s.value));
    location.hash = '#/?' + p.toString();
  };
  const list = await api('/products?' + new URLSearchParams(params).toString());
  $('#results').className = '';
  $('#results').innerHTML = list.length ? `<div class="grid">${list.map(cardHtml).join('')}</div>` : '<div class="card">No products match your search.</div>';
});

// ============ PRODUCT PAGE ============
on(/^\/p\/(\d+)$/, async (m) => {
  const p = await api('/products/' + m[1]);
  const sel = {};     // groupId -> valueId (checkbox: value id or undefined)
  p.groups.forEach((g) => { if (g.required && g.type !== 'checkbox') sel[g.id] = g.values[0].id; });
  let imgIdx = 0;
  const baseName = p.title.split(' – ')[0];
  const colourGroup = p.groups.find((g) => g.type === 'swatch');
  const colourVal = () => colourGroup && colourGroup.values.find((v) => v.id === sel[colourGroup.id]);
  const chosen = () => p.groups.flatMap((g) => g.values.filter((v) => sel[g.id] === v.id).map((v) => ({ g, v })));
  const price = () => Math.round((p.base_price + chosen().reduce((a, { v }) => a + v.price_delta, 0)) * 100) / 100;
  // If the colour has its own photo, show it first; otherwise tint the placeholder gallery with the colour
  const images = () => { const c = colourVal(); const list = p.images.map((u) => withTint(u, c && c.hex)); if (c && c.image_url) list.unshift(c.image_url); return list; };

  view.innerHTML = `<div class="pp"><div class="gal" id="gal"></div><div id="info"></div></div>
    <div id="similar"></div>
    <div class="sticky"><div><div class="small muted">Your price</div><div class="price" id="stickyPrice"></div></div><button class="btn accent" id="addBtn">Add to Basket</button></div>
    <div style="height:70px"></div>`;

  function renderGallery() {
    const imgs = images(); if (imgIdx >= imgs.length) imgIdx = 0;
    $('#gal').innerHTML = `${p.discount_percent ? `<span class="off">${p.discount_percent}% OFF</span>` : ''}
      <div class="main-img" id="mainImg"><img src="${esc(imgs[imgIdx])}" alt="${esc(titleNow())}"></div>
      <div class="gdots">${imgs.map((_, i) => `<i class="${i === imgIdx ? 'on' : ''}"></i>`).join('')}</div>
      <div class="thumbs">${imgs.map((u, i) => `<button class="${i === imgIdx ? 'on' : ''}" data-i="${i}" aria-label="Image ${i + 1}"><img src="${esc(u)}" alt=""></button>`).join('')}</div>`;
    $('#gal').querySelectorAll('.thumbs button').forEach((b) => b.onclick = () => { imgIdx = +b.dataset.i; renderGallery(); });
    const mi = $('#mainImg');
    mi.onclick = () => openLightbox(imgs, imgIdx);
    let x0 = null;                                                   // swipe on phone
    mi.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    mi.addEventListener('touchend', (e) => {
      if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 40) { imgIdx = (imgIdx + (dx < 0 ? 1 : -1) + imgs.length) % imgs.length; renderGallery(); mi.dataset.swiped = 1; }
    }, { passive: true });
  }
  const titleNow = () => { const c = colourVal(); return c ? `${baseName} – ${c.label}` : p.title; };

  function renderInfo() {
    const c = colourVal();
    $('#info').innerHTML = `<h1 id="ptitle">${esc(titleNow())}</h1>
      <div class="small muted">Sold by ${esc(p.shop_name)} · ${esc(p.category_name || '')}</div>
      <div style="margin:10px 0"><span class="bigprice" id="bigPrice">${money(price())}</span>
        ${p.compare_at_price ? `<span class="was">${money(p.compare_at_price)}</span> <span class="pill" style="background:#fee2e2;color:var(--red)">${p.discount_percent}% OFF</span>` : ''}</div>
      <div class="small muted">Base price ${money(p.base_price)} + selected options</div>
      ${p.groups.map((g) => groupHtml(g, c)).join('')}
      <h2>Description</h2><p>${esc(p.description)}</p>`;
    $('#info').querySelectorAll('[data-g]').forEach((b) => b.onclick = () => {
      const gid = +b.dataset.g, vid = +b.dataset.v, g = p.groups.find((x) => x.id === gid);
      if (g.type === 'checkbox') sel[gid] = b.checked ? vid : undefined;
      else sel[gid] = vid;
      update(g.type === 'swatch');
    });
    $('#stickyPrice').textContent = money(price());
  }
  function groupHtml(g, c) {
    if (g.type === 'swatch') return `<div class="optgroup"><b>${esc(g.name)}: <span id="colourName" style="font-weight:400">${esc(c ? c.label : 'Choose')}</span></b>
      <div class="swatches" role="radiogroup">${g.values.map((v) => `<button type="button" class="sw ${sel[g.id] === v.id ? 'on' : ''}" role="radio" aria-checked="${sel[g.id] === v.id}" aria-label="${esc(v.label)}" title="${esc(v.label)}" data-g="${g.id}" data-v="${v.id}" style="background:${esc(v.hex || '#ccc')}"></button>`).join('')}</div></div>`;
    if (g.type === 'checkbox') return `<div class="optgroup"><label class="addon"><input type="checkbox" data-g="${g.id}" data-v="${g.values[0].id}" ${sel[g.id] ? 'checked' : ''}> <span><b style="display:inline">${esc(g.name)}</b> <span class="muted">(optional)</span><br>${esc(g.values[0].label)} <b>${signed(g.values[0].price_delta)}</b></span></label></div>`;
    return `<div class="optgroup"><b>${esc(g.name)}</b><div class="choices">${g.values.map((v) => `<button type="button" class="ch ${sel[g.id] === v.id ? 'on' : ''}" data-g="${g.id}" data-v="${v.id}">${esc(v.label)}${v.price_delta ? `<small>${signed(v.price_delta)}</small>` : ''}</button>`).join('')}</div></div>`;
  }
  function update(colourChanged) {
    renderInfo();
    if (colourChanged) { imgIdx = 0; renderGallery(); }
    document.title = titleNow();
  }
  renderGallery(); renderInfo();

  $('#addBtn').onclick = async () => {
    if (!me) return needLogin('#/p/' + p.id);
    const ids = chosen().map(({ v }) => v.id);
    try { const c = await api('/cart', { method: 'POST', body: { product_id: p.id, value_ids: ids, qty: 1 } }); cartCount = c.count; renderChrome(); toast('Added to basket – ' + money(price())); }
    catch (e) { toast(e.message); }
  };
  if (p.similar && p.similar.length) $('#similar').innerHTML = `<h2>You might also like <span class="pill">AI picks</span></h2><div class="grid">${p.similar.map(cardHtml).join('')}</div>`;
});

// lightbox (click to enlarge, swipe, arrows)
let lbList = [], lbI = 0;
function openLightbox(list, i) { lbList = list; lbI = i; $('#lightbox').hidden = false; showLb(); }
function showLb() { $('#lightbox img').src = lbList[lbI]; }
function lbStep(d) { lbI = (lbI + d + lbList.length) % lbList.length; showLb(); }
$('#lbClose').onclick = () => { $('#lightbox').hidden = true; };
$('#lightbox .prev').onclick = (e) => { e.stopPropagation(); lbStep(-1); };
$('#lightbox .next').onclick = (e) => { e.stopPropagation(); lbStep(1); };
$('#lightbox').onclick = (e) => { if (e.target.id === 'lightbox') $('#lightbox').hidden = true; };
document.addEventListener('keydown', (e) => { if ($('#lightbox').hidden) return; if (e.key === 'Escape') $('#lightbox').hidden = true; if (e.key === 'ArrowLeft') lbStep(-1); if (e.key === 'ArrowRight') lbStep(1); });
let lbx = null;
$('#lightbox').addEventListener('touchstart', (e) => { lbx = e.touches[0].clientX; }, { passive: true });
$('#lightbox').addEventListener('touchend', (e) => { if (lbx === null) return; const dx = e.changedTouches[0].clientX - lbx; lbx = null; if (Math.abs(dx) > 40) lbStep(dx < 0 ? 1 : -1); }, { passive: true });

// ============ CART ============
const optList = (opts) => `<ul>${opts.map((o) => `<li><b>${esc(o.group)}:</b> ${esc(o.label)}${signed(o.price_delta)}</li>`).join('')}</ul>`;
on(/^\/cart$/, async () => {
  if (!guard('buyer', 'seller', 'admin')) return;
  const c = await api('/cart');
  if (!c.lines.length) { view.innerHTML = '<h1>Your basket</h1><div class="card">Your basket is empty. <a href="#/">Keep shopping</a></div>'; return; }
  view.innerHTML = `<h1>Your basket</h1>${c.lines.map((l) => `<div class="card line">
    <img src="${esc(l.image || '')}" alt=""><div style="flex:1;min-width:0"><b>${esc(l.title)}</b>${optList(l.options)}
    <div class="row" style="justify-content:space-between"><div class="qty"><button data-q="${l.id}" data-n="${l.qty - 1}" ${l.qty <= 1 ? 'disabled' : ''} aria-label="Less">−</button><span>${l.qty}</span><button data-q="${l.id}" data-n="${l.qty + 1}" aria-label="More">+</button></div>
    <div style="text-align:right"><div class="small muted">${money(l.unit_price)} each</div><b>${money(l.line_total)}</b></div></div>
    <button class="btn danger sm" data-rm="${l.id}" style="margin-top:6px">Remove</button></div></div>`).join('')}
    <div class="card row" style="justify-content:space-between"><span class="bigprice">Total ${money(c.total)}</span><a class="btn accent" href="#/checkout">Checkout</a></div>`;
  view.querySelectorAll('[data-q]').forEach((b) => b.onclick = async () => { await api('/cart/' + b.dataset.q, { method: 'PATCH', body: { qty: +b.dataset.n } }); route(); });
  view.querySelectorAll('[data-rm]').forEach((b) => b.onclick = async () => { await api('/cart/' + b.dataset.rm, { method: 'DELETE' }); route(); });
});

// ============ CHECKOUT (fake payment) ============
on(/^\/checkout$/, async () => {
  if (!guard('buyer', 'seller', 'admin')) return;
  const c = await api('/cart');
  if (!c.lines.length) { location.hash = '#/cart'; return; }
  view.innerHTML = `<h1>Checkout</h1><div class="hint">Demo only – no real payment is taken.</div>
    <form class="card" id="co"><label class="f">Full name</label><input type="text" name="name" required value="${esc(me.name)}" autocomplete="name">
    <label class="f">Delivery address</label><textarea name="address" required autocomplete="street-address"></textarea>
    <label class="f">Phone</label><input type="text" name="phone" inputmode="tel" autocomplete="tel">
    <label class="f">Card (fake)</label><input type="text" value="4242 4242 4242 4242" inputmode="numeric" aria-label="Fake card number">
    <h2>Order summary</h2>${c.lines.map((l) => `<div class="row small" style="justify-content:space-between"><span>${l.qty} × ${esc(l.title)}</span><b>${money(l.line_total)}</b></div>`).join('')}
    <div class="bigprice" style="margin:10px 0">Total ${money(c.total)}</div><div class="err" id="coErr"></div>
    <button class="btn accent block" id="payBtn">Place order</button></form>`;
  $('#co').onsubmit = async (e) => {
    e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target)); $('#payBtn').disabled = true;
    try { const r = await api('/checkout', { method: 'POST', body: fd }); cartCount = 0; toast('Order placed!'); location.hash = '#/orders?new=' + r.order_ids.join(','); }
    catch (er) { $('#coErr').textContent = er.message; $('#payBtn').disabled = false; }
  };
});

// ============ BUYER ORDERS ============
function orderCard(o, forSeller) {
  return `<div class="card"><div class="row" style="justify-content:space-between"><b>Order #${o.id}</b>${forSeller ? '' : statusPill(o.status)}</div>
    <div class="small muted">${esc(o.created_at)} UTC · ${forSeller ? 'Buyer: ' + esc(o.buyer_name) : 'Seller: ' + esc(o.shop_name)}</div>
    ${o.items.map((i) => `<div class="line" style="margin:8px 0"><img src="${esc(i.image_url || '')}" alt=""><div><b>${esc(i.title)}</b> × ${i.qty}${optList(i.options)}<b>${money(i.unit_price * i.qty)}</b></div></div>`).join('')}
    <div class="row" style="justify-content:space-between"><b>Total ${money(o.total)}</b></div>
    ${forSeller ? `<div class="small muted">Ship to: ${esc(o.ship_name)}, ${esc(o.ship_address)} ${esc(o.ship_phone || '')}</div>
      <label class="f">Status</label><select data-status="${o.id}">${['New', 'Confirmed', 'Shipped', 'Delivered'].map((s) => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}</select>` : ''}</div>`;
}
on(/^\/orders$/, async (_m, params) => {
  if (!guard('buyer', 'seller', 'admin')) return;
  const orders = await api('/orders');
  view.innerHTML = `<h1>My orders</h1>${params.new ? '<div class="banner">🎉 Thank you! Your order has been placed.</div>' : ''}${orders.length ? orders.map((o) => orderCard(o, false)).join('') : '<div class="card">No orders yet.</div>'}`;
});

// ============ AUTH ============
on(/^\/login$/, async (_m, params) => {
  let mode = params.mode === 'signup' ? 'signup' : 'login';
  const draw = (err = '') => {
    view.innerHTML = `<div class="card" style="max-width:440px;margin:20px auto"><h1>${mode === 'login' ? 'Log in' : 'Create account'}</h1>
      <form id="af"><label class="f">Email</label><input type="email" name="email" required autocomplete="email">
      ${mode === 'signup' ? `<label class="f">Your name</label><input type="text" name="name" required>
        <label class="f">I want to</label><select name="role" id="roleSel"><option value="buyer">Buy things</option><option value="seller">Sell things</option></select>
        <div id="shopRow" hidden><label class="f">Shop name</label><input type="text" name="shop_name"><p class="small muted">New sellers must be approved by an admin before their listings go live.</p></div>` : ''}
      <label class="f">Password</label><input type="password" name="password" required minlength="6" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}">
      <div class="err">${esc(err)}</div><button class="btn block">${mode === 'login' ? 'Log in' : 'Sign up'}</button></form>
      <p><a href="#" id="swap">${mode === 'login' ? 'New here? Create an account' : 'Have an account? Log in'}</a></p>
      <div class="hint small"><b>Demo logins</b><br>Buyer: buyer@demo.test / buyer123<br>Seller: seller@demo.test / seller123<br>Admin: admin@demo.test / admin123</div></div>`;
    $('#swap').onclick = (e) => { e.preventDefault(); mode = mode === 'login' ? 'signup' : 'login'; draw(); };
    const rs = $('#roleSel'); if (rs) rs.onchange = () => { $('#shopRow').hidden = rs.value !== 'seller'; };
    $('#af').onsubmit = async (e) => {
      e.preventDefault();
      try {
        const r = await api('/auth/' + mode, { method: 'POST', body: Object.fromEntries(new FormData(e.target)) });
        setSession(r.token, r.user); await refreshCartCount();
        const next = sessionStorage.getItem('mm_next'); sessionStorage.removeItem('mm_next');
        location.hash = next && next !== '#/login' ? next : (r.user.role === 'seller' ? '#/seller' : r.user.role === 'admin' ? '#/admin' : '#/');
        renderChrome();
      } catch (er) { draw(er.message); }
    };
  };
  draw();
});
on(/^\/account$/, async () => {
  if (!guard('buyer', 'seller', 'admin')) return;
  view.innerHTML = `<div class="card"><h1>${esc(me.name)}</h1><p class="muted">${esc(me.email)} · ${esc(me.role)}${me.shop_name ? ' · ' + esc(me.shop_name) : ''}</p>
    <button class="btn block" id="lo2">Log out</button></div>
    <div class="card"><b>Install as an app</b><p class="small muted">Android (Chrome): menu ⋮ → “Install app” / “Add to Home screen”.<br>iPhone (Safari): Share → “Add to Home Screen”.</p></div>`;
  $('#lo2').onclick = logout;
});

// ============ SELLER ============
on(/^\/seller$/, async () => {
  if (!guard('seller')) return;
  const [products, orders] = await Promise.all([api('/seller/products'), api('/seller/orders')]);
  view.innerHTML = `<h1>${esc(me.shop_name)} <span class="pill ${esc(me.status)}">${esc(me.status)}</span></h1>
    ${me.status !== 'approved' ? '<div class="banner">Your shop is waiting for admin approval. You can add products now; they go live once you are approved.</div>' : ''}
    <div class="row"><a class="btn" href="#/seller/product/new">+ Add product</a><a class="btn alt" href="#/seller/orders">Incoming orders (${orders.filter((o) => o.status === 'New').length} new)</a></div>
    <h2>Your products</h2>${products.length ? products.map((p) => `<div class="card line"><img src="${esc(p.images[0] || '')}" alt=""><div style="flex:1"><b>${esc(p.title)}</b> <span class="pill ${p.status}">${p.status}</span><div class="muted small">${money(p.base_price)} · ${p.groups.length} option groups</div>
      <div class="row" style="margin-top:6px"><a class="btn sm alt" href="#/seller/product/${p.id}">Edit</a><a class="btn sm alt" href="#/p/${p.id}">View</a>
      <button class="btn sm alt" data-toggle="${p.id}" data-s="${p.status === 'active' ? 'hidden' : 'active'}">${p.status === 'active' ? 'Hide' : 'Show'}</button></div></div></div>`).join('') : '<div class="card">No products yet.</div>'}`;
  view.querySelectorAll('[data-toggle]').forEach((b) => b.onclick = async () => { await api('/seller/products/' + b.dataset.toggle, { method: 'PATCH', body: { status: b.dataset.s } }); route(); });
});
on(/^\/seller\/orders$/, async () => {
  if (!guard('seller')) return;
  const orders = await api('/seller/orders');
  view.innerHTML = `<h1>Incoming orders</h1>${orders.length ? orders.map((o) => orderCard(o, true)).join('') : '<div class="card">No orders yet.</div>'}`;
  view.querySelectorAll('[data-status]').forEach((s) => s.onchange = async () => {
    try { await api('/seller/orders/' + s.dataset.status, { method: 'PATCH', body: { status: s.value } }); toast('Order #' + s.dataset.status + ' → ' + s.value); } catch (e) { toast(e.message); }
  });
});

// Example used by the "Fill with Prague bed example" button in the seller form (editable by the seller)
const PRAGUE_EXAMPLE = {
  title: 'Prague Divan Bed – Cream Naples', category_name: 'Divan Beds', base_price: 269.99, compare_at_price: 539.98,
  description: 'A classic upholstered divan bed with a deep-buttoned headboard, finished in soft Naples fabric.',
  images: [1, 2, 3, 4, 5].map((v) => `/api/placeholder?view=${v}`),
  groups: [
    { name: 'Colour', type: 'swatch', required: true, values: [['Cream Naples', '#e9dfc7'], ['Grey Naples', '#9a9a9a'], ['Silver Naples', '#c7c9cc'], ['Black Naples', '#2b2b2d'], ['Steel Naples', '#5f6b7a'], ['Mink Naples', '#8c7b6b'], ['Teal Naples', '#2f7f86'], ['Pink Naples', '#d9a5b3']].map(([label, hex]) => ({ label, hex, price_delta: 0 })) },
    { name: 'Size', type: 'select', required: true, values: [['Small Single 2FT6', 90], ['Single 3FT', 95], ['Small Double 4FT', 100], ['Double 4FT6', 110], ['King 5FT', 125], ['Super King 6FT', 150]].map(([label, price_delta]) => ({ label, price_delta })) },
    { name: 'Storage', type: 'select', required: true, values: [['No Storage', 0], ['2 Drawers Left Side', 50], ['2 Drawers Right Side', 45], ['2 Drawers Foot End', 155], ['4 Drawers', 210]].map(([label, price_delta]) => ({ label, price_delta })) },
    { name: 'Headboard', type: 'select', required: true, values: [['FREE 26" Headboard', 0], ['54" Floor Standing Headboard', 10]].map(([label, price_delta]) => ({ label, price_delta })) },
    { name: 'Base', type: 'select', required: true, values: [['Standard Base (holds 50 stone)', 0], ['Reinforced Base (holds 100 stone)', 25]].map(([label, price_delta]) => ({ label, price_delta })) },
    { name: 'Professional Assembly', type: 'checkbox', required: false, values: [{ label: 'Add professional assembly', price_delta: 39.99 }] },
  ],
};

on(/^\/seller\/product\/(new|\d+)$/, async (m) => {
  if (!guard('seller')) return;
  const cats = await api('/categories');
  let prod;
  if (m[1] === 'new') prod = { title: '', description: '', base_price: '', compare_at_price: '', category_id: '', images: [], groups: [] };
  else prod = (await api('/seller/products')).find((p) => p.id === +m[1]);
  if (!prod) throw new Error('Product not found');
  const isNew = m[1] === 'new';

  const draw = () => {
    view.innerHTML = `<h1>${isNew ? 'Add product' : 'Edit product'}</h1>
    <form id="pf"><div class="card">
      ${isNew ? '<button type="button" class="btn alt sm" id="fillEx">Fill with Prague bed example</button>' : ''}
      <label class="f">Title</label><input type="text" id="pTitle" required value="${esc(prod.title)}">
      <label class="f">Category</label><select id="pCat">${[...cats.filter((c) => !c.parent_id), ...cats.filter((c) => c.parent_id)].map((c) => `<option value="${c.id}" ${c.id == prod.category_id ? 'selected' : ''}>${c.parent_id ? '— ' : ''}${esc(c.name)}</option>`).join('')}</select>
      <div class="row"><div><label class="f">Base price (£)</label><input type="number" step="0.01" min="0.01" id="pBase" required value="${esc(prod.base_price)}"></div>
      <div><label class="f">Compare-at price (£) <span class="muted small">crossed out</span></label><input type="number" step="0.01" id="pCmp" value="${esc(prod.compare_at_price ?? '')}"></div></div>
      <label class="f">Description</label><textarea id="pDesc">${esc(prod.description)}</textarea>
      <div class="hint" style="margin-top:8px"><b>✨ AI helper</b> – describe the first photo and auto-fill title and description.
        <div class="row" style="margin-top:6px"><input type="text" id="aiHint" placeholder="Optional hint, e.g. 'cream divan bed with drawers'"><button type="button" class="btn sm" id="aiBtn">Describe my product photo</button></div></div>
    </div>
    <div class="card"><b>Photos</b> <span class="muted small">(at least 5 recommended; first one is the main image)</span>
      <div class="thumbs" id="imgList">${prod.images.map((u, i) => `<div style="flex:0 0 84px"><img src="${esc(u)}" style="width:84px;height:64px;object-fit:cover;border-radius:6px" alt=""><button type="button" class="btn danger sm" style="width:84px;padding:0" data-rmimg="${i}">Remove</button></div>`).join('')}</div>
      <label class="btn alt sm" style="margin-top:8px">Upload photo<input type="file" id="upFile" accept="image/png,image/jpeg,image/webp" hidden></label>
      <div class="row" style="margin-top:6px"><input type="text" id="imgUrl" placeholder="…or paste an image URL"><button type="button" class="btn alt sm" id="addUrl" style="flex:0 0 auto">Add</button></div></div>
    <div class="card"><b>Variations / options</b><p class="small muted">Buyers see exactly what you enter here. “Price + (£)” is added to the base price.</p><div id="groups"></div>
      <button type="button" class="btn alt sm" id="addGroup">+ Add option group</button></div>
    <div class="err" id="pErr"></div><button class="btn accent block" id="saveBtn">Save product</button></form>`;
    drawGroups();
    const fill = $('#fillEx'); if (fill) fill.onclick = () => { collect(); const ex = { ...PRAGUE_EXAMPLE, category_id: (cats.find((c) => c.name === PRAGUE_EXAMPLE.category_name) || {}).id || '' }; prod = JSON.parse(JSON.stringify(ex)); draw(); };
    $('#addGroup').onclick = () => { collect(); prod.groups.push({ name: '', type: 'select', required: true, values: [{ label: '', price_delta: 0 }] }); draw(); };
    view.querySelectorAll('[data-rmimg]').forEach((b) => b.onclick = () => { collect(); prod.images.splice(+b.dataset.rmimg, 1); draw(); });
    $('#addUrl').onclick = () => { collect(); const u = $('#imgUrl').value.trim(); if (u) { prod.images.push(u); draw(); } };
    $('#upFile').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return; collect();
      try { const r = await api('/seller/upload', { method: 'POST', body: f, headers: { 'Content-Type': f.type } }); prod.images.push(r.url); draw(); } catch (er) { toast(er.message); }
    };
    $('#aiBtn').onclick = async () => {
      collect(); $('#aiBtn').disabled = true; $('#aiBtn').textContent = 'Thinking…';
      try {
        const cat = cats.find((c) => c.id == prod.category_id);
        const r = await api('/ai/describe', { method: 'POST', body: { image_url: prod.images.find((u) => u.startsWith('/uploads/')), hint: $('#aiHint').value || prod.title, category: cat && cat.name } });
        prod.title = r.title || prod.title; prod.description = r.description || prod.description; draw(); toast('AI filled in title & description (' + r.source + ')');
      } catch (er) { toast(er.message); $('#aiBtn').disabled = false; $('#aiBtn').textContent = 'Describe my product photo'; }
    };
    $('#pf').onsubmit = save;
  };
  function drawGroups() {
    $('#groups').innerHTML = prod.groups.map((g, gi) => `<div class="optedit" data-gi="${gi}">
      <div class="row"><input type="text" class="gname" placeholder="Group name (e.g. Size)" value="${esc(g.name)}">
      <select class="gtype" style="max-width:190px"><option value="swatch" ${g.type === 'swatch' ? 'selected' : ''}>Colour swatches</option><option value="select" ${g.type === 'select' ? 'selected' : ''}>Choice buttons</option><option value="checkbox" ${g.type === 'checkbox' ? 'selected' : ''}>Optional add-on (tick box)</option></select>
      <label class="small" style="flex:0 0 auto"><input type="checkbox" class="greq" ${g.required ? 'checked' : ''} ${g.type === 'checkbox' ? 'disabled' : ''}> required</label>
      <button type="button" class="btn danger sm" data-rmg="${gi}" style="flex:0 0 auto">Delete group</button></div>
      ${g.values.map((v, vi) => `<div class="vrow" data-vi="${vi}"><input type="text" class="vlabel" placeholder="Label" value="${esc(v.label)}"><input type="number" step="0.01" class="vprice" placeholder="Price +" value="${esc(v.price_delta)}">
        ${g.type === 'swatch' ? `<input type="color" class="vhex" value="${esc(v.hex || '#cccccc')}">` : '<span></span>'}<button type="button" class="btn danger sm" style="padding:0" data-rmv="${gi}.${vi}" aria-label="Remove value">✕</button></div>`).join('')}
      <button type="button" class="btn alt sm" data-addv="${gi}">+ Add value</button></div>`).join('');
    const reflow = (fn) => (e) => { collect(); fn(e.currentTarget); draw(); };
    view.querySelectorAll('[data-rmg]').forEach((b) => b.onclick = reflow((el) => prod.groups.splice(+el.dataset.rmg, 1)));
    view.querySelectorAll('[data-addv]').forEach((b) => b.onclick = reflow((el) => prod.groups[+el.dataset.addv].values.push({ label: '', price_delta: 0, hex: prod.groups[+el.dataset.addv].type === 'swatch' ? '#cccccc' : null })));
    view.querySelectorAll('[data-rmv]').forEach((b) => b.onclick = reflow((el) => { const [g, v] = el.dataset.rmv.split('.').map(Number); prod.groups[g].values.splice(v, 1); }));
    view.querySelectorAll('.gtype').forEach((s) => s.onchange = () => { collect(); draw(); });
  }
  function collect() {   // read the form back into `prod` (keeps ids so existing options update in place)
    prod.title = $('#pTitle').value; prod.category_id = $('#pCat').value; prod.base_price = $('#pBase').value; prod.compare_at_price = $('#pCmp').value; prod.description = $('#pDesc').value;
    view.querySelectorAll('.optedit').forEach((el) => {
      const g = prod.groups[+el.dataset.gi]; if (!g) return;
      g.name = el.querySelector('.gname').value; g.type = el.querySelector('.gtype').value; g.required = g.type === 'checkbox' ? false : el.querySelector('.greq').checked;
      el.querySelectorAll('.vrow').forEach((r) => {
        const v = g.values[+r.dataset.vi]; if (!v) return;
        v.label = r.querySelector('.vlabel').value; v.price_delta = r.querySelector('.vprice').value;
        const hx = r.querySelector('.vhex'); v.hex = hx ? hx.value : null;
      });
    });
  }
  async function save(e) {
    e.preventDefault(); collect();
    const body = { title: prod.title, description: prod.description, category_id: prod.category_id, base_price: prod.base_price, compare_at_price: prod.compare_at_price, images: prod.images,
      groups: prod.groups.map((g) => ({ id: g.id, name: g.name, type: g.type, required: g.required, values: g.values.map((v) => ({ id: v.id, label: v.label, price_delta: v.price_delta === '' ? 0 : v.price_delta, hex: g.type === 'swatch' ? v.hex : null, image_url: v.image_url })) })) };
    try {
      const r = await api(isNew ? '/seller/products' : '/seller/products/' + prod.id, { method: isNew ? 'POST' : 'PUT', body });
      toast('Product saved'); location.hash = '#/p/' + r.id;
    } catch (er) { $('#pErr').textContent = er.message; }
  }
  draw();
});

// ============ ADMIN ============
on(/^\/admin$/, async () => {
  if (!guard('admin')) return;
  const [sellers, products] = await Promise.all([api('/admin/sellers'), api('/admin/products')]);
  view.innerHTML = `<h1>Admin</h1><h2>Sellers</h2><div class="card tablewrap"><table><tr><th>Shop</th><th>Email</th><th>Status</th><th>Products</th><th></th></tr>
    ${sellers.map((s) => `<tr><td>${esc(s.shop_name)}</td><td>${esc(s.email)}</td><td>${statusPill(s.status)}</td><td>${s.product_count}</td>
      <td>${['approved', 'hidden'].filter((x) => x !== s.status).map((x) => `<button class="btn sm alt" data-seller="${s.id}" data-s="${x}">${x === 'approved' ? 'Approve' : 'Hide'}</button>`).join(' ')}</td></tr>`).join('')}</table></div>
    <h2>Listings</h2><div class="card tablewrap"><table><tr><th>Product</th><th>Seller</th><th>Price</th><th>Status</th><th></th></tr>
    ${products.map((p) => `<tr><td><a href="#/p/${p.id}">${esc(p.title)}</a></td><td>${esc(p.shop_name)} ${p.seller_status !== 'approved' ? `<span class="pill ${p.seller_status}">${p.seller_status}</span>` : ''}</td><td>${money(p.base_price)}</td><td>${statusPill(p.status)}</td>
      <td><button class="btn sm alt" data-prod="${p.id}" data-s="${p.status === 'active' ? 'hidden' : 'active'}">${p.status === 'active' ? 'Hide' : 'Approve / show'}</button></td></tr>`).join('')}</table></div>`;
  view.querySelectorAll('[data-seller]').forEach((b) => b.onclick = async () => { await api('/admin/sellers/' + b.dataset.seller, { method: 'PATCH', body: { status: b.dataset.s } }); route(); });
  view.querySelectorAll('[data-prod]').forEach((b) => b.onclick = async () => { await api('/admin/products/' + b.dataset.prod, { method: 'PATCH', body: { status: b.dataset.s } }); route(); });
});

// ---------- boot ----------
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
(async () => { await loadMe(); await route(); })();
