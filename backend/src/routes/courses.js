// routes/courses.js — курсы по учебнику (только преподаватель)
const express = require('express');
const { z } = require('zod');
const { query, transaction } = require('../db');
const { requireRole, requireOwn, owns } = require('../middleware/auth');
const { validateBody, asyncHandler } = require('../middleware/validate');
const { buildUpdate } = require('../utils');
const { getUnit, startUnit, nextUnitId, assignUnitHomework } = require('../services/courses');
const notify = require('../services/notify');

const router = express.Router();
router.use(requireRole('tutor'));

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата в формате ГГГГ-ММ-ДД');
const ids = z.array(z.number().int().positive()).max(60);
const vocabWord = z
  .object({
    term: z.string().trim().min(1).max(200),
    translation: z.string().trim().max(300).nullable().optional(),
    example: z.string().trim().max(1000).nullable().optional(),
  })
  .strict();

const courseFields = {
  title: z.string().trim().min(1, 'Название не может быть пустым').max(255),
  subject: z.string().trim().min(1).max(100),
  level: z.string().trim().max(50).nullable(),
  description: z.string().max(5000).nullable(),
};
const unitFields = {
  code: z.string().trim().max(20).nullable(),
  title: z.string().trim().min(1, 'Название юнита не может быть пустым').max(255),
  goals: z.string().max(5000).nullable(),
  item_ids: ids,
  homework_item_ids: ids,
  vocab: z.array(vocabWord).max(300),
};

// ------------------------------------------------------------
// Курсы
// ------------------------------------------------------------
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT c.*,
              (SELECT COUNT(*)::int FROM course_units u WHERE u.course_id = c.id) AS unit_count,
              (SELECT COUNT(*)::int FROM students s WHERE s.course_id = c.id AND s.status = 'active') AS student_count
         FROM courses c WHERE c.tutor_id = $1 ORDER BY c.title`,
      [req.user.id]
    );
    res.json(rows);
  })
);

router.post(
  '/',
  validateBody(z.object(courseFields).partial().required({ title: true }).strict()),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const { rows } = await query(
      `INSERT INTO courses (title, subject, level, description, tutor_id) VALUES ($1, COALESCE($2, 'Английский язык'), $3, $4, $5) RETURNING *`,
      [b.title, b.subject || null, b.level || null, b.description || null, req.user.id]
    );
    res.status(201).json(rows[0]);
  })
);

// Курс целиком: юниты (с названиями материалов) и ученики на курсе
router.get(
  '/:id',
  requireOwn('courses', 'id', 'Курс не найден'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { rows } = await query('SELECT * FROM courses WHERE id = $1', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Курс не найден' });
    const { rows: units } = await query('SELECT * FROM course_units WHERE course_id = $1 ORDER BY position, id', [id]);
    const allIds = [...new Set(units.flatMap((u) => [...u.item_ids, ...u.homework_item_ids]))];
    const { rows: items } = allIds.length
      ? await query("SELECT id, kind, title, game->>'type' AS game_type FROM library_items WHERE id = ANY($1::int[])", [allIds])
      : { rows: [] };
    const { rows: students } = await query(
      `SELECT id, full_name, course_unit_id FROM students WHERE course_id = $1 AND status <> 'archived' ORDER BY full_name`,
      [id]
    );
    res.json({ ...rows[0], units, items, students });
  })
);

router.patch(
  '/:id',
  requireOwn('courses', 'id', 'Курс не найден'),
  validateBody(z.object(courseFields).partial().strict()),
  asyncHandler(async (req, res) => {
    const upd = buildUpdate('courses', Number(req.params.id), req.body);
    if (!upd) return res.status(400).json({ error: 'Нечего менять' });
    const { rows } = await query(upd.text, upd.values);
    if (!rows[0]) return res.status(404).json({ error: 'Курс не найден' });
    res.json(rows[0]);
  })
);

router.delete(
  '/:id',
  requireOwn('courses', 'id', 'Курс не найден'),
  asyncHandler(async (req, res) => {
    const { rows } = await query('DELETE FROM courses WHERE id = $1 RETURNING title', [Number(req.params.id)]);
    if (!rows[0]) return res.status(404).json({ error: 'Курс не найден' });
    console.log(`🗑️ Курс «${rows[0].title}» удалён`);
    res.json({ ok: true });
  })
);

// ------------------------------------------------------------
// Юниты
// ------------------------------------------------------------
const jsonVocab = (data) => (data.vocab ? { ...data, vocab: JSON.stringify(data.vocab) } : data);

router.post(
  '/:id/units',
  requireOwn('courses', 'id', 'Курс не найден'),
  validateBody(z.object(unitFields).partial().required({ title: true }).strict()),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const b = req.body;
    const { rows: c } = await query('SELECT id FROM courses WHERE id = $1', [id]);
    if (!c[0]) return res.status(404).json({ error: 'Курс не найден' });
    const { rows } = await query(
      `INSERT INTO course_units (course_id, position, code, title, goals, item_ids, homework_item_ids, vocab)
       VALUES ($1, (SELECT COALESCE(MAX(position), -1) + 1 FROM course_units WHERE course_id = $1), $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, b.code || null, b.title, b.goals || null, b.item_ids || [], b.homework_item_ids || [], JSON.stringify(b.vocab || [])]
    );
    res.status(201).json(rows[0]);
  })
);

