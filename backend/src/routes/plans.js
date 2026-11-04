// routes/plans.js — тарифы
//   GET  /api/plans            (без входа) тарифы и что в них входит: для главной страницы
//   GET  /api/plan             (преподаватель) мой тариф, сколько использовано, все тарифы
//   PUT  /api/admin/tutors/:id/plan   (сисадмин) выдать тариф до даты — см. routes/admin.js
const express = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../middleware/validate');
const plans = require('../services/plans');

const publicList = () => ({
  trial_days: plans.TRIAL_DAYS,
  plans: Object.values(plans.PLANS).map(({ id, name, price, year, tagline, limits, features }) => ({ id, name, price, year, tagline, limits, features })),
  features: plans.FEATURE_LIST,
});

const publicRouter = express.Router();
publicRouter.get('/', (req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json(publicList());
});

const router = express.Router();
router.get(
  '/',
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'tutor') return res.status(403).json({ error: 'Только для преподавателя' });
    const plan = await plans.planOf(req.user.tid);
    const [{ rows: s }, { rows: b }, { rows: t }] = await Promise.all([
      query("SELECT COUNT(*)::int AS n FROM students WHERE tutor_id = $1 AND status = 'active'", [req.user.tid]),
      query("SELECT COALESCE(SUM(size_bytes), 0)::bigint AS n FROM library_books WHERE tutor_id = $1", [req.user.tid]).catch(() => ({ rows: [{ n: 0 }] })),
      query("SELECT COUNT(*)::int AS n FROM bank_takes WHERE tutor_id = $1 AND taken_at > date_trunc('month', NOW())", [req.user.tid]).catch(() => ({ rows: [{ n: 0 }] })),
    ]);
    res.json({
      current: { id: plan.id, name: plan.name, trial: plan.trial, admin: plan.admin, until: plan.until, expired: Boolean(plan.expired), limits: plan.limits, features: plan.features },
      usage: { students: s[0].n, books_mb: Math.round(Number(b[0].n) / 1024 / 1024), bank_takes: t[0].n },
      ...publicList(),
    });
  })
);

// Заявка на тариф: пока оплата подписки не подключена, сисадмины получают уведомление и выдают тариф вручную
router.post(
  '/request',
  express.json(),
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'tutor') return res.status(403).json({ error: 'Только для преподавателя' });
    const p = plans.PLANS[req.body?.plan];
    if (!p || p.id === 'start') return res.status(422).json({ error: 'Выберите тариф' });
    const period = req.body?.period === 'year' ? 'year' : 'month';
    const { rows: admins } = await query("SELECT id FROM users WHERE role = 'tutor' AND is_admin AND is_active");
    const { rows: me } = await query('SELECT full_name, login FROM users WHERE id = $1', [req.user.id]);
    const notify = require('../services/notify');
    for (const a of admins) {
      await notify.toTutor(a.id, {
        kind: 'plan_request',
        title: `Заявка на тариф «${p.name}»: ${me[0].full_name}`,
        body: `Логин ${me[0].login}. ${period === 'year' ? `На год, ${p.year} ₽` : `На месяц, ${p.price} ₽`}. Выдать тариф: Учителя.`,
        link: '/admin',
      });
    }
    console.log(`💳 Заявка на тариф ${p.id} (${period}) от ${me[0].login}`);
    res.json({ ok: true });
  })
);

module.exports = { router, publicRouter };
