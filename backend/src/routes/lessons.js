// routes/lessons.js — расписание и проведение занятий
const express = require('express');
const { z } = require('zod');
const { query, transaction } = require('../db');
const { requireRole, accessibleStudentIds, canAccessStudent, requireOwn } = require('../middleware/auth');
const tg = require('../services/telegram');
const { validateBody, asyncHandler } = require('../middleware/validate');
const { syncLessonCharge } = require('../services/billing');
const { stripPrivate, buildUpdate } = require('../utils');
const { getUnit } = require('../services/courses');
const { finishLesson, notifyFinished } = require('../services/finish');
const notify = require('../services/notify');

const router = express.Router();
const tutorOnly = requireRole('tutor');

const isoDateTime = z.string().datetime({ offset: true });

// Все строки одного занятия: у группового — по одной на ученика
async function sameSession(lessonId) {
  const { rows } = await query(
    `SELECT x.id FROM lessons l JOIN lessons x ON x.id = l.id OR (l.group_id IS NOT NULL AND x.group_id = l.group_id AND x.starts_at = l.starts_at)
      WHERE l.id = $1`,
    [lessonId]
  );
  return rows.length ? rows.map((r) => r.id) : [lessonId];
}

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
      `SELECT l.*, s.full_name AS student_name, COALESCE(gr.board_link, s.board_link) AS board_link,
              COALESCE(l.call_link, gr.call_link, s.call_link) AS join_link, gr.name AS group_name
         FROM lessons l JOIN students s ON s.id = l.student_id LEFT JOIN groups gr ON gr.id = l.group_id
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
    const { rows: st } = await query('SELECT * FROM students WHERE id = $1 AND tutor_id = $2', [b.student_id, req.user.id]);
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
            WHERE l.status IN ('scheduled', 'done') AND s.tutor_id = $3
              AND l.starts_at < $2
              AND l.starts_at + (l.duration_min || ' minutes')::interval > $1`,
          [slot.toISOString(), end.toISOString(), req.user.id]
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
    notify.toStudent(b.student_id, created.length > 1
      ? { kind: 'lesson_new', title: `Новое расписание: ${created.length} занятий`, body: `Первое: ${notify.when(created[0].starts_at)}`, link: '/schedule' }
      : { kind: 'lesson_new', title: 'Новое занятие', body: notify.when(created[0].starts_at), link: '/schedule' });
    res.status(201).json(created);
  })
);

