// services/reminders.js — напоминания в Telegram (только тем, кто подключил бота):
//   • об уроке за час: ученику и родителям, со ссылкой на звонок;
//   • о домашке: накануне срока (с 16:00) и в день срока (с 10:00), если ещё не сдана;
//   • вечером о словах на повторение: ученику, если есть хотя бы 5 слов и сегодня он ещё не занимался.
// Каждое напоминание отправляется один раз (таблица tg_reminders). Работает каждые 5 минут.
const { query } = require('../db');
const tg = require('./telegram');

const TZ = process.env['APP_TIMEZONE'] || 'Europe/Moscow';
const LESSON_BEFORE_MIN = 60;
const HW_EVE_HOUR = 16; // накануне срока
const HW_DAY_HOUR = 10; // в день срока
const WORDS_HOUR = 18; // с 18:00 по местному времени
const WORDS_MIN = 5;

let ready = null;
function ensure() {
  if (!ready) {
    ready = query(`
      CREATE TABLE IF NOT EXISTS tg_reminders (
        kind     VARCHAR(20) NOT NULL,
        ref_id   BIGINT      NOT NULL,
        user_id  INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        sent_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (kind, ref_id, user_id)
      )`).catch((err) => { ready = null; throw err; });
  }
  return ready;
}

// Отметить и узнать, новое ли (true — ещё не отправляли)
async function claim(kind, refId, userId) {
  const { rowCount } = await query('INSERT INTO tg_reminders (kind, ref_id, user_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [kind, refId, userId]);
  return rowCount === 1;
}

const hm = (d) => new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(d));

async function lessonReminders() {
  const { rows } = await query(
    `SELECT l.id, l.starts_at, l.duration_min, s.full_name AS student, tl.user_id, tl.chat_id, u.role,
            COALESCE(NULLIF(l.call_link, ''), NULLIF(s.call_link, '')) AS call_link,
            EXTRACT(EPOCH FROM (l.starts_at - NOW())) / 60 AS left_min
       FROM lessons l
       JOIN students s ON s.id = l.student_id
       JOIN users u ON u.is_active AND (u.id = s.user_id OR u.id IN (SELECT parent_user_id FROM parent_students WHERE student_id = s.id))
       JOIN telegram_links tl ON tl.user_id = u.id
      WHERE l.status = 'scheduled'
        AND l.starts_at > NOW() + INTERVAL '5 minutes'
        AND l.starts_at <= NOW() + make_interval(mins => $1)
        AND l.created_at < l.starts_at - INTERVAL '15 minutes'
        AND NOT EXISTS (SELECT 1 FROM tg_reminders r WHERE r.kind = 'lesson' AND r.ref_id = l.id AND r.user_id = u.id)`,
    [LESSON_BEFORE_MIN]
  );
  let sent = 0;
  for (const r of rows) {
    if (!(await claim('lesson', r.id, r.user_id))) continue;
    const soon = Number(r.left_min) >= 45 ? 'Через час урок' : 'Скоро урок';
    const head = r.role === 'parent' ? `<b>${soon}: ${tg.esc(r.student)}</b>` : `<b>${soon}</b>`;
    const text = `${head}\nНачало в ${hm(r.starts_at)}${r.role === 'parent' ? '' : '. Подготовьте тетрадь и наушники.'}`;
    const buttons = tg.rows(tg.btn('Подключиться к звонку', r.call_link), r.role !== 'parent' && tg.btn('Открыть урок', tg.cabinetUrl(`/lesson/${r.id}`)));
    try {
      await tg.say(r.chat_id, { text, buttons });
      sent++;
    } catch (err) {
      console.error('⚠️ Напоминание об уроке не доставлено:', err.message);
    }
  }
  return sent;
}

