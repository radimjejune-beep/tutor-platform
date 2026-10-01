// routes/files.js — файлы: материалы к заданию (преподаватель) и вложения к работе (ученик)
// Файл приходит в JSON как base64; хранится в базе, до 10 МБ
const express = require('express');
const { z } = require('zod');
const { query } = require('../db');
const { canAccessStudent } = require('../middleware/auth');
const { validateBody, asyncHandler } = require('../middleware/validate');
const { visibleTaskIds } = require('./library');

const router = express.Router();
const MAX_BYTES = 10 * 1024 * 1024;

// Эти типы можно показывать прямо в браузере; всё остальное отдаём как «скачать файл»
const INLINE_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf',
  'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/x-m4a', 'video/mp4',
]);

const uploadSchema = z
  .object({
    assignment_id: z.number().int().positive().optional(),
    homework_id: z.number().int().positive().optional(),
    library_item_id: z.number().int().positive().optional(),
    filename: z.string().trim().min(1).max(255),
    mime: z.string().trim().max(100).default('application/octet-stream'),
    data: z.string().min(1), // base64
  })
  .strict()
  .refine(
    (b) => [b.assignment_id, b.homework_id, b.library_item_id].filter(Boolean).length === 1,
    'Укажите, к чему прикрепить файл'
  );

// Кто может прикрепить файл
async function canUpload(user, b) {
  if (user.role === 'tutor') return true;
  if (user.role !== 'student' || !b.homework_id) return false;
  const { rows } = await query('SELECT student_id, status FROM homework WHERE id = $1', [b.homework_id]);
  const hw = rows[0];
  return Boolean(hw && hw.status !== 'checked' && (await canAccessStudent(user, hw.student_id)));
}

// Кто может открыть файл
async function canRead(user, file) {
  if (user.role === 'tutor') return true;
  if (file.library_item_id) {
    const { rows } = await query('SELECT id, kind FROM library_items WHERE id = $1', [file.library_item_id]);
    if (!rows[0]) return false;
    if (rows[0].kind === 'theory') return true;
    return (await visibleTaskIds(user)).includes(rows[0].id);
  }
  if (file.homework_id) {
    const { rows } = await query('SELECT student_id FROM homework WHERE id = $1', [file.homework_id]);
    return Boolean(rows[0] && (await canAccessStudent(user, rows[0].student_id)));
  }
  // Материал задания — если задание выдано кому-то из «своих» учеников
  const { rows } = await query('SELECT student_id FROM homework WHERE assignment_id = $1', [file.assignment_id]);
  for (const r of rows) if (await canAccessStudent(user, r.student_id)) return true;
  return false;
}

// Имя файла без путей и управляющих символов
const safeName = (name) => name.replace(/[/\\\u0000-\u001f]/g, '_').slice(0, 255);

router.post(
  '/',
  express.json({ limit: '15mb' }),
  validateBody(uploadSchema),
  asyncHandler(async (req, res) => {
    const b = req.body;
    if (!(await canUpload(req.user, b))) return res.status(403).json({ error: 'Сюда нельзя прикрепить файл' });

    const buf = Buffer.from(b.data, 'base64');
    if (!buf.length) return res.status(400).json({ error: 'Файл пустой' });
    if (buf.length > MAX_BYTES) return res.status(413).json({ error: 'Файл больше 10 МБ' });

    const { rows } = await query(
      `INSERT INTO files (assignment_id, homework_id, library_item_id, filename, mime, size_bytes, data, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, filename, mime, size_bytes, uploaded_by, created_at`,
      [b.assignment_id || null, b.homework_id || null, b.library_item_id || null, safeName(b.filename), b.mime, buf.length, buf, req.user.id]
    );
    console.log(`✅ Файл «${rows[0].filename}» (${Math.round(buf.length / 1024)} КБ)`);
    res.status(201).json(rows[0]);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { rows } = await query('SELECT * FROM files WHERE id = $1', [Number(req.params.id)]);
    const file = rows[0];
    if (!file || !(await canRead(req.user, file))) return res.status(404).json({ error: 'Файл не найден' });

    const inline = INLINE_TYPES.has(file.mime);
    res.set({
      'Content-Type': inline ? file.mime : 'application/octet-stream',
      'Content-Length': file.size_bytes,
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      'Cache-Control': 'private, max-age=3600',
    });
    res.send(file.data);
  })
);

// Удалить: преподаватель — любой; ученик — свой, пока работа не проверена
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT f.id, f.uploaded_by, h.status
         FROM files f LEFT JOIN homework h ON h.id = f.homework_id
        WHERE f.id = $1`,
      [Number(req.params.id)]
    );
    const f = rows[0];
    const allowed = f && (req.user.role === 'tutor' || (f.uploaded_by === req.user.id && f.status !== 'checked'));
    if (!allowed) return res.status(404).json({ error: 'Файл не найден' });
    await query('DELETE FROM files WHERE id = $1', [f.id]);
    console.log(`🗑️ Файл #${f.id} удалён`);
    res.json({ ok: true });
  })
);

module.exports = router;
