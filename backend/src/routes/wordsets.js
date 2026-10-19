// routes/wordsets.js — наборы карточек (как в Quizlet)
// Репетитор собирает набор слов (можно вставить списком), выдаёт всем или выбранным ученикам.
// Ученик учит набор сам: карточки, заучивание, письмо, подбор, тест. Прогресс по каждому слову хранится.
const express = require('express');
const { z } = require('zod');
const { query } = require('../db');
const { requireRole, canAccessStudent, accessibleStudentIds } = require('../middleware/auth');
const { validateBody, asyncHandler } = require('../middleware/validate');
const { addWords } = require('../services/vocab');
const { POINTS, addPoints } = require('../services/points');

const router = express.Router();
const tutorOnly = requireRole('tutor');

const MODES = ['cards', 'learn', 'write', 'match', 'test', 'vocab'];
const keyOf = (term) => String(term || '').trim().toLowerCase().slice(0, 200);

const wordSchema = z
  .object({
    term: z.string().trim().min(1, 'Пустое слово').max(200),
    translation: z.string().trim().max(300).nullable().optional(),
    example: z.string().trim().max(1000).nullable().optional(),
  })
  .strict();
const ids = z.array(z.number().int().positive()).max(500);
const setSchema = z
  .object({
    title: z.string().trim().min(1, 'Укажите название').max(200),
    description: z.string().trim().max(2000).nullable().optional(),
    words: z.array(wordSchema).min(1, 'Добавьте хотя бы одно слово').max(500, 'Не больше 500 слов в наборе'),
    for_all: z.boolean().optional(),
    student_ids: ids.optional(),
  })
  .strict();

// Одинаковые слова в наборе оставляем один раз
function cleanWords(words) {
  const seen = new Set();
  const out = [];
  for (const w of words) {
    const k = keyOf(w.term);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push({ term: w.term.trim(), translation: w.translation?.trim() || null, example: w.example?.trim() || null });
  }
  return out;
}

// Только ученики этого репетитора
async function ownStudents(tutorId, list) {
  if (!list?.length) return [];
  const { rows } = await query('SELECT id FROM students WHERE tutor_id = $1 AND id = ANY($2::int[])', [tutorId, list]);
  return rows.map((r) => r.id);
}
async function setStudents(setId, tutorId, list) {
  const own = await ownStudents(tutorId, list);
  await query('DELETE FROM word_set_students WHERE set_id = $1', [setId]);
  if (own.length) {
    await query('INSERT INTO word_set_students (set_id, student_id) SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING', [setId, own]);
  }
}

// Ученик из ?student_id= или тела (у ученика и родителя по умолчанию первый доступный)
async function resolveStudent(req, raw) {
  let id = Number(raw) || null;
  if (!id && req.user.role !== 'tutor') id = (await accessibleStudentIds(req.user))[0] ?? null;
  if (!id || !(await canAccessStudent(req.user, id))) return null;
  return id;
}

// Набор, который видит этот ученик (или null)
async function visibleSet(setId, studentId) {
  const { rows } = await query(
    `SELECT ws.* FROM word_sets ws JOIN students s ON s.tutor_id = ws.tutor_id
      WHERE ws.id = $1 AND s.id = $2
        AND (ws.for_all OR EXISTS (SELECT 1 FROM word_set_students x WHERE x.set_id = ws.id AND x.student_id = s.id))`,
    [setId, studentId]
  );
  return rows[0] || null;
}

async function progressMap(setId, studentId) {
  const { rows } = await query('SELECT term_key, level, correct, wrong FROM word_set_progress WHERE set_id = $1 AND student_id = $2', [setId, studentId]);
  return new Map(rows.map((r) => [r.term_key, r]));
}

function summary(words, map) {
  const levels = [0, 0, 0, 0];
  for (const w of words) levels[map.get(keyOf(w.term))?.level ?? 0]++;
  return { total: words.length, new: levels[0], learning: levels[1] + levels[2], learned: levels[3] };
}

