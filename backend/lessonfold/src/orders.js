'use strict';
// Покупки на сайте: заказ → оплата в ЮKassa → страница скачивания и письмо со ссылкой.
const crypto = require('crypto');
const { config } = require('./config');
const db = require('./db');
const catalog = require('./catalog');
const pay = require('./pay');
const mail = require('./mail');
const delivery = require('./delivery');

const EMAIL_RE = /^[^\s@<>"',;]{1,64}@[^\s@<>"',;]{1,190}\.[a-zA-Zа-яА-Я]{2,24}$/;

async function migrate() {
  await db.q(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      sku TEXT NOT NULL,
      title TEXT NOT NULL,
      amount_rub INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','canceled','refunded')),
      yk_payment_id TEXT UNIQUE,
      news BOOLEAN NOT NULL DEFAULT false,
      offer_accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      ip TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      paid_at TIMESTAMPTZ,
      refunded_at TIMESTAMPTZ,
      checked_at TIMESTAMPTZ,
      emailed_at TIMESTAMPTZ,
      mail_error TEXT,
      opened INTEGER NOT NULL DEFAULT 0,
      note TEXT
    );
    CREATE INDEX IF NOT EXISTS orders_email ON orders (lower(email));
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS tg_user_id BIGINT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS tg_name TEXT;
    CREATE INDEX IF NOT EXISTS orders_tg ON orders (tg_user_id) WHERE tg_user_id IS NOT NULL;
    CREATE TABLE IF NOT EXISTS order_sent (
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      sku TEXT NOT NULL,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (order_id, sku)
    );
  `);
}

const shortId = o => o.id.slice(0, 8).toUpperCase();
const buyer = o => o.email || o.tg_name || `Telegram ${o.tg_user_id}`;
const label = o => `${buyer(o)} · заказ ${shortId(o)}`;
const pdfLabel = o => `${buyer(o)} · order ${shortId(o)}`;
let tgHandler = null; // бот регистрирует выдачу файлов в Telegram
const onTgPaid = fn => { tgHandler = fn; };
const orderUrl = o => `${config.publicUrl}/o/${o.token}`;
const productTitle = p => p.name || p.title;

async function byToken(token) {
  const r = await db.q('SELECT * FROM orders WHERE token = $1', [token]);
  return r.rows[0] || null;
}
async function byId(id) {
  const r = await db.q('SELECT * FROM orders WHERE id = $1', [id]);
  return r.rows[0] || null;
}

// Уроки заказа: готовые и ожидающие выхода
function lessonsOf(order) {
  const p = catalog.product(order.sku);
  if (!p) return { ready: [], waiting: [] };
  const all = catalog.lessonsOf(p);
  return { ready: all.filter(l => l.status === 'available' && l.files && l.files.html), waiting: all.filter(l => !(l.status === 'available' && l.files && l.files.html)) };
}

async function create({ sku, email, news, ip }) {
  if (!config.payEnabled) throw Object.assign(new Error('Оплата на сайте пока не подключена'), { status: 503 });
  const p = catalog.product(sku);
  if (!p || !catalog.purchasable(p)) throw Object.assign(new Error('Этот урок сейчас нельзя купить'), { status: 409 });
  email = String(email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw Object.assign(new Error('Проверьте адрес почты'), { status: 422 });
  const recent = await db.q(`SELECT count(*)::int AS n FROM orders WHERE ip = $1 AND created_at > now() - interval '1 hour'`, [ip]);
  if (recent.rows[0].n >= 20) throw Object.assign(new Error('Слишком много заказов подряд. Попробуйте через час.'), { status: 429 });
  const order = {
    id: crypto.randomUUID(), token: crypto.randomBytes(24).toString('base64url'),
    email, sku, title: productTitle(p), amount_rub: Number(p.price), news: !!news, ip
  };
  await db.q(`INSERT INTO orders (id, token, email, sku, title, amount_rub, news, ip) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [order.id, order.token, order.email, order.sku, order.title, order.amount_rub, order.news, ip]);
  const payment = await pay.createPayment({
    orderId: order.id, amountRub: order.amount_rub, email,
    description: `Лицензия на урок Lessonfold: ${order.title}, заказ ${shortId(order)}`,
    returnUrl: orderUrl(order)
  });
  await db.q('UPDATE orders SET yk_payment_id = $2 WHERE id = $1', [order.id, payment.id]);
  return { order, confirmationUrl: payment.confirmation && payment.confirmation.confirmation_url };
}

