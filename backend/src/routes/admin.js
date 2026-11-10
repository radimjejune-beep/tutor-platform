// routes/admin.js — сисадмин: учётки репетиторов и регистрация
// Сисадмин видит только сводку по репетиторам, а не их учеников и материалы
const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { query } = require('../db');
const { requireRole, requireAdmin } = require('../middleware/auth');
const { validateBody, asyncHandler } = require('../middleware/validate');
const { generateTempPassword, uniqueLogin } = require('../utils');
const plans = require('../services/plans');

const router = express.Router();
router.use(asyncHandler(async (req, res, next) => { await require('./sandbox').ensure(); next(); }));
router.use(requireRole('tutor'), requireAdmin);

router.get(
  '/tutors',
  asyncHandler(async (req, res) => {
    await plans.ensure();
    const { rows } = await query(
      `SELECT u.id, u.login, u.full_name, u.is_active, u.is_admin, u.created_at, u.last_login_at, u.must_change_password, u.plan, u.plan_until,
              (SELECT COUNT(*)::int FROM students s WHERE s.tutor_id = u.id AND s.status = 'active') AS students,
              (SELECT COUNT(*)::int FROM lessons l JOIN students s ON s.id = l.student_id
                WHERE s.tutor_id = u.id AND l.status = 'done' AND l.starts_at > NOW() - INTERVAL '30 days') AS lessons_30d
         FROM users u WHERE u.role = 'tutor' AND NOT u.is_sandbox
        ORDER BY u.is_admin DESC, u.created_at`
    );
    const { rows: reg } = await query("SELECT value FROM settings WHERE key = 'registration'");
    res.json({ tutors: rows.map((t) => ({ ...t, plan_now: plans.effective(t).name })), registration_open: Boolean(reg[0]?.value?.open), plans: Object.values(plans.PLANS).map((p) => ({ id: p.id, name: p.name, price: p.price })) });
  })
);

// Создать учётку репетитора: временный пароль показывается один раз
router.post(
  '/tutors',
  validateBody(
    z
      .object({
        full_name: z.string().trim().min(2).max(255),
        login: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,64}$/, 'Логин: латиница, цифры, точка, от 3 символов').optional(),
      })
      .strict()
  ),
  asyncHandler(async (req, res) => {
    const login = req.body.login || (await uniqueLogin({ query }, req.body.full_name));
    const { rows: exists } = await query('SELECT 1 FROM users WHERE login = $1', [login]);
    if (exists[0]) return res.status(409).json({ error: `Логин «${login}» уже занят` });
    const password = generateTempPassword(10);
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await query(
      `INSERT INTO users (role, login, password_hash, full_name, must_change_password, plan, plan_until)
       VALUES ('tutor', $1, $2, $3, TRUE, 'trial', NOW() + make_interval(days => $4)) RETURNING id, login, full_name`,
      [login, hash, req.body.full_name, plans.TRIAL_DAYS]
    );
    console.log(`✅ Сисадмин создал репетитора: ${login}`);
    res.status(201).json({ ...rows[0], password });
  })
);

