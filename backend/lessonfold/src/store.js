'use strict';
// Файлы уроков, админы сайта и их сессии. Всё хранится в PostgreSQL:
// на хостинге диск может очищаться при каждом деплое, база остаётся.
const crypto = require('crypto');
const db = require('./db');

async function migrate() {
  await db.q(`
    CREATE TABLE IF NOT EXISTS files (
      key TEXT PRIMARY KEY,
      mime TEXT NOT NULL,
      size INTEGER NOT NULL,
      sha TEXT NOT NULL,
      data BYTEA NOT NULL,
      updated_by TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS admins (
      login TEXT PRIMARY KEY,
      pass TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_login_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      login TEXT NOT NULL REFERENCES admins(login) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS admin_log (
      id SERIAL PRIMARY KEY,
      login TEXT,
      action TEXT NOT NULL,
      detail TEXT,
      at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

// ---------- файлы ----------
const sha = buf => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);

async function putFile(key, mime, buf, by) {
  const h = sha(buf);
  await db.q(
    `INSERT INTO files (key, mime, size, sha, data, updated_by) VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (key) DO UPDATE SET mime = EXCLUDED.mime, size = EXCLUDED.size, sha = EXCLUDED.sha,
       data = EXCLUDED.data, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [key, mime, buf.length, h, buf, by || null]
  );
  return { key, mime, size: buf.length, sha: h };
}

async function getFile(key) {
  const r = await db.q('SELECT key, mime, size, sha, data, updated_at FROM files WHERE key = $1', [key]);
  return r.rows[0] || null;
}

async function fileInfo(keys) {
  if (!keys.length) return {};
  const r = await db.q('SELECT key, mime, size, sha, updated_at, updated_by FROM files WHERE key = ANY($1)', [keys]);
  return Object.fromEntries(r.rows.map(x => [x.key, x]));
}

async function hasFile(key) {
  const r = await db.q('SELECT 1 FROM files WHERE key = $1', [key]);
  return r.rowCount > 0;
}

async function deleteFile(key) {
  await db.q('DELETE FROM files WHERE key = $1', [key]);
}

// ---------- админы ----------
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

function checkPassword(password, stored) {
  const [kind, s, h] = String(stored).split('$');
  if (kind !== 'scrypt') return false;
  const want = Buffer.from(h, 'base64');
  const got = crypto.scryptSync(String(password), Buffer.from(s, 'base64'), want.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(want, got);
}

const LOGIN_RE = /^[a-z0-9_.-]{3,32}$/;

async function createAdmin(login, password) {
  if (!LOGIN_RE.test(login)) throw new Error('Логин: 3-32 символа, латиница, цифры, точка, дефис, подчёркивание');
  if (String(password).length < 10) throw new Error('Пароль должен быть не короче 10 символов');
  await db.q('INSERT INTO admins (login, pass) VALUES ($1, $2)', [login, hashPassword(password)]);
}

async function setPassword(login, password) {
  if (String(password).length < 10) throw new Error('Пароль должен быть не короче 10 символов');
  await db.q('UPDATE admins SET pass = $2 WHERE login = $1', [login, hashPassword(password)]);
  await db.q('DELETE FROM sessions WHERE login = $1', [login]);
}

async function listAdmins() {
  const r = await db.q('SELECT login, created_at, last_login_at FROM admins ORDER BY created_at');
  return r.rows;
}

async function deleteAdmin(login) {
  await db.q('DELETE FROM admins WHERE login = $1', [login]);
}

async function countAdmins() {
  const r = await db.q('SELECT count(*)::int AS n FROM admins');
  return r.rows[0].n;
}

// Первый админ из переменных окружения, если в базе ещё никого нет
async function ensureFirstAdmin(login, password) {
  if (!login || !password) return false;
  if (await countAdmins()) return false;
  await createAdmin(login, password);
  return true;
}

async function login(loginName, password) {
  const r = await db.q('SELECT login, pass FROM admins WHERE login = $1', [loginName]);
  const a = r.rows[0];
  // проверяем пароль и для несуществующего логина, чтобы время ответа не выдавало логины
  const ok = a ? checkPassword(password, a.pass) : (checkPassword(password, hashPassword('x')) && false);
  if (!ok) return null;
  const token = crypto.randomBytes(32).toString('base64url');
  await db.q(`INSERT INTO sessions (token, login, expires_at) VALUES ($1, $2, now() + interval '14 days')`, [token, a.login]);
  await db.q('UPDATE admins SET last_login_at = now() WHERE login = $1', [a.login]);
  await db.q('DELETE FROM sessions WHERE expires_at < now()');
  return token;
}

async function session(token) {
  if (!token) return null;
  const r = await db.q('SELECT login FROM sessions WHERE token = $1 AND expires_at > now()', [token]);
  return r.rows[0] ? r.rows[0].login : null;
}

async function logout(token) {
  await db.q('DELETE FROM sessions WHERE token = $1', [token]);
}

async function log(loginName, action, detail) {
  await db.q('INSERT INTO admin_log (login, action, detail) VALUES ($1, $2, $3)', [loginName, action, detail || null]);
}

async function recentLog(limit = 30) {
  const r = await db.q('SELECT login, action, detail, at FROM admin_log ORDER BY id DESC LIMIT $1', [limit]);
  return r.rows;
}

module.exports = {
  migrate, putFile, getFile, fileInfo, hasFile, deleteFile,
  createAdmin, setPassword, listAdmins, deleteAdmin, ensureFirstAdmin, login, session, logout, log, recentLog
};
