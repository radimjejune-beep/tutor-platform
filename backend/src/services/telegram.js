// services/telegram.js — бот: привязка родителей/учеников и отправка итогов урока
// Работает, только если задан TELEGRAM_BOT_TOKEN. Сообщения забирает сам (long polling) — вебхук не нужен.
const crypto = require('crypto');
const { query } = require('../db');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const API = process.env.TELEGRAM_API_URL || 'https://api.telegram.org';
const TZ = process.env.APP_TIMEZONE || 'Europe/Moscow';

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
const sendMessage = (chatId, text) => call('sendMessage', { chat_id: chatId, text, disable_web_page_preview: true });

// ------------------------------------------------------------
// Ссылка для привязки: t.me/бот?start=код (код живёт 30 минут)
// ------------------------------------------------------------
async function createLinkCode(userId) {
  const code = crypto.randomBytes(16).toString('hex');
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

async function handleUpdate(u) {
  const msg = u.message;
  if (!msg || !msg.chat || msg.chat.type !== 'private') return;
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();

  if (text.startsWith('/start')) {
    const code = text.split(/\s+/)[1];
    if (!code) {
      await sendMessage(chatId, 'Чтобы получать итоги уроков, откройте личный кабинет и нажмите «Подключить Telegram».');
      return;
    }
    const { rows } = await query('SELECT user_id FROM telegram_link_codes WHERE code = $1 AND expires_at > NOW()', [code]);
    if (!rows[0]) {
      await sendMessage(chatId, 'Ссылка устарела. Нажмите «Подключить Telegram» в кабинете ещё раз.');
      return;
    }
    const userId = rows[0].user_id;
    await query(
      `INSERT INTO telegram_links (user_id, chat_id, username) VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET chat_id = EXCLUDED.chat_id, username = EXCLUDED.username, linked_at = NOW()`,
      [userId, chatId, msg.from?.username || null]
    );
    await query('DELETE FROM telegram_link_codes WHERE user_id = $1', [userId]);
    const names = await studentNamesFor(userId);
    await sendMessage(
      chatId,
      `Готово! Сюда будут приходить итоги уроков${names.length ? `: ${names.join(', ')}` : ''}.\n\nОтключить: /stop`
    );
    console.log(`✅ Telegram подключён (пользователь #${userId})`);
    return;
  }

  if (text === '/stop') {
    const { rowCount } = await query('DELETE FROM telegram_links WHERE chat_id = $1', [chatId]);
    await sendMessage(chatId, rowCount ? 'Уведомления отключены. Подключить снова можно в личном кабинете.' : 'Уведомления и так не подключены.');
    return;
  }

  await sendMessage(chatId, 'Я присылаю итоги уроков. Подключение — в личном кабинете, отключить — /stop.');
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
    console.log('⚠️ Telegram выключен: не задан TELEGRAM_BOT_TOKEN');
    return;
  }
  try {
    const me = await call('getMe');
    botUsername = me.username;
    await call('deleteWebhook', { drop_pending_updates: false });
    running = true;
    console.log(`✅ Telegram-бот @${botUsername} запущен`);
    poll();
  } catch (err) {
    console.error('❌ Telegram не запустился:', err.message, '— проверьте токен и переменную TG_OPTION=1');
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

module.exports = { enabled, username, start, createLinkCode, sendLessonSummary, lessonRecipients, handleUpdate };