// ------------------------------------------------------------
// Репетитор: все наборы
// ------------------------------------------------------------
router.get(
  '/',
  tutorOnly,
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT ws.id, ws.title, ws.description, ws.for_all, ws.updated_at, jsonb_array_length(ws.words) AS word_count,
              COALESCE((SELECT array_agg(student_id ORDER BY student_id) FROM word_set_students WHERE set_id = ws.id), '{}') AS student_ids,
              (SELECT COUNT(DISTINCT student_id)::int FROM practice_log WHERE set_id = ws.id) AS learners,
              (SELECT MAX(created_at) FROM practice_log WHERE set_id = ws.id) AS last_practice
         FROM word_sets ws WHERE ws.tutor_id = $1 ORDER BY ws.updated_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  })
);

router.post(
  '/',
  tutorOnly,
  validateBody(setSchema),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const words = cleanWords(b.words);
    const forAll = b.for_all ?? !b.student_ids?.length;
    const { rows } = await query(
      'INSERT INTO word_sets (tutor_id, title, description, words, for_all) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [req.user.id, b.title, b.description || null, JSON.stringify(words), forAll]
    );
    if (!forAll) await setStudents(rows[0].id, req.user.id, b.student_ids);
    res.status(201).json({ id: rows[0].id, word_count: words.length });
  })
);

// ------------------------------------------------------------
// Ученик и родитель: наборы, которые можно учить, с прогрессом
// ------------------------------------------------------------
router.get(
  '/my',
  asyncHandler(async (req, res) => {
    const studentId = await resolveStudent(req, req.query.student_id);
    if (!studentId) return res.status(404).json({ error: 'Ученик не найден' });
    const { rows } = await query(
      `SELECT ws.id, ws.title, ws.description, ws.words, ws.updated_at,
              (SELECT MAX(created_at) FROM practice_log p WHERE p.set_id = ws.id AND p.student_id = s.id) AS last_practice
         FROM word_sets ws JOIN students s ON s.tutor_id = ws.tutor_id
        WHERE s.id = $1 AND (ws.for_all OR EXISTS (SELECT 1 FROM word_set_students x WHERE x.set_id = ws.id AND x.student_id = s.id))
        ORDER BY ws.updated_at DESC`,
      [studentId]
    );
    const { rows: prog } = await query('SELECT set_id, term_key, level FROM word_set_progress WHERE student_id = $1', [studentId]);
    const bySet = new Map();
    for (const p of prog) {
      if (!bySet.has(p.set_id)) bySet.set(p.set_id, new Map());
      bySet.get(p.set_id).set(p.term_key, p);
    }
    res.json(
      rows.map(({ words, ...s }) => ({ ...s, progress: summary(words, bySet.get(s.id) || new Map()) }))
    );
  })
);

// Журнал самостоятельных занятий ученика (для репетитора, ученика и родителя)
router.get(
  '/activity',
  asyncHandler(async (req, res) => {
    const studentId = await resolveStudent(req, req.query.student_id);
    if (!studentId) return res.status(404).json({ error: 'Ученик не найден' });
    const { rows } = await query(
      `SELECT id, set_id, title, mode, correct, total, duration_sec, created_at FROM practice_log
        WHERE student_id = $1 ORDER BY created_at DESC LIMIT 40`,
      [studentId]
    );
    const { rows: week } = await query(
      `SELECT COUNT(*)::int AS sessions, COALESCE(SUM(total), 0)::int AS answers, COUNT(DISTINCT created_at::date)::int AS days
         FROM practice_log WHERE student_id = $1 AND created_at > NOW() - INTERVAL '7 days'`,
      [studentId]
    );
    res.json({ items: rows, week: week[0] });
  })
);

