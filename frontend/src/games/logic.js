// games/logic.js — общая логика упражнений (зеркало backend/src/services/games.js)

export const GAME_TYPES = {
  match: { label: 'Найди пару', hint: 'Соедините слово и перевод, термин и определение' },
  order: { label: 'Собери предложение', hint: 'Слова перемешаны, нужно поставить их по порядку' },
  gaps: { label: 'Вставь пропуск', hint: 'Текст с пропусками: вписать или выбрать слово' },
  groups: { label: 'Распредели по группам', hint: 'Разложить слова по категориям' },
  sheet: { label: 'Лист с заданиями', hint: 'Из фото учебника или тетради: поля для ответов, выбор, аудио, ответ голосом' },
};

// Готовые листы для конкретной отработки: в конструкторе это тоже «Лист с заданиями»
export const SHEET_PRESETS = {
  write: { label: 'Письмо с чек-листом', hint: 'Эссе, письмо, рассказ: сайт сам отслеживает слова, объём и нужные конструкции' },
  fix: { label: 'Найди и исправь ошибки', hint: 'Текст с ошибками: ученик нажимает на неверное слово и исправляет' },
  rewrite: { label: 'Перепиши предложение', hint: 'Трансформации: сделай отрицание, вопрос, поставь в другое время' },
  dictation: { label: 'Диктант на слух', hint: 'Предложение звучит британским голосом или из вашего аудио, ученик записывает' },
};

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Перемешать так, чтобы порядок точно отличался от исходного (если это возможно)
export function shuffleChanged(arr, same = (x, y) => x === y) {
  if (arr.length < 2) return [...arr];
  for (let t = 0; t < 10; t++) {
    const s = shuffle(arr);
    if (s.some((x, i) => !same(x, arr[i]))) return s;
  }
  return [...arr].reverse();
}

export const normalize = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?;,]+$/, '')
    .trim();

export function parseGaps(text) {
  const parts = [];
  const gaps = [];
  let last = 0;
  const re = /\[([^\]]+)\]/g;
  let m;
  while ((m = re.exec(text || ''))) {
    parts.push(text.slice(last, m.index));
    gaps.push(m[1].split('|').map((s) => s.trim()).filter(Boolean));
    last = m.index + m[0].length;
  }
  parts.push((text || '').slice(last));
  return { parts, gaps };
}

