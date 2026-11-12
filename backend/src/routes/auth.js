// routes/auth.js — вход, текущий пользователь, смена пароля
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const { query } = require('../db');
const { authenticate, signToken } = require('../middleware/auth');
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
  login: z.string().trim().toLowerCase().min(1).max(255),
  password: z.string().min(1).max(100),
});

router.post(
  '/login',
  loginLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { login, password } = req.body;
    // В поле можно ввести логин или почту
    const { rows } = await query('SELECT * FROM users WHERE login = $1 OR (email IS NOT NULL AND LOWER(email) = $1) ORDER BY (login = $1) DESC LIMIT 1', [login]);
    const user = rows[0];

    // Одинаковый ответ для «нет такого логина» и «неверный пароль»
    const ok = user && user.is_active && (await bcrypt.compare(password, user.password_hash));
    if (!ok) {
      console.log(`⚠️ Неудачный вход: ${login}`);
      return res.status(401).json({ error: 'Неверная почта, логин или пароль' });
    }

    await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);
    const token = signToken(user);

    console.log(`✅ Вход: ${login} (${user.role})`);
    res.json({
      token,
      user: {
        id: user.id,
        role: user.role,
        login: user.login,
        email: user.email,
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
        email: z.string().trim().toLowerCase().max(255).email('Проверьте адрес почты'),
        password: z.string().min(8, 'Пароль: минимум 8 символов').max(100),
        subject: z.string().trim().min(2, 'Укажите предмет').max(100),
        accept: z.literal(true, { errorMap: () => ({ message: 'Нужно принять условия платформы' }) }),
      })
      .strict()
  ),
  asyncHandler(async (req, res) => {
    if (!(await registrationOpen())) return res.status(403).json({ error: 'Регистрация сейчас закрыта' });
    const b = req.body;
    const { rows: exists } = await query('SELECT 1 FROM users WHERE LOWER(email) = $1', [b.email]);
    if (exists[0]) return res.status(409).json({ error: 'С этой почтой уже есть кабинет. Войдите или восстановите пароль' });
    // Логин остаётся внутренним: собираем из почты, при совпадении добавляем цифру
    const base = (b.email.split('@')[0].replace(/[^a-z0-9._-]/g, '') || 'tutor').slice(0, 40).padEnd(3, '0');
    const { rows: taken } = await query('SELECT login FROM users WHERE login = $1 OR login ~ $2', [base, `^${base.replace(/[.]/g, '\\.')}[0-9]+$`]);
    const used = new Set(taken.map((r) => r.login));
    let login = base;
    for (let i = 2; used.has(login); i++) login = `${base}${i}`;
    const hash = await bcrypt.hash(b.password, 12);
    await require('../services/plans').ensure();
    const { rows } = await query(
      `INSERT INTO users (role, login, email, password_hash, full_name, subject, last_login_at, plan, plan_until)
       VALUES ('tutor', $1, $6, $2, $3, $4, NOW(), 'trial', NOW() + make_interval(days => $5)) RETURNING id, role, login, email, full_name, must_change_password, is_admin, subject, password_hash`,
      [login, hash, b.full_name, b.subject, require('../services/plans').TRIAL_DAYS, b.email]
    );
    const { password_hash: _ph, ...user } = rows[0];
    await require('./platformDocs').acceptOnRegister(user.id, req.ip);
    const token = signToken(rows[0]);
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

// Профиль: имя, которое видят ученики и родители (только преподаватель; имена учеников меняет преподаватель)
router.put(
  '/profile',
  authenticate,
  validateBody(z.object({ full_name: z.string().trim().min(2, 'Введите имя').max(120) }).strict()),
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'tutor') return res.status(403).json({ error: 'Имя меняет преподаватель' });
    await query('UPDATE users SET full_name = $1 WHERE id = $2', [req.body.full_name, req.user.id]);
    res.json({ full_name: req.body.full_name });
  })
);

// Почта для входа: любая роль может указать или сменить свою, нужна проверка пароля
router.put(
  '/email',
  authenticate,
  validateBody(z.object({ email: z.string().trim().toLowerCase().max(255).email('Проверьте адрес почты').or(z.literal('')), password: z.string().min(1, 'Введите пароль').max(100) }).strict()),
  asyncHandler(async (req, res) => {
    const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!(await bcrypt.compare(req.body.password, rows[0].password_hash))) return res.status(400).json({ error: 'Пароль указан неверно' });
    const email = req.body.email || null;
    if (!email && req.user.role === 'tutor') return res.status(400).json({ error: 'Преподавателю почта нужна для входа' });
    if (email) {
      const { rows: other } = await query('SELECT 1 FROM users WHERE LOWER(email) = $1 AND id <> $2', [email, req.user.id]);
      if (other[0]) return res.status(409).json({ error: 'Эта почта уже привязана к другому кабинету' });
    }
    await query('UPDATE users SET email = $1 WHERE id = $2', [email, req.user.id]);
    console.log(`📝 Почта изменена: ${req.user.login}`);
    res.json({ email });
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
    // Новый токен для этого устройства; на остальных устройствах вход сбросится
    res.json({ ok: true, token: signToken({ id: req.user.id, password_hash: hash }) });
  })
);

module.exports = router;
