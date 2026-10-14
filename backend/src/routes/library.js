// routes/library.js — библиотека: теория (видят все) и задачник (только преподаватель)
// Ученик видит условие задачи, только если она выдана ему на уроке или в домашнем задании.
const express = require('express');
const { z } = require('zod');
const { query, transaction } = require('../db');
const { requireRole, accessibleStudentIds, requireOwn } = require('../middleware/auth');
const { validateBody, asyncHandler } = require('../middleware/validate');
const { buildUpdate } = require('../utils');
const { gameSchema } = require('../services/games');

const router = express.Router();
const tutorOnly = requireRole('tutor');
// HTML-урок целиком приходит в теле запроса, поэтому лимит больше обычного
router.use(express.json({ limit: '3mb' }));

const FILE_META = 'id, filename, mime, size_bytes, uploaded_by, created_at';
// Поля, которые может видеть ученик (без ответа и заметок преподавателя)
const PUBLIC_FIELDS = 'id, tutor_id, kind, subject, title, body, exam, exam_task, links, game, html';
// Для списков: всё, кроме самого HTML-урока (он большой и в списке не нужен)
const LIST_FIELDS = 'id, kind, subject, title, body, answer, exam, exam_task, tags, tutor_note, links, game, favorite, created_at, updated_at';
const PUBLIC_LIST_FIELDS = 'id, kind, subject, title, body, exam, exam_task, links, game';

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
  if (item.tutor_id !== user.tid) return false;
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
    // kind можно передать списком: task,game
    const kinds = String(req.query.kind || '').split(',').filter((k) => ['theory', 'task', 'game', 'html'].includes(k));
    const kind = isTutor ? (kinds.length ? kinds : null) : ['theory'];
    const examTask = Number(req.query.exam_task) || null;
    const { rows } = await query(
      `SELECT ${isTutor ? LIST_FIELDS : PUBLIC_LIST_FIELDS + ', tags, updated_at'}, (html IS NOT NULL) AS has_html,
              (SELECT COUNT(*)::int FROM files f WHERE f.library_item_id = library_items.id) AS files_count
         FROM library_items
        WHERE ($1::text[] IS NULL OR kind = ANY($1::text[]))
          AND ($2::text IS NULL OR subject = $2::text)
          AND ($3::text IS NULL OR exam = $3::text)
          AND ($4::int IS NULL OR exam_task = $4::int)
          AND ($5::text IS NULL OR $5::text = ANY(tags))
          AND ($6::text IS NULL OR title ILIKE '%' || $6::text || '%' OR body ILIKE '%' || $6::text || '%'
               OR tutor_note ILIKE '%' || $6::text || '%')
          AND tutor_id = $7
          AND ($8::boolean IS NULL OR favorite = $8::boolean)
        ORDER BY subject, exam NULLS LAST, exam_task NULLS LAST, title`,
      [kind, req.query.subject || null, req.query.exam || null, examTask, req.query.tag || null, (req.query.q || '').trim() || null, req.user.tid,
        isTutor && req.query.fav === '1' ? true : null]
    );
    res.json(rows);
  })
);

