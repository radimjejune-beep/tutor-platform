// services/games.js — упражнения: формат данных и проверка ответов
// Типы:
//   match  — найди пару:            { pairs: [{ a, b }] }
//   order  — собери предложение:    { sentences: ['I have never been to London.'] }
//   gaps   — вставь пропуск:        { text: 'She [has|'s] lived here [since] 2010.', mode: 'type' | 'bank', distractors: [] }
//   groups — распредели по группам: { groups: [{ name, items: [] }] }
const { z } = require('zod');
const { normalize } = require('./quiz');

const word = z.string().trim().min(1).max(200);

const gameSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('match'),
    pairs: z.array(z.object({ a: word, b: word }).strict()).min(2, 'Нужно минимум 2 пары').max(24),
  }).strict(),
  z.object({
    type: z.literal('order'),
    sentences: z
      .array(z.string().trim().min(1).max(400))
      .min(1, 'Добавьте хотя бы одно предложение')
      .max(20)
      .refine((ss) => ss.every((s) => s.split(/\s+/).length >= 2), 'В каждом предложении нужно минимум 2 слова'),
  }).strict(),
  z.object({
    type: z.literal('gaps'),
    text: z.string().trim().min(1).max(5000).refine((t) => parseGaps(t).gaps.length >= 1, 'Отметьте пропуски квадратными скобками: [ответ]'),
    mode: z.enum(['type', 'bank']).default('type'),
    distractors: z.array(word).max(20).default([]),
  }).strict(),
  z.object({
    type: z.literal('groups'),
    groups: z
      .array(z.object({ name: word, items: z.array(word).max(20) }).strict())
      .min(2, 'Нужно минимум 2 группы')
      .max(5)
      .refine((gs) => gs.reduce((n, g) => n + g.items.length, 0) >= 2, 'Добавьте слова в группы'),
  }).strict(),
]);

// Текст с пропусками → части текста и пропуски (варианты ответа через «|»)
function parseGaps(text) {
  const parts = [];
  const gaps = [];
  let last = 0;
  const re = /\[([^\]]+)\]/g;
  let m;
  while ((m = re.exec(text))) {
    parts.push(text.slice(last, m.index));
    gaps.push(m[1].split('|').map((s) => s.trim()).filter(Boolean));
    last = m.index + m[0].length;
  }
  parts.push(text.slice(last));
  return { parts, gaps };
}

// Проверка ответов. Возвращает { correct, total, score, details: [{ ok, given, expected }] }
function grade(game, answers = {}) {
  const details = [];
  if (game.type === 'match') {
    const chosen = answers.pairs || {};
    game.pairs.forEach((p, i) => {
      const j = chosen[i] === undefined || chosen[i] === null ? null : Number(chosen[i]);
      details.push({ ok: j === i, given: j === null ? null : game.pairs[j]?.b ?? null, expected: p.b, prompt: p.a });
    });
  } else if (game.type === 'order') {
    const given = answers.sentences || [];
    game.sentences.forEach((s, i) => {
      const g = Array.isArray(given[i]) ? given[i].join(' ') : '';
      details.push({ ok: normalize(g) === normalize(s), given: g || null, expected: s });
    });
  } else if (game.type === 'gaps') {
    const { gaps } = parseGaps(game.text);
    const given = answers.gaps || [];
    gaps.forEach((alts, i) => {
      const g = given[i] ?? '';
      details.push({ ok: alts.some((a) => normalize(a) === normalize(g)), given: g || null, expected: alts.join(' / ') });
    });
  } else if (game.type === 'groups') {
    const chosen = answers.items || {};
    game.groups.forEach((grp, gi) => {
      grp.items.forEach((item, k) => {
        const c = chosen[`${gi}-${k}`];
        const cg = c === undefined || c === null ? null : Number(c);
        details.push({ ok: cg === gi, given: cg === null ? null : game.groups[cg]?.name ?? null, expected: grp.name, prompt: item });
      });
    });
  }
  const total = details.length;
  const correct = details.filter((d) => d.ok).length;
  return { correct, total, score: total ? Math.round((correct / total) * 100) : 0, details };
}

module.exports = { gameSchema, grade, parseGaps };
