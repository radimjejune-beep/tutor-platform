// voice.js — озвучка слов британским произношением.
// 1) Отдельное английское слово: живая запись диктора из словаря (сервер скачивает её один раз и хранит у себя).
// 2) Фразы, примеры и слова без записи: лучший британский голос, который есть на устройстве
//    (Edge: Sonia, Libby, Ryan Natural; Chrome: Google UK English; iPhone и Mac: Daniel, Serena, Kate).
// Голос можно выбрать вручную, выбор хранится в браузере.
import { getToken, API_BASE as BASE } from './api';
const KEY = 'lf-voice';

let lang = 'en-GB';
let voices = [];
let current = null; // что звучит сейчас: Audio или true (синтез)

// Чем выше в списке, тем лучше звучит. Natural и Google работают через интернет, но звучат почти как человек
const RANK = [
  /Sonia.*Natural/i, /Libby.*Natural/i, /Ryan.*Natural/i, /Maisie.*Natural/i, /Thomas.*Natural/i, /Natural.*United Kingdom/i,
  /Google UK English Female/i, /Google UK English Male/i,
  /Daniel.*(Premium|Enhanced)/i, /Serena.*(Premium|Enhanced)/i, /Kate.*(Premium|Enhanced)/i, /Jamie.*(Premium|Enhanced)/i, /Stephanie.*(Premium|Enhanced)/i,
  /Serena/i, /Daniel/i, /Kate/i, /Arthur/i, /Martha/i, /Stephanie/i, /Jamie/i, /Oliver/i,
  /Hazel/i, /George/i, /Susan/i,
];
const score = (v) => {
  const i = RANK.findIndex((re) => re.test(v.name));
  return i < 0 ? RANK.length : i;
};

const hasSynth = () => typeof window !== 'undefined' && 'speechSynthesis' in window;
function loadVoices() { voices = hasSynth() ? window.speechSynthesis.getVoices() : []; }
if (hasSynth()) {
  loadVoices();
  window.speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
}

// Британские голоса устройства, лучшие сверху (для выбора в настройках)
export function britishVoices() {
  if (!voices.length) loadVoices();
  return voices.filter((v) => /^en[-_]GB/i.test(v.lang)).sort((a, b) => score(a) - score(b));
}

function savedVoice() {
  try { return localStorage.getItem(KEY) || ''; } catch { return ''; }
}
export function setVoice(name) {
  try { name ? localStorage.setItem(KEY, name) : localStorage.removeItem(KEY); } catch { /* приватный режим */ }
}
export const chosenVoice = savedVoice;

function pickVoice() {
  if (!voices.length) loadVoices();
  const name = savedVoice();
  if (name) {
    const v = voices.find((x) => x.name === name);
    if (v) return v;
  }
  if (lang.startsWith('en')) {
    const gb = britishVoices();
    if (gb.length) return gb[0];
  }
  const base = lang.slice(0, 2);
  return voices.find((v) => v.lang === lang) || voices.find((v) => v.lang?.startsWith(base)) || null;
}

export function setSpeechLang(l) { lang = l; }
export const canSpeak = () => Boolean(lang) && (hasSynth() || lang.startsWith('en'));

export function stop() {
  if (current && current !== true) { current.pause(); current = null; }
  if (hasSynth()) window.speechSynthesis.cancel();
}

function synth(text, rate = 0.9) {
  return new Promise((resolve) => {
    if (!hasSynth() || !text) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    const v = pickVoice();
    if (v) u.voice = v;
    u.rate = rate;
    u.onend = u.onerror = () => resolve();
    current = true;
    window.speechSynthesis.speak(u);
  });
}

// Запись диктора: кэш на время открытой страницы, чтобы повтор звучал сразу
const recCache = new Map(); // слово → objectURL | null
async function recording(word) {
  if (recCache.has(word)) return recCache.get(word);
  let url = null;
  try {
    const res = await fetch(`${BASE}/api/pronounce/${encodeURIComponent(word)}`, { headers: { Authorization: `Bearer ${getToken()}` } });
    if (res.ok) url = URL.createObjectURL(await res.blob());
  } catch { /* нет сети: прочитает голос */ }
  recCache.set(word, url);
  return url;
}

const singleWord = (t) => {
  const w = String(t || '').trim().toLowerCase().replace(/[’‘`]/g, "'").replace(/[.!?,;:]+$/, '');
  return /^[a-z][a-z'-]{0,39}$/.test(w) ? w : null;
};

function play(url) {
  return new Promise((resolve) => {
    const a = new Audio(url);
    current = a;
    a.onended = a.onerror = () => resolve();
    a.play().catch(() => resolve());
  });
}

// Озвучить слово (и, если передан, пример после него)
export async function speak(text, example) {
  if (!canSpeak() || !text) return;
  stop();
  const clean = String(text).replace(/\(.*?\)/g, '').trim();
  const w = lang.startsWith('en') ? singleWord(clean) : null;
  const url = w ? await recording(w) : null;
  if (url) await play(url);
  else await synth(clean);
  if (example) await synth(String(example).replace(/\(.*?\)/g, '').trim());
}

// Транскрипция слова, если есть в словаре: '/ɪkˈspensɪv/'
const ipaCache = new Map();
export async function transcription(text) {
  const w = singleWord(text);
  if (!w || !lang.startsWith('en')) return null;
  if (ipaCache.has(w)) return ipaCache.get(w);
  const p = fetch(`${BASE}/api/pronounce/${encodeURIComponent(w)}/info`, { headers: { Authorization: `Bearer ${getToken()}` } })
    .then((r) => (r.ok ? r.json() : null)).then((d) => d?.ipa || null).catch(() => null);
  ipaCache.set(w, p);
  return p;
}

// Прочитать фразу британским голосом (диктант, примеры). rate: 0.6 медленно, 0.9 обычно
export async function say(text, rate = 0.9) {
  if (!text) return;
  stop();
  await synth(String(text), rate);
}
