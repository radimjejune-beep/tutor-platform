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
app.use((req, res, next) => (BIG_BODY.some((p) => req.path.startsWith(p)) ? next() : smallJson(req, res, next)));

// CORS: только адреса из FRONTEND_ORIGINS (через запятую)
// Плюс любые адреса вида https://что-то.relaxdev.ru: фронтенд на RelaxDev работает без настройки.
// Вход по токену в заголовке (не cookie), поэтому это безопасно.
const origins = String(process.env['FRONTEND_ORIGINS'] || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim().replace(/\/$/, ''))
  .filter((s) => /^https?:\/\//.test(s));
const RELAXDEV = /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.relaxdev\.ru$/i;
app.use(
  cors({
    origin: (origin, cb) => cb(null, !origin || origins.includes(origin) || RELAXDEV.test(origin)),
  })
);

// Проверка, что сервер и база живы
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});

// Вход и смена пароля — без проверки «временный пароль сменён»
app.use('/api/auth', require('./routes/auth'));

// Юридические документы открыты всем (ссылки со страницы входа)
app.use('/api/legal/public', require('./routes/legal').publicRouter);
// Страница записи для новых учеников — тоже без входа
app.use('/api/public', require('./routes/leads').publicRouter);
// Витрина уроков для главной страницы до входа (берётся из магазина Lessonfold, если он включён)
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
app.use('/api', protectedApi);

app.use('/api', (req, res) => res.status(404).json({ error: 'Не найдено' }));

// Общий обработчик ошибок: подробности — в лог, пользователю — короткое сообщение
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Некорректный JSON' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Слишком большой файл (до 10 МБ)' });
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(`❌ ${req.method} ${req.originalUrl}:`, err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

const PORT = Number(process.env['PORT']) || 3001;
if (require.main === module) {
  app.listen(PORT, () => console.log(`✅ API запущен на порту ${PORT}`));
  require('./services/telegram').start();
  lessonfold.start();
}

module.exports = app;
