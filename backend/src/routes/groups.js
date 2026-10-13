// routes/groups.js — группы: состав, групповые занятия, перенос и завершение для всех сразу
// Групповое занятие хранится как отдельная строка lessons у каждого ученика (общие group_id и время)
const express = require('express');
const { z } = require('zod');
const { query, transaction } = require('../db');
const { requireRole, requireOwn } = require('../middleware/auth');
const { validateBody, asyncHandler } = require('../middleware/validate');
const { buildUpdate } = require('../utils');
const { finishLesson, notifyFinished } = require('../services/finish');
const notify = require('../services/notify');

const router = express.Router();
router.use(requireRole('tutor'));
// Любой путь с :id — только своя группа
router.param('id', (req, res, next, id) =>
  requireOwn('groups', 'id', 'Группа не найдена')(req, res, next));

const iso = z.string().datetime({ offset: true });
const fields = {
  name: z.string().trim().min(1, 'Название не может быть пустым').max(255),
  level: z.string().trim().max(50).nullable(),
  default_price: z.number().int().min(0).max(100000),
  default_duration: z.number().int().min(15).max(240),
  call_link: z.string().trim().url().max(1000).nullable(),
  board_link: z.string().trim().url().max(1000).nullable(),
  notes: z.string().max(5000).nullable(),
  status: z.enum(['active', 'archived']),
};

const MEMBERS = `COALESCE((SELECT json_agg(json_build_object('id', s.id, 'full_name', s.full_name, 'level', s.level) ORDER BY s.full_name)
                   FROM group_members m JOIN students s ON s.id = m.student_id WHERE m.group_id = g.id), '[]') AS members`;

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const status = req.query.status === 'archived' ? 'archived' : 'active';
    const { rows } = await query(
      `SELECT g.*, ${MEMBERS},
              (SELECT MIN(l.starts_at) FROM lessons l WHERE l.group_id = g.id AND l.status = 'scheduled' AND l.starts_at >= NOW()) AS next_lesson_at
         FROM groups g WHERE g.status = $1 AND g.tutor_id = $2 ORDER BY g.name`,
      [status, req.user.id]
    );
    res.json(rows);
  })
);

router.post(
  '/',
  validateBody(z.object({ ...fields, student_ids: z.array(z.number().int().positive()).max(30) }).partial().required({ name: true }).strict()),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const group = await transaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO groups (name, level, default_price, default_duration, call_link, board_link, notes, tutor_id)
         VALUES ($1, $2, COALESCE($3, 0), COALESCE($4, 60), $5, $6, $7, $8) RETURNING *`,
        [b.name, b.level || null, b.default_price ?? null, b.default_duration ?? null, b.call_link || null, b.board_link || null, b.notes || null, req.user.id]
      );
      for (const sid of new Set(b.student_ids || [])) {
        await client.query(
          'INSERT INTO group_members (group_id, student_id) SELECT $1, $2 WHERE EXISTS (SELECT 1 FROM students WHERE id = $2 AND tutor_id = $3) ON CONFLICT DO NOTHING',
          [rows[0].id, sid, req.user.id]
        );
      }
      return rows[0];
    });
    console.log(`✅ Группа «${group.name}» создана`);
    res.status(201).json(group);
  })
);

// Группа: состав и занятия (ближайшие и последние)
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { rows } = await query(`SELECT g.*, ${MEMBERS} FROM groups g WHERE g.id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Группа не найдена' });
    const { rows: lessons } = await query(
      `SELECT l.starts_at, MIN(l.duration_min) AS duration_min, MIN(l.topic) AS topic, MIN(l.summary) AS summary,
              json_agg(json_build_object('lesson_id', l.id, 'student_id', l.student_id, 'student_name', s.full_name, 'status', l.status)
                       ORDER BY s.full_name) AS students
         FROM lessons l JOIN students s ON s.id = l.student_id
        WHERE l.group_id = $1 AND l.status <> 'cancelled'
          AND l.starts_at >= NOW() - INTERVAL '30 days'
        GROUP BY l.starts_at
        ORDER BY l.starts_at
        LIMIT 40`,
      [id]
    );
    res.json({ ...rows[0], lessons });
  })
);

