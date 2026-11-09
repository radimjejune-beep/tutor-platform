// services/jobs.js — фоновые задачи без дублей.
// Если сервер запущен в нескольких копиях, каждый тик выполнит только одна: она берёт
// advisory lock PostgreSQL по имени задачи, остальные пропускают ход.
const { pool } = require('../db');

const keyOf = (name) => {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return h;
};

async function withLock(name, fn) {
  const client = await pool.connect();
  const key = keyOf(`lf:${name}`);
  try {
    const { rows } = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [key]);
    if (!rows[0].ok) return { skipped: true };
    try {
      return await fn();
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [key]).catch(() => {});
    }
  } finally {
    client.release();
  }
}

// Постоянная блокировка: задачу ведёт только одна копия сервера (например, чтение сообщений бота).
// Соединение держится, пока жив процесс; если копия упадёт, блокировку заберёт другая.
const held = new Map();
async function holdLock(name) {
  if (held.has(name)) return true;
  const client = await pool.connect();
  const { rows } = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [keyOf(`lf:${name}`)]);
  if (!rows[0].ok) { client.release(); return false; }
  client.on('error', () => { held.delete(name); });
  held.set(name, client);
  return true;
}

module.exports = { withLock, holdLock, keyOf };
