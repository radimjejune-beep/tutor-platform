// services/deck.js — интерактивный урок из конструктора (kind = 'deck').
// Содержимое хранится в столбце html как JSON, чтобы работать везде, где уже работают HTML-уроки
// (библиотека, задания, комната урока, каталог). Ученикам заметки преподавателя не отдаются.
const { z } = require('zod');

const str = (n) => z.string().max(n);
const slide = z.object({
  id: str(40),
  type: z.enum(['title', 'text', 'image', 'words', 'questions', 'rule', 'exercise', 'video', 'finish']),
  title: str(300).optional(),
  subtitle: str(500).optional(),
  text: str(8000).optional(),
  image: z.number().int().positive().nullable().optional(),
  caption: str(500).optional(),
  words: z.array(z.object({ term: str(200), translation: str(300).optional(), example: str(500).optional() })).max(40).optional(),
  items: z.array(str(500)).max(30).optional(),
  examples: z.array(str(500)).max(20).optional(),
  game: z.any().optional(),
  url: str(1000).optional(),
  minutes: z.number().min(0).max(120).optional(),
  notes: str(5000).optional(),
  timer: z.number().int().min(0).max(3600).optional(),
}).strict();
const deckSchema = z.object({
  v: z.literal(1),
  theme: z.enum(['paper', 'ink', 'sky', 'mint']).optional(),
  level: str(20).optional(),
  slides: z.array(slide).min(1, 'Добавьте хотя бы один слайд').max(80, 'Не больше 80 слайдов'),
}).strict();

function parse(html) {
  try { return JSON.parse(html); } catch { return null; }
}
// Проверка содержимого: ошибка с понятным текстом или null
function check(html) {
  const deck = parse(html);
  if (!deck) return 'Урок повреждён: не удалось прочитать слайды';
  const r = deckSchema.safeParse(deck);
  if (!r.success) return `Урок: ${r.error.issues[0]?.message || 'неверный формат'}`;
  return null;
}
// Для ученика: без заметок преподавателя
function forStudent(row) {
  if (!row || row.kind !== 'deck' || !row.html) return row;
  const deck = parse(row.html);
  if (!deck) return row;
  deck.slides = (deck.slides || []).map(({ notes, ...s }) => s); // eslint-disable-line no-unused-vars
  return { ...row, html: JSON.stringify(deck) };
}

module.exports = { check, forStudent, deckSchema };
