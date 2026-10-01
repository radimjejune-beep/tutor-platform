// utils.js — общие помощники
const crypto = require('crypto');

// Временный пароль без похожих символов (0/O, 1/l/I)
function generateTempPassword(length = 10) {
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

// Убрать из объекта поля, которые видит только репетитор
function stripPrivate(obj, fields) {
  if (!obj) return obj;
  const copy = { ...obj };
  for (const f of fields) delete copy[f];
  return copy;
}

// Ошибка с HTTP-статусом — её поймает общий обработчик
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Собрать UPDATE только из переданных полей (имена полей берутся из схемы zod, не от пользователя)
function buildUpdate(table, id, data) {
  const keys = Object.keys(data);
  if (keys.length === 0) return null;
  const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  return {
    text: `UPDATE ${table} SET ${sets} WHERE id = $1 RETURNING *`,
    values: [id, ...keys.map((k) => data[k])],
  };
}

// Транслитерация для логина: «Иван Петров» → «ivan.petrov»
const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k',
  л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

function loginBase(fullName) {
  const latin = fullName
    .toLowerCase()
    .split('')
    .map((ch) => (TRANSLIT[ch] !== undefined ? TRANSLIT[ch] : ch))
    .join('');
  const parts = latin.split(/[^a-z0-9]+/).filter(Boolean).slice(0, 2);
  const base = parts.join('.') || 'user';
  return base.length >= 3 ? base.slice(0, 56) : `${base}.user`;
}

// Свободный логин: ivan.petrov, ivan.petrov2, ivan.petrov3...
async function uniqueLogin(db, fullName) {
  const base = loginBase(fullName);
  const { rows } = await db.query('SELECT login FROM users WHERE login = $1 OR login ~ $2', [
    base,
    `^${base.replace(/\./g, '\\.')}[0-9]+$`,
  ]);
  const taken = new Set(rows.map((r) => r.login));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}${i}`)) return `${base}${i}`;
}

// Логин, который вводит человек: без пробелов, в нижнем регистре
const normalizeLogin = (s) => String(s || '').trim().toLowerCase();

module.exports = {
  generateTempPassword,
  stripPrivate,
  HttpError,
  buildUpdate,
  loginBase,
  uniqueLogin,
  normalizeLogin,
};
