// routes/market.js — каталог уроков между репетиторами
// Бесплатное копируется сразу. Платное: заявка автору → он получает оплату сам → «Выдать доступ» → копия у покупателя
const express = require('express');
const { z } = require('zod');
const { query, transaction } = require('../db');
const { requireRole, owns } = require('../middleware/auth');
const { validateBody, asyncHandler } = require('../middleware/validate');
const notify = require('../services/notify');

const router = express.Router();
router.use(requireRole('tutor'));

const KIND_LABEL = { html: 'Интерактивный урок', game: 'Упражнение', task: 'Задача', theory: 'Теория' };

// Копия материала в библиотеку покупателя (вместе с файлами)
async function copyItem(client, srcId, buyerId) {
  const { rows } = await client.query(
    `INSERT INTO library_items (kind, subject, title, body, answer, exam, exam_task, tags, links, game, html, tutor_id)
     SELECT kind, subject, title, body, answer, exam, exam_task, array_append(tags, 'каталог'), links, game, html, $2
       FROM library_items WHERE id = $1
     RETURNING id`,
    [srcId, buyerId]
  );
  if (!rows[0]) return null;
  // Файлы копируются по одному, чтобы знать новые id: в листе с заданиями фото и аудио указаны по id
  const { rows: files } = await client.query('SELECT id FROM files WHERE library_item_id = $1 ORDER BY id', [srcId]);
  const map = {};
  for (const f of files) {
    const { rows: c } = await client.query(
      `INSERT INTO files (library_item_id, filename, mime, size_bytes, data, uploaded_by)
       SELECT $2, filename, mime, size_bytes, data, $3 FROM files WHERE id = $1 RETURNING id`,
      [f.id, rows[0].id, buyerId]
    );
    map[f.id] = c[0].id;
  }
  const { rows: g } = await client.query('SELECT game FROM library_items WHERE id = $1', [rows[0].id]);
  if (g[0].game?.type === 'sheet') {
    const remap = (id) => (id ? map[id] || null : id);
    const blocks = g[0].game.blocks.map((b) => ({ ...b, ...(b.image !== undefined ? { image: remap(b.image) } : {}), ...(b.audio !== undefined ? { audio: remap(b.audio) } : {}) }))
      .filter((b) => b.t !== 'page' || b.image);
    await client.query('UPDATE library_items SET game = $1 WHERE id = $2', [JSON.stringify({ ...g[0].game, blocks }), rows[0].id]);
  }
  return rows[0].id;
}