async function wordReminders(opts = {}) {
  const hour = opts.hour ?? Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
  if (hour < WORDS_HOUR || hour >= 22) return 0;
  // номер дня по местному времени: одно напоминание в день
  const day = Number(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).replace(/-/g, ''));
  const { rows } = await query(
    `SELECT s.id AS student_id, tl.user_id, tl.chat_id, COUNT(v.id)::int AS due
       FROM students s
       JOIN users u ON u.id = s.user_id AND u.is_active
       JOIN telegram_links tl ON tl.user_id = u.id
       JOIN vocab_items v ON v.student_id = s.id AND v.due_on <= (NOW() AT TIME ZONE $1)::date
      WHERE s.status = 'active'
        AND NOT EXISTS (SELECT 1 FROM tg_reminders r WHERE r.kind = 'words' AND r.ref_id = $2 AND r.user_id = u.id)
        AND NOT EXISTS (SELECT 1 FROM vocab_items x WHERE x.student_id = s.id AND (x.last_reviewed_at AT TIME ZONE $1)::date = (NOW() AT TIME ZONE $1)::date)
        AND NOT EXISTS (SELECT 1 FROM practice_log p WHERE p.student_id = s.id AND (p.created_at AT TIME ZONE $1)::date = (NOW() AT TIME ZONE $1)::date)
      GROUP BY s.id, tl.user_id, tl.chat_id
     HAVING COUNT(v.id) >= $3`,
    [TZ, day, WORDS_MIN]
  );
  let sent = 0;
  for (const r of rows) {
    if (!(await claim('words', day, r.user_id))) continue;
    try {
      await tg.say(r.chat_id, { text: `<b>Слова на повторение: ${r.due}</b>\nПять минут сегодня, и они запомнятся надолго.`, buttons: tg.rows(tg.btn('Повторить слова', tg.cabinetUrl('/words'))) });
      sent++;
    } catch (err) {
      console.error('⚠️ Напоминание о словах не доставлено:', err.message);
    }
  }
  return sent;
}

const localHour = () => Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
const fmtDay = (d) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date(`${String(d).slice(0, 10)}T12:00:00`));

// Домашка: накануне срока и в день срока, пока не сдана. Ученику и родителям
async function homeworkReminders(opts = {}) {
  const hour = opts.hour ?? localHour();
  if (hour >= 22 || hour < HW_DAY_HOUR) return 0;
  const { rows } = await query(
    `SELECT h.id, a.title, a.due_on, s.full_name AS student, tl.user_id, tl.chat_id, u.role,
            (a.due_on = (NOW() AT TIME ZONE $1)::date) AS today
       FROM homework h
       JOIN assignments a ON a.id = h.assignment_id
       JOIN students s ON s.id = h.student_id AND s.status = 'active'
       JOIN users u ON u.is_active AND (u.id = s.user_id OR u.id IN (SELECT parent_user_id FROM parent_students WHERE student_id = s.id))
       JOIN telegram_links tl ON tl.user_id = u.id
      WHERE h.status = 'assigned' AND a.due_on IS NOT NULL
        AND (a.due_on = (NOW() AT TIME ZONE $1)::date OR (a.due_on = (NOW() AT TIME ZONE $1)::date + 1 AND $2::int >= $3))
        AND h.created_at < NOW() - INTERVAL '3 hours'`,
    [TZ, hour, HW_EVE_HOUR]
  );
  let sent = 0;
  for (const r of rows) {
    if (!(await claim(r.today ? 'hw_day' : 'hw_eve', r.id, r.user_id))) continue;
    const when = r.today ? 'сегодня' : `завтра, ${fmtDay(r.due_on)}`;
    const head = r.today ? '<b>Сегодня срок домашки</b>' : '<b>Завтра срок домашки</b>';
    const text = r.role === 'parent'
      ? `${head}\n${tg.esc(r.student)}: «${tg.esc(r.title)}», срок ${when}. Задание ещё не сдано.`
      : `${head}\n«${tg.esc(r.title)}», срок ${when}. Задание ещё не сдано.`;
    try {
      await tg.say(r.chat_id, { text, buttons: tg.rows(tg.btn('Открыть задание', tg.cabinetUrl(`/homework/${r.id}`))) });
      sent++;
    } catch (err) {
      console.error('⚠️ Напоминание о домашке не доставлено:', err.message);
    }
  }
  return sent;
}

async function tick() {
  if (!tg.enabled() || !tg.username()) return;
  try {
    await ensure();
    const a = await lessonReminders();
    const h = await homeworkReminders();
    const b = await wordReminders();
    if (a || h || b) console.log(`🔔 Напоминания в Telegram: уроки ${a}, домашка ${h}, слова ${b}`);
  } catch (err) {
    console.error('🔔 Напоминания не отправлены:', err.message);
  }
}

function start() {
  setTimeout(tick, 60 * 1000);
  setInterval(tick, 5 * 60 * 1000);
}

module.exports = { start, tick, lessonReminders, homeworkReminders, wordReminders, ensure };
