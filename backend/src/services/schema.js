// services/schema.js — таблицы, которые создаются кодом (а не SQL-миграциями), в одном месте.
// Вызывается при запуске сервера и перед восстановлением из копии, чтобы схема была полной.
async function ensureAll() {
  const steps = [
    ['plans', () => require('./plans').ensure()],
    ['platform-terms', () => require('../routes/platformDocs').ensure()],
    ['folders', () => require('./folders').ensure()],
    ['books', () => require('../routes/books').ensure()],
    ['storage', () => require('./storage').ensure()],
    ['bank', () => require('./bank').ensure()],
    ['set-sync', () => require('./setsync').ensure()],
    ['reminders', () => require('./reminders').ensure()],
    ['pronounce', () => require('../routes/pronounce').ensure()],
    ['trial', () => require('./trial').ensure()],
    ['demo', () => require('../routes/demo').ensure()],
  ];
  for (const [name, fn] of steps) {
    try { await fn(); } catch (err) { console.error(`⚠️ Схема «${name}»: ${err.message}`); throw err; }
  }
}
module.exports = { ensureAll };
