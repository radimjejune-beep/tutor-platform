// bank/vocab.js — слова по юнитам учебников, сгруппированные по темам.
// Сами списки лежат в vocab-*.js: только слова и наш перевод, без текстов и упражнений учебника.
const SOURCES = {
  'solutions-elem-3': require('./vocab-solutions-elem'),
  'speakout-a1-3': require('./vocab-speakout-a1'),
  'atanasyan-geom-7-9': require('./vocab-geometry'),
};

function parse(text) {
  const out = [];
  let topic = '';
  for (const raw of text.split('\n')) {
    const l = raw.trim();
    if (!l) continue;
    if (l.startsWith('#')) { topic = l.slice(1).trim(); continue; }
    const i = l.indexOf(' - ');
    if (i < 0) continue;
    out.push({ term: l.slice(0, i).trim(), translation: l.slice(i + 3).trim(), topic });
  }
  return out;
}

const cache = new Map();
function vocabOf(book, unit) {
  const key = `${book}/${unit}`;
  if (!cache.has(key)) {
    const text = SOURCES[book] && SOURCES[book][unit];
    cache.set(key, text ? parse(text) : []);
  }
  return cache.get(key);
}

// Темы юнита по порядку: [{ topic, words }]
function topicsOf(book, unit) {
  const map = new Map();
  for (const w of vocabOf(book, unit)) {
    if (!map.has(w.topic)) map.set(w.topic, []);
    map.get(w.topic).push(w);
  }
  return [...map].map(([topic, words]) => ({ topic, words }));
}

module.exports = { vocabOf, topicsOf };
