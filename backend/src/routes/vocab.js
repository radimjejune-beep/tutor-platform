// routes/vocab.js — личный словарь ученика
// Ученик и родитель видят и повторяют слова своего ребёнка, преподаватель ещё и добавляет/правит
const express = require('express');
const { z } = require('zod');
const { query } = require('../db');
const { requireRole, canAccessStudent, accessibleStudentIds } = require('../middleware/auth');
const { validateBody, asyncHandler } = require('../middleware/validate');
const { addWords, review } = require('../services/vocab');
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

// Ответ на карточку: знаю / ещё учу
router.post(
  '/:id/review',
  validateBody(z.object({ known: z.boolean() }).strict()),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { rows } = await query('SELECT student_id FROM vocab_items WHERE id = $1', [id]);
    if (!rows[0] || !(await canAccessStudent(req.user, rows[0].student_id))) return res.status(404).json({ error: 'Слово не найдено' });
    res.json(await review({ query }, id, req.body.known));
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
    const { rows } = await query('SELECT id FROM students WHERE id = $1', [req.body.student_id]);
    if (!rows[0]) return res.status(404).json({ error: 'Ученик не найден' });
    const added = await addWords({ query }, req.body.student_id, req.body.items, 'tutor');
    res.status(201).json({ added, total: req.body.items.length });
  })
);

router.patch(
  '/:id',
  tutorOnly,
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
  asyncHandler(async (req, res) => {
    const { rows } = await query('DELETE FROM vocab_items WHERE id = $1 RETURNING id', [Number(req.params.id)]);
    if (!rows[0]) return res.status(404).json({ error: 'Слово не найдено' });
    res.json({ ok: true });
  })
);

module.exports = router;
