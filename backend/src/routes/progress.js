// routes/progress.js — прогресс по темам и ежемесячные отчёты
const express = require('express');
const { z } = require('zod');
const { query } = require('../db');
const { requireRole, requireStudentAccess, canAccessStudent, requireOwn } = require('../middleware/auth');
const { validateBody, asyncHandler } = require('../middleware/validate');
const { buildUpdate } = require('../utils');
const notify = require('../services/notify');

const router = express.Router();
const tutorOnly = requireRole('tutor');

const skill = z.enum(['grammar', 'vocabulary', 'speaking', 'listening', 'reading', 'writing']);
const monthStr = z.string().regex(/^\d{4}-\d{2}$/, 'Месяц в формате ГГГГ-ММ');

// Цифры за месяц: занятия, посещаемость, ДЗ, пройденные темы
async function monthStats(studentId, month /* 'YYYY-MM' */) {
  const { rows } = await query(
    `WITH m AS (SELECT ($2 || '-01')::date AS s)
     SELECT
       (SELECT COUNT(*)::int FROM lessons, m WHERE student_id = $1 AND status = 'done'
          AND starts_at >= m.s AND starts_at < m.s + INTERVAL '1 month') AS lessons_done,
       (SELECT COUNT(*)::int FROM lessons, m WHERE student_id = $1 AND status IN ('missed', 'cancelled_late')
          AND starts_at >= m.s AND starts_at < m.s + INTERVAL '1 month') AS lessons_missed,
       (SELECT COUNT(*)::int FROM homework, m WHERE student_id = $1
          AND created_at >= m.s AND created_at < m.s + INTERVAL '1 month') AS homework_given,
       (SELECT COUNT(*)::int FROM homework, m WHERE student_id = $1 AND status IN ('submitted', 'checked')
          AND created_at >= m.s AND created_at < m.s + INTERVAL '1 month') AS homework_done,
       (SELECT ROUND(AVG(score))::int FROM homework, m WHERE student_id = $1 AND score IS NOT NULL
          AND created_at >= m.s AND created_at < m.s + INTERVAL '1 month') AS homework_avg_score,
       (SELECT COALESCE(json_agg(title ORDER BY completed_on), '[]') FROM progress_topics, m
         WHERE student_id = $1 AND status = 'done'
           AND completed_on >= m.s AND completed_on < m.s + INTERVAL '1 month') AS topics_completed`,
    [studentId, month]
  );
  return rows[0];
}

