// routes/assignments.js — задания (как в Google Classroom): одно задание — несколько учеников
const express = require('express');
const { z } = require('zod');
const { query, transaction } = require('../db');
const { requireRole } = require('../middleware/auth');
const { validateBody, asyncHandler } = require('../middleware/validate');
const { questionsSchema, grade } = require('../services/quiz');
const { buildUpdate } = require('../utils');

const router = express.Router();
router.use(requireRole('tutor'));

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата в формате ГГГГ-ММ-ДД');
const fields = {
  title: z.string().trim().min(1, 'Название не может быть пустым').max(255),
  description: z.string().max(10000).nullable(),
  links: z.array(z.string().trim().url().max(1000)).max(10),
  due_on: isoDate.nullable(),
  questions: questionsSchema,
  library_item_ids: z.array(z.number().int().positive()).max(50),
};

// Список метаданных файлов (без содержимого)
const FILE_META = 'id, filename, mime, size_bytes, uploaded_by, created_at';

// ------------------------------------------------------------
// Все задания со сводкой: кому выдано, сколько сдали и проверено
// ------------------------------------------------------------
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT a.id, a.title, a.due_on, a.created_at,
              jsonb_array_length(a.questions) AS question_count,
              cardinality(a.library_item_ids) AS task_count,
              COUNT(h.id)::int AS total,
              COUNT(h.id) FILTER (WHERE h.status = 'submitted')::int AS submitted,
              COUNT(h.id) FILTER (WHERE h.status = 'checked')::int AS checked,
              COUNT(h.id) FILTER (WHERE h.status = 'assigned' AND a.due_on < CURRENT_DATE)::int AS overdue,
              COALESCE(json_agg(s.full_name ORDER BY s.full_name) FILTER (WHERE s.id IS NOT NULL), '[]') AS students,
              (SELECT COUNT(*)::int FROM files f WHERE f.assignment_id = a.id) AS files_count
         FROM assignments a
         LEFT JOIN homework h ON h.assignment_id = a.id
         LEFT JOIN students s ON s.id = h.student_id
        GROUP BY a.id
        ORDER BY COUNT(h.id) FILTER (WHERE h.status = 'submitted') > 0 DESC, a.created_at DESC`
    );
    res.json(rows);
  })
);

// ------------------------------------------------------------
// Новое задание и выдача ученикам
// ------------------------------------------------------------
const createSchema = z
  .object({
    ...fields,
    student_ids: z.array(z.number().int().positive()).min(1, 'Выберите хотя бы одного ученика').max(100),
  })
  .partial({ description: true, links: true, due_on: true, questions: true, library_item_ids: true })
  .strict();

router.post(
  '/',
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const result = await transaction(async (client) => {
      const { rows: found } = await client.query('SELECT id FROM students WHERE id = ANY($1)', [b.student_ids]);
      if (found.length !== new Set(b.student_ids).size) return { error: 'Некоторые ученики не найдены' };

      const { rows } = await client.query(
        `INSERT INTO assignments (title, description, links, due_on, questions, library_item_ids)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [b.title, b.description || null, b.links || [], b.due_on || null, JSON.stringify(b.questions || []),
          [...new Set(b.library_item_ids || [])]]
      );
      for (const sid of new Set(b.student_ids)) {
        await client.query('INSERT INTO homework (assignment_id, student_id) VALUES ($1, $2)', [rows[0].id, sid]);
      }
      return { assignment: rows[0] };
    });
    if (result.error) return res.status(400).json({ error: result.error });
    console.log(`✅ Задание «${b.title}» выдано: ${b.student_ids.length} уч.`);
    res.status(201).json(result.assignment);
  })
);

// ------------------------------------------------------------
// Задание целиком: текст, вопросы с ответами, материалы, работы учеников
// ------------------------------------------------------------
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { rows } = await query('SELECT * FROM assignments WHERE id = $1', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Задание не найдено' });

    const { rows: files } = await query(`SELECT ${FILE_META} FROM files WHERE assignment_id = $1 ORDER BY id`, [id]);
    const { rows: submissions } = await query(
      `SELECT h.id, h.student_id, s.full_name AS student_name, h.status, h.submitted_at, h.score, h.quiz_score,
              (SELECT COUNT(*)::int FROM files f WHERE f.homework_id = h.id) AS files_count
         FROM homework h JOIN students s ON s.id = h.student_id
        WHERE h.assignment_id = $1
        ORDER BY (h.status = 'submitted') DESC, s.full_name`,
      [id]
    );
    res.json({ ...rows[0], files, submissions });
  })
);

// ------------------------------------------------------------
// Изменить задание / добавить учеников
// Если поменялись вопросы — уже сданные тесты пересчитываются
// ------------------------------------------------------------
const updateSchema = z
  .object({ ...fields, add_student_ids: z.array(z.number().int().positive()).max(100) })
  .partial()
  .strict();

router.patch(
  '/:id',
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { add_student_ids, ...data } = req.body;
    if (data.questions) data.questions = JSON.stringify(data.questions);

    const updated = await transaction(async (client) => {
      const { rows: cur } = await client.query('SELECT id FROM assignments WHERE id = $1 FOR UPDATE', [id]);
      if (!cur[0]) return null;

      let assignment;
      const upd = buildUpdate('assignments', id, data);
      if (upd) ({ rows: [assignment] } = await client.query(upd.text, upd.values));
      else ({ rows: [assignment] } = await client.query('SELECT * FROM assignments WHERE id = $1', [id]));

      for (const sid of new Set(add_student_ids || [])) {
        await client.query(
          'INSERT INTO homework (assignment_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [id, sid]
        );
      }

      if (data.questions) {
        const { rows: done } = await client.query(
          'SELECT id, quiz_answers FROM homework WHERE assignment_id = $1 AND quiz_answers IS NOT NULL',
          [id]
        );
        for (const h of done) {
          const g = grade(assignment.questions, h.quiz_answers);
          await client.query('UPDATE homework SET quiz_score = $1 WHERE id = $2', [g ? g.score : null, h.id]);
        }
      }
      return assignment;
    });

    if (!updated) return res.status(404).json({ error: 'Задание не найдено' });
    console.log(`📝 Задание #${id} обновлено`);
    res.json(updated);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { rows } = await query('DELETE FROM assignments WHERE id = $1 RETURNING title', [Number(req.params.id)]);
    if (!rows[0]) return res.status(404).json({ error: 'Задание не найдено' });
    console.log(`🗑️ Задание «${rows[0].title}» удалено`);
    res.json({ ok: true });
  })
);

module.exports = router;
