'use strict';
const { config } = require('./config');

class TelegramError extends Error {
  constructor(method, body) {
    super(`Telegram ${method}: ${body && body.description ? body.description : 'unknown error'}`);
    this.method = method;
    this.code = body && body.error_code;
    this.body = body;
  }
}

async function call(method, params = {}) {
  const url = `${config.apiBase}/bot${config.botToken}/${method}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(params)
  });
  const body = await res.json().catch(() => ({ ok: false, description: `HTTP ${res.status}` }));
  if (!body.ok) throw new TelegramError(method, body);
  return body.result;
}

// Отправка файла из памяти (Buffer) через multipart/form-data
async function sendDocument(chatId, buffer, filename, mime, extra = {}) {
  const url = `${config.apiBase}/bot${config.botToken}/sendDocument`;
  const form = new FormData();
  form.append('chat_id', String(chatId));
  for (const [k, v] of Object.entries(extra)) {
    form.append(k, typeof v === 'string' ? v : JSON.stringify(v));
  }
  form.append('document', new Blob([buffer], { type: mime }), filename);
  const res = await fetch(url, { method: 'POST', body: form });
  const body = await res.json().catch(() => ({ ok: false, description: `HTTP ${res.status}` }));
  if (!body.ok) throw new TelegramError('sendDocument', body);
  return body.result;
}

module.exports = { call, sendDocument, TelegramError };
