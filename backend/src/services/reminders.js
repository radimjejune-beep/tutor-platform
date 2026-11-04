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
    `SELECT l.id, l.starts_at, l.duration_min, s.full_name AS student, s.tutor_id, tl.user_id, tl.chat_id, u.role,
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
  for (const r of await tg.byPlan(rows)) {
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
    `SELECT s.id AS student_id, s.tutor_id, tl.user_id, tl.chat_id, COUNT(v.id)::int AS due
       FROM students s
       JOIN users u ON u.id = s.user_id AND u.is_active
       JOIN telegram_links tl ON tl.user_id = u.id
       JOIN vocab_items v ON v.student_id = s.id AND v.due_on <= (NOW() AT TIME ZONE $1)::date
      WHERE s.status = 'active'
        AND NOT EXISTS (SELECT 1 FROM tg_reminders r WHERE r.kind = 'words' AND r.ref_id = $2 AND r.user_id = u.id)
        AND NOT EXISTS (SELECT 1 FROM vocab_items x WHERE x.student_id = s.id AND (x.last_reviewed_at AT TIME ZONE $1)::date = (NOW() AT TIME ZONE $1)::date)
        AND NOT EXISTS (SELECT 1 FROM practice_log p WHERE p.student_id = s.id AND (p.created_at AT TIME ZONE $1)::date = (NOW() AT TIME ZONE $1)::date)
      GROUP BY s.id, s.tutor_id, tl.user_id, tl.chat_id
     HAVING COUNT(v.id) >= $3`,
    [TZ, day, WORDS_MIN]
  );
  let sent = 0;
  for (const r of await tg.byPlan(rows)) {
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
    `SELECT h.id, a.title, a.due_on, s.full_name AS student, s.tutor_id, tl.user_id, tl.chat_id, u.role,
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
  for (const r of await tg.byPlan(rows)) {
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

// ------------------------------------------------------------
// Преподавателю: утренняя сводка и напоминание написать итоги после урока
// ------------------------------------------------------------
const DIGEST_HOUR = 8;

async function tutorDigest(opts = {}) {
  const hour = opts.hour ?? localHour();
  if (hour < DIGEST_HOUR || hour >= 12) return 0;
  const day = Number(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).replace(/-/g, ''));
  const { rows: tutors } = await query(
    `SELECT u.id AS tutor_id, u.id AS user_id, u.full_name, tl.chat_id FROM users u JOIN telegram_links tl ON tl.user_id = u.id
      WHERE u.role = 'tutor' AND u.is_active
        AND NOT EXISTS (SELECT 1 FROM tg_reminders r WHERE r.kind = 'digest' AND r.ref_id = $1 AND r.user_id = u.id)`,
    [day]
  );
  const { studentFinance } = require('./billing');
  let sent = 0;
  for (const t of await tg.byPlan(tutors)) {
    const { rows: lessons } = await query(
      `SELECT l.starts_at, s.full_name, l.group_id, g.name AS group_name FROM lessons l JOIN students s ON s.id = l.student_id LEFT JOIN groups g ON g.id = l.group_id
        WHERE s.tutor_id = $1 AND l.status = 'scheduled' AND (l.starts_at AT TIME ZONE $2)::date = (NOW() AT TIME ZONE $2)::date
        ORDER BY l.starts_at`,
      [t.tutor_id, TZ]
    );
    // групповой урок показываем одной строкой
    const seen = new Set();
    const items = lessons.filter((l) => !l.group_id || (!seen.has(`${l.group_id}${l.starts_at}`) && seen.add(`${l.group_id}${l.starts_at}`)));
    const { rows: hw } = await query(
      "SELECT COUNT(*)::int AS n FROM homework h JOIN students s ON s.id = h.student_id WHERE s.tutor_id = $1 AND h.status = 'submitted'",
      [t.tutor_id]
    );
    const { rows: studs } = await query("SELECT id, full_name FROM students WHERE tutor_id = $1 AND status = 'active'", [t.tutor_id]);
    const debtors = [];
    for (const st of studs) {
      const f = await studentFinance({ query }, st.id).catch(() => null);
      if (f && f.balance < 0) debtors.push(`${st.full_name.split(' ')[0]} ${Math.abs(Math.round(f.balance)).toLocaleString('ru-RU')} ₽`);
    }
    if (!items.length && !hw[0].n && !debtors.length) { await claim('digest', day, t.user_id); continue; }
    if (!(await claim('digest', day, t.user_id))) continue;
    const lines = [`<b>Доброе утро! План на сегодня</b>`, ''];
    if (items.length) {
      lines.push(`<b>Уроков: ${items.length}</b>`);
      for (const l of items) lines.push(`${hm(l.starts_at)}  ${tg.esc(l.group_id ? `группа ${l.group_name || ''}`.trim() : l.full_name)}`);
    } else lines.push('Уроков сегодня нет.');
    if (hw[0].n) lines.push('', `<b>Ждут проверки:</b> ${hw[0].n}`);
    if (debtors.length) lines.push('', `<b>Не оплачено:</b> ${tg.esc(debtors.slice(0, 5).join(', '))}${debtors.length > 5 ? ` и ещё ${debtors.length - 5}` : ''}`);
    const buttons = tg.rows([tg.btn('Расписание', tg.cabinetUrl('/schedule')), hw[0].n && tg.btn('Проверить', tg.cabinetUrl('/homework'))], debtors.length && tg.btn('Оплаты', tg.cabinetUrl('/finance')));
    try {
      await tg.say(t.chat_id, { text: lines.join('\n'), buttons });
      sent++;
    } catch (err) {
      console.error('⚠️ Утренняя сводка не доставлена:', err.message);
    }
  }
  return sent;
}

