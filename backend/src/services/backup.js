// services/backup.js — ежедневная резервная копия базы.
// Каждая таблица выгружается построчно (без чтения целиком в память), сжимается gzip и шифруется AES-256-GCM.
// Копия кладётся в S3-хранилище в России (services/s3.js). Если хранилище не настроено, последние 3 копии
// остаются на диске сервера, и сисадмину приходит предупреждение: на том же сервере копия не спасёт от его потери.
// Переменные окружения:
//   BACKUP_KEY      пароль шифрования (обязателен, без него копия не делается). Храните его отдельно от сервера!
//   BACKUP_HOUR     час запуска по Москве (по умолчанию 4)
//   BACKUP_KEEP     сколько дней хранить копии в хранилище (по умолчанию 14)
//   BACKUP_DIR      папка для локальных копий (по умолчанию системная временная)
//   BACKUP_SKIP     таблицы, которые не нужны в копии, через запятую (по умолчанию pronunciations: записи скачаются заново)
// Восстановление: node scripts/restore-backup.js <файл> (см. README).
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { pipeline } = require('stream/promises');
const { Readable } = require('stream');
const { query } = require('../db');
const s3 = require('./s3');
const { withLock } = require('./jobs');
const alerts = require('./alerts');

const MAGIC = Buffer.from('LFBK1');
const TZ = process.env['APP_TIMEZONE'] || 'Europe/Moscow';
const HOUR = Number(process.env['BACKUP_HOUR'] ?? 4);
const KEEP_DAYS = Number(process.env['BACKUP_KEEP'] || 14);
const SKIP = new Set(String(process.env['BACKUP_SKIP'] ?? 'pronunciations').split(',').map((x) => x.trim()).filter(Boolean));
const BATCH = 300;

const keyFrom = (pass) => crypto.scryptSync(pass, 'lessonfold-backup', 32);

async function tables() {
  const { rows } = await query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`);
  return rows.map((r) => r.table_name).filter((t) => !SKIP.has(t));
}

// Значение → JSON без потерь: bytea в base64, даты строкой
const enc = (v) => (Buffer.isBuffer(v) ? { $b: v.toString('base64') } : v instanceof Date ? v.toISOString() : v);

// Построчная выгрузка: идём по ctid пачками, чтобы большие таблицы (учебники) не попадали в память целиком
async function* dumpLines() {
  yield `${JSON.stringify({ lessonfold_backup: 1, at: new Date().toISOString() })}\n`;
  for (const t of await tables()) {
    const { rows: cols } = await query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`, [t]);
    yield `${JSON.stringify({ table: t, columns: cols.map((c) => c.column_name) })}\n`;
    let last = '(0,0)';
    for (;;) {
      const { rows } = await query(`SELECT ctid::text AS _ctid, * FROM "${t}" WHERE ctid > $1::tid ORDER BY ctid LIMIT ${BATCH}`, [last]);
      if (!rows.length) break;
      for (const r of rows) {
        last = r._ctid;
        yield `${JSON.stringify(cols.map((c) => enc(r[c.column_name])))}\n`;
      }
    }
  }
  yield `${JSON.stringify({ end: true })}\n`;
}

// Файл копии: MAGIC | iv(12) | шифротекст(gzip(jsonl)) | tag(16)
async function makeFile(pass) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyFrom(pass), iv);
  const dir = process.env['BACKUP_DIR'] || os.tmpdir();
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const file = path.join(dir, `lessonfold-${stamp}.lfbk`);
  const out = fs.createWriteStream(file);
  out.write(Buffer.concat([MAGIC, iv]));
  await pipeline(Readable.from(dumpLines()), zlib.createGzip({ level: 6 }), cipher, out, { end: false });
  await new Promise((resolve, reject) => out.end(cipher.getAuthTag(), (err) => (err ? reject(err) : resolve())));
  return file;
}

