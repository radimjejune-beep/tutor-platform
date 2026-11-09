// routes/platformDocs.js — документы платформы для преподавателей (см. legal/platform.js)
//   Открыто:  GET /api/platform-docs            список документов и реквизиты владельца
//             GET /api/platform-docs/:kind      один документ (terms, privacy, dpa)
//   По входу: GET /api/platform-terms           нужно ли преподавателю принять новую редакцию
//             POST /api/platform-terms/accept   принять текущую редакцию
const express = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../middleware/validate');
const P = require('../legal/platform');

let ready = null;
function ensure() {
  if (!ready) {
    ready = query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS platform_terms_version INTEGER;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS platform_terms_at TIMESTAMPTZ;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS platform_terms_ip VARCHAR(64);
    `).catch((err) => { ready = null; throw err; });
  }
  return ready;
}

const publicRouter = express.Router();
publicRouter.get('/', (req, res) => {
  const o = P.owner();
  res.json({ version: P.VERSION, docs: P.all().map(({ kind, title }) => ({ kind, title })), owner: { name: o.name, inn: o.inn, email: o.email }, configured: P.configured() });
});
publicRouter.get('/:kind', (req, res) => {
  const d = P.doc(req.params.kind);
  if (!d) return res.status(404).json({ error: 'Документ не найден' });
  res.json(d);
});

const protectedRouter = express.Router();
protectedRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'tutor') return res.json({ pending: false, docs: [] });
    await ensure();
    const { rows } = await query('SELECT platform_terms_version FROM users WHERE id = $1', [req.user.id]);
    const pending = (rows[0]?.platform_terms_version || 0) < P.VERSION;
    res.json({ pending, version: P.VERSION, docs: pending ? P.all() : [] });
  })
);
protectedRouter.post(
  '/accept',
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'tutor') return res.status(403).json({ error: 'Только для преподавателя' });
    await ensure();
    await query('UPDATE users SET platform_terms_version = $2, platform_terms_at = NOW(), platform_terms_ip = $3 WHERE id = $1', [req.user.id, P.VERSION, String(req.ip || '').slice(0, 64)]);
    console.log(`✅ ${req.user.login} принял условия платформы, редакция ${P.VERSION}`);
    res.json({ ok: true });
  })
);

// При регистрации: отметить принятие текущей редакции
async function acceptOnRegister(userId, ip) {
  await ensure();
  await query('UPDATE users SET platform_terms_version = $2, platform_terms_at = NOW(), platform_terms_ip = $3 WHERE id = $1', [userId, P.VERSION, String(ip || '').slice(0, 64)]);
}

module.exports = { publicRouter, protectedRouter, acceptOnRegister, ensure };
