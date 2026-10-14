// services/points.js — очки ученика: за повторение, упражнения, разминку и сданное ДЗ
// Из очков по дням считаются серия (сколько дней подряд занимался) и лига недели
const { query } = require('../db');

const POINTS = {
  review: 1, // карточка в словаре
  practiceCorrect: 2, // верное слово в отработке или разминке
  gameCorrect: 1, // верный ответ в упражнении
  homework: 10, // работа сдана
  homeworkOnTime: 5, // и сдана вовремя
};

// Начислить очки за сегодня. Ошибка начисления никогда не мешает основному действию
async function addPoints(studentId, n) {
  if (!studentId || !(n > 0)) return;
  try {
    await query(
      `INSERT INTO student_activity (student_id, day, points) VALUES ($1, CURRENT_DATE, $2)
       ON CONFLICT (student_id, day) DO UPDATE SET points = student_activity.points + EXCLUDED.points`,
      [studentId, Math.round(n)]
    );
  } catch (err) {
    console.error('Очки не начислены:', err.message);
  }
}

// Серия: дни подряд с очками, заканчивая сегодня (или вчера — сегодня ещё можно успеть)
async function streakOf(studentId) {
  const { rows } = await query(
    `SELECT day::text FROM student_activity WHERE student_id = $1 AND points > 0 AND day > CURRENT_DATE - 400 ORDER BY day DESC`,
    [studentId]
  );
  const { rows: t } = await query('SELECT CURRENT_DATE::text AS today, (CURRENT_DATE - 1)::text AS yesterday');
  const days = new Set(rows.map((r) => r.day));
  let cursor = days.has(t[0].today) ? new Date(`${t[0].today}T12:00:00Z`) : days.has(t[0].yesterday) ? new Date(`${t[0].yesterday}T12:00:00Z`) : null;
  let streak = 0;
  while (cursor && days.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor = new Date(cursor.getTime() - 864e5);
  }
  return { streak, active_today: days.has(t[0].today) };
}

module.exports = { POINTS, addPoints, streakOf };
