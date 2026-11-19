'use strict';
// Покупки на сайте: заказ → оплата в ЮKassa → страница скачивания и письмо со ссылкой.
const crypto = require('crypto');
const { config } = require('./config');
const db = require('./db');
const catalog = require('./catalog');
const pay = require('./pay');
const mail = require('./mail');
const delivery = require('./delivery');
const mailQueue = require('./mail-queue');

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
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'lesson';
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS platform_user_id INTEGER;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS request_key TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}';
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmation_url TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS auto_refund BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS refunded_rub NUMERIC(12,2) NOT NULL DEFAULT 0;
    CREATE TABLE IF NOT EXISTS order_refunds(id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES orders(id),amount_rub NUMERIC(12,2) NOT NULL,status TEXT NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE UNIQUE INDEX IF NOT EXISTS orders_request_key ON orders(platform_user_id,request_key);
    CREATE INDEX IF NOT EXISTS orders_email ON orders (lower(email));
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS tg_user_id BIGINT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS tg_name TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS yk_refund_id TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_state TEXT;
    CREATE INDEX IF NOT EXISTS orders_tg ON orders (tg_user_id) WHERE tg_user_id IS NOT NULL;
    CREATE TABLE IF NOT EXISTS order_sent (
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      sku TEXT NOT NULL,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (order_id, sku)
    );
  `);
  await mailQueue.ensure();
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
  if(order.kind && order.kind!=='lesson') return {ready:[],waiting:[]};
  const p = catalog.product(order.sku);
  if (!p) return { ready: [], waiting: [] };
  const all = catalog.lessonsOf(p);
  return { ready: all.filter(l => l.status === 'available' && l.files && l.files.html), waiting: all.filter(l => !(l.status === 'available' && l.files && l.files.html)) };
}

// Продавать можно только когда на сайте указан продавец: ФИО, ИНН и контакт для претензий
// (закон о защите прав потребителей требует, чтобы покупатель видел эти сведения до покупки)
async function sellerReady() {
  const raw = await db.kvGet('settings');
  let s = {};
  try { s = (raw && JSON.parse(raw).seller) || {}; } catch (e) {}
  return !!(String(s.name || '').trim().split(/\s+/).length >= 2 && /^\d{12}$/.test(s.inn || '') && (s.email || s.contact));
}
const SELLER_MISSING = 'Продажи откроются, как только мы опубликуем сведения о продавце. Попробуйте чуть позже.';

async function create({ sku, email, news, ip }) {
  if (!config.payEnabled) throw Object.assign(new Error('Оплата на сайте пока не подключена'), { status: 503 });
  if (!(await sellerReady())) throw Object.assign(new Error(SELLER_MISSING), { status: 503 });
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
  if (!(await sellerReady())) throw Object.assign(new Error(SELLER_MISSING), { status: 503 });
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
  if(order?.yk_refund_id&&order.refund_state==='pending')return syncRefund(order);
  if(order?.status==='paid'&&order.auto_refund)return refund(order.id);
  if (!order || order.status !== 'pending' || !order.yk_payment_id) return order;
  await db.q('UPDATE orders SET checked_at = now() WHERE id = $1', [order.id]);
  const pmt = await pay.getPayment(order.yk_payment_id);
  if(order.kind!=='lesson' && (!pmt.id || pmt.id!==order.yk_payment_id || pmt.metadata?.order_id!==order.id)) throw Error('Платёж не относится к заказу');
  if (pmt.metadata && pmt.metadata.order_id && pmt.metadata.order_id !== order.id) throw new Error('Платёж не относится к заказу');
  if (pmt.status === 'succeeded' && pmt.paid) {
    if (Number(pmt.amount.value) !== Number(order.amount_rub) || pmt.amount.currency !== 'RUB') {
      await db.q('UPDATE orders SET note = $2 WHERE id = $1', [order.id, `сумма платежа ${pmt.amount.value} ${pmt.amount.currency} не совпала`]);
      return order;
    }
    return markPaid(order,pmt);
  }
  if (pmt.status === 'canceled') {
    await db.q(`UPDATE orders SET status = 'canceled' WHERE id = $1 AND status = 'pending'`, [order.id]);
    if(order.kind==='subscription'&&order.payload?.renewal)await require('./commerce').cancel(order.platform_user_id);
    return byId(order.id);
  }
  return order;
}

async function markPaid(order,pmt) {
  if(order.kind && order.kind!=='lesson') return require('./commerce').settle(order,pmt);
  const ready=lessonsOf(order).ready.map(l=>l.sku);
  const r=await db.q(`WITH paid AS(UPDATE orders SET status='paid',paid_at=NOW() WHERE id=$1 AND status='pending' RETURNING *),
   marked AS(INSERT INTO order_sent(order_id,sku) SELECT paid.id,unnest($2::text[]) FROM paid ON CONFLICT DO NOTHING),
   queued AS(INSERT INTO order_mail_jobs(id,order_id,kind) SELECT 'paid:'||id,id,'paid' FROM paid WHERE email<>'' ON CONFLICT DO NOTHING)
   SELECT * FROM paid`,[order.id,ready]);
  const paid=r.rows[0];if(!paid)return byId(order.id);
  if(paid.email)mailQueue.flush({orderId:paid.id}).catch(e=>console.error('mail queue',e.message));
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
  if (!r.rows[0]) {
    if(!String(body.event||'').startsWith('refund.') && obj.metadata?.order_id){
      const pending=await byId(obj.metadata.order_id);
      if(pending && pending.kind!=='lesson' && pending.status==='pending'){
        const verified=await pay.getPayment(obj.id);
        if(verified.metadata?.order_id!==pending.id || Number(verified.amount?.value)!==pending.amount_rub || verified.amount?.currency!=='RUB')throw Error('Платёж не относится к заказу');
        await db.q('UPDATE orders SET yk_payment_id=$2 WHERE id=$1 AND yk_payment_id IS NULL',[pending.id,obj.id]);
        await sync(await byId(pending.id));return true;
      }
    }
    return false;
  }
  if(String(body.event||'').startsWith('refund.')){const response=await pay.getRefund(obj.id);await applyRefund(r.rows[0],response);}else await sync(r.rows[0]);
  return true;
}

// ---------- письма ----------
const escapeHtml = delivery.escapeHtml;

function letter(kind, order, extra) {
  if(order.kind && order.kind!=='lesson')return require('./commerce').letter(order);
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

// PDF — дополнение к уроку. Большие подборки доступны на странице заказа,
// чтобы размер письма не мешал доставке. HTML-урок открывается/скачивается по ссылке.
async function attachmentsFor(order){
 const budget=8*1024*1024,files=[];let total=0;
 for(const p of lessonsOf(order).ready){
  if(!p.files?.pdf)continue;
  const data=await delivery.personalPdf(p,null,pdfLabel(order));
  if(total+data.length>budget)continue;
  total+=data.length;files.push({filename:`${p.fileName||p.sku}_Teacher.pdf`,data});
 }
 return files;
}

async function sendMail(order,kind,extra){
 if(!order||order.status!=='paid'||!order.email)return {sent:false,error:'Нет оплаченного заказа с почтой'};
 const jobId=await mailQueue.enqueue(order,kind,extra),r=await mailQueue.flush({jobId});
 const {rows}=await db.q('SELECT sent_at,last_error FROM order_mail_jobs WHERE id=$1',[jobId]);
 return {sent:Boolean(rows[0]?.sent_at),queued:!rows[0]?.sent_at,error:rows[0]?.last_error||(!config.mailEnabled?'Почта не настроена':null)};
}
function restoreLetter(rows){
 const text=['Ваши покупки в Lessonfold:','',...rows.map(o=>`${o.title} (заказ ${shortId(o)}): ${orderUrl(o)}`),'','Ссылки личные, не передавайте их другим.','Если вы не запрашивали это письмо, просто удалите его.'].join('\n');
 const html=`<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55"><p>Ваши покупки в Lessonfold:</p><ul>${rows.map(o=>`<li><a href="${orderUrl(o)}">${escapeHtml(o.title)}</a>, заказ ${shortId(o)}</li>`).join('')}</ul><p>Если вы не запрашивали это письмо, просто удалите его.</p></div>`;
 return {subject:'Ваши покупки Lessonfold',text,html};
}
async function restore(email){
 email=String(email||'').trim().toLowerCase();if(!EMAIL_RE.test(email))return {ok:false};
 const r=await db.q("SELECT 1 FROM orders WHERE lower(email)=$1 AND status='paid' LIMIT 1",[email]);
 if(r.rows.length){const jobId=await mailQueue.restore(email);await mailQueue.flush({jobId});}
 return {ok:true};
}