// Справочники для фильтров: предметы и теги
router.get(
  '/facets',
  asyncHandler(async (req, res) => {
    const kindFilter = req.user.role === 'tutor' ? '' : "AND kind = 'theory'";
    const { rows: subjects } = await query(`SELECT DISTINCT subject FROM library_items WHERE tutor_id = $1 ${kindFilter} ORDER BY 1`, [req.user.tid]);
    const { rows: tags } = await query(`SELECT DISTINCT unnest(tags) AS tag FROM library_items WHERE tutor_id = $1 ${kindFilter} ORDER BY 1`, [req.user.tid]);
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
    let { rows } = await query(`SELECT ${isTutor ? '*' : PUBLIC_FIELDS} FROM library_items WHERE id = ANY($1) AND tutor_id = $2`, [ids, req.user.tid]);
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
  kind: z.enum(['theory', 'task', 'game', 'html']),
  subject: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1, 'Название не может быть пустым').max(255),
  body: z.string().max(50000).nullable(),
  answer: z.string().max(20000).nullable(),
  exam: z.enum(['ОГЭ', 'ЕГЭ', 'ВПР']).nullable(),
  exam_task: z.number().int().min(1).max(50).nullable(),
  tags: z.array(tag).max(20),
  tutor_note: z.string().max(5000).nullable(),
  favorite: z.boolean(),
  links: z.array(z.string().trim().url().max(1000)).max(10),
  game: gameSchema.nullable(),
  html: z.string().max(3_000_000, 'Файл урока слишком большой (больше 3 МБ)').nullable(),
};

router.post(
  '/',
  tutorOnly,
  validateBody(
    z
      .object(fields)
      .partial()
      .required({ kind: true, title: true })
      .strict()
      .refine((b) => b.kind !== 'game' || b.game, 'Заполните упражнение')
      .refine((b) => b.kind !== 'html' || b.html, 'Загрузите файл урока')
  ),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const { rows } = await query(
      `INSERT INTO library_items (kind, subject, title, body, answer, exam, exam_task, tags, tutor_note, links, game, html, tutor_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [b.kind, b.subject || req.user.subject, b.title, b.body || null, b.answer || null, b.exam || null, b.exam_task || null,
        [...new Set(b.tags || [])], b.tutor_note || null, b.links || [], b.kind === 'game' ? JSON.stringify(b.game) : null,
        b.kind === 'html' ? b.html : null, req.user.id]
    );
    console.log(`✅ В библиотеку добавлено: «${b.title}»`);
    res.status(201).json(rows[0]);
  })
);

router.patch(
  '/:id',
  tutorOnly,
  requireOwn('library_items', 'id', 'Материал не найден'),
  validateBody(z.object(fields).partial().strict()),
  asyncHandler(async (req, res) => {
    const data = { ...req.body };
    if (data.tags) data.tags = [...new Set(data.tags)];
    if (data.game !== undefined) data.game = data.game ? JSON.stringify(data.game) : null;
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
  requireOwn('library_items', 'id', 'Материал не найден'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { rows } = await query('DELETE FROM library_items WHERE id = $1 RETURNING title', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Материал не найден' });
    // Убираем удалённую задачу из домашних заданий
    await query('UPDATE assignments SET library_item_ids = array_remove(library_item_ids, $1) WHERE $1 = ANY(library_item_ids) AND tutor_id = $2', [id, req.user.id]);
    console.log(`🗑️ Из библиотеки удалено: «${rows[0].title}»`);
    res.json({ ok: true });
  })
);

// ------------------------------------------------------------
// Импорт набора материалов из файла (например, все упражнения юнита учебника)
// Формат: { "format": "lessonfold-library", "items": [ { key, kind, title, ... } ],
//           "courses": [ { title, units: [ { code, title, goals, items: [key], homework: [key], vocab: [...] } ] } ] }
// Повторный импорт не создаёт дубликаты: материалы совпадают по виду + названию + предмету,
// курс — по названию, юнит — по коду (или названию) внутри курса
// ------------------------------------------------------------
const importItem = z
  .object({ ...fields, key: z.string().trim().min(1).max(100) })
  .partial()
  .required({ kind: true, title: true })
  .strict()
  .refine((b) => b.kind !== 'game' || b.game, 'У упражнения нет содержимого')
  .refine((b) => b.kind !== 'html' || b.html, 'У урока нет HTML');

const keys = z.array(z.string().trim().min(1).max(100)).max(60).default([]);
const importCourse = z
  .object({
    title: z.string().trim().min(1).max(255),
    subject: z.string().trim().min(1).max(100).optional(),
    level: z.string().trim().max(50).optional(),
    description: z.string().max(5000).optional(),
    units: z
      .array(
        z
          .object({
            code: z.string().trim().max(20).optional(),
            title: z.string().trim().min(1).max(255),
            goals: z.string().max(5000).optional(),
            items: keys,
            homework: keys,
            vocab: z
              .array(
                z.object({ term: z.string().trim().min(1).max(200), translation: z.string().max(300).optional(), example: z.string().max(1000).optional() }).strict()
              )
              .max(300)
              .default([]),
          })
          .strict()
      )
      .max(200),
  })
  .strict();

router.post(
  '/import',
  tutorOnly,
    validateBody(
    z
      .object({
        format: z.literal('lessonfold-library'),
        version: z.number().int().optional(),
        title: z.string().max(255).optional(),
        items: z.array(importItem).max(300).default([]),
        courses: z.array(importCourse).max(10).default([]),
      })
      .strict()
      .refine((b) => b.items.length || b.courses.length, 'В файле нет материалов')
  ),
  asyncHandler(async (req, res) => {
    const result = await transaction(async (client) => {
      let created = 0;
      let skipped = 0;
      const byKey = {};
      for (const b of req.body.items) {
        const subject = b.subject || req.user.subject;
        const { rows: dup } = await client.query(
          'SELECT id FROM library_items WHERE kind = $1 AND title = $2 AND subject = $3 AND tutor_id = $4 ORDER BY id LIMIT 1',
          [b.kind, b.title, subject, req.user.id]
        );
        if (dup[0]) {
          skipped++;
          if (b.key) byKey[b.key] = dup[0].id;
          continue;
        }
        const { rows } = await client.query(
          `INSERT INTO library_items (kind, subject, title, body, answer, exam, exam_task, tags, tutor_note, links, game, html, tutor_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
          [b.kind, subject, b.title, b.body || null, b.answer || null, b.exam || null, b.exam_task || null,
            [...new Set(b.tags || [])], b.tutor_note || null, b.links || [], b.kind === 'game' ? JSON.stringify(b.game) : null,
            b.kind === 'html' ? b.html : null, req.user.id]
        );
        if (b.key) byKey[b.key] = rows[0].id;
        created++;
      }

      let units = 0;
      for (const c of req.body.courses) {
        let { rows: course } = await client.query('SELECT id FROM courses WHERE title = $1 AND tutor_id = $2 ORDER BY id LIMIT 1', [c.title, req.user.id]);
        if (!course[0]) {
          ({ rows: course } = await client.query(
            `INSERT INTO courses (title, subject, level, description, tutor_id) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [c.title, c.subject || req.user.subject, c.level || null, c.description || null, req.user.id]
          ));
        }
        const courseId = course[0].id;
        for (const u of c.units) {
          const resolve = (list) => [...new Set(list.map((k) => byKey[k]).filter(Boolean))];
          const values = [u.goals || null, resolve(u.items), resolve(u.homework), JSON.stringify(u.vocab)];
          const { rows: found } = await client.query(
            `SELECT id FROM course_units WHERE course_id = $1 AND (($2::varchar IS NOT NULL AND code = $2::varchar) OR ($2::varchar IS NULL AND title = $3::varchar)) LIMIT 1`,
            [courseId, u.code || null, u.title]
          );
          if (found[0]) {
            await client.query(
              'UPDATE course_units SET title = $2, goals = $3, item_ids = $4, homework_item_ids = $5, vocab = $6 WHERE id = $1',
              [found[0].id, u.title, ...values]
            );
          } else {
            await client.query(
              `INSERT INTO course_units (course_id, position, code, title, goals, item_ids, homework_item_ids, vocab)
               VALUES ($1, (SELECT COALESCE(MAX(position), -1) + 1 FROM course_units WHERE course_id = $1), $2, $3, $4, $5, $6, $7)`,
              [courseId, u.code || null, u.title, ...values]
            );
          }
          units++;
        }
      }
      return { created, skipped, units };
    });
    console.log(`✅ Импорт «${req.body.title || 'без названия'}»: добавлено ${result.created}, уже было ${result.skipped}, юнитов ${result.units}`);
    res.json(result);
  })
);

module.exports = { router, visibleTaskIds };
