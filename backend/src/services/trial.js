// services/trial.js — сообщения преподавателю в пробный период (в кабинет и в Telegram):
//   3-й день   подсказка со следующим шагом, если первые шаги не пройдены
//   10-й день  что уже сделано на платформе
//   за 2 дня   пробный период скоро закончится, что будет дальше
//   окончание  период закончился, действует «Старт», данные целы
// Каждое сообщение уходит один раз (таблица trial_messages). Раз в час, одна копия сервера (jobs.js).
const { query } = require('../db');
const notify = require('./notify');
const { withLock } = require('./jobs');

let ready = null;
function ensure() {
  if (!ready) {
    ready = query(`
      CREATE TABLE IF NOT EXISTS trial_messages (
        user_id  INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind     VARCHAR(20) NOT NULL,
        sent_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, kind)
      );
    `).catch((err) => { ready = null; throw err; });
  }
  return ready;
}

async function once(userId, kind, msg) {
  const { rowCount } = await query('INSERT INTO trial_messages (user_id, kind) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, kind]);
  if (!rowCount) return false;
  await notify.toTutor(userId, { kind: 'trial', ...msg });
  return true;
}

async function stats(tid) {
  await require('../routes/demo').ensure();
  const { rows } = await query(
    `SELECT (SELECT COUNT(*) FROM students WHERE tutor_id = $1 AND NOT is_demo)::int AS students,
            (SELECT COUNT(*) FROM lessons l JOIN students s ON s.id = l.student_id WHERE s.tutor_id = $1 AND l.status = 'done')::int AS lessons,
            (SELECT COUNT(*) FROM homework h JOIN students s ON s.id = h.student_id WHERE s.tutor_id = $1 AND h.status IN ('submitted', 'checked'))::int AS homework`,
    [tid]
  );
  return rows[0];
}

async function run() {
  await ensure();
  const plans = require('./plans');
  await plans.ensure();
  const { rows } = await query(
    `SELECT id, created_at, plan, plan_until FROM users
      WHERE role = 'tutor' AND is_active AND NOT is_admin AND plan = 'trial' AND plan_until IS NOT NULL
        AND plan_until > NOW() - INTERVAL '3 days'`
  );
  const paid = plans.PLANS.tutor;
  let sent = 0;
  for (const u of rows) {
    const age = (Date.now() - new Date(u.created_at)) / 864e5;
    const left = (new Date(u.plan_until) - Date.now()) / 864e5;
    if (left <= 0) {
      if (await once(u.id, 'ended', {
        title: 'Пробный период закончился',
        body: `Сейчас действует бесплатный «Старт»: до 3 учеников, ученики и материалы сохранены. Чтобы снова открыть всё, выберите тариф «${paid.name}» за ${paid.price} ₽ в месяц.`,
        link: '/settings/plan',
      })) sent++;
      continue;
    }
    if (left <= 2) {
      if (await once(u.id, 'ending', {
        title: `Пробный период закончится через ${left <= 1 ? 'день' : '2 дня'}`,
        body: `Потом останется бесплатный «Старт» (до 3 учеников, без бота и групп). Тариф «${paid.name}» за ${paid.price} ₽ в месяц сохранит всё как сейчас.`,
        link: '/settings/plan',
      })) sent++;
      continue;
    }
    if (age >= 10) {
      const s = await stats(u.id);
      if (await once(u.id, 'day10', {
        title: 'Десять дней на платформе',
        body: s.students
          ? `Учеников: ${s.students}, проведённых занятий: ${s.lessons}, сданных работ: ${s.homework}. Ещё ${Math.ceil(left)} дн. всё открыто бесплатно.`
          : 'Вы ещё не добавили учеников. Добавьте одного, и платформа начнёт напоминать ему об уроках и проверять домашку.',
        link: s.students ? '/' : '/students',
      })) sent++;
      continue;
    }
    if (age >= 3) {
      const s = await stats(u.id);
      const next = !s.students
        ? { title: 'Добавьте первого ученика', body: 'Платформа выдаст ему и родителю логин и пароль. Почта и телефон не нужны.', link: '/students' }
        : { title: 'Совет: выдайте домашку из банка', body: 'Готовые задания по учебникам проверяются сами, вы увидите только ошибки.', link: '/homework' };
      if (await once(u.id, 'day3', next)) sent++;
    }
  }
  if (sent) console.log(`🎁 Сообщения пробного периода: ${sent}`);
  return sent;
}

let timer = null;
function start() {
  if (timer) return;
  const tick = () => withLock('trial', run).catch((err) => console.error('🎁 Пробный период:', err.message));
  setTimeout(tick, 90 * 1000);
  timer = setInterval(tick, 60 * 60 * 1000);
}

module.exports = { run, start, ensure };
