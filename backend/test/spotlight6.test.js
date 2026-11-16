const test = require('node:test');
const assert = require('node:assert/strict');
const { BOOKS } = require('../src/bank/books');
const { vocabOf, topicsOf } = require('../src/bank/vocab');
const { SEED } = require('../src/bank/seed');
const { gameSchema, grade, parseGaps, parseFix, writeChecks } = require('../src/services/games');
const items = SEED.filter(s => s.book === 'spotlight-6');

function solution(g) {
  if (g.type === 'gaps') return { gaps: parseGaps(g.text).gaps.map(a => a[0]) };
  if (g.type === 'match') return { pairs: Object.fromEntries(g.pairs.map((_, i) => [i, i])) };
  if (g.type === 'order') return { sentences: g.sentences.map(s => s.split(/\s+/)) };
  if (g.type === 'groups') return { items: Object.fromEntries(g.groups.flatMap((group, gi) => group.items.map((_, i) => [`${gi}-${i}`, gi]))) };
  return { b: Object.fromEntries(g.blocks.map((b, i) => {
    if (b.t === 'choice') return [i, b.correct];
    if (b.t === 'dictation') return [i, b.text];
    if (b.t === 'fix') return [i, Object.fromEntries(parseFix(b.text).flatMap((tok, k) => tok.right ? [[k, tok.right[0]]] : []))];
    return [i, ''];
  })) };
}

test('Spotlight 6: все 10 модулей, словарь и стабильные уникальные ключи', () => {
  const book = BOOKS.find(b => b.id === 'spotlight-6');
  assert.deepEqual(book.units.map(u => u.code), Array.from({ length: 10 }, (_, i) => String(i + 1)));
  assert.equal(new Set(SEED.map(s => s.key)).size, SEED.length);
  assert.equal(items.length, 318);
  let count = 0;
  for (const u of book.units) {
    const words = vocabOf(book.id, u.code);
    const topics = topicsOf(book.id, u.code);
    assert.ok(words.length >= 60, u.code);
    assert.ok(topics.length >= 4, u.code);
    assert.equal(new Set(words.map(w => w.term.toLowerCase())).size, words.length, u.code);
    assert.ok(words.every(w => w.term.trim() === w.term && /[a-z]/i.test(w.term) && /[а-яё]/i.test(w.translation) && w.topic));
    count += words.length;
    assert.equal(items.filter(s => s.unit === u.code && s.key.startsWith('spt6-')).length, 11);
  }
  assert.equal(count, 754);
  assert.deepEqual(items.map(s => s.key), require('../src/bank/seed').SEED.filter(s => s.book === 'spotlight-6').map(s => s.key));
});

test('Spotlight 6: все материалы проходят схему и эталонные ответы принимаются', () => {
  for (const s of items) {
    assert.ok(s.key.length <= 80 && s.title.length <= 255);
    const g = gameSchema.parse(s.game);
    if (s.key.endsWith('-writing') || s.key.endsWith('-speaking')) continue;
    const result = grade(g, solution(g));
    assert.ok(result.total > 0, s.key);
    assert.equal(result.score, 100, `${s.key}: ${JSON.stringify(result.details)}`);
    assert.equal(grade(g, {}).correct, 0, s.key);
    if (s.key.endsWith('-reading')) assert.equal(result.total, 4);
    if (s.key.endsWith('-fix')) assert.equal(result.total, 5);
    if (s.key.endsWith('-check')) assert.equal(result.total, 6);
    if (s.key.includes('-grammar-')) assert.equal(result.total, 6);
  }
});

test('Spotlight 6: устные ответы проверяются вручную; в письме есть чек-лист и ручная проверка', () => {
  for (let n = 1; n <= 10; n++) {
    const speaking = items.find(s => s.key === `spt6-${n}-speaking`);
    assert.equal(grade(speaking.game, {}).manual, 3);
    assert.equal(grade(speaking.game, {}).total, 0);
    const writing = items.find(s => s.key === `spt6-${n}-writing`);
    assert.equal(grade(writing.game, {}).manual, 1);
    assert.ok(writing.game.blocks.some(b => b.t === 'write' && b.min_words >= 60 && b.checks.length >= 3));
    if (n === 3 || n === 8) {
      const block = writing.game.blocks.find(b => b.t === 'write');
      for (const phrase of n === 3 ? ['Don’t run.', 'Do not run.'] : ['You mustn’t run.', 'You must not run.']) {
        const key = n === 3 ? 'c0' : 'c1';
        assert.equal(writeChecks(block, phrase).find(c => c.key === key).ok, true, phrase);
      }
    }
  }
});
