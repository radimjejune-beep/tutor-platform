// test/unit.test.js — проверки без базы данных: проверка ответов, тарифы, подпись S3, произношение
require('./helpers');
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');
const { src } = require('./helpers');

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://unused@127.0.0.1:1/none';
const games = require(src('services/games.js'));
const plans = require(src('services/plans.js'));
const s3 = require(src('services/s3.js'));

test('письмо: чек-лист считает слова, обязательные фразы и шаблоны со звёздочкой', () => {
  const b = { t: 'write', min_words: 5, max_words: 40, caps: true, stop: true, checks: [{ words: 'I live in' }, { words: '*ed', min: 2 }] };
  const good = games.writeChecks(b, 'Hi! My name is Ann. I live in Kazan. I visited Moscow and played chess.');
  assert.equal(good.length, 6);
  assert.ok(good.every((c) => c.ok), JSON.stringify(good));
  const bad = games.writeChecks(b, 'hello there, i played');
  for (const k of ['min', 'c0', 'c1', 'caps', 'stop']) assert.equal(bad.find((c) => c.key === k).ok, false, k);
});

test('исправь ошибки: разбор {неверно=верно} и обычных слов', () => {
  const parts = games.parseFix('She {go=goes} to school.');
  const wrong = parts.filter((p) => p.fix !== undefined || p.right !== undefined || p.wrong !== undefined);
  assert.ok(wrong.length >= 1, JSON.stringify(parts));
  assert.ok(parts.some((p) => p.word && /school/.test(p.s)));
});

test('логика заданий на сайте и на сервере одинаковая', async () => {
  const front = await import(pathToFileURL(path.join(__dirname, '..', '..', 'frontend', 'src', 'games', 'logic.js')).href);
  const samples = [
    [{ t: 'write', min_words: 3, max_words: 20, min_sentences: 2, caps: true, checks: [{ words: 'because' }, { words: 'always, often', min: 2 }] }, 'I like tea because it is hot. It is nice.'],
    [{ t: 'write', min_words: 10 }, 'Too short.'],
  ];
  for (const [b, text] of samples) assert.deepEqual(front.writeChecks(b, text), games.writeChecks(b, text));
  const fx = 'He {don\'t=doesn\'t} like {apple=apples}, but I do.';
  assert.deepEqual(front.parseFix(fx), games.parseFix(fx));
});

test('тарифы: Старт, пробный период, старый «Про» считается «Репетитором»', () => {
  const start = plans.effective({ plan: 'start' });
  assert.equal(start.limits.students, 3);
  const trial = plans.effective({ plan: 'trial', plan_until: new Date(Date.now() + 864e5) });
  assert.equal(trial.trial, true);
  assert.equal(trial.limits.students, null);
  const ended = plans.effective({ plan: 'trial', plan_until: new Date(Date.now() - 864e5) });
  assert.equal(ended.trial, false);
  assert.equal(ended.limits.students, 3);
  const legacy = plans.effective({ plan: 'pro', plan_until: null });
  assert.equal(legacy.price, plans.PLANS.tutor.price);
  assert.equal(plans.PLANS.tutor.price, 499);
  assert.equal(Object.keys(plans.PLANS).includes('pro'), false);
});

