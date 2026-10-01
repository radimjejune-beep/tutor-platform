// routes/booking.js — самостоятельная запись, перенос и отмена занятий
// Правила: записаться и перенести — через запрос, который подтверждает преподаватель;
// отменить без списания — не позже чем за notice_hours; позже — только через преподавателя.
const express = require('express');
const { z } = require('zod');
const { query, transaction } = require('../db');
const { requireRole, accessibleStudentIds, canAccessStudent } = require('../middleware/auth');
const { validateBody, asyncHandler } = require('../middleware/validate');
const { DEFAULTS, getBookingSettings, freeSlots } = require('../services/booking');

const router = express.Router();
const tutorOnly = requireRole('tutor');
const clientOnly = requireRole('student', 'parent');

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Время в формате ЧЧ:ММ');

// ------------------------------------------------------------
// Настройки и окна доступности (преподаватель)
// ------------------------------------------------------------
router.get(
  '/settings',
  tutorOnly,
  asyncHandler(async (req, res) => {
    const settings = await getBookingSettings();
    const { rows: windows } = await query(
      "SELECT id, weekday, to_char(starts, 'HH24:MI') AS starts, to_char(ends, 'HH24:MI') AS ends FROM availability ORDER BY weekday, starts"
    );
    res.json({ ...settings, windows });
  })
);

const settingsSchema = z
  .object({
    enabled: z.boolean(),
    notice_hours: z.number().int().min(1).max(168),
    horizon_days: z.number().int().min(1).max(90),
    step_min: z.union([z.literal(15), z.literal(30), z.literal(60)]),
    closed_dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(200),
    windows: z
      .array(z.object({ weekday: z.number().int().min(1).max(7), starts: hhmm, ends: hhmm }).strict())
      .max(70)
      .refine((ws) => ws.every((w) => w.ends > w.starts), 'Конец окна должен быть позже начала'),
  })
  .strict();