router.patch(
  '/units/:uid',
  requireOwn('course_units', 'uid', 'Юнит не найден'),
  validateBody(z.object(unitFields).partial().strict()),
  asyncHandler(async (req, res) => {
    const upd = buildUpdate('course_units', Number(req.params.uid), jsonVocab(req.body));
    if (!upd) return res.status(400).json({ error: 'Нечего менять' });
    const { rows } = await query(upd.text, upd.values);
    if (!rows[0]) return res.status(404).json({ error: 'Юнит не найден' });
    res.json(rows[0]);
  })
);

router.delete(
  '/units/:uid',
  requireOwn('course_units', 'uid', 'Юнит не найден'),
  asyncHandler(async (req, res) => {
    const { rows } = await query('DELETE FROM course_units WHERE id = $1 RETURNING id', [Number(req.params.uid)]);
    if (!rows[0]) return res.status(404).json({ error: 'Юнит не найден' });
    res.json({ ok: true });
  })
);

// Порядок юнитов
router.put(
  '/:id/order',
  requireOwn('courses', 'id', 'Курс не найден'),
  validateBody(z.object({ unit_ids: z.array(z.number().int().positive()).max(300) }).strict()),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await transaction(async (client) => {
      for (const [pos, uid] of req.body.unit_ids.entries()) {
        await client.query('UPDATE course_units SET position = $3 WHERE id = $1 AND course_id = $2', [uid, id, pos]);
      }
    });
    res.json({ ok: true });
  })
);

// ------------------------------------------------------------
// Ученик на курсе
// ------------------------------------------------------------

// Текущий курс и юнит ученика + список юнитов для выбора
router.get(
  '/students/:sid',
  requireOwn('students', 'sid', 'Ученик не найден'),
  asyncHandler(async (req, res) => {
    const sid = Number(req.params.sid);
    const { rows } = await query('SELECT id, course_id, course_unit_id FROM students WHERE id = $1', [sid]);
    if (!rows[0]) return res.status(404).json({ error: 'Ученик не найден' });
    const s = rows[0];
    if (!s.course_id) return res.json({ course: null, unit: null, units: [] });
    const { rows: c } = await query('SELECT id, title FROM courses WHERE id = $1', [s.course_id]);
    const { rows: units } = await query(
      `SELECT id, code, title, position, cardinality(item_ids) AS item_count, cardinality(homework_item_ids) AS homework_count,
              jsonb_array_length(vocab) AS vocab_count
         FROM course_units WHERE course_id = $1 ORDER BY position, id`,
      [s.course_id]
    );
    const unit = s.course_unit_id ? await getUnit({ query }, s.course_unit_id) : null;
    res.json({ course: c[0] || null, unit, units });
  })
);

// Записать на курс / сменить юнит. unit_id не указан — первый юнит курса. course_id: null — снять с курса
router.post(
  '/students/:sid',
  requireOwn('students', 'sid', 'Ученик не найден'),
  validateBody(z.object({ course_id: z.number().int().positive().nullable(), unit_id: z.number().int().positive().optional() }).strict()),
  asyncHandler(async (req, res) => {
    const sid = Number(req.params.sid);
    const { course_id: courseId, unit_id: unitId } = req.body;
    const { rows: st } = await query('SELECT id FROM students WHERE id = $1', [sid]);
    if (!st[0]) return res.status(404).json({ error: 'Ученик не найден' });

    if (courseId !== null && !(await owns(req.user, 'courses', courseId))) return res.status(404).json({ error: 'Курс не найден' });
    if (courseId === null) {
      await query('UPDATE students SET course_id = NULL, course_unit_id = NULL WHERE id = $1', [sid]);
      return res.json({ ok: true });
    }
    const { rows: units } = await query(
      `SELECT id FROM course_units WHERE course_id = $1 AND ($2::int IS NULL OR id = $2::int) ORDER BY position, id LIMIT 1`,
      [courseId, unitId ?? null]
    );
    if (!units[0]) return res.status(400).json({ error: unitId ? 'Юнит не из этого курса' : 'В курсе пока нет юнитов' });
    const result = await transaction((client) => startUnit(client, sid, units[0].id));
    res.json(result);
  })
);

