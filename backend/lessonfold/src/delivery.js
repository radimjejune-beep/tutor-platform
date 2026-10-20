'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { config } = require('./config');
const tg = require('./telegram');
const db = require('./db');
const catalog = require('./catalog');

// Файл урока: 'db:<ключ>' из базы или путь на диске. Кэш в памяти держим небольшим.
const cache = new Map();
async function readFile(ref) {
  if (cache.has(ref)) return cache.get(ref);
  let buf;
  if (ref.startsWith('db:')) {
    const f = await require('./store').getFile(ref.slice(3));
    if (!f) throw new Error(`Файл ${ref} не найден в базе`);
    buf = f.data;
  } else buf = fs.readFileSync(path.join(config.root, ref));
  if (cache.size > 12) cache.delete(cache.keys().next().value);
  cache.set(ref, buf);
  return buf;
}
function clearCache() { cache.clear(); }

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Строка лицензии, которая вшивается в урок
function licenseLabel(user) {
  const name = user.username ? '@' + user.username : (user.first_name || 'покупатель');
  return `${name} · ID ${user.id}`;
}

async function personalHtml(product, user, label) {
  const tpl = (await readFile(product.files.html)).toString('utf8');
  return tpl.split('{{BUYER}}').join(escapeHtml(label || licenseLabel(user)));
}

// PDF-шрифт Helvetica не умеет кириллицу, поэтому в PDF пишем латиницей: ник и ID
async function personalPdf(product, user, labelText) {
  const src = await readFile(product.files.pdf);
  const doc = await PDFDocument.load(src);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const who = labelText || `${user.username ? '@' + user.username : 'user'} · ID ${user.id}`;
  const label = `Licensed to ${who} · personal use only`
    .replace(/[^\x20-\x7E·]/g, '');
  for (const page of doc.getPages()) {
    const { width } = page.getSize();
    const size = 7;
    const w = font.widthOfTextAtSize(label, size);
    page.drawText(label, { x: (width - w) / 2, y: 10, size, font, color: rgb(0.6, 0.58, 0.53) });
  }
  return Buffer.from(await doc.save());
}

async function personalLink(product, user) {
  const token = await db.linkFor(user.id, product.sku, crypto.randomBytes(12).toString('base64url'));
  return `${config.publicUrl}/l/${token}`;
}

// Отправить один урок пользователю
async function sendLesson(chatId, user, product) {
  if (product.status !== 'available') return false;
  const link = await personalLink(product, user);
  const html = Buffer.from(await personalHtml(product, user), 'utf8');
  await tg.sendDocument(chatId, html, `${product.fileName}.html`, 'text/html', {
    caption: `${product.title}\n\nОткройте файл в браузере (Chrome, Safari, Яндекс Браузер) на компьютере или интерактивной доске. Интернет для урока не нужен.`
  });
  if (product.files.pdf) {
    const pdf = await personalPdf(product, user);
    await tg.sendDocument(chatId, pdf, `${product.fileName}_Teacher.pdf`, 'application/pdf', {
      caption: 'Руководство учителя: план урока, ответы, скрипт аудио, рабочий лист для печати.'
    });
  }
  await tg.call('sendMessage', {
    chat_id: chatId,
    text: `Ссылка для телефона и планшета (личная, не передавайте её другим):\n${link}`,
    disable_web_page_preview: true
  });
  return true;
}

// Выдать всё, что положено по покупке. Возвращает { sent: [...], waiting: [...] }
async function fulfil(chatId, user, product, purchaseId) {
  const sent = [];
  const waiting = [];
  const already = [];
  const isPack = product.type === 'pack';
  for (const lesson of catalog.lessonsOf(product)) {
    if (lesson.status !== 'available') { waiting.push(lesson); continue; }
    if (isPack && await db.isDelivered(user.id, lesson.sku)) { already.push(lesson); continue; }
    await sendLesson(chatId, user, lesson);
    await db.markDelivered(user.id, lesson.sku, purchaseId);
    sent.push(lesson);
  }
  return { sent, waiting, already };
}

module.exports = { readFile, personalHtml, personalPdf, personalLink, sendLesson, fulfil, licenseLabel, clearCache, escapeHtml };
