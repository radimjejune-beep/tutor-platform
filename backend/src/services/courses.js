// services/courses.js — курс по учебнику: юнит ученика, ДЗ по юниту, переход к следующему
const { addWords } = require('./vocab');

// Юнит с названием курса
async function getUnit(db, unitId) {
  const { rows } = await db.query(
    `SELECT u.*, c.title AS course_title FROM course_units u JOIN courses c ON c.id = u.course_id WHERE u.id = $1`,
    [unitId]
  );
  return rows[0] || null;
}

const unitLabel = (u) => [u.code, u.title].filter(Boolean).join(' ');

// Поставить ученику юнит (и курс). Слова юнита попадают в его словарь
async function startUnit(db, studentId, unitId) {
  const unit = await getUnit(db, unitId);
  if (!unit) return null;
  await db.query('UPDATE students SET course_id = $2, course_unit_id = $3 WHERE id = $1', [studentId, unit.course_id, unit.id]);
  const added = await addWords(db, studentId, unit.vocab || [], 'unit', unit.id);
  return { unit, vocab_added: added };
}

// Следующий юнит того же курса (по порядку)
async function nextUnitId(db, unitId) {
  const { rows } = await db.query(
    `SELECT n.id FROM course_units cur
       JOIN course_units n ON n.course_id = cur.course_id AND (n.position, n.id) > (cur.position, cur.id)
      WHERE cur.id = $1
      ORDER BY n.position, n.id LIMIT 1`,
    [unitId]
  );
  return rows[0]?.id ?? null;
}

// Домашнее задание по юниту: одно нажатие вместо ручной сборки
async function assignUnitHomework(db, unit, studentId, { lessonId = null, dueOn = null } = {}) {
  const itemIds = unit.homework_item_ids?.length ? unit.homework_item_ids : unit.item_ids || [];
  const { rows: existing } = await db.query('SELECT id FROM library_items WHERE id = ANY($1::int[])', [itemIds]);
  const ids = itemIds.filter((id) => existing.some((r) => r.id === id));
  const vocabNote = unit.vocab?.length ? '\nВ конце отработайте слова юнита: упражнения появятся ниже.' : '';
  const { rows } = await db.query(
    `INSERT INTO assignments (title, description, due_on, library_item_ids, vocab_practice, tutor_id)
     VALUES ($1, $2, $3, $4, $5, (SELECT tutor_id FROM students WHERE id = $6)) RETURNING *`,
    [`${unitLabel(unit)}: домашнее задание`.slice(0, 255), `Пройдите упражнения ниже.${vocabNote}`, dueOn, ids,
      unit.vocab?.length ? JSON.stringify({ count: 12 }) : null, studentId]
  );
  const { rows: hw } = await db.query(
    'INSERT INTO homework (assignment_id, student_id, lesson_id) VALUES ($1, $2, $3) RETURNING id',
    [rows[0].id, studentId, lessonId]
  );
  return { ...rows[0], homework_id: hw[0].id };
}

module.exports = { getUnit, startUnit, nextUnitId, assignUnitHomework, unitLabel };