// ------------------------------------------------------------
// Прогресс ученика: темы, сводка по навыкам, отчёты
// ------------------------------------------------------------
router.get(
  '/students/:studentId',
  requireStudentAccess(),
  asyncHandler(async (req, res) => {
    const isTutor = req.user.role === 'tutor';

    const { rows: topics } = await query(
      'SELECT * FROM progress_topics WHERE student_id = $1 ORDER BY sort_order, id',
      [req.studentId]
    );
    const { rows: bySkill } = await query(
      `SELECT skill, COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'done')::int AS done
         FROM progress_topics WHERE student_id = $1 GROUP BY skill ORDER BY skill`,
      [req.studentId]
    );
    const { rows: reports } = await query(
      `SELECT *, to_char(month, 'YYYY-MM') AS month_key FROM monthly_reports
        WHERE student_id = $1 AND ($2 OR published)
        ORDER BY month DESC`,
      [req.studentId, isTutor]
    );
    // Занятия по месяцам за последние 6 месяцев — для графика
    const { rows: lessonsByMonth } = await query(
      `SELECT to_char(date_trunc('month', starts_at), 'YYYY-MM') AS month, COUNT(*)::int AS lessons_done
         FROM lessons
        WHERE student_id = $1 AND status = 'done' AND starts_at >= date_trunc('month', NOW()) - INTERVAL '5 months'
        GROUP BY 1 ORDER BY 1`,
      [req.studentId]
    );

    // Словарь: сколько слов на каждом уровне (0 — новое, 5 — выучено надолго)
    const { rows: vocab } = await query(
      `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE box >= 4)::int AS learned,
              COUNT(*) FILTER (WHERE due_on <= CURRENT_DATE)::int AS due,
              COALESCE(json_agg(box ORDER BY box) FILTER (WHERE TRUE), '[]') AS boxes
         FROM vocab_items WHERE student_id = $1`,
      [req.studentId]
    );
    const boxes = [0, 0, 0, 0, 0, 0];
    for (const bx of vocab[0].boxes) boxes[bx]++;

    // Упражнения: последние результаты и средний процент
    const { rows: games } = await query(
      `SELECT r.item_id, i.title, r.score, r.correct, r.total, r.created_at
         FROM game_results r JOIN library_items i ON i.id = r.item_id
        WHERE r.student_id = $1 ORDER BY r.created_at DESC LIMIT 12`,
      [req.studentId]
    );
    const { rows: gameAvg } = await query(
      `SELECT COUNT(*)::int AS attempts, COALESCE(ROUND(AVG(score)), 0)::int AS avg_score,
              COUNT(*) FILTER (WHERE score = 100)::int AS perfect
         FROM game_results WHERE student_id = $1 AND created_at > NOW() - INTERVAL '90 days'`,
      [req.studentId]
    );

    // Домашние задания за 90 дней
    const { rows: hw } = await query(
      `SELECT COUNT(*)::int AS given,
              COUNT(*) FILTER (WHERE h.status <> 'assigned')::int AS done,
              COUNT(*) FILTER (WHERE h.status <> 'assigned' AND (a.due_on IS NULL OR h.submitted_at::date <= a.due_on))::int AS on_time,
              COALESCE(ROUND(AVG(COALESCE(h.score, h.quiz_score)) FILTER (WHERE h.status = 'checked')), 0)::int AS avg_score
         FROM homework h JOIN assignments a ON a.id = h.assignment_id
        WHERE h.student_id = $1 AND h.created_at > NOW() - INTERVAL '90 days'`,
      [req.studentId]
    );

    // Курс: сколько юнитов пройдено
    const { rows: course } = await query(
      `SELECT c.title, u.code, u.title AS unit_title,
              (SELECT COUNT(*)::int FROM course_units x WHERE x.course_id = c.id) AS units_total,
              (SELECT COUNT(*)::int FROM course_units x WHERE x.course_id = c.id AND (x.position, x.id) < (u.position, u.id)) AS units_done
         FROM students s JOIN courses c ON c.id = s.course_id LEFT JOIN course_units u ON u.id = s.course_unit_id
        WHERE s.id = $1`,
      [req.studentId]
    );

    const total = topics.length;
    const done = topics.filter((t) => t.status === 'done').length;
    res.json({
      vocab: { total: vocab[0].total, learned: vocab[0].learned, due: vocab[0].due, boxes },
      games: { ...gameAvg[0], recent: games },
      homework: hw[0],
      course: course[0] || null,
      topics,
      by_skill: bySkill,
      completion: total ? Math.round((done / total) * 100) : 0,
      lessons_by_month: lessonsByMonth,
      reports,
    });
  })
);

// ------------------------------------------------------------
// Темы: можно добавить сразу список (например, все темы юнита)
// ------------------------------------------------------------
const topicsSchema = z
  .object({
    student_id: z.number().int().positive(),
    section: z.string().trim().max(255).nullable().optional(),
    items: z
      .array(z.object({ title: z.string().trim().min(1).max(255), skill: skill.optional() }).strict())
      .min(1)
      .max(100),
  })
  .strict();