// Заказ из Telegram-бота: без почты, файлы выдаёт бот, после оплаты ЮKassa возвращает в бот
async function createTg({ sku, from, botUsername }) {
  if (!config.payEnabled) throw Object.assign(new Error('Оплата пока не подключена'), { status: 503 });
  const p = catalog.product(sku);
  if (!p || !catalog.purchasable(p)) throw Object.assign(new Error('Этот урок сейчас нельзя купить'), { status: 409 });
  const recent = await db.q(`SELECT count(*)::int AS n FROM orders WHERE tg_user_id = $1 AND created_at > now() - interval '1 hour'`, [from.id]);
  if (recent.rows[0].n >= 10) throw Object.assign(new Error('Слишком много попыток оплаты подряд. Попробуйте через час.'), { status: 429 });
  const order = {
    id: crypto.randomUUID(), token: crypto.randomBytes(24).toString('base64url'),
    sku, title: productTitle(p), amount_rub: Number(p.price),
    tg_user_id: from.id, tg_name: from.username ? '@' + from.username : (from.first_name || '').slice(0, 64) || null
  };
  await db.q(`INSERT INTO orders (id, token, email, sku, title, amount_rub, ip, tg_user_id, tg_name) VALUES ($1,$2,'',$3,$4,$5,'telegram',$6,$7)`,
    [order.id, order.token, order.sku, order.title, order.amount_rub, order.tg_user_id, order.tg_name]);
  const returnUrl = botUsername ? `https://t.me/${botUsername}?start=paid_${order.token}` : orderUrl(order);
  const payment = await pay.createPayment({
    orderId: order.id, amountRub: order.amount_rub, email: null,
    description: `Лицензия на урок Lessonfold: ${order.title}, заказ ${shortId(order)}`,
    returnUrl
  });
  await db.q('UPDATE orders SET yk_payment_id = $2 WHERE id = $1', [order.id, payment.id]);
  return { order, confirmationUrl: payment.confirmation && payment.confirmation.confirmation_url };
}

// Сверить заказ с ЮKassa. Данным из уведомления не доверяем: статус всегда запрашиваем сами.
async function sync(order) {
  if (!order || order.status !== 'pending' || !order.yk_payment_id) return order;
  await db.q('UPDATE orders SET checked_at = now() WHERE id = $1', [order.id]);
  const pmt = await pay.getPayment(order.yk_payment_id);
  if (pmt.metadata && pmt.metadata.order_id && pmt.metadata.order_id !== order.id) throw new Error('Платёж не относится к заказу');
  if (pmt.status === 'succeeded' && pmt.paid) {
    if (Number(pmt.amount.value) !== Number(order.amount_rub) || pmt.amount.currency !== 'RUB') {
      await db.q('UPDATE orders SET note = $2 WHERE id = $1', [order.id, `сумма платежа ${pmt.amount.value} ${pmt.amount.currency} не совпала`]);
      return order;
    }
    return markPaid(order);
  }
  if (pmt.status === 'canceled') {
    await db.q(`UPDATE orders SET status = 'canceled' WHERE id = $1 AND status = 'pending'`, [order.id]);
    return byId(order.id);
  }
  return order;
}

async function markPaid(order) {
  const r = await db.q(`UPDATE orders SET status = 'paid', paid_at = now() WHERE id = $1 AND status = 'pending' RETURNING *`, [order.id]);
  const paid = r.rows[0];
  if (!paid) return byId(order.id); // уже отмечен другим запросом
  const { ready } = lessonsOf(paid);
  for (const l of ready) await db.q('INSERT INTO order_sent (order_id, sku) VALUES ($1, $2) ON CONFLICT DO NOTHING', [paid.id, l.sku]);
  if (paid.email) await sendMail(paid, 'paid');
  if (paid.tg_user_id && tgHandler) {
    try { await tgHandler(paid); } catch (e) { console.error('tg delivery after payment', paid.id, e.message); }
  }
  return byId(paid.id);
}

