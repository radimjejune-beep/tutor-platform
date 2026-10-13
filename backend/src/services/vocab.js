// services/vocab.js — личный словарь ученика и интервальное повторение
// Коробки 0–5: «знаю» переносит слово в следующую коробку (повтор реже), «ещё учу» — обратно в 0.
const { parseGaps } = require('./games');

// Через сколько дней повторить слово из коробки N
const INTERVALS = [0, 1, 3, 7, 14, 30];

// Служебные слова, которые без соседнего слова не имеют смысла
const SHORT = new Set('a an the about at by for from in into of off on onto out over to up with'.split(' '));

const clean = (s, max) => {
  const v = String(s ?? '').replace(/\s+/g, ' ').trim();
  return v ? v.slice(0, max) : null;
};

// Добавить слова ученику. source: 'tutor' | 'unit' | 'mistake'
// Ошибка возвращает уже известное слово в начало повторения
async function addWords(db, studentId, words, source, unitId = null) {
  let added = 0;
  for (const w of words) {
    const term = clean(w.term, 200);
    if (!term) continue;
    const onConflict =
      source === 'mistake'
        ? `UPDATE SET box = 0, due_on = CURRENT_DATE, lapses = vocab_items.lapses + 1,
                      translation = COALESCE(vocab_items.translation, EXCLUDED.translation),
                      example = COALESCE(vocab_items.example, EXCLUDED.example)`
        : `UPDATE SET translation = COALESCE(EXCLUDED.translation, vocab_items.translation),
                      example = COALESCE(EXCLUDED.example, vocab_items.example),
                      unit_id = COALESCE(vocab_items.unit_id, EXCLUDED.unit_id)`;
    const { rows } = await db.query(
      `INSERT INTO vocab_items (student_id, term, translation, example, source, unit_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (student_id, lower(term)) DO ${onConflict}
       RETURNING (xmax = 0) AS inserted`,
      [studentId, term, clean(w.translation, 300), clean(w.example, 1000), source, unitId]
    );
    if (rows[0]?.inserted) added++;
  }
  return added;
}

// Предложение, в котором стоит пропуск i, с подставленными ответами
function sentenceWithGap(text, index) {
  const { parts, gaps } = parseGaps(text);
  let filled = parts[0];
  gaps.forEach((alts, i) => {
    filled += (i === index ? `\u0001${alts[0]}\u0001` : alts[0]) + parts[i + 1];
  });
  const sentence = filled.split(/(?<=[.!?])\s+|\n+/).find((s) => s.includes('\u0001')) || '';
  const m = sentence.match(/(\S+)\s*\u0001([^\u0001]*)\u0001/);
  return {
    example: sentence.replace(/\u0001/g, '').trim(),
    before: m ? m[1].replace(/[^\p{L}'-]/gu, '') : '',
  };
}

// Слова из ошибок в упражнении: «найди пару» и «вставь пропуск»
function wordsFromMistakes(game, details) {
  const out = [];
  if (!game || !Array.isArray(details)) return out;
  if (game.type === 'match') {
    details.forEach((d, i) => {
      if (!d.ok && game.pairs[i]) out.push({ term: game.pairs[i].a, translation: game.pairs[i].b });
    });
  } else if (game.type === 'gaps') {
    const { gaps } = parseGaps(game.text);
    details.forEach((d, i) => {
      if (d.ok || !gaps[i]) return;
      const answer = gaps[i][0];
      const { example, before } = sentenceWithGap(game.text, i);
      // Предлог или артикль запоминаем вместе со словом перед ним: «worried about»
      const term = SHORT.has(answer.toLowerCase()) && before ? `${before} ${answer}` : answer;
      out.push({ term, translation: null, example });
    });
  }
  return out.slice(0, 20);
}

// Ответ на карточку
async function review(db, id, known) {
  const { rows } = await db.query(
    `UPDATE vocab_items SET
        box = CASE WHEN $2::boolean THEN LEAST(box + 1, 5) ELSE 0 END,
        due_on = CURRENT_DATE + (CASE WHEN $2::boolean THEN ($3::int[])[LEAST(box + 1, 5) + 1] ELSE 0 END),
        reviews = reviews + 1,
        lapses = lapses + CASE WHEN $2::boolean THEN 0 ELSE 1 END,
        last_reviewed_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [id, known, INTERVALS]
  );
  return rows[0] || null;
}

module.exports = { addWords, wordsFromMistakes, review, INTERVALS };