router.put(
  '/settings',
  tutorOnly,
  validateBody(settingsSchema),
  asyncHandler(async (req, res) => {
    const { windows, ...settings } = req.body;
    await transaction(async (client) => {
      await client.query(
        `INSERT INTO settings (key, value) VALUES ('booking', $1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [JSON.stringify({ ...DEFAULTS, ...settings })]
      );
      await client.query('DELETE FROM availability');
      for (const w of windows) {
        await client.query('INSERT INTO availability (weekday, starts, ends) VALUES ($1, $2, $3)', [w.weekday, w.starts, w.ends]);
      }
    });
    console.log(`📝 Настройки записи: ${settings.enabled ? 'включена' : 'выключена'}, окон ${windows.length}`);
    res.json({ ok: true });
  })
);

// Правила для кабинета ученика
router.get(
  '/info',
  asyncHandler(async (req, res) => {
    const s = await getBookingSettings();
    res.json({ enabled: s.enabled, notice_hours: s.notice_hours });
  })
);

// ------------------------------------------------------------
// Свободные окна для ученика (его длительность занятия)
// ?student_id=5&lesson_id=12 (lesson_id — если переносим)
// ------------------------------------------------------------
router.get(
  '/slots',
  asyncHandler(async (req, res) => {
    const studentId = Number(req.query.student_id);
    if (!Number.isInteger(studentId) || !(await canAccessStudent(req.user, studentId))) {
      return res.status(404).json({ error: 'Ученик не найден' });
    }
    const s = await getBookingSettings();
    if (!s.enabled && req.user.role !== 'tutor') return res.json({ enabled: false, slots: [] });

    const { rows } = await query('SELECT default_duration FROM students WHERE id = $1', [studentId]);
    let duration = rows[0].default_duration;
    let exceptLessonId = null;
    if (req.query.lesson_id) {
      const { rows: l } = await query('SELECT id, duration_min FROM lessons WHERE id = $1 AND student_id = $2', [
        Number(req.query.lesson_id),
        studentId,
      ]);
      if (!l[0]) return res.status(404).json({ error: 'Занятие не найдено' });
      duration = l[0].duration_min;
      exceptLessonId = l[0].id;
    }
    const slots = await freeSlots({ query }, { durationMin: duration, exceptLessonId });
    res.json({ enabled: s.enabled, duration_min: duration, slots });
  })
);

// ------------------------------------------------------------
// Запросы на запись / перенос
// ------------------------------------------------------------
router.get(
  '/requests',
  asyncHandler(async (req, res) => {
    const allowed = await accessibleStudentIds(req.user);
    const status = ['pending', 'approved', 'declined', 'withdrawn'].includes(req.query.status) ? req.query.status : null;
    const { rows } = await query(
      `SELECT r.*, s.full_name AS student_name, l.starts_at AS lesson_starts_at
         FROM booking_requests r
         JOIN students s ON s.id = r.student_id
         LEFT JOIN lessons l ON l.id = r.lesson_id
        WHERE ($1::int[] IS NULL OR r.student_id = ANY($1))
          AND ($2::text IS NULL OR r.status = $2)
          AND (r.status = 'pending' OR r.decided_at > NOW() - INTERVAL '14 days')
        ORDER BY (r.status = 'pending') DESC, r.starts_at`,
      [allowed, status]
    );
    res.json(rows);
  })
);

const requestSchema = z
  .object({
    student_id: z.number().int().positive(),
    kind: z.enum(['book', 'reschedule']),
    lesson_id: z.number().int().positive().optional(),
    starts_at: z.string().datetime({ offset: true }),
    comment: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine((b) => b.kind === 'book' || b.lesson_id, 'Укажите занятие для переноса');

router.post(
  '/requests',
  clientOnly,
  validateBody(requestSchema),
  asyncHandler(async (req, res) => {
    const b = req.body;
    if (!(await canAccessStudent(req.user, b.student_id))) return res.status(404).json({ error: 'Ученик не найден' });
    const s = await getBookingSettings();
    if (!s.enabled) return res.status(409).json({ error: 'Самостоятельная запись сейчас выключена' });

    const result = await transaction(async (client) => {
      // Не даём двум запросам занять одно время одновременно
      await client.query('LOCK TABLE booking_requests IN SHARE ROW EXCLUSIVE MODE');

      const { rows: st } = await client.query('SELECT default_duration FROM students WHERE id = $1', [b.student_id]);
      let duration = st[0].default_duration;

      if (b.kind === 'reschedule') {
        const { rows: l } = await client.query(
          `SELECT id, duration_min, status, starts_at,
                  starts_at - NOW() >= make_interval(hours => $3::int) AS in_time
             FROM lessons WHERE id = $1 AND student_id = $2`,
          [b.lesson_id, b.student_id, s.notice_hours]
        );
        const lesson = l[0];
        if (!lesson || lesson.status !== 'scheduled') return { status: 404, error: 'Занятие не найдено' };
        if (!lesson.in_time) {
          return { status: 409, error: `До занятия меньше ${s.notice_hours} ч. Перенести можно только через преподавателя` };
        }
        const { rows: dup } = await client.query(
          "SELECT 1 FROM booking_requests WHERE lesson_id = $1 AND status = 'pending'",
          [lesson.id]
        );
        if (dup[0]) return { status: 409, error: 'Запрос на перенос этого занятия уже отправлен' };
        duration = lesson.duration_min;
      } else {
        const { rows: cnt } = await client.query(
          "SELECT COUNT(*)::int AS n FROM booking_requests WHERE student_id = $1 AND status = 'pending' AND kind = 'book'",
          [b.student_id]
        );
        if (cnt[0].n >= 5) return { status: 409, error: 'Уже есть 5 запросов на рассмотрении. Дождитесь ответа преподавателя' };
      }

      const ok = await freeSlots(client, {
        durationMin: duration,
        exceptLessonId: b.lesson_id || null,
        exactStart: b.starts_at,
      });
      if (!ok.length) return { status: 409, error: 'Это время уже занято или недоступно. Выберите другое' };

      const { rows } = await client.query(
        `INSERT INTO booking_requests (student_id, kind, lesson_id, starts_at, duration_min, comment, requested_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [b.student_id, b.kind, b.lesson_id || null, b.starts_at, duration, b.comment || null, req.user.id]
      );
      return { request: rows[0] };
    });

    if (result.error) return res.status(result.status).json({ error: result.error });
    console.log(`📝 Запрос на ${b.kind === 'book' ? 'запись' : 'перенос'} (ученик #${b.student_id})`);
    res.status(201).json(result.request);
  })
);

// Ученик отзывает свой запрос
router.post(
  '/requests/:id/withdraw',
  clientOnly,
  asyncHandler(async (req, res) => {
    const { rows } = await query("SELECT * FROM booking_requests WHERE id = $1 AND status = 'pending'", [Number(req.params.id)]);
    if (!rows[0] || !(await canAccessStudent(req.user, rows[0].student_id))) {
      return res.status(404).json({ error: 'Запрос не найден' });
    }
    await query("UPDATE booking_requests SET status = 'withdrawn', decided_at = NOW() WHERE id = $1", [rows[0].id]);
    res.json({ ok: true });
  })
);

// Преподаватель подтверждает: создаётся занятие или переносится существующее
router.post(
  '/requests/:id/approve',
  tutorOnly,
  asyncHandler(async (req, res) => {
    const result = await transaction(async (client) => {
      const { rows } = await client.query(
        "SELECT * FROM booking_requests WHERE id = $1 AND status = 'pending' FOR UPDATE",
        [Number(req.params.id)]
      );
      const r = rows[0];
      if (!r) return { status: 404, error: 'Запрос не найден или уже рассмотрен' };

      // Время всё ещё свободно? (кроме самого переносимого занятия)
      const { rows: clash } = await client.query(
        `SELECT 1 FROM lessons l
          WHERE l.status IN ('scheduled', 'done') AND ($3::int IS NULL OR l.id <> $3::int)
            AND l.starts_at < $1::timestamptz + make_interval(mins => $2::int)
            AND l.starts_at + make_interval(mins => l.duration_min) > $1::timestamptz`,
        [r.starts_at, r.duration_min, r.lesson_id]
      );
      if (clash[0]) return { status: 409, error: 'На это время уже стоит другое занятие' };

      let lesson;
      if (r.kind === 'book') {
        const { rows: st } = await client.query('SELECT default_price FROM students WHERE id = $1', [r.student_id]);
        ({ rows: [lesson] } = await client.query(
          `INSERT INTO lessons (student_id, starts_at, duration_min, price) VALUES ($1, $2, $3, $4) RETURNING *`,
          [r.student_id, r.starts_at, r.duration_min, st[0].default_price]
        ));
      } else {
        ({ rows: [lesson] } = await client.query(
          "UPDATE lessons SET starts_at = $1 WHERE id = $2 AND status = 'scheduled' RETURNING *",
          [r.starts_at, r.lesson_id]
        ));
        if (!lesson) return { status: 409, error: 'Занятие уже проведено или отменено' };
      }
      await client.query("UPDATE booking_requests SET status = 'approved', decided_at = NOW() WHERE id = $1", [r.id]);
      return { lesson };
    });

    if (result.error) return res.status(result.status).json({ error: result.error });
    console.log(`✅ Запрос #${req.params.id} подтверждён`);
    res.json(result.lesson);
  })
);

router.post(
  '/requests/:id/decline',
  tutorOnly,
  validateBody(z.object({ tutor_comment: z.string().trim().max(500).optional() }).strict()),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `UPDATE booking_requests SET status = 'declined', decided_at = NOW(), tutor_comment = $2
        WHERE id = $1 AND status = 'pending' RETURNING id`,
      [Number(req.params.id), req.body.tutor_comment || null]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Запрос не найден или уже рассмотрен' });
    console.log(`⚠️ Запрос #${req.params.id} отклонён`);
    res.json({ ok: true });
  })
);

