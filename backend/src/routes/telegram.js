// routes/telegram.js — подключение Telegram в кабинете
const express = require('express');
const { query } = require('../db');
const { requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/validate');
const tg = require('../services/telegram');

const router = express.Router();

// Включён ли бот и подключён ли текущий пользователь
router.get(
  '/status',
  asyncHandler(async (req, res) => {
    const { rows } = await query('SELECT username, linked_at FROM telegram_links WHERE user_id = $1', [req.user.id]);
    res.json({
      enabled: tg.enabled() && Boolean(tg.username()),
      bot_username: tg.username(),
      linked: Boolean(rows[0]),
      linked_at: rows[0]?.linked_at || null,
    });
  })
);

// Ссылка на бота с одноразовым кодом
router.post(
  '/link',
  requireRole('student', 'parent'),
  asyncHandler(async (req, res) => {
    if (!tg.enabled() || !tg.username()) return res.status(409).json({ error: 'Уведомления в Telegram пока не настроены' });
    res.json({ url: await tg.createLinkCode(req.user.id) });
  })
);

router.delete(
  '/link',
  asyncHandler(async (req, res) => {
    await query('DELETE FROM telegram_links WHERE user_id = $1', [req.user.id]);
    res.json({ ok: true });
  })
);

// Преподаватель: кто из учеников и родителей подключён
router.get(
  '/overview',
  requireRole('tutor'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT u.id, u.full_name, u.role, tl.linked_at,
              COALESCE((SELECT string_agg(s.full_name, ', ') FROM students s
                         WHERE s.user_id = u.id OR s.id IN (SELECT student_id FROM parent_students WHERE parent_user_id = u.id)), '') AS students
         FROM users u LEFT JOIN telegram_links tl ON tl.user_id = u.id
        WHERE u.role IN ('parent', 'student') AND u.is_active
        ORDER BY tl.linked_at IS NULL, u.full_name`
    );
    res.json({ enabled: tg.enabled() && Boolean(tg.username()), bot_username: tg.username(), users: rows });
  })
);

module.exports = router;