// ------------------------------------------------------------
// Продлить расписание: повторить последнюю неделю каждого ученика и группы ещё на N недель вперёд
// preview: true — только посчитать, ничего не создавая
// ------------------------------------------------------------
router.post(
  '/extend',
  tutorOnly,
  validateBody(z.object({ weeks: z.number().int().min(1).max(12).default(4), preview: z.boolean().default(false) }).strict()),
  asyncHandler(async (req, res) => {
    const { weeks, preview } = req.body;
    // Последняя запланированная неделя у каждого ученика (индивидуально) и у каждой группы
    const { rows: pattern } = await query(
      `WITH last AS (
         SELECT COALESCE('g' || group_id::text, 's' || student_id::text) AS owner, MAX(starts_at) AS last_at
           FROM lessons WHERE status = 'scheduled' AND starts_at > NOW()
            AND student_id IN (SELECT id FROM students WHERE tutor_id = $1)
          GROUP BY 1
       )
       SELECT DISTINCT ON (l.student_id, l.starts_at) l.student_id, l.group_id, l.starts_at, l.duration_min, l.price, l.call_link,
              s.full_name AS student_name, g.name AS group_name, last.last_at
         FROM lessons l
         JOIN last ON last.owner = COALESCE('g' || l.group_id::text, 's' || l.student_id::text)
         JOIN students s ON s.id = l.student_id AND s.status = 'active' AND s.tutor_id = $1
         LEFT JOIN groups g ON g.id = l.group_id
        WHERE l.status = 'scheduled' AND l.starts_at > last.last_at - INTERVAL '7 days'
        ORDER BY l.student_id, l.starts_at`,
      [req.user.id]
    );
    const plan = [];
    for (const p of pattern) {
      for (let w = 1; w <= weeks; w++) {
        plan.push({ ...p, starts_at: new Date(new Date(p.starts_at).getTime() + w * 7 * 864e5).toISOString() });
      }
    }
    // Не создаём то, что пересекается с уже стоящими занятиями (кроме своих же строк группы в то же время)
    const free = [];
    for (const p of plan) {
      const end = new Date(new Date(p.starts_at).getTime() + p.duration_min * 60000).toISOString();
      const { rows } = await query(
        `SELECT 1 FROM lessons
          WHERE status IN ('scheduled', 'done') AND starts_at < $2 AND starts_at + make_interval(mins => duration_min) > $1
            AND student_id IN (SELECT id FROM students WHERE tutor_id = $5)
            AND NOT ($3::int IS NOT NULL AND group_id = $3::int AND starts_at = $1::timestamptz AND student_id <> $4)
          LIMIT 1`,
        [p.starts_at, end, p.group_id, p.student_id, req.user.id]
      );
      if (!rows[0]) free.push(p);
    }
    const owners = new Set(free.map((p) => (p.group_id ? `g${p.group_id}` : `s${p.student_id}`)));
    const sessions = new Set(free.map((p) => `${p.group_id || 's' + p.student_id}|${p.starts_at}`)).size;
    if (preview) {
      return res.json({ sessions, owners: owners.size, skipped: plan.length - free.length });
    }
    await transaction(async (client) => {
      for (const p of free) {
        await client.query(
          `INSERT INTO lessons (student_id, starts_at, duration_min, price, group_id, call_link) VALUES ($1, $2, $3, $4, $5, $6)`,
          [p.student_id, p.starts_at, p.duration_min, p.price, p.group_id, p.call_link]
        );
      }
    });
    console.log(`✅ Расписание продлено: ${sessions} занятий на ${weeks} нед.`);
    res.json({ sessions, owners: owners.size, skipped: plan.length - free.length });
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
    call_link: z.string().trim().url().max(1000).nullable(),
  })
  .partial()
  .strict();

router.patch(
  '/:id',
  tutorOnly,
  requireOwn('lessons', 'id', 'Занятие не найдено'),
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);

    let prev = null;
    const lesson = await transaction(async (client) => {
      const { rows: cur } = await client.query('SELECT * FROM lessons WHERE id = $1 FOR UPDATE', [id]);
      if (!cur[0]) return null;
      prev = cur[0];

      const upd = buildUpdate('lessons', id, req.body);
      let updated = cur[0];
      if (upd) ({ rows: [updated] } = await client.query(upd.text, upd.values));

      return syncLessonCharge(client, updated);
    });

    if (!lesson) return res.status(404).json({ error: 'Занятие не найдено' });
    console.log(`📝 Занятие #${id}: статус ${lesson.status}${lesson.charged ? ', списано' : ''}`);
    if (lesson.status === 'scheduled' && new Date(prev.starts_at).getTime() !== new Date(lesson.starts_at).getTime()) {
      notify.toStudent(lesson.student_id, { kind: 'lesson_moved', title: 'Занятие перенесено', body: `${notify.when(prev.starts_at)} → ${notify.when(lesson.starts_at)}`, link: '/schedule' });
    } else if (lesson.status === 'cancelled' && prev.status === 'scheduled') {
      notify.toStudent(lesson.student_id, { kind: 'lesson_cancelled', title: 'Занятие отменено', body: notify.when(lesson.starts_at), link: '/schedule' });
    }
    res.json(lesson);
  })
);

// ------------------------------------------------------------
// Завершить урок одним действием: отметка, итог для родителей, ДЗ по юниту, следующий юнит
// ------------------------------------------------------------
const finishSchema = z
  .object({
    status: z.enum(['done', 'missed', 'cancelled_late']).default('done'),
    topic: z.string().trim().max(255).nullable().optional(),
    summary: z.string().max(5000).nullable().optional(),
    private_notes: z.string().max(5000).nullable().optional(),
    homework: z.boolean().default(false),
    due_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    next_unit: z.boolean().default(false),
  })
  .strict();

router.post(
  '/:id/finish',
  tutorOnly,
  requireOwn('lessons', 'id', 'Занятие не найдено'),
  validateBody(finishSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const b = req.body;
    const result = await transaction((client) => finishLesson(client, id, b));
    if (!result) return res.status(404).json({ error: 'Занятие не найдено' });
    notifyFinished(result);
    console.log(`✅ Урок #${id} завершён${result.assignment ? ', ДЗ выдано' : ''}${result.next_unit ? ', следующий юнит' : ''}`);
    res.json(result);
  })
);