router.post(
  '/topics',
  tutorOnly,
  validateBody(topicsSchema),
  asyncHandler(async (req, res) => {
    const { student_id, section, items } = req.body;
    if (!(await canAccessStudent(req.user, student_id))) return res.status(404).json({ error: 'Ученик не найден' });
    const { rows: maxRow } = await query(
      'SELECT COALESCE(MAX(sort_order), 0) AS m FROM progress_topics WHERE student_id = $1',
      [student_id]
    );
    let order = maxRow[0].m;
    const created = [];
    for (const it of items) {
      order += 10;
      const { rows } = await query(
        `INSERT INTO progress_topics (student_id, section, title, skill, sort_order)
         VALUES ($1, $2, $3, COALESCE($4, 'grammar'), $5) RETURNING *`,
        [student_id, section || null, it.title, it.skill || null, order]
      );
      created.push(rows[0]);
    }
    console.log(`✅ Тем добавлено: ${created.length} (ученик #${student_id})`);
    res.status(201).json(created);
  })
);

const topicUpdateSchema = z
  .object({
    section: z.string().trim().max(255).nullable(),
    title: z.string().trim().min(1).max(255),
    skill,
    status: z.enum(['planned', 'in_progress', 'done']),
    sort_order: z.number().int(),
    completed_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  })
  .partial()
  .strict();

router.patch(
  '/topics/:id',
  tutorOnly,
  requireOwn('progress_topics', 'id', 'Тема не найдена'),
  validateBody(topicUpdateSchema),
  asyncHandler(async (req, res) => {
    const data = { ...req.body };
    // Отметили «пройдено» без даты → ставим сегодня; сняли отметку → убираем дату
    if (data.status === 'done' && data.completed_on === undefined) data.completed_on = new Date().toISOString().slice(0, 10);
    if (data.status && data.status !== 'done') data.completed_on = null;

    const upd = buildUpdate('progress_topics', Number(req.params.id), data);
    if (!upd) return res.status(400).json({ error: 'Нет изменений' });
    const { rows } = await query(upd.text, upd.values);
    if (!rows[0]) return res.status(404).json({ error: 'Тема не найдена' });
    res.json(rows[0]);
  })
);

router.delete(
  '/topics/:id',
  tutorOnly,
  requireOwn('progress_topics', 'id', 'Тема не найдена'),
  asyncHandler(async (req, res) => {
    const { rows } = await query('DELETE FROM progress_topics WHERE id = $1 RETURNING id', [Number(req.params.id)]);
    if (!rows[0]) return res.status(404).json({ error: 'Тема не найдена' });
    res.json({ ok: true });
  })
);

// ------------------------------------------------------------
// Ежемесячные отчёты
// ------------------------------------------------------------

// ------------------------------------------------------------
// Итоги по месяцам — собираются сами, видят ученик и родитель
// К месяцу добавляется опубликованный отзыв преподавателя, если он есть
// ------------------------------------------------------------
router.get(
  '/students/:studentId/months',
  requireStudentAccess(),
  asyncHandler(async (req, res) => {
    // Месяцы, в которых были проведённые занятия (последние 6)
    const { rows: months } = await query(
      `SELECT DISTINCT to_char(date_trunc('month', starts_at), 'YYYY-MM') AS month
         FROM lessons
        WHERE student_id = $1 AND status = 'done' AND starts_at >= date_trunc('month', NOW()) - INTERVAL '5 months'
        ORDER BY 1 DESC`,
      [req.studentId]
    );
    const { rows: reports } = await query(
      `SELECT id, to_char(month, 'YYYY-MM') AS month_key, summary FROM monthly_reports
        WHERE student_id = $1 AND published`,
      [req.studentId]
    );
    const out = [];
    for (const { month } of months) {
      const r = reports.find((x) => x.month_key === month);
      out.push({ month, ...(await monthStats(req.studentId, month)), report_id: r?.id || null, tutor_summary: r?.summary || null });
    }
    res.json(out);
  })
);

