// services/booking.js — свободные окна для записи
const { query } = require('../db');

const DEFAULTS = { enabled: false, notice_hours: 24, horizon_days: 21, step_min: 30, closed_dates: [] };

async function getBookingSettings(db = { query }) {
  const { rows } = await db.query("SELECT value FROM settings WHERE key = 'booking'");
  return { ...DEFAULTS, ...(rows[0]?.value || {}) };
}

// Свободные начала занятий длительностью durationMin.
// Окна задаются в местном времени (часовой пояс сессии базы), поэтому слоты считаем в SQL.
// exceptLessonId — занятие, которое переносим: оно не мешает само себе.
// exactStart — проверить одно конкретное время (вернёт [] или [время]).
async function freeSlots(db, { durationMin, exceptLessonId = null, exactStart = null }) {
  const s = await getBookingSettings(db);
  const { rows } = await db.query(
    `WITH days AS (
       SELECT d::date AS day FROM generate_series(CURRENT_DATE, CURRENT_DATE + $1::int, INTERVAL '1 day') d
     ),
     candidates AS (
       SELECT ((days.day + a.starts) + make_interval(mins => n * $2::int)) AT TIME ZONE current_setting('TimeZone') AS starts_at
         FROM days
         JOIN availability a ON a.weekday = EXTRACT(ISODOW FROM days.day)
         CROSS JOIN LATERAL generate_series(
           0, FLOOR((EXTRACT(EPOCH FROM (a.ends - a.starts)) / 60 - $3::int) / $2::int)::int
         ) n
        WHERE NOT (days.day = ANY($4::date[]))
     )
     SELECT DISTINCT c.starts_at
       FROM candidates c
      WHERE c.starts_at >= NOW() + make_interval(hours => $5::int)
        AND ($7::timestamptz IS NULL OR c.starts_at = $7::timestamptz)
        AND NOT EXISTS (
          SELECT 1 FROM lessons l
           WHERE l.status IN ('scheduled', 'done')
             AND ($6::int IS NULL OR l.id <> $6::int)
             AND l.starts_at < c.starts_at + make_interval(mins => $3::int)
             AND l.starts_at + make_interval(mins => l.duration_min) > c.starts_at)
        AND NOT EXISTS (
          SELECT 1 FROM booking_requests r
           WHERE r.status = 'pending'
             AND r.starts_at < c.starts_at + make_interval(mins => $3::int)
             AND r.starts_at + make_interval(mins => r.duration_min) > c.starts_at)
      ORDER BY c.starts_at`,
    [
      s.horizon_days,
      s.step_min,
      durationMin,
      s.closed_dates || [],
      s.notice_hours,
      exceptLessonId,
      exactStart,
    ]
  );
  return rows.map((r) => r.starts_at);
}

module.exports = { DEFAULTS, getBookingSettings, freeSlots };
