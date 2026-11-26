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

let workers=[];
function periodic(){
  workers.push(require('./worker').startWorker({name:'payments',interval:60*1000,tasks:[
    ()=>config.payEnabled?orders.syncStale():0,
    ()=>config.payEnabled?require('./commerce').renewDue():0
  ]}));
  workers.push(require('./worker').startWorker({name:'releases',interval:15*60*1000,tasks:[()=>orders.releases()]}));
  workers.push(require('./worker').startWorker({name:'telegram',interval:15*60*1000,tasks:[
    ()=>config.botEnabled?bot.syncReleases():0,()=>config.botEnabled?bot.runFollowups():0
  ]}));
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
    // Если Telegram недоступен или токен неверный, сайт магазина всё равно запускается, а бот выключается
    let me = null;
    try { me = await tg.call('getMe'); } catch (e) {
      console.error('Lessonfold: бот не подключился (' + String(e.message || e).replace(/bot\d+:[\w-]+/g, 'bot***') + '). Сайт работает без бота. Проверьте LF_BOT_TOKEN.');
      config.botEnabled = false;
    }
  }
  if (config.botEnabled) {
    const me = await tg.call('getMe');
    config.botUsername = me.username;
    await tg.call('deleteWebhook', { drop_pending_updates: false });
    await tg.call('setMyCommands', {
      commands: [
        { command: 'start', description: 'Главное меню' },
        { command: 'free', description: 'Бесплатный урок' },
        { command: 'catalog', description: 'Каталог уроков' },
        { command: 'courses', description: 'Курсы на учебный год' },
        { command: 'mine', description: 'Мои уроки' },
        { command: 'help', description: 'Как открыть урок' }
      ]
    }).catch(e => console.error('setMyCommands', e.message));
    orders.onTgPaid(bot.onOrderPaid);
  }
  const afterPublish = async () => {
    const results=await Promise.allSettled([orders.releases(),config.botEnabled?bot.syncReleases():Promise.resolve()]);for(const result of results)if(result.status==='rejected')console.error('release after publish',result.reason.message);
  };
  return { hooks: { onCatalogChange: afterPublish } };
}

const startedLine = () => `${config.botEnabled ? '@' + config.botUsername : 'Сайт без бота'} запущен, адрес: ${config.publicUrl}; оплата на сайте: ${config.payEnabled ? 'включена' : 'выключена'}; почта: ${config.mailEnabled ? 'настроена' : 'не настроена'}`;

// Фоновые задачи: периодические проверки и чтение сообщений бота
function background() {
  if(workers.length)return;
  stopping=false;periodic();
  workers.push(require('./worker').startWorker({name:'mail queue',interval:60*1000,tasks:[()=>require('./mail-queue').flush()]}));
  if (config.botEnabled) poll().catch(e => console.error('poll stopped', e.message));
}

function stop(){stopping=true;for(const worker of workers)worker.stop();workers=[];}

async function main() {
  const { hooks } = await init();
  const server = createServer(hooks);
  server.listen(config.port, config.host, () => console.log(`${startedLine()}; веб на порту ${config.port}`));
  background();
  const shutdown = async () => {
    stop();
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