// Вышедшие уроки из оплаченных пакетов: отправить письмо
async function releases() {
  let n = 0;
  const r = await db.q(`SELECT * FROM orders WHERE status = 'paid'`);
  for (const o of r.rows) {
    const { ready } = lessonsOf(o);
    for (const l of ready) {
      const ins=await db.q(`WITH marked AS(INSERT INTO order_sent(order_id,sku) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING order_id)
       INSERT INTO order_mail_jobs(id,order_id,kind,extra) SELECT $3,order_id,'release',$4 FROM marked WHERE $5::boolean ON CONFLICT DO NOTHING RETURNING id`,
       [o.id,l.sku,`release:${o.id}:${l.sku}`,productTitle(l),Boolean(o.email)]);
      if(ins.rowCount)n++;

    }
  }
  await mailQueue.flush();
  return n;
}

// Заказы, которые остались pending: сверить с ЮKassa (на случай, если уведомление не дошло)
async function syncStale() {
  const r = await db.q(`SELECT * FROM orders WHERE ((status='pending' AND yk_payment_id IS NOT NULL AND created_at>NOW()-INTERVAL '2 days') OR (status='paid' AND (refund_state='pending' OR auto_refund))) AND (checked_at IS NULL OR checked_at<NOW()-INTERVAL '10 minutes')`);
  let n = 0;
  for (const o of r.rows) {
    try { const x = await sync(o); if (x && x.status === 'paid') n++; } catch (e) { console.error('sync order', o.id, e.message); }
  }
  await db.q(`UPDATE orders SET status = 'canceled', note = COALESCE(note, 'не оплачен за 2 дня') WHERE status = 'pending' AND created_at < now() - interval '2 days'`);
  // неоплаченные заказы храним 30 дней (так написано в политике)
  await db.q(`DELETE FROM orders WHERE kind='lesson' AND status = 'canceled' AND paid_at IS NULL AND created_at < now() - interval '30 days'`);
  return n;
}