// Отключить / включить репетитора. Себя отключить нельзя
// Вместе с репетитором отключаются входы его учеников и родителей
// is_admin: выдать или снять права сисадмина (у себя снять нельзя, чтобы не остаться без сисадмина)
router.patch(
  '/tutors/:id',
  validateBody(z.object({ is_active: z.boolean().optional(), is_admin: z.boolean().optional() }).strict()),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (req.body.is_admin !== undefined) {
      if (id === req.user.id) return res.status(400).json({ error: 'Свои права сисадмина снять нельзя' });
      const { rows } = await query("UPDATE users SET is_admin = $2 WHERE id = $1 AND role = 'tutor' AND is_active RETURNING login", [id, req.body.is_admin]);
      if (!rows[0]) return res.status(404).json({ error: 'Активный репетитор не найден' });
      console.log(`${req.body.is_admin ? '✅ Сисадмин назначен' : '⚠️ Права сисадмина сняты'}: ${rows[0].login} (кем: ${req.user.login})`);
      // Снятому сисадмину закрываем и админку магазина
      if (!req.body.is_admin) {
        try { await require('../../lessonfold/src/embed').revokeAdmin(rows[0].login); } catch (e) { console.error('Магазин: не удалось убрать админа', e.message); }
      }
      if (req.body.is_active === undefined) return res.json({ ok: true });
    }
    if (req.body.is_active === undefined) return res.status(400).json({ error: 'Нечего менять' });
    if (id === req.user.id) return res.status(400).json({ error: 'Свою учётку отключить нельзя' });
    const { rows } = await query("UPDATE users SET is_active = $2 WHERE id = $1 AND role = 'tutor' RETURNING login", [id, req.body.is_active]);
    if (!rows[0]) return res.status(404).json({ error: 'Репетитор не найден' });
    await query('UPDATE users SET is_active = $2 WHERE tutor_id = $1', [id, req.body.is_active]);
    console.log(`${req.body.is_active ? '✅ Включён' : '⚠️ Отключён'} репетитор ${rows[0].login}`);
    res.json({ ok: true });
  })
);

router.post(
  '/tutors/:id/reset-password',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const password = generateTempPassword(10);
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await query(
      "UPDATE users SET password_hash = $2, must_change_password = TRUE WHERE id = $1 AND role = 'tutor' AND id <> $3 RETURNING login",
      [id, hash, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Репетитор не найден' });
    res.json({ login: rows[0].login, password });
  })
);

