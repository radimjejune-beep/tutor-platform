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
const BIG_BODY = ['/api/files', '/api/library', '/api/learning', '/api/marketplace'];
// Сравнение по целому сегменту пути: /api/library-folders и /api/library-books сюда не попадают
app.use((req, res, next) => (BIG_BODY.some((p) => req.path === p || req.path.startsWith(`${p}/`)) ? next() : smallJson(req, res, next)));

// CORS: только адреса из FRONTEND_ORIGINS (через запятую).
// Разрешаем только точные адреса. Другие клиенты общего хостинга не являются нашими сайтами.
const origins = require('./middleware/cors').allowedOrigins();
app.use(
  cors({
    origin: (origin, cb) => cb(null, !origin || origins.includes(origin)),
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
app.use('/api/marketplace/public', require('./routes/marketplace').publicRouter);
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

// Обособленные упражнения по ссылке, без сессии преподавателя.
app.use('/api/activities', require('express-rate-limit')({windowMs:60*1000,limit:240,standardHeaders:true,legacyHeaders:false,message:{error:'Слишком много запросов. Попробуйте через минуту'}}), require('./routes/activities').publicRouter);

// Всё остальное — только после входа и смены временного пароля
const protectedApi = express.Router();
protectedApi.use(authenticate, requirePasswordChanged);
protectedApi.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });

// Ограничения частоты: общий потолок на пользователя и отдельные для тяжёлых действий
const rateLimit = require('express-rate-limit');
const limiter = (windowMin, limit, error) => rateLimit({
  windowMs: windowMin * 60 * 1000, limit, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => (req.user ? `u${req.user.id}` : req.ip), message: { error },
});
protectedApi.use(limiter(5, 1500, 'Слишком много запросов, подождите пару минут'));
// Independent learners never inherit teacher APIs through a null tutor_id.
protectedApi.use((req,res,next)=>req.user.role!=='learner'||['/marketplace','/billing','/platform-terms'].some(p=>req.path===p||req.path.startsWith(p+'/'))?next():res.status(403).json({error:'Этот раздел доступен в кабинете преподавателя или его ученика'}));
protectedApi.use(require('./services/guardians').middleware);
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
protectedApi.use('/activity-links', require('./routes/activities').router);
protectedApi.use('/learning', require('./routes/learning'));
protectedApi.use('/live', require('./routes/live'));
protectedApi.use('/study', require('./routes/study-subjects'));
protectedApi.use('/expedition', require('./routes/expedition'));
protectedApi.use('/coaching', require('./routes/coaching'));
protectedApi.use('/progress', require('./routes/language-progress'));
protectedApi.use('/supplementary-courses', require('./routes/supplementary-courses'));
protectedApi.use('/progress', require('./routes/progress'));
protectedApi.use('/courses', require('./routes/courses'));
protectedApi.use('/vocab', require('./routes/vocab'));
protectedApi.use('/notifications', require('./routes/notifications'));
protectedApi.use('/groups', require('./routes/groups'));
protectedApi.use('/admin', require('./routes/admin'));
protectedApi.use('/motivation', require('./routes/motivation'));
protectedApi.use('/leads', require('./routes/leads').router);
protectedApi.use('/marketplace', require('./routes/marketplace').router);
protectedApi.use('/billing', require('./routes/payments'));
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
  if (res.headersSent) return next(err);
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Некорректный JSON' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Слишком большой файл (до 10 МБ)' });
  if (err instanceof require('./services/s3').S3Error) {
    console.error(`❌ Хранилище: ${err.message}; попыток: ${err.attempts}`);
    require('./services/monitor').capture(err, { where: `${req.method} ${req.originalUrl.split('?')[0]}` });
    // Download routes may already have selected PDF/image headers before reading S3.
    res.removeHeader('Content-Disposition');
    res.type('application/json');
    if (err.retryable) res.set('Retry-After', '5');
    const action = err.method === 'PUT' ? 'загрузить' : 'открыть';
    return res.status(err.retryable ? 503 : 502).json({
      code: err.retryable ? 'STORAGE_UNAVAILABLE' : 'STORAGE_ERROR',
      error: err.retryable
        ? `Не удалось ${action} файл: хранилище временно недоступно. Попробуйте ещё раз через минуту.`
        : `Не удалось ${action} файл из-за ошибки хранилища. Обратитесь в поддержку Lessonfold.`,
    });
  }
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(`❌ ${req.method} ${req.originalUrl}:`, err);
  require('./services/monitor').capture(err, { where: `${req.method} ${req.originalUrl.split('?')[0]}` });
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

const PORT = Number(process.env['PORT']) || 3001;
async function start() {
  require('./services/monitor').install();
  // Не принимаем запросы и не запускаем ботов, пока схема не готова.
  await require('./services/migrate').migrate();
  await require('./services/schema').ensureAll();
  const server = await new Promise((resolve, reject) => {
    const listener = app.listen(PORT, () => resolve(listener));
    listener.once('error', reject);
  });
  console.log(`✅ API запущен на порту ${PORT}`);
  require('./services/telegram').start();
  require('./services/reminders').start();
  require('./services/autoclose').start();
  require('./services/bank').start();
  require('./services/folders').start();
  require('./services/backup').start();
  require('./services/trial').start();
  require('./services/storage').start();
  require('./services/hwnudge').start();
  require('./routes/sandbox').start();
  lessonfold.start();
  return server;
}
if (require.main === module) {
  start().catch(async (err) => {
    console.error('❌ API не запущен:', err.message);
    require('./services/monitor').capture(err, { where: 'запуск' });
    await pool.end().catch(() => {});
    process.exitCode = 1;
  });
}

module.exports = app;
module.exports.start = start;