/* ---------- письмо, исправление ошибок, диктант (зеркало backend/src/services/games.js) ---------- */
const LETTER = "A-Za-zА-Яа-яЁё0-9'’";
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const words = (text) => (String(text || '').match(new RegExp(`[${LETTER}]+(?:-[${LETTER}]+)*`, 'g')) || []);
const sentences = (text) => String(text || '').split(/[.!?…]+/).map((x) => x.trim()).filter((x) => words(x).length >= 2);
export const variants = (w) => String(w || '').split(/[|,;\n]/).map((x) => x.trim()).filter(Boolean);
// Шаблон варианта: «watch*» любое окончание, «*ed» любое начало, фраза: слова подряд
function variantRe(v) {
  const body = v.split(/\s+/).map((part) => escRe(part).replace(/\\\*/g, `[${LETTER}]*`)).join('\\s+');
  return new RegExp(`(?<![${LETTER}])${body}(?![${LETTER}])`, 'gi');
}
// Чек-лист письма: [{ key, label, ok, info }]
export function writeChecks(b, rawText) {
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
export function parseFix(text) {
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


export const tokenize = (sentence) => sentence.trim().split(/\s+/).filter(Boolean);

// Та же проверка, что на сервере — чтобы сразу показать результат
export function grade(game, answers = {}) {
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

// Лист: то же, что на сервере (развёрнутые и устные ответы проверяет преподаватель)
export const alts = (a) => String(a || '').split('|').map((x) => x.trim()).filter(Boolean);
export function gradeSheet(game, answers = {}) {
  const given = answers.b || {};
  const details = [];
  game.blocks.forEach((b, i) => {
    const a = given[i];
    if (b.t === 'gaps') {
      parseGaps(b.text).gaps.forEach((opts, k) => {
        const g = Array.isArray(a) ? a[k] : '';
        details.push({ block: i, k, ok: opts.some((o) => normalize(o) === normalize(g)), given: g || null, expected: opts.join(' / ') });
      });
    } else if (b.t === 'page') {
      b.fields.forEach((f, k) => {
        const opts = alts(f.a);
        const g = Array.isArray(a) ? a[k] : '';
        if (!opts.length) return details.push({ block: i, k, ok: null, manual: true });
        details.push({ block: i, k, ok: opts.some((o) => normalize(o) === normalize(g)), given: g || null, expected: opts.join(' / ') });
      });
    } else if (b.t === 'choice') {
      const j = a === undefined || a === null || a === '' ? null : Number(a);
      details.push({ block: i, ok: j === b.correct, given: j === null ? null : b.options[j], expected: b.options[b.correct] });
    } else if (b.t === 'open' || b.t === 'voice') {
      details.push({ block: i, ok: null, manual: true });
    } else if (b.t === 'write') {
      const checks = writeChecks(b, a);
      checks.forEach((c, k) => details.push({ block: i, k, ok: c.ok, prompt: c.label, given: c.info || null }));
      details.push({ block: i, ok: null, manual: true, prompt: b.q || 'Письмо', given: a ? String(a).slice(0, 8000) : null });
    } else if (b.t === 'rewrite') {
      const g = typeof a === 'string' ? a : '';
      const opts = alts(b.a);
      details.push({ block: i, ok: opts.some((o) => normalize(o) === normalize(g)), given: (g || null), expected: opts[0], prompt: b.src || b.q || null });
    } else if (b.t === 'fix') {
      const fixes = a && typeof a === 'object' ? a : {};
      parseFix(b.text).forEach((tok, k) => {
        const g = fixes[k];
        if (tok.right) details.push({ block: i, k, ok: g !== undefined && g !== null && tok.right.some((r) => normalize(r) === normalize(g)), given: (g || null) ?? tok.s, expected: tok.right[0] || '(убрать)', prompt: tok.s });
        else if (tok.word && g !== undefined && g !== null && normalize(g) !== normalize(tok.s)) details.push({ block: i, k, ok: false, given: (g || null), expected: tok.s, prompt: `${tok.s}: здесь ошибки не было` });
      });
    } else if (b.t === 'dictation') {
      const g = typeof a === 'string' ? a : '';
      details.push({ block: i, ok: Boolean(g.trim()) && wordSeq(g) === wordSeq(b.text), given: (g || null), expected: b.text.slice(0, 300), prompt: 'Диктант' });
    }
  });

  const auto = details.filter((d) => !d.manual);
  const correct = auto.filter((d) => d.ok).length;
  return { correct, total: auto.length, score: auto.length ? Math.round((correct / auto.length) * 100) : 0, details, manual: details.length - auto.length };
}

// Сколько всего ответов ждёт лист (для прогресса и подписи)
export function sheetSize(game) {
  return game.blocks.reduce((n, b) => n + (b.t === 'gaps' ? parseGaps(b.text).gaps.length : b.t === 'page' ? b.fields.length : b.t === 'fix' ? parseFix(b.text).filter((x) => x.right).length : ['choice', 'open', 'voice', 'write', 'rewrite', 'dictation'].includes(b.t) ? 1 : 0), 0);
}

// Сколько заданий в упражнении (для подписи в списке)
export function gameSize(game) {
  if (!game) return 0;
  if (game.type === 'match') return game.pairs.length;
  if (game.type === 'order') return game.sentences.length;
  if (game.type === 'gaps') return parseGaps(game.text).gaps.length;
  if (game.type === 'groups') return game.groups.reduce((n, g) => n + g.items.length, 0);
  if (game.type === 'sheet') return sheetSize(game);
  return 0;
}
