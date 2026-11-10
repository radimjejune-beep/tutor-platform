// routes/sandbox.js — тестовый кабинет «Попробовать без регистрации».
// Каждый, кто открыл ссылку /#/try, получает свой отдельный кабинет преподавателя с примером
// (два ученика, занятия, задание, оплаты) и может посмотреть кабинет ученика одной кнопкой.
// Тестовые кабинеты никому не видны, не попадают в метрики и удаляются сами через SANDBOX_DAYS дней (3).
//   POST /api/sandbox              создать тестовый кабинет и войти (без входа, ограничение по IP)
//   POST /api/sandbox/as-student   войти в кабинет ученика-примера (только из тестового кабинета)
// Выключить: SANDBOX_DISABLED=1.
const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { query, transaction } = require('../db');
const { asyncHandler } = require('../middleware/validate');
const { signToken } = require('../middleware/auth');
const { withLock } = require('../services/jobs');

const DAYS = Number(process.env['SANDBOX_DAYS'] || 3);
const disabled = () => process.env['SANDBOX_DISABLED'] === '1';

let ready = null;
function ensure() {
  if (!ready) {
    ready = query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_sandbox BOOLEAN NOT NULL DEFAULT FALSE').catch((err) => { ready = null; throw err; });
  }
  return ready;
}

const rnd = (n) => crypto.randomBytes(n).toString('hex').slice(0, n);
// Пароль никому не показываем: в тестовый кабинет входят только по ссылке
const unusableHash = () => bcrypt.hash(crypto.randomBytes(24).toString('base64'), 10);

const publicRouter = express.Router();
publicRouter.post(
  '/',
  rateLimit({ windowMs: 60 * 60 * 1000, limit: 6, standardHeaders: true, legacyHeaders: false, message: { error: 'Слишком много тестовых кабинетов с одного адреса, попробуйте через час' } }),
  asyncHandler(async (req, res) => {
    if (disabled()) return res.status(403).json({ error: 'Тестовый кабинет сейчас выключен' });
    await ensure();
    const plans = require('../services/plans');
    await plans.ensure();
    const demo = require('./demo');
    await demo.ensure();
    const tag = rnd(6);
    const result = await transaction(async (c) => {
      const { rows } = await c.query(
        `INSERT INTO users (role, login, password_hash, full_name, subject, last_login_at, plan, plan_until, is_sandbox)
         VALUES ('tutor', $1, $2, 'Тестовый преподаватель', 'Английский язык', NOW(), 'trial', NOW() + make_interval(days => $3), TRUE)
         RETURNING id, role, login, full_name, password_hash`,
        [`test-${tag}`, await unusableHash(), DAYS]
      );
      const tutor = rows[0];
      const { anna, misha } = await demo.createDemo(c, tutor.id);
      // У учеников-примеров есть свои входы, чтобы посмотреть кабинет ученика
      for (const [st, suffix] of [[anna, 'anna'], [misha, 'misha']]) {
        const { rows: u } = await c.query(
          `INSERT INTO users (role, login, password_hash, full_name, tutor_id, is_sandbox) VALUES ('student', $1, $2, $3, $4, TRUE) RETURNING id`,
          [`test-${tag}-${suffix}`, await unusableHash(), st.full_name, tutor.id]
        );
        await c.query('UPDATE students SET user_id = $1 WHERE id = $2', [u[0].id, st.id]);
      }
      return tutor;
    });
    await require('./platformDocs').acceptOnRegister(result.id, req.ip);
    console.log(`🧪 Тестовый кабинет: ${result.login}`);
    res.status(201).json({ token: signToken(result), days: DAYS });
  })
);

const router = express.Router();
router.use(asyncHandler(async (req, res, next) => { await ensure(); next(); }));

// Есть ли у пользователя отметка тестового кабинета (для плашки в интерфейсе)
router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT is_sandbox, created_at FROM users WHERE id = $1', [req.user.id]);
  const u = rows[0];
  res.json({ sandbox: Boolean(u?.is_sandbox), until: u?.is_sandbox ? new Date(new Date(u.created_at).getTime() + DAYS * 864e5) : null });
}));

router.post(
  '/as-student',
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'tutor') return res.status(403).json({ error: 'Только из кабинета преподавателя' });
    const { rows: me } = await query('SELECT is_sandbox FROM users WHERE id = $1', [req.user.id]);
    if (!me[0]?.is_sandbox) return res.status(403).json({ error: 'Доступно только в тестовом кабинете' });
    const { rows } = await query(
      `SELECT u.id, u.role, u.login, u.full_name, u.password_hash FROM students s JOIN users u ON u.id = s.user_id
        WHERE s.tutor_id = $1 AND s.is_demo AND u.is_sandbox AND ($2::int IS NULL OR s.id = $2)
        ORDER BY s.id LIMIT 1`,
      [req.user.id, req.body?.student_id || null]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Ученик-пример не найден. Добавьте пример на главной.' });
    res.json({ token: signToken(rows[0]), full_name: rows[0].full_name });
  })
);

// Раз в 6 часов удаляем тестовые кабинеты старше DAYS дней (ученики, занятия, материалы удаляются вместе с ними)
async function cleanup() {
  await ensure();
  const { rows } = await query(
    `DELETE FROM users WHERE is_sandbox AND role = 'tutor' AND created_at < NOW() - make_interval(days => $1) RETURNING id`,
    [DAYS]
  );
  if (rows.length) console.log(`🧹 Удалено тестовых кабинетов: ${rows.length}`);
  return rows.length;
}
let timer = null;
function start() {
  if (timer) return;
  const tick = () => withLock('sandbox-cleanup', cleanup).catch((err) => console.error('🧹 Тестовые кабинеты:', err.message));
  setTimeout(tick, 5 * 60 * 1000);
  timer = setInterval(tick, 6 * 60 * 60 * 1000);
}

module.exports = { publicRouter, router, ensure, cleanup, start };
