// scripts/restore-backup.js — восстановление базы из резервной копии Lessonfold.
// Порядок:
//   1. Создайте ПУСТУЮ базу и примените SQL-миграции, как при установке (README, раздел «База»).
//   2. Скачайте файл копии (*.lfbk) из хранилища.
//   3. DATABASE_URL=... BACKUP_KEY=... node scripts/restore-backup.js путь/к/файлу.lfbk
// Скрипт сам создаст таблицы, которые появляются в коде, и загрузит данные. В непустую базу не пишет,
// пока не добавить --force (тогда существующие строки с теми же id пропускаются).
try { require('dotenv').config(); } catch { /* переменные заданы в окружении */ }
const { query, pool } = require('../src/db');
const { openFile } = require('../src/services/backup');
const { ensureAll } = require('../src/services/schema');

const dec = (v) => (v && typeof v === 'object' && !Array.isArray(v) && v.$b !== undefined ? Buffer.from(v.$b, 'base64') : v);

async function fkOrder(tables) {
  const { rows } = await query(`
    SELECT tc.table_name AS child, ccu.table_name AS parent
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
     WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'`);
  const deps = new Map(tables.map((t) => [t, new Set()]));
  for (const r of rows) if (deps.has(r.child) && deps.has(r.parent) && r.child !== r.parent) deps.get(r.child).add(r.parent);
  const out = [];
  const seen = new Set();
  const visit = (t, stack = new Set()) => {
    if (seen.has(t) || stack.has(t)) return;
    stack.add(t);
    for (const p of deps.get(t) || []) visit(p, stack);
    seen.add(t);
    out.push(t);
  };
  tables.forEach((t) => visit(t));
  return out;
}

(async () => {
  const file = process.argv[2];
  const force = process.argv.includes('--force');
  if (!file || !process.env.BACKUP_KEY) {
    console.log('Использование: BACKUP_KEY=... node scripts/restore-backup.js файл.lfbk [--force]');
    process.exit(1);
  }
  const lines = openFile(file, process.env.BACKUP_KEY);
  if (!lines[0]?.lessonfold_backup || !lines[lines.length - 1]?.end) throw new Error('Файл копии неполный');
  console.log(`Копия от ${lines[0].at}`);
  await ensureAll();

  const data = new Map();
  let cur = null;
  for (const l of lines.slice(1, -1)) {
    if (!Array.isArray(l)) { cur = { columns: l.columns, rows: [] }; data.set(l.table, cur); } else cur.rows.push(l);
  }
  const { rows: existing } = await query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`);
  const have = new Set(existing.map((r) => r.table_name));
  const missing = [...data.keys()].filter((t) => !have.has(t));
  if (missing.length) console.log(`⚠️ В базе нет таблиц: ${missing.join(', ')}. Примените миграции и запустите снова.`);

  if (!force) {
    for (const t of data.keys()) {
      if (!have.has(t) || t === 'settings' || !data.get(t).rows.length) continue;
      const { rows } = await query(`SELECT 1 FROM "${t}" LIMIT 1`);
      if (rows.length) throw new Error(`Таблица ${t} не пустая. Восстанавливайте в пустую базу или добавьте --force`);
    }
  }

  const order = await fkOrder([...data.keys()].filter((t) => have.has(t)));
  for (const t of order) {
    const { columns, rows } = data.get(t);
    const { rows: tc } = await query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`, [t]);
    const target = new Set(tc.map((c) => c.column_name));
    const idx = columns.map((c, i) => [c, i]).filter(([c]) => target.has(c));
    const cols = idx.map(([c]) => `"${c}"`).join(', ');
    let n = 0;
    for (let i = 0; i < rows.length; i += 100) {
      const part = rows.slice(i, i + 100);
      const params = [];
      const values = part.map((r) => `(${idx.map(([, j]) => { params.push(dec(r[j])); return `$${params.length}`; }).join(', ')})`).join(', ');
      const res = await query(`INSERT INTO "${t}" (${cols}) VALUES ${values} ON CONFLICT DO NOTHING`, params);
      n += res.rowCount;
    }
    // счётчики id после вставки
    const { rows: seqs } = await query(`SELECT column_name, pg_get_serial_sequence($1, column_name) AS seq FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $2 AND column_default LIKE 'nextval%'`, [`"${t}"`, t]);
    for (const s of seqs) if (s.seq) await query(`SELECT setval($1, GREATEST(COALESCE((SELECT MAX("${s.column_name}") FROM "${t}"), 0), 1))`, [s.seq]);
    console.log(`✓ ${t}: ${n} из ${rows.length}`);
  }
  console.log('Готово. Перезапустите сервер.');
  await pool.end();
})().catch(async (err) => { console.error('❌', err.message); await pool.end().catch(() => {}); process.exit(1); });
