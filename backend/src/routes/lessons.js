// routes/lessons.js — расписание и проведение занятий
const express = require('express');
const { z } = require('zod');
const { query, transaction } = require('../db');
const { requireRole, accessibleStudentIds } = require('../middleware/auth');
const { validateBody, asyncHandler } = require('../middleware/validate');
const { syncLessonCharge } = require('../services/billing');
const { stripPrivate, buildUpdate } = require('../utils');

const router = express.Router();
const tutorOnly = requireRole('tutor');

const isoDateTime = z.string().datetime({ offset: true });

// ------------------------------------------------------------
// Расписание за период. Репетитор видит всех, ученик/родитель — только своих
// ?from=2026-10-01T00:00:00+03:00&to=...&student_id=5
// ------------------------------------------------------------
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const from = req.query.from || new Date(Date.now() - 7 * 864e5).toISOString();
    const to = req.query.to || new Date(Date.now() + 30 * 864e5).toISOString();
    const studentId = req.query.student_id ? Number(req.query.student_id) : null;

    const allowed = await accessibleStudentIds(req.user); // null = все
    if (allowed !== null && studentId && !allowed.includes(studentId)) {
      return res.status(404).json({ error: 'Ученик не найден' });
    }

    const { rows } = await query(
      `SELECT l.*, s.full_name AS student_name, s.board_link
         FROM lessons l JOIN students s ON s.id = l.student_id
        WHERE l.starts_at >= $1 AND l.starts_at < $2
          AND ($3::int IS NULL OR l.student_id = $3)
          AND ($4::int[] IS NULL OR l.student_id = ANY($4))
        ORDER BY l.starts_at`,
      [from, to, studentId, allowed]
    );

    const isTutor = req.user.role === 'tutor';
    res.json(isTutor ? rows : rows.map((l) => stripPrivate(l, ['private_notes'])));
  })
);

// ------------------------------------------------------------
// Создать занятие (можно сразу серию: repeat_weeks = сколько недель подряд)
// Если время пересекается с другим занятием — 409, повторить с force: true
// ------------------------------------------------------------
const createSchema = z
  .object({
    student_id: z.number().int().positive(),
    starts_at: isoDateTime,
    duration_min: z.number().int().min(15).max(240).optional(),
    price: z.number().int().min(0).max(100000).optional(),
    topic: z.string().trim().max(255).optional(),
    repeat_weeks: z.number().int().min(1).max(26).default(1),
    force: z.boolean().default(false),
  })
  .strict();

router.post(
  '/',
  tutorOnly,
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const { rows: st } = await query('SELECT * FROM students WHERE id = $1', [b.student_id]);
    const student = st[0];
    if (!student) return res.status(404).json({ error: 'Ученик не найден' });

    const duration = b.duration_min ?? student.default_duration;
    const price = b.price ?? student.default_price;
    const start = new Date(b.starts_at);
    const slots = Array.from({ length: b.repeat_weeks }, (_, i) => new Date(start.getTime() + i * 7 * 864e5));

    // Проверка пересечений с любыми запланированными/проведёнными занятиями
    if (!b.force) {
      const conflicts = [];
      for (const slot of slots) {
        const end = new Date(slot.getTime() + duration * 60000);
        const { rows } = await query(
          `SELECT l.id, l.starts_at, s.full_name AS student_name
             FROM lessons l JOIN students s ON s.id = l.student_id
            WHERE l.status IN ('scheduled', 'done')
              AND l.starts_at < $2
              AND l.starts_at + (l.duration_min || ' minutes')::interval > $1`,
          [slot.toISOString(), end.toISOString()]
        );
        conflicts.push(...rows);
      }
      if (conflicts.length) {
        return res.status(409).json({ error: 'Время пересекается с другими занятиями', conflicts });
      }
    }

    const created = await transaction(async (client) => {
      const out = [];
      for (const slot of slots) {
        const { rows } = await client.query(
          `INSERT INTO lessons (student_id, starts_at, duration_min, price, topic)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [b.student_id, slot.toISOString(), duration, price, b.topic || null]
        );
        out.push(rows[0]);
      }
      return out;
    });

    console.log(`✅ Занятий создано: ${created.length} (ученик: ${student.full_name})`);
    res.status(201).json(created);
  })
);

// ------------------------------------------------------------
// Изменить занятие: перенести, отметить проведённым/отменённым, записать итог
// Списание с абонемента пересчитывается автоматически по статусу
// ------------------------------------------------------------
const updateSchema = z
  .object({
    starts_at: isoDateTime,
    duration_min: z.number().int().min(15).max(240),
    price: z.number().int().min(0).max(100000),
    status: z.enum(['scheduled', 'done', 'cancelled', 'cancelled_late', 'missed']),
    topic: z.string().trim().max(255).nullable(),
    summary: z.string().max(5000).nullable(),
    private_notes: z.string().max(5000).nullable(),
  })
  .partial()
  .strict();

router.patch(
  '/:id',
  tutorOnly,
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);

    const lesson = await transaction(async (client) => {
      const { rows: cur } = await client.query('SELECT * FROM lessons WHERE id = $1 FOR UPDATE', [id]);
      if (!cur[0]) return null;

      const upd = buildUpdate('lessons', id, req.body);
      let updated = cur[0];
      if (upd) ({ rows: [updated] } = await client.query(upd.text, upd.values));

      return syncLessonCharge(client, updated);
    });

    if (!lesson) return res.status(404).json({ error: 'Занятие не найдено' });
    console.log(`📝 Занятие #${id}: статус ${lesson.status}${lesson.charged ? ', списано' : ''}`);
    res.json(lesson);
  })
);

// Удалить можно только несписанное занятие (иначе поменяйте статус на «отменено»)
router.delete(
  '/:id',
  tutorOnly,
  asyncHandler(async (req, res) => {
    const { rows } = await query('DELETE FROM lessons WHERE id = $1 AND NOT charged RETURNING id', [
      Number(req.params.id),
    ]);
    if (!rows[0]) return res.status(409).json({ error: 'Занятие не найдено или уже списано — смените статус на «отменено»' });
    console.log(`🗑️ Занятие #${req.params.id} удалено`);
    res.json({ ok: true });
  })
);

module.exports = router;
