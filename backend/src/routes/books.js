// routes/books.js — учебники преподавателя в библиотеке: PDF и другие файлы до 200 МБ.
// Видит только сам преподаватель (ученикам учебники не показываются). Файл загружается частями по 4 МБ,
// части лежат в базе. Таблицы создаются при запуске сервера, миграцию запускать не нужно.
//   GET    /library-books                     список (без содержимого)
//   POST   /library-books                     начать загрузку { title, filename, mime, size_bytes, folder_id? }
//   PUT    /library-books/:id/parts/:n        часть файла (application/octet-stream)
//   POST   /library-books/:id/finish          загрузка закончена
//   GET    /library-books/:id/file            файл целиком (для просмотра и скачивания)
//   PATCH  /library-books/:id                 название, папка
//   DELETE /library-books/:id
const express = require('express');
const { z } = require('zod');
const { query } = require('../db');
const { requireRole } = require('../middleware/auth');
const { validateBody, asyncHandler } = require('../middleware/validate');
const { ownFolder } = require('../services/folders');

const router = express.Router();
router.use(requireRole('tutor'));

const PART = 4 * 1024 * 1024;
const MAX_FILE = 200 * 1024 * 1024;
// Общий объём учебников одного преподавателя: база не резиновая
const QUOTA = Number(process.env['BOOKS_QUOTA_MB'] || 1024) * 1024 * 1024;
const TYPES = {
  'application/pdf': 'pdf',
  'application/epub+zip': 'epub',
  'image/vnd.djvu': 'djvu',
  'image/x-djvu': 'djvu',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/zip': 'zip',
  'audio/mpeg': 'mp3',
};

let ready = null;
function ensure() {
  if (!ready) {
    ready = query(`
      CREATE TABLE IF NOT EXISTS library_books (
        id          SERIAL PRIMARY KEY,
        tutor_id    INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title       VARCHAR(200) NOT NULL,
        filename    VARCHAR(255) NOT NULL,
        mime        VARCHAR(120) NOT NULL,
        size_bytes  BIGINT       NOT NULL,
        parts       INTEGER      NOT NULL,
        folder_id   INTEGER      REFERENCES library_folders(id) ON DELETE SET NULL,
        status      VARCHAR(12)  NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading', 'ready')),
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_library_books_tutor ON library_books (tutor_id, created_at DESC);
      CREATE TABLE IF NOT EXISTS library_book_parts (
        book_id  INTEGER NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
        n        INTEGER NOT NULL,
        data     BYTEA   NOT NULL,
        PRIMARY KEY (book_id, n)
      );
    `).catch((err) => { ready = null; throw err; });
  }
  return ready;
}
router.use(asyncHandler(async (req, res, next) => { await ensure(); next(); }));

async function ownBook(id, tutorId) {
  const { rows } = await query('SELECT * FROM library_books WHERE id = $1 AND tutor_id = $2', [id, tutorId]);
  return rows[0] || null;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    // недогруженные дольше суток — мусор после закрытой вкладки
    await query("DELETE FROM library_books WHERE tutor_id = $1 AND status = 'uploading' AND created_at < NOW() - INTERVAL '1 day'", [req.user.tid]);
    const { rows } = await query(
      `SELECT id, title, filename, mime, size_bytes, folder_id, status, created_at FROM library_books
        WHERE tutor_id = $1 AND status = 'ready' ORDER BY created_at DESC`,
      [req.user.tid]
    );
    const used = rows.reduce((n, b) => n + Number(b.size_bytes), 0);
    res.json({ books: rows.map((b) => ({ ...b, size_bytes: Number(b.size_bytes) })), used, quota: QUOTA, max_file: MAX_FILE });
  })
);

