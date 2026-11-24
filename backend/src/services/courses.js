// services/courses.js — курс по учебнику: юнит ученика, ДЗ по юниту, переход к следующему
const { addWords } = require('./vocab');

// Юнит с названием курса
async function getUnit(db, unitId) {
  const { rows } = await db.query(
    `SELECT u.*, c.title AS course_title,c.subject AS course_subject FROM course_units u JOIN courses c ON c.id = u.course_id WHERE u.id = $1`,
    [unitId]
  );
  return rows[0] || null;
}

const unitLabel = (u) => [u.code, u.title].filter(Boolean).join(' ');

// Поставить ученику юнит (и курс). Слова юнита попадают в его словарь
async function currentUnit(db,studentId,subject){
 const {rows:[s]}=await db.query('SELECT id,tutor_id,course_id,course_unit_id FROM students WHERE id=$1',[studentId]);if(!s)return null;
 const info=await require('../learning/study-subjects').list(studentId,s.tutor_id,db);
 const active=await require('../learning/study-subjects').resolve(studentId,s.tutor_id,subject,db);
 const row=(await db.query('SELECT course_id,course_unit_id FROM student_subjects WHERE student_id=$1 AND subject=$2',[studentId,active])).rows[0];
 return {subject:active,primary:info.primary,...(row||(active===info.primary?s:{course_id:null,course_unit_id:null}))};
}
async function startUnit(db, studentId, unitId, subject) {
 const unit = await getUnit(db, unitId);if (!unit) return null;
 const ctx=await currentUnit(db,studentId,subject||unit.course_subject);
 if(!ctx||unit.course_subject!==ctx.subject)throw Object.assign(Error('Курс относится к другому направлению'),{status:422});
 await db.query('INSERT INTO student_subjects(student_id,subject,course_id,course_unit_id) VALUES($1,$2,$3,$4) ON CONFLICT(student_id,subject) DO UPDATE SET course_id=EXCLUDED.course_id,course_unit_id=EXCLUDED.course_unit_id',[studentId,ctx.subject,unit.course_id,unit.id]);
 if(ctx.subject===ctx.primary)await db.query('UPDATE students SET course_id = $2, course_unit_id = $3 WHERE id = $1',[studentId,unit.course_id,unit.id]);
 const added = await addWords(db, studentId, unit.vocab || [], 'unit', unit.id,ctx.subject);
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
  const {rows:[owner]}=await db.query('SELECT tutor_id FROM students WHERE id=$1',[studentId]);
  const subject=await require('../learning/study-subjects').resolve(studentId,owner.tutor_id,unit.course_subject,db);
  if(lessonId){const {rows:[l]}=await db.query('SELECT student_id,subject FROM lessons WHERE id=$1',[lessonId]);if(!l||l.student_id!==studentId||l.subject!==subject)throw Object.assign(Error('Занятие и курс относятся к разным направлениям'),{status:422});}
  const itemIds = unit.homework_item_ids?.length ? unit.homework_item_ids : unit.item_ids || [];
  const { rows: existing } = await db.query('SELECT id FROM library_items WHERE id = ANY($1::int[])', [itemIds]);
  const ids = itemIds.filter((id) => existing.some((r) => r.id === id));
  const vocabNote = unit.vocab?.length ? '\nВ конце отработайте карточки юнита: упражнения появятся ниже.' : '';
  const { rows } = await db.query(
    `INSERT INTO assignments (title, description, due_on, library_item_ids, vocab_practice, tutor_id, subject)
     VALUES ($1, $2, $3, $4, $5, (SELECT tutor_id FROM students WHERE id = $6), $7) RETURNING *`,
    [`${unitLabel(unit)}: домашнее задание`.slice(0, 255), `Пройдите упражнения ниже.${vocabNote}`, dueOn, ids,
      unit.vocab?.length ? JSON.stringify({ count: 12 }) : null, studentId, subject]
  );
  const { rows: hw } = await db.query(
    'INSERT INTO homework (assignment_id, student_id, lesson_id,subject) VALUES ($1, $2, $3,$4) RETURNING id',
    [rows[0].id, studentId, lessonId,subject]
  );
  return { ...rows[0], homework_id: hw[0].id };
}

module.exports = { currentUnit,getUnit, startUnit, nextUnitId, assignUnitHomework, unitLabel };
