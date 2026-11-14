// Generates neutral placeholder "bed" illustrations (no third-party photos / branding).
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v + amt * (amt < 0 ? v : 255 - v))));
  const r = c(n >> 16), g = c((n >> 8) & 255), b = c(n & 255);
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}
function bedSvg(view = 1, hex = '#e8dcc4') {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) hex = '#e8dcc4';
  const base = hex, dark = shade(hex, -0.22), light = shade(hex, 0.25), edge = shade(hex, -0.4);
  const bg = ['#f3f1ee', '#ece9e4', '#f6f4f1', '#e9e6e1', '#f1eeea'][(view - 1) % 5];
  let body = '';
  const floor = `<rect y="470" width="800" height="130" fill="#d9d4cc"/>`;
  const headboard = (x, w) => `<rect x="${x}" y="150" width="${w}" height="190" rx="14" fill="${dark}"/>` +
    [0, 1, 2, 3].map((i) => `<rect x="${x + 14 + i * ((w - 28) / 4)}" y="166" width="${(w - 28) / 4 - 8}" height="158" rx="8" fill="${base}" opacity=".9"/>`).join('');
  if (view === 1) { // front 3/4
    body = headboard(150, 500) +
      `<rect x="130" y="330" width="540" height="70" rx="12" fill="#fbfaf8" stroke="#ddd"/>` +
      `<rect x="130" y="400" width="540" height="95" rx="6" fill="${base}"/>` +
      `<rect x="130" y="478" width="540" height="17" fill="${dark}"/>` +
      `<rect x="150" y="495" width="22" height="26" fill="${edge}"/><rect x="628" y="495" width="22" height="26" fill="${edge}"/>`;
  } else if (view === 2) { // side with drawers
    body = headboard(120, 150) + `<rect x="120" y="330" width="560" height="65" rx="12" fill="#fbfaf8" stroke="#ddd"/>` +
      `<rect x="120" y="395" width="560" height="100" rx="6" fill="${base}"/>` +
      [0, 1].map((i) => `<rect x="${150 + i * 260}" y="410" width="230" height="68" rx="5" fill="${light}" stroke="${dark}"/><circle cx="${265 + i * 260}" cy="444" r="7" fill="${edge}"/>`).join('') +
      `<rect x="120" y="495" width="560" height="14" fill="${dark}"/>`;
  } else if (view === 3) { // headboard close-up
    body = `<rect x="80" y="90" width="640" height="330" rx="22" fill="${dark}"/>` +
      [0, 1, 2, 3, 4].map((i) => `<rect x="${106 + i * 120}" y="116" width="104" height="278" rx="12" fill="${base}"/>`).join('') +
      `<rect x="60" y="420" width="680" height="80" rx="10" fill="#fbfaf8" stroke="#ddd"/>`;
  } else if (view === 4) { // top-down
    body = `<rect x="140" y="60" width="520" height="440" rx="16" fill="${dark}"/>` +
      `<rect x="160" y="130" width="480" height="350" rx="10" fill="#fbfaf8" stroke="#ddd"/>` +
      `<rect x="180" y="150" width="210" height="80" rx="14" fill="${light}"/><rect x="410" y="150" width="210" height="80" rx="14" fill="${light}"/>` +
      `<rect x="160" y="130" width="480" height="30" fill="${base}" opacity=".0"/>`;
  } else { // fabric swatch detail
    const dots = []; for (let y = 40; y < 560; y += 22) for (let x = 40; x < 760; x += 22) dots.push(`<circle cx="${x + (y / 22 % 2) * 11}" cy="${y}" r="5" fill="${dark}" opacity=".35"/>`);
    body = `<rect x="40" y="30" width="720" height="540" rx="20" fill="${base}"/>` + dots.join('');
  }
  const label = ['Front view', 'Storage drawers', 'Headboard', 'Top view', 'Fabric detail'][(view - 1) % 5];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600"><rect width="800" height="600" fill="${bg}"/>${view <= 2 ? floor : ''}${body}` +
    `<text x="400" y="582" text-anchor="middle" font-family="Arial" font-size="18" fill="#8a857c">Placeholder · ${label}</text></svg>`;
}
module.exports = { bedSvg };
