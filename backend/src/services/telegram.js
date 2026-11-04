// services/telegram.js — бот: привязка учеников, родителей и преподавателя, уведомления, команды, итоги урока.
// Один бот на всё. Если бот магазина (LF_BOT_TOKEN) тот же или TELEGRAM_BOT_TOKEN не задан, сообщения читает
// магазин и сначала отдаёт их сюда: подключённые ученики и родители получают учебное меню, остальные попадают в магазин.
// Если задан отдельный TELEGRAM_BOT_TOKEN, этот бот работает сам по себе (long polling, вебхук не нужен).
const crypto = require('crypto');
const { query } = require('../db');

const OWN_TOKEN = process.env['TELEGRAM_BOT_TOKEN'] || '';
const SHOP_TOKEN = process.env['LF_BOT_TOKEN'] || '';
const SHOP_ON = Boolean(SHOP_TOKEN && process.env['LF_PUBLIC_URL']);
// Общий бот с магазином: токены совпадают или свой токен не задан
const SHARED = SHOP_ON && (!OWN_TOKEN || OWN_TOKEN === SHOP_TOKEN);
const TOKEN = OWN_TOKEN || SHOP_TOKEN;
const API = process.env['TELEGRAM_API_URL'] || 'https://api.telegram.org';
const TZ = process.env['APP_TIMEZONE'] || 'Europe/Moscow';

let botUsername = null;
let running = false;