// Уведомление ЮKassa (webhook)
async function webhook(body) {
  const obj = body && body.object;
  if (!obj || !obj.id) return false;
  const paymentId = body.event && body.event.startsWith('refund.') ? obj.payment_id : obj.id;
  const r = await db.q('SELECT * FROM orders WHERE yk_payment_id = $1', [paymentId]);
  if (!r.rows[0]) return false;
  await sync(r.rows[0]);
  return true;
}

// ---------- письма ----------
const escapeHtml = delivery.escapeHtml;

function letter(kind, order, extra) {
  const url = orderUrl(order);
  const { ready, waiting } = lessonsOf(order);
  const names = ready.map(l => productTitle(l));
  const lines = {
    paid: [`Спасибо за покупку! Заказ ${shortId(order)}: ${order.title}, ${order.amount_rub} ₽.`, names.length ? `Готово к скачиванию: ${names.join(', ')}.` : '', waiting.length ? `Ещё выйдут: ${waiting.map(productTitle).join(', ')}. Пришлём письмо, как только они появятся.` : ''],
    release: [`Вышел урок «${extra}» из вашего заказа ${shortId(order)}.`],
    resend: [`Ссылка на ваш заказ ${shortId(order)}: ${order.title}.`]
  }[kind].filter(Boolean);
  const subject = { paid: `Ваш урок Lessonfold: ${order.title}`, release: `Вышел урок: ${extra}`, resend: `Ссылка на заказ ${shortId(order)}` }[kind];
  const text = [...lines, '', `Скачать HTML-урок и PDF для учителя: ${url}`, '', 'Ссылка личная, не передавайте её другим. В файлы вшиты ваша почта и номер заказа.', 'Откройте HTML-файл в браузере на компьютере или интерактивной доске. Интернет на уроке не нужен.', '', `Оферта: ${config.publicUrl}/offer`, 'Lessonfold'].join('\n');
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#141c2a;max-width:560px">
${lines.map(l => `<p>${escapeHtml(l)}</p>`).join('')}
<p><a href="${url}" style="display:inline-block;background:#ffb703;color:#251900;padding:12px 20px;border-radius:999px;font-weight:bold;text-decoration:none">Скачать урок</a></p>
<p style="color:#5f6676;font-size:13px">Ссылка личная, не передавайте её другим. В файлы вшиты ваша почта и номер заказа. Откройте HTML-файл в браузере на компьютере или интерактивной доске, интернет на уроке не нужен.</p>
<p style="color:#5f6676;font-size:13px"><a href="${config.publicUrl}/offer" style="color:#5f6676">Оферта</a> · Lessonfold</p></div>`;
  return { subject, text, html };
}

async function sendMail(order, kind, extra) {
  const m = letter(kind, order, extra);
  const r = await mail.send({ to: order.email, ...m });
  await db.q('UPDATE orders SET emailed_at = CASE WHEN $2 THEN now() ELSE emailed_at END, mail_error = $3 WHERE id = $1', [order.id, r.sent, r.sent ? null : r.error]);
  return r;
}

// Восстановить доступ: одно письмо со ссылками на все оплаченные заказы
async function restore(email) {
  email = String(email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false };
  const r = await db.q(`SELECT * FROM orders WHERE lower(email) = $1 AND status = 'paid' ORDER BY paid_at DESC LIMIT 50`, [email]);
  if (!r.rows.length) return { ok: true, n: 0 };
  const rows = r.rows;
  const text = ['Ваши покупки в Lessonfold:', '', ...rows.map(o => `${o.title} (заказ ${shortId(o)}): ${orderUrl(o)}`), '', 'Ссылки личные, не передавайте их другим.', 'Если вы не запрашивали это письмо, просто удалите его.'].join('\n');
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#141c2a;max-width:560px"><p>Ваши покупки в Lessonfold:</p><ul>${rows.map(o => `<li><a href="${orderUrl(o)}">${escapeHtml(o.title)}</a>, заказ ${shortId(o)}</li>`).join('')}</ul><p style="color:#5f6676;font-size:13px">Ссылки личные, не передавайте их другим. Если вы не запрашивали это письмо, просто удалите его.</p></div>`;
  await mail.send({ to: email, subject: 'Ваши уроки Lessonfold', text, html });
  return { ok: true, n: rows.length };
}