// ------------------------------------------------------------
// Один набор: репетитору целиком со статистикой учеников, ученику со своим прогрессом
// ------------------------------------------------------------
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (req.user.role === 'tutor' && !req.query.student_id) {
      const { rows } = await query('SELECT * FROM word_sets WHERE id = $1 AND tutor_id = $2', [id, req.user.id]);
      if (!rows[0]) return res.status(404).json({ error: 'Набор не найден' });
      const set = rows[0];
      const { rows: st } = await query('SELECT student_id FROM word_set_students WHERE set_id = $1', [id]);
      // Кто из учеников занимался и сколько выучил
      const { rows: learners } = await query(
        `SELECT s.id, s.full_name,
                COUNT(p.term_key) FILTER (WHERE p.level = 3)::int AS learned,
                (SELECT MAX(created_at) FROM practice_log l WHERE l.set_id = $1 AND l.student_id = s.id) AS last_practice,
                (SELECT COUNT(*)::int FROM practice_log l WHERE l.set_id = $1 AND l.student_id = s.id) AS sessions
           FROM students s LEFT JOIN word_set_progress p ON p.student_id = s.id AND p.set_id = $1
          WHERE s.tutor_id = $2 AND (EXISTS (SELECT 1 FROM word_set_progress q WHERE q.set_id = $1 AND q.student_id = s.id)
                                     OR EXISTS (SELECT 1 FROM practice_log l WHERE l.set_id = $1 AND l.student_id = s.id))
          GROUP BY s.id ORDER BY s.full_name`,
        [id, req.user.id]
      );
      return res.json({ ...set, student_ids: st.map((r) => r.student_id), learners });
    }
    const studentId = await resolveStudent(req, req.query.student_id);
    if (!studentId) return res.status(404).json({ error: 'Ученик не найден' });
    const set = await visibleSet(id, studentId);
    if (!set) return res.status(404).json({ error: 'Набор не найден' });
    const map = await progressMap(id, studentId);
    res.json({
      id: set.id,
      title: set.title,
      description: set.description,
      words: set.words.map((w) => ({ ...w, level: map.get(keyOf(w.term))?.level ?? 0 })),
      progress: summary(set.words, map),
    });
  })
);

router.patch(
  '/:id',
  tutorOnly,
  validateBody(setSchema.partial().strict()),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { rows } = await query('SELECT id FROM word_sets WHERE id = $1 AND tutor_id = $2', [id, req.user.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Набор не найден' });
    const b = req.body;
    const sets = [];
    const vals = [];
    const push = (col, v) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
    if (b.title !== undefined) push('title', b.title);
    if (b.description !== undefined) push('description', b.description || null);
    if (b.words !== undefined) push('words', JSON.stringify(cleanWords(b.words)));
    if (b.for_all !== undefined) push('for_all', b.for_all);
    if (sets.length) {
      vals.push(id);
      await query(`UPDATE word_sets SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${vals.length}`, vals);
    }
    if (b.student_ids !== undefined) await setStudents(id, req.user.id, b.student_ids);
    res.json({ ok: true });
  })
);