// Расшифровать файл копии в поток строк JSON (для восстановления и проверки)
function openFile(file, pass) {
  const buf = fs.readFileSync(file);
  if (!buf.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Это не файл резервной копии Lessonfold');
  const iv = buf.subarray(MAGIC.length, MAGIC.length + 12);
  const tag = buf.subarray(buf.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyFrom(pass), iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(buf.subarray(MAGIC.length + 12, buf.length - 16)), decipher.final()]);
  return zlib.gunzipSync(plain).toString('utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

async function setState(value) {
  await query(`INSERT INTO settings (key, value) VALUES ('backup_state', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [JSON.stringify(value)]);
}
async function state() {
  const { rows } = await query("SELECT value FROM settings WHERE key = 'backup_state'");
  const v = rows[0]?.value;
  return typeof v === 'string' ? JSON.parse(v) : v || null;
}

function cleanLocal(dir, keep = 3) {
  try {
    const files = fs.readdirSync(dir).filter((f) => /^lessonfold-.*\.lfbk$/.test(f)).sort();
    for (const f of files.slice(0, Math.max(0, files.length - keep))) fs.unlinkSync(path.join(dir, f));
  } catch { /* папки нет */ }
}

async function run({ reason = 'по расписанию' } = {}) {
  const pass = process.env['BACKUP_KEY'];
  if (!pass) {
    await alerts.toAdmins('Резервная копия не сделана', 'Не задан BACKUP_KEY в переменных окружения сервера. Без него копии не создаются.', { key: 'backup-nokey', everyMin: 24 * 60 });
    return { ok: false, error: 'BACKUP_KEY не задан' };
  }
  const started = Date.now();
  let file = null;
  try {
    file = await makeFile(pass);
    const size = fs.statSync(file).size;
    let where = 'local';
    if (s3.enabled()) {
      const key = `backups/${path.basename(file)}`;
      await s3.putFile(key, file);
      where = 's3';
      const old = (await s3.list('backups/')).filter((o) => o.modified < new Date(Date.now() - KEEP_DAYS * 864e5));
      for (const o of old) await s3.remove(o.key);
      fs.unlinkSync(file);
      file = key;
    } else {
      cleanLocal(path.dirname(file));
      await alerts.toAdmins('Резервная копия только на сервере', 'Хранилище S3 не настроено: копия лежит на том же сервере и не спасёт при его потере. Настройте S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY.', { key: 'backup-local', everyMin: 7 * 24 * 60 });
    }
    const result = { ok: true, at: new Date().toISOString(), size, where, file: where === 's3' ? file : path.basename(file), seconds: Math.round((Date.now() - started) / 1000), reason };
    await setState(result);
    console.log(`💾 Резервная копия готова: ${result.file}, ${Math.round(size / 1024)} КБ, ${result.seconds} с (${where})`);
    return result;
  } catch (err) {
    console.error('❌ Резервная копия не удалась:', err.message);
    await setState({ ok: false, at: new Date().toISOString(), error: err.message, reason }).catch(() => {});
    await alerts.toAdmins('Резервная копия не удалась', err.message, { key: 'backup-fail', everyMin: 6 * 60 });
    if (file && fs.existsSync(file) && s3.enabled()) fs.unlinkSync(file);
    return { ok: false, error: err.message };
  }
}

// Раз в 15 минут: если наступил час копии и сегодня её ещё не было, делаем (одна копия сервера, см. jobs.js)
const localDay = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
const localHour = () => Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(new Date()));
async function tick() {
  if (localHour() < HOUR) return;
  await withLock('backup', async () => {
    const s = await state();
    if (s?.ok && localDay(new Date(s.at)) === localDay()) return;
    if (s && !s.ok && Date.now() - new Date(s.at) < 60 * 60 * 1000) return; // после сбоя пробуем раз в час
    await run();
  });
}
let timer = null;
function start() {
  if (timer || process.env['BACKUP_DISABLED'] === '1') return;
  timer = setInterval(() => tick().catch((err) => console.error('⚠️ backup tick:', err.message)), 15 * 60 * 1000);
  setTimeout(() => tick().catch(() => {}), 60 * 1000);
}

module.exports = { run, start, state, openFile, makeFile, tick };