async function applyRefund(order,refund){
 if(!refund||refund.payment_id!==order.yk_payment_id||!(Number(refund.amount?.value)>0&&Number(refund.amount?.value)<=Number(order.amount_rub))||refund.amount?.currency!=='RUB')throw Error('Возврат не соответствует заказу');
 if(!['pending','succeeded','canceled'].includes(refund.status)||!refund.id)throw Error('Неизвестный статус возврата');
 await db.transaction(async c=>{
  if(order.kind && order.kind!=='lesson')await c.query('SELECT id FROM public.users WHERE id=$1 FOR UPDATE',[order.platform_user_id]);
  const o=(await c.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[order.id])).rows[0];if(!o||o.status!=='paid')return;
  await c.query(`INSERT INTO order_refunds(id,order_id,amount_rub,status) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET status=CASE WHEN order_refunds.status='succeeded' THEN 'succeeded' ELSE EXCLUDED.status END,updated_at=NOW() WHERE order_refunds.order_id=EXCLUDED.order_id`,[refund.id,o.id,refund.amount.value,refund.status]);
  const refunded=(await c.query("SELECT COALESCE(SUM(amount_rub),0)::numeric AS n FROM order_refunds WHERE order_id=$1 AND status='succeeded'",[o.id])).rows[0].n;
  await c.query('UPDATE orders SET refunded_rub=$2 WHERE id=$1',[o.id,refunded]);
  await c.query('UPDATE orders SET yk_refund_id=$2,refund_state=$3,checked_at=NOW() WHERE id=$1',[o.id,refund.id,refund.status]);
  if(refund.status!=='succeeded'||Number(refunded)<Number(o.amount_rub))return;
  await c.query("UPDATE orders SET status='refunded',refunded_at=NOW(),auto_refund=FALSE WHERE id=$1",[o.id]);
  if(o.kind && o.kind!=='lesson')await require('./commerce').revoke(c,o);
  if(o.tg_user_id){const {rows:p}=await c.query('SELECT id FROM purchases WHERE tg_charge_id=$1',['yk:'+o.yk_payment_id]);if(p[0]){await c.query('UPDATE deliveries SET via_purchase=NULL WHERE via_purchase=$1',[p[0].id]);await c.query('DELETE FROM purchases WHERE id=$1',[p[0].id]);}}
 });return byId(order.id);
}
async function syncRefund(order){return applyRefund(order,await pay.getRefund(order.yk_refund_id));}
async function refund(id){
 const o=await byId(id);if(!o||o.status!=='paid')throw Object.assign(Error('Вернуть можно только оплаченный заказ'),{status:409});
 if(o.yk_refund_id && o.refund_state!=='succeeded'){if(o.refund_state==='canceled')throw Object.assign(Error('Возврат отменён платёжным сервисом. Проверьте его в кабинете ЮKassa.'),{status:409});return syncRefund(o);}
 const response=await pay.refund({paymentId:o.yk_payment_id,amountRub:Number(o.amount_rub)-Number(o.refunded_rub||0),key:'refund-'+o.id+(Number(o.refunded_rub)?'-'+Math.round(Number(o.refunded_rub)*100):'')});return applyRefund(o,response);
}

