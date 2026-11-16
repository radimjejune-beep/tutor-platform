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
    ALTER TABLE admins ADD COLUMN IF NOT EXISTS display_name TEXT;
    ALTER TABLE admins ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'admin' CHECK(role IN ('admin','manager','editor','finance'));
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

const LOGIN_RE = /^(?:[a-z0-9_.-]{3,32}|[a-z0-9][a-z0-9._+-]{0,63}@[a-z0-9][a-z0-9.-]{0,188}\.[a-z]{2,24})$/;

async function createAdmin(login,password,name='',role='admin') {
  if(!['admin','manager','editor','finance'].includes(role))throw Error('Неверная роль');
  if (login.length>254||!LOGIN_RE.test(login)) throw new Error('Укажите email или логин латиницей');
  if (String(password).length < 10) throw new Error('Пароль должен быть не короче 10 символов');
  await db.q('INSERT INTO admins(login,pass,display_name,role) VALUES($1,$2,$3,$4)',[login,hashPassword(password),String(name).trim().slice(0,160)||null,role]);
}

async function setPassword(login, password) {
  if (String(password).length < 10) throw new Error('Пароль должен быть не короче 10 символов');
  await db.q('UPDATE admins SET pass = $2 WHERE login = $1', [login, hashPassword(password)]);
  await db.q('DELETE FROM sessions WHERE login = $1', [login]);
}

async function listAdmins() {
  const r = await db.q('SELECT login, display_name, role, created_at, last_login_at FROM admins ORDER BY created_at');
  return r.rows;
}

async function adminProfile(login){return (await db.q('SELECT login,display_name,role FROM admins WHERE login=$1',[login])).rows[0]||null;}
async function changeAdmin(login,{remove=false,role}={}){
 return db.transaction(async c=>{
  await c.query('LOCK TABLE admins IN SHARE ROW EXCLUSIVE MODE');
  const row=(await c.query('SELECT role FROM admins WHERE login=$1',[login])).rows[0];if(!row)throw Object.assign(Error('Сотрудник не найден'),{status:404});
  if(row.role==='admin'&&(remove||role!=='admin')){const n=(await c.query("SELECT COUNT(*)::int AS n FROM admins WHERE role='admin'")).rows[0].n;if(n<=1)throw Object.assign(Error('Нельзя отключить последнего администратора с полным доступом'),{status:409});}
  if(remove)await c.query('DELETE FROM admins WHERE login=$1',[login]);else{if(!['admin','manager','editor','finance'].includes(role))throw Object.assign(Error('Неверная роль'),{status:422});await c.query('UPDATE admins SET role=$2 WHERE login=$1',[login,role]);}
 });
}
const deleteAdmin=login=>changeAdmin(login,{remove:true});
const setRole=(login,role)=>changeAdmin(login,{role});

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

// Вход из платформы: сисадмин платформы попадает в админку без отдельного пароля.
// Если такого админа в магазине нет, создаём его со случайным паролем (вход только через платформу).
async function sessionFor(loginName) {
  const name = String(loginName || '').toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 32);
  if (!LOGIN_RE.test(name)) throw new Error('Логин не подходит для админки магазина');
  await db.q('INSERT INTO admins (login, pass) VALUES ($1, $2) ON CONFLICT (login) DO NOTHING', [name, hashPassword(crypto.randomBytes(24).toString('base64url'))]);
  const token = crypto.randomBytes(32).toString('base64url');
  await db.q(`INSERT INTO sessions (token, login, expires_at) VALUES ($1, $2, now() + interval '14 days')`, [token, name]);
  await db.q('UPDATE admins SET last_login_at = now() WHERE login = $1', [name]);
  return { token, login: name };
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
  createAdmin, adminProfile, setRole, setPassword, sessionFor, listAdmins, deleteAdmin, ensureFirstAdmin, login, session, logout, log, recentLog
};
