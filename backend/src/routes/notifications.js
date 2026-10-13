// routes/notifications.js — колокольчик: список уведомлений и отметка «прочитано»
const express = require('express');
const { z } = require('zod');
const { query } = require('../db');
const { validateBody, asyncHandler } = require('../middleware/validate');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT id, kind, title, body, link, read_at, created_at FROM notifications
        WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    const { rows: c } = await query('SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL', [req.user.id]);
    res.json({ items: rows, unread: c[0].n });
  })
);

// Только счётчик — его кабинет спрашивает раз в минуту
router.get(
  '/unread',
  asyncHandler(async (req, res) => {
    const { rows } = await query('SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL', [req.user.id]);
    res.json({ unread: rows[0].n });
  })
);

router.post(
  '/read',
  validateBody(z.object({ ids: z.array(z.number().int().positive()).max(200).optional(), all: z.boolean().optional() }).strict()),
  asyncHandler(async (req, res) => {
    if (req.body.all) {
      await query('UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL', [req.user.id]);
    } else if (req.body.ids?.length) {
      await query('UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND id = ANY($2::int[]) AND read_at IS NULL', [
        req.user.id,
        req.body.ids,
      ]);
    }
    // Старое прочитанное подчищаем, чтобы таблица не росла бесконечно
    await query("DELETE FROM notifications WHERE user_id = $1 AND read_at < NOW() - INTERVAL '60 days'", [req.user.id]);
    res.json({ ok: true });
  })
);

module.exports = router;
