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
    await sendMessage(chatId, user ? 'Уведомления отключены. Подключить снова можно в личном кабинете.' : 'Уведомления и так не подключены.', user && user.role !== 'tutor' ? { reply_markup: { remove_keyboard: true } } : {});
    return true;
  }

  // Чужие сообщения в общем боте отдаём магазину
  if (!user) {
    if (SHARED) return false;
    await sendMessage(chatId, 'Сначала подключите бота в личном кабинете Lessonfold: кнопка «Подключить Telegram».');
    return true;
  }

  // Преподаватель: свои команды, остальное (покупка уроков) магазину
  if (user.role === 'tutor') {
    if (cmd === '/today') { await sendMessage(chatId, await cmdToday(user)); return true; }
    if (SHARED) return false;
    await sendMessage(chatId, helpText(user));
    return true;
  }

  // Ученик и родитель. Ссылки магазина (/start free_…, p_…, paid_…) отдаём магазину
  if (SHARED && cmd === '/start' && param) return false;
  const byButton = { [STUDY.lessons]: cmdLessons, [STUDY.homework]: cmdHomework, [STUDY.words]: cmdWords, [STUDY.cabinet]: cmdCabinet };
  const handler = byButton[text] || COMMAND_HANDLERS[cmd];
  if (handler) { await sendMessage(chatId, await handler(user), { reply_markup: studyKeyboard }); return true; }
  // Каталог уроков и прочие кнопки магазина в общем боте работают и для них
  if (SHARED && SHOP_TEXTS.has(text)) return false;
  if (SHARED && cmd !== '/start' && cmd.startsWith('/') && !COMMAND_HANDLERS[cmd]) return false;
  await sendMessage(chatId, (cmd === '/start' ? `Здравствуйте, ${user.full_name.split(' ')[0]}!\n\n` : '') + helpText(user), { reply_markup: studyKeyboard });
  return true;
}

// Кнопки и команды магазина: ученик тоже может ими пользоваться в общем боте
const SHOP_TEXTS = new Set(['Бесплатный урок', 'Каталог уроков', 'Курсы на год', 'Мои уроки', 'Помощь']);

async function linkByCode(chatId, msg, code) {
  const { rows } = await query('SELECT user_id FROM telegram_link_codes WHERE code = $1 AND expires_at > NOW()', [code]);
  if (!rows[0]) {
    await sendMessage(chatId, 'Ссылка устарела. Нажмите «Подключить Telegram» в кабинете ещё раз.');
    return;
  }
  const userId = rows[0].user_id;
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
    await sendMessage(chatId, 'Готово! Сюда будут приходить уведомления: сданные задания, записи на урок, заявки и другое.\n\n/today — уроки сегодня\nОтключить: /stop');
    console.log(`✅ Telegram подключён (преподаватель #${userId})`);
    return;
  }
  const names = await studentNamesFor(userId);
  // своё меню команд в этом чате
  await call('setMyCommands', { commands: STUDY_COMMANDS, scope: { type: 'chat', chat_id: chatId } }).catch(() => {});
  await sendMessage(
    chatId,
    `Готово! Сюда будут приходить итоги уроков, новые задания и напоминания${names.length ? `: ${names.join(', ')}` : ''}.\n\nНапомню за час до урока и накануне срока домашки. Кнопки внизу: расписание, домашка, слова.\nОтключить: /stop`,
    { reply_markup: studyKeyboard }
  );
  console.log(`✅ Telegram подключён (пользователь #${userId})`);
}

async function cmdCabinet() {
  return cabinetUrl('/') ? `Личный кабинет: ${cabinetUrl('/')}` : 'Откройте личный кабинет на сайте Lessonfold.';
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

const fmtLesson = (d) => {
  const f = (o) => new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, ...o }).format(new Date(d));
  return `${f({ weekday: 'short', day: 'numeric', month: 'short' })}, ${f({ hour: '2-digit', minute: '2-digit' })}`;
};
const fmtDay = (d) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date(`${String(d).slice(0, 10)}T12:00:00`));

// Ученики, к которым относится пользователь (сам ученик или дети родителя)
async function studentsOf(user) {
  const { rows } = await query(
    `SELECT s.id, s.full_name FROM students s WHERE s.user_id = $1
     UNION
     SELECT s.id, s.full_name FROM students s JOIN parent_students ps ON ps.student_id = s.id WHERE ps.parent_user_id = $1`,
    [user.id]
  );
  return rows;
}

function helpText(user) {
  const tutor = user.role === 'tutor';
  return [
    tutor ? 'Сюда приходят уведомления: сданные задания, записи, заявки и другое.' : 'Сюда приходят итоги уроков, новые задания и напоминания.',
    '',
    tutor ? '/today — уроки сегодня' : '/lessons — ближайшие уроки',
    ...(tutor ? [] : ['/homework — что задано', '/words — слова на повторение']),
    '/stop — отключить уведомления',
  ].join('\n');
}

async function cmdLessons(user) {
  if (user.role === 'tutor') return cmdToday(user);
  const kids = await studentsOf(user);
  if (!kids.length) return 'Ученик не найден. Проверьте подключение в кабинете.';
  const { rows } = await query(
    `SELECT l.starts_at, s.full_name FROM lessons l JOIN students s ON s.id = l.student_id
      WHERE l.student_id = ANY($1) AND l.status = 'scheduled' AND l.starts_at > NOW()
      ORDER BY l.starts_at LIMIT 5`,
    [kids.map((k) => k.id)]
  );
  if (!rows.length) return 'Ближайших уроков нет.';
  const many = kids.length > 1;
  return ['Ближайшие уроки:', ...rows.map((r) => `• ${fmtLesson(r.starts_at)}${many ? ` — ${r.full_name}` : ''}`), '', cabinetUrl('/schedule')].filter(Boolean).join('\n');
}

