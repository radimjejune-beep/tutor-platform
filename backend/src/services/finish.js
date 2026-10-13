// services/finish.js — завершение урока: отметка, итог, ДЗ по юниту, следующий юнит
// Используется и для индивидуального урока, и для каждого ученика группового
const { buildUpdate } = require('../utils');
const { syncLessonCharge } = require('./billing');
const { getUnit, startUnit, nextUnitId, assignUnitHomework } = require('./courses');
const notify = require('./notify');

// b: { status, topic, summary, private_notes, homework, due_on, next_unit }
async function finishLesson(client, id, b) {
  const { rows: cur } = await client.query(
    `SELECT l.*, s.course_unit_id FROM lessons l JOIN students s ON s.id = l.student_id WHERE l.id = $1 FOR UPDATE OF l`,
    [id]
  );
  const l = cur[0];
  if (!l) return null;
  const unitId = l.unit_id || l.course_unit_id || null;
  const data = { status: b.status, unit_id: unitId };
  for (const k of ['topic', 'summary', 'private_notes']) if (b[k] !== undefined) data[k] = b[k] || null;
  const upd = buildUpdate('lessons', id, data);
  const { rows: [updated] } = await client.query(upd.text, upd.values);
  const lesson = await syncLessonCharge(client, updated);

  let assignment = null;
  let next = null;
  const done = b.status === 'done';
  const unit = unitId ? await getUnit(client, unitId) : null;
  if (done && b.homework && unit) {
    assignment = await assignUnitHomework(client, unit, l.student_id, { lessonId: id, dueOn: b.due_on || null });
  }
  if (done && b.next_unit && unit && l.course_unit_id === unit.id) {
    const nextId = await nextUnitId(client, unit.id);
    if (nextId) next = (await startUnit(client, l.student_id, nextId)).unit;
  }
  return { lesson, assignment, next_unit: next };
}

function notifyFinished(result) {
  const sid = result.lesson.student_id;
  if (result.lesson.status === 'done' && result.lesson.summary) {
    notify.toStudent(sid, {
      kind: 'lesson_summary',
      title: `Итоги урока${result.lesson.topic ? `: ${result.lesson.topic}` : ''}`,
      body: result.lesson.summary,
      link: '/schedule',
    });
  }
  if (result.assignment) {
    notify.toStudent(sid, { kind: 'homework_new', title: `Новое задание: ${result.assignment.title}`, link: `/homework/${result.assignment.homework_id}` });
  }
}

module.exports = { finishLesson, notifyFinished };
