// routes/vocab.js — личный словарь ученика
// Ученик и родитель видят и повторяют слова своего ребёнка, преподаватель ещё и добавляет/правит
const express = require('express');
const { z } = require('zod');
const { query } = require('../db');
const { requireRole, canAccessStudent, accessibleStudentIds, requireOwn } = require('../middleware/auth');
const { validateBody, asyncHandler } = require('../middleware/validate');
const { addWords, review } = require('../services/vocab');
const { POINTS, addPoints } = require('../services/points');
const { buildUpdate } = require('../utils');

const router = express.Router();
const tutorOnly = requireRole('tutor');

// Ученик из ?student_id= (у ученика/родителя по умолчанию — первый доступный)
async function resolveStudent(req) {
  let id = Number(req.query.student_id) || null;
  if (!id && req.user.role !== 'tutor') id = (await accessibleStudentIds(req.user))[0] ?? null;
  if (!id || !(await canAccessStudent(req.user, id))) return null;
  return id;
}

// ------------------------------------------------------------
// Весь словарь со статистикой. ?student_id=
// ------------------------------------------------------------
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const studentId = await resolveStudent(req);
    if (!studentId) return res.status(404).json({ error: 'Ученик не найден' });
    const { rows: items } = await query(
      `SELECT v.*, u.code AS unit_code, u.title AS unit_title
         FROM vocab_items v LEFT JOIN course_units u ON u.id = v.unit_id
        WHERE v.student_id = $1
        ORDER BY v.due_on, v.box, v.created_at DESC`,
      [studentId]
    );
    const today = (await query('SELECT CURRENT_DATE::text AS d')).rows[0].d;
    res.json({
      student_id: studentId,
      items,
      stats: {
        total: items.length,
        due: items.filter((i) => i.due_on <= today).length,
        learned: items.filter((i) => i.box >= 4).length,
        from_mistakes: items.filter((i) => i.source === 'mistake').length,
      },
    });
  })
);

// Слова на сегодня (сначала новые и забытые)
router.get(
  '/due',
  asyncHandler(async (req, res) => {
    const studentId = await resolveStudent(req);
    if (!studentId) return res.status(404).json({ error: 'Ученик не найден' });
    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const { rows } = await query(
      `SELECT id, term, translation, example, box, source FROM vocab_items
        WHERE student_id = $1 AND due_on <= CURRENT_DATE
        ORDER BY box, lapses DESC, due_on, random()
        LIMIT $2`,
      [studentId, limit]
    );
    res.json(rows);
  })
);

// ------------------------------------------------------------
// Отработка слов: набор слов для упражнений (сначала забытые и ошибки, потом слова текущего юнита)
// ?student_id=&count=
// ------------------------------------------------------------
router.get(
  '/practice',
  asyncHandler(async (req, res) => {
    const studentId = await resolveStudent(req);
    if (!studentId) return res.status(404).json({ error: 'Ученик не найден' });
    const count = Math.min(Math.max(Number(req.query.count) || 12, 4), 30);
    const { rows } = await query(
      `SELECT v.id, v.term, v.translation, v.example, v.box, v.source
         FROM vocab_items v LEFT JOIN students s ON s.id = v.student_id
        WHERE v.student_id = $1
        ORDER BY (v.due_on <= CURRENT_DATE) DESC,
                 (v.source = 'mistake' AND v.box = 0) DESC,
                 (v.unit_id IS NOT NULL AND v.unit_id = s.course_unit_id) DESC,
                 v.box, random()
        LIMIT $2`,
      [studentId, count]
    );
    // Для вариантов ответа нужны «чужие» переводы
    const { rows: pool } = await query(
      `SELECT term, translation FROM vocab_items WHERE student_id = $1 AND translation IS NOT NULL ORDER BY random() LIMIT 40`,
      [studentId]
    );
    res.json({ words: rows, pool });
  })
);

// Итог отработки: каждое слово сдвигается в повторении, результат сохраняется в ДЗ
router.post(
  '/practice',
  validateBody(
    z
      .object({
        student_id: z.number().int().positive(),
        homework_id: z.number().int().positive().optional(),
        lesson_id: z.number().int().positive().optional(), // разминка перед этим уроком
        results: z.array(z.object({ id: z.number().int().positive(), ok: z.boolean() }).strict()).min(1).max(500),
        mode: z.enum(['vocab', 'cards', 'learn', 'write', 'match', 'test']).optional(),
        duration_sec: z.number().int().min(0).max(86400).optional(),
      })
      .strict()
  ),
  asyncHandler(async (req, res) => {
    const b = req.body;
    if (!(await canAccessStudent(req.user, b.student_id))) return res.status(404).json({ error: 'Ученик не найден' });
    const seen = new Set();
    let correct = 0;
    const missed = [];
    for (const r of b.results) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      const { rows } = await query('SELECT term FROM vocab_items WHERE id = $1 AND student_id = $2', [r.id, b.student_id]);
      if (!rows[0]) continue;
      await review({ query }, r.id, r.ok);
      if (r.ok) correct++;
      else missed.push(rows[0].term);
    }
    const result = { correct, total: seen.size, missed: missed.slice(0, 20), at: new Date().toISOString() };
    if (req.user.role !== 'tutor' && seen.size) {
      const title = b.homework_id ? 'Словарь в домашнем задании' : b.lesson_id ? 'Разминка перед уроком' : 'Мой словарь';
      await query('INSERT INTO practice_log (student_id, title, mode, correct, total, duration_sec) VALUES ($1, $2, $3, $4, $5, $6)', [
        b.student_id, title, b.mode || 'vocab', correct, seen.size, b.duration_sec ?? null,
      ]).catch((err) => console.error('Журнал тренировок:', err.message));
    }
    if (req.user.role !== 'tutor') {
      if (b.homework_id) {
        await query('UPDATE homework SET vocab_result = $1 WHERE id = $2 AND student_id = $3', [JSON.stringify(result), b.homework_id, b.student_id]);
      }
      if (b.lesson_id) {
        await query("UPDATE lessons SET warmup_result = $1 WHERE id = $2 AND student_id = $3 AND status = 'scheduled'", [
          JSON.stringify(result), b.lesson_id, b.student_id,
        ]);
      }
      await addPoints(b.student_id, correct * POINTS.practiceCorrect);
    }
    res.json(result);
  })
);

