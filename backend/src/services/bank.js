// services/bank.js — банк заданий по учебникам: общие задания по юнитам, которые любой репетитор
// может посмотреть и взять себе в библиотеку. Наполняют его Lessonfold (стартовые задания) и сами репетиторы.
// Таблицы создаются при запуске сервера, отдельную миграцию запускать не нужно.
const { query } = require('../db');
const { gameSchema } = require('./games');
const { SEED } = require('../bank/seed');

async function ensure() {
  await query(`
    CREATE TABLE IF NOT EXISTS bank_items (
      id          SERIAL PRIMARY KEY,
      book        VARCHAR(40)  NOT NULL,
      unit        VARCHAR(10)  NOT NULL,
      kind        VARCHAR(10)  NOT NULL CHECK (kind IN ('task', 'game', 'theory')),
      title       VARCHAR(255) NOT NULL,
      body        TEXT,
      answer      TEXT,
      game        JSONB,
      tags        TEXT[]       NOT NULL DEFAULT '{}',
      author_id   INTEGER      REFERENCES users(id) ON DELETE SET NULL,
      seed_key    VARCHAR(80)  UNIQUE,
      hidden      BOOLEAN      NOT NULL DEFAULT false,
      uses        INTEGER      NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_bank_unit ON bank_items (book, unit) WHERE NOT hidden;
    CREATE TABLE IF NOT EXISTS bank_takes (
      item_id    INTEGER NOT NULL REFERENCES bank_items(id) ON DELETE CASCADE,
      tutor_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      library_id INTEGER REFERENCES library_items(id) ON DELETE SET NULL,
      taken_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (item_id, tutor_id)
    );
  `);
}

// Стартовые задания: добавляем новые и обновляем изменённые (по ключу), скрытые админом не трогаем
async function seed() {
  let added = 0;
  for (const s of SEED) {
    const kind = s.kind || 'game';
    const ok = kind === 'game' ? gameSchema.safeParse(s.game) : null;
    if ((kind !== 'game' && kind !== 'theory') || (kind === 'theory' && !s.body?.trim()) || (ok && !ok.success)) {
      throw new Error(`Банк: задание ${s.key} не прошло проверку: ${ok?.error?.issues[0]?.message || 'неверный материал'}`);
    }
    const { rowCount } = await query(
      `INSERT INTO bank_items (book, unit, kind, title, body, game, seed_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (seed_key) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body,
         kind = EXCLUDED.kind, game = EXCLUDED.game, book = EXCLUDED.book, unit = EXCLUDED.unit
       WHERE (bank_items.title,bank_items.body,bank_items.kind,bank_items.game,bank_items.book,bank_items.unit)
         IS DISTINCT FROM (EXCLUDED.title,EXCLUDED.body,EXCLUDED.kind,EXCLUDED.game,EXCLUDED.book,EXCLUDED.unit)`,
      [s.book, s.unit, kind, s.title, s.body || null, ok ? JSON.stringify(ok.data) : null, s.key]
    );
    added += rowCount;
  }
  if (added) console.log(`📚 Банк заданий: добавлено или обновлено ${added}`);
}

async function start() {
  try {
    await ensure();
    await seed();
  } catch (err) {
    console.error('📚 Банк заданий не запустился:', err.message);
  }
}

module.exports = { start, ensure, seed };
