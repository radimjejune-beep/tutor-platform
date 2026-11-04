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
    const ok = gameSchema.safeParse(s.game);
    if (!ok.success) { console.error(`Банк: задание ${s.key} не прошло проверку:`, ok.error.issues[0]?.message); continue; }
    const { rowCount } = await query(
      `INSERT INTO bank_items (book, unit, kind, title, game, seed_key)
       VALUES ($1, $2, 'game', $3, $4, $5)
       ON CONFLICT (seed_key) DO UPDATE SET title = EXCLUDED.title, game = EXCLUDED.game, book = EXCLUDED.book, unit = EXCLUDED.unit
       WHERE bank_items.game IS DISTINCT FROM EXCLUDED.game OR bank_items.title IS DISTINCT FROM EXCLUDED.title`,
      [s.book, s.unit, s.title, JSON.stringify(ok.data), s.key]
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