router.delete(
  '/:id',
  tutorOnly,
  asyncHandler(async (req, res) => {
    const { rows } = await query('DELETE FROM word_sets WHERE id = $1 AND tutor_id = $2 RETURNING id', [Number(req.params.id), req.user.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Набор не найден' });
    res.json({ ok: true });
  })
);

// ------------------------------------------------------------
// Итог тренировки: сдвигаем прогресс по словам, пишем в журнал, начисляем очки.
// Слова с ошибками в заучивании, письме и тесте попадают в личный словарь на повторение.
// ------------------------------------------------------------
router.post(
  '/:id/progress',
  validateBody(
    z
      .object({
        student_id: z.number().int().positive(),
        mode: z.enum(MODES),
        results: z.array(z.object({ term: z.string().max(200), ok: z.boolean() }).strict()).max(1000),
        duration_sec: z.number().int().min(0).max(86400).optional(),
      })
      .strict()
  ),
  asyncHandler(async (req, res) => {
    const b = req.body;
    if (!(await canAccessStudent(req.user, b.student_id))) return res.status(404).json({ error: 'Ученик не найден' });
    const set = await visibleSet(Number(req.params.id), b.student_id);
    if (!set) return res.status(404).json({ error: 'Набор не найден' });
    const byKey = new Map(set.words.map((w) => [keyOf(w.term), w]));
    // Репетитор просто пробует набор: ничего не сохраняем
    if (req.user.role === 'tutor') {
      const ok = b.results.filter((r) => r.ok && byKey.has(keyOf(r.term))).length;
      return res.json({ saved: false, correct: ok, total: b.results.length });
    }
    // По каждому слову: верно поднимает уровень, ошибка опускает
    const agg = new Map();
    for (const r of b.results) {
      const k = keyOf(r.term);
      if (!byKey.has(k)) continue;
      const a = agg.get(k) || { ok: 0, bad: 0 };
      if (r.ok) a.ok++;
      else a.bad++;
      agg.set(k, a);
    }
    // Карточки и подбор только узнавание: они доводят слово максимум до «почти выучено».
    // «Выучено» ставят заучивание, письмо и тест, где слово нужно вспомнить самому.
    const cap = ['cards', 'match'].includes(b.mode) ? 2 : 3;
    for (const [k, a] of agg) {
      const delta = a.bad ? -1 : 1;
      await query(
        `INSERT INTO word_set_progress (set_id, student_id, term_key, level, correct, wrong)
         VALUES ($1, $2, $3, GREATEST(0, LEAST($7::int, $4::int)), $5, $6)
         ON CONFLICT (set_id, student_id, term_key) DO UPDATE
           SET level = CASE WHEN $4::int > 0 THEN GREATEST(word_set_progress.level, LEAST($7::int, word_set_progress.level + 1))
                            ELSE GREATEST(0, word_set_progress.level - 1) END,
               correct = word_set_progress.correct + EXCLUDED.correct,
               wrong = word_set_progress.wrong + EXCLUDED.wrong,
               updated_at = NOW()`,
        [set.id, b.student_id, k, delta, a.ok, a.bad, cap]
      );
    }
    const correct = b.results.filter((r) => r.ok && byKey.has(keyOf(r.term))).length;
    const total = b.results.filter((r) => byKey.has(keyOf(r.term))).length;
    if (total) {
      await query('INSERT INTO practice_log (student_id, set_id, title, mode, correct, total, duration_sec) VALUES ($1, $2, $3, $4, $5, $6, $7)', [
        b.student_id, set.id, set.title.slice(0, 200), b.mode, correct, total, b.duration_sec ?? null,
      ]);
    }
    if (['learn', 'write', 'test'].includes(b.mode)) {
      const missed = [...agg].filter(([, a]) => a.bad).map(([k]) => byKey.get(k));
      if (missed.length) await addWords({ query }, b.student_id, missed.slice(0, 30), 'mistake');
    }
    await addPoints(b.student_id, correct * POINTS.practiceCorrect);
    const map = await progressMap(set.id, b.student_id);
    res.json({ saved: true, correct, total, progress: summary(set.words, map), words: set.words.map((w) => ({ term: w.term, level: map.get(keyOf(w.term))?.level ?? 0 })) });
  })
);

// Начать набор заново
router.post(
  '/:id/reset',
  validateBody(z.object({ student_id: z.number().int().positive() }).strict()),
  asyncHandler(async (req, res) => {
    if (!(await canAccessStudent(req.user, req.body.student_id))) return res.status(404).json({ error: 'Ученик не найден' });
    if (!(await visibleSet(Number(req.params.id), req.body.student_id))) return res.status(404).json({ error: 'Набор не найден' });
    await query('DELETE FROM word_set_progress WHERE set_id = $1 AND student_id = $2', [Number(req.params.id), req.body.student_id]);
    res.json({ ok: true });
  })
);

// Перенести слова набора в личный словарь ученика (там интервальное повторение)
router.post(
  '/:id/to-vocab',
  validateBody(z.object({ student_id: z.number().int().positive() }).strict()),
  asyncHandler(async (req, res) => {
    if (!(await canAccessStudent(req.user, req.body.student_id))) return res.status(404).json({ error: 'Ученик не найден' });
    const set = await visibleSet(Number(req.params.id), req.body.student_id);
    if (!set) return res.status(404).json({ error: 'Набор не найден' });
    const added = await addWords({ query }, req.body.student_id, set.words, 'set');
    res.json({ added, total: set.words.length });
  })
);

module.exports = router;