// Цифры за месяц для заполнения отчёта (репетитор)
router.get(
  '/students/:studentId/month-stats',
  tutorOnly,
  requireStudentAccess(),
  asyncHandler(async (req, res) => {
    const parsed = monthStr.safeParse(req.query.month);
    const month = parsed.success ? parsed.data : new Date().toISOString().slice(0, 7);
    res.json({ month, ...(await monthStats(req.studentId, month)) });
  })
);

const reportFields = {
  summary: z.string().max(5000).nullable(),
  strengths: z.string().max(5000).nullable(),
  to_improve: z.string().max(5000).nullable(),
  plan_next: z.string().max(5000).nullable(),
};

// Создать или обновить черновик отчёта за месяц
router.put(
  '/reports',
  tutorOnly,
  validateBody(
    z
      .object({ student_id: z.number().int().positive(), month: monthStr, ...reportFields })
      .partial({ summary: true, strengths: true, to_improve: true, plan_next: true })
      .strict()
  ),
  asyncHandler(async (req, res) => {
    const b = req.body;
    if (!(await canAccessStudent(req.user, b.student_id))) return res.status(404).json({ error: 'Ученик не найден' });
    const { rows } = await query(
      `INSERT INTO monthly_reports (student_id, month, summary, strengths, to_improve, plan_next)
       VALUES ($1, ($2 || '-01')::date, $3, $4, $5, $6)
       ON CONFLICT (student_id, month) DO UPDATE SET
         summary = COALESCE(EXCLUDED.summary, monthly_reports.summary),
         strengths = COALESCE(EXCLUDED.strengths, monthly_reports.strengths),
         to_improve = COALESCE(EXCLUDED.to_improve, monthly_reports.to_improve),
         plan_next = COALESCE(EXCLUDED.plan_next, monthly_reports.plan_next)
       RETURNING *, to_char(month, 'YYYY-MM') AS month_key`,
      [b.student_id, b.month, b.summary ?? null, b.strengths ?? null, b.to_improve ?? null, b.plan_next ?? null]
    );
    console.log(`📝 Отчёт за ${b.month} (ученик #${b.student_id}) сохранён`);
    res.json(rows[0]);
  })
);

// Опубликовать / скрыть отчёт (после публикации его видят ученик и родители)
router.patch(
  '/reports/:id',
  tutorOnly,
  requireOwn('monthly_reports', 'id', 'Отчёт не найден'),
  validateBody(z.object({ published: z.boolean(), ...reportFields }).partial().strict()),
  asyncHandler(async (req, res) => {
    const data = { ...req.body };
    if (data.published === true) data.published_at = new Date().toISOString();
    if (data.published === false) data.published_at = null;
    const upd = buildUpdate('monthly_reports', Number(req.params.id), data);
    if (!upd) return res.status(400).json({ error: 'Нет изменений' });
    const { rows } = await query(upd.text, upd.values);
    if (!rows[0]) return res.status(404).json({ error: 'Отчёт не найден' });
    console.log(`${rows[0].published ? '✅ Опубликован' : '📝 Скрыт'} отчёт #${rows[0].id}`);
    if (req.body.published === true) {
      notify.toStudent(rows[0].student_id, { kind: 'report', title: 'Готов отчёт за месяц', body: 'Что получилось, над чем работаем и план на следующий месяц', link: `/reports/${rows[0].id}` });
    }
    res.json(rows[0]);
  })
);

// Отчёт с цифрами за месяц (для просмотра учеником/родителем — только опубликованный)
router.get(
  '/reports/:id',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT *, to_char(month, 'YYYY-MM') AS month_key FROM monthly_reports WHERE id = $1`,
      [Number(req.params.id)]
    );
    const r = rows[0];
    const visible = r && (await canAccessStudent(req.user, r.student_id)) && (req.user.role === 'tutor' || r.published);
    if (!visible) return res.status(404).json({ error: 'Отчёт не найден' });
    res.json({ ...r, stats: await monthStats(r.student_id, r.month_key) });
  })
);

module.exports = router;
