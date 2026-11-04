// routes/bank.js — банк заданий по учебникам (только для репетиторов)
//   GET    /bank/books                      учебники, юниты и сколько в них заданий
//   GET    /bank/vocab?book=&unit=          слова юнита (подборка по теме)
//   GET    /bank/items?book=&unit=          задания юнита
//   GET    /bank/items/:id                  задание целиком (для просмотра)
//   POST   /bank/items/:id/take             взять себе: копия в библиотеку
//   POST   /bank/share                      поделиться своим заданием из библиотеки
//   DELETE /bank/items/:id                  убрать из банка (автор или сисадмин)
const express = require('express');
const { z } = require('zod');
const { query, transaction } = require('../db');
const { requireRole } = require('../middleware/auth');
const { validateBody, asyncHandler } = require('../middleware/validate');
const { BOOKS, bookById, unitOf } = require('../bank/books');
const { vocabOf } = require('../bank/vocab');
const { folderForUnit } = require('../services/folders');

const router = express.Router();
router.use(requireRole('tutor'));

const ITEM_FIELDS = `b.id, b.book, b.unit, b.kind, b.title, b.body, b.game, b.tags, b.uses, b.created_at, b.author_id,
  CASE WHEN b.seed_key IS NOT NULL THEN 'Lessonfold' ELSE COALESCE(u.full_name, 'Репетитор') END AS author,
  CASE WHEN b.seed_key LIKE 'voc-%' THEN 'words' ELSE 'main' END AS section`;

router.get(
  '/books',
  asyncHandler(async (req, res) => {
    const { rows } = await query('SELECT book, unit, COUNT(*)::int AS n FROM bank_items WHERE NOT hidden GROUP BY book, unit');
    const count = new Map(rows.map((r) => [`${r.book}/${r.unit}`, r.n]));
    res.json(BOOKS.map((b) => ({ ...b, units: b.units.map((u) => ({ ...u, count: count.get(`${b.id}/${u.code}`) || 0, words: vocabOf(b.id, u.code).length })), total: b.units.reduce((n, u) => n + (count.get(`${b.id}/${u.code}`) || 0), 0) })));
  })
);

// Слова юнита: подборка Lessonfold по теме юнита (из неё можно сделать набор карточек)
router.get(
  '/vocab',
  asyncHandler(async (req, res) => {
    const book = String(req.query.book || '');
    const unit = String(req.query.unit || '');
    if (!unitOf(book, unit)) return res.status(404).json({ error: 'Такого юнита нет' });
    res.json({ words: vocabOf(book, unit) });
  })
);

router.get(
  '/items',
  asyncHandler(async (req, res) => {
    const book = String(req.query.book || '');
    const unit = String(req.query.unit || '');
    if (!unitOf(book, unit)) return res.status(404).json({ error: 'Такого юнита нет' });
    const { rows } = await query(
      `SELECT ${ITEM_FIELDS}, t.library_id AS taken_id
         FROM bank_items b LEFT JOIN users u ON u.id = b.author_id
         LEFT JOIN bank_takes t ON t.item_id = b.id AND t.tutor_id = $3
        WHERE b.book = $1 AND b.unit = $2 AND NOT b.hidden
        ORDER BY (COALESCE(b.seed_key, '') LIKE 'voc-%'), (b.seed_key IS NULL), b.id`,
      [book, unit, req.user.id]
    );
    res.json(rows.map((r) => ({ ...r, mine: r.author_id === req.user.id })));
  })
);

router.get(
  '/items/:id',
  asyncHandler(async (req, res) => {
    const { rows } = await query(`SELECT ${ITEM_FIELDS} FROM bank_items b LEFT JOIN users u ON u.id = b.author_id WHERE b.id = $1 AND NOT b.hidden`, [Number(req.params.id)]);
    if (!rows[0]) return res.status(404).json({ error: 'Задание не найдено' });
    res.json({ ...rows[0], subject: 'Английский язык', files: [] });
  })
);

