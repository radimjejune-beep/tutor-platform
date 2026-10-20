'use strict';
// Каталог: учебники и товары (уроки и пакеты).
// Режим db (по умолчанию): каталог хранится в базе и правится в админке сайта.
// Режим file (если задан CATALOG_FILE): каталог читается из JSON-файла, как раньше.
// Дерево учебник → класс/уровень → модуль строится из полей товара: book, grade, module, moduleTitle.
const fs = require('fs');
const path = require('path');
const { config } = require('./config');

let data = null;
let raw = null;

const SKU_RE = /^[a-z0-9][a-z0-9-]{1,40}$/;

function gradeLabel(g) {
  return /^\d+$/.test(String(g)) ? `${g} класс` : String(g);
}

// Старый формат файла: дерево textbooks[].grades[].modules[].products → поля в товарах
function flattenLegacy(src) {
  const out = JSON.parse(JSON.stringify(src));
  let order = 0;
  for (const t of out.textbooks) {
    for (const g of t.grades || []) {
      for (const m of g.modules || []) {
        for (const sku of m.products || []) {
          const p = out.products[sku];
          if (!p) continue;
          p.book = p.book || t.id;
          p.grade = p.grade != null ? p.grade : g.grade;
          p.module = p.module || m.id;
          p.moduleTitle = p.moduleTitle || m.title;
          if (p.order == null) p.order = order++;
        }
      }
    }
    delete t.grades;
  }
  return out;
}

// Строит дерево для бота и сайта
function build(src) {
  const c = JSON.parse(JSON.stringify(src));
  c.textbooks = (c.textbooks || []).map(t => ({ id: t.id, title: t.title, short: t.short || t.title, grades: [] }));
  const products = c.products || {};
  const list = Object.entries(products).map(([sku, p]) => Object.assign(p, { sku }))
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.sku.localeCompare(b.sku));
  for (const p of list) {
    const t = c.textbooks.find(x => x.id === p.book);
    if (!t || p.status === 'hidden') continue;
    let g = t.grades.find(x => String(x.grade) === String(p.grade));
    if (!g) { g = { grade: p.grade, label: gradeLabel(p.grade), modules: [] }; t.grades.push(g); }
    const mid = p.module || `${t.id}-${p.grade}`;
    let m = g.modules.find(x => x.id === mid);
    if (!m) { m = { id: mid, title: p.moduleTitle || mid, products: [] }; g.modules.push(m); }
    m.products.push(p.sku);
  }
  c.products = Object.fromEntries(list.map(p => [p.sku, p]));
  return c;
}

// Проверка каталога. hasFile(key) говорит, есть ли файл (на диске или в базе).
async function validate(src, hasFile) {
  const errors = [];
  const books = new Set((src.textbooks || []).map(t => t.id));
  for (const [sku, p] of Object.entries(src.products || {})) {
    const name = `«${p.title || sku}» (${sku})`;
    if (!SKU_RE.test(sku)) errors.push(`${name}: код может содержать только латиницу в нижнем регистре, цифры и дефис`);
    if (!p.title) errors.push(`${name}: нет названия`);
    if (!books.has(p.book)) errors.push(`${name}: не выбран учебник`);
    if (!['lesson', 'pack'].includes(p.type)) errors.push(`${name}: тип должен быть lesson или pack`);
    if (!['available', 'preorder', 'soon', 'hidden'].includes(p.status)) errors.push(`${name}: неизвестный статус ${p.status}`);
    if (p.status !== 'hidden' && (p.grade === '' || p.grade == null)) errors.push(`${name}: укажите класс или уровень`);
    if (p.status !== 'hidden' && !p.moduleTitle) errors.push(`${name}: укажите модуль, в котором урок покажется в боте`);
    if (p.type === 'lesson' && p.status === 'preorder') errors.push(`${name}: предзаказ бывает только у пакета`);
    if (!p.free && (p.status === 'available' || p.status === 'preorder') && !(Number(p.price) > 0)) errors.push(`${name}: укажите цену или отметьте урок бесплатным`);
    if (p.type === 'lesson' && p.status === 'available') {
      if (!p.files || !p.files.html) errors.push(`${name}: для продажи нужен HTML-файл урока`);
      for (const f of Object.values(p.files || {})) {
        if (f && !(await hasFile(f))) errors.push(`${name}: файл ${f} не найден`);
      }
    }
    if (p.type === 'pack') {
      if (!(p.includes || []).length) errors.push(`${name}: в пакете нет уроков`);
      for (const s of p.includes || []) if (!src.products[s]) errors.push(`${name}: в пакете неизвестный урок ${s}`);
    }
  }
  return errors;
}