async function call(method, body) {
  const res = await fetch(`${API}/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
    signal: AbortSignal.timeout(40000),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) throw new Error(`Telegram ${method}: ${data.description || res.status}`);
  return data.result;
}

const enabled = () => Boolean(TOKEN);
const username = () => botUsername;
const sendMessage = (chatId, text, extra = {}) => call('sendMessage', { chat_id: chatId, text, disable_web_page_preview: true, ...extra });

// Меню ученика и родителя (кнопки внизу). Названия не совпадают с кнопками магазина
const STUDY = { lessons: 'Расписание', homework: 'Домашка', words: 'Слова', cabinet: 'Кабинет' };
const studyKeyboard = { keyboard: [[{ text: STUDY.lessons }, { text: STUDY.homework }], [{ text: STUDY.words }, { text: STUDY.cabinet }]], resize_keyboard: true, is_persistent: true };
const STUDY_COMMANDS = [
  { command: 'lessons', description: 'Ближайшие уроки' },
  { command: 'homework', description: 'Что задано' },
  { command: 'words', description: 'Слова на повторение' },
  { command: 'stop', description: 'Отключить уведомления' },
];

// ------------------------------------------------------------
// Ссылка для привязки: t.me/бот?start=код (код живёт 30 минут)
// ------------------------------------------------------------
async function createLinkCode(userId) {
  const code = `link_${crypto.randomBytes(16).toString('hex')}`;
  await query('DELETE FROM telegram_link_codes WHERE user_id = $1 OR expires_at < NOW()', [userId]);
  await query(
    "INSERT INTO telegram_link_codes (code, user_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL '30 minutes')",
    [code, userId]
  );
  return `https://t.me/${botUsername}?start=${code}`;
}

// Чьи итоги будет получать пользователь
async function studentNamesFor(userId) {
  const { rows } = await query(
    `SELECT s.full_name FROM students s WHERE s.user_id = $1
     UNION
     SELECT s.full_name FROM students s JOIN parent_students ps ON ps.student_id = s.id WHERE ps.parent_user_id = $1`,
    [userId]
  );
  return rows.map((r) => r.full_name);
}

const isLinkCode = (c) => /^(link_)?[0-9a-f]{32}$/.test(c || '');

// Обработать сообщение. Возвращает true, если сообщение наше (иначе в общем режиме его получит магазин)
async function handleUpdate(u) {
  const msg = u.message;
  if (!msg || !msg.chat || msg.chat.type !== 'private') return false;
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();
  const [first, param] = text.split(/\s+/);
  const cmd = (first || '').split('@')[0].toLowerCase();

  // Привязка по ссылке из кабинета
  if (cmd === '/start' && isLinkCode(param)) {
    await linkByCode(chatId, msg, param);
    return true;
  }

  const { rows: linked } = await query('SELECT u.id, u.role, u.full_name FROM telegram_links tl JOIN users u ON u.id = tl.user_id WHERE tl.chat_id = $1', [chatId]);
  const user = linked[0];

  if (cmd === '/stop') {
    if (!user && SHARED) return false;
    await query('DELETE FROM telegram_links WHERE chat_id = $1', [chatId]);
    if (user && user.role !== 'tutor') await call('deleteMyCommands', { scope: { type: 'chat', chat_id: chatId } }).catch(() => {});
    await say(chatId, user ? '<b>Уведомления отключены</b>\nПодключить снова можно в личном кабинете.' : 'Уведомления и так не подключены.', user && user.role !== 'tutor' ? { reply_markup: { remove_keyboard: true } } : {});
    return true;
  }

  // Чужие сообщения в общем боте отдаём магазину
  if (!user) {
    if (SHARED) return false;
    await say(chatId, 'Сначала подключите бота в личном кабинете Lessonfold: кнопка «Подключить Telegram».');
    return true;
  }

  // Преподаватель: свои команды, остальное (покупка уроков) магазину
  if (user.role === 'tutor') {
    if (cmd === '/today') { await say(chatId, await cmdToday(user)); return true; }
    if (SHARED) return false;
    await say(chatId, helpText(user));
    return true;
  }

  // Ученик и родитель. Ссылки магазина (/start free_…, p_…, paid_…) отдаём магазину
  if (SHARED && cmd === '/start' && param) return false;
  const byButton = { [STUDY.lessons]: cmdLessons, [STUDY.homework]: cmdHomework, [STUDY.words]: cmdWords, [STUDY.cabinet]: cmdCabinet };
  const handler = byButton[text] || COMMAND_HANDLERS[cmd];
  if (handler) { await say(chatId, await handler(user)); return true; }
  // Каталог уроков и прочие кнопки магазина в общем боте работают и для них
  if (SHARED && SHOP_TEXTS.has(text)) return false;
  if (SHARED && cmd !== '/start' && cmd.startsWith('/') && !COMMAND_HANDLERS[cmd]) return false;
  const hello = cmd === '/start' ? `<b>Здравствуйте, ${esc(user.full_name.split(' ')[0])}!</b>\n\n` : '';
  const h = helpText(user);
  await say(chatId, { text: hello + h.text, buttons: h.buttons }, { keyboard: studyKeyboard });
  return true;
}

// Кнопки и команды магазина: ученик тоже может ими пользоваться в общем боте
const SHOP_TEXTS = new Set(['Бесплатный урок', 'Каталог уроков', 'Курсы на год', 'Мои уроки', 'Помощь']);

// ------------------------------------------------------------
// Оформление: HTML-разметка и кнопки-ссылки под сообщением
// ------------------------------------------------------------
const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const btn = (text, url) => (url && /^https:\/\//.test(url) ? { text, url } : null);
// Ряды кнопок: пустые убираем
const rows = (...list) => list.map((r) => (Array.isArray(r) ? r : [r]).filter(Boolean)).filter((r) => r.length);

// Отправить ответ: строка или { text, buttons }. opts.keyboard — кнопки внизу экрана (вместо кнопок под сообщением)
async function say(chatId, reply, opts = {}) {
  const r = typeof reply === 'string' ? { text: reply } : reply;
  const extra = { parse_mode: 'HTML' };
  if (opts.reply_markup) extra.reply_markup = opts.reply_markup;
  else if (opts.keyboard) extra.reply_markup = opts.keyboard;
  else if (r.buttons && r.buttons.length) extra.reply_markup = { inline_keyboard: r.buttons };
  return sendMessage(chatId, String(r.text).slice(0, 4000), extra);
}

async function linkByCode(chatId, msg, code) {
  const { rows: found } = await query('SELECT user_id FROM telegram_link_codes WHERE code = $1 AND expires_at > NOW()', [code]);
  if (!found[0]) {
    await say(chatId, '<b>Ссылка устарела</b>\nНажмите «Подключить Telegram» в кабинете ещё раз.');
    return;
  }
  const userId = found[0].user_id;
  // один чат — один вход: если этот Telegram был привязан к другому входу, переносим
  await query('DELETE FROM telegram_links WHERE chat_id = $1 AND user_id <> $2', [chatId, userId]);
  await query(
    `INSERT INTO telegram_links (user_id, chat_id, username) VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET chat_id = EXCLUDED.chat_id, username = EXCLUDED.username, linked_at = NOW()`,
    [userId, chatId, msg.from?.username || null]
  );
  await query('DELETE FROM telegram_link_codes WHERE user_id = $1', [userId]);
  const { rows: who } = await query('SELECT role FROM users WHERE id = $1', [userId]);
  if (who[0]?.role === 'tutor') {
    await say(chatId, [
      '<b>Готово, бот подключён</b>',
      '',
      'Буду присылать:',
      '· сданные задания и комментарии учеников',
      '· записи и переносы уроков',
      '· новые заявки со страницы записи',
      '',
      '/today покажет уроки на сегодня. Всё остальное в боте, как раньше: каталог и покупка уроков.',
    ].join('\n'));
    console.log(`✅ Telegram подключён (преподаватель #${userId})`);
    return;
  }
  const names = await studentNamesFor(userId);
  // своё меню команд в этом чате
  await call('setMyCommands', { commands: STUDY_COMMANDS, scope: { type: 'chat', chat_id: chatId } }).catch(() => {});
  await say(chatId, [
    '<b>Готово, бот подключён</b>',
    names.length ? `${names.length > 1 ? 'Ученики' : 'Ученик'}: ${esc(names.join(', '))}` : '',
    '',
    'Буду присылать:',
    '· итоги уроков и новые задания',
    '· напоминание за час до урока со ссылкой на звонок',
    '· напоминание о сроке домашки',
    '· вечером слова на повторение, если они есть',
    '',
    'Кнопки внизу: расписание, домашка, слова. Отключить: /stop',
  ].filter((l, k) => l !== '' || k !== 1).join('\n'), { keyboard: studyKeyboard });
  console.log(`✅ Telegram подключён (пользователь #${userId})`);
}

async function cmdCabinet() {
  return { text: '<b>Личный кабинет</b>\nРасписание, задания, слова и прогресс.', buttons: rows(btn('Открыть кабинет', cabinetUrl('/'))) };
}

// ------------------------------------------------------------
// Команды бота: ближайшие уроки, домашние задания, слова на повторение
// ------------------------------------------------------------
const COMMANDS = [
  { command: 'lessons', description: 'Ближайшие уроки' },
  { command: 'homework', description: 'Что задано' },
  { command: 'words', description: 'Слова на повторение' },
  { command: 'today', description: 'Уроки сегодня (для преподавателя)' },
  { command: 'stop', description: 'Отключить уведомления' },
];

const site = () => (process.env.FRONTEND_ORIGINS || '').split(',')[0].trim().replace(/\/$/, '');
// Ссылка в кабинет: на фронтенде hash-маршруты
const cabinetUrl = (path = '') => (site() ? `${site()}/#${path.startsWith('/') ? path : `/${path}`}` : '');

const fmtWeekday = (d) => {
  const s = new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'long' }).format(new Date(d));
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const fmtTime = (d) => new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(d));
const fmtDay = (d) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date(`${String(d).slice(0, 10)}T12:00:00`));
const plural = (n, a, b, c) => { const x = Math.abs(n) % 100; const y = x % 10; return x > 10 && x < 20 ? c : y > 1 && y < 5 ? b : y === 1 ? a : c; };

