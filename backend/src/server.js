// server.js — точка входа API платформы репетитора
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { pool } = require('./db');
const { authenticate, requirePasswordChanged } = require('./middleware/auth');

// Без секрета для токенов запускаться нельзя
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('❌ JWT_SECRET не задан или короче 32 символов — см. .env.example');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL не задан — см. .env.example');
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // хостинг стоит за прокси — нужно для ограничения попыток входа

// Магазин уроков Lessonfold: сайт, админка /admin, оплата ЮKassa и Telegram-бот.
// Включается переменной LF_PUBLIC_URL (см. lessonfold/README.md). Подключается до helmet и express.json:
// магазин сам разбирает запросы и ставит свои заголовки. Адреса /api/* остаются платформе,
// кроме /api/order, /api/yookassa и /api/restore.
const lessonfold = require('../lessonfold/src/embed');
app.use(lessonfold.middleware());
app.use(helmet());
// Обычные запросы — до 200 КБ; загрузка файлов (/api/files) разбирается отдельно, до 15 МБ
const smallJson = express.json({ limit: '200kb' });
// Большие запросы разбираются в своих маршрутах: файлы (до 15 МБ) и импорт библиотеки (до 2 МБ)
const BIG_BODY = ['/api/files', '/api/library'];
// Сравнение по целому сегменту пути: /api/library-folders и /api/library-books сюда не попадают
app.use((req, res, next) => (BIG_BODY.some((p) => req.path === p || req.path.startsWith(`${p}/`)) ? next() : smallJson(req, res, next)));

// CORS: только адреса из FRONTEND_ORIGINS (через запятую).
// Пока FRONTEND_ORIGINS не задан, для первого запуска пускаем любые https://….relaxdev.ru.
// Это адреса и других клиентов хостинга, поэтому в работе задайте FRONTEND_ORIGINS (адрес фронтенда и свой домен).
const origins = String(process.env['FRONTEND_ORIGINS'] || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim().replace(/\/$/, ''))
  .filter((s) => /^https?:\/\//.test(s));
// Свой домен платформы пускаем всегда, чтобы переезд на него не зависел от переменных
origins.push('https://lessonfold.ru', 'https://www.lessonfold.ru');
const RELAXDEV = process.env['FRONTEND_ORIGINS'] ? null : /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.relaxdev\.ru$/i;
if (RELAXDEV) console.log('⚠️ FRONTEND_ORIGINS не задан: API открыт для любых *.relaxdev.ru. Задайте адрес своего фронтенда.');
app.use(
  cors({
    origin: (origin, cb) => cb(null, !origin || origins.includes(origin) || Boolean(RELAXDEV && RELAXDEV.test(origin))),
  })
);

// Проверка, что сервер и база живы
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    const b = await require('./services/backup').state().catch(() => null);
    // backup_age_h: сколько часов назад была последняя удачная копия (для внешней проверки доступности)
    res.json({ ok: true, uptime_s: Math.round(process.uptime()), backup_age_h: b?.ok ? Math.round((Date.now() - new Date(b.at)) / 36e5) : null });
  } catch {
    res.status(503).json({ ok: false });
  }
});

// Вход и смена пароля — без проверки «временный пароль сменён»
app.use('/api/auth', require('./routes/auth'));

// Юридические документы открыты всем (ссылки со страницы входа)
app.use('/api/legal/public', require('./routes/legal').publicRouter);
app.use('/api/platform-docs', require('./routes/platformDocs').publicRouter);
// Тестовый кабинет без регистрации (ссылка /#/try)
app.use('/api/sandbox', require('./routes/sandbox').publicRouter);
// Страница записи для новых учеников — тоже без входа
app.use('/api/public', require('./routes/leads').publicRouter);
// Тарифы для главной страницы
app.use('/api/plans', require('./routes/plans').publicRouter);
// Витрина уроков для главной страницы до входа (берётся из магазина Lessonfold, если он включён)
// Сисадмин платформы открывает админку магазина без отдельного пароля
app.post('/api/shop/admin-link', express.json(), authenticate, requirePasswordChanged, (req, res) => {
  if (req.user.role !== 'tutor' || !req.user.is_admin) return res.status(403).json({ error: 'Недостаточно прав' });
  const url = lessonfold.adminLink(req.user.login);
  if (!url) return res.status(503).json({ error: 'Магазин сейчас не запущен' });
  console.log(`Вход в админку магазина: ${req.user.login}`);
  res.json({ url });
});

