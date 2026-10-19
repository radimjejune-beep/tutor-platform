// routes/announcements.js — объявления на главной
// Репетитор пишет своим ученикам и родителям («каникулы с 1 по 10 ноября», «новый набор слов» и т. п.).
// Сисадмин платформы может написать всем репетиторам.
const express = require('express');
const { z } = require('zod');
const { query } = require('../db');
const { requireRole, accessibleStudentIds } = require('../middleware/auth');
const { validateBody, asyncHandler } = require('../middleware/validate');
const notify = require('../services/notify');

const router = express.Router();
const tutorOnly = requireRole('tutor');

const ACTIVE = '(a.expires_on IS NULL OR a.expires_on >= CURRENT_DATE)';
const FIELDS = 'a.id, a.audience, a.title, a.body, a.link, a.pinned, a.expires_on, a.created_at';

const schema = z
  .object({
    title: z.string().trim().min(1, 'Напишите заголовок').max(200),
    body: z.string().trim().max(5000).nullable().optional(),
    link: z.string().trim().regex(/^https?:\/\/[^\s]+\.[^\s]+$/, 'Ссылка должна начинаться с https://').max(500).nullable().optional().or(z.literal('')),
    pinned: z.boolean().optional(),
    expires_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата в формате ГГГГ-ММ-ДД').nullable().optional().or(z.literal('')),
    audience: z.enum(['students', 'tutors']).optional(),
    notify: z.boolean().optional(), // отправить ещё и уведомление в колокольчик
  })
  .strict();

// Список: репетитору свои (и от сисадмина), ученику и родителю от их репетитора
router.get(
  '/',
  asyncHandler(async (req, res) => {
    if (req.user.role === 'tutor') {
      const { rows: mine } = await query(
        `SELECT ${FIELDS}, ${ACTIVE} AS active FROM announcements a WHERE a.tutor_id = $1 ORDER BY a.pinned DESC, a.created_at DESC LIMIT 50`,
        [req.user.id]
      );
      const { rows: platform } = await query(
        `SELECT ${FIELDS}, u.full_name AS author FROM announcements a JOIN users u ON u.id = a.tutor_id
          WHERE a.audience = 'tutors' AND u.is_admin AND a.tutor_id <> $1 AND ${ACTIVE}
          ORDER BY a.pinned DESC, a.created_at DESC LIMIT 10`,
        [req.user.id]
      );
      return res.json({ mine, platform });
    }
    const ids = await accessibleStudentIds(req.user);
    if (!ids.length) return res.json([]);
    const { rows } = await query(
      `SELECT ${FIELDS}, u.full_name AS author FROM announcements a JOIN users u ON u.id = a.tutor_id
        WHERE a.audience = 'students' AND ${ACTIVE}
          AND a.tutor_id IN (SELECT tutor_id FROM students WHERE id = ANY($1::int[]))
        ORDER BY a.pinned DESC, a.created_at DESC LIMIT 10`,
      [ids]
    );
    res.json(rows);
  })
);

const clean = (b) => ({
  ...b,
  body: b.body || null,
  link: b.link || null,
  expires_on: b.expires_on || null,
});

router.post(
  '/',
  tutorOnly,
  validateBody(schema),
  asyncHandler(async (req, res) => {
    const b = clean(req.body);
    const audience = b.audience === 'tutors' && req.user.is_admin ? 'tutors' : 'students';
    const { rows } = await query(
      `INSERT INTO announcements (tutor_id, audience, title, body, link, pinned, expires_on)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.user.id, audience, b.title, b.body, b.link, Boolean(b.pinned), b.expires_on]
    );
    res.status(201).json(rows[0]);
    // Колокольчик: ученикам и родителям (или всем репетиторам), после ответа
    if (b.notify) {
      try {
        if (audience === 'students') {
          const { rows: st } = await query("SELECT id FROM students WHERE tutor_id = $1 AND status = 'active'", [req.user.id]);
          for (const s of st) await notify.toStudent(s.id, { kind: 'announcement', title: b.title, body: b.body, link: '/' });
        } else {
          const { rows: tt } = await query("SELECT id FROM users WHERE role = 'tutor' AND is_active AND id <> $1", [req.user.id]);
          for (const t of tt) await notify.toTutor(t.id, { kind: 'announcement', title: b.title, body: b.body, link: '/' });
        }
      } catch (err) {
        console.error('Объявление: уведомления не отправлены', err.message);
      }
    }
  })
);

router.patch(
  '/:id',
  tutorOnly,
  validateBody(schema.partial().strict()),
  asyncHandler(async (req, res) => {
    const b = clean(req.body);
    delete b.notify;
    if (b.audience === 'tutors' && !req.user.is_admin) b.audience = 'students';
    const keys = Object.keys(req.body).filter((k) => k !== 'notify');
    if (!keys.length) return res.status(400).json({ error: 'Нечего менять' });
    const vals = keys.map((k) => b[k] ?? null);
    const sets = keys.map((k, i) => `${k} = $${i + 1}`);
    vals.push(Number(req.params.id), req.user.id);
    const { rows } = await query(
      `UPDATE announcements SET ${sets.join(', ')} WHERE id = $${vals.length - 1} AND tutor_id = $${vals.length} RETURNING *`,
      vals
    );
    if (!rows[0]) return res.status(404).json({ error: 'Объявление не найдено' });
    res.json(rows[0]);
  })
);

router.delete(
  '/:id',
  tutorOnly,
  asyncHandler(async (req, res) => {
    const { rows } = await query('DELETE FROM announcements WHERE id = $1 AND tutor_id = $2 RETURNING id', [Number(req.params.id), req.user.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Объявление не найдено' });
    res.json({ ok: true });
  })
);

module.exports = router;
