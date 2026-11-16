// services/migrate.js — SQL-миграции применяются сами при запуске сервера.
// Берутся файлы migrations/NNN_*.sql по порядку, применённые записываются в таблицу schema_migrations.
// Старая база, где миграции уже запускали вручную (есть таблица users, но нет schema_migrations):
// распознаём только уже существующую схему 001–013. Более поздние файлы выполняются,
// а не отмечаются выполненными вслепую.
// Вспомогательные файлы catchup_*.sql и update_*.sql не запускаются: они были для ручного обновления.
const fs = require('fs');
const path = require('path');
const { pool } = require('../db');

const DIR = path.join(__dirname, '..', '..', 'migrations');
const files = () => fs.readdirSync(DIR).filter((f) => /^\d{3}_.+\.sql$/.test(f)).sort();

// Старые SQL-файлы рассчитаны на ручной запуск и содержат BEGIN/COMMIT.
// Транзакцией управляет runner: SQL и запись в журнале должны фиксироваться вместе.
const migrationSql = (sql) => sql.replace(/^\s*(?:BEGIN|COMMIT);\s*$/gim, '');

async function legacyApplied(client, sql) {
  const tables = [...sql.matchAll(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(\w+)\s*\(/gi)].map((m) => m[1]);
  const columns = [...sql.matchAll(/ALTER TABLE\s+(\w+)\s+ADD COLUMN\s+(?:IF NOT EXISTS\s+)?(\w+)/gi)]
    .map((m) => [m[1], m[2]])
    .filter(([table, col]) => !new RegExp(`ALTER TABLE\\s+${table}\\s+DROP COLUMN\\s+(?:IF EXISTS\\s+)?${col}\\b`, 'i').test(sql));
  if (!tables.length && !columns.length) return false;
  for (const table of tables) {
    const { rows } = await client.query('SELECT to_regclass($1) AS name', [`public.${table}`]);
    if (!rows[0].name) return false;
  }
  for (const [table, col] of columns) {
    const { rows } = await client.query("SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2", [table, col]);
    if (!rows[0]) return false;
  }
  return true;
}

// Исправляем журнал прежнего runner, который мог отметить 014–018 без выполнения.
async function modernApplied(client, f, sql) {
  const n = Number(f.slice(0, 3));
  if (n === 16) {
    const { rows } = await client.query("SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = to_regclass('public.library_items') AND conname = 'library_items_kind_check'");
    return Boolean(rows[0]?.def.includes("'deck'"));
  }
  if (n === 17) {
    if (!(await legacyApplied(client, sql))) return false;
    const { rows } = await client.query("SELECT to_regclass('public.users_email_lower_key') AS name");
    return Boolean(rows[0].name);
  }
  if (n >= 14 && n <= 18) return legacyApplied(client, sql);
  return true;
}

async function migrate({ log = console.log } = {}) {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(727001)');
    const { rows: has } = await client.query(`SELECT to_regclass('public.schema_migrations') AS m, to_regclass('public.users') AS u`);
    await client.query('BEGIN');
    try {
      await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(200) PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
      if (!has[0].m && has[0].u) {
        let baseline = 0;
        for (const f of files().filter((name) => Number(name.slice(0, 3)) <= 13)) {
          if (!(await legacyApplied(client, fs.readFileSync(path.join(DIR, f), 'utf8')))) break;
          await client.query('INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING', [f]);
          baseline++;
        }
        log(`🗂️ Подтверждены старые миграции: ${baseline}`);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
    const { rows } = await client.query('SELECT name FROM schema_migrations');
    const done = new Set(rows.map((r) => r.name));
    const applied = [];
    for (const f of files()) {
      const sql = fs.readFileSync(path.join(DIR, f), 'utf8');
      if (done.has(f) && await modernApplied(client, f, sql)) continue;
      try {
        await client.query('BEGIN');
        await client.query(migrationSql(sql));
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING', [f]);
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