// Удалить можно только несписанное занятие (иначе поменяйте статус на «отменено»)
router.delete(
  '/:id',
  tutorOnly,
  requireOwn('lessons', 'id', 'Занятие не найдено'),
  asyncHandler(async (req, res) => {
    const { rows } = await query('DELETE FROM lessons WHERE id = $1 AND NOT charged RETURNING id', [
      Number(req.params.id),
    ]);
    if (!rows[0]) return res.status(409).json({ error: 'Занятие не найдено или уже списано — смените статус на «отменено»' });
    console.log(`🗑️ Занятие #${req.params.id} удалено`);
    res.json({ ok: true });
  })
);

// ------------------------------------------------------------
// Комната урока: звонок, доска, задачи урока. Видят преподаватель и сам ученик / родитель
// ------------------------------------------------------------
router.get(
  '/:id/room',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT l.*, s.full_name AS student_name, COALESCE(gr.board_link, s.board_link) AS board_link,
              COALESCE(l.call_link, gr.call_link, s.call_link) AS join_link, gr.name AS group_name
         FROM lessons l JOIN students s ON s.id = l.student_id LEFT JOIN groups gr ON gr.id = l.group_id WHERE l.id = $1`,
      [Number(req.params.id)]
    );
    const l = rows[0];
    if (!l || !(await canAccessStudent(req.user, l.student_id))) return res.status(404).json({ error: 'Занятие не найдено' });

    const isTutor = req.user.role === 'tutor';
    const fields = isTutor
      ? 'i.*'
      : 'i.id, i.kind, i.subject, i.title, i.body, i.exam, i.exam_task, i.links, i.game, i.html';
    const { rows: items } = await query(
      `SELECT ${fields} FROM lesson_items li JOIN library_items i ON i.id = li.item_id
        WHERE li.lesson_id = $1 ORDER BY li.position, li.item_id`,
      [l.id]
    );
    const { rows: files } = items.length
      ? await query(
          'SELECT id, filename, mime, size_bytes, uploaded_by, created_at, library_item_id FROM files WHERE library_item_id = ANY($1) ORDER BY id',
          [items.map((i) => i.id)]
        )
      : { rows: [] };

    const { rows: st } = await query('SELECT course_unit_id FROM students WHERE id = $1', [l.student_id]);
    const unitId = l.unit_id || st[0]?.course_unit_id;
    const unit = unitId ? await getUnit({ query }, unitId) : null;

    res.json({
      ...(isTutor ? l : stripPrivate(l, ['private_notes'])),
      unit: unit && { id: unit.id, code: unit.code, title: unit.title, course_title: unit.course_title, goals: unit.goals,
        item_count: unit.item_ids.length, homework_count: unit.homework_item_ids.length, vocab_count: unit.vocab.length },
      items: items.map((i) => ({ ...i, files: files.filter((f) => f.library_item_id === i.id) })),
    });
  })
);

// Задачи урока: полный список в нужном порядке
router.put(
  '/:id/items',
  tutorOnly,
  requireOwn('lessons', 'id', 'Занятие не найдено'),
  validateBody(z.object({ item_ids: z.array(z.number().int().positive()).max(60) }).strict()),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const ids = [...new Set(req.body.item_ids)];
    // У группового занятия задачи общие: меняем их у всех учеников этого занятия
    const lessonIds = await sameSession(id);
    await transaction(async (client) => {
      for (const lid of lessonIds) {
        await client.query('DELETE FROM lesson_items WHERE lesson_id = $1', [lid]);
        for (const [pos, itemId] of ids.entries()) {
          await client.query(
            `INSERT INTO lesson_items (lesson_id, item_id, position)
             SELECT $1, $2, $3 WHERE EXISTS (SELECT 1 FROM library_items WHERE id = $2)`,
            [lid, itemId, pos]
          );
        }
      }
    });
    res.json({ ok: true, count: ids.length });
  })
);

// Итоги урока → в Telegram родителям (и взрослому ученику)
router.post(
  '/:id/send-summary',
  tutorOnly,
  requireOwn('lessons', 'id', 'Занятие не найдено'),
  asyncHandler(async (req, res) => {
    const result = await tg.sendLessonSummary(Number(req.params.id));
    if (result.error) return res.status(409).json({ error: result.error });
    res.json(result);
  })
);

module.exports = router;
module.exports.sameSession = sameSession;
