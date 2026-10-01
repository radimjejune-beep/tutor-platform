// format.js — даты, деньги, склонения
const TZ = undefined; // часовой пояс браузера

export const rub = (n) =>
  `${new Intl.NumberFormat('ru-RU').format(Math.round(Number(n) || 0))} ₽`;

// 1 занятие, 2 занятия, 5 занятий
export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}
export const lessonsWord = (n) => `${n} ${plural(n, 'занятие', 'занятия', 'занятий')}`;

const fmt = (opts) => new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, ...opts });

export const time = (d) => fmt({ hour: '2-digit', minute: '2-digit' }).format(new Date(d));
export const dayMonth = (d) => fmt({ day: 'numeric', month: 'long' }).format(new Date(d));
export const weekday = (d) => fmt({ weekday: 'long' }).format(new Date(d));
export const shortDate = (d) => fmt({ day: 'numeric', month: 'short' }).format(new Date(d)).replace('.', '');
export const fullDate = (d) => fmt({ day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(d));
export const monthName = (yyyyMm) => {
  const [y, m] = yyyyMm.split('-').map(Number);
  const s = fmt({ month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 15));
  return s.charAt(0).toUpperCase() + s.slice(1).replace(' г.', '');
};
export const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// «Сегодня», «Завтра» или «Вторник»
export function relativeDay(d) {
  const date = new Date(d);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const diff = Math.round((new Date(date).setHours(0, 0, 0, 0) - start) / 864e5);
  if (diff === 0) return 'Сегодня';
  if (diff === 1) return 'Завтра';
  if (diff === -1) return 'Вчера';
  return cap(weekday(date));
}

export const isToday = (d) => new Date(d).toDateString() === new Date().toDateString();
export const dayKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
export const todayISO = () => dayKey(new Date());
export const currentMonth = () => todayISO().slice(0, 7);
export const prevMonth = () => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return dayKey(d).slice(0, 7);
};

// Значение для <input type="datetime-local"> и обратно
export const toLocalInput = (d) => {
  const x = new Date(d);
  const pad = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
};
export const fromLocalInput = (v) => new Date(v).toISOString();

export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

export const LESSON_STATUS = {
  scheduled: { label: 'Запланировано', tone: '' },
  done: { label: 'Проведено', tone: 'green' },
  cancelled: { label: 'Отменено', tone: '' },
  cancelled_late: { label: 'Поздняя отмена', tone: 'brass' },
  missed: { label: 'Пропуск', tone: 'red' },
};

export const HW_STATUS = {
  assigned: { label: 'Нужно сделать', tone: 'brass' },
  submitted: { label: 'На проверке', tone: '' },
  checked: { label: 'Проверено', tone: 'green' },
};

export const SKILLS = {
  grammar: 'Грамматика',
  vocabulary: 'Лексика',
  speaking: 'Говорение',
  listening: 'Аудирование',
  reading: 'Чтение',
  writing: 'Письмо',
};

export const CATEGORY = { adult: 'Взрослый', teen: 'Подросток', child: 'Ребёнок' };

export const METHOD = { transfer: 'Перевод', cash: 'Наличные', card: 'Карта', other: 'Другое' };
