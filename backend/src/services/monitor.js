// services/monitor.js — ошибки сервера: журнал последних и сообщение сисадмину.
// Сисадмин видит последние ошибки в разделе «Учителя → Состояние» и получает сообщение в Telegram
// (одинаковые ошибки не чаще раза в 30 минут). Пользователю показывается короткий текст без подробностей.
const LIMIT = 30;
const list = [];

function capture(err, ctx = {}) {
  const item = {
    at: new Date().toISOString(),
    message: String(err?.message || err).slice(0, 300),
    where: ctx.where || null,
    stack: String(err?.stack || '').split('\n').slice(1, 4).map((s) => s.trim()).join(' | ').slice(0, 400),
  };
  list.unshift(item);
  list.length = Math.min(list.length, LIMIT);
  require('./alerts')
    .toAdmins('Ошибка на сервере', `${item.where ? `${item.where}\n` : ''}${item.message}`, { key: `err:${item.where}:${item.message}`.slice(0, 200) })
    .catch(() => {});
}

const recent = () => list.slice(0, 15);

let installed = false;
function install() {
  if (installed) return;
  installed = true;
  process.on('unhandledRejection', (err) => { console.error('❌ Необработанная ошибка (promise):', err); capture(err, { where: 'фоновая задача' }); });
  process.on('uncaughtException', (err) => { console.error('❌ Необработанная ошибка:', err); capture(err, { where: 'процесс' }); });
}

module.exports = { capture, recent, install };