router.post(
  '/',
  validateBody(z.object({
    title: z.string().trim().min(1, 'Введите название').max(200),
    filename: z.string().trim().min(1).max(255),
    mime: z.string().trim().max(120),
    size_bytes: z.number().int().positive(),
    folder_id: z.number().int().positive().nullable().optional(),
  }).strict()),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const ext = (b.filename.split('.').pop() || '').toLowerCase();
    const mime = TYPES[b.mime] ? b.mime : Object.keys(TYPES).find((m) => TYPES[m] === ext);
    if (!mime) return res.status(422).json({ error: 'Подойдут PDF, DjVu, EPUB, DOCX, ZIP или MP3' });
    if (b.size_bytes > MAX_FILE) return res.status(413).json({ error: 'Файл больше 200 МБ. Сожмите PDF или разделите учебник на части' });
    const { rows: u } = await query("SELECT COALESCE(SUM(size_bytes), 0)::bigint AS n FROM library_books WHERE tutor_id = $1", [req.user.tid]);
    if (Number(u[0].n) + b.size_bytes > QUOTA) return res.status(413).json({ error: `Не хватает места: учебники занимают больше ${Math.round(QUOTA / 1024 / 1024)} МБ. Удалите ненужные` });
    const folder = await ownFolder(b.folder_id ?? null, req.user.tid);
    if (folder === undefined) return res.status(404).json({ error: 'Папка не найдена' });
    const parts = Math.ceil(b.size_bytes / PART);
    const { rows } = await query(
      `INSERT INTO library_books (tutor_id, title, filename, mime, size_bytes, parts, folder_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [req.user.tid, b.title, b.filename, mime, b.size_bytes, parts, folder]
    );
    res.status(201).json({ id: rows[0].id, part_size: PART, parts });
  })
);

router.put(
  '/:id/parts/:n',
  express.raw({ type: () => true, limit: PART + 1024 }),
  asyncHandler(async (req, res) => {
    const book = await ownBook(Number(req.params.id), req.user.tid);
    if (!book || book.status !== 'uploading') return res.status(404).json({ error: 'Загрузка не найдена' });
    const n = Number(req.params.n);
    if (!Number.isInteger(n) || n < 0 || n >= book.parts) return res.status(422).json({ error: 'Неверный номер части' });
    const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const expected = n === book.parts - 1 ? Number(book.size_bytes) - PART * (book.parts - 1) : PART;
    if (buf.length !== expected) return res.status(422).json({ error: `Часть ${n + 1} пришла не целиком, загрузите ещё раз` });
    await query('INSERT INTO library_book_parts (book_id, n, data) VALUES ($1, $2, $3) ON CONFLICT (book_id, n) DO UPDATE SET data = EXCLUDED.data', [book.id, n, buf]);
    res.json({ ok: true });
  })
);

router.post(
  '/:id/finish',
  asyncHandler(async (req, res) => {
    const book = await ownBook(Number(req.params.id), req.user.tid);
    if (!book) return res.status(404).json({ error: 'Учебник не найден' });
    const { rows } = await query('SELECT COUNT(*)::int AS n, COALESCE(SUM(length(data)), 0)::bigint AS size FROM library_book_parts WHERE book_id = $1', [book.id]);
    if (rows[0].n !== book.parts || Number(rows[0].size) !== Number(book.size_bytes)) return res.status(422).json({ error: 'Загрузились не все части, попробуйте ещё раз' });
    await query("UPDATE library_books SET status = 'ready' WHERE id = $1", [book.id]);
    console.log(`📘 Учебник загружен: «${book.title}», ${Math.round(Number(book.size_bytes) / 1024 / 1024)} МБ`);
    res.json({ ok: true });
  })
);

// Файл целиком: отдаём по частям, не собирая в памяти
router.get(
  '/:id/file',
  asyncHandler(async (req, res) => {
    const book = await ownBook(Number(req.params.id), req.user.tid);
    if (!book || book.status !== 'ready') return res.status(404).json({ error: 'Учебник не найден' });
    const name = encodeURIComponent(book.filename);
    res.writeHead(200, {
      'Content-Type': book.mime,
      'Content-Length': String(book.size_bytes),
      'Content-Disposition': `${req.query.download ? 'attachment' : 'inline'}; filename*=UTF-8''${name}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    for (let n = 0; n < book.parts; n++) {
      const { rows } = await query('SELECT data FROM library_book_parts WHERE book_id = $1 AND n = $2', [book.id, n]);
      if (!rows[0]) break;
      if (!res.write(rows[0].data)) await new Promise((r) => res.once('drain', r));
    }
    res.end();
  })
);

router.patch(
  '/:id',
  validateBody(z.object({ title: z.string().trim().min(1).max(200).optional(), folder_id: z.number().int().positive().nullable().optional() }).strict()),
  asyncHandler(async (req, res) => {
    const book = await ownBook(Number(req.params.id), req.user.tid);
    if (!book) return res.status(404).json({ error: 'Учебник не найден' });
    if (req.body.folder_id !== undefined && (await ownFolder(req.body.folder_id, req.user.tid)) === undefined) return res.status(404).json({ error: 'Папка не найдена' });
    await query(
      'UPDATE library_books SET title = COALESCE($2, title), folder_id = CASE WHEN $3 THEN $4::int ELSE folder_id END WHERE id = $1',
      [book.id, req.body.title ?? null, req.body.folder_id !== undefined, req.body.folder_id ?? null]
    );
    res.json({ ok: true });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { rows } = await query('DELETE FROM library_books WHERE id = $1 AND tutor_id = $2 RETURNING id', [Number(req.params.id), req.user.tid]);
    if (!rows[0]) return res.status(404).json({ error: 'Учебник не найден' });
    res.json({ ok: true });
  })
);

module.exports = router;
module.exports.ensure = ensure;
