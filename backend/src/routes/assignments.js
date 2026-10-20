// routes/assignments.js — задания (как в Google Classroom): одно задание — несколько учеников
const express = require('express');
const { z } = require('zod');
const { query, transaction } = require('../db');
const { requireRole, requireOwn } = require('../middleware/auth');
const { validateBody, asyncHandler } = require('../middleware/validate');
const { questionsSchema, grade } = require('../services/quiz');
const { buildUpdate } = require('../utils');
const notify = require('../services/notify');

const router = express.Router();

// Только свои материалы библиотеки, в исходном порядке
async function ownItems(db, ids, tutorId) {
  const list = [...new Set(ids || [])];
  if (!list.length) return [];
  const { rows } = await db.query('SELECT id FROM library_items WHERE id = ANY($1::int[]) AND tutor_id = $2', [list, tutorId]);
  const ok = new Set(rows.map((r) => r.id));
  return list.filter((id) => ok.has(id));
}

// Ученику и родителям: новое задание
function notifyHomework(studentId, homeworkId, a) {
  const due = a.due_on ? `Сдать до ${a.due_on.split('-').reverse().slice(0, 2).join('.')}` : null;
  notify.toStudent(studentId, { kind: 'homework_new', title: `Новое задание: ${a.title}`, body: due, link: `/homework/${homeworkId}` });
}
router.use(requireRole('tutor'));

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата в формате ГГГГ-ММ-ДД');
const fields = {
  title: z.string().trim().min(1, 'Название не может быть пустым').max(255),
  description: z.string().max(10000).nullable(),
  links: z.array(z.string().trim().url().max(1000)).max(10),
  due_on: isoDate.nullable(),
  questions: questionsSchema,
  library_item_ids: z.array(z.number().int().positive()).max(50),
  vocab_practice: z.object({ count: z.number().int().min(4).max(30) }).strict().nullable(),
  word_set_id: z.number().int().positive().nullable(), // слова к уроку: набор карточек
};

// Набор карточек должен быть своим. Ученикам задания открываем доступ к нему
async function ownSet(db, setId, tutorId) {
  if (!setId) return null;
  const { rows } = await db.query('SELECT id FROM word_sets WHERE id = $1 AND tutor_id = $2', [setId, tutorId]);
  return rows[0] ? rows[0].id : undefined;
}
async function shareSet(db, setId, studentIds) {
  if (!setId || !studentIds.length) return;
  await db.query('INSERT INTO word_set_students (set_id, student_id) SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING', [setId, studentIds]);
}

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
        WHERE a.tutor_id = $1
        GROUP BY a.id
        ORDER BY COUNT(h.id) FILTER (WHERE h.status = 'submitted') > 0 DESC, a.created_at DESC`,
      [req.user.id]
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
  .partial({ description: true, links: true, due_on: true, questions: true, library_item_ids: true, vocab_practice: true, word_set_id: true })
  .strict();

router.post(
  '/',
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const result = await transaction(async (client) => {
      const { rows: found } = await client.query('SELECT id FROM students WHERE id = ANY($1) AND tutor_id = $2', [b.student_ids, req.user.id]);
      if (found.length !== new Set(b.student_ids).size) return { error: 'Некоторые ученики не найдены' };
      const setId = await ownSet(client, b.word_set_id, req.user.id);
      if (setId === undefined) return { error: 'Набор карточек не найден' };

      const { rows } = await client.query(
        `INSERT INTO assignments (title, description, links, due_on, questions, library_item_ids, vocab_practice, tutor_id, word_set_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [b.title, b.description || null, b.links || [], b.due_on || null, JSON.stringify(b.questions || []),
          await ownItems(client, b.library_item_ids, req.user.id), b.vocab_practice ? JSON.stringify(b.vocab_practice) : null, req.user.id, setId]
      );
      await shareSet(client, setId, [...new Set(b.student_ids)]);
      const given = [];
      for (const sid of new Set(b.student_ids)) {
        const { rows: hw } = await client.query('INSERT INTO homework (assignment_id, student_id) VALUES ($1, $2) RETURNING id', [rows[0].id, sid]);
        given.push({ sid, hid: hw[0].id });
      }
      return { assignment: rows[0], given };
    });
    if (result.error) return res.status(400).json({ error: result.error });
    for (const g of result.given) notifyHomework(g.sid, g.hid, result.assignment);
    console.log(`✅ Задание «${b.title}» выдано: ${b.student_ids.length} уч.`);
    res.status(201).json(result.assignment);
  })
);

