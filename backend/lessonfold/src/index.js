'use strict';
const { config, checkConfig } = require('./config');
const tg = require('./telegram');
const db = require('./db');
const catalog = require('./catalog');
const bot = require('./bot');
const store = require('./store');
const orders = require('./orders');
const { createServer } = require('./web');

const sleep = ms => new Promise(r => setTimeout(r, ms));
let stopping = false;

async function poll() {
  let offset = Number(await db.kvGet('update_offset')) || 0;
  while (!stopping) {
    let updates = [];
    try {
      updates = await tg.call('getUpdates', {
        offset, timeout: config.pollTimeout,
        allowed_updates: ['message', 'callback_query']
      });
    } catch (e) {
      if (e.code === 409) console.error('Другой экземпляр бота уже читает обновления (409). Остановите его или удалите webhook.');
      else console.error('getUpdates failed:', e.message);
      await sleep(3000);
      continue;
    }
    for (const u of updates) {
      await bot.handleUpdate(u);
      offset = u.update_id + 1;
      await db.kvSet('update_offset', offset);
    }
  }
}

async function periodic() {
  const run = async () => {
    try {
      const r = config.botEnabled ? await bot.syncReleases() : 0;
      const f = config.botEnabled ? await bot.runFollowups() : 0;
      const s = config.payEnabled ? await orders.syncStale() : 0;
      const w = await orders.releases();
      if (r || f || s || w) console.log(`periodic: бот выдал уроков ${r}, напоминаний ${f}; сайт: подтверждено оплат ${s}, писем о выходе ${w}`);
    } catch (e) { console.error('periodic failed', e.message); }
  };
  await run();
  setInterval(run, 15 * 60 * 1000).unref();
}

// Подготовка: миграции, каталог, бот, выдача после оплаты. Общая для отдельного запуска и встраивания.
async function init() {
  checkConfig();
  await db.migrate();
  await store.migrate();
  if (config.catalogMode === 'db') await catalog.loadFromDb(); else catalog.load();
  await orders.migrate();
  if (await store.ensureFirstAdmin(config.adminLogin, config.adminPassword)) console.log(`Создан первый админ сайта: ${config.adminLogin}`);
  if (config.botEnabled) {
    const me = await tg.call('getMe');
    config.botUsername = me.username;
    await tg.call('deleteWebhook', { drop_pending_updates: false });
    await tg.call('setMyCommands', {
      commands: [
        { command: 'start', description: 'Главное меню' },
        { command: 'free', description: 'Бесплатный урок' },
        { command: 'catalog', description: 'Каталог уроков' },
        { command: 'mine', description: 'Мои уроки' },
        { command: 'help', description: 'Как открыть урок' }
      ]
    }).catch(e => console.error('setMyCommands', e.message));
    orders.onTgPaid(bot.onOrderPaid);
  }
  const afterPublish = async () => {
    try { if (config.botEnabled) await bot.syncReleases(); await orders.releases(); } catch (e) { console.error('release after publish', e.message); }
  };
  return { hooks: { onCatalogChange: afterPublish } };
}

const startedLine = () => `${config.botEnabled ? '@' + config.botUsername : 'Сайт без бота'} запущен, адрес: ${config.publicUrl}; оплата на сайте: ${config.payEnabled ? 'включена' : 'выключена'}; почта: ${config.mailEnabled ? 'настроена' : 'не настроена'}`;

// Фоновые задачи: периодические проверки и чтение сообщений бота
function background() {
  periodic();
  if (config.botEnabled) poll().catch(e => console.error('poll stopped', e.message));
}

function stop() { stopping = true; }

async function main() {
  const { hooks } = await init();
  const server = createServer(hooks);
  server.listen(config.port, config.host, () => console.log(`${startedLine()}; веб на порту ${config.port}`));
  background();
  const shutdown = async () => {
    stopping = true;
    server.close();
    await db.close().catch(() => {});
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

if (require.main === module) {
  main().catch(e => { console.error(e.message); process.exit(1); });
}

module.exports = { main, init, background, stop, startedLine };