// Ученики, к которым относится пользователь (сам ученик или дети родителя)
async function studentsOf(user) {
  const { rows: list } = await query(
    `SELECT s.id, s.full_name FROM students s WHERE s.user_id = $1
     UNION
     SELECT s.id, s.full_name FROM students s JOIN parent_students ps ON ps.student_id = s.id WHERE ps.parent_user_id = $1`,
    [user.id]
  );
  return list;
}

function helpText(user) {
  if (user.role === 'tutor') {
    return { text: '<b>Уведомления Lessonfold</b>\nСюда приходят сданные задания, записи и заявки.\n\n/today уроки на сегодня\n/stop отключить уведомления' };
  }
  return {
    text: '<b>Что я умею</b>\n· присылаю итоги уроков и новые задания\n· напоминаю об уроке за час и о сроке домашки\n\nКнопки внизу: расписание, домашка, слова.\n/stop отключить уведомления',
    buttons: rows(btn('Открыть кабинет', cabinetUrl('/'))),
  };
}

async function cmdLessons(user) {
  if (user.role === 'tutor') return cmdToday(user);
  const kids = await studentsOf(user);
  if (!kids.length) return 'Ученик не найден. Проверьте подключение в кабинете.';
  const { rows: list } = await query(
    `SELECT l.id, l.starts_at, l.topic, s.full_name, COALESCE(NULLIF(l.call_link, ''), NULLIF(s.call_link, '')) AS call_link
       FROM lessons l JOIN students s ON s.id = l.student_id
      WHERE l.student_id = ANY($1) AND l.status = 'scheduled' AND l.starts_at > NOW() - INTERVAL '30 minutes'
      ORDER BY l.starts_at LIMIT 5`,
    [kids.map((k) => k.id)]
  );
  if (!list.length) return { text: '<b>Ближайших уроков нет</b>\nКак только преподаватель поставит урок, он появится здесь.', buttons: rows(btn('Расписание', cabinetUrl('/schedule'))) };
  const many = kids.length > 1;
  const lines = ['<b>Ближайшие уроки</b>', ''];
  for (const l of list) {
    lines.push(`<b>${fmtWeekday(l.starts_at)}</b>, ${fmtTime(l.starts_at)}${many ? ` · ${esc(l.full_name)}` : ''}`);
    if (l.topic) lines.push(`<i>${esc(l.topic)}</i>`);
  }
  const next = list[0];
  // ссылка на звонок, если ближайший урок сегодня
  const soon = new Date(next.starts_at) - Date.now() < 12 * 3600e3;
  return { text: lines.join('\n'), buttons: rows(soon && btn('Подключиться к звонку', next.call_link), btn('Расписание', cabinetUrl('/schedule'))) };
}

