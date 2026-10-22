// sso.js — одноразовые ссылки входа в админку магазина из платформы (живут 2 минуты)
const crypto = require('crypto');
const codes = new Map();
const TTL = 120000;

function issue(login) {
  const now = Date.now();
  for (const [k, v] of codes) if (v.until < now) codes.delete(k);
  const code = crypto.randomBytes(24).toString('base64url');
  codes.set(code, { login, until: now + TTL });
  return code;
}

function take(code) {
  const v = codes.get(String(code || ''));
  if (!v) return null;
  codes.delete(code);
  return v.until >= Date.now() ? v.login : null;
}

module.exports = { issue, take };
