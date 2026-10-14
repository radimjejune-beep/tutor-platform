// games/logic.js — общая логика упражнений (зеркало backend/src/services/games.js)

export const GAME_TYPES = {
  match: { label: 'Найди пару', hint: 'Соедините слово и перевод, термин и определение' },
  order: { label: 'Собери предложение', hint: 'Слова перемешаны — нужно поставить их по порядку' },
  gaps: { label: 'Вставь пропуск', hint: 'Текст с пропусками: вписать или выбрать слово' },
  groups: { label: 'Распредели по группам', hint: 'Разложить слова по категориям' },
  sheet: { label: 'Лист с заданиями', hint: 'Из фото учебника или тетради: поля для ответов, выбор, аудио, ответ голосом' },
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
    }
  });
  const auto = details.filter((d) => !d.manual);
  const correct = auto.filter((d) => d.ok).length;
  return { correct, total: auto.length, score: auto.length ? Math.round((correct / auto.length) * 100) : 0, details, manual: details.length - auto.length };
}

// Сколько всего ответов ждёт лист (для прогресса и подписи)
export function sheetSize(game) {
  return game.blocks.reduce((n, b) => n + (b.t === 'gaps' ? parseGaps(b.text).gaps.length : b.t === 'page' ? b.fields.length : ['choice', 'open', 'voice'].includes(b.t) ? 1 : 0), 0);
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
