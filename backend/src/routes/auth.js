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

// Регистрация репетиторов: не больше 5 с одного адреса за час
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много регистраций с этого адреса, попробуйте позже' },
});

async function registrationOpen() {
  const { rows } = await query("SELECT value FROM settings WHERE key = 'registration'");
  return Boolean(rows[0]?.value?.open);
}

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
      expiresIn: process.env['JWT_EXPIRES_IN'] || '7d',
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
        is_admin: user.is_admin,
      },
    });
  })
);

// ------------------------------------------------------------
// Регистрация нового репетитора (пока бесплатно). Сисадмин может её закрыть
// ------------------------------------------------------------
router.get(
  '/registration',
  asyncHandler(async (req, res) => {
    res.json({ open: await registrationOpen() });
  })
);

router.post(
  '/register',
  registerLimiter,
  validateBody(
    z
      .object({
        full_name: z.string().trim().min(2, 'Укажите имя и фамилию').max(255),
        login: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,64}$/, 'Логин: латиница, цифры, точка, от 3 символов'),
        password: z.string().min(8, 'Пароль: минимум 8 символов').max(100),
        subject: z.string().trim().min(2, 'Укажите предмет').max(100),
        accept: z.literal(true, { errorMap: () => ({ message: 'Нужно согласие с условиями' }) }),
      })
      .strict()
  ),
  asyncHandler(async (req, res) => {
    if (!(await registrationOpen())) return res.status(403).json({ error: 'Регистрация сейчас закрыта' });
    const b = req.body;
    const { rows: exists } = await query('SELECT 1 FROM users WHERE login = $1', [b.login]);
    if (exists[0]) return res.status(409).json({ error: `Логин «${b.login}» уже занят` });
    const hash = await bcrypt.hash(b.password, 12);
    const { rows } = await query(
      `INSERT INTO users (role, login, password_hash, full_name, subject, last_login_at)
       VALUES ('tutor', $1, $2, $3, $4, NOW()) RETURNING id, role, login, full_name, must_change_password, is_admin, subject`,
      [b.login, hash, b.full_name, b.subject]
    );
    const user = rows[0];
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: process.env['JWT_EXPIRES_IN'] || '7d' });
    console.log(`✅ Новый репетитор зарегистрировался: ${user.login}`);
    res.status(201).json({ token, user });
  })
);

// Основной предмет репетитора (меняется в настройках)
router.put(
  '/subject',
  authenticate,
  validateBody(z.object({ subject: z.string().trim().min(2, 'Укажите предмет').max(100) }).strict()),
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'tutor') return res.status(403).json({ error: 'Только для преподавателя' });
    await query('UPDATE users SET subject = $1 WHERE id = $2', [req.body.subject, req.user.id]);
    res.json({ subject: req.body.subject });
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
        'SELECT id, full_name, level, board_link, call_link, category, subject FROM students WHERE user_id = $1',
        [req.user.id]
      ));
    } else if (req.user.role === 'parent') {
      ({ rows: students } = await query(
        `SELECT s.id, s.full_name, s.level, s.board_link, s.call_link, s.category, s.subject
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