async function cmdHomework(user) {
  if (user.role === 'tutor') return helpText(user);
  const kids = await studentsOf(user);
  const { rows: list } = await query(
    `SELECT h.id, a.title, a.due_on, s.full_name FROM homework h JOIN assignments a ON a.id = h.assignment_id JOIN students s ON s.id = h.student_id
      WHERE h.student_id = ANY($1) AND h.status = 'assigned'
      ORDER BY a.due_on NULLS LAST, h.id LIMIT 8`,
    [kids.map((k) => k.id)]
  );
  if (!list.length) return { text: '<b>Все задания сделаны</b> ✓\nНовые появятся здесь.', buttons: rows(btn('Все задания', cabinetUrl('/homework'))) };
  const many = kids.length > 1;
  const lines = [`<b>Задано: ${list.length}</b>`, ''];
  for (const h of list) lines.push(`· <b>${esc(h.title)}</b>${h.due_on ? `, до ${fmtDay(h.due_on)}` : ''}${many ? ` · ${esc(h.full_name)}` : ''}`);
  const first = list.slice(0, 3).map((h) => btn(h.title.length > 30 ? `${h.title.slice(0, 29)}…` : h.title, cabinetUrl(`/homework/${h.id}`)));
  return { text: lines.join('\n'), buttons: rows(...first.map((b) => [b]), btn('Все задания', cabinetUrl('/homework'))) };
}

async function cmdWords(user) {
  if (user.role === 'tutor') return helpText(user);
  const kids = await studentsOf(user);
  const { rows: list } = await query(
    `SELECT s.full_name, COUNT(v.id)::int AS due FROM students s
       LEFT JOIN vocab_items v ON v.student_id = s.id AND v.due_on <= CURRENT_DATE
      WHERE s.id = ANY($1) GROUP BY s.id, s.full_name ORDER BY s.full_name`,
    [kids.map((k) => k.id)]
  );
  const total = list.reduce((n, r) => n + r.due, 0);
  if (!total) return { text: '<b>Сегодня повторять нечего</b> ✓\nОтличная работа!', buttons: rows(btn('Словарь', cabinetUrl('/words'))) };
  const lines = list.length > 1
    ? ['<b>Слова на повторение</b>', '', ...list.filter((r) => r.due).map((r) => `· ${esc(r.full_name)}: ${r.due}`)]
    : [`<b>На повторение ${total} ${plural(total, 'слово', 'слова', 'слов')}</b>`, 'Это минут пять.'];
  return { text: lines.join('\n'), buttons: rows(btn('Повторить слова', cabinetUrl('/words'))) };
}

async function cmdToday(user) {
  if (user.role !== 'tutor') return cmdLessons(user);
  const { rows: list } = await query(
    `SELECT l.starts_at, s.full_name FROM lessons l JOIN students s ON s.id = l.student_id
      WHERE s.tutor_id = $1 AND l.status = 'scheduled'
        AND (l.starts_at AT TIME ZONE $2)::date = (NOW() AT TIME ZONE $2)::date
      ORDER BY l.starts_at`,
    [user.id, TZ]
  );
  if (!list.length) return { text: '<b>Сегодня уроков нет</b>', buttons: rows(btn('Расписание', cabinetUrl('/schedule'))) };
  return {
    text: [`<b>Сегодня ${list.length} ${plural(list.length, 'урок', 'урока', 'уроков')}</b>`, '', ...list.map((r) => `<b>${fmtTime(r.starts_at)}</b>  ${esc(r.full_name)}`)].join('\n'),
    buttons: rows(btn('Расписание', cabinetUrl('/schedule'))),
  };
}

