// services/setsync.js — слова из наборов карточек сами попадают в личный словарь ученика.
// Репетитор выдал набор (всем или выбранным ученикам) → слова появляются в «Моём словаре» с повторением.
// Каждое слово переносится один раз: если ученик удалил его из словаря, оно не вернётся.
// Таблица создаётся при первом обращении, отдельную миграцию запускать не нужно.
const { query } = require('../db');
const { addWords } = require('./vocab');

const keyOf = (term) => String(term || '').trim().toLowerCase().slice(0, 200);

let ready = null;
function ensure() {
  if (!ready) {
    ready = query(`
      CREATE TABLE IF NOT EXISTS vocab_set_sync (
        student_id INTEGER      NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        set_id     INTEGER      NOT NULL REFERENCES word_sets(id) ON DELETE CASCADE,
        term_key   VARCHAR(200) NOT NULL,
        PRIMARY KEY (student_id, set_id, term_key)
      )`).catch((err) => { ready = null; throw err; });
  }
  return ready;
}

// Перенести в словарь ученика новые слова из всех наборов, которые он видит. Возвращает, сколько слов добавилось
async function syncStudent(studentId) {
  await ensure();
  const { rows: sets } = await query(
    `SELECT ws.id, ws.words FROM word_sets ws JOIN students s ON s.tutor_id = ws.tutor_id
      WHERE s.id = $1 AND (ws.for_all OR EXISTS (SELECT 1 FROM word_set_students x WHERE x.set_id = ws.id AND x.student_id = s.id))`,
    [studentId]
  );
  if (!sets.length) return 0;
  const { rows: done } = await query('SELECT set_id, term_key FROM vocab_set_sync WHERE student_id = $1', [studentId]);
  const seen = new Set(done.map((r) => `${r.set_id}\u0001${r.term_key}`));
  let added = 0;
  for (const set of sets) {
    const fresh = (set.words || []).filter((w) => w && w.term && !seen.has(`${set.id}\u0001${keyOf(w.term)}`));
    if (!fresh.length) continue;
    added += await addWords({ query }, studentId, fresh, 'set');
    await query(
      'INSERT INTO vocab_set_sync (student_id, set_id, term_key) SELECT $1, $2, unnest($3::text[]) ON CONFLICT DO NOTHING',
      [studentId, set.id, [...new Set(fresh.map((w) => keyOf(w.term)))]]
    );
  }
  return added;
}

// После сохранения набора: перенести слова всем, кому он выдан
async function syncSet(setId) {
  const { rows } = await query(
    `SELECT s.id FROM word_sets ws JOIN students s ON s.tutor_id = ws.tutor_id AND s.status <> 'archived'
      WHERE ws.id = $1 AND (ws.for_all OR EXISTS (SELECT 1 FROM word_set_students x WHERE x.set_id = ws.id AND x.student_id = s.id))`,
    [setId]
  );
  let added = 0;
  for (const r of rows) added += await syncStudent(r.id);
  return { students: rows.length, added };
}

// Ошибка синхронизации не должна ломать основной запрос
const safe = (fn) => (...args) => fn(...args).catch((err) => { console.error('Словарь: не удалось перенести слова из наборов:', err.message); return 0; });

module.exports = { syncStudent: safe(syncStudent), syncSet: safe(syncSet), ensure };