// Вышедшие уроки из оплаченных пакетов: отправить письмо
async function releases() {
  let n = 0;
  const r = await db.q(`SELECT * FROM orders WHERE status = 'paid'`);
  for (const o of r.rows) {
    const { ready } = lessonsOf(o);
    for (const l of ready) {
      const ins = await db.q('INSERT INTO order_sent (order_id, sku) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING sku', [o.id, l.sku]);
      // заказы из бота: вышедшие уроки рассылает сам бот (syncReleases)
      if (ins.rowCount && o.email) { await sendMail(o, 'release', productTitle(l)); n++; }
    }
  }
  return n;
}

// Заказы, которые остались pending: сверить с ЮKassa (на случай, если уведомление не дошло)
async function syncStale() {
  const r = await db.q(`SELECT * FROM orders WHERE status = 'pending' AND yk_payment_id IS NOT NULL
    AND created_at > now() - interval '2 days' AND (checked_at IS NULL OR checked_at < now() - interval '10 minutes')`);
  let n = 0;
  for (const o of r.rows) {
    try { const x = await sync(o); if (x && x.status === 'paid') n++; } catch (e) { console.error('sync order', o.id, e.message); }
  }
  await db.q(`UPDATE orders SET status = 'canceled', note = COALESCE(note, 'не оплачен за 2 дня') WHERE status = 'pending' AND created_at < now() - interval '2 days'`);
  // неоплаченные заказы храним 30 дней (так написано в политике)
  await db.q(`DELETE FROM orders WHERE status = 'canceled' AND paid_at IS NULL AND created_at < now() - interval '30 days'`);
  return n;
}

async function refund(id) {
  const o = await byId(id);
  if (!o || o.status !== 'paid') throw Object.assign(new Error('Вернуть можно только оплаченный заказ'), { status: 409 });
  await pay.refund({ paymentId: o.yk_payment_id, amountRub: o.amount_rub, key: 'refund-' + o.id });
  await db.q(`UPDATE orders SET status = 'refunded', refunded_at = now() WHERE id = $1`, [o.id]);
  if (o.tg_user_id) {
    // после возврата урок перестаёт числиться за покупателем в боте
    const pr = await db.q('SELECT id FROM purchases WHERE tg_charge_id = $1', ['yk:' + o.yk_payment_id]);
    if (pr.rows[0]) {
      await db.q('UPDATE deliveries SET via_purchase = NULL WHERE via_purchase = $1', [pr.rows[0].id]);
      await db.q('DELETE FROM purchases WHERE id = $1', [pr.rows[0].id]);
    }
  }
  return byId(o.id);
}

async function list({ q = '', limit = 200 } = {}) {
  const r = await db.q(`SELECT id, COALESCE(NULLIF(email, ''), tg_name, 'Telegram ' || tg_user_id) AS email, sku, title, amount_rub, status, news, created_at, paid_at, refunded_at, emailed_at, mail_error, opened, note
    FROM orders WHERE ($1 = '' OR lower(email) LIKE '%' || lower($1) || '%' OR lower(COALESCE(tg_name, '')) LIKE '%' || lower($1) || '%' OR upper(id) LIKE upper($1) || '%')
    ORDER BY created_at DESC LIMIT $2`, [String(q).trim(), limit]);
  return r.rows;
}

async function stats() {
  const r = await db.q(`SELECT
    count(*) FILTER (WHERE status = 'paid')::int AS paid,
    COALESCE(sum(amount_rub) FILTER (WHERE status = 'paid'), 0)::int AS revenue,
    COALESCE(sum(amount_rub) FILTER (WHERE status = 'paid' AND paid_at > now() - interval '30 days'), 0)::int AS revenue_30d,
    count(DISTINCT COALESCE(NULLIF(lower(email), ''), 'tg' || tg_user_id)) FILTER (WHERE status = 'paid')::int AS buyers,
    count(*) FILTER (WHERE status = 'pending')::int AS pending,
    count(*) FILTER (WHERE news)::int AS news
    FROM orders`);
  return r.rows[0];
}

async function opened(order) {
  await db.q('UPDATE orders SET opened = opened + 1 WHERE id = $1', [order.id]);
}

module.exports = { migrate, create, createTg, onTgPaid, sync, webhook, byToken, byId, lessonsOf, label, pdfLabel, shortId, sendMail, restore, releases, syncStale, refund, list, stats, opened, productTitle, EMAIL_RE };
