// services/alerts.js — сообщения сисадмину: сбои, бэкапы, важные события.
// Уходят в кабинет и в Telegram (если сисадмин подключил бота). Одинаковые сообщения не чаще раза в 30 минут.
const { query } = require('../db');

const recent = new Map();
async function toAdmins(title, body = null, { key = title, everyMin = 30 } = {}) {
  const last = recent.get(key);
  if (last && Date.now() - last < everyMin * 60 * 1000) return;
  recent.set(key, Date.now());
  try {
    const { rows } = await query("SELECT id FROM users WHERE is_admin AND is_active");
    for (const r of rows) {
      await query('INSERT INTO notifications (user_id, kind, title, body) VALUES ($1, $2, $3, $4)', [r.id, 'system', String(title).slice(0, 255), body ? String(body).slice(0, 2000) : null]);
    }
    if (rows.length) await require('./telegram').forward(rows.map((r) => r.id), { title, body }).catch(() => {});
  } catch (err) {
    console.error('⚠️ Не удалось отправить сообщение сисадмину:', err.message);
  }
}

module.exports = { toAdmins };