// Перейти к следующему юниту
router.post(
  '/students/:sid/next',
  requireOwn('students', 'sid', 'Ученик не найден'),
  asyncHandler(async (req, res) => {
    const sid = Number(req.params.sid);
    const { rows } = await query('SELECT course_unit_id FROM students WHERE id = $1', [sid]);
    if (!rows[0]?.course_unit_id) return res.status(400).json({ error: 'Ученик не на курсе' });
    const next = await nextUnitId({ query }, rows[0].course_unit_id);
    if (!next) return res.status(409).json({ error: 'Это последний юнит курса' });
    const result = await transaction((client) => startUnit(client, sid, next));
    res.json(result);
  })
);

// ДЗ по юниту одним нажатием
router.post(
  '/units/:uid/homework',
  requireOwn('course_units', 'uid', 'Юнит не найден'),
  validateBody(
    z.object({ student_id: z.number().int().positive(), lesson_id: z.number().int().positive().optional(), due_on: isoDate.nullable().optional() }).strict()
  ),
  asyncHandler(async (req, res) => {
    const unit = await getUnit({ query }, Number(req.params.uid));
    if (!unit) return res.status(404).json({ error: 'Юнит не найден' });
    const b = req.body;
    if (!(await owns(req.user, 'students', b.student_id))) return res.status(404).json({ error: 'Ученик не найден' });
    const a = await transaction((client) => assignUnitHomework(client, unit, b.student_id, { lessonId: b.lesson_id, dueOn: b.due_on }));
    console.log(`✅ ДЗ по юниту «${unit.title}» выдано ученику #${b.student_id}`);
    notify.toStudent(b.student_id, { kind: 'homework_new', title: `Новое задание: ${a.title}`, link: `/homework/${a.homework_id}` });
    res.status(201).json(a);
  })
);

// Материалы юнита — в урок (добавляются к уже выбранным)
router.post(
  '/units/:uid/lesson/:lessonId',
  requireOwn('course_units', 'uid', 'Юнит не найден'),
  requireOwn('lessons', 'lessonId', 'Занятие не найдено'),
  asyncHandler(async (req, res) => {
    const unit = await getUnit({ query }, Number(req.params.uid));
    if (!unit) return res.status(404).json({ error: 'Юнит не найден' });
    const lessonId = Number(req.params.lessonId);
    const { sameSession } = require('./lessons');
    const lessonIds = await sameSession(lessonId);
    const count = await transaction(async (client) => {
      const { rows: l } = await client.query('SELECT id FROM lessons WHERE id = $1', [lessonId]);
      if (!l[0]) return null;
      await client.query('UPDATE lessons SET unit_id = $2 WHERE id = $1', [lessonId, unit.id]);
      // У группового занятия материалы общие: добавляем всем ученикам
      const added = [];
      for (const lid of lessonIds) added.push(await addUnitItems(client, lid, unit));
      return Math.max(...added);
    });
    if (count === null) return res.status(404).json({ error: 'Занятие не найдено' });
    res.json({ added: count });
  })
);

// Материалы юнита в конец списка задач урока (без повторов). Возвращает, сколько добавлено
async function addUnitItems(client, lessonId, unit) {
  const { rows: cur } = await client.query('SELECT COALESCE(MAX(position), -1) AS p FROM lesson_items WHERE lesson_id = $1', [lessonId]);
  let pos = cur[0].p + 1;
  let n = 0;
  for (const itemId of unit.item_ids) {
    const { rowCount } = await client.query(
      `INSERT INTO lesson_items (lesson_id, item_id, position)
       SELECT $1, $2, $3 WHERE EXISTS (SELECT 1 FROM library_items WHERE id = $2)
       ON CONFLICT DO NOTHING`,
      [lessonId, itemId, pos++]
    );
    n += rowCount;
  }
  return n;
}

module.exports = router;
