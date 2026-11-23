// Inline alternatives: [work|*works]. Exactly one explicitly correct option.
// Mirrored by backend/src/services/inline-choice.js for server-side validation.
function parseInlineChoices(raw) {
  const text = String(raw || ''), parts = [], choices = [], errors = [];
  const re = /\[([^\[\]\n]*)\]/g;
  let last = 0, match;
  while ((match = re.exec(text))) {
    parts.push(text.slice(last, match.index));
    const values = match[1].split('|').map(s => s.trim());
    const marked = values.flatMap((v, i) => v.startsWith('*') ? [i] : []);
    const options = values.map(v => v.replace(/^\*/, '').trim());
    const n = choices.length + 1;
    if (options.length < 2 || options.length > 6) errors.push(`Выбор ${n}: нужно от 2 до 6 вариантов через |.`);
    if (options.some(v => !v || v.length > 300)) errors.push(`Выбор ${n}: варианты должны содержать от 1 до 300 символов.`);
    if (new Set(options).size !== options.length) errors.push(`Выбор ${n}: варианты не должны повторяться.`);
    if (marked.length !== 1) errors.push(`Выбор ${n}: укажите ровно один правильный вариант.`);
    choices.push({ options, correct: marked.length === 1 ? marked[0] : -1, start: match.index, end: re.lastIndex, raw: match[0] });
    last = re.lastIndex;
  }
  parts.push(text.slice(last));
  if (!choices.length) errors.push('Добавьте выбор: She [work|*works] here.');
  if (choices.length > 80) errors.push('В одном блоке не больше 80 мест выбора.');
  if (parts.some(p => /[\[\]]/.test(p))) errors.push('Проверьте квадратные скобки: каждый выбор должен быть закрыт.');
  return { parts, choices, errors };
}

function markInlineCorrect(text, index, option) {
  const c = parseInlineChoices(text).choices[index];
  if (!c || !Number.isInteger(option) || option < 0 || option >= c.options.length) return text;
  return text.slice(0, c.start) + '[' + c.options.map((o, i) => `${i === option ? '*' : ''}${o}`).join('|') + ']' + text.slice(c.end);
}

function gradeInlineChoices(text, answers = []) {
  return parseInlineChoices(text).choices.map((c, k) => {
    const raw = answers?.[k];
    const v = raw === undefined || raw === null || raw === '' || typeof raw === 'boolean' ? null : Number(raw);
    const valid = Number.isInteger(v) && v >= 0 && v < c.options.length;
    return { k, ok: c.correct >= 0 && valid && v === c.correct, given: valid ? c.options[v] : null, expected: c.options[c.correct] || null, prompt: `Выбор ${k + 1}` };
  });
}

function inlineMistakeText(text, wrong) {
  const { parts, choices } = parseInlineChoices(text);
  return parts.map((p, i) => p + (choices[i] ? wrong.has(i) ? choices[i].raw : choices[i].options[choices[i].correct] : '')).join('');
}

module.exports = { parseInlineChoices, markInlineCorrect, gradeInlineChoices, inlineMistakeText };
