'use strict';
// Встраивание Lessonfold (сайт магазина, админка, оплата ЮKassa, Telegram-бот) в другое приложение
// на Node.js с Express, например в бэкенд платформы репетитора. Один процесс, одна база.
//
//   const lessonfold = require('../lessonfold/src/embed');
//   app.use(lessonfold.middleware());   // до express.json() и helmet()
//   app.listen(PORT, () => lessonfold.start());
//
// Включается, только если задан LF_PUBLIC_URL. Настройки магазина берутся из переменных с префиксом LF_
// (LF_BOT_TOKEN, LF_ADMIN_LOGIN, LF_YOOKASSA_SHOP_ID...). База: LF_DATABASE_URL или общая DATABASE_URL,
// таблицы магазина лежат в отдельной схеме (по умолчанию lessonfold), чтобы не пересекаться с таблицами приложения.
if (!process.env['LF_DB_SCHEMA'] && !process.env['DB_SCHEMA']) process.env['LF_DB_SCHEMA'] = 'lessonfold';

const enabled = Boolean(process.env['LF_PUBLIC_URL']);
// Адреса /api/*, которые принадлежат магазину; остальные /api/* остаются приложению
const OWN_API = new Set(['/api/order', '/api/yookassa', '/api/restore']);

let handler = null;
let starting = null;
let failure = '';   // почему магазин не запустился (показываем на странице, без секретов)
let retryTimer = null;

function middleware() {
  return (req, res, next) => {
    if (!enabled) return next();
    const p = req.path || new URL(req.url, 'http://x').pathname;
    if (p.startsWith('/api/') && !OWN_API.has(p)) return next();
    if (!handler) {
      res.statusCode = 503;
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      res.setHeader('retry-after', '30');
      if (p === '/health') return res.end('shop: ' + (failure ? 'error' : 'starting'));
      return res.end(failure
        ? 'Магазин не запустился: ' + failure + '\nПлатформа репетитора при этом работает. Следующая попытка запуска через минуту.'
        : 'Магазин запускается, обновите страницу через несколько секунд.');
    }
    return handler(req, res);
  };
}

// Запустить магазин и бота. Ошибка магазина не роняет приложение: она пишется в лог.
function start() {
  if (!enabled) return Promise.resolve(false);
  if (starting) return starting;
  // Ошибка загрузки кода магазина (например, не установлен pdf-lib) не должна ронять платформу
  let app, createHandler;
  try {
    app = require('./index');
    ({ createHandler } = require('./web'));
  } catch (e) {
    failure = 'не загрузился код магазина: ' + String(e.message || e).split('\n')[0].slice(0, 200);
    console.error('Lessonfold не запустился:', failure);
    return Promise.resolve(false);
  }
  starting = app.init()
    .then(({ hooks }) => {
      handler = createHandler(hooks);
      app.background();
      console.log('Lessonfold: ' + app.startedLine());
      return true;
    })
    .catch(e => {
      failure = String(e.message || e).replace(/bot\d+:[\w-]+/g, 'bot***').slice(0, 300);
      console.error('Lessonfold не запустился:', failure);
      starting = null;
      // Пробуем снова через минуту: например, база или Telegram были недоступны
      if (!retryTimer) retryTimer = setTimeout(() => { retryTimer = null; start(); }, 60000);
      if (retryTimer.unref) retryTimer.unref();
      return false;
    });
  return starting;
}

// Витрина для других страниц (например, главной платформы до входа): уроки, курсы и ссылки на покупку
async function publicData() {
  if (!enabled || !handler) return null;
  const { config } = require('./config');
  const { siteData } = require('./web');
  const d = await siteData('home');
  const abs = (u) => (u && u.startsWith('/') ? config.publicUrl + u : u);
  return {
    shop_url: config.publicUrl,
    bot: d.bot || '',
    pay: Boolean(d.pay),
    channel: d.channel || '',
    textbooks: d.textbooks,
    products: d.products.map((p) => ({ ...p, demo: abs(p.demo), shots: p.shots.map((s) => ({ ...s, src: abs(s.src) })) })),
  };
}

// Одноразовая ссылка входа в админку магазина для сисадмина платформы
function adminLink(login) {
  if (!enabled || !handler) return null;
  const { config } = require('./config');
  return `${config.publicUrl}/admin/sso?code=${require('./sso').issue(login)}`;
}

// Права сисадмина сняты: убираем его из админов магазина, его входы в админку закрываются
async function revokeAdmin(login) {
  if (!enabled || !handler) return false;
  const store = require('./store');
  const name = String(login || '').toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 32);
  await store.deleteAdmin(name);
  await store.log('платформа', 'удалён админ (сняты права сисадмина)', name);
  return true;
}

module.exports = { middleware, start, enabled, publicData, adminLink, revokeAdmin };
