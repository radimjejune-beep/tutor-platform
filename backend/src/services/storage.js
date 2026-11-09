// services/storage.js — где лежит содержимое файлов: в базе или в S3-хранилище.
// Если S3 настроен (services/s3.js), новые файлы и части учебников уходят туда, а в базе остаётся
// только ключ (столбец s3_key). Старые файлы остаются в базе и читаются как раньше.
// Так база не растёт от учебников, а резервная копия базы делается быстро.
// Один объект может принадлежать нескольким строкам (копия материала из каталога), поэтому объект
// удаляется из хранилища, только когда на него не ссылается ни одна строка.
const crypto = require('crypto');
const { query } = require('../db');
const s3 = require('./s3');

let ready = null;
function ensure() {
  if (!ready) {
    ready = (async () => {
      await require('../routes/books').ensure();
      await query(`
        ALTER TABLE files ADD COLUMN IF NOT EXISTS s3_key VARCHAR(200);
        ALTER TABLE files ALTER COLUMN data DROP NOT NULL;
        ALTER TABLE library_book_parts ADD COLUMN IF NOT EXISTS s3_key VARCHAR(200);
        ALTER TABLE library_book_parts ADD COLUMN IF NOT EXISTS size_bytes INTEGER;
        ALTER TABLE library_book_parts ALTER COLUMN data DROP NOT NULL;
      `);
    })().catch((err) => { ready = null; throw err; });
  }
  return ready;
}

// Сохранить содержимое: вернёт { data, s3_key } для записи в строку
async function put(prefix, buf, mime) {
  await ensure();
  if (!s3.enabled()) return { data: buf, s3_key: null };
  const key = `${prefix}/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}`;
  await s3.putBuffer(key, buf, mime || 'application/octet-stream');
  return { data: null, s3_key: key };
}

// Прочитать содержимое строки (files или library_book_parts)
async function read(row) {
  if (row.s3_key) return s3.getBuffer(row.s3_key);
  return row.data;
}

// Удалить объекты, на которые больше никто не ссылается. Ошибки хранилища не мешают удалению в базе.
async function release(keys) {
  for (const key of new Set((keys || []).filter(Boolean))) {
    const { rows } = await query(
      'SELECT 1 FROM files WHERE s3_key = $1 UNION ALL SELECT 1 FROM library_book_parts WHERE s3_key = $1 LIMIT 1',
      [key]
    );
    if (!rows[0] && s3.enabled()) await s3.remove(key);
  }
}

// Раз в сутки: убрать из хранилища объекты, на которые не ссылается ни одна строка
// (например, после удаления ученика или материала вместе с файлами). Свежие объекты не трогаем:
// их строка может ещё записываться.
async function sweep() {
  if (!s3.enabled()) return 0;
  await ensure();
  let removed = 0;
  for (const prefix of ['files/', 'books/']) {
    const objects = (await s3.list(prefix)).filter((o) => o.modified < new Date(Date.now() - 864e5));
    for (let i = 0; i < objects.length; i += 500) {
      const keys = objects.slice(i, i + 500).map((o) => o.key);
      const { rows } = await query(
        'SELECT s3_key FROM files WHERE s3_key = ANY($1) UNION SELECT s3_key FROM library_book_parts WHERE s3_key = ANY($1)',
        [keys]
      );
      const used = new Set(rows.map((r) => r.s3_key));
      for (const k of keys) if (!used.has(k)) { await s3.remove(k); removed++; }
    }
  }
  if (removed) console.log(`🧹 Хранилище: удалено ненужных объектов: ${removed}`);
  return removed;
}

let timer = null;
function start() {
  if (timer) return;
  const tick = () => require('./jobs').withLock('storage-sweep', sweep).catch((err) => console.error('🧹 Хранилище:', err.message));
  setTimeout(tick, 10 * 60 * 1000);
  timer = setInterval(tick, 24 * 60 * 60 * 1000);
}

module.exports = { ensure, put, read, release, sweep, start };