// Каталог: чужие опубликованные материалы и мой статус по каждому
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT m.id, m.title, m.description, m.level, m.price, m.created_at, i.kind, i.subject,
              u.full_name AS author_name, (m.author_id = $1) AS mine,
              o.status AS my_order, o.copied_item_id,
              (SELECT COUNT(*)::int FROM market_orders x WHERE x.market_item_id = m.id AND x.status = 'granted') AS copies
         FROM market_items m
         JOIN library_items i ON i.id = m.item_id
         JOIN users u ON u.id = m.author_id AND u.is_active
         LEFT JOIN market_orders o ON o.market_item_id = m.id AND o.buyer_id = $1
        WHERE m.published
        ORDER BY m.created_at DESC
        LIMIT 200`,
      [req.user.id]
    );
    res.json(rows.map((r) => ({ ...r, kind_label: KIND_LABEL[r.kind] })));
  })
);

// Мои публикации и заявки на них
router.get(
  '/mine',
  asyncHandler(async (req, res) => {
    const { rows: items } = await query(
      `SELECT m.*, i.kind, i.title AS item_title FROM market_items m JOIN library_items i ON i.id = m.item_id
        WHERE m.author_id = $1 ORDER BY m.created_at DESC`,
      [req.user.id]
    );
    const { rows: orders } = await query(
      `SELECT o.id, o.status, o.created_at, o.decided_at, m.title, m.price, u.full_name AS buyer_name, u.login AS buyer_login
         FROM market_orders o JOIN market_items m ON m.id = o.market_item_id JOIN users u ON u.id = o.buyer_id
        WHERE m.author_id = $1 AND m.price > 0
        ORDER BY (o.status = 'requested') DESC, o.created_at DESC
        LIMIT 100`,
      [req.user.id]
    );
    res.json({ items, orders });
  })
);

// Опубликовать свой материал (повторно — обновить описание и цену)
router.post(
  '/',
  validateBody(
    z
      .object({
        item_id: z.number().int().positive(),
        title: z.string().trim().min(3).max(255),
        description: z.string().trim().max(3000).optional(),
        level: z.string().trim().max(50).optional(),
        price: z.number().int().min(0).max(100000).default(0),
      })
      .strict()
  ),
  asyncHandler(async (req, res) => {
    const b = req.body;
    if (!(await owns(req.user, 'library_items', b.item_id))) return res.status(404).json({ error: 'Материал не найден' });
    // Купленное в каталоге перепродавать нельзя
    const { rows: bought } = await query('SELECT 1 FROM market_orders WHERE copied_item_id = $1', [b.item_id]);
    if (bought[0]) return res.status(409).json({ error: 'Этот материал получен из каталога, его нельзя опубликовать заново' });
    const { rows } = await query(
      `INSERT INTO market_items (author_id, item_id, title, description, level, price)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (item_id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description,
         level = EXCLUDED.level, price = EXCLUDED.price, published = TRUE
       RETURNING *`,
      [req.user.id, b.item_id, b.title, b.description || null, b.level || null, b.price]
    );
    console.log(`✅ В каталоге: «${b.title}» (${b.price} ₽)`);
    res.status(201).json(rows[0]);
  })
);

// Снять с публикации
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { rows } = await query('UPDATE market_items SET published = FALSE WHERE id = $1 AND author_id = $2 RETURNING id', [
      Number(req.params.id),
      req.user.id,
    ]);
    if (!rows[0]) return res.status(404).json({ error: 'Не найдено' });
    res.json({ ok: true });
  })
);

// Получить: бесплатное — сразу в библиотеку, платное — заявка автору
router.post(
  '/:id/get',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT m.*, u.full_name AS author_name FROM market_items m JOIN users u ON u.id = m.author_id
        WHERE m.id = $1 AND m.published AND u.is_active`,
      [Number(req.params.id)]
    );
    const m = rows[0];
    if (!m) return res.status(404).json({ error: 'Материал не найден' });
    if (m.author_id === req.user.id) return res.status(400).json({ error: 'Это ваш материал' });
    const { rows: existing } = await query('SELECT * FROM market_orders WHERE market_item_id = $1 AND buyer_id = $2', [m.id, req.user.id]);
    if (existing[0]?.status === 'granted') return res.json({ status: 'granted', item_id: existing[0].copied_item_id });
    if (existing[0]?.status === 'requested') return res.json({ status: 'requested' });

    if (m.price === 0) {
      const itemId = await transaction(async (client) => {
        const id = await copyItem(client, m.item_id, req.user.id);
        await client.query(
          `INSERT INTO market_orders (market_item_id, buyer_id, status, copied_item_id, decided_at) VALUES ($1, $2, 'granted', $3, NOW())
           ON CONFLICT (market_item_id, buyer_id) DO UPDATE SET status = 'granted', copied_item_id = EXCLUDED.copied_item_id, decided_at = NOW()`,
          [m.id, req.user.id, id]
        );
        return id;
      });
      return res.json({ status: 'granted', item_id: itemId });
    }

    await query(
      `INSERT INTO market_orders (market_item_id, buyer_id) VALUES ($1, $2)
       ON CONFLICT (market_item_id, buyer_id) DO UPDATE SET status = 'requested', created_at = NOW(), decided_at = NULL`,
      [m.id, req.user.id]
    );
    notify.toTutor(m.author_id, {
      kind: 'market_order',
      title: `Хотят купить: ${m.title}`,
      body: `${req.user.full_name} (логин ${req.user.login}), ${m.price} ₽. Договоритесь об оплате и выдайте доступ`,
      link: '/market/mine',
    });
    res.json({ status: 'requested' });
  })
);

// Автор: выдать доступ (после оплаты) или отказать
const ownOrder = async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT o.*, m.item_id, m.title, m.author_id FROM market_orders o JOIN market_items m ON m.id = o.market_item_id
        WHERE o.id = $1 AND m.author_id = $2`,
      [Number(req.params.oid), req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Заявка не найдена' });
    req.order = rows[0];
    next();
  } catch (err) {
    next(err);
  }
};

router.post(
  '/orders/:oid/grant',
  ownOrder,
  asyncHandler(async (req, res) => {
    const o = req.order;
    if (o.status === 'granted') return res.json({ ok: true });
    await transaction(async (client) => {
      const id = await copyItem(client, o.item_id, o.buyer_id);
      await client.query("UPDATE market_orders SET status = 'granted', copied_item_id = $2, decided_at = NOW() WHERE id = $1", [o.id, id]);
    });
    notify.toTutor(o.buyer_id, { kind: 'market_granted', title: `Доступ открыт: ${o.title}`, body: 'Материал уже в вашей библиотеке', link: '/library/lessons' });
    res.json({ ok: true });
  })
);

router.post(
  '/orders/:oid/decline',
  ownOrder,
  asyncHandler(async (req, res) => {
    await query("UPDATE market_orders SET status = 'declined', decided_at = NOW() WHERE id = $1", [req.order.id]);
    notify.toTutor(req.order.buyer_id, { kind: 'market_declined', title: `Заявка отклонена: ${req.order.title}`, link: '/market' });
    res.json({ ok: true });
  })
);

module.exports = router;
