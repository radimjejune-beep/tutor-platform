// services/games.js — упражнения: формат данных и проверка ответов
// Типы:
//   match  — найди пару:            { pairs: [{ a, b }] }
//   order  — собери предложение:    { sentences: ['I have never been to London.'] }
//   gaps   — вставь пропуск:        { text: 'She [has|'s] lived here [since] 2010.', mode: 'type' | 'bank', distractors: [] }
//   groups — распредели по группам: { groups: [{ name, items: [] }] }
//   sheet  — лист с заданиями (из фото учебника или тетради): { blocks: [...] }
//            text   — инструкция или текст:   { t: 'text', text, image?, audio?, video? (ссылка YouTube) }
//            gaps   — пропуски в тексте:       { t: 'gaps', text: 'She [goes|is going] home.', audio? }
//            choice — выбор ответа:            { t: 'choice', q, options: [], correct: 0, audio? }
//            open   — развёрнутый ответ:       { t: 'open', q }          (проверяет преподаватель)
//            voice  — ответ голосом:           { t: 'voice', q }         (проверяет преподаватель)
//            page   — фото с полями поверх:    { t: 'page', image, fields: [{ x, y, w, h, a: 'ответ|вариант' }] }
//            write  — письмо с чек-листом:       { t: 'write', q, min_words, max_words, min_sentences, checks: [{ label, words: 'always|usually', min }],
//                                                caps, stop, latin, starters: [], model }  чек-лист проверяется сам, текст смотрит преподаватель
//            rewrite — перепиши предложение:    { t: 'rewrite', q, src, a: 'вариант|вариант' }
//            fix    — найди и исправь ошибки:    { t: 'fix', q, text: 'She {go=goes} to school.' }
//            dictation — диктант на слух:        { t: 'dictation', text, audio? }  без файла читает голос браузера
//            image и audio — id файлов, прикреплённых к этому материалу
const { z } = require('zod');
const { normalize } = require('./quiz');

const word = z.string().trim().min(1).max(200);

