// routes/library.js — библиотека: теория (видят все) и задачник (только преподаватель)
// Ученик видит условие задачи, только если она выдана ему на уроке или в домашнем задании.
const express = require('express');
const { z } = require('zod');
const { query } = require('../db');
const { requireRole, accessibleStudentIds } = require('../middleware/auth');
const { validateBody, asyncHandler } = require('../middleware/validate');
const { buildUpdate } = require('../utils');

const router = express.Router();
const tutorOnly = requireRole('tutor');

const FILE_META = 'id, filename, mime, size_bytes, uploaded_by, created_at';
// Поля, которые может видеть ученик (без ответа и заметок преподавателя)
const PUBLIC_FIELDS = 'id, kind, subject, title, body, exam, exam_task, links';

// Какие задачи доступны ученику/родителю: из его уроков и его заданий
async function visibleTaskIds(user) {
  const ids = await accessibleStudentIds(user);
  if (ids === null) return null;
  const { rows } = await query(
    `SELECT li.item_id AS id FROM lesson_items li JOIN lessons l ON l.id = li.lesson_id WHERE l.student_id = ANY($1)
     UNION
     SELECT unnest(a.library_item_ids) FROM assignments a
       JOIN homework h ON h.assignment_id = a.id WHERE h.student_id = ANY($1)`,
    [ids]
  );
  return rows.map((r) => r.id);
}

async function canSeeItem(user, item) {
  if (user.role === 'tutor' || item.kind === 'theory') return true;
  const ids = await visibleTaskIds(user);
  return ids.includes(item.id);
}

// Прикрепить материалы (метаданные файлов) к списку элементов
async function withFiles(items) {
  if (!items.length) return items;
  const { rows } = await query(
    `SELECT ${FILE_META}, library_item_id FROM files WHERE library_item_id = ANY($1) ORDER BY id`,
    [items.map((i) => i.id)]
  );
  return items.map((i) => ({ ...i, files: rows.filter((f) => f.library_item_id === i.id) }));
}

// ------------------------------------------------------------
// Список. ?kind=theory|task&subject=&exam=&exam_task=&tag=&q=
// Ученик/родитель: только теория
// ------------------------------------------------------------
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const isTutor = req.user.role === 'tutor';
    const kind = isTutor ? (['theory', 'task'].includes(req.query.kind) ? req.query.kind : null) : 'theory';
    const examTask = Number(req.query.exam_task) || null;
    const { rows } = await query(
      `SELECT ${isTutor ? '*' : PUBLIC_FIELDS + ', tags, updated_at'},
              (SELECT COUNT(*)::int FROM files f WHERE f.library_item_id = library_items.id) AS files_count
         FROM library_items
        WHERE ($1::text IS NULL OR kind = $1::text)
          AND ($2::text IS NULL OR subject = $2::text)
          AND ($3::text IS NULL OR exam = $3::text)
          AND ($4::int IS NULL OR exam_task = $4::int)
          AND ($5::text IS NULL OR $5::text = ANY(tags))
          AND ($6::text IS NULL OR title ILIKE '%' || $6::text || '%' OR body ILIKE '%' || $6::text || '%'
               OR tutor_note ILIKE '%' || $6::text || '%')
        ORDER BY subject, exam NULLS LAST, exam_task NULLS LAST, title`,
      [kind, req.query.subject || null, req.query.exam || null, examTask, req.query.tag || null, (req.query.q || '').trim() || null]
    );
    res.json(rows);
  })
);

// Справочники для фильтров: предметы и теги
router.get(
  '/facets',
  asyncHandler(async (req, res) => {
    const kindFilter = req.user.role === 'tutor' ? '' : "WHERE kind = 'theory'";
    const { rows: subjects } = await query(`SELECT DISTINCT subject FROM library_items ${kindFilter} ORDER BY 1`);
    const { rows: tags } = await query(`SELECT DISTINCT unnest(tags) AS tag FROM library_items ${kindFilter} ORDER BY 1`);
    res.json({ subjects: subjects.map((r) => r.subject), tags: tags.map((r) => r.tag) });
  })
);

