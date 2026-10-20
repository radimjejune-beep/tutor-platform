'use strict';
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Переменная окружения. Префикс LF_ главнее: так настройки магазина не путаются с настройками
// приложения, в которое он встроен (LF_BOT_TOKEN, LF_PUBLIC_URL, LF_ADMIN_LOGIN и т. д.).
function E(name) {
  const v = process.env['LF_' + name];
  return v !== undefined && v !== '' ? v : process.env[name];
}

function list(v) {
  return String(v || '').split(',').map(s => s.trim()).filter(Boolean);
}

const config = {
  root: ROOT,
  botToken: E('BOT_TOKEN') || '',
  apiBase: (E('TELEGRAM_API_BASE') || 'https://api.telegram.org').replace(/\/$/, ''),
  databaseUrl: E('DATABASE_URL') || '',
  databaseSsl: E('DATABASE_SSL') === '1' || process.env['DB_SSL'] === 'true',
  // DB_SCHEMA=lessonfold: хранить таблицы в отдельной схеме, если база общая с другим проектом
  dbSchema: (E('DB_SCHEMA') || '').trim(),
  publicUrl: (E('PUBLIC_URL') || '').replace(/\/$/, ''),
  port: Number(E('PORT') || 3000),
  // 127.0.0.1, если перед сервисом стоит Caddy или nginx; пусто = слушать все адреса
  host: E('HOST') || undefined,
  adminIds: list(E('ADMIN_IDS')).map(Number),
  supportContact: E('SUPPORT_CONTACT') || '',
  channelUrl: E('CHANNEL_URL') || '',
  followupHours: Number(E('FOLLOWUP_HOURS') || 72),
  catalogPath: path.join(ROOT, E('CATALOG_FILE') || 'catalog.json'),
  // db: каталог в базе, правится в админке сайта; file: только из catalog.json (задан CATALOG_FILE)
  catalogMode: E('CATALOG_FILE') ? 'file' : 'db',
  // Первый админ сайта: создаётся при запуске, если в базе ещё нет ни одного
  adminLogin: (E('ADMIN_LOGIN') || '').toLowerCase(),
  adminPassword: E('ADMIN_PASSWORD') || '',
  // Заполняется при запуске из getMe
  botUsername: E('BOT_USERNAME') || '',
  pollTimeout: Number(E('POLL_TIMEOUT') || 50),

  // Оплата на сайте через ЮKassa (API v3). Пусто = кнопка «Купить» на сайте ведёт в бот, если он есть.
  ykShopId: E('YOOKASSA_SHOP_ID') || '',
  ykSecret: E('YOOKASSA_SECRET_KEY') || '',
  ykApi: (E('YOOKASSA_API') || 'https://api.yookassa.ru/v3').replace(/\/$/, ''),
  // 1 = передавать в ЮKassa данные чека по 54-ФЗ. Самозанятому обычно не нужно: чек идёт в «Мой налог».
  ykReceipt: E('YOOKASSA_RECEIPT') === '1',

  // Почта для писем покупателям (SMTP). Например Яндекс 360: smtp.yandex.ru, 465, SMTP_SECURE=1
  smtpHost: E('SMTP_HOST') || '',
  smtpPort: Number(E('SMTP_PORT') || 465),
  smtpSecure: E('SMTP_SECURE') !== '0',
  smtpUser: E('SMTP_USER') || '',
  smtpPass: E('SMTP_PASS') || '',
  mailFrom: E('MAIL_FROM') || E('SMTP_USER') || ''
};
config.botEnabled = !!config.botToken;
config.payEnabled = !!(config.ykShopId && config.ykSecret);
config.mailEnabled = !!(config.smtpHost && config.mailFrom);

function checkConfig() {
  const missing = [];
  if (!config.databaseUrl) missing.push('DATABASE_URL');
  if (!config.publicUrl) missing.push('PUBLIC_URL');
  if (config.dbSchema && !/^[a-z_][a-z0-9_]{0,40}$/.test(config.dbSchema)) missing.push('DB_SCHEMA (только латиница в нижнем регистре, цифры и _)');
  if (missing.length) {
    throw new Error('Не заданы переменные окружения: ' + missing.join(', ') + '. Смотрите .env.example');
  }
}

module.exports = { config, checkConfig };