router.put(
  '/registration',
  validateBody(z.object({ open: z.boolean() }).strict()),
  asyncHandler(async (req, res) => {
    await query(
      `INSERT INTO settings (key, value) VALUES ('registration', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [JSON.stringify({ open: req.body.open })]
    );
    res.json({ open: req.body.open });
  })
);

// Выдать тариф: plan = start | tutor | pro | trial, until — дата окончания (без даты — бессрочно)
router.put(
  '/tutors/:id/plan',
  validateBody(z.object({ plan: z.enum(['start', 'tutor', 'trial']), until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional() }).strict()),
  asyncHandler(async (req, res) => {
    await plans.ensure();
    const id = Number(req.params.id);
    const until = req.body.until ? `${req.body.until}T23:59:59+03:00` : null;
    const { rows } = await query("UPDATE users SET plan = $2, plan_until = $3 WHERE id = $1 AND role = 'tutor' RETURNING login", [id, req.body.plan, until]);
    if (!rows[0]) return res.status(404).json({ error: 'Репетитор не найден' });
    plans.forget(id);
    console.log(`💳 Тариф ${req.body.plan} для ${rows[0].login}${until ? ` до ${req.body.until}` : ' бессрочно'}`);
    res.json({ ok: true });
  })
);

// Метрики продукта: активация, удержание, конверсия пробного периода, отток
router.get(
  '/metrics',
  asyncHandler(async (req, res) => {
    await plans.ensure();
    await require('./demo').ensure();
    const days = plans.TRIAL_DAYS;
    const { rows } = await query(
      `WITH t AS (SELECT * FROM users WHERE role = 'tutor' AND NOT is_admin AND NOT is_sandbox),
       act AS (
         SELECT t.id,
                EXISTS (SELECT 1 FROM students s WHERE s.tutor_id = t.id AND NOT s.is_demo) AS has_student,
                EXISTS (SELECT 1 FROM homework h JOIN students s ON s.id = h.student_id WHERE s.tutor_id = t.id) AS has_hw,
                EXISTS (SELECT 1 FROM students s JOIN users u ON u.id = s.user_id WHERE s.tutor_id = t.id AND u.last_login_at IS NOT NULL)
                  OR EXISTS (SELECT 1 FROM parent_students ps JOIN students s ON s.id = ps.student_id JOIN users u ON u.id = ps.parent_user_id WHERE s.tutor_id = t.id AND u.last_login_at IS NOT NULL) AS client_in,
                EXISTS (SELECT 1 FROM lessons l JOIN students s ON s.id = l.student_id WHERE s.tutor_id = t.id AND l.starts_at > NOW() - INTERVAL '7 days' AND l.status <> 'cancelled') AS lesson_week
           FROM t)
       SELECT
         (SELECT COUNT(*) FROM t)::int AS tutors,
         (SELECT COUNT(*) FROM t WHERE created_at > NOW() - INTERVAL '7 days')::int AS new_7,
         (SELECT COUNT(*) FROM t WHERE created_at > NOW() - INTERVAL '30 days')::int AS new_30,
         (SELECT COUNT(*) FROM t JOIN act USING (id) WHERE t.created_at < NOW() - INTERVAL '7 days')::int AS act_base,
         (SELECT COUNT(*) FROM t JOIN act USING (id) WHERE t.created_at < NOW() - INTERVAL '7 days' AND has_student AND has_hw AND client_in)::int AS activated,
         (SELECT COUNT(*) FROM act WHERE lesson_week)::int AS active_week,
         (SELECT COUNT(*) FROM t WHERE created_at BETWEEN NOW() - INTERVAL '56 days' AND NOW() - INTERVAL '28 days')::int AS w4_base,
         (SELECT COUNT(*) FROM t JOIN act USING (id) WHERE t.created_at BETWEEN NOW() - INTERVAL '56 days' AND NOW() - INTERVAL '28 days' AND lesson_week)::int AS w4_active,
         (SELECT COUNT(*) FROM t WHERE created_at < NOW() - make_interval(days => $1))::int AS trial_done,
         (SELECT COUNT(*) FROM t WHERE created_at < NOW() - make_interval(days => $1) AND plan IN ('tutor', 'pro'))::int AS converted,
         (SELECT COUNT(*) FROM t WHERE plan IN ('tutor', 'pro') AND (plan_until IS NULL OR plan_until > NOW()))::int AS paying,
         (SELECT COUNT(*) FROM t WHERE plan = 'trial' AND plan_until > NOW())::int AS in_trial,
         (SELECT COUNT(*) FROM t WHERE plan IN ('tutor', 'pro') AND plan_until BETWEEN NOW() - INTERVAL '30 days' AND NOW())::int AS churned_30,
         (SELECT COUNT(*) FROM students s JOIN t ON t.id = s.tutor_id WHERE s.status = 'active')::int AS students`,
      [days]
    );
    const m = rows[0];
    const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);
    res.json({
      ...m,
      activation_pct: pct(m.activated, m.act_base),
      retention_w4_pct: pct(m.w4_active, m.w4_base),
      conversion_pct: pct(m.converted, m.trial_done),
      churn_pct: pct(m.churned_30, m.paying + m.churned_30),
      mrr: m.paying * plans.PLANS.tutor.price,
    });
  })
);

// Состояние сервиса для сисадмина: резервные копии, хранилище, реквизиты, бот
router.get(
  '/system',
  asyncHandler(async (req, res) => {
    const backup = require('../services/backup');
    res.json({
      backup: await backup.state(),
      backup_key: Boolean(process.env['BACKUP_KEY']),
      s3: require('../services/s3').enabled(),
      legal: require('../legal/platform').configured(),
      telegram: require('../services/telegram').enabled(),
      errors: require('../services/monitor').recent(),
    });
  })
);

// Сделать резервную копию сейчас
router.post(
  '/backup',
  asyncHandler(async (req, res) => {
    const r = await require('../services/jobs').withLock('backup', () => require('../services/backup').run({ reason: `вручную, ${req.user.login}` }));
    if (r?.skipped) return res.status(409).json({ error: 'Копия уже делается, подождите пару минут' });
    if (!r.ok) return res.status(500).json({ error: r.error });
    res.json(r);
  })
);

module.exports = router;