// ------------------------------------------------------------
// Задание целиком: текст, вопросы с ответами, материалы, работы учеников
// ------------------------------------------------------------
router.get(
  '/:id',
  requireOwn('assignments', 'id', 'Задание не найдено'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { rows } = await query('SELECT * FROM assignments WHERE id = $1', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Задание не найдено' });

    const { rows: files } = await query(`SELECT ${FILE_META} FROM files WHERE assignment_id = $1 ORDER BY id`, [id]);
    const { rows: submissions } = await query(
      `SELECT h.id, h.student_id, s.full_name AS student_name, h.status, h.submitted_at, h.score, h.quiz_score, h.vocab_result,
              (SELECT COUNT(*)::int FROM files f WHERE f.homework_id = h.id) AS files_count,
              (SELECT COUNT(*)::int FROM word_set_progress p WHERE p.set_id = $2 AND p.student_id = h.student_id AND p.level = 3) AS set_learned,
              (SELECT COUNT(*)::int FROM practice_log l WHERE l.set_id = $2 AND l.student_id = h.student_id) AS set_sessions
         FROM homework h JOIN students s ON s.id = h.student_id
        WHERE h.assignment_id = $1
        ORDER BY (h.status = 'submitted') DESC, s.full_name`,
      [id, rows[0].word_set_id || 0]
    );
    let wordSet = null;
    if (rows[0].word_set_id) {
      const { rows: ws } = await query('SELECT id, title, jsonb_array_length(words) AS word_count FROM word_sets WHERE id = $1', [rows[0].word_set_id]);
      wordSet = ws[0] || null;
    }
    res.json({ ...rows[0], files, submissions, word_set: wordSet });
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
  requireOwn('assignments', 'id', 'Задание не найдено'),
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { add_student_ids, ...data } = req.body;
    if (data.questions) data.questions = JSON.stringify(data.questions);
    if (data.library_item_ids) data.library_item_ids = await ownItems({ query }, data.library_item_ids, req.user.id);
    if (data.vocab_practice !== undefined) data.vocab_practice = data.vocab_practice ? JSON.stringify(data.vocab_practice) : null;
    if (data.word_set_id) {
      if ((await ownSet({ query }, data.word_set_id, req.user.id)) === undefined) return res.status(400).json({ error: 'Набор карточек не найден' });
    }

    const added = [];
    const updated = await transaction(async (client) => {
      const { rows: cur } = await client.query('SELECT id FROM assignments WHERE id = $1 FOR UPDATE', [id]);
      if (!cur[0]) return null;

      let assignment;
      const upd = buildUpdate('assignments', id, data);
      if (upd) ({ rows: [assignment] } = await client.query(upd.text, upd.values));
      else ({ rows: [assignment] } = await client.query('SELECT * FROM assignments WHERE id = $1', [id]));

      const { rows: ownIds } = await client.query('SELECT id FROM students WHERE id = ANY($1::int[]) AND tutor_id = $2', [add_student_ids || [], req.user.id]);
      for (const sid of new Set(ownIds.map((r) => r.id))) {
        const { rows: hw } = await client.query(
          'INSERT INTO homework (assignment_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id',
          [id, sid]
        );
        if (hw[0]) added.push({ sid, hid: hw[0].id });
      }

      // Набор карточек открываем всем, кому выдано задание
      if (assignment.word_set_id) {
        const { rows: hs } = await client.query('SELECT student_id FROM homework WHERE assignment_id = $1', [id]);
        await shareSet(client, assignment.word_set_id, hs.map((r) => r.student_id));
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
    for (const g of added) notifyHomework(g.sid, g.hid, updated);
    console.log(`📝 Задание #${id} обновлено`);
    res.json(updated);
  })
);

router.delete(
  '/:id',
  requireOwn('assignments', 'id', 'Задание не найдено'),
  asyncHandler(async (req, res) => {
    const { rows } = await query('DELETE FROM assignments WHERE id = $1 RETURNING title', [Number(req.params.id)]);
    if (!rows[0]) return res.status(404).json({ error: 'Задание не найдено' });
    console.log(`🗑️ Задание «${rows[0].title}» удалено`);
    res.json({ ok: true });
  })
);

module.exports = router;
