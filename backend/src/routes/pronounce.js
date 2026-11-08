// routes/pronounce.js — британское произношение слов живым голосом.
// Берём запись диктора из открытого словаря (dictionaryapi.dev, записи Викисловаря и Wikimedia Commons, лицензии CC BY / CC BY-SA)
// и храним у себя: каждое слово скачивается один раз, дальше отдаётся из базы.
//   GET /pronounce/:word        mp3 с британским произношением или 404 (тогда фронтенд читает голосом браузера)
//   GET /pronounce/:word/info   { audio: true|false, ipa: '/ɪkˈspensɪv/' | null }
// Таблица создаётся при запуске, миграция не нужна.
const express = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../middleware/validate');

const router = express.Router();

const SOURCE = process.env['PRONOUNCE_API'] || 'https://api.dictionaryapi.dev/api/v2/entries/en/';
const MAX_MP3 = 600 * 1024;
const RETRY_DAYS = 30; // слово без записи пробуем найти снова через месяц

let ready = null;
function ensure() {
  if (!ready) {
    ready = query(`
      CREATE TABLE IF NOT EXISTS pronunciations (
        word        VARCHAR(60) PRIMARY KEY,
        audio       BYTEA,
        ipa         VARCHAR(120),
        source_url  VARCHAR(500),
        fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `).catch((err) => { ready = null; throw err; });
  }
  return ready;
}

// Только одно английское слово: buses, don't, well-known. Фразы читает голос браузера
const clean = (w) => String(w || '').trim().toLowerCase().replace(/[’‘`]/g, "'");
const isWord = (w) => /^[a-z][a-z'-]{0,39}$/.test(w);

async function getJson(url, ms = 6000) {
  const res = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { Accept: 'application/json' } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`словарь ответил ${res.status}`);
  return res.json();
}

// Ищем британскую запись: файл …-uk.mp3. Американскую не берём
function pickUk(entries) {
  let ipa = null;
  for (const e of Array.isArray(entries) ? entries : []) {
    for (const p of e.phonetics || []) {
      if (/-uk\.mp3$/i.test(p.audio || '')) return { audio: p.audio, ipa: p.text || e.phonetic || null, source: p.sourceUrl || null };
      if (!ipa && p.text) ipa = p.text;
    }
    if (!ipa && e.phonetic) ipa = e.phonetic;
  }
  return { audio: null, ipa, source: null };
}

const inflight = new Map();
async function lookup(word) {
  await ensure();
  const { rows } = await query('SELECT word, audio IS NOT NULL AS has, ipa, fetched_at FROM pronunciations WHERE word = $1', [word]);
  const row = rows[0];
  if (row && (row.has || new Date(row.fetched_at) > new Date(Date.now() - RETRY_DAYS * 864e5))) return row;
  if (inflight.has(word)) return inflight.get(word);
  const job = (async () => {
    let audio = null;
    let found = { ipa: null, source: null };
    try {
      found = pickUk(await getJson(SOURCE + encodeURIComponent(word)));
      if (found.audio) {
        const r = await fetch(found.audio, { signal: AbortSignal.timeout(8000) });
        const buf = r.ok ? Buffer.from(await r.arrayBuffer()) : null;
        if (buf && buf.length > 500 && buf.length <= MAX_MP3) audio = buf;
      }
    } catch (err) {
      // Словарь недоступен: не запоминаем промах, попробуем в следующий раз
      console.error(`Произношение «${word}»: ${err.message}`);
      return row || { word, has: false, ipa: null };
    }
    await query(
      `INSERT INTO pronunciations (word, audio, ipa, source_url, fetched_at) VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (word) DO UPDATE SET audio = EXCLUDED.audio, ipa = EXCLUDED.ipa, source_url = EXCLUDED.source_url, fetched_at = NOW()`,
      [word, audio, found.ipa ? String(found.ipa).slice(0, 120) : null, found.source ? String(found.source).slice(0, 500) : null]
    );
    return { word, has: Boolean(audio), ipa: found.ipa || null };
  })().finally(() => inflight.delete(word));
  inflight.set(word, job);
  return job;
}

router.get(
  '/:word/info',
  asyncHandler(async (req, res) => {
    const w = clean(req.params.word);
    if (!isWord(w)) return res.json({ audio: false, ipa: null });
    const r = await lookup(w);
    res.set('Cache-Control', 'private, max-age=86400');
    res.json({ audio: Boolean(r.has), ipa: r.ipa || null });
  })
);

router.get(
  '/:word',
  asyncHandler(async (req, res) => {
    const w = clean(req.params.word);
    if (!isWord(w)) return res.status(404).json({ error: 'Нет записи' });
    const r = await lookup(w);
    if (!r.has) return res.status(404).json({ error: 'Нет записи' });
    const { rows } = await query('SELECT audio FROM pronunciations WHERE word = $1', [w]);
    if (!rows[0]?.audio) return res.status(404).json({ error: 'Нет записи' });
    res.set({ 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=2592000', 'X-Content-Type-Options': 'nosniff' });
    res.send(rows[0].audio);
  })
);

module.exports = router;
module.exports.pickUk = pickUk;
module.exports.ensure = ensure;
