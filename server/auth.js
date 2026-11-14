const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { db } = require('./db');
const { HttpError } = require('./products');

// Signing secret comes from env; otherwise a random one is generated and kept in data/ (git-ignored).
function getSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const f = path.join(__dirname, '..', 'data', '.secret');
  try { return fs.readFileSync(f, 'utf8'); } catch {}
  const s = crypto.randomBytes(32).toString('hex');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, s);
  return s;
}
const SECRET = getSecret();

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') };
}
function verifyPassword(password, salt, hash) {
  const a = Buffer.from(crypto.scryptSync(password, salt, 64).toString('hex'));
  const b = Buffer.from(hash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function sign(userId) {
  const body = Buffer.from(JSON.stringify({ u: userId, e: Date.now() + 7 * 864e5 })).toString('base64url');
  return body + '.' + crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
}
function parse(token) {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const good = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  const d = JSON.parse(Buffer.from(body, 'base64url').toString());
  return d.e > Date.now() ? d.u : null;
}
// Attach req.user if a valid bearer token is present
function loadUser(req, _res, next) {
  const h = req.headers.authorization || '';
  const uid = parse(h.startsWith('Bearer ') ? h.slice(7) : null);
  req.user = uid ? db.prepare('SELECT id,email,name,role,shop_name,status FROM users WHERE id=?').get(uid) : null;
  next();
}
const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(new HttpError(401, 'Please log in'));
  if (!roles.includes(req.user.role)) return next(new HttpError(403, 'Not allowed for your role'));
  next();
};
module.exports = { hashPassword, verifyPassword, sign, loadUser, requireRole };