const diskHas = f => fs.existsSync(path.join(config.root, f));

// Синхронная загрузка из файла (режим file)
function load() {
  if (config.catalogMode === 'db') {
    if (!raw) throw new Error('Каталог ещё не загружен из базы');
    data = build(raw);
    return data;
  }
  const src = flattenLegacy(JSON.parse(fs.readFileSync(config.catalogPath, 'utf8')));
  for (const [sku, p] of Object.entries(src.products)) {
    if (p.type === 'lesson' && p.status === 'available') {
      for (const f of Object.values(p.files || {})) if (!diskHas(f)) throw new Error(`Каталог: у урока ${sku} нет файла ${f}`);
    }
    if (p.type === 'pack') for (const s of p.includes || []) if (!src.products[s]) throw new Error(`Каталог: пакет ${sku} ссылается на неизвестный урок ${s}`);
  }
  raw = src;
  data = build(src);
  return data;
}

// Режим db: каталог из базы. При первом запуске переносит catalog.json и файлы из content/ в базу.
async function loadFromDb() {
  const db = require('./db');
  const store = require('./store');
  let json = await db.kvGet('catalog');
  if (!json) {
    const seed = flattenLegacy(JSON.parse(fs.readFileSync(path.join(config.root, 'catalog.json'), 'utf8')));
    for (const [sku, p] of Object.entries(seed.products)) {
      for (const [kind, f] of Object.entries(p.files || {})) {
        if (!f || f.startsWith('db:')) continue;
        if (!diskHas(f)) { delete p.files[kind]; continue; }
        const key = `lesson/${sku}/${kind}`;
        await store.putFile(key, kind === 'pdf' ? 'application/pdf' : 'text/html; charset=utf-8', fs.readFileSync(path.join(config.root, f)), 'import');
        p.files[kind] = 'db:' + key;
      }
      const shots = [];
      for (const s of p.shots || []) {
        if (!s.file || s.file.startsWith('db:')) { shots.push(s); continue; }
        if (!diskHas(s.file)) continue;
        const key = `shot/${sku}/${shots.length + 1}`;
        await store.putFile(key, 'image/webp', fs.readFileSync(path.join(config.root, s.file)), 'import');
        shots.push({ ...s, file: 'db:' + key });
      }
      if (p.shots) p.shots = shots;
    }
    json = JSON.stringify(seed);
    await db.kvSet('catalog', json);
    console.log('Каталог перенесён из catalog.json в базу');
  }
  raw = JSON.parse(json);
  data = build(raw);
  return data;
}

async function save(src, hasFile) {
  const clean = flattenLegacy(src);
  const errors = await validate(clean, hasFile);
  if (errors.length) return { ok: false, errors };
  const db = require('./db');
  await db.kvSet('catalog', JSON.stringify(clean));
  raw = clean;
  data = build(clean);
  return { ok: true };
}

function getRaw() { return raw; }

function get() {
  return data || load();
}

function product(sku) {
  return get().products[sku] || null;
}

function textbook(id) {
  return get().textbooks.find(t => t.id === id) || null;
}

function moduleById(id) {
  for (const t of get().textbooks) {
    for (const g of t.grades) {
      for (const m of g.modules) if (m.id === id) return { textbook: t, grade: g, module: m };
    }
  }
  return null;
}

function moduleOf(sku) {
  for (const t of get().textbooks) {
    for (const g of t.grades) {
      for (const m of g.modules) if (m.products.includes(sku)) return { textbook: t, grade: g, module: m };
    }
  }
  return null;
}

function freeProducts() {
  return Object.values(get().products).filter(p => p.free && p.status === 'available');
}

// Можно ли купить (оплатить) товар
function purchasable(p) {
  return p && !p.free && p.price > 0 && (p.status === 'available' || p.status === 'preorder');
}

// Уроки, которые получает владелец товара: сам урок или содержимое пакета
function lessonsOf(p) {
  if (!p) return [];
  if (p.type === 'pack') return (p.includes || []).map(product).filter(Boolean);
  return [p];
}

module.exports = {
  load, loadFromDb, save, validate, getRaw, get, product, textbook, moduleById, moduleOf, freeProducts, purchasable, lessonsOf, gradeLabel
};
