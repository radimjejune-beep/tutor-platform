// routes/dashboard.js — главная страница кабинета: «что важно сейчас»
const express = require('express');
const { query } = require('../db');
const { accessibleStudentIds } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/validate');
const { studentFinance } = require('../services/billing');
const { stripPrivate } = require('../utils');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    if (req.user.role === 'tutor') return res.json(await tutorDashboard());
    const ids = await accessibleStudentIds(req.user);
    const students = [];
    for (const id of ids) students.push(await studentDashboard(id));
    res.json({ students });
  })
);

// Репетитор: сегодня + «требует внимания»
async function tutorDashboard() {
  const { rows: today } = await query(
    `SELECT l.*, s.full_name AS student_name, s.board_link
       FROM lessons l JOIN students s ON s.id = l.student_id
      WHERE l.starts_at >= CURRENT_DATE AND l.starts_at < CURRENT_DATE + INTERVAL '1 day'
        AND l.status <> 'cancelled'
      ORDER BY l.starts_at`
  );

  // Прошедшие занятия, которые не отмечены (иначе они не спишутся)
  const { rows: unmarked } = await query(
    `SELECT l.*, s.full_name AS student_name
       FROM lessons l JOIN students s ON s.id = l.student_id
      WHERE l.status = 'scheduled' AND l.starts_at + (l.duration_min || ' minutes')::interval < NOW()
      ORDER BY l.starts_at`
  );

  const { rows: toCheck } = await query(
    `SELECT h.id, h.assignment_id, h.student_id, h.submitted_at, a.title, s.full_name AS student_name
       FROM homework h
       JOIN students s ON s.id = h.student_id
       JOIN assignments a ON a.id = h.assignment_id
      WHERE h.status = 'submitted' ORDER BY h.submitted_at`
  );

  // Кому пора продлить абонемент или напомнить об оплате
  const { rows: active } = await query("SELECT id, full_name FROM students WHERE status = 'active' ORDER BY full_name");
  const payAttention = [];
  for (const s of active) {
    const f = await studentFinance({ query }, s.id);
    const hasSubs = f.subscriptions.length > 0;
    if (f.balance < 0 || (hasSubs && f.lessons_remaining <= 1)) {
      payAttention.push({
        student_id: s.id,
        student_name: s.full_name,
        balance: f.balance,
        lessons_remaining: hasSubs ? f.lessons_remaining : null,
      });
    }
  }

  // Неопубликованные отчёты за прошлый месяц
  const { rows: reportsMissing } = await query(
    `SELECT s.id AS student_id, s.full_name AS student_name
       FROM students s
      WHERE s.status = 'active'
        AND EXISTS (SELECT 1 FROM lessons l WHERE l.student_id = s.id AND l.status = 'done'
                     AND l.starts_at >= date_trunc('month', NOW()) - INTERVAL '1 month'
                     AND l.starts_at < date_trunc('month', NOW()))
        AND NOT EXISTS (SELECT 1 FROM monthly_reports r WHERE r.student_id = s.id AND r.published
                         AND r.month = (date_trunc('month', NOW()) - INTERVAL '1 month')::date)
      ORDER BY s.full_name`
  );

  // Запросы учеников на запись / перенос
  const { rows: bookingRequests } = await query(
    `SELECT r.*, s.full_name AS student_name, l.starts_at AS lesson_starts_at
       FROM booking_requests r
       JOIN students s ON s.id = r.student_id
       LEFT JOIN lessons l ON l.id = r.lesson_id
      WHERE r.status = 'pending'
      ORDER BY r.starts_at`
  );

  // Отмены учениками за последнюю неделю — чтобы ничего не пропустить
  const { rows: clientCancellations } = await query(
    `SELECT l.id, l.starts_at, l.cancelled_by_client_at, s.full_name AS student_name
       FROM lessons l JOIN students s ON s.id = l.student_id
      WHERE l.cancelled_by_client_at > NOW() - INTERVAL '7 days'
      ORDER BY l.cancelled_by_client_at DESC`
  );

  return {
    today,
    booking_requests: bookingRequests,
    client_cancellations: clientCancellations,
    attention: {
      unmarked_lessons: unmarked,
      homework_to_check: toCheck,
      payments: payAttention,
      reports_missing: reportsMissing,
    },
  };
}

// Ученик / родитель: по каждому ребёнку
async function studentDashboard(studentId) {
  const { rows: st } = await query('SELECT id, full_name, level, goal, textbook, board_link FROM students WHERE id = $1', [
    studentId,
  ]);
  const { rows: upcoming } = await query(
    `SELECT * FROM lessons WHERE student_id = $1 AND status = 'scheduled' AND starts_at >= NOW()
      ORDER BY starts_at LIMIT 5`,
    [studentId]
  );
  const { rows: lastLesson } = await query(
    `SELECT * FROM lessons WHERE student_id = $1 AND status = 'done' ORDER BY starts_at DESC LIMIT 1`,
    [studentId]
  );
  const { rows: homework } = await query(
    `SELECT h.id, h.status, h.assignment_id, a.title, a.due_on
       FROM homework h JOIN assignments a ON a.id = h.assignment_id
      WHERE h.student_id = $1 AND h.status <> 'checked'
      ORDER BY a.due_on NULLS LAST, h.id`,
    [studentId]
  );
  const { rows: progress } = await query(
    `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'done')::int AS done
       FROM progress_topics WHERE student_id = $1`,
    [studentId]
  );
  const { rows: report } = await query(
    `SELECT id, to_char(month, 'YYYY-MM') AS month_key, published_at FROM monthly_reports
      WHERE student_id = $1 AND published ORDER BY month DESC LIMIT 1`,
    [studentId]
  );
  const f = await studentFinance({ query }, studentId);

  const p = progress[0];
  return {
    student: st[0],
    upcoming: upcoming.map((l) => stripPrivate(l, ['private_notes'])),
    last_lesson: lastLesson[0] ? stripPrivate(lastLesson[0], ['private_notes']) : null,
    homework,
    progress: { ...p, completion: p.total ? Math.round((p.done / p.total) * 100) : 0 },
    latest_report: report[0] || null,
    finance: { balance: f.balance, lessons_remaining: f.lessons_remaining },
  };
}

module.exports = router;
