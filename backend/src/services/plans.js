// services/plans.js — тарифы платформы для преподавателей: что включено и сколько стоит.
// Цены и лимиты меняются здесь, в одном месте. null в лимите — без ограничений.
// Два тарифа: бесплатный «Старт» с лимитами и «Репетитор» за 499 ₽, где открыто всё.
// Новый преподаватель получает пробный период (все возможности «Репетитора») на TRIAL_DAYS дней.
// Сисадмин работает без ограничений. Тариф выдаёт сисадмин (раздел «Учителя»), позже его будет продлевать оплата.
const { query } = require('../db');

const TRIAL_DAYS = Number(process.env['TRIAL_DAYS'] || 14);

const PLANS = {
  start: {
    id: 'start', name: 'Старт', price: 0, year: 0,
    tagline: 'Попробовать платформу с первыми учениками',
    limits: { students: 3, books_mb: 100, bank_takes: 15 },
    features: { telegram: false, groups: false, finance: false, autocharge: false, booking: true, bank: true },
  },
  tutor: {
    id: 'tutor', name: 'Репетитор', price: 499, year: 4990,
    tagline: 'Всё открыто: без лимитов на учеников, группы и задания',
    limits: { students: null, books_mb: 5120, bank_takes: null },
    features: { telegram: true, groups: true, finance: true, autocharge: true, booking: true, bank: true },
  },
};
// Старый тариф «Про» больше не продаётся: у кого он выдан, действует «Репетитор» (в нём всё то же самое)
const LEGACY = { pro: 'tutor' };

// Что показать в таблице сравнения (порядок важен)
const FEATURE_LIST = [
  { key: 'students', label: 'Учеников', limit: true },
  { key: 'cabinets', label: 'Кабинеты учеников и родителей, расписание, домашние задания, словарь', all: true },
  { key: 'bank', label: 'Банк заданий: брать в библиотеку', limit: 'bank_takes', unit: 'в месяц' },
  { key: 'books_mb', label: 'Учебники в библиотеке', limit: true, unit: 'МБ' },
  { key: 'booking', label: 'Страница записи и заявки' },
  { key: 'telegram', label: 'Telegram-бот: напоминания ученикам за час до урока и о домашке, уведомления вам' },
  { key: 'finance', label: 'Доход и советник по цене урока' },
  { key: 'autocharge', label: 'Автосписание уроков после занятия' },
  { key: 'groups', label: 'Групповые занятия' },
];

let ready = null;
function ensure() {
  if (!ready) {
    ready = (async () => {
      await query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS plan VARCHAR(20);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_until TIMESTAMPTZ;
      `);
      // Один раз при появлении тарифов: всем действующим преподавателям пробный период от сегодня
      const { rows } = await query("SELECT 1 FROM settings WHERE key = 'plans_started'");
      if (!rows[0]) {
        await query(`UPDATE users SET plan = 'trial', plan_until = NOW() + make_interval(days => $1) WHERE role = 'tutor' AND plan IS NULL`, [TRIAL_DAYS]);
        await query(`INSERT INTO settings (key, value) VALUES ('plans_started', $1) ON CONFLICT (key) DO NOTHING`, [JSON.stringify({ at: new Date().toISOString() })]);
      }
    })().catch((err) => { ready = null; throw err; });
  }
  return ready;
}

// Тариф, который действует сейчас: { id, name, trial, until, admin, limits, features }
function effective(row) {
  if (!row) return { ...PLANS.start, trial: false, until: null, admin: false };
  if (row.is_admin) return { ...PLANS.tutor, name: 'Сисадмин', limits: { students: null, books_mb: 10240, bank_takes: null }, trial: false, until: null, admin: true };
  const alive = !row.plan_until || new Date(row.plan_until) > new Date();
  if (row.plan === 'trial' && alive) return { ...PLANS.tutor, name: 'Пробный период', trial: true, until: row.plan_until, admin: false };
  const id = LEGACY[row.plan] || row.plan;
  if (PLANS[id] && alive) return { ...PLANS[id], trial: false, until: row.plan_until, admin: false };
  return { ...PLANS.start, trial: false, until: null, expired: Boolean(row.plan && row.plan !== 'start'), admin: false };
}

// Кэш на минуту: тариф нужен часто (напоминания, лимиты)
const cache = new Map();
async function planOf(tutorId) {
  if (!tutorId) return effective(null);
  const hit = cache.get(tutorId);
  if (hit && hit.at > Date.now() - 60 * 1000) return hit.plan;
  await ensure();
  const { rows } = await query('SELECT id, is_admin, plan, plan_until FROM users WHERE id = $1', [tutorId]);
  const plan = effective(rows[0]);
  cache.set(tutorId, { at: Date.now(), plan });
  return plan;
}
const forget = (tutorId) => cache.delete(tutorId);

async function allows(tutorId, feature) {
  return Boolean((await planOf(tutorId)).features[feature]);
}

// Ошибка «нужен тариф выше»: фронтенд покажет кнопку «Тарифы»
function upgradeError(res, text) {
  return res.status(402).json({ error: `${text} Посмотреть тарифы: Настройки → Тариф.`, upgrade: true });
}

// Можно ли добавить ещё одного активного ученика. Вернёт текст ошибки или null
async function studentLimit(tutorId) {
  const plan = await planOf(tutorId);
  const max = plan.limits.students;
  if (max == null) return null;
  await require('../routes/demo').ensure();
  const { rows } = await query("SELECT COUNT(*)::int AS n FROM students WHERE tutor_id = $1 AND status = 'active' AND NOT is_demo", [tutorId]);
  return rows[0].n >= max ? `На тарифе «${plan.name}» до ${max} активных учеников. Переведите кого-то в архив или выберите тариф больше.` : null;
}

// Для новой учётки преподавателя: пробный период
const trialValues = () => ({ plan: 'trial', days: TRIAL_DAYS });

module.exports = { PLANS, FEATURE_LIST, TRIAL_DAYS, ensure, effective, planOf, forget, allows, upgradeError, trialValues, studentLimit };
