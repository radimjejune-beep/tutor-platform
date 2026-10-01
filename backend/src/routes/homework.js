// routes/homework.js — работы учеников по заданиям: список, просмотр, сдача, проверка
const express = require('express');
const { z } = require('zod');
const { query } = require('../db');
const { requireRole, accessibleStudentIds, canAccessStudent } = require('../middleware/auth');
const { validateBody, asyncHandler } = require('../middleware/validate');
const { grade, hideAnswers } = require('../services/quiz');
const { buildUpdate } = require('../utils');

const router = express.Router();
const tutorOnly = requireRole('tutor');

// Работа + поля задания
const SELECT_HW = `
  SELECT h.*, a.title, a.description, a.links, a.due_on,
         jsonb_array_length(a.questions) AS question_count,
         s.full_name AS student_name
    FROM homework h
    JOIN assignments a ON a.id = h.assignment_id
    JOIN students s ON s.id = h.student_id`;

// ------------------------------------------------------------
// Список работ. ?student_id=5&status=assigned
// ------------------------------------------------------------
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const studentId = req.query.student_id ? Number(req.query.student_id) : null;
    const status = ['assigned', 'submitted', 'checked'].includes(req.query.status) ? req.query.status : null;
    const allowed = await accessibleStudentIds(req.user);
    if (allowed !== null && studentId && !allowed.includes(studentId)) {
      return res.status(404).json({ error: 'Ученик не найден' });
    }

    const { rows } = await query(
      `${SELECT_HW}
        WHERE ($1::int IS NULL OR h.student_id = $1)
          AND ($2::text IS NULL OR h.status = $2)
          AND ($3::int[] IS NULL OR h.student_id = ANY($3))
        ORDER BY (h.status = 'checked'), a.due_on NULLS LAST, h.id DESC`,
      [studentId, status, allowed]
    );
    // Ответы теста в списке не нужны; автооценку ученик видит только после проверки
    const isTutor = req.user.role === 'tutor';
    res.json(
      rows.map(({ quiz_answers, ...r }) => (isTutor || r.status === 'checked' ? r : { ...r, quiz_score: null }))
    );
  })
);

// Найти работу и проверить доступ
async function loadHomework(user, id) {
  const { rows } = await query(`${SELECT_HW} WHERE h.id = $1`, [id]);
  const hw = rows[0];
  if (!hw || !(await canAccessStudent(user, hw.student_id))) return null;
  return hw;
}

// ------------------------------------------------------------
// Работа целиком: задание, материалы, вложения, вопросы теста
// Правильные ответы ученик/родитель видят только после проверки
// ------------------------------------------------------------
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const hw = await loadHomework(req.user, Number(req.params.id));
    if (!hw) return res.status(404).json({ error: 'Задание не найдено' });

    const { rows: a } = await query('SELECT questions FROM assignments WHERE id = $1', [hw.assignment_id]);
    const questions = a[0].questions || [];
    const meta = 'id, filename, mime, size_bytes, uploaded_by, created_at';
    const { rows: materials } = await query(`SELECT ${meta} FROM files WHERE assignment_id = $1 ORDER BY id`, [hw.assignment_id]);
    const { rows: attachments } = await query(`SELECT ${meta} FROM files WHERE homework_id = $1 ORDER BY id`, [hw.id]);

    const reveal = req.user.role === 'tutor' || hw.status === 'checked';
    const g = reveal && hw.quiz_answers ? grade(questions, hw.quiz_answers) : null;

    res.json({
      ...hw,
      quiz_score: reveal ? hw.quiz_score : null,
      questions: reveal ? questions : hideAnswers(questions),
      quiz_results: g ? g.results : null,
      quiz_points: g ? { earned: g.earned, total: g.total } : null,
      materials,
      attachments,
    });
  })
);

// ------------------------------------------------------------
// Ученик сдаёт работу (текст, ответы теста; файлы — отдельно через /api/files)
// ------------------------------------------------------------
router.post(
  '/:id/submit',
  requireRole('student'),
  validateBody(
    z
      .object({
        student_answer: z.string().trim().max(20000).optional(),
        quiz_answers: z.record(z.union([z.string().max(1000), z.number().int()])).optional(),
      })
      .strict()
  ),
  asyncHandler(async (req, res) => {
    const hw = await loadHomework(req.user, Number(req.params.id));
    if (!hw) return res.status(404).json({ error: 'Задание не найдено' });
    if (hw.status === 'checked') return res.status(409).json({ error: 'Задание уже проверено' });

    const { rows: a } = await query('SELECT questions FROM assignments WHERE id = $1', [hw.assignment_id]);
    const questions = a[0].questions || [];
    const answers = req.body.quiz_answers || null;
    const g = questions.length && answers ? grade(questions, answers) : null;

    const { rows } = await query(
      `UPDATE homework
          SET student_answer = $1, quiz_answers = $2, quiz_score = $3, status = 'submitted', submitted_at = NOW()
        WHERE id = $4 RETURNING id, status, submitted_at`,
      [req.body.student_answer || null, answers ? JSON.stringify(answers) : null, g ? g.score : null, hw.id]
    );
    console.log(`📝 Работа #${hw.id} сдана${g ? `, тест ${g.score}%` : ''}`);
    res.json(rows[0]);
  })
);

// Ученик отменяет отправку, чтобы что-то поправить (пока не проверено)
router.post(
  '/:id/unsubmit',
  requireRole('student'),
  asyncHandler(async (req, res) => {
    const hw = await loadHomework(req.user, Number(req.params.id));
    if (!hw) return res.status(404).json({ error: 'Задание не найдено' });
    if (hw.status !== 'submitted') return res.status(409).json({ error: 'Работа не на проверке' });
    await query("UPDATE homework SET status = 'assigned' WHERE id = $1", [hw.id]);
    res.json({ ok: true });
  })
);

// ------------------------------------------------------------
// Преподаватель: проверить (оценка, комментарий) или вернуть на доработку
// ------------------------------------------------------------
router.patch(
  '/:id',
  tutorOnly,
  validateBody(
    z
      .object({
        status: z.enum(['assigned', 'submitted', 'checked']),
        tutor_feedback: z.string().max(10000).nullable(),
        score: z.number().int().min(0).max(100).nullable(),
      })
      .partial()
      .strict()
  ),
  asyncHandler(async (req, res) => {
    const upd = buildUpdate('homework', Number(req.params.id), req.body);
    if (!upd) return res.status(400).json({ error: 'Нет изменений' });
    const { rows } = await query(upd.text, upd.values);
    if (!rows[0]) return res.status(404).json({ error: 'Работа не найдена' });
    console.log(`📝 Работа #${rows[0].id}: ${rows[0].status}`);
    res.json(rows[0]);
  })
);

// Убрать ученика из задания (если учеников не осталось — удаляется и задание)
router.delete(
  '/:id',
  tutorOnly,
  asyncHandler(async (req, res) => {
    const { rows } = await query('DELETE FROM homework WHERE id = $1 RETURNING assignment_id', [Number(req.params.id)]);
    if (!rows[0]) return res.status(404).json({ error: 'Работа не найдена' });
    await query(
      'DELETE FROM assignments a WHERE a.id = $1 AND NOT EXISTS (SELECT 1 FROM homework h WHERE h.assignment_id = a.id)',
      [rows[0].assignment_id]
    );
    console.log(`🗑️ Работа #${req.params.id} удалена`);
    res.json({ ok: true });
  })
);

module.exports = router;