router.patch(
  '/:id',
  validateBody(z.object(fields).partial().strict()),
  asyncHandler(async (req, res) => {
    const upd = buildUpdate('groups', Number(req.params.id), req.body);
    if (!upd) return res.status(400).json({ error: 'Нечего менять' });
    const { rows } = await query(upd.text, upd.values);
    if (!rows[0]) return res.status(404).json({ error: 'Группа не найдена' });
    res.json(rows[0]);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { rows } = await query('DELETE FROM groups WHERE id = $1 RETURNING name', [Number(req.params.id)]);
    if (!rows[0]) return res.status(404).json({ error: 'Группа не найдена' });
    res.json({ ok: true });
  })
);

// Состав. Новичок получает и будущие занятия группы
router.post(
  '/:id/members',
  validateBody(z.object({ student_id: z.number().int().positive() }).strict()),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const sid = req.body.student_id;
    const added = await transaction(async (client) => {
      const { rowCount } = await client.query(
        `INSERT INTO group_members (group_id, student_id)
         SELECT $1, $2 WHERE EXISTS (SELECT 1 FROM groups WHERE id = $1) AND EXISTS (SELECT 1 FROM students WHERE id = $2 AND tutor_id = $3)
         ON CONFLICT DO NOTHING`,
        [id, sid, req.user.id]
      );
      if (!rowCount) return 0;
      const { rows } = await client.query(
        `INSERT INTO lessons (student_id, starts_at, duration_min, price, topic, group_id, call_link)
         SELECT $2, t.starts_at, t.duration_min, g.default_price, t.topic, $1, g.call_link
           FROM (SELECT starts_at, MIN(duration_min) AS duration_min, MIN(topic) AS topic FROM lessons
                  WHERE group_id = $1 AND status = 'scheduled' AND starts_at > NOW() GROUP BY starts_at) t
           JOIN groups g ON g.id = $1
          WHERE NOT EXISTS (SELECT 1 FROM lessons x WHERE x.group_id = $1 AND x.student_id = $2 AND x.starts_at = t.starts_at)
         RETURNING id`,
        [id, sid]
      );
      return rows.length + 1;
    });
    res.json({ ok: true, added: Math.max(0, added - 1) });
  })
);

// Выход из группы: будущие несписанные занятия группы у ученика удаляются
router.delete(
  '/:id/members/:sid',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const sid = Number(req.params.sid);
    await transaction(async (client) => {
      await client.query('DELETE FROM group_members WHERE group_id = $1 AND student_id = $2', [id, sid]);
      await client.query(
        "DELETE FROM lessons WHERE group_id = $1 AND student_id = $2 AND status = 'scheduled' AND NOT charged AND starts_at > NOW()",
        [id, sid]
      );
    });
    res.json({ ok: true });
  })
);