// Ответ на карточку: знаю / ещё учу
router.post(
  '/:id/review',
  validateBody(z.object({ known: z.boolean() }).strict()),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { rows } = await query('SELECT student_id FROM vocab_items WHERE id = $1', [id]);
    if (!rows[0] || !(await canAccessStudent(req.user, rows[0].student_id))) return res.status(404).json({ error: 'Слово не найдено' });
    const updated = await review({ query }, id, req.body.known);
    if (req.user.role !== 'tutor') await addPoints(rows[0].student_id, POINTS.review);
    res.json(updated);
  })
);

// ------------------------------------------------------------
// Преподаватель: добавить слова (списком), поправить, удалить
// ------------------------------------------------------------
const wordSchema = z
  .object({
    term: z.string().trim().min(1, 'Пустое слово').max(200),
    translation: z.string().trim().max(300).nullable().optional(),
    example: z.string().trim().max(1000).nullable().optional(),
  })
  .strict();

router.post(
  '/',
  tutorOnly,
  validateBody(z.object({ student_id: z.number().int().positive(), items: z.array(wordSchema).min(1).max(300) }).strict()),
  asyncHandler(async (req, res) => {
    const { rows } = await query('SELECT id FROM students WHERE id = $1 AND tutor_id = $2', [req.body.student_id, req.user.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Ученик не найден' });
    const added = await addWords({ query }, req.body.student_id, req.body.items, 'tutor');
    res.status(201).json({ added, total: req.body.items.length });
  })
);

// Ученик (или родитель) добавляет свои слова: вставкой списком, как в Quizlet
router.post(
  '/mine',
  validateBody(z.object({ student_id: z.number().int().positive(), items: z.array(wordSchema).min(1).max(300) }).strict()),
  asyncHandler(async (req, res) => {
    if (!(await canAccessStudent(req.user, req.body.student_id))) return res.status(404).json({ error: 'Ученик не найден' });
    const added = await addWords({ query }, req.body.student_id, req.body.items, req.user.role === 'tutor' ? 'tutor' : 'self');
    res.status(201).json({ added, total: req.body.items.length });
  })
);

// Ученик может удалить слово, которое добавил сам
router.delete(
  '/mine/:id',
  asyncHandler(async (req, res) => {
    const { rows } = await query('SELECT student_id, source FROM vocab_items WHERE id = $1', [Number(req.params.id)]);
    if (!rows[0] || !(await canAccessStudent(req.user, rows[0].student_id))) return res.status(404).json({ error: 'Слово не найдено' });
    if (req.user.role !== 'tutor' && rows[0].source !== 'self') return res.status(403).json({ error: 'Это слово добавил преподаватель, удалить его может только он' });
    await query('DELETE FROM vocab_items WHERE id = $1', [Number(req.params.id)]);
    res.json({ ok: true });
  })
);

router.patch(
  '/:id',
  tutorOnly,
  requireOwn('vocab_items', 'id', 'Слово не найдено'),
  validateBody(
    z
      .object({
        term: z.string().trim().min(1).max(200),
        translation: z.string().trim().max(300).nullable(),
        example: z.string().trim().max(1000).nullable(),
        reset: z.boolean(),
      })
      .partial()
      .strict()
  ),
  asyncHandler(async (req, res) => {
    const { reset, ...data } = req.body;
    if (reset) Object.assign(data, { box: 0, due_on: new Date().toISOString().slice(0, 10) });
    const upd = buildUpdate('vocab_items', Number(req.params.id), data);
    if (!upd) return res.status(400).json({ error: 'Нечего менять' });
    try {
      const { rows } = await query(upd.text, upd.values);
      if (!rows[0]) return res.status(404).json({ error: 'Слово не найдено' });
      res.json(rows[0]);
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Такое слово уже есть в словаре' });
      throw err;
    }
  })
);

router.delete(
  '/:id',
  tutorOnly,
  requireOwn('vocab_items', 'id', 'Слово не найдено'),
  asyncHandler(async (req, res) => {
    const { rows } = await query('DELETE FROM vocab_items WHERE id = $1 RETURNING id', [Number(req.params.id)]);
    if (!rows[0]) return res.status(404).json({ error: 'Слово не найдено' });
    res.json({ ok: true });
  })
);

module.exports = router;