async function cmdHomework(user) {
  if (user.role === 'tutor') return helpText(user);
  const kids = await studentsOf(user);
  const { rows } = await query(
    `SELECT a.title, a.due_on, s.full_name FROM homework h JOIN assignments a ON a.id = h.assignment_id JOIN students s ON s.id = h.student_id
      WHERE h.student_id = ANY($1) AND h.status = 'assigned'
      ORDER BY a.due_on NULLS LAST, h.id LIMIT 10`,
    [kids.map((k) => k.id)]
  );
  if (!rows.length) return 'Все задания сделаны. Новые появятся здесь.';
  const many = kids.length > 1;
  return ['Задано:', ...rows.map((r) => `• ${r.title}${r.due_on ? ` (до ${fmtDay(r.due_on)})` : ''}${many ? ` — ${r.full_name}` : ''}`), '', cabinetUrl('/homework')].filter(Boolean).join('\n');
}

async function cmdWords(user) {
  if (user.role === 'tutor') return helpText(user);
  const kids = await studentsOf(user);
  const { rows } = await query(
    `SELECT s.full_name, COUNT(v.id)::int AS due FROM students s
       LEFT JOIN vocab_items v ON v.student_id = s.id AND v.due_on <= CURRENT_DATE
      WHERE s.id = ANY($1) GROUP BY s.id, s.full_name ORDER BY s.full_name`,
    [kids.map((k) => k.id)]
  );
  const total = rows.reduce((n, r) => n + r.due, 0);
  if (!total) return 'Сегодня повторять нечего. Отлично!';
  const lines = rows.length > 1 ? rows.filter((r) => r.due).map((r) => `• ${r.full_name}: ${r.due}`) : [`На повторение: ${total}. Это минут пять.`];
  return [...lines, '', cabinetUrl('/words')].filter(Boolean).join('\n');
}

async function cmdToday(user) {
  if (user.role !== 'tutor') return cmdLessons(user);
  const { rows } = await query(
    `SELECT l.starts_at, s.full_name FROM lessons l JOIN students s ON s.id = l.student_id
      WHERE s.tutor_id = $1 AND l.status = 'scheduled'
        AND (l.starts_at AT TIME ZONE $2)::date = (NOW() AT TIME ZONE $2)::date
      ORDER BY l.starts_at`,
    [user.id, TZ]
  );
  if (!rows.length) return 'Сегодня уроков нет.';
  const t = (d) => new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(d));
  return [`Сегодня уроков: ${rows.length}`, ...rows.map((r) => `• ${t(r.starts_at)} ${r.full_name}`), '', cabinetUrl('/schedule')].filter(Boolean).join('\n');
}

const COMMAND_HANDLERS = { '/lessons': cmdLessons, '/homework': cmdHomework, '/words': cmdWords, '/today': cmdToday, '/help': async (u) => helpText(u) };

// ------------------------------------------------------------
// Уведомления кабинета → Telegram (кто подключил бота)
// ------------------------------------------------------------
async function forward(userIds, { title, body = null, link = null }) {
  if (!enabled() || !botUsername || !userIds.length) return 0;
  const { rows } = await query('SELECT user_id, chat_id FROM telegram_links WHERE user_id = ANY($1::int[])', [[...new Set(userIds)]]);
  let sent = 0;
  for (const r of rows) {
    const url = link ? cabinetUrl(link) : '';
    const text = [title, body, url].filter(Boolean).join('\n\n').slice(0, 4000);
    try {
      await sendMessage(r.chat_id, text);
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

async function start() {
  if (!enabled()) {
    console.log('⚠️ Telegram выключен: не задан TELEGRAM_BOT_TOKEN или LF_BOT_TOKEN');
    return;
  }
  try {
    const me = await call('getMe');
    botUsername = me.username;
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
    `SELECT a.title, a.due_on FROM homework h JOIN assignments a ON a.id = h.assignment_id
      WHERE h.student_id = $1 AND h.status = 'assigned' AND h.created_at > NOW() - INTERVAL '2 days'
      ORDER BY h.id`,
    [l.student_id]
  );

  const site = (process.env.FRONTEND_ORIGINS || '').split(',')[0].trim();
  const lines = [`Итоги урока: ${l.student_name}`, formatWhen(l.starts_at)];
  if (l.topic) lines.push('', `Тема: ${l.topic}`);
  if (l.summary) lines.push('', l.summary);
  if (hw.length) {
    lines.push('', 'Домашнее задание:');
    for (const h of hw) {
      const due = h.due_on ? ` — до ${new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date(`${h.due_on}T12:00:00`))}` : '';
      lines.push(`• ${h.title}${due}`);
    }
  }
  if (site) lines.push('', `Личный кабинет: ${site}`);
  const text = lines.join('\n').slice(0, 4000);

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
      await sendMessage(r.chat_id, text);
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

module.exports = { enabled, username, start, createLinkCode, sendLessonSummary, lessonRecipients, handleUpdate, forward, sendMessage, cabinetUrl, studentsOf };