app.get('/api/shop', async (req, res) => {
  try {
    const data = await lessonfold.publicData();
    res.set('Cache-Control', 'public, max-age=60');
    res.json(data ? { enabled: true, ...data } : { enabled: false, products: [], textbooks: [] });
  } catch (err) {
    console.error('Витрина:', err.message);
    res.json({ enabled: false, products: [], textbooks: [] });
  }
});

// Всё остальное — только после входа и смены временного пароля
const protectedApi = express.Router();
protectedApi.use(authenticate, requirePasswordChanged);

// Ограничения частоты: общий потолок на пользователя и отдельные для тяжёлых действий
const rateLimit = require('express-rate-limit');
const limiter = (windowMin, limit, error) => rateLimit({
  windowMs: windowMin * 60 * 1000, limit, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => (req.user ? `u${req.user.id}` : req.ip), message: { error },
});
protectedApi.use(limiter(5, 1500, 'Слишком много запросов, подождите пару минут'));
protectedApi.use('/pronounce', limiter(1, 120, 'Слишком часто, подождите минуту'));
protectedApi.use('/files', limiter(10, 120, 'Слишком много загрузок, подождите 10 минут'));
protectedApi.use('/library-books', limiter(10, 400, 'Слишком много загрузок, подождите 10 минут'));
protectedApi.use('/plan/request', limiter(60, 10, 'Слишком много заявок, попробуйте через час'));
protectedApi.use('/dashboard', require('./routes/dashboard'));
protectedApi.use('/students', require('./routes/students'));
protectedApi.use('/accounts', require('./routes/accounts'));
protectedApi.use('/lessons', require('./routes/lessons'));
protectedApi.use('/finance', require('./routes/finance'));
protectedApi.use('/homework', require('./routes/homework'));
protectedApi.use('/assignments', require('./routes/assignments'));
protectedApi.use('/files', require('./routes/files'));
protectedApi.use('/booking', require('./routes/booking'));
protectedApi.use('/library', require('./routes/library').router);
protectedApi.use('/telegram', require('./routes/telegram'));
protectedApi.use('/games', require('./routes/games'));
protectedApi.use('/legal', require('./routes/legal').protectedRouter);
protectedApi.use('/progress', require('./routes/progress'));
protectedApi.use('/courses', require('./routes/courses'));
protectedApi.use('/vocab', require('./routes/vocab'));
protectedApi.use('/notifications', require('./routes/notifications'));
protectedApi.use('/groups', require('./routes/groups'));
protectedApi.use('/admin', require('./routes/admin'));
protectedApi.use('/motivation', require('./routes/motivation'));
protectedApi.use('/leads', require('./routes/leads').router);
protectedApi.use('/market', require('./routes/market'));
protectedApi.use('/wordsets', require('./routes/wordsets'));
protectedApi.use('/announcements', require('./routes/announcements'));
protectedApi.use('/bank', require('./routes/bank'));
protectedApi.use('/library-folders', require('./routes/folders'));
protectedApi.use('/library-books', require('./routes/books'));
protectedApi.use('/plan', require('./routes/plans').router);
protectedApi.use('/pronounce', require('./routes/pronounce'));
protectedApi.use('/demo', require('./routes/demo'));
protectedApi.use('/sandbox', require('./routes/sandbox').router);
protectedApi.use('/platform-terms', require('./routes/platformDocs').protectedRouter);
app.use('/api', protectedApi);

app.use('/api', (req, res) => res.status(404).json({ error: 'Не найдено' }));

// Общий обработчик ошибок: подробности — в лог, пользователю — короткое сообщение
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Некорректный JSON' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Слишком большой файл (до 10 МБ)' });
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(`❌ ${req.method} ${req.originalUrl}:`, err);
  require('./services/monitor').capture(err, { where: `${req.method} ${req.originalUrl.split('?')[0]}` });
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

const PORT = Number(process.env['PORT']) || 3001;
if (require.main === module) {
  require('./services/monitor').install();
  app.listen(PORT, () => console.log(`✅ API запущен на порту ${PORT}`));
  require('./services/telegram').start();
  require('./services/reminders').start();
  require('./services/autoclose').start();
  require('./services/bank').start();
  require('./services/folders').start();
  require('./services/migrate').migrate()
    .then(() => require('./services/schema').ensureAll())
    .catch((err) => { console.error('❌ Схема базы не обновилась:', err.message); require('./services/monitor').capture(err, { where: 'миграции' }); });
  require('./services/backup').start();
  require('./services/trial').start();
  require('./services/storage').start();
  require('./services/hwnudge').start();
  require('./routes/sandbox').start();
  lessonfold.start();
}

module.exports = app;
