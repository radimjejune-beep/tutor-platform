// services/games.js — упражнения: формат данных и проверка ответов
// Типы:
//   match  — найди пару:            { pairs: [{ a, b }] }
//   order  — собери предложение:    { sentences: ['I have never been to London.'] }
//   gaps   — вставь пропуск:        { text: 'She [has|'s] lived here [since] 2010.', mode: 'type' | 'bank', distractors: [] }
//   groups — распредели по группам: { groups: [{ name, items: [] }] }
//   sheet  — лист с заданиями (из фото учебника или тетради): { blocks: [...] }
//            text   — инструкция или текст:   { t: 'text', text, image?, audio? }
//            gaps   — пропуски в тексте:       { t: 'gaps', text: 'She [goes|is going] home.', audio? }
//            choice — выбор ответа:            { t: 'choice', q, options: [], correct: 0, audio? }
//            open   — развёрнутый ответ:       { t: 'open', q }          (проверяет преподаватель)
//            voice  — ответ голосом:           { t: 'voice', q }         (проверяет преподаватель)
//            page   — фото с полями поверх:    { t: 'page', image, fields: [{ x, y, w, h, a: 'ответ|вариант' }] }
//            image и audio — id файлов, прикреплённых к этому материалу
const { z } = require('zod');
const { normalize } = require('./quiz');

const word = z.string().trim().min(1).max(200);

const fileId = z.number().int().positive();
const pct = z.number().min(0).max(100);
const sheetBlock = z.discriminatedUnion('t', [
  z.object({ t: z.literal('text'), text: z.string().max(5000).default(''), image: fileId.nullish(), audio: fileId.nullish() }).strict(),
  z.object({ t: z.literal('gaps'), text: z.string().trim().min(1, 'Пустой блок с пропусками').max(5000), audio: fileId.nullish() }).strict(),
  z.object({
    t: z.literal('choice'), q: z.string().trim().max(1000).default(''),
    options: z.array(z.string().trim().min(1).max(300)).min(2, 'В вопросе с выбором нужно минимум 2 варианта').max(8),
    correct: z.number().int().min(0).max(7), audio: fileId.nullish(),
  }).strict(),
  z.object({ t: z.literal('open'), q: z.string().trim().max(2000).default(''), audio: fileId.nullish() }).strict(),
  z.object({ t: z.literal('voice'), q: z.string().trim().max(2000).default(''), audio: fileId.nullish() }).strict(),
  z.object({
    t: z.literal('page'), image: fileId,
    fields: z.array(z.object({ x: pct, y: pct, w: pct, h: pct, a: z.string().trim().max(300).default('') }).strict()).max(80),
  }).strict(),
]);

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
  z.object({
    type: z.literal('sheet'),
    blocks: z.array(sheetBlock).min(1, 'Добавьте хотя бы одно задание').max(80),
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
  } else if (game.type === 'sheet') {
    return gradeSheet(game, answers);
  }
  const total = details.length;
  const correct = details.filter((d) => d.ok).length;
  return { correct, total, score: total ? Math.round((correct / total) * 100) : 0, details };
}

// Лист: пропуски, выбор и поля на фото проверяются сами; развёрнутые и устные ответы
// сохраняются для преподавателя (ok: null) и в оценку не входят
const alts = (a) => String(a || '').split('|').map((x) => x.trim()).filter(Boolean);
function gradeSheet(game, answers = {}) {
  const given = answers.b || {};
  const details = [];
  const short = (v) => (v === undefined || v === null || v === '' ? null : String(v).slice(0, 300));
  game.blocks.forEach((b, i) => {
    const a = given[i];
    if (b.t === 'gaps') {
      parseGaps(b.text).gaps.forEach((opts, k) => {
        const g = Array.isArray(a) ? a[k] : '';
        details.push({ block: i, k, ok: opts.some((o) => normalize(o) === normalize(g)), given: short(g), expected: opts.join(' / ') });
      });
    } else if (b.t === 'page') {
      b.fields.forEach((f, k) => {
        const opts = alts(f.a);
        const g = Array.isArray(a) ? a[k] : '';
        // Поле без ответа проверяет преподаватель
        if (!opts.length) return details.push({ block: i, field: k, k, ok: null, manual: true, prompt: `Поле ${k + 1}`, given: short(g) });
        details.push({ block: i, field: k, k, ok: opts.some((o) => normalize(o) === normalize(g)), given: short(g), expected: opts.join(' / ') });
      });
    } else if (b.t === 'choice') {
      const j = a === undefined || a === null || a === '' ? null : Number(a);
      details.push({ block: i, ok: j === b.correct, given: j === null ? null : b.options[j] ?? null, expected: b.options[b.correct], prompt: b.q || null });
    } else if (b.t === 'open') {
      details.push({ block: i, ok: null, manual: true, prompt: b.q || 'Развёрнутый ответ', given: a ? String(a).slice(0, 5000) : null });
    } else if (b.t === 'voice') {
      details.push({ block: i, ok: null, manual: true, prompt: b.q || 'Ответ голосом', file_id: Number(a) || null });
    }
  });
  const auto = details.filter((d) => !d.manual);
  const correct = auto.filter((d) => d.ok).length;
  const total = auto.length;
  return { correct, total, score: total ? Math.round((correct / total) * 100) : 0, details, manual: details.length - auto.length };
}

module.exports = { gameSchema, sheetBlock, grade, parseGaps };
