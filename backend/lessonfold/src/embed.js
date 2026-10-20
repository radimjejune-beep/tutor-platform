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
if (!process.env.LF_DB_SCHEMA && !process.env.DB_SCHEMA) process.env.LF_DB_SCHEMA = 'lessonfold';

const enabled = Boolean(process.env.LF_PUBLIC_URL);
// Адреса /api/*, которые принадлежат магазину; остальные /api/* остаются приложению
const OWN_API = new Set(['/api/order', '/api/yookassa', '/api/restore']);

let handler = null;
let starting = null;

function middleware() {
  return (req, res, next) => {
    if (!enabled) return next();
    const p = req.path || new URL(req.url, 'http://x').pathname;
    if (p.startsWith('/api/') && !OWN_API.has(p)) return next();
    if (!handler) {
      res.statusCode = 503;
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      res.setHeader('retry-after', '5');
      return res.end('Магазин запускается, обновите страницу через несколько секунд.');
    }
    return handler(req, res);
  };
}

// Запустить магазин и бота. Ошибка магазина не роняет приложение: она пишется в лог.
function start() {
  if (!enabled) return Promise.resolve(false);
  if (starting) return starting;
  const app = require('./index');
  const { createHandler } = require('./web');
  starting = app.init()
    .then(({ hooks }) => {
      handler = createHandler(hooks);
      app.background();
      console.log('Lessonfold: ' + app.startedLine());
      return true;
    })
    .catch(e => {
      console.error('Lessonfold не запустился:', e.message);
      return false;
    });
  return starting;
}

module.exports = { middleware, start, enabled };
