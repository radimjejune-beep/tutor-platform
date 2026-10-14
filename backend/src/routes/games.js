// routes/games.js — сохранение и просмотр результатов упражнений
const express = require('express');
const { z } = require('zod');
const { query } = require('../db');
const { requireRole, canAccessStudent, accessibleStudentIds } = require('../middleware/auth');
const { validateBody, asyncHandler } = require('../middleware/validate');
const { grade } = require('../services/games');
const { addWords, wordsFromMistakes } = require('../services/vocab');
const { POINTS, addPoints } = require('../services/points');
const { visibleTaskIds } = require('./library');

const router = express.Router();

// Итог HTML-урока: { correct, total, details: [{ ok, prompt, expected, given, word: { term, translation, example } }] }
const str = (v, max = 200) => (v === undefined || v === null ? null : String(v).slice(0, max));
function htmlResult(a = {}) {
  const total = Math.max(0, Math.min(1000, Math.round(Number(a.total) || 0)));
  const correct = Math.max(0, Math.min(total, Math.round(Number(a.correct) || 0)));
  const raw = Array.isArray(a.details) ? a.details.slice(0, 60) : [];
  const details = raw.map((d) => ({ ok: Boolean(d?.ok), prompt: str(d?.prompt), expected: str(d?.expected), given: str(d?.given) }));
  const words = raw
    .filter((d) => d && !d.ok && d.word && d.word.term)
    .slice(0, 20)
    .map((d) => ({ term: str(d.word.term), translation: str(d.word.translation, 300), example: str(d.word.example, 1000) }));
  return { correct, total, score: total ? Math.round((correct / total) * 100) : 0, details, words };
}

// ------------------------------------------------------------
// Ученик (или родитель за ребёнка) прошёл упражнение
// Ответы проверяются здесь, на сервере — оценка с телефона не принимается на веру
// ------------------------------------------------------------
const resultSchema = z
  .object({
    student_id: z.number().int().positive(),
    homework_id: z.number().int().positive().optional(),
    lesson_id: z.number().int().positive().optional(),
    answers: z.record(z.any()),
    duration_sec: z.number().int().min(0).max(24 * 3600).optional(),
  })
  .strict();

router.post(
  '/:itemId/results',
  requireRole('student', 'parent'),
  validateBody(resultSchema),
  asyncHandler(async (req, res) => {
    const itemId = Number(req.params.itemId);
    const b = req.body;
    if (!(await canAccessStudent(req.user, b.student_id))) return res.status(404).json({ error: 'Ученик не найден' });

    const { rows } = await query("SELECT id, kind, game FROM library_items WHERE id = $1 AND kind IN ('game', 'html')", [itemId]);
    const item = rows[0];
    if (!item || !(await visibleTaskIds(req.user)).includes(item.id)) return res.status(404).json({ error: 'Упражнение не найдено' });

    // Работа и урок должны относиться к этому ученику
    if (b.homework_id) {
      const { rows: h } = await query('SELECT 1 FROM homework WHERE id = $1 AND student_id = $2', [b.homework_id, b.student_id]);
      if (!h[0]) return res.status(400).json({ error: 'Задание не относится к ученику' });
    }
    if (b.lesson_id) {
      const { rows: l } = await query('SELECT 1 FROM lessons WHERE id = $1 AND student_id = $2', [b.lesson_id, b.student_id]);
      if (!l[0]) return res.status(400).json({ error: 'Урок не относится к ученику' });
    }

    // Упражнение проверяет сервер. HTML-урок проверяет себя сам и присылает итог
    const g = item.kind === 'game' ? grade(item.game, b.answers) : htmlResult(b.answers);
    if (!g.total) return res.status(400).json({ error: 'В результате урока нет ни одного задания' });
    const { rows: saved } = await query(
      `INSERT INTO game_results (item_id, student_id, user_id, homework_id, lesson_id, correct, total, score, details, duration_sec)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id, score, correct, total, created_at`,
      [item.id, b.student_id, req.user.id, b.homework_id || null, b.lesson_id || null, g.correct, g.total, g.score,
        JSON.stringify(g.details), b.duration_sec ?? null]
    );
    // Слова, в которых ошибся, сразу попадают в личный словарь на повторение
    let vocabAdded = 0;
    try {
      const words = item.kind === 'game' ? wordsFromMistakes(item.game, g.details) : g.words;
      vocabAdded = await addWords({ query }, b.student_id, words, 'mistake');
    } catch (err) {
      console.error('Словарь: не удалось добавить слова из ошибок:', err.message);
    }
    await addPoints(b.student_id, g.correct * POINTS.gameCorrect);
    console.log(`📝 Упражнение #${item.id}: ученик #${b.student_id}, ${g.correct}/${g.total}`);
    res.status(201).json({ ...saved[0], details: g.details, vocab_added: vocabAdded });
  })
);

// ------------------------------------------------------------
// Результаты: ?homework_id= | ?lesson_id= | ?student_id= (&item_id=)
// ------------------------------------------------------------
router.get(
  '/results',
  asyncHandler(async (req, res) => {
    const num = (v) => (v ? Number(v) : null);
    const homeworkId = num(req.query.homework_id);
    const lessonId = num(req.query.lesson_id);
    let studentId = num(req.query.student_id);
    const itemId = num(req.query.item_id);

    // Определяем ученика и проверяем доступ
    if (homeworkId) {
      const { rows } = await query('SELECT student_id FROM homework WHERE id = $1', [homeworkId]);
      studentId = rows[0]?.student_id ?? null;
    } else if (lessonId) {
      const { rows } = await query('SELECT student_id FROM lessons WHERE id = $1', [lessonId]);
      studentId = rows[0]?.student_id ?? null;
    }
    if (!studentId && req.user.role !== 'tutor') {
      const ids = await accessibleStudentIds(req.user);
      studentId = ids[0] ?? null;
    }
    if (!studentId || !(await canAccessStudent(req.user, studentId))) return res.status(404).json({ error: 'Ученик не найден' });

    const { rows } = await query(
      `SELECT r.id, r.item_id, r.student_id, r.homework_id, r.lesson_id, r.correct, r.total, r.score, r.details,
              r.duration_sec, r.created_at, i.title
         FROM game_results r JOIN library_items i ON i.id = r.item_id
        WHERE r.student_id = $1
          AND ($2::int IS NULL OR r.homework_id = $2::int)
          AND ($3::int IS NULL OR r.lesson_id = $3::int)
          AND ($4::int IS NULL OR r.item_id = $4::int)
        ORDER BY r.created_at DESC
        LIMIT 200`,
      [studentId, homeworkId, lessonId, itemId]
    );
    res.json(rows);
  })
);

module.exports = router;
