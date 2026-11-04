// bank/vocab-tasks.js — упражнения на слова юнитов, собираются автоматически из словаря (vocab-*.js).
// На каждую тему юнита: «Найди пару» (узнать слово) и «Напиши слово» (вспомнить по переводу).
// На юнит с несколькими темами: «Разложи по темам». Ключи строятся из учебника, юнита и номера темы,
// поэтому при правке слов задание обновляется, а не дублируется.
const { BOOKS } = require('./books');
const { topicsOf } = require('./vocab');

const PART = 10; // слов в одном упражнении

// Делим слова темы на части так, чтобы в одной части не было одинаковых слов или переводов
function chunks(words) {
  const parts = [];
  for (const w of words) {
    let p = parts.find((x) => x.length < PART && !x.some((y) => y.term === w.term || y.translation === w.translation));
    if (!p) { p = []; parts.push(p); }
    p.push(w);
  }
  // хвост из 1 слова приклеиваем к предыдущей части (если можно), упражнение из одного слова бессмысленно
  const last = parts[parts.length - 1];
  if (parts.length > 1 && last.length < 2) {
    const prev = parts[parts.length - 2];
    if (!prev.some((y) => y.term === last[0].term || y.translation === last[0].translation)) { prev.push(last[0]); parts.pop(); }
  }
  return parts.filter((p) => p.length >= 2);
}

// Ответ в квадратных скобках не должен содержать служебных символов разметки
const safe = (s) => s.replace(/[[\]|]/g, '');

function vocabTasks() {
  const out = [];
  for (const book of BOOKS) {
    for (const unit of book.units) {
      const topics = topicsOf(book.id, unit.code);
      topics.forEach(({ topic, words }, ti) => {
        const parts = chunks(words);
        parts.forEach((part, pi) => {
          const name = (topic || 'Слова юнита') + (parts.length > 1 ? `, часть ${pi + 1}` : '');
          const base = `voc-${book.id}-${unit.code}-${ti + 1}-${pi + 1}`;
          out.push({
            key: `${base}-m`, book: book.id, unit: unit.code, title: `${name}: найди пару`,
            game: { type: 'match', pairs: part.map((w) => ({ a: w.term, b: w.translation })) },
          });
          out.push({
            key: `${base}-w`, book: book.id, unit: unit.code, title: `${name}: напиши слово`,
            game: { type: 'gaps', mode: 'type', distractors: [], text: part.map((w) => `${w.translation}: [${safe(w.term)}]`).join('\n') },
          });
        });
      });
      // Разложи по темам: до 5 тем, по 5 слов, слова, которые встречаются в нескольких темах, пропускаем
      const named = topics.filter((t) => t.topic);
      if (named.length >= 2) {
        const count = new Map();
        for (const t of named) for (const w of t.words) count.set(w.term, (count.get(w.term) || 0) + 1);
        const groups = named
          .map((t) => ({ name: t.topic, items: t.words.filter((w) => count.get(w.term) === 1).slice(0, 5).map((w) => w.term) }))
          .filter((g) => g.items.length >= 2)
          .slice(0, 5);
        if (groups.length >= 2) {
          out.push({ key: `voc-${book.id}-${unit.code}-groups`, book: book.id, unit: unit.code, title: 'Разложи слова по темам', game: { type: 'groups', groups } });
        }
      }
    }
  }
  return out;
}

module.exports = { vocabTasks };
