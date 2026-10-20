'use strict';
const { config } = require('./config');
const tg = require('./telegram');
const db = require('./db');
const catalog = require('./catalog');
const delivery = require('./delivery');
const orders = require('./orders');

const MENU = {
  free: 'Бесплатный урок',
  catalog: 'Каталог уроков',
  mine: 'Мои уроки',
  help: 'Помощь'
};

const mainKeyboard = {
  keyboard: [[{ text: MENU.free }, { text: MENU.catalog }], [{ text: MENU.mine }, { text: MENU.help }]],
  resize_keyboard: true,
  is_persistent: true
};

const esc = delivery.escapeHtml;
const rub = n => `${n} ₽`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function send(chatId, text, extra = {}) {
  return tg.call('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra });
}

function isAdmin(id) {
  return config.adminIds.includes(Number(id));
}

function supportLine() {
  return config.supportContact ? `Вопросы и возвраты: ${esc(config.supportContact)}` : '';
}

function docsLine() {
  return `<a href="${config.publicUrl}/offer">Оферта</a> · <a href="${config.publicUrl}/privacy">Политика обработки данных</a>`;
}

// Что пользователь уже купил, включая уроки внутри пакетов
async function ownership(userId) {
  const purchases = await db.userPurchases(userId);
  const owned = new Set();
  for (const p of purchases) {
    owned.add(p.sku);
    const prod = catalog.product(p.sku);
    if (prod && prod.type === 'pack') prod.includes.forEach(s => owned.add(s));
  }
  return { purchases, owned };
}

async function notifyAdmins(text) {
  for (const id of config.adminIds) {
    try { await send(id, text); } catch (e) { console.error('admin notify failed', id, e.message); }
  }
}

// ---------- экраны ----------

async function showWelcome(chatId, from) {
  const name = from.first_name ? `, ${esc(from.first_name)}` : '';
  await send(chatId,
    `Здравствуйте${name}! Это бот <b>Lessonfold</b>: готовые интерактивные уроки английского к школьным учебникам.\n\n` +
    `Открыл файл, вывел на доску, провёл урок. В каждом уроке озвучка, игры с автопроверкой, заметки для учителя и PDF с ответами.\n\n` +
    `Начните с бесплатного урока: кнопка «${MENU.free}» внизу.\n\n` +
    `<i>Бот хранит ваш Telegram ID, имя и покупки, чтобы выдавать уроки.</i> ${docsLine()}`,
    { reply_markup: mainKeyboard });
}

async function showFree(chatId, from) {
  const free = catalog.freeProducts();
  if (!free.length) return send(chatId, 'Сейчас бесплатных уроков нет. Загляните в каталог.', { reply_markup: mainKeyboard });
  if (free.length === 1) return giveFree(chatId, from, free[0].sku);
  return send(chatId, 'Выберите бесплатный урок:', {
    reply_markup: { inline_keyboard: free.map(p => [{ text: p.title, callback_data: `get:${p.sku}` }]) }
  });
}

async function showTextbooks(chatId, messageId) {
  const tbs = catalog.get().textbooks.filter(t => t.grades.length);
  const markup = { inline_keyboard: tbs.map(t => [{ text: t.title, callback_data: `tb:${t.id}` }]) };
  const text = '<b>Каталог.</b> Выберите учебник:';
  return messageId ? edit(chatId, messageId, text, markup) : send(chatId, text, { reply_markup: markup });
}

async function showTextbook(chatId, messageId, tbId) {
  const t = catalog.textbook(tbId);
  if (!t) return showTextbooks(chatId, messageId);
  const rows = t.grades.map(g => [{ text: g.label, callback_data: `gr:${t.id}:${g.grade}` }]);
  rows.push([{ text: '← Все учебники', callback_data: 'cat' }]);
  return edit(chatId, messageId, `<b>${esc(t.title)}</b>\nВыберите класс или уровень:`, { inline_keyboard: rows });
}

async function showGrade(chatId, messageId, tbId, grade) {
  const t = catalog.textbook(tbId);
  const g = t && t.grades.find(x => String(x.grade) === String(grade));
  if (!g) return showTextbooks(chatId, messageId);
  const rows = g.modules.map(m => [{ text: m.title, callback_data: `md:${m.id}` }]);
  rows.push([{ text: '← Назад', callback_data: `tb:${t.id}` }]);
  return edit(chatId, messageId, `<b>${esc(t.title)}, ${esc(g.label)}</b>\nВыберите модуль:`, { inline_keyboard: rows });
}

function statusMark(p, owned) {
  if (owned.has(p.sku)) return '✓ ';
  if (p.status === 'soon') return 'скоро · ';
  return '';
}

function priceText(p) {
  if (p.free) return 'бесплатно';
  return p.oldPrice ? `${rub(p.price)} вместо ${rub(p.oldPrice)}` : rub(p.price);
}

async function showModule(chatId, messageId, userId, moduleId) {
  const loc = catalog.moduleById(moduleId);
  if (!loc) return showTextbooks(chatId, messageId);
  const { owned } = await ownership(userId);
  const rows = loc.module.products.map(catalog.product).filter(Boolean).map(p => [{
    text: `${statusMark(p, owned)}${p.short || p.title} · ${priceText(p)}`,
    callback_data: `p:${p.sku}`
  }]);
  rows.push([{ text: '← Назад', callback_data: `gr:${loc.textbook.id}:${loc.grade.grade}` }]);
  return edit(chatId, messageId, `<b>${esc(loc.module.title)}</b>\n${esc(loc.textbook.title)}, ${esc(loc.grade.label)}`, { inline_keyboard: rows });
}

async function showProduct(chatId, messageId, userId, sku) {
  const p = catalog.product(sku);
  if (!p) return send(chatId, 'Такого урока нет в каталоге.');
  const { owned } = await ownership(userId);
  const lines = [`<b>${esc(p.title)}</b>`, '', esc(p.description), ''];
  if (p.type === 'pack') {
    lines.push('Входит: ' + p.includes.map(s => {
      const x = catalog.product(s);
      return `${x.short || x.title}${x.status === 'available' ? '' : ' (скоро)'}`;
    }).join(', ') + '.');
  }
  lines.push(`Цена: <b>${priceText(p)}</b>`);
  if (p.status === 'preorder') lines.push('Предзаказ: готовые уроки придут сразу после оплаты, остальные по мере выхода.');
  if (p.status === 'soon') lines.push('Урок готовится. Нажмите «Сообщить о выходе», и бот пришлёт его, как только он появится.');

  const rows = [];
  if (owned.has(sku)) {
    if (catalog.lessonsOf(p).some(l => l.status === 'available')) rows.push([{ text: 'Отправить файлы ещё раз', callback_data: `re:${sku}` }]);
    lines.push('', '✓ Уже у вас.');
  } else if (p.free && p.status === 'available') {
    rows.push([{ text: 'Получить бесплатно', callback_data: `get:${sku}` }]);
  } else if (catalog.purchasable(p)) {
    rows.push([{ text: `Купить за ${rub(p.price)}`, callback_data: `buy:${sku}` }]);
  } else if (p.status === 'soon') {
    rows.push([{ text: 'Сообщить о выходе', callback_data: `nt:${sku}` }]);
  }
  const loc = catalog.moduleOf(sku);
  if (loc) rows.push([{ text: '← К модулю', callback_data: `md:${loc.module.id}` }]);
  const text = lines.join('\n');
  const markup = { inline_keyboard: rows };
  return messageId ? edit(chatId, messageId, text, markup) : send(chatId, text, { reply_markup: markup });
}

async function showMine(chatId, userId) {
  const { purchases, owned } = await ownership(userId);
  if (!purchases.length) {
    return send(chatId, `У вас пока нет уроков. Начните с бесплатного: «${MENU.free}».`, { reply_markup: mainKeyboard });
  }
  const lessons = [...owned].map(catalog.product).filter(p => p && p.type === 'lesson');
  const ready = lessons.filter(p => p.status === 'available');
  const waiting = lessons.filter(p => p.status !== 'available');
  const lines = ['<b>Мои уроки</b>', ''];
  ready.forEach(p => lines.push(`✓ ${esc(p.title)}`));
  if (waiting.length) {
    lines.push('', 'Придут по мере выхода:');
    waiting.forEach(p => lines.push(`· ${esc(p.title)}`));
  }
  lines.push('', 'Нажмите на урок, чтобы получить файлы и ссылку ещё раз.');
  return send(chatId, lines.join('\n'), {
    reply_markup: { inline_keyboard: ready.map(p => [{ text: p.short || p.title, callback_data: `re:${p.sku}` }]) }
  });
}

async function showHelp(chatId) {
  await send(chatId, [
    '<b>Как пользоваться уроком</b>',
    '',
    '1. Скачайте HTML-файл и откройте его в браузере: Chrome, Яндекс Браузер, Edge или Safari. На интерактивной доске файл можно открыть с флешки.',
    '2. Предпросмотр Telegram и приложения «Файлы» не запускают интерактив. На телефоне откройте личную ссылку, которую прислал бот.',
    '3. Стрелки ← → листают экраны, клавиша T открывает заметки учителя, F включает полный экран.',
    '4. В PDF план урока, ответы, тексты аудио и рабочий лист для печати.',
    '',
    'Файлы персональные: в них указан ваш ник. Пожалуйста, не пересылайте их коллегам, лучше поделитесь ссылкой на бот.',
    '',
    supportLine(),
    docsLine()
  ].filter(x => x !== null).join('\n'), { reply_markup: mainKeyboard });
}

async function edit(chatId, messageId, text, markup) {
  try {
    return await tg.call('editMessageText', { chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML', reply_markup: markup, disable_web_page_preview: true });
  } catch (e) {
    if (/message is not modified/.test(e.message)) return null;
    return send(chatId, text, { reply_markup: markup });
  }
}

// ---------- действия ----------

async function giveFree(chatId, from, sku) {
  const p = catalog.product(sku);
  if (!p || !p.free || p.status !== 'available') return send(chatId, 'Этот урок сейчас недоступен бесплатно.');
  const user = await db.getUser(from.id);
  let purchase = null;
  if (!(await db.hasPurchase(from.id, sku))) {
    purchase = await db.addPurchase({ userId: from.id, sku, kind: 'free' });
  }
  await send(chatId, 'Отправляю урок…');
  await delivery.fulfil(chatId, user, p, purchase && purchase.id);
  const after = ['Готово! Урок ваш.'];
  if (config.channelUrl) after.push(`Новые уроки выходят в канале: ${config.channelUrl}`);
  await send(chatId, after.join('\n'), { reply_markup: mainKeyboard });
}

async function resend(chatId, from, sku) {
  const p = catalog.product(sku);
  const { owned } = await ownership(from.id);
  if (!p || !owned.has(sku)) return send(chatId, 'Этого урока нет в ваших покупках.');
  const user = await db.getUser(from.id);
  const lessons = catalog.lessonsOf(p).filter(l => l.status === 'available');
  if (!lessons.length) return send(chatId, 'Уроки из этого пакета ещё готовятся. Бот пришлёт их сам, как только они выйдут.');
  for (const l of lessons) {
    await delivery.sendLesson(chatId, user, l);
    await db.markDelivered(user.id, l.sku, null);
  }
}

// Покупка: заказ в ЮKassa и кнопка со ссылкой на страницу оплаты.
// Счёт внутри Telegram (sendInvoice) не используем: по п. 6.2 правил Telegram для ботов
// цифровые товары внутри бота продаются только за Stars.
async function startBuy(chatId, from, sku) {
  const p = catalog.product(sku);
  if (!catalog.purchasable(p)) return send(chatId, 'Этот товар сейчас нельзя купить.');
  const { owned } = await ownership(from.id);
  if (owned.has(sku)) return showProduct(chatId, null, from.id, sku);
  if (!config.payEnabled) {
    await send(chatId, `Оплата ещё подключается. ${supportLine() || 'Попробуйте позже.'}`);
    await notifyAdmins(`Попытка покупки без подключённой оплаты: ${from.username ? '@' + esc(from.username) : from.id}, ${esc(sku)}`);
    return;
  }
  let r;
  try {
    r = await orders.createTg({ sku, from, botUsername: config.botUsername });
  } catch (e) {
    if (e.status) return send(chatId, esc(e.message));
    console.error('tg order create', from.id, sku, e.message);
    return send(chatId, `Не удалось создать платёж. Попробуйте через минуту. ${supportLine()}`);
  }
  if (!r.confirmationUrl) return send(chatId, 'ЮKassa не вернула страницу оплаты. Попробуйте ещё раз.');
  await send(chatId,
    `<b>${esc(p.title)}</b> · ${rub(p.price)}\n\n` +
    `Оплата картой или через СБП на защищённой странице ЮKassa. Нажимая «Оплатить», вы принимаете условия лицензии: ${docsLine()}.\n\n` +
    `После оплаты бот сам пришлёт файлы сюда, обычно в течение минуты. Ссылка на оплату действует один час.`,
    { reply_markup: { inline_keyboard: [[{ text: `Оплатить ${rub(p.price)}`, url: r.confirmationUrl }]] } });
}

// Вызывается из orders.markPaid, когда ЮKassa подтвердила оплату заказа из бота
async function onOrderPaid(order) {
  const userId = Number(order.tg_user_id);
  const p = catalog.product(order.sku);
  const purchase = await db.addPurchase({
    userId, sku: order.sku, kind: 'paid', amountRub: order.amount_rub,
    tgChargeId: 'yk:' + order.yk_payment_id, providerChargeId: order.yk_payment_id
  });
  if (!purchase) return; // уже выдано
  const user = await db.getUser(userId);
  await notifyAdmins(
    `Оплата: ${user.username ? '@' + esc(user.username) : esc(user.first_name || '')} (ID ${user.id})\n` +
    `${esc(p ? p.title : order.sku)} · ${rub(purchase.amount_rub)}\nЗаказ ${orders.shortId(order)}, ЮKassa: ${esc(order.yk_payment_id)}` +
    (config.ykReceipt ? '' : '\n\nПроверьте, что чек сформирован в «Мой налог».')
  );
  await send(userId, 'Оплата прошла, спасибо! Отправляю файлы…');
  try {
    const { sent, waiting, already } = p ? await delivery.fulfil(userId, user, p, purchase.id) : { sent: [], waiting: [], already: [] };
    const lines = [];
    if (already.length) lines.push('Уже были у вас: ' + already.map(w => esc(w.short || w.title)).join(', ') + '. Их можно получить ещё раз в «' + MENU.mine + '».');
    if (waiting.length) lines.push('Остальные уроки придут сюда сами по мере выхода:\n' + waiting.map(w => '· ' + esc(w.title)).join('\n'));
    if (!sent.length && !waiting.length && !already.length) lines.push(`Не нашли файлы для этого товара. Мы уже знаем и пришлём их вручную. ${supportLine()}`);
    if (lines.length) await send(userId, lines.join('\n\n'), { reply_markup: mainKeyboard });
  } catch (e) {
    console.error('fulfil after payment failed', userId, order.sku, e.message);
    await send(userId, `Оплата сохранена, но файлы не отправились. Бот повторит отправку автоматически в течение 15 минут, а уроки всегда доступны в «${MENU.mine}». ${supportLine()}`).catch(() => {});
    await notifyAdmins(`Ошибка выдачи после оплаты: ID ${userId}, ${esc(order.sku)}: ${esc(e.message)}`);
  }
}

// Возврат из ЮKassa по ссылке t.me/<бот>?start=paid_<token>
async function returnFromPayment(chatId, from, token) {
  let order = await orders.byToken(token);
  if (!order || String(order.tg_user_id) !== String(from.id)) return showWelcome(chatId, from);
  if (order.status === 'pending') {
    try { order = await orders.sync(order); } catch (e) { console.error('sync on return', order.id, e.message); }
  }
  if (order.status === 'paid') {
    if (await db.hasPurchase(from.id, order.sku)) return send(chatId, `Оплата получена. Файлы выше, а ещё они всегда есть в «${MENU.mine}».`, { reply_markup: mainKeyboard });
    return onOrderPaid(order);
  }
  if (order.status === 'canceled') return send(chatId, 'Оплата не прошла или была отменена. Деньги не списаны. Попробуйте ещё раз из каталога.', { reply_markup: mainKeyboard });
  return send(chatId, 'Ждём подтверждения от ЮKassa. Как только оплата пройдёт, бот сам пришлёт файлы.', { reply_markup: mainKeyboard });
}

async function subscribeRelease(chatId, from, sku) {
  const p = catalog.product(sku);
  if (!p) return;
  await db.markFollowup(from.id, `notify:${sku}`);
  await send(chatId, `Хорошо, пришлём сообщение, когда выйдет «${esc(p.title)}».`);
}

// ---------- выдача вышедших уроков (предзаказы и подписки) ----------

async function syncReleases() {
  let delivered = 0;
  const products = catalog.get().products;
  for (const p of Object.values(products)) {
    if (p.type !== 'lesson' || p.status !== 'available') continue;
    // владельцы: купили сам урок или пакет, в который он входит
    const owners = new Set(await db.buyersOf(p.sku));
    for (const pack of Object.values(products)) {
      if (pack.type === 'pack' && pack.includes.includes(p.sku)) (await db.buyersOf(pack.sku)).forEach(u => owners.add(u));
    }
    for (const uid of owners) {
      if (await db.isDelivered(uid, p.sku)) continue;
      const user = await db.getUser(uid);
      try {
        await send(uid, `Ваш урок готов: <b>${esc(p.title)}</b>`);
        await delivery.sendLesson(uid, user, p);
        await db.markDelivered(uid, p.sku, null);
        delivered++;
      } catch (e) {
        console.error('release failed', uid, p.sku, e.message);
        if (e.code === 403) await db.markDelivered(uid, p.sku, null); // бот заблокирован, не пытаемся снова
      }
      await sleep(80);
    }
    // подписчики «Сообщить о выходе»
    const subs = await db.q(
      `SELECT user_id FROM followups WHERE kind = $1 AND user_id NOT IN (SELECT user_id FROM followups WHERE kind = $2)`,
      [`notify:${p.sku}`, `notified:${p.sku}`]
    );
    for (const row of subs.rows) {
      const uid = Number(row.user_id);
      try {
        await send(uid, `Вышел урок <b>${esc(p.title)}</b>.`, { reply_markup: { inline_keyboard: [[{ text: 'Открыть', callback_data: `p:${p.sku}` }]] } });
      } catch (e) { console.error('notify failed', uid, e.message); }
      await db.markFollowup(uid, `notified:${p.sku}`);
      await sleep(80);
    }
  }
  return delivered;
}

async function runFollowups() {
  const f = catalog.get().followup;
  if (!f) return 0;
  const p = catalog.product(f.sku);
  const due = await db.dueFollowups(config.followupHours);
  let n = 0;
  for (const uid of due) {
    await db.markFollowup(uid, 'after_free');
    if (!p || !catalog.purchasable(p)) continue;
    try {
      await send(uid, f.text, { reply_markup: { inline_keyboard: [[{ text: f.button || 'Посмотреть', callback_data: `p:${f.sku}` }]] } });
      n++;
    } catch (e) { console.error('followup failed', uid, e.message); }
    await sleep(80);
  }
  return n;
}

// ---------- админ ----------

async function adminCommand(msg, cmd, args) {
  const chatId = msg.chat.id;
  if (cmd === '/stats') {
    const s = await db.stats();
    const lines = [
      '<b>Статистика</b>',
      `Пользователей: ${s.users} (за 7 дней: ${s.users_7d})`,
      `Взяли бесплатный урок: ${s.free_takers}`,
      `Оплат: ${s.paid}, покупателей: ${s.payers}`,
      `Выручка: ${rub(s.revenue)} (за 30 дней: ${rub(s.revenue_30d)})`,
      s.free_takers ? `Конверсия бесплатный → оплата: ${Math.round(100 * s.payers / s.free_takers)}%` : '',
      '', '<b>По товарам</b>',
      ...s.bySku.map(r => `${esc(r.sku)} · ${r.kind}: ${r.n}${r.rub ? ', ' + rub(r.rub) : ''}`),
      '', '<b>Откуда пришли</b> (параметр ссылки /start)',
      ...s.sources.map(r => `${esc(r.src)}: ${r.n}`)
    ];
    return send(chatId, lines.filter(x => x !== '').join('\n'));
  }
  if (cmd === '/grant') {
    const [who, sku] = args;
    const p = catalog.product(sku || '');
    if (!who || !p) return send(chatId, 'Формат: /grant <ID или @ник> <код товара>, например /grant @ivanova sp6-m3');
    const user = /^\d+$/.test(who) ? await db.getUser(Number(who)) : await db.findUserByUsername(who);
    if (!user) return send(chatId, 'Пользователь не найден: он должен хотя бы раз запустить бота.');
    const purchase = await db.addPurchase({ userId: user.id, sku, kind: 'granted' });
    const { sent, waiting } = await delivery.fulfil(user.id, user, p, purchase.id);
    return send(chatId, `Выдано: ${esc(p.title)} → ${user.username ? '@' + esc(user.username) : user.id}. Отправлено уроков: ${sent.length}, ждут выхода: ${waiting.length}.`);
  }
  if (cmd === '/release') {
    const n = await syncReleases();
    return send(chatId, `Разослано уроков по предзаказам: ${n}.`);
  }
  if (cmd === '/followups') {
    const n = await runFollowups();
    return send(chatId, `Отправлено напоминаний: ${n}.`);
  }
  if (cmd === '/reload') {
    if (config.catalogMode === 'db') await catalog.loadFromDb(); else catalog.load();
    delivery.clearCache();
    return send(chatId, `Каталог перечитан: ${Object.keys(catalog.get().products).length} товаров.`);
  }
  return send(chatId, 'Команды: /stats, /grant ID-или-@ник код, /release, /followups, /reload, /id');
}

// ---------- маршрутизация ----------

async function onMessage(msg) {
  if (!msg.from || msg.chat.type !== 'private') return;
  const text = (msg.text || '').trim();
  const chatId = msg.chat.id;

  if (text.startsWith('/start')) {
    const param = text.split(' ')[1] || '';
    await db.upsertUser(msg.from, param || null);
    if (param.startsWith('free_')) return giveFree(chatId, msg.from, param.slice(5));
    if (param.startsWith('paid_')) return returnFromPayment(chatId, msg.from, param.slice(5));
    if (param.startsWith('p_')) { await showWelcome(chatId, msg.from); return showProduct(chatId, null, msg.from.id, param.slice(2)); }
    return showWelcome(chatId, msg.from);
  }
  await db.upsertUser(msg.from);

  if (text === '/id') return send(chatId, `Ваш Telegram ID: <code>${msg.from.id}</code>`);
  if (text.startsWith('/') && isAdmin(msg.from.id)) {
    const [cmd, ...args] = text.split(/\s+/);
    return adminCommand(msg, cmd.replace(/@.*$/, ''), args);
  }
  if (text === MENU.free || text === '/free') return showFree(chatId, msg.from);
  if (text === MENU.catalog || text === '/catalog') return showTextbooks(chatId);
  if (text === MENU.mine || text === '/mine') return showMine(chatId, msg.from.id);
  if (text === MENU.help || text === '/help') return showHelp(chatId);
  return send(chatId, 'Выберите действие кнопками внизу.', { reply_markup: mainKeyboard });
}

async function onCallback(cq) {
  const chatId = cq.message.chat.id;
  const mid = cq.message.message_id;
  const data = cq.data || '';
  await tg.call('answerCallbackQuery', { callback_query_id: cq.id }).catch(() => {});
  await db.upsertUser(cq.from);
  const [kind, a, b] = data.split(':');
  switch (kind) {
    case 'cat': return showTextbooks(chatId, mid);
    case 'tb': return showTextbook(chatId, mid, a);
    case 'gr': return showGrade(chatId, mid, a, b);
    case 'md': return showModule(chatId, mid, cq.from.id, a);
    case 'p': return showProduct(chatId, null, cq.from.id, a);
    case 'get': return giveFree(chatId, cq.from, a);
    case 're': return resend(chatId, cq.from, a);
    case 'buy': return startBuy(chatId, cq.from, a);
    case 'nt': return subscribeRelease(chatId, cq.from, a);
    default: return null;
  }
}

async function handleUpdate(u) {
  try {
    if (u.message) await onMessage(u.message);
    else if (u.callback_query) await onCallback(u.callback_query);
  } catch (e) {
    console.error('update failed', u.update_id, e.stack || e.message);
    const chatId = (u.message && u.message.chat.id) || (u.callback_query && u.callback_query.message.chat.id);
    if (chatId && !(e.code === 403)) {
      await send(chatId, `Что-то пошло не так. Попробуйте ещё раз через минуту. ${supportLine()}`).catch(() => {});
    }
  }
}

module.exports = { handleUpdate, syncReleases, runFollowups, onOrderPaid, MENU };
