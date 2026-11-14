// Generates PWA icons (PNG) without any dependencies.
const zlib = require('zlib'), fs = require('fs'), path = require('path');
function crc(buf) { let c, crc = 0xffffffff; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); }
function png(size, maskable) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const bg = [30, 41, 59], fg = [255, 255, 255], acc = [245, 158, 11];
  const pad = maskable ? 0.28 : 0.18;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size; let col = bg;
      // rounded corners for non-maskable
      if (!maskable) { const r = 0.2, dx = Math.max(Math.abs(u - .5) - (.5 - r), 0), dy = Math.max(Math.abs(v - .5) - (.5 - r), 0); if (dx * dx + dy * dy > r * r) col = null; }
      if (col) {
        const L = pad + 0.05, R = 1 - pad - 0.05, T = pad + 0.12, B = 1 - pad;
        // simple "M" shape: two legs + two diagonals
        const w = 0.075; const inM = v > T && v < B && (Math.abs(u - L) < w || Math.abs(u - R) < w ||
          (u > L && u < .5 && Math.abs((v - T) - (u - L) * ((B - T) * .6 / (.5 - L))) < w * 1.2) ||
          (u >= .5 && u < R && Math.abs((v - T) - (R - u) * ((B - T) * .6 / (R - .5))) < w * 1.2));
        if (inM) col = fg;
        if (v > B + 0.01 && v < B + 0.05 && u > L && u < R) col = acc;
      }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      if (col) { raw[o] = col[0]; raw[o + 1] = col[1]; raw[o + 2] = col[2]; raw[o + 3] = 255; } else { raw[o + 3] = 0; }
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const out = path.join(__dirname, '..', 'public', 'icons'); fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'icon-192.png'), png(192, false));
fs.writeFileSync(path.join(out, 'icon-512.png'), png(512, false));
fs.writeFileSync(path.join(out, 'maskable-512.png'), png(512, true));
fs.writeFileSync(path.join(out, 'apple-touch-icon.png'), png(180, true));
console.log('icons written');