// Взять себе: копия в библиотеку репетитора с тегами учебника и юнита. Повторно не копируем
router.post(
  '/items/:id/take',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const out = await transaction(async (client) => {
      const { rows } = await client.query('SELECT * FROM bank_items WHERE id = $1 AND NOT hidden', [id]);
      const b = rows[0];
      if (!b) return null;
      const { rows: had } = await client.query(
        `SELECT t.library_id FROM bank_takes t JOIN library_items li ON li.id = t.library_id AND li.tutor_id = $2 WHERE t.item_id = $1 AND t.tutor_id = $2`,
        [id, req.user.id]
      );
      if (had[0]) return { library_id: had[0].library_id, again: true };
      const book = bookById(b.book);
      const tags = [...new Set([...(b.tags || []), book ? book.short : b.book, `${book ? book.short : b.book} ${b.unit}`, 'банк'])].slice(0, 20);
      // если есть папка этого учебника и юнита, задание сразу ложится в неё
      const folder = await folderForUnit(req.user.tid, b.book, b.unit).catch(() => null);
      const { rows: li } = await client.query(
        `INSERT INTO library_items (kind, subject, title, body, answer, tags, game, tutor_id${folder ? ', folder_id' : ''})
         VALUES ($1, 'Английский язык', $2, $3, $4, $5, $6, $7${folder ? ', $8' : ''}) RETURNING id`,
        [b.kind, b.title, b.body, b.answer, tags, b.game ? JSON.stringify(b.game) : null, req.user.id, ...(folder ? [folder] : [])]
      );
      await client.query(
        `INSERT INTO bank_takes (item_id, tutor_id, library_id) VALUES ($1, $2, $3)
         ON CONFLICT (item_id, tutor_id) DO UPDATE SET library_id = EXCLUDED.library_id, taken_at = NOW()`,
        [id, req.user.id, li[0].id]
      );
      await client.query('UPDATE bank_items SET uses = uses + 1 WHERE id = $1', [id]);
      return { library_id: li[0].id, again: false };
    });
    if (!out) return res.status(404).json({ error: 'Задание не найдено' });
    res.json(out);
  })
);

// Поделиться своим заданием: в банк уходит копия, автор подтверждает, что задание его
router.post(
  '/share',
  validateBody(
    z.object({
      library_item_id: z.number().int().positive(),
      book: z.string().max(40),
      unit: z.string().max(10),
      own_work: z.literal(true, { errorMap: () => ({ message: 'Подтвердите, что задание ваше и в нём нет текстов из учебника' }) }),
    }).strict()
  ),
  asyncHandler(async (req, res) => {
    const b = req.body;
    if (!unitOf(b.book, b.unit)) return res.status(422).json({ error: 'Выберите учебник и юнит' });
    const { rows } = await query('SELECT * FROM library_items WHERE id = $1 AND tutor_id = $2', [b.library_item_id, req.user.id]);
    const li = rows[0];
    if (!li) return res.status(404).json({ error: 'Материал не найден' });
    if (!['task', 'game', 'theory'].includes(li.kind)) return res.status(422).json({ error: 'В банк можно отправить задачу, упражнение или теорию' });
    const { rows: f } = await query('SELECT 1 FROM files WHERE library_item_id = $1 LIMIT 1', [li.id]);
    if (f[0]) return res.status(422).json({ error: 'К материалу прикреплены файлы. В банк пока принимаются задания без файлов: фото и аудио могут быть из учебника' });
    const { rows: dup } = await query('SELECT id FROM bank_items WHERE author_id = $1 AND title = $2 AND book = $3 AND unit = $4 AND NOT hidden', [req.user.id, li.title, b.book, b.unit]);
    if (dup[0]) return res.status(409).json({ error: 'Это задание уже есть в банке в этом юните' });
    const { rows: ins } = await query(
      `INSERT INTO bank_items (book, unit, kind, title, body, answer, game, tags, author_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [b.book, b.unit, li.kind, li.title, li.body, li.answer, li.game ? JSON.stringify(li.game) : null, (li.tags || []).filter((t) => t !== 'банк' && t !== 'каталог').slice(0, 10), req.user.id]
    );
    console.log(`📚 Банк: ${req.user.login} поделился «${li.title}» (${b.book} ${b.unit})`);
    res.status(201).json({ id: ins[0].id });
  })
);

router.delete(
  '/items/:id',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      'UPDATE bank_items SET hidden = true WHERE id = $1 AND (author_id = $2 OR $3) RETURNING id',
      [Number(req.params.id), req.user.id, Boolean(req.user.is_admin)]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Убрать можно только своё задание' });
    res.json({ ok: true });
  })
);

module.exports = router;