const COMMAND_HANDLERS = { '/lessons': cmdLessons, '/homework': cmdHomework, '/words': cmdWords, '/today': cmdToday, '/help': async (u) => helpText(u) };

// ------------------------------------------------------------
// Уведомления кабинета → Telegram (кто подключил бота)
// ------------------------------------------------------------
// Подпись кнопки по адресу в кабинете
function linkLabel(link) {
  if (/^\/homework\/\d+/.test(link)) return 'Открыть задание';
  if (/^\/lesson\//.test(link)) return 'Открыть урок';
  if (/^\/(schedule|lessons)/.test(link)) return 'Расписание';
  if (/^\/words/.test(link)) return 'Словарь';
  if (/^\/wordsets/.test(link)) return 'Карточки';
  if (/^\/leads/.test(link)) return 'Заявки';
  if (/^\/students\//.test(link)) return 'Карточка ученика';
  return 'Открыть в кабинете';
}

async function forward(userIds, { title, body = null, link = null }) {
  if (!enabled() || !botUsername || !userIds.length) return 0;
  const { rows: list } = await query('SELECT user_id, chat_id FROM telegram_links WHERE user_id = ANY($1::int[])', [[...new Set(userIds)]]);
  let sent = 0;
  for (const r of list) {
    const text = [`<b>${esc(title)}</b>`, body ? esc(body) : ''].filter(Boolean).join('\n\n');
    try {
      await say(r.chat_id, { text, buttons: rows(link && btn(linkLabel(link), cabinetUrl(link))) });
      sent++;
    } catch (err) {
      console.error(`⚠️ Telegram: уведомление пользователю #${r.user_id} не доставлено:`, err.message);
      if (/blocked|deactivated|chat not found/i.test(err.message)) await query('DELETE FROM telegram_links WHERE user_id = $1', [r.user_id]);
    }
  }
  return sent;
}

// Цикл получения сообщений
async function poll() {
  let offset = 0;
  while (running) {
    try {
      const updates = await call('getUpdates', { offset, timeout: 25, allowed_updates: ['message'] });
      for (const u of updates) {
        offset = u.update_id + 1;
        await handleUpdate(u).catch((e) => console.error('❌ Telegram: обработка сообщения:', e.message));
      }
    } catch (err) {
      console.error('⚠️ Telegram:', err.message);
      await new Promise((r) => setTimeout(r, 10000));
    }
  }
}

// Описание бота: его видят до нажатия «Старт» и в профиле. Ставим, только если вы не задали своё в @BotFather
const DESCRIPTION = [
  'Lessonfold: интерактивные уроки английского и личный кабинет ученика.',
  '',
  'Учителям: готовые уроки к школьным учебникам с играми, озвучкой и ответами. Начните с бесплатного урока.',
  '',
  'Ученикам и родителям: расписание, домашка, слова на повторение и напоминания. Подключите бота в личном кабинете кнопкой «Подключить Telegram».',
].join('\n');
const SHORT_DESCRIPTION = 'Интерактивные уроки английского. Ученикам: расписание, домашка и напоминания.';

async function describe() {
  try {
    const d = await call('getMyDescription');
    if (!d?.description) await call('setMyDescription', { description: DESCRIPTION });
    const sd = await call('getMyShortDescription');
    if (!sd?.short_description) await call('setMyShortDescription', { short_description: SHORT_DESCRIPTION });
  } catch (e) {
    console.error('⚠️ Telegram: описание бота:', e.message);
  }
}

async function start() {
  if (!enabled()) {
    console.log('⚠️ Telegram выключен: не задан TELEGRAM_BOT_TOKEN или LF_BOT_TOKEN');
    return;
  }
  try {
    const me = await call('getMe');
    botUsername = me.username;
    describe();
    if (SHARED) {
      // сообщения читает бот магазина и отдаёт их сюда первыми
      try {
        require('../../lessonfold/src/bot').setPreHandler(handleUpdate);
      } catch (e) {
        console.error('❌ Telegram: не удалось подключиться к боту магазина:', e.message);
        return;
      }
      console.log(`✅ Telegram: @${botUsername} общий с магазином (ученики и родители получают учебное меню)`);
      return;
    }
    await call('deleteWebhook', { drop_pending_updates: false });
    await call('setMyCommands', { commands: COMMANDS }).catch((e) => console.error('⚠️ Telegram: меню команд:', e.message));
    running = true;
    console.log(`✅ Telegram-бот @${botUsername} запущен`);
    poll();
  } catch (err) {
    console.error('❌ Telegram не запустился:', err.message.replace(/bot\d+:[\w-]+/g, 'bot***'), '— проверьте токен и переменную TG_OPTION=1');
    setTimeout(start, 60000);
  }
}

// ------------------------------------------------------------
// Итоги урока → родителям и взрослому ученику, у кого подключён Telegram
// ------------------------------------------------------------
function formatWhen(d) {
  const fmt = (o) => new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, ...o }).format(new Date(d));
  const day = fmt({ weekday: 'long', day: 'numeric', month: 'long' });
  return `${day.charAt(0).toUpperCase()}${day.slice(1)}, ${fmt({ hour: '2-digit', minute: '2-digit' })}`;
}