// ------------------------------------------------------------
// Отмена занятия учеником / родителем — только заранее
// ------------------------------------------------------------
router.post(
  '/lessons/:id/cancel',
  clientOnly,
  asyncHandler(async (req, res) => {
    const s = await getBookingSettings();
    const { rows } = await query(
      `SELECT id, student_id, status, starts_at - NOW() >= make_interval(hours => $2::int) AS in_time
         FROM lessons WHERE id = $1`,
      [Number(req.params.id), s.notice_hours]
    );
    const l = rows[0];
    if (!l || !(await canAccessStudent(req.user, l.student_id)) || l.status !== 'scheduled') {
      return res.status(404).json({ error: 'Занятие не найдено' });
    }
    if (!l.in_time) {
      return res.status(409).json({ error: `До занятия меньше ${s.notice_hours} ч. Отменить можно только через преподавателя` });
    }
    await transaction(async (client) => {
      await client.query("UPDATE lessons SET status = 'cancelled', cancelled_by_client_at = NOW() WHERE id = $1", [l.id]);
      await client.query(
        "UPDATE booking_requests SET status = 'withdrawn', decided_at = NOW() WHERE lesson_id = $1 AND status = 'pending'",
        [l.id]
      );
    });
    console.log(`⚠️ Занятие #${l.id} отменено учеником заранее`);
    res.json({ ok: true });
  })
);

module.exports = router;
