// routes/folders.js — папки библиотеки (только репетитор)
//   GET    /library-folders                 все папки с числом материалов
//   POST   /library-folders                 своя папка { title, parent_id? }
//   POST   /library-folders/book            папка учебника с папками юнитов { book } или { title, units: [..] }
//   PATCH  /library-folders/:id             переименовать, переложить, порядок
//   DELETE /library-folders/:id             удалить папку (материалы остаются в библиотеке без папки)
//   POST   /library-folders/move            переложить материалы { item_ids, folder_id | null }
const express = require('express');
const { z } = require('zod');
const { query, transaction } = require('../db');
const { requireRole } = require('../middleware/auth');
const { validateBody, asyncHandler } = require('../middleware/validate');
const { ownFolder } = require('../services/folders');
const { bookById } = require('../bank/books');

const router = express.Router();
router.use(requireRole('tutor'));

const title = z.string().trim().min(1, 'Введите название папки').max(120);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT f.id, f.parent_id, f.title, f.book, f.unit, f.position,
              (SELECT COUNT(*)::int FROM library_items li WHERE li.folder_id = f.id) AS count
         FROM library_folders f WHERE f.tutor_id = $1
        ORDER BY f.parent_id NULLS FIRST, f.position, f.id`,
      [req.user.tid]
    );
    const { rows: loose } = await query('SELECT COUNT(*)::int AS n FROM library_items WHERE tutor_id = $1 AND folder_id IS NULL', [req.user.tid]);
    res.json({ folders: rows, unfiled: loose[0].n });
  })
);

router.post(
  '/',
  validateBody(z.object({ title, parent_id: z.number().int().positive().nullable().optional() }).strict()),
  asyncHandler(async (req, res) => {
    const parent = await ownFolder(req.body.parent_id ?? null, req.user.tid);
    if (parent === undefined) return res.status(404).json({ error: 'Папка не найдена' });
    const { rows } = await query(
      `INSERT INTO library_folders (tutor_id, parent_id, title, position)
       VALUES ($1, $2, $3, (SELECT COALESCE(MAX(position), 0) + 1 FROM library_folders WHERE tutor_id = $1 AND parent_id IS NOT DISTINCT FROM $2))
       RETURNING id`,
      [req.user.tid, parent, req.body.title]
    );
    res.status(201).json({ id: rows[0].id });
  })
);

// Папка учебника: из известного учебника (юниты подставятся сами) или свой учебник со списком юнитов
router.post(
  '/book',
  validateBody(
    z.object({
      book: z.string().max(40).optional(),
      title: title.optional(),
      units: z.array(z.string().trim().min(1).max(120)).max(40).optional(),
    }).strict().refine((b) => b.book || b.title, 'Выберите учебник или введите название')
  ),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const known = b.book ? bookById(b.book) : null;
    if (b.book && !known) return res.status(404).json({ error: 'Такого учебника нет' });
    const name = known ? known.short : b.title;
    const units = known
      ? known.units.map((u) => ({ title: `${u.code}. ${u.title}`, unit: u.code }))
      : (b.units || []).map((t) => ({ title: t, unit: null }));
    if (known) {
      const { rows: had } = await query('SELECT id FROM library_folders WHERE tutor_id = $1 AND book = $2 AND parent_id IS NULL', [req.user.tid, known.id]);
      if (had[0]) return res.status(409).json({ error: `Папка «${name}» уже есть`, id: had[0].id });
    }
    const id = await transaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO library_folders (tutor_id, title, book, position)
         VALUES ($1, $2, $3, (SELECT COALESCE(MAX(position), 0) + 1 FROM library_folders WHERE tutor_id = $1 AND parent_id IS NULL))
         RETURNING id`,
        [req.user.tid, name, known ? known.id : null]
      );
      const top = rows[0].id;
      let pos = 0;
      for (const u of units) {
        await client.query(
          'INSERT INTO library_folders (tutor_id, parent_id, title, book, unit, position) VALUES ($1, $2, $3, $4, $5, $6)',
          [req.user.tid, top, u.title.slice(0, 120), known ? known.id : null, u.unit, ++pos]
        );
      }
      return top;
    });
    res.status(201).json({ id, units: units.length });
  })
);

router.post(
  '/move',
  validateBody(z.object({ item_ids: z.array(z.number().int().positive()).min(1).max(500), folder_id: z.number().int().positive().nullable() }).strict()),
  asyncHandler(async (req, res) => {
    const folder = await ownFolder(req.body.folder_id, req.user.tid);
    if (folder === undefined) return res.status(404).json({ error: 'Папка не найдена' });
    const { rowCount } = await query('UPDATE library_items SET folder_id = $1 WHERE id = ANY($2::int[]) AND tutor_id = $3', [folder, req.body.item_ids, req.user.tid]);
    res.json({ moved: rowCount });
  })
);

router.patch(
  '/:id',
  validateBody(z.object({ title: title.optional(), parent_id: z.number().int().positive().nullable().optional(), position: z.number().int().min(0).max(100000).optional() }).strict()),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if ((await ownFolder(id, req.user.tid)) === undefined) return res.status(404).json({ error: 'Папка не найдена' });
    const b = req.body;
    if (b.parent_id !== undefined) {
      const parent = await ownFolder(b.parent_id, req.user.tid);
      if (parent === undefined) return res.status(404).json({ error: 'Папка не найдена' });
      if (parent !== null) {
        // нельзя положить папку саму в себя или в свою подпапку
        const { rows } = await query(
          `WITH RECURSIVE up AS (SELECT id, parent_id FROM library_folders WHERE id = $1
             UNION ALL SELECT f.id, f.parent_id FROM library_folders f JOIN up ON f.id = up.parent_id)
           SELECT 1 FROM up WHERE id = $2`,
          [parent, id]
        );
        if (rows[0]) return res.status(422).json({ error: 'Нельзя положить папку в саму себя' });
      }
    }
    const sets = [];
    const vals = [];
    const push = (col, v) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
    if (b.title !== undefined) push('title', b.title);
    if (b.parent_id !== undefined) push('parent_id', b.parent_id);
    if (b.position !== undefined) push('position', b.position);
    if (sets.length) { vals.push(id); await query(`UPDATE library_folders SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals); }
    res.json({ ok: true });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { rows } = await query('DELETE FROM library_folders WHERE id = $1 AND tutor_id = $2 RETURNING id', [Number(req.params.id), req.user.tid]);
    if (!rows[0]) return res.status(404).json({ error: 'Папка не найдена' });
    res.json({ ok: true });
  })
);

module.exports = router;
