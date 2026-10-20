'use strict';
// Веб-сервер: публичный сайт, бесплатные демо-уроки, личные ссылки на уроки, админка /admin и её API.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { config } = require('./config');
const db = require('./db');
const store = require('./store');
const catalog = require('./catalog');
const delivery = require('./delivery');
const orders = require('./orders');

const WEB = path.join(config.root, 'web');
const MAX_JSON = 2 * 1024 * 1024;
const MAX_FILE = 40 * 1024 * 1024;

// ---------- ответы ----------
const CSP_SITE = "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
// Урок: всё встроено в файл, сеть не нужна
const CSP_LESSON = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; frame-ancestors 'none'; base-uri 'none'";

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    ...headers
  });
  res.end(body);
}

function html(res, status, body, { csp = CSP_SITE, robots = true, cache = 'no-cache' } = {}) {
  send(res, status, body, {
    'content-type': 'text/html; charset=utf-8',
    'content-security-policy': csp,
    'cache-control': cache,
    ...(robots ? {} : { 'x-robots-tag': 'noindex, nofollow' })
  });
}

function json(res, status, obj) {
  send(res, status, JSON.stringify(obj), { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
}

function message(title, text) {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f2ea;color:#17202e;font:17px/1.5 system-ui,sans-serif;padding:24px}main{max-width:440px;text-align:center}h1{font-size:22px}a{color:#17202e}</style></head>
<body><main><h1>${title}</h1><p>${text}</p><p><a href="/">На главную</a></p></main></body></html>`;
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error('Файл слишком большой'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJson(req) {
  const buf = await readBody(req, MAX_JSON);
  try { return JSON.parse(buf.toString('utf8') || '{}'); } catch { throw Object.assign(new Error('Некорректный JSON'), { status: 400 }); }
}

function cookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
}

// ---------- настройки сайта ----------
const DEFAULT_SETTINGS = {
  seller: { name: '', inn: '', contact: config.supportContact || '', email: '' },
  channel: config.channelUrl || '',
  hosting: '',
  payment: 'ЮKassa (ООО НКО «ЮМани»)',
  offerDate: ''
};

async function getSettings() {
  const raw = await db.kvGet('settings');
  const s = raw ? JSON.parse(raw) : {};
  return { ...DEFAULT_SETTINGS, ...s, seller: { ...DEFAULT_SETTINGS.seller, ...(s.seller || {}) } };
}

// ---------- публичные данные для сайта ----------
const fileUrl = ref => (ref && ref.startsWith('db:') ? '/f/' + ref.slice(3) : null);

function publicProduct(p) {
  return {
    sku: p.sku, type: p.type, title: p.name || p.title, short: p.short || p.title, description: p.description || '',
    status: p.status, free: !!p.free, price: p.price || 0, oldPrice: p.oldPrice || 0,
    book: p.book, grade: p.grade, gradeLabel: catalog.gradeLabel(p.grade), moduleTitle: p.moduleTitle || '',
    unit: p.unit || '', meta: p.meta || [], steps: p.steps || [], includes: p.includes || [], author: p.author || '',
    shots: (p.shots || []).map(s => ({ src: fileUrl(s.file), caption: s.caption || '' })).filter(s => s.src),
    demo: p.type === 'lesson' && p.free && p.status === 'available' ? `/demo/${p.sku}` : null,
    course: catalog.isCourse(p),
    ready: catalog.isCourse(p) ? catalog.lessonsOf(p).filter((l) => l.status === 'available').length : undefined,
    total: catalog.isCourse(p) ? catalog.lessonsOf(p).length : undefined
  };
}

async function siteData(view) {
  const c = catalog.get();
  const settings = await getSettings();
  return {
    view,
    bot: config.botEnabled ? config.botUsername : '',
    pay: config.payEnabled,
    channel: settings.channel,
    seller: settings.seller,
    hosting: settings.hosting,
    payment: settings.payment,
    offerDate: settings.offerDate,
    textbooks: c.textbooks.map(t => ({ id: t.id, title: t.title, short: t.short })),
    products: Object.values(c.products).filter(p => p.status !== 'hidden').map(publicProduct)
  };
}

let siteTpl = null;
function sitePage(data) {
  if (!siteTpl || process.env.NODE_ENV === 'development') siteTpl = fs.readFileSync(path.join(WEB, 'site.html'), 'utf8');
  const payload = JSON.stringify(data).replace(/</g, '\\u003c');
  return siteTpl.replace('/*LF_DATA*/null', () => payload).split('{{PUBLIC_URL}}').join(config.publicUrl);
}

// ---------- статические файлы ----------
const STATIC = {
  '/assets/unbounded.woff': ['fonts/unbounded.woff', 'font/woff'],
  '/assets/nunito.woff': ['fonts/nunito.woff', 'font/woff'],
  '/admin': ['admin.html', 'text/html; charset=utf-8']
};

// ---------- админка ----------
const loginAttempts = new Map();
function tooMany(ip) {
  const now = Date.now();
  const list = (loginAttempts.get(ip) || []).filter(t => now - t < 15 * 60 * 1000);
  loginAttempts.set(ip, list);
  return list.length >= 10;
}

const KEY_RE = /^(lesson|shot)\/[a-z0-9][a-z0-9-]{1,40}\/[a-z0-9-]{1,20}$/;
const FILE_TYPES = {
  html: ['text/html; charset=utf-8'],
  pdf: ['application/pdf'],
  shot: ['image/webp', 'image/png', 'image/jpeg']
};

function refsOf(raw) {
  const keys = [];
  for (const p of Object.values(raw.products || {})) {
    for (const f of Object.values(p.files || {})) if (f && f.startsWith('db:')) keys.push(f.slice(3));
    for (const s of p.shots || []) if (s.file && s.file.startsWith('db:')) keys.push(s.file.slice(3));
  }
  return keys;
}

async function hasRef(ref) {
  if (ref.startsWith('db:')) return store.hasFile(ref.slice(3));
  return fs.existsSync(path.join(config.root, ref));
}

async function adminApi(req, res, url, hooks) {
  const route = url.pathname.slice('/admin/api'.length);
  const method = req.method;
  const ip = clientIp(req);

  // защита от CSRF: запросы только со своей страницы
  if (method !== 'GET') {
    if (req.headers['x-lf-admin'] !== '1') return json(res, 403, { error: 'Запрос отклонён' });
    const origin = req.headers.origin;
    if (origin && new URL(origin).host !== req.headers.host) return json(res, 403, { error: 'Запрос с чужого сайта' });
  }

  if (route === '/login' && method === 'POST') {
    if (tooMany(ip)) return json(res, 429, { error: 'Слишком много попыток. Подождите 15 минут.' });
    const { login, password } = await readJson(req);
    const token = await store.login(String(login || '').toLowerCase().trim(), String(password || ''));
    if (!token) {
      loginAttempts.get(ip).push(Date.now());
      return json(res, 401, { error: 'Неверный логин или пароль' });
    }
    await store.log(login, 'вход', ip);
    const secure = config.publicUrl.startsWith('https') ? '; Secure' : '';
    res.setHeader('set-cookie', `lf_s=${token}; Path=/admin; HttpOnly; SameSite=Strict; Max-Age=${14 * 86400}${secure}`);
    return json(res, 200, { ok: true });
  }

  const token = cookies(req).lf_s;
  const who = await store.session(token);
  if (!who) return json(res, 401, { error: 'Нужно войти' });

  if (route === '/logout' && method === 'POST') {
    await store.logout(token);
    res.setHeader('set-cookie', 'lf_s=; Path=/admin; HttpOnly; SameSite=Strict; Max-Age=0');
    return json(res, 200, { ok: true });
  }
  if (route === '/me') return json(res, 200, { login: who, bot: config.botUsername, publicUrl: config.publicUrl, mode: config.catalogMode });

  if (route === '/catalog' && method === 'GET') {
    const raw = catalog.getRaw();
    const files = await store.fileInfo(refsOf(raw));
    return json(res, 200, { catalog: raw, files });
  }
  if (route === '/catalog' && method === 'PUT') {
    if (config.catalogMode !== 'db') return json(res, 409, { error: 'Каталог читается из файла (CATALOG_FILE). Уберите эту переменную, чтобы править каталог в админке.' });
    const body = await readJson(req);
    const before = catalog.getRaw();
    const r = await catalog.save(body.catalog, hasRef);
    if (!r.ok) return json(res, 422, { error: 'Каталог не сохранён', errors: r.errors });
    delivery.clearCache();
    const changed = Object.keys(body.catalog.products || {}).filter(k => JSON.stringify((before.products || {})[k]) !== JSON.stringify(body.catalog.products[k]));
    await store.log(who, 'каталог опубликован', changed.join(', ') || 'без изменений в товарах');
    if (hooks.onCatalogChange) hooks.onCatalogChange();
    return json(res, 200, { ok: true });
  }

  const fm = route.match(/^\/files\/(.+)$/);
  if (fm) {
    const key = decodeURIComponent(fm[1]);
    if (!KEY_RE.test(key)) return json(res, 400, { error: 'Некорректное имя файла' });
    const kind = key.startsWith('shot/') ? 'shot' : key.split('/')[2];
    if (method === 'PUT') {
      const allowed = FILE_TYPES[kind];
      if (!allowed) return json(res, 400, { error: 'Можно загрузить html, pdf или скриншот' });
      const mime = String(req.headers['content-type'] || '').toLowerCase();
      const okMime = allowed.find(a => mime.startsWith(a.split(';')[0]));
      if (!okMime) return json(res, 415, { error: `Ожидается файл типа ${allowed.map(a => a.split(';')[0]).join(' или ')}` });
      const buf = await readBody(req, MAX_FILE);
      if (!buf.length) return json(res, 400, { error: 'Пустой файл' });
      const warnings = [];
      if (kind === 'html') {
        const text = buf.toString('utf8');
        if (!/<html|<!doctype/i.test(text.slice(0, 2000))) return json(res, 422, { error: 'Это не похоже на HTML-урок' });
        if (!text.includes('{{BUYER}}')) warnings.push('В файле нет метки {{BUYER}}: имя покупателя не будет вшито в урок. Соберите урок командой build.py \'{{BUYER}}\'.');
        if (/<script[^>]+src=["']https?:/i.test(text) || /url\(["']?https?:/i.test(text)) warnings.push('Урок подгружает что-то из интернета. На уроке без сети это не откроется, а для покупателей это передача данных третьим лицам.');
      }
      if (kind === 'pdf' && buf.slice(0, 5).toString() !== '%PDF-') return json(res, 422, { error: 'Это не PDF' });
      const info = await store.putFile(key, okMime, buf, who);
      delivery.clearCache();
      await store.log(who, 'файл загружен', `${key} (${Math.round(buf.length / 1024)} КБ)`);
      return json(res, 200, { ok: true, ...info, warnings });
    }
    if (method === 'GET') {
      const f = await store.getFile(key);
      if (!f) return json(res, 404, { error: 'Файл не найден' });
      if (kind === 'html') {
        const body = f.data.toString('utf8').split('{{BUYER}}').join('предпросмотр администратора');
        return html(res, 200, body, { csp: CSP_LESSON, robots: false, cache: 'no-store' });
      }
      return send(res, 200, f.data, { 'content-type': f.mime, 'cache-control': 'no-store', 'content-security-policy': "default-src 'none'" });
    }
    if (method === 'DELETE') {
      const raw = catalog.getRaw();
      if (refsOf(raw).includes(key)) return json(res, 409, { error: 'Файл используется в опубликованном каталоге. Сначала уберите его из урока и опубликуйте.' });
      await store.deleteFile(key);
      await store.log(who, 'файл удалён', key);
      return json(res, 200, { ok: true });
    }
  }

  if (route === '/settings' && method === 'GET') return json(res, 200, await getSettings());
  if (route === '/settings' && method === 'PUT') {
    const b = await readJson(req);
    const clean = {
      seller: {
        name: String(b.seller?.name || '').slice(0, 120),
        inn: String(b.seller?.inn || '').replace(/\D/g, '').slice(0, 12),
        contact: String(b.seller?.contact || '').slice(0, 80),
        email: String(b.seller?.email || '').slice(0, 120)
      },
      channel: String(b.channel || '').slice(0, 200),
      hosting: String(b.hosting || '').slice(0, 200),
      payment: String(b.payment || DEFAULT_SETTINGS.payment).slice(0, 200),
      offerDate: String(b.offerDate || '').slice(0, 40)
    };
    if (clean.seller.inn && clean.seller.inn.length !== 12) return json(res, 422, { error: 'ИНН физического лица состоит из 12 цифр' });
    if (clean.channel && !/^https:\/\/t\.me\/[A-Za-z0-9_]{4,}$/.test(clean.channel)) return json(res, 422, { error: 'Ссылка на канал должна быть вида https://t.me/имя_канала' });
    await db.kvSet('settings', JSON.stringify(clean));
    await store.log(who, 'настройки сохранены');
    return json(res, 200, { ok: true });
  }

  if (route === '/admins' && method === 'GET') return json(res, 200, { admins: await store.listAdmins(), me: who });
  if (route === '/admins' && method === 'POST') {
    const b = await readJson(req);
    try { await store.createAdmin(String(b.login || '').toLowerCase().trim(), String(b.password || '')); }
    catch (e) { return json(res, 422, { error: e.code === '23505' ? 'Такой логин уже есть' : e.message }); }
    await store.log(who, 'добавлен админ', b.login);
    return json(res, 200, { ok: true });
  }
  const am = route.match(/^\/admins\/([a-z0-9_.-]+)$/);
  if (am && method === 'DELETE') {
    if (am[1] === who) return json(res, 422, { error: 'Нельзя удалить себя' });
    await store.deleteAdmin(am[1]);
    await store.log(who, 'удалён админ', am[1]);
    return json(res, 200, { ok: true });
  }
  if (route === '/password' && method === 'POST') {
    const b = await readJson(req);
    try { await store.setPassword(who, String(b.password || '')); } catch (e) { return json(res, 422, { error: e.message }); }
    await store.log(who, 'сменил пароль');
    res.setHeader('set-cookie', 'lf_s=; Path=/admin; HttpOnly; SameSite=Strict; Max-Age=0');
    return json(res, 200, { ok: true });
  }

  if (route === '/stats') return json(res, 200, { stats: await db.stats(), site: await orders.stats(), log: await store.recentLog(40), bot: config.botEnabled, pay: config.payEnabled, mail: config.mailEnabled });

  if (route === '/orders' && method === 'GET') return json(res, 200, { orders: await orders.list({ q: url.searchParams.get('q') || '' }), pay: config.payEnabled, mail: config.mailEnabled });
  const om = route.match(/^\/orders\/([0-9a-f-]{36})\/(resend|refund|sync)$/);
  if (om && method === 'POST') {
    const o = await orders.byId(om[1]);
    if (!o) return json(res, 404, { error: 'Заказ не найден' });
    if (om[2] === 'resend') {
      if (o.status !== 'paid') return json(res, 409, { error: 'Заказ не оплачен' });
      if (!o.email) return json(res, 409, { error: 'Заказ из Telegram: покупатель получает файлы в боте («Мои уроки»).', link: `${config.publicUrl}/o/${o.token}` });
      const r = await orders.sendMail(o, 'resend');
      await store.log(who, 'ссылка отправлена повторно', `${orders.shortId(o)} ${o.email}`);
      return r.sent ? json(res, 200, { ok: true }) : json(res, 502, { error: 'Письмо не ушло: ' + r.error, link: `${config.publicUrl}/o/${o.token}` });
    }
    if (om[2] === 'sync') return json(res, 200, { order: await orders.sync(o) });
    if (om[2] === 'refund') {
      try { await orders.refund(o.id); } catch (e) { return json(res, e.status || 502, { error: e.message }); }
      await store.log(who, 'возврат', `${orders.shortId(o)} ${o.email} ${o.amount_rub} ₽`);
      return json(res, 200, { ok: true });
    }
  }
  if (route === '/orders/link' && method === 'POST') {
    const b = await readJson(req);
    const o = await orders.byId(String(b.id || ''));
    if (!o) return json(res, 404, { error: 'Заказ не найден' });
    await store.log(who, 'скопировал ссылку заказа', orders.shortId(o));
    return json(res, 200, { link: `${config.publicUrl}/o/${o.token}` });
  }

  return json(res, 404, { error: 'Нет такого действия' });
}

// ---------- покупки на сайте ----------
const ipHits = new Map();
function limited(key, max, ms) {
  const now = Date.now();
  const list = (ipHits.get(key) || []).filter(t => now - t < ms);
  if (list.length >= max) { ipHits.set(key, list); return true; }
  list.push(now); ipHits.set(key, list);
  return false;
}

async function publicApi(req, res, p) {
  const ip = clientIp(req);
  if (p === '/api/yookassa' && req.method === 'POST') {
    // уведомление ЮKassa: статус всегда перепроверяем запросом к API
    try { await orders.webhook(await readJson(req)); } catch (e) { console.error('webhook', e.message); }
    return json(res, 200, { ok: true });
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (req.headers['x-lf'] !== '1') return json(res, 403, { error: 'Запрос отклонён' });
  const origin = req.headers.origin;
  if (origin && new URL(origin).host !== req.headers.host) return json(res, 403, { error: 'Запрос с чужого сайта' });
  if (p === '/api/order') {
    if (limited('o' + ip, 20, 3600e3)) return json(res, 429, { error: 'Слишком много попыток. Попробуйте через час.' });
    const b = await readJson(req);
    if (b.offer !== true) return json(res, 422, { error: 'Нужно принять условия оферты' });
    try {
      const r = await orders.create({ sku: String(b.sku || ''), email: b.email, news: b.news === true, ip });
      if (!r.confirmationUrl) return json(res, 502, { error: 'ЮKassa не вернула страницу оплаты. Попробуйте ещё раз.' });
      return json(res, 200, { url: r.confirmationUrl });
    } catch (e) {
      if (e.status) return json(res, e.status, { error: e.message });
      console.error('order create', e.message);
      return json(res, 502, { error: 'Не удалось создать платёж. Попробуйте через минуту.' });
    }
  }
  if (p === '/api/restore') {
    if (limited('r' + ip, 5, 3600e3)) return json(res, 429, { error: 'Слишком много запросов. Попробуйте через час.' });
    const b = await readJson(req);
    if (!orders.EMAIL_RE.test(String(b.email || '').trim())) return json(res, 422, { error: 'Проверьте адрес почты' });
    await orders.restore(b.email);
    return json(res, 200, { ok: true });
  }
  return json(res, 404, { error: 'Нет такого действия' });
}

let orderTpl = null;
async function orderRoute(req, res, m) {
  if (req.method !== 'GET') return send(res, 405, 'Method not allowed');
  let o = await orders.byToken(m[1]);
  if (!o) return html(res, 404, message('Заказ не найден', 'Проверьте ссылку из письма или <a href="/my">запросите ссылки заново</a>.'), { robots: false });
  if (o.status === 'pending' && (!o.checked_at || Date.now() - new Date(o.checked_at) > 3000)) {
    try { o = await orders.sync(o); } catch (e) { console.error('order sync', e.message); }
  }
  const { ready, waiting } = orders.lessonsOf(o);
  if (m[2]) {
    if (o.status !== 'paid') return html(res, 403, message('Заказ не оплачен', 'Файлы будут доступны после оплаты.'), { robots: false });
    const l = ready.find(x => x.sku === m[2]);
    if (!l) return html(res, 404, message('Урок ещё не вышел', 'Мы пришлём письмо, когда он появится.'), { robots: false });
    await orders.opened(o);
    const fname = encodeURIComponent((l.fileName || l.sku));
    if (m[3] === 'teacher.pdf') {
      if (!l.files.pdf) return html(res, 404, message('Нет PDF', 'У этого урока нет PDF.'), { robots: false });
      const pdf = await delivery.personalPdf(l, null, orders.pdfLabel(o));
      return send(res, 200, pdf, { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename*=UTF-8''${fname}_Teacher.pdf`, 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex' });
    }
    const body = await delivery.personalHtml(l, null, orders.label(o));
    if (m[3] === 'view') return html(res, 200, body, { csp: CSP_LESSON, robots: false, cache: 'private, no-store' });
    return send(res, 200, body, { 'content-type': 'text/html; charset=utf-8', 'content-disposition': `attachment; filename*=UTF-8''${fname}.html`, 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex', 'content-security-policy': CSP_LESSON });
  }
  if (!orderTpl || process.env.NODE_ENV === 'development') orderTpl = fs.readFileSync(path.join(WEB, 'order.html'), 'utf8');
  const data = {
    id: orders.shortId(o), status: o.status, email: o.email || o.tg_name || 'Telegram', title: o.title, amount: o.amount_rub,
    paidAt: o.paid_at, token: o.token, mailOk: !!o.emailed_at, mail: config.mailEnabled,
    ready: ready.map(l => ({ sku: l.sku, title: orders.productTitle(l), pdf: !!(l.files && l.files.pdf), meta: l.meta || [] })),
    waiting: waiting.map(l => ({ title: orders.productTitle(l) }))
  };
  return html(res, 200, orderTpl.replace('/*ORDER*/null', () => JSON.stringify(data).replace(/</g, '\\u003c')), { robots: false, cache: 'no-store' });
}

// ---------- сервер ----------
// Обработчик запросов: годится и для своего http-сервера, и для встраивания в Express
function createHandler(hooks = {}) {
  return async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      const p = url.pathname;

      if (p === '/health') return send(res, 200, 'ok', { 'content-type': 'text/plain' });
      if (p.startsWith('/admin/api/')) return await adminApi(req, res, url, hooks);

      if (p.startsWith('/api/')) return await publicApi(req, res, p);
      const ord = p.match(/^\/o\/([A-Za-z0-9_-]{20,64})(?:\/([a-z0-9-]{2,41})\/(lesson\.html|view|teacher\.pdf))?$/);
      if (ord) return await orderRoute(req, res, ord);

      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');

      if (STATIC[p]) {
        const [file, type] = STATIC[p];
        const body = fs.readFileSync(path.join(WEB, file));
        if (p === '/admin') return html(res, 200, body, { robots: false, cache: 'no-store' });
        return send(res, 200, body, { 'content-type': type, 'cache-control': 'public, max-age=604800' });
      }

      if (p === '/' || p === '/offer' || p === '/privacy' || p === '/seller' || p === '/my' || p === '/consent') {
        const view = p === '/' ? 'home' : p.slice(1);
        return html(res, 200, sitePage(await siteData(view)));
      }

      if (p === '/robots.txt') {
        return send(res, 200, `User-agent: *\nDisallow: /admin\nDisallow: /l/\nDisallow: /f/\nDisallow: /o/\nSitemap: ${config.publicUrl}/sitemap.xml\n`, { 'content-type': 'text/plain' });
      }
      if (p === '/sitemap.xml') {
        const urls = ['/', '/offer', '/privacy', '/seller', '/my'].map(u => `<url><loc>${config.publicUrl}${u}</loc></url>`).join('');
        return send(res, 200, `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, { 'content-type': 'application/xml' });
      }

      // Скриншоты уроков: публичны только файлы shot/
      const fm = p.match(/^\/f\/(shot\/[a-z0-9-]+\/[a-z0-9-]+)$/);
      if (fm) {
        const f = await store.getFile(fm[1]);
        if (!f) return send(res, 404, 'Not found');
        if (req.headers['if-none-match'] === `"${f.sha}"`) return send(res, 304, '');
        return send(res, 200, f.data, { 'content-type': f.mime, etag: `"${f.sha}"`, 'cache-control': 'public, max-age=86400' });
      }

      // Бесплатный урок целиком
      const dm = p.match(/^\/demo\/([a-z0-9-]{2,41})$/);
      if (dm) {
        const prod = catalog.product(dm[1]);
        if (!prod || !prod.free || prod.status !== 'available' || prod.type !== 'lesson') return html(res, 404, message('Не найдено', 'Такого бесплатного урока нет.'));
        return html(res, 200, await delivery.personalHtml(prod, null, 'бесплатная версия с сайта'), { csp: CSP_LESSON, cache: 'public, max-age=600' });
      }

      // Личная ссылка покупателя
      const m = p.match(/^\/l\/([A-Za-z0-9_-]{8,64})$/);
      if (m) {
        const link = await db.resolveLink(m[1]);
        const prod = link && catalog.product(link.sku);
        if (!link || !prod) return html(res, 404, message('Ссылка не найдена', 'Проверьте ссылку или получите новую в боте: «Мои уроки».'), { robots: false });
        if (prod.status !== 'available') return html(res, 410, message('Урок недоступен', 'Этот урок временно недоступен.'), { robots: false });
        return html(res, 200, await delivery.personalHtml(prod, { id: Number(link.user_id), username: link.username }), { csp: CSP_LESSON, robots: false, cache: 'private, no-store' });
      }

      return html(res, 404, message('Не найдено', 'Такой страницы нет.'));
    } catch (e) {
      console.error('web error', e.message);
      if (res.headersSent) return res.end();
      if (String(req.url).startsWith('/admin/api/')) return json(res, e.status || 500, { error: e.status ? e.message : 'Ошибка сервера' });
      return html(res, 500, message('Ошибка', 'Попробуйте обновить страницу через минуту.'));
    }
  };
}

function createServer(hooks = {}) {
  return http.createServer(createHandler(hooks));
}

module.exports = { createServer, createHandler, siteData, sitePage };
