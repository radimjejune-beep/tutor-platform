const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const cors = require('cors');
const { allowedOrigins } = require('../src/middleware/cors');

test('CORS: first-party domains survive legacy hosting configuration', async (t) => {
  // Старый FRONTEND_ORIGINS может содержать только прежний адрес RelaxDev.
  const origins = allowedOrigins('https://old-frontend.relaxdev.ru/');
  const app = express();
  app.use(cors({ origin: (origin, cb) => cb(null, !origin || origins.includes(origin)) }));
  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.get('/api/plans', (req, res) => res.json({ plans: [] }));
  app.post('/api/auth/login', (req, res) => res.json({ ok: true }));
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;

  for (const origin of ['https://lessonfold.ru', 'https://www.lessonfold.ru', 'https://old-frontend.relaxdev.ru']) {
    await t.test(`GET and authenticated preflight from ${origin}`, async () => {
      const response = await fetch(`${base}/api/plans`, { headers: { Origin: origin } });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('access-control-allow-origin'), origin);
      const preflight = await fetch(`${base}/api/auth/login`, { method: 'OPTIONS', headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,authorization',
      } });
      assert.equal(preflight.status, 204);
      assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
      assert.match(preflight.headers.get('access-control-allow-headers'), /authorization/i);
    });
  }
  await t.test('an unrelated hosting tenant is not allowed', async () => {
    const response = await fetch(`${base}/api/plans`, { headers: { Origin: 'https://other.relaxdev.ru' } });
    assert.equal(response.headers.get('access-control-allow-origin'), null);
  });
  await t.test('health checks without an Origin still work', async () => {
    const response = await fetch(`${base}/api/health`);
    assert.deepEqual(await response.json(), { ok: true });
  });
  await t.test('missing configuration preserves the platform domains and local development', () => {
    assert.deepEqual(allowedOrigins(''), ['https://lessonfold.ru', 'https://www.lessonfold.ru', 'http://localhost:5173']);
  });
});
