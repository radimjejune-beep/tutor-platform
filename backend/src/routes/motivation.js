// routes/motivation.js — очки, серия дней и лига недели среди учеников одного репетитора
const express = require('express');
const { query } = require('../db');
const { canAccessStudent, accessibleStudentIds } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/validate');
const { streakOf } = require('../services/points');

const router = express.Router();

async function leagueEnabled(tutorId) {
  const { rows } = await query('SELECT value FROM settings WHERE key = $1', [`profile:${tutorId}`]);
  return rows[0]?.value?.league_enabled !== false;
}

// Лига недели (с понедельника): только активные ученики репетитора
async function leagueOf(tutorId) {
  const { rows } = await query(
    `SELECT s.id, s.full_name, COALESCE(SUM(a.points), 0)::int AS points
       FROM students s
       LEFT JOIN student_activity a ON a.student_id = s.id AND a.day >= date_trunc('week', CURRENT_DATE)::date
      WHERE s.tutor_id = $1 AND s.status = 'active'
      GROUP BY s.id
      ORDER BY points DESC, s.full_name`,
    [tutorId]
  );
  let rank = 0;
  let prev = null;
  return rows.map((r, i) => {
    if (r.points !== prev) rank = i + 1;
    prev = r.points;
    return { ...r, rank };
  });
}

// Имя для чужих глаз: «Анна С.»
const shortName = (full) => {
  const [first, last] = String(full).split(/\s+/);
  return last ? `${first} ${last[0]}.` : first;
};

// ?student_id= — сводка ученика: серия, очки, место в лиге
router.get(
  '/',
  asyncHandler(async (req, res) => {
    let studentId = Number(req.query.student_id) || null;
    if (!studentId && req.user.role !== 'tutor') studentId = (await accessibleStudentIds(req.user))[0] ?? null;
    if (!studentId || !(await canAccessStudent(req.user, studentId))) return res.status(404).json({ error: 'Ученик не найден' });

    const { streak, active_today } = await streakOf(studentId);
    const { rows: pts } = await query(
      `SELECT COALESCE(SUM(points) FILTER (WHERE day = CURRENT_DATE), 0)::int AS today,
              COALESCE(SUM(points) FILTER (WHERE day >= date_trunc('week', CURRENT_DATE)::date), 0)::int AS week,
              COALESCE(SUM(points), 0)::int AS total
         FROM student_activity WHERE student_id = $1`,
      [studentId]
    );
    // Последние 14 дней — для полоски активности
    const { rows: days } = await query(
      `SELECT d::date::text AS day, COALESCE(a.points, 0)::int AS points
         FROM generate_series(CURRENT_DATE - 13, CURRENT_DATE, INTERVAL '1 day') d
         LEFT JOIN student_activity a ON a.student_id = $1 AND a.day = d::date
        ORDER BY d`,
      [studentId]
    );
    const { rows: st } = await query('SELECT tutor_id FROM students WHERE id = $1', [studentId]);
    const tutorId = st[0].tutor_id;
    const enabled = await leagueEnabled(tutorId);
    let league = null;
    if (enabled) {
      const all = await leagueOf(tutorId);
      if (all.length > 1) {
        league = all.slice(0, 10).map((r) => ({ rank: r.rank, name: shortName(r.full_name), points: r.points, me: r.id === studentId }));
        const me = all.find((r) => r.id === studentId);
        if (me && !league.some((r) => r.me)) league.push({ rank: me.rank, name: shortName(me.full_name), points: me.points, me: true });
      }
    }
    res.json({ streak, active_today, points: pts[0], days, league, league_size: league ? (await leagueOf(tutorId)).length : 0 });
  })
);

// Преподаватель: вся лига с полными именами
router.get(
  '/league',
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'tutor') return res.status(403).json({ error: 'Недостаточно прав' });
    const all = await leagueOf(req.user.id);
    const withStreak = [];
    for (const r of all) withStreak.push({ ...r, ...(await streakOf(r.id)) });
    res.json({ enabled: await leagueEnabled(req.user.id), students: withStreak });
  })
);

module.exports = router;
