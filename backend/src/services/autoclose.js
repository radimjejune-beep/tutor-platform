// services/autoclose.js — автосписание: урок, время которого закончилось, сам становится «проведён»
// и списывается с абонемента (или как разовый, если абонемента нет).
//
// • Проверка раз в 5 минут.
// • Берутся только занятия со статусом «запланировано», которые закончились не раньше чем 2 дня назад:
//   старые неотмеченные уроки не трогаем, чтобы при включении не списать лишнее разом.
// • Настройка у каждого репетитора своя (settings, ключ autoclose:<id>): включено ли и через сколько минут
//   после конца урока списывать. По умолчанию включено, сразу после конца.
// • Если урок на самом деле отменили или ученик не пришёл, репетитор меняет статус как обычно,
//   и списание пересчитывается само.
const { query, transaction } = require('../db');
const { syncLessonCharge } = require('./billing');
const notify = require('./notify');

const EVERY_MS = 5 * 60 * 1000;
const DEFAULTS = { enabled: true, delay_min: 0 };
const DELAYS = [0, 15, 30, 60, 180, 720];

async function getSettings(tutorId) {
  const { rows } = await query('SELECT value FROM settings WHERE key = $1', [`autoclose:${tutorId}`]);
  return { ...DEFAULTS, ...(rows[0]?.value || {}) };
}

async function saveSettings(tutorId, s) {
  const value = { enabled: Boolean(s.enabled), delay_min: DELAYS.includes(Number(s.delay_min)) ? Number(s.delay_min) : 0 };
  await query(
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [`autoclose:${tutorId}`, JSON.stringify(value)]
  );
  return value;
}

// Один проход: возвращает число отмеченных уроков
async function run() {
  const { rows } = await query(
    `SELECT l.id, s.tutor_id, s.full_name
       FROM lessons l
       JOIN students s ON s.id = l.student_id
       LEFT JOIN settings st ON st.key = 'autoclose:' || s.tutor_id
      WHERE l.status = 'scheduled'
        AND COALESCE((st.value->>'enabled')::boolean, TRUE)
        AND l.starts_at + make_interval(mins => l.duration_min + COALESCE((st.value->>'delay_min')::int, 0)) <= NOW()
        AND l.starts_at + make_interval(mins => l.duration_min) > NOW() - INTERVAL '2 days'
      ORDER BY l.starts_at
      LIMIT 300`
  );
  const byTutor = new Map();
  for (const r of rows) {
    const done = await transaction(async (client) => {
      const { rows: cur } = await client.query("SELECT * FROM lessons WHERE id = $1 AND status = 'scheduled' FOR UPDATE", [r.id]);
      if (!cur[0]) return null; // репетитор уже отметил сам
      const { rows: [upd] } = await client.query("UPDATE lessons SET status = 'done' WHERE id = $1 RETURNING *", [r.id]);
      return syncLessonCharge(client, upd);
    });
    if (!done) continue;
    if (!byTutor.has(r.tutor_id)) byTutor.set(r.tutor_id, []);
    byTutor.get(r.tutor_id).push(r.full_name);
  }
  for (const [tutorId, names] of byTutor) {
    const uniq = [...new Set(names)];
    notify.toTutor(tutorId, {
      kind: 'lessons_auto',
      title: names.length === 1 ? `Урок отмечен проведённым и списан: ${uniq[0]}` : `Уроки отмечены проведёнными и списаны: ${names.length}`,
      body: `${uniq.join(', ')}. Если урок не состоялся, откройте его в расписании и поставьте «Отменено»: списание снимется.`,
      link: '/schedule',
    });
  }
  const n = [...byTutor.values()].reduce((a, b) => a + b.length, 0);
  if (n) console.log(`⏱️ Автосписание, отмечено уроков: ${n}`);
  return n;
}

let timer = null;
function start() {
  if (timer || process.env['AUTOCLOSE_OFF'] === '1') return;
  const tick = () => run().catch((err) => console.error('⏱️ Автосписание не сработало:', err.message));
  setTimeout(tick, 20000).unref?.();
  timer = setInterval(tick, EVERY_MS);
  timer.unref?.();
}

module.exports = { run, start, getSettings, saveSettings, DELAYS };