async function lessonRecipients(studentId) {
  const { rows } = await query(
    `SELECT u.id, u.full_name, u.role, tl.chat_id
       FROM users u
       LEFT JOIN telegram_links tl ON tl.user_id = u.id
      WHERE u.is_active AND (
            u.id IN (SELECT parent_user_id FROM parent_students WHERE student_id = $1)
         OR u.id = (SELECT user_id FROM students WHERE id = $1 AND category = 'adult'))`,
    [studentId]
  );
  return rows;
}

async function sendLessonSummary(lessonId) {
  if (!enabled() || !botUsername) return { error: 'Telegram-бот не подключён. Настройки → Telegram' };

  const { rows } = await query(
    `SELECT l.*, s.full_name AS student_name FROM lessons l JOIN students s ON s.id = l.student_id WHERE l.id = $1`,
    [lessonId]
  );
  const l = rows[0];
  if (!l) return { error: 'Занятие не найдено' };
  if (!l.summary && !l.topic) return { error: 'Сначала напишите, что сделали на уроке' };

  // Свежие задания этому ученику (выданы за последние 2 дня)
  const { rows: hw } = await query(
    `SELECT h.id, a.title, a.due_on FROM homework h JOIN assignments a ON a.id = h.assignment_id
      WHERE h.student_id = $1 AND h.status = 'assigned' AND h.created_at > NOW() - INTERVAL '2 days'
      ORDER BY h.id`,
    [l.student_id]
  );

  const lines = [`<b>Итоги урока</b> · ${esc(l.student_name)}`, `<i>${esc(formatWhen(l.starts_at))}</i>`];
  if (l.topic) lines.push('', `<b>Тема:</b> ${esc(l.topic)}`);
  if (l.summary) lines.push('', esc(l.summary));
  if (hw.length) {
    lines.push('', '<b>Домашнее задание</b>');
    for (const h of hw) lines.push(`· ${esc(h.title)}${h.due_on ? `, до ${fmtDay(h.due_on)}` : ''}`);
  }
  const text = lines.join('\n').slice(0, 4000);
  const buttons = rows(hw.length === 1 && btn('Открыть задание', cabinetUrl(`/homework/${hw[0].id}`)), btn(hw.length > 1 ? 'Все задания' : 'Личный кабинет', cabinetUrl(hw.length > 1 ? '/homework' : '/')));

  const recipients = await lessonRecipients(l.student_id);
  const sent = [];
  const notConnected = [];
  const failed = [];
  for (const r of recipients) {
    if (!r.chat_id) {
      notConnected.push(r.full_name);
      continue;
    }
    try {
      await say(r.chat_id, { text, buttons });
      sent.push(r.full_name);
    } catch (err) {
      failed.push(r.full_name);
      console.error(`⚠️ Telegram: не доставлено ${r.full_name}:`, err.message);
      // Пользователь заблокировал бота — отвязываем
      if (/blocked|deactivated|chat not found/i.test(err.message)) {
        await query('DELETE FROM telegram_links WHERE user_id = $1', [r.id]);
      }
    }
  }
  if (sent.length) await query('UPDATE lessons SET summary_sent_at = NOW() WHERE id = $1', [lessonId]);
  console.log(`📝 Итоги урока #${lessonId}: отправлено ${sent.length}, не подключены ${notConnected.length}`);
  return { sent, not_connected: notConnected, failed };
}

module.exports = { enabled, username, start, createLinkCode, sendLessonSummary, lessonRecipients, handleUpdate, forward, sendMessage, say, btn, rows, esc, cabinetUrl, studentsOf };
