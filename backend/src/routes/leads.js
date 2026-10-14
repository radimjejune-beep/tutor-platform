// routes/leads.js — страница записи для новых учеников и заявки с тестом уровня
// publicRouter — без входа (страница записи), router — кабинет репетитора
const express = require('express');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const { query } = require('../db');
const { requireRole } = require('../middleware/auth');
const { validateBody, asyncHandler } = require('../middleware/validate');
const placement = require('../services/placement');
const notify = require('../services/notify');

const PROFILE_DEFAULTS = { enabled: false, about: '', price_text: '', subjects: 'Английский язык', league_enabled: true };

async function getProfile(tutorId) {
  const { rows } = await query('SELECT value FROM settings WHERE key = $1', [`profile:${tutorId}`]);
  return { ...PROFILE_DEFAULTS, ...(rows[0]?.value || {}) };
}

async function tutorByLogin(login) {
  const { rows } = await query("SELECT id, login, full_name FROM users WHERE login = $1 AND role = 'tutor' AND is_active", [
    String(login || '').toLowerCase().slice(0, 64),
  ]);
  return rows[0] || null;
}

/* ============================================================
   Открытая часть
   ============================================================ */
const publicRouter = express.Router();

publicRouter.get(
  '/tutors/:login',
  asyncHandler(async (req, res) => {
    const t = await tutorByLogin(req.params.login);
    const p = t && (await getProfile(t.id));
    if (!t || !p.enabled) return res.status(404).json({ error: 'Страница не найдена' });
    res.json({ login: t.login, full_name: t.full_name, about: p.about, price_text: p.price_text, subjects: p.subjects, test: placement.publicTest() });
  })
);

// Не больше 5 заявок за час с одного адреса
const leadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много заявок с этого адреса, попробуйте позже' },
});

publicRouter.post(
  '/tutors/:login/leads',
  leadLimiter,
  express.json({ limit: '50kb' }),
  validateBody(
    z
      .object({
        full_name: z.string().trim().min(2, 'Укажите имя').max(255),
        contact: z.string().trim().min(5, 'Укажите телефон или Telegram').max(255),
        age_group: z.enum(['adult', 'teen', 'child']).default('adult'),
        goal: z.string().trim().max(2000).optional(),
        preferred_time: z.string().trim().max(500).optional(),
        answers: z.record(z.union([z.number().int(), z.string().max(5)])).optional(),
        consent: z.literal(true, { errorMap: () => ({ message: 'Нужно согласие на обработку данных' }) }),
      })
      .strict()
  ),
  asyncHandler(async (req, res) => {
    const t = await tutorByLogin(req.params.login);
    const p = t && (await getProfile(t.id));
    if (!t || !p.enabled) return res.status(404).json({ error: 'Страница не найдена' });
    const b = req.body;
    const tested = b.answers && Object.keys(b.answers).length > 0;
    const g = tested ? placement.grade(b.answers) : null;
    const { rows } = await query(
      `INSERT INTO leads (tutor_id, full_name, contact, age_group, goal, preferred_time, level, test_score, test_total, consent_at, ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10) RETURNING id`,
      [t.id, b.full_name, b.contact, b.age_group, b.goal || null, b.preferred_time || null, g?.level || null, g?.score ?? null, g?.total ?? null,
        String(req.ip || '').slice(0, 64)]
    );
    notify.toTutor(t.id, {
      kind: 'lead',
      title: `Новая заявка: ${b.full_name}`,
      body: [g && `уровень ${g.level} (${g.score}/${g.total})`, b.goal].filter(Boolean).join('. '),
      link: '/leads',
    });
    console.log(`✅ Заявка #${rows[0].id} для ${t.login}`);
    res.status(201).json({ ok: true, level: g?.level || null, score: g?.score ?? null, total: g?.total ?? null });
  })
);

/* ============================================================
   Кабинет репетитора
   ============================================================ */
const router = express.Router();
router.use(requireRole('tutor'));

router.get(
  '/profile',
  asyncHandler(async (req, res) => {
    res.json({ ...(await getProfile(req.user.id)), login: req.user.login });
  })
);

router.put(
  '/profile',
  validateBody(
    z
      .object({
        enabled: z.boolean(),
        about: z.string().max(3000),
        price_text: z.string().max(300),
        subjects: z.string().max(300),
        league_enabled: z.boolean(),
      })
      .partial()
      .strict()
  ),
  asyncHandler(async (req, res) => {
    const next = { ...(await getProfile(req.user.id)), ...req.body };
    await query(
      `INSERT INTO settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [`profile:${req.user.id}`, JSON.stringify(next)]
    );
    res.json(next);
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT * FROM leads WHERE tutor_id = $1 AND (status IN ('new', 'contacted') OR created_at > NOW() - INTERVAL '60 days')
        ORDER BY (status = 'new') DESC, created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  })
);

const ownLead = async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM leads WHERE id = $1 AND tutor_id = $2', [Number(req.params.id), req.user.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Заявка не найдена' });
    req.lead = rows[0];
    next();
  } catch (err) {
    next(err);
  }
};

router.patch(
  '/:id',
  ownLead,
  validateBody(z.object({ status: z.enum(['new', 'contacted', 'rejected']) }).strict()),
  asyncHandler(async (req, res) => {
    const { rows } = await query('UPDATE leads SET status = $2 WHERE id = $1 RETURNING *', [req.lead.id, req.body.status]);
    res.json(rows[0]);
  })
);

// Сделать учеником: карточка заполняется из заявки
router.post(
  '/:id/convert',
  ownLead,
  asyncHandler(async (req, res) => {
    const l = req.lead;
    if (l.student_id) return res.json({ student_id: l.student_id });
    const notes = [`Контакт: ${l.contact}`, l.preferred_time && `Удобное время: ${l.preferred_time}`,
      l.level && `Тест уровня: ${l.level}, ${l.test_score}/${l.test_total}`].filter(Boolean).join('\n');
    const { rows } = await query(
      `INSERT INTO students (full_name, category, level, goal, notes, tutor_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [l.full_name, l.age_group, l.level, l.goal, notes, req.user.id]
    );
    await query("UPDATE leads SET status = 'student', student_id = $2 WHERE id = $1", [l.id, rows[0].id]);
    console.log(`✅ Заявка #${l.id} → ученик #${rows[0].id}`);
    res.status(201).json({ student_id: rows[0].id });
  })
);

router.delete(
  '/:id',
  ownLead,
  asyncHandler(async (req, res) => {
    await query('DELETE FROM leads WHERE id = $1', [req.lead.id]);
    res.json({ ok: true });
  })
);

module.exports = { router, publicRouter, getProfile };
