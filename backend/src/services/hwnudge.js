// services/hwnudge.js — после проведённого урока напомнить преподавателю выдать домашнее задание.
// Раз в 10 минут: уроки, которые закончились от 10 минут до суток назад и отмечены проведёнными.
// Если ученику (или группе) с начала урока не выдано ни одного задания, преподавателю приходит
// уведомление в кабинет и в Telegram со ссылкой «Выдать задание». По каждому уроку один раз.
const fs = require('fs');
const path = require('path');
const { query } = require('../db');
const notify = require('./notify');
const { withLock } = require('./jobs');

let ready = null;
function ensure() {
  if (!ready) {
    const sql = fs.readFileSync(path.join(__dirname, '..', '..', 'migrations', '014_homework_nudge_answer_mode.sql'), 'utf8');
    ready = query(sql).catch((err) => { ready = null; throw err; });
  }
  return ready;
}

async function run() {
  await ensure();
  await require('../routes/demo').ensure();
  const { rows } = await query(
    `SELECT l.id, l.student_id, l.group_id, l.starts_at, s.tutor_id, s.full_name, g.name AS group_title,
            EXISTS (
              SELECT 1 FROM homework h JOIN assignments a ON a.id = h.assignment_id
               WHERE h.student_id = l.student_id AND a.created_at >= l.starts_at - INTERVAL '2 hours'
            ) AS has_hw
       FROM lessons l
       JOIN students s ON s.id = l.student_id
       LEFT JOIN groups g ON g.id = l.group_id
      WHERE l.status = 'done' AND l.hw_reminded_at IS NULL AND NOT s.is_demo
        AND l.starts_at + make_interval(mins => l.duration_min) BETWEEN NOW() - INTERVAL '1 day' AND NOW() - INTERVAL '10 minutes'
      ORDER BY l.starts_at`
  );
  if (!rows.length) return 0;
  // Групповой урок = несколько строк (по ученику). Напоминаем один раз на группу и время.
  const byKey = new Map();
  for (const r of rows) {
    const key = r.group_id ? `g${r.group_id}-${new Date(r.starts_at).getTime()}` : `s${r.id}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(r);
  }
  let sent = 0;
  for (const list of byKey.values()) {
    const r = list[0];
    const missing = list.filter((x) => !x.has_hw);
    if (missing.length) {
      const group = Boolean(r.group_id);
      await notify.toTutor(r.tutor_id, {
        kind: 'homework_nudge',
        title: group ? `Выдайте ДЗ группе «${r.group_title || 'группа'}»` : `Выдайте ДЗ: ${r.full_name}`,
        body: group
          ? `Урок прошёл, а задание после него получили не все: ${missing.map((x) => x.full_name).join(', ')}.`
          : 'Урок прошёл, а задания после него пока нет. Выдайте его, пока урок свежий: ученику придёт уведомление.',
        link: group ? `/groups/${r.group_id}` : `/homework/new?student=${r.student_id}`,
      }).catch(() => null);
      sent++;
    }
    await query('UPDATE lessons SET hw_reminded_at = NOW() WHERE id = ANY($1::int[])', [list.map((x) => x.id)]);
  }
  if (sent) console.log(`📝 Напоминаний выдать ДЗ: ${sent}`);
  return sent;
}

let timer = null;
function start() {
  if (timer) return;
  const tick = () => withLock('hw-nudge', run).catch((err) => console.error('📝 Напоминание о ДЗ:', err.message));
  setTimeout(tick, 2 * 60 * 1000);
  timer = setInterval(tick, 10 * 60 * 1000);
}

module.exports = { run, start, ensure };
