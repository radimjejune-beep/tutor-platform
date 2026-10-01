// routes/auth.js — вход, текущий пользователь, смена пароля
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');
const { validateBody, asyncHandler } = require('../middleware/validate');

const router = express.Router();

// Не больше 10 попыток входа за 15 минут с одного адреса
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много попыток входа, попробуйте через 15 минут' },
});

const loginSchema = z.object({
  login: z.string().trim().toLowerCase().min(1).max(64),
  password: z.string().min(1).max(100),
});

router.post(
  '/login',
  loginLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { login, password } = req.body;
    const { rows } = await query('SELECT * FROM users WHERE login = $1', [login]);
    const user = rows[0];

    // Одинаковый ответ для «нет такого логина» и «неверный пароль»
    const ok = user && user.is_active && (await bcrypt.compare(password, user.password_hash));
    if (!ok) {
      console.log(`⚠️ Неудачный вход: ${login}`);
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

    await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

    console.log(`✅ Вход: ${login} (${user.role})`);
    res.json({
      token,
      user: {
        id: user.id,
        role: user.role,
        login: user.login,
        full_name: user.full_name,
        must_change_password: user.must_change_password,
      },
    });
  })
);

// Кто я + к каким ученикам есть доступ (для ученика — он сам, для родителя — его дети)
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    let students = [];
    if (req.user.role === 'student') {
      ({ rows: students } = await query(
        'SELECT id, full_name, level, board_link FROM students WHERE user_id = $1',
        [req.user.id]
      ));
    } else if (req.user.role === 'parent') {
      ({ rows: students } = await query(
        `SELECT s.id, s.full_name, s.level, s.board_link
           FROM students s JOIN parent_students ps ON ps.student_id = s.id
          WHERE ps.parent_user_id = $1 AND s.status <> 'archived'
          ORDER BY s.full_name`,
        [req.user.id]
      ));
    }
    res.json({ user: req.user, students });
  })
);

const passwordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(6, 'Минимум 6 символов').max(100),
});

router.post(
  '/change-password',
  authenticate,
  validateBody(passwordSchema),
  asyncHandler(async (req, res) => {
    const { current_password, new_password } = req.body;
    const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!(await bcrypt.compare(current_password, rows[0].password_hash))) {
      return res.status(400).json({ error: 'Текущий пароль указан неверно' });
    }
    if (current_password === new_password) {
      return res.status(400).json({ error: 'Новый пароль должен отличаться от текущего' });
    }
    const hash = await bcrypt.hash(new_password, 12);
    await query('UPDATE users SET password_hash = $1, must_change_password = FALSE WHERE id = $2', [
      hash,
      req.user.id,
    ]);
    console.log(`📝 Пароль изменён: ${req.user.login}`);
    res.json({ ok: true });
  })
);

module.exports = router;
