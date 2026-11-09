// services/migrate.js — SQL-миграции применяются сами при запуске сервера.
// Берутся файлы migrations/NNN_*.sql по порядку, применённые записываются в таблицу schema_migrations.
// Старая база, где миграции уже запускали вручную (есть таблица users, но нет schema_migrations):
// все существующие файлы отмечаются применёнными без запуска. Новые файлы (014 и дальше) применятся сами.
// Вспомогательные файлы catchup_*.sql и update_*.sql не запускаются: они были для ручного обновления.
const fs = require('fs');
const path = require('path');
const { pool } = require('../db');

const DIR = path.join(__dirname, '..', '..', 'migrations');
const files = () => fs.readdirSync(DIR).filter((f) => /^\d{3}_.+\.sql$/.test(f)).sort();

async function migrate({ log = console.log } = {}) {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(727001)');
    const { rows: has } = await client.query(`SELECT to_regclass('public.schema_migrations') AS m, to_regclass('public.users') AS u`);
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(200) PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    if (!has[0].m && has[0].u) {
      for (const f of files()) await client.query('INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING', [f]);
      log(`🗂️ Миграции: база уже была, отмечено применёнными ${files().length}`);
      return [];
    }
    const { rows } = await client.query('SELECT name FROM schema_migrations');
    const done = new Set(rows.map((r) => r.name));
    const applied = [];
    for (const f of files()) {
      if (done.has(f)) continue;
      const sql = fs.readFileSync(path.join(DIR, f), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [f]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw new Error(`Миграция ${f} не применилась: ${err.message}`);
      }
      applied.push(f);
      log(`🗂️ Применена миграция ${f}`);
    }
    return applied;
  } finally {
    await client.query('SELECT pg_advisory_unlock(727001)').catch(() => {});
    client.release();
  }
}

module.exports = { migrate, files };
