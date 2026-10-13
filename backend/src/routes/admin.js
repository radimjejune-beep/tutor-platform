// routes/admin.js — сисадмин: учётки репетиторов и регистрация
// Сисадмин видит только сводку по репетиторам, а не их учеников и материалы
const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { query } = require('../db');
const { requireRole, requireAdmin } = require('../middleware/auth');
const { validateBody, asyncHandler } = require('../middleware/validate');
const { generateTempPassword, uniqueLogin } = require('../utils');

const router = express.Router();
router.use(requireRole('tutor'), requireAdmin);

router.get(
  '/tutors',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT u.id, u.login, u.full_name, u.is_active, u.is_admin, u.created_at, u.last_login_at, u.must_change_password,
              (SELECT COUNT(*)::int FROM students s WHERE s.tutor_id = u.id AND s.status = 'active') AS students,
              (SELECT COUNT(*)::int FROM lessons l JOIN students s ON s.id = l.student_id
                WHERE s.tutor_id = u.id AND l.status = 'done' AND l.starts_at > NOW() - INTERVAL '30 days') AS lessons_30d
         FROM users u WHERE u.role = 'tutor'
        ORDER BY u.is_admin DESC, u.created_at`
    );
    const { rows: reg } = await query("SELECT value FROM settings WHERE key = 'registration'");
    res.json({ tutors: rows, registration_open: Boolean(reg[0]?.value?.open) });
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
      `INSERT INTO users (role, login, password_hash, full_name, must_change_password)
       VALUES ('tutor', $1, $2, $3, TRUE) RETURNING id, login, full_name`,
      [login, hash, req.body.full_name]
    );
    console.log(`✅ Сисадмин создал репетитора: ${login}`);
    res.status(201).json({ ...rows[0], password });
  })
);

// Отключить / включить репетитора. Себя отключить нельзя
// Вместе с репетитором отключаются входы его учеников и родителей
router.patch(
  '/tutors/:id',
  validateBody(z.object({ is_active: z.boolean() }).strict()),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
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

module.exports = router;