const fileId = z.number().int().positive();
const pct = z.number().min(0).max(100);
const sheetBlock = z.discriminatedUnion('t', [
  z.object({ t: z.literal('text'), text: z.string().max(5000).default(''), image: fileId.nullish(), audio: fileId.nullish(), video: z.string().trim().max(500).regex(/^https?:\/\//, 'Ссылка на видео должна начинаться с https://').nullish().or(z.literal('')) }).strict(),
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
  z.object({
    t: z.literal('write'), q: z.string().trim().max(2000).default(''),
    min_words: z.number().int().min(0).max(2000).default(0),
    max_words: z.number().int().min(0).max(5000).default(0),
    min_sentences: z.number().int().min(0).max(200).default(0),
    checks: z.array(z.object({ label: z.string().trim().max(120).default(''), words: z.string().trim().min(1, 'В пункте чек-листа нет слов').max(1000), min: z.number().int().min(1).max(30).default(1) }).strict()).max(15).default([]),
    caps: z.boolean().default(false), stop: z.boolean().default(false), latin: z.boolean().default(false),
    starters: z.array(z.string().trim().min(1).max(160)).max(20).default([]),
    model: z.string().max(5000).default(''),
    audio: fileId.nullish(),
  }).strict(),
  z.object({
    t: z.literal('rewrite'), q: z.string().trim().max(1000).default(''), src: z.string().trim().max(1000).default(''),
    a: z.string().trim().min(1, 'Укажите правильный вариант').max(2000), audio: fileId.nullish(),
  }).strict(),
  z.object({
    t: z.literal('fix'), q: z.string().trim().max(1000).default(''),
    text: z.string().trim().min(1).max(5000).refine((t) => parseFix(t).some((x) => x.right), 'Отметьте ошибки так: {неверно=верно}'),
    audio: fileId.nullish(),
  }).strict(),
  z.object({ t: z.literal('dictation'), text: z.string().trim().min(1, 'Пустой диктант').max(2000), audio: fileId.nullish() }).strict(),
]);

// Конструктор: холст с деталями, которые преподаватель расставил сам (координаты в процентах)
const BOARD_KINDS = ['text', 'image', 'audio', 'input', 'select', 'check', 'chip', 'zone'];
const boardEl = z.object({
  id: z.string().trim().min(1).max(16), k: z.enum(BOARD_KINDS),
  x: pct, y: pct, w: z.number().min(1).max(100), h: z.number().min(1).max(100),
  text: z.string().max(2000).optional(), a: z.string().trim().max(300).optional(),
  options: z.array(z.string().trim().min(1).max(200)).max(8).optional(), correct: z.number().int().min(0).max(7).optional(),
  on: z.boolean().optional(), zone: z.string().trim().max(16).nullish(),
  image: fileId.nullish(), audio: fileId.nullish(), say: z.string().trim().max(500).optional(),
  size: z.number().min(8).max(96).optional(), color: z.enum(['ink', 'pen', 'blue', 'green', 'white']).optional(),
  bg: z.enum(['none', 'white', 'yellow', 'pink', 'blue', 'green', 'dark']).optional(), align: z.enum(['left', 'center', 'right']).optional(),
  bold: z.boolean().optional(),
}).strict().refine((e) => e.k !== 'select' || (e.options?.length >= 2 && (e.correct ?? 0) < e.options.length), 'В списке выбора нужно минимум 2 варианта');

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
  z.object({
    type: z.literal('board'),
    ratio: z.number().min(0.4).max(2.5).default(4 / 3),
    bg: fileId.nullish(), paper: z.enum(['white', 'paper', 'grid', 'lines', 'dark']).default('white'),
    elements: z.array(boardEl).max(150, 'Не больше 150 деталей на холсте').refine((els) => new Set(els.map((e) => e.id)).size === els.length, 'Повторяются детали'),
  }).strict(),
]);


/* ---------- письмо, исправление ошибок, диктант (зеркало frontend/src/games/logic.js) ---------- */
const LETTER = "A-Za-zА-Яа-яЁё0-9'’";
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const words = (text) => (String(text || '').match(new RegExp(`[${LETTER}]+(?:-[${LETTER}]+)*`, 'g')) || []);
const sentences = (text) => String(text || '').split(/[.!?…]+/).map((x) => x.trim()).filter((x) => words(x).length >= 2);
const variants = (w) => String(w || '').split(/[|,;\n]/).map((x) => x.trim()).filter(Boolean);
// Шаблон варианта: «watch*» любое окончание, «*ed» любое начало, фраза: слова подряд
function variantRe(v) {
  const body = v.split(/\s+/).map((part) => escRe(part).replace(/\\\*/g, `[${LETTER}]*`)).join('\\s+');
  return new RegExp(`(?<![${LETTER}])${body}(?![${LETTER}])`, 'gi');
}
// Чек-лист письма: [{ key, label, ok, info }]
function writeChecks(b, rawText) {
  const text = String(rawText || '').replace(/[’‘`]/g, "'");
  const out = [];
  const n = words(text).length;
  if (b.min_words) out.push({ key: 'min', label: `Не меньше ${b.min_words} слов`, ok: n >= b.min_words, info: `слов: ${n}` });
  if (b.max_words) out.push({ key: 'max', label: `Не больше ${b.max_words} слов`, ok: n > 0 && n <= b.max_words, info: `слов: ${n}` });
  if (b.min_sentences) { const k = sentences(text).length; out.push({ key: 'sent', label: `Не меньше ${b.min_sentences} предложений`, ok: k >= b.min_sentences, info: `предложений: ${k}` }); }
  (b.checks || []).forEach((c, i) => {
    const vs = variants(c.words);
    const need = c.min || 1;
    // Разные найденные слова: «always, often» = 2, «played, visited» по шаблону *ed = 2.
    // Один вариант без * считаем по количеству употреблений: because два раза = 2
    const hits = vs.flatMap((v) => text.match(variantRe(v)) || []).map((x) => x.toLowerCase().replace(/\s+/g, ' '));
    const found = [...new Set(hits)];
    const count = vs.length === 1 && !vs[0].includes('*') ? hits.length : found.length;
    const label = c.label || (vs.length === 1 ? `Использовать «${vs[0].replace(/\*/g, '…')}»${need > 1 ? ` ${need} раза` : ''}` : `Использовать ${need} из: ${vs.slice(0, 6).map((v) => v.replace(/\*/g, '…')).join(', ')}${vs.length > 6 ? '…' : ''}`);
    out.push({ key: `c${i}`, label, ok: count >= need, info: found.length ? `есть: ${found.slice(0, 8).join(', ')}${found.length > 8 ? '…' : ''}` : 'пока нет' });
  });
  const ss = String(rawText || '').split(/(?<=[.!?…])\s+/).map((x) => x.trim()).filter(Boolean);
  if (b.caps) {
    const bad = ss.filter((x) => /^[a-zа-яё]/.test(x)).length + (/(^|[^A-Za-z'])i($|[^A-Za-z'])/.test(text) ? 1 : 0);
    out.push({ key: 'caps', label: 'Предложения с большой буквы, I всегда заглавная', ok: n > 0 && !bad, info: bad ? 'есть строчные' : '' });
  }
  if (b.stop) {
    const t = String(rawText || '').trim();
    out.push({ key: 'stop', label: 'В конце предложений точка, ? или !', ok: Boolean(t) && /[.!?…]["')»]?$/.test(t), info: '' });
  }
  if (b.latin) {
    const ru = /[А-Яа-яЁё]/.test(text);
    out.push({ key: 'latin', label: 'Без русских букв', ok: n > 0 && !ru, info: ru ? 'есть русские буквы' : '' });
  }
  return out;
}
// Текст с ошибками: { неверно = верно | верно2 } → токены [{ s, word, right? }]
function parseFix(text) {
  const out = [];
  const re = /\{([^}=]+)=([^}]*)\}/g;
  let last = 0;
  let m;
  const plain = (chunk) => chunk.split(new RegExp(`([${LETTER}]+(?:-[${LETTER}]+)*)`)).forEach((x, i) => { if (x) out.push({ s: x, word: i % 2 === 1 }); });
  while ((m = re.exec(String(text || '')))) {
    plain(text.slice(last, m.index));
    out.push({ s: m[1].trim(), word: true, right: m[2].split('|').map((x) => x.trim()) });
    last = m.index + m[0].length;
  }
  plain(String(text || '').slice(last));
  return out;
}
const wordSeq = (s) => words(String(s || '').toLowerCase().replace(/[’‘`]/g, "'")).join(' ');

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
  } else if (game.type === 'board') {
    return gradeBoard(game, answers);
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
    } else if (b.t === 'write') {
      const checks = writeChecks(b, a);
      checks.forEach((c, k) => details.push({ block: i, k, ok: c.ok, prompt: c.label, given: c.info || null }));
      details.push({ block: i, ok: null, manual: true, prompt: b.q || 'Письмо', given: a ? String(a).slice(0, 8000) : null });
    } else if (b.t === 'rewrite') {
      const g = typeof a === 'string' ? a : '';
      const opts = alts(b.a);
      details.push({ block: i, ok: opts.some((o) => normalize(o) === normalize(g)), given: short(g), expected: opts[0], prompt: b.src || b.q || null });
    } else if (b.t === 'fix') {
      const fixes = a && typeof a === 'object' ? a : {};
      parseFix(b.text).forEach((tok, k) => {
        const g = fixes[k];
        if (tok.right) details.push({ block: i, k, ok: g !== undefined && g !== null && tok.right.some((r) => normalize(r) === normalize(g)), given: short(g) ?? tok.s, expected: tok.right[0] || '(убрать)', prompt: tok.s });
        else if (tok.word && g !== undefined && g !== null && normalize(g) !== normalize(tok.s)) details.push({ block: i, k, ok: false, given: short(g), expected: tok.s, prompt: `${tok.s}: здесь ошибки не было` });
      });
    } else if (b.t === 'dictation') {
      const g = typeof a === 'string' ? a : '';
      details.push({ block: i, ok: Boolean(g.trim()) && wordSeq(g) === wordSeq(b.text), given: short(g), expected: b.text.slice(0, 300), prompt: 'Диктант' });
    }
  });
  const auto = details.filter((d) => !d.manual);
  const correct = auto.filter((d) => d.ok).length;
  const total = auto.length;
  return { correct, total, score: total ? Math.round((correct / total) * 100) : 0, details, manual: details.length - auto.length };
}