// Несколько задач по id (для ДЗ и комнаты урока) — ученик получает только доступные ему
router.get(
  '/batch',
  asyncHandler(async (req, res) => {
    const ids = String(req.query.ids || '')
      .split(',')
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0)
      .slice(0, 100);
    if (!ids.length) return res.json([]);
    const isTutor = req.user.role === 'tutor';
    let { rows } = await query(`SELECT ${isTutor ? '*' : PUBLIC_FIELDS} FROM library_items WHERE id = ANY($1)`, [ids]);
    if (!isTutor) {
      const visible = new Set(await visibleTaskIds(req.user));
      rows = rows.filter((r) => r.kind === 'theory' || visible.has(r.id));
    }
    rows.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    res.json(await withFiles(rows));
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const isTutor = req.user.role === 'tutor';
    const { rows } = await query(`SELECT ${isTutor ? '*' : PUBLIC_FIELDS} FROM library_items WHERE id = $1`, [Number(req.params.id)]);
    if (!rows[0] || !(await canSeeItem(req.user, rows[0]))) return res.status(404).json({ error: 'Материал не найден' });
    const [item] = await withFiles(rows);
    res.json(item);
  })
);

// ------------------------------------------------------------
// Создание и правка (преподаватель)
// ------------------------------------------------------------
const tag = z.string().trim().min(1).max(40);
const fields = {
  kind: z.enum(['theory', 'task']),
  subject: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1, 'Название не может быть пустым').max(255),
  body: z.string().max(50000).nullable(),
  answer: z.string().max(20000).nullable(),
  exam: z.enum(['ОГЭ', 'ЕГЭ', 'ВПР']).nullable(),
  exam_task: z.number().int().min(1).max(50).nullable(),
  tags: z.array(tag).max(20),
  tutor_note: z.string().max(5000).nullable(),
  links: z.array(z.string().trim().url().max(1000)).max(10),
};

router.post(
  '/',
  tutorOnly,
  validateBody(z.object(fields).partial().required({ kind: true, title: true }).strict()),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const { rows } = await query(
      `INSERT INTO library_items (kind, subject, title, body, answer, exam, exam_task, tags, tutor_note, links)
       VALUES ($1, COALESCE($2, 'Английский язык'), $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [b.kind, b.subject || null, b.title, b.body || null, b.answer || null, b.exam || null, b.exam_task || null,
        [...new Set(b.tags || [])], b.tutor_note || null, b.links || []]
    );
    console.log(`✅ В библиотеку добавлено: «${b.title}»`);
    res.status(201).json(rows[0]);
  })
);

router.patch(
  '/:id',
  tutorOnly,
  validateBody(z.object(fields).partial().strict()),
  asyncHandler(async (req, res) => {
    const data = { ...req.body };
    if (data.tags) data.tags = [...new Set(data.tags)];
    data.updated_at = new Date().toISOString();
    const upd = buildUpdate('library_items', Number(req.params.id), data);
    const { rows } = await query(upd.text, upd.values);
    if (!rows[0]) return res.status(404).json({ error: 'Материал не найден' });
    res.json(rows[0]);
  })
);

router.delete(
  '/:id',
  tutorOnly,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { rows } = await query('DELETE FROM library_items WHERE id = $1 RETURNING title', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Материал не найден' });
    // Убираем удалённую задачу из домашних заданий
    await query('UPDATE assignments SET library_item_ids = array_remove(library_item_ids, $1) WHERE $1 = ANY(library_item_ids)', [id]);
    console.log(`🗑️ Из библиотеки удалено: «${rows[0].title}»`);
    res.json({ ok: true });
  })
);

module.exports = { router, visibleTaskIds };
