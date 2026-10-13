// services/notify.js — уведомления в кабинете
// Вызывается ПОСЛЕ основного действия: ошибка уведомления никогда не ломает сохранение
const { query } = require('../db');

const TZ = process.env['APP_TIMEZONE'] || 'Europe/Moscow';
const when = (d) =>
  new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    .format(new Date(d))
    .replace(',', '');

// Ученик и его родители (только активные входы)
async function studentUsers(studentId) {
  const { rows } = await query(
    `SELECT u.id FROM students s JOIN users u ON u.id = s.user_id WHERE s.id = $1 AND u.is_active
     UNION
     SELECT u.id FROM parent_students ps JOIN users u ON u.id = ps.parent_user_id WHERE ps.student_id = $1 AND u.is_active`,
    [studentId]
  );
  return rows.map((r) => r.id);
}


async function send(userIds, { kind, title, body = null, link = null }) {
  for (const id of new Set(userIds)) {
    await query('INSERT INTO notifications (user_id, kind, title, body, link) VALUES ($1, $2, $3, $4, $5)', [
      id,
      kind,
      String(title).slice(0, 255),
      body ? String(body).slice(0, 2000) : null,
      link,
    ]);
  }
}

// Безопасные обёртки: логируем и идём дальше
const safe = (fn) => (...args) =>
  fn(...args).catch((err) => console.error('🔔 Уведомление не отправлено:', err.message));

const toStudent = safe(async (studentId, msg) => send(await studentUsers(studentId), msg));
// Репетитору ученика (tutorId — его id)
const toTutor = safe(async (tutorId, msg) => send(tutorId ? [tutorId] : [], msg));

module.exports = { toStudent, toTutor, when };
