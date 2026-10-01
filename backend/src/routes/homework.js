// routes/homework.js — домашние задания
const express = require('express');
const { z } = require('zod');
const { query } = require('../db');
const { requireRole, accessibleStudentIds, canAccessStudent } = require('../middleware/auth');
const { validateBody, asyncHandler } = require('../middleware/validate');
const { buildUpdate } = require('../utils');

const router = express.Router();
const tutorOnly = requireRole('tutor');

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата в формате ГГГГ-ММ-ДД');
const links = z.array(z.string().trim().url().max(1000)).max(10);

// Список ДЗ. ?student_id=5&status=assigned
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const studentId = req.query.student_id ? Number(req.query.student_id) : null;
    const status = ['assigned', 'submitted', 'checked'].includes(req.query.status) ? req.query.status : null;
    const allowed = await accessibleStudentIds(req.user);
    if (allowed !== null && studentId && !allowed.includes(studentId)) {
      return res.status(404).json({ error: 'Ученик не найден' });
    }

    const { rows } = await query(
      `SELECT h.*, s.full_name AS student_name
         FROM homework h JOIN students s ON s.id = h.student_id
        WHERE ($1::int IS NULL OR h.student_id = $1)
          AND ($2::text IS NULL OR h.status = $2)
          AND ($3::int[] IS NULL OR h.student_id = ANY($3))
        ORDER BY (h.status = 'checked'), h.due_on NULLS LAST, h.id DESC`,
      [studentId, status, allowed]
    );
    res.json(rows);
  })
);

const createSchema = z
  .object({
    student_id: z.number().int().positive(),
    lesson_id: z.number().int().positive().nullable().optional(),
    title: z.string().trim().min(1).max(255),
    description: z.string().max(5000).nullable().optional(),
    links: links.optional(),
    due_on: isoDate.nullable().optional(),
  })
  .strict();

router.post(
  '/',
  tutorOnly,
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const { rows } = await query(
      `INSERT INTO homework (student_id, lesson_id, title, description, links, due_on)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [b.student_id, b.lesson_id || null, b.title, b.description || null, b.links || [], b.due_on || null]
    );
    console.log(`✅ ДЗ «${b.title}» для ученика #${b.student_id}`);
    res.status(201).json(rows[0]);
  })
);

// Репетитор: правка, проверка (отзыв, оценка, статус checked)
const updateSchema = z
  .object({
    title: z.string().trim().min(1).max(255),
    description: z.string().max(5000).nullable(),
    links,
    due_on: isoDate.nullable(),
    status: z.enum(['assigned', 'submitted', 'checked']),
    tutor_feedback: z.string().max(5000).nullable(),
    score: z.number().int().min(0).max(100).nullable(),
  })
  .partial()
  .strict();

router.patch(
  '/:id',
  tutorOnly,
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const upd = buildUpdate('homework', Number(req.params.id), req.body);
    if (!upd) return res.status(400).json({ error: 'Нет изменений' });
    const { rows } = await query(upd.text, upd.values);
    if (!rows[0]) return res.status(404).json({ error: 'Задание не найдено' });
    console.log(`📝 ДЗ #${rows[0].id}: ${rows[0].status}`);
    res.json(rows[0]);
  })
);

// Ученик сдаёт ДЗ (пока не проверено — можно пересдать)
router.post(
  '/:id/submit',
  requireRole('student'),
  validateBody(z.object({ student_answer: z.string().trim().min(1).max(10000) }).strict()),
  asyncHandler(async (req, res) => {
    const { rows: cur } = await query('SELECT * FROM homework WHERE id = $1', [Number(req.params.id)]);
    const hw = cur[0];
    if (!hw || !(await canAccessStudent(req.user, hw.student_id))) {
      return res.status(404).json({ error: 'Задание не найдено' });
    }
    if (hw.status === 'checked') return res.status(409).json({ error: 'Задание уже проверено' });

    const { rows } = await query(
      `UPDATE homework SET student_answer = $1, status = 'submitted', submitted_at = NOW()
        WHERE id = $2 RETURNING *`,
      [req.body.student_answer, hw.id]
    );
    console.log(`📝 ДЗ #${hw.id} сдано учеником`);
    res.json(rows[0]);
  })
);

router.delete(
  '/:id',
  tutorOnly,
  asyncHandler(async (req, res) => {
    const { rows } = await query('DELETE FROM homework WHERE id = $1 RETURNING id', [Number(req.params.id)]);
    if (!rows[0]) return res.status(404).json({ error: 'Задание не найдено' });
    console.log(`🗑️ ДЗ #${rows[0].id} удалено`);
    res.json({ ok: true });
  })
);

module.exports = router;