// ------------------------------------------------------------
// Групповые занятия
// ------------------------------------------------------------
router.post(
  '/:id/lessons',
  validateBody(
    z
      .object({
        starts_at: iso,
        duration_min: z.number().int().min(15).max(240).optional(),
        price: z.number().int().min(0).max(100000).optional(),
        topic: z.string().trim().max(255).optional(),
        repeat_weeks: z.number().int().min(1).max(26).default(1),
      })
      .strict()
  ),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const b = req.body;
    const { rows: g } = await query(`SELECT g.*, ${MEMBERS} FROM groups g WHERE g.id = $1`, [id]);
    const group = g[0];
    if (!group) return res.status(404).json({ error: 'Группа не найдена' });
    if (!group.members.length) return res.status(400).json({ error: 'В группе пока нет учеников' });
    const duration = b.duration_min ?? group.default_duration;
    const price = b.price ?? group.default_price;
    const start = new Date(b.starts_at);
    const slots = Array.from({ length: b.repeat_weeks }, (_, i) => new Date(start.getTime() + i * 7 * 864e5));

    const count = await transaction(async (client) => {
      let n = 0;
      for (const slot of slots) {
        for (const m of group.members) {
          await client.query(
            `INSERT INTO lessons (student_id, starts_at, duration_min, price, topic, group_id, call_link)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [m.id, slot.toISOString(), duration, price, b.topic || null, id, group.call_link]
          );
          n++;
        }
      }
      return n;
    });
    console.log(`✅ Группа «${group.name}»: занятий ${slots.length}`);
    for (const m of group.members) {
      notify.toStudent(m.id, {
        kind: 'lesson_new',
        title: slots.length > 1 ? `Расписание группы «${group.name}»: ${slots.length} занятий` : `Занятие группы «${group.name}»`,
        body: `${slots.length > 1 ? 'Первое: ' : ''}${notify.when(slots[0])}`,
        link: '/schedule',
      });
    }
    res.status(201).json({ created: count, sessions: slots.length });
  })
);

// Перенести групповое занятие для всех
router.post(
  '/:id/lessons/move',
  validateBody(z.object({ from: iso, to: iso }).strict()),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { rows } = await query(
      `UPDATE lessons SET starts_at = $3 WHERE group_id = $1 AND starts_at = $2 AND status = 'scheduled' RETURNING student_id`,
      [id, req.body.from, req.body.to]
    );
    if (!rows.length) return res.status(404).json({ error: 'Занятие не найдено или уже проведено' });
    for (const r of rows) {
      notify.toStudent(r.student_id, { kind: 'lesson_moved', title: 'Занятие группы перенесено', body: `${notify.when(req.body.from)} → ${notify.when(req.body.to)}`, link: '/schedule' });
    }
    res.json({ moved: rows.length });
  })
);

// Отменить групповое занятие для всех
router.post(
  '/:id/lessons/cancel',
  validateBody(z.object({ starts_at: iso }).strict()),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `UPDATE lessons SET status = 'cancelled' WHERE group_id = $1 AND starts_at = $2 AND status = 'scheduled' AND NOT charged RETURNING student_id`,
      [Number(req.params.id), req.body.starts_at]
    );
    for (const r of rows) notify.toStudent(r.student_id, { kind: 'lesson_cancelled', title: 'Занятие группы отменено', body: notify.when(req.body.starts_at), link: '/schedule' });
    res.json({ cancelled: rows.length });
  })
);

// Завершить групповое занятие: у каждого своя отметка (был / не был), общий итог и ДЗ
router.post(
  '/:id/lessons/finish',
  validateBody(
    z
      .object({
        starts_at: iso,
        attendance: z.record(z.enum(['done', 'missed', 'cancelled_late'])),
        topic: z.string().trim().max(255).nullable().optional(),
        summary: z.string().max(5000).nullable().optional(),
        private_notes: z.string().max(5000).nullable().optional(),
        homework: z.boolean().default(false),
        due_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        next_unit: z.boolean().default(false),
      })
      .strict()
  ),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const b = req.body;
    const { rows: ls } = await query('SELECT id, student_id FROM lessons WHERE group_id = $1 AND starts_at = $2', [id, b.starts_at]);
    if (!ls.length) return res.status(404).json({ error: 'Занятие не найдено' });
    const results = await transaction(async (client) => {
      const out = [];
      for (const l of ls) {
        const status = b.attendance[l.student_id] || 'done';
        out.push(await finishLesson(client, l.id, { ...b, status }));
      }
      return out;
    });
    results.forEach(notifyFinished);
    console.log(`✅ Групповое занятие (группа #${id}) завершено: ${results.length} уч.`);
    res.json({ finished: results.length, homework: results.filter((r) => r.assignment).length });
  })
);

module.exports = router;