async function tutorAfterLesson() {
  const { rows } = await query(
    `SELECT l.id, l.starts_at, s.full_name, s.tutor_id, tl.user_id, tl.chat_id
       FROM lessons l JOIN students s ON s.id = l.student_id
       JOIN telegram_links tl ON tl.user_id = s.tutor_id
      WHERE l.group_id IS NULL AND l.status IN ('scheduled', 'done') AND COALESCE(l.summary, '') = ''
        AND l.starts_at + make_interval(mins => l.duration_min) BETWEEN NOW() - INTERVAL '2 hours' AND NOW() - INTERVAL '10 minutes'
        AND NOT EXISTS (SELECT 1 FROM tg_reminders r WHERE r.kind = 'after' AND r.ref_id = l.id AND r.user_id = tl.user_id)`
  );
  let sent = 0;
  for (const r of await tg.byPlan(rows)) {
    if (!(await claim('after', r.id, r.user_id))) continue;
    try {
      await tg.say(r.chat_id, {
        text: `<b>Урок закончился: ${tg.esc(r.full_name)}</b>\nНапишите в двух словах, что прошли. Итоги и домашка уйдут родителям сами.`,
        buttons: tg.rows(tg.btn('Написать итоги', tg.cabinetUrl(`/lesson/${r.id}`))),
      });
      sent++;
    } catch (err) {
      console.error('⚠️ Напоминание об итогах не доставлено:', err.message);
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
    const d = await tutorDigest();
    const f = await tutorAfterLesson();
    if (a || h || b || d || f) console.log(`🔔 Напоминания в Telegram: уроки ${a}, домашка ${h}, слова ${b}, сводки ${d}, итоги ${f}`);
  } catch (err) {
    console.error('🔔 Напоминания не отправлены:', err.message);
  }
}

function start() {
  setTimeout(tick, 60 * 1000);
  setInterval(tick, 5 * 60 * 1000);
}

module.exports = { start, tick, lessonReminders, homeworkReminders, wordReminders, tutorDigest, tutorAfterLesson, ensure };