async function list({ q = '', limit = 200 } = {}) {
  const r = await db.q(`SELECT id, kind, platform_user_id, COALESCE(NULLIF(email, ''), tg_name, 'Telegram ' || tg_user_id) AS email, sku, title, amount_rub, status, news, created_at, paid_at, refunded_at, refunded_rub, refund_state, emailed_at, mail_error, opened, note,
    (SELECT COUNT(*)::int FROM order_mail_jobs j WHERE j.order_id=orders.id AND j.sent_at IS NULL AND j.canceled_at IS NULL) AS mail_pending,
    EXISTS(SELECT 1 FROM order_mail_jobs j WHERE j.order_id=orders.id AND j.sent_at IS NULL AND j.canceled_at IS NULL AND j.attempts>=12) AS mail_exhausted
    FROM orders WHERE ($1 = '' OR lower(email) LIKE '%' || lower($1) || '%' OR lower(COALESCE(tg_name, '')) LIKE '%' || lower($1) || '%' OR upper(id) LIKE upper($1) || '%')
    ORDER BY created_at DESC LIMIT $2`, [String(q).trim(), limit]);
  return r.rows;
}

async function stats() {
  const r = await db.q(`SELECT
    count(*) FILTER (WHERE status = 'paid')::int AS paid,
    COALESCE(sum(amount_rub-refunded_rub) FILTER (WHERE status = 'paid'), 0)::numeric AS revenue,
    COALESCE(sum(amount_rub-refunded_rub) FILTER (WHERE status = 'paid' AND paid_at > now() - interval '30 days'), 0)::numeric AS revenue_30d,
    count(DISTINCT COALESCE(NULLIF(lower(email), ''), 'tg' || tg_user_id)) FILTER (WHERE status = 'paid')::int AS buyers,
    count(*) FILTER (WHERE status = 'pending')::int AS pending,
    count(*) FILTER (WHERE news)::int AS news
    FROM orders`);
  return r.rows[0];
}

async function opened(order) {
  await db.q('UPDATE orders SET opened = opened + 1 WHERE id = $1', [order.id]);
}

module.exports = { sellerReady, migrate, create, createTg, onTgPaid, sync, webhook, byToken, byId, lessonsOf, label, pdfLabel, shortId, sendMail, restore, releases, syncStale, refund, list, stats, opened, productTitle, EMAIL_RE, letter, restoreLetter, attachmentsFor };
