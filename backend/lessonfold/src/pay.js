'use strict';
// ЮKassa API v3: создание платежа, проверка статуса, возврат.
const { config } = require('./config');

class PayError extends Error {}

async function yk(method, path, body, idemKey) {
  const headers = {
    authorization: 'Basic ' + Buffer.from(`${config.ykShopId}:${config.ykSecret}`).toString('base64'),
    'content-type': 'application/json'
  };
  if (idemKey) headers['idempotence-key'] = idemKey;
  const res = await fetch(config.ykApi + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new PayError(`ЮKassa ${res.status}: ${data.description || data.code || 'ошибка'}`);
  return data;
}

const money = rub => ({ value: Number(rub).toFixed(2), currency: 'RUB' });

async function createPayment({ orderId, amountRub, description, email, returnUrl }) {
  const body = {
    amount: money(amountRub),
    capture: true,
    confirmation: { type: 'redirect', return_url: returnUrl },
    description: description.slice(0, 128),
    metadata: { order_id: orderId }
  };
  if (config.ykReceipt && email) {
    body.receipt = {
      customer: { email },
      items: [{ description: description.slice(0, 128), quantity: '1.00', amount: money(amountRub), vat_code: 1, payment_mode: 'full_payment', payment_subject: 'intellectual_activity' }]
    };
  }
  return yk('POST', '/payments', body, orderId);
}

const getPayment = id => yk('GET', `/payments/${encodeURIComponent(id)}`);

function refund({ paymentId, amountRub, key }) {
  return yk('POST', '/refunds', { payment_id: paymentId, amount: money(amountRub) }, key);
}

module.exports = { createPayment, getPayment, refund, PayError };