test('подпись S3 совпадает с эталонными примерами AWS', () => {
  const base = { host: 'examplebucket.s3.amazonaws.com', amzDate: '20130524T000000Z', region: 'us-east-1', key: 'AKIAIOSFODNN7EXAMPLE', secret: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY' };
  const empty = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const get = s3.signRaw({ ...base, method: 'GET', path: '/test.txt', headers: { range: 'bytes=0-9' }, payloadHash: empty });
  assert.equal(get.signature, 'f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41');
  const list = s3.signRaw({ ...base, method: 'GET', path: '/', query: { 'max-keys': '2', prefix: 'J' }, payloadHash: empty });
  assert.equal(list.signature, '34b48302e7b5fa45bde8084f4b7868a86f0a534bc59db6670ed5711ef69dc6f7');
});

test('произношение: берётся британская запись', () => {
  const { pickUk } = require(src('routes/pronounce.js'));
  const r = pickUk([{ phonetic: '/x/', phonetics: [{ text: '/ˈwɔːtə/', audio: 'https://a/water-us.mp3' }, { text: '/ˈwɔːtə/', audio: 'https://a/water-uk.mp3' }] }]);
  assert.equal(r.audio, 'https://a/water-uk.mp3');
});

test('документы платформы: три документа, без длинного тире', () => {
  const P = require(src('legal/platform.js'));
  const docs = P.all();
  assert.deepEqual(docs.map((d) => d.kind).sort(), ['dpa', 'privacy', 'terms']);
  for (const d of docs) assert.equal(JSON.stringify(d).includes('—'), false, d.kind);
});

test('JSON разбирается для /api/library-folders и /api/library-books (не путать с /api/library)', () => {
  const srv = require('fs').readFileSync(src('server.js'), 'utf8');
  assert.match(srv, /req\.path === p \|\| req\.path\.startsWith\(`\$\{p\}\/`\)/);
});

test('конструктор заданий: схема и проверка', () => {
  const { gameSchema, grade } = require(src('services/games.js'));
  const g = gameSchema.parse({ type: 'board', ratio: 1.33, elements: [
    { id: 'a', k: 'input', x: 1, y: 1, w: 10, h: 5, a: 'goes|is going' },
    { id: 'z', k: 'zone', x: 1, y: 1, w: 10, h: 5, text: 'verbs' },
    { id: 'c', k: 'chip', x: 1, y: 1, w: 10, h: 5, text: 'run', zone: 'z' },
    { id: 'd', k: 'chip', x: 1, y: 1, w: 10, h: 5, text: 'cat' },
    { id: 's', k: 'select', x: 1, y: 1, w: 10, h: 5, options: ['is', 'are'], correct: 1 },
    { id: 'm', k: 'input', x: 1, y: 1, w: 10, h: 5 },
  ] });
  const r = grade(g, { e: { a: 'Is going', c: 'z', d: 'z', s: 1, m: 'free text' } });
  assert.equal(r.total, 4);
  assert.equal(r.correct, 3);
  assert.equal(r.manual, 1);
  assert.equal(gameSchema.safeParse({ type: 'board', elements: [{ id: 's', k: 'select', x: 1, y: 1, w: 5, h: 5, options: ['x'] }] }).success, false);
  assert.equal(gameSchema.safeParse({ type: 'board', elements: [{ id: 'q', k: 'text', x: 1, y: 1, w: 5, h: 5 }, { id: 'q', k: 'text', x: 1, y: 1, w: 5, h: 5 }] }).success, false);
});

test('быстрые игры: одни слова, разные шаблоны', () => {
  const { gameSchema, grade } = require(src('services/games.js'));
  const items = [{ q: 'cat', a: 'кот' }, { q: 'dog', a: 'собака|пёс' }, { q: 'cow', a: 'корова', wrong: ['коза'] }];
  const g = (template) => gameSchema.parse({ type: 'quick', template, items });
  assert.equal(grade(g('quiz'), { r: { 0: 'кот', 1: 'пёс', 2: 'коза' } }).correct, 2);
  assert.equal(grade(g('type'), { r: { 0: ' Кот ', 1: 'собака' } }).correct, 2);
  assert.equal(grade(g('anagram'), { r: { 0: 'cat', 1: 'god' } }).correct, 1);
  assert.equal(grade(g('tf'), { r: { 0: { j: 0, v: true }, 1: { j: 2, v: true }, 2: { j: 0, v: false } } }).correct, 2);
  assert.equal(grade(g('memory'), { found: [0, 2] }).correct, 2);
  assert.equal(grade(g('match'), { pairs: { 0: 0, 1: 1, 2: 0 } }).correct, 2);
  assert.equal(gameSchema.safeParse({ type: 'quick', template: 'memory', items: [items[0]] }).success, false);
  assert.equal(gameSchema.safeParse({ type: 'quick', template: 'quiz', items: [items[0]] }).success, true);
});
