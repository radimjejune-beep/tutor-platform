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
app.use(helmet());
app.use(express.json({ limit: '200kb' }));

// CORS: только адреса из FRONTEND_ORIGINS (через запятую)
const origins = (process.env.FRONTEND_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: (origin, cb) => cb(null, !origin || origins.includes(origin)),
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

// Всё остальное — только после входа и смены временного пароля
const protectedApi = express.Router();
protectedApi.use(authenticate, requirePasswordChanged);
protectedApi.use('/dashboard', require('./routes/dashboard'));
protectedApi.use('/students', require('./routes/students'));
protectedApi.use('/accounts', require('./routes/accounts'));
protectedApi.use('/lessons', require('./routes/lessons'));
protectedApi.use('/finance', require('./routes/finance'));
protectedApi.use('/homework', require('./routes/homework'));
protectedApi.use('/progress', require('./routes/progress'));
app.use('/api', protectedApi);

app.use('/api', (req, res) => res.status(404).json({ error: 'Не найдено' }));

// Общий обработчик ошибок: подробности — в лог, пользователю — короткое сообщение
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Некорректный JSON' });
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(`❌ ${req.method} ${req.originalUrl}:`, err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

const PORT = Number(process.env.PORT) || 3001;
if (require.main === module) {
  app.listen(PORT, () => console.log(`✅ API запущен на порту ${PORT}`));
}

module.exports = app;
