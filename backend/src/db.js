// db.js — подключение к PostgreSQL и помощник для транзакций
const { Pool, types } = require('pg');

// Даты (DATE) отдаём строкой «2026-10-01», без перевода в часовой пояс — иначе день «съезжает»
types.setTypeParser(1082, (value) => value);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // На хостинге с SSL можно включить DB_SSL=true
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  // Часовой пояс сессии: от него зависят «сегодня», «этот месяц» и дата занятия
  options: `-c timezone=${process.env.APP_TIMEZONE || 'Europe/Moscow'}`,
});

pool.on('error', (err) => {
  console.error('❌ Ошибка соединения с базой:', err.message);
});

// Обычный запрос
const query = (text, params) => pool.query(text, params);

// Транзакция: всё внутри fn либо выполнится целиком, либо откатится
async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, transaction };