// Конструктор: поля, списки, галочки и карточки проверяются сами; поле без ответа проверяет преподаватель
function gradeBoard(game, answers = {}) {
  const given = answers.e || {};
  const short = (v) => (v === undefined || v === null || v === '' ? null : String(v).slice(0, 300));
  const zones = game.elements.filter((e) => e.k === 'zone');
  const zoneName = (id) => { const k = zones.findIndex((z) => z.id === id); return k < 0 ? null : (zones[k].text || '').trim() || `место ${k + 1}`; };
  const details = [];
  game.elements.forEach((el) => {
    const g = given[el.id];
    if (el.k === 'input') {
      const opts = alts(el.a);
      if (!opts.length) details.push({ el: el.id, ok: null, manual: true, prompt: el.text || 'Поле для ответа', given: short(g) });
      else details.push({ el: el.id, ok: opts.some((o) => normalize(o) === normalize(g)), given: short(g), expected: opts.join(' / '), prompt: el.text || null });
    } else if (el.k === 'select') {
      const j = g === undefined || g === null || g === '' ? null : Number(g);
      const c = el.correct || 0;
      details.push({ el: el.id, ok: j === c, given: j === null ? null : el.options[j] ?? null, expected: el.options[c] });
    } else if (el.k === 'check') {
      details.push({ el: el.id, ok: Boolean(g) === Boolean(el.on), given: g ? 'отмечено' : 'не отмечено', expected: el.on ? 'отмечено' : 'не отмечено', prompt: el.text || null });
    } else if (el.k === 'chip') {
      const z = g && zoneName(g) ? g : null;
      if (el.zone && zoneName(el.zone)) details.push({ el: el.id, ok: z === el.zone, given: z ? zoneName(z) : null, expected: zoneName(el.zone), prompt: el.text || null });
      else if (z) details.push({ el: el.id, ok: false, given: zoneName(z), expected: 'лишняя карточка', prompt: el.text || null });
    }
  });
  const auto = details.filter((d) => !d.manual);
  const correct = auto.filter((d) => d.ok).length;
  return { correct, total: auto.length, score: auto.length ? Math.round((correct / auto.length) * 100) : 0, details, manual: details.length - auto.length };
}

module.exports = { gameSchema, sheetBlock, grade, parseGaps, writeChecks, parseFix };
