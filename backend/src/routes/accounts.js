// routes/accounts.js — управление входами учеников и родителей (только репетитор)
const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { query } = require('../db');
const { requireRole } = require('../middleware/auth');
const { validateBody, asyncHandler } = require('../middleware/validate');
const { generateTempPassword } = require('../utils');

const router = express.Router();
router.use(requireRole('tutor'));

// Найти учётку ученика/родителя (свою учётку репетитор тут не трогает)
async function findManagedUser(id) {
  const { rows } = await query("SELECT id, role, login FROM users WHERE id = $1 AND role <> 'tutor'", [id]);
  return rows[0];
}

// Задать новый пароль: свой (password) или сгенерированный. Показывается один раз
router.post(
  '/:userId/reset-password',
  validateBody(z.object({ password: z.string().min(6, 'Минимум 6 символов').max(100).optional() }).strict()),
  asyncHandler(async (req, res) => {
    const user = await findManagedUser(Number(req.params.userId));
    if (!user) return res.status(404).json({ error: 'Учётная запись не найдена' });

    const newPassword = req.body.password || generateTempPassword(8);
    const hash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, user.id]);
    console.log(`📝 Новый пароль: ${user.login}`);
    res.json({ login: user.login, password: newPassword });
  })
);

// Заблокировать / разблокировать вход
router.patch(
  '/:userId',
  validateBody(z.object({ is_active: z.boolean() }).strict()),
  asyncHandler(async (req, res) => {
    const user = await findManagedUser(Number(req.params.userId));
    if (!user) return res.status(404).json({ error: 'Учётная запись не найдена' });

    await query('UPDATE users SET is_active = $1 WHERE id = $2', [req.body.is_active, user.id]);
    console.log(`${req.body.is_active ? '✅ Разблокирован' : '⚠️ Заблокирован'} вход: ${user.login}`);
    res.json({ ok: true });
  })
);

module.exports = router;
