// routes/legal.js — оферта, политика, согласия: версии, принятие, редактирование
const express = require('express');
const { z } = require('zod');
const { query, transaction } = require('../db');
const { requireRole } = require('../middleware/auth');
const { validateBody, asyncHandler } = require('../middleware/validate');
const DEFAULTS = require('../legal/defaults');

const KINDS = ['offer', 'privacy', 'consent_adult', 'consent_parent'];

// При первом обращении кладём черновики (версия 1)
let seeded = false;
async function ensureDefaults() {
  if (seeded) return;
  for (const kind of KINDS) {
    await query(
      `INSERT INTO legal_documents (kind, version, title, body)
       SELECT $1, 1, $2, $3 WHERE NOT EXISTS (SELECT 1 FROM legal_documents WHERE kind = $1)`,
      [kind, DEFAULTS[kind].title, DEFAULTS[kind].body]
    );
  }
  seeded = true;
}

// Текущие (последние) версии
async function currentDocs() {
  await ensureDefaults();
  const { rows } = await query(
    `SELECT DISTINCT ON (kind) id, kind, version, title, body, published_at
       FROM legal_documents ORDER BY kind, version DESC`
  );
  return rows;
}

// Какие документы должен принять пользователь
async function requiredKinds(user) {
  if (user.role === 'parent') return ['offer', 'privacy', 'consent_parent'];
  if (user.role === 'student') {
    const { rows } = await query('SELECT category FROM students WHERE user_id = $1', [user.id]);
    // Взрослый ученик сам заключает договор; за несовершеннолетнего — родитель
    return rows[0]?.category === 'adult' ? ['offer', 'privacy', 'consent_adult'] : ['privacy'];
  }
  return [];
}

/* ============================================================
   Открытая часть: читать документы может любой (ссылки со страницы входа)
   ============================================================ */
const publicRouter = express.Router();

publicRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json((await currentDocs()).filter((d) => d.kind !== 'consent_adult' && d.kind !== 'consent_parent'));
  })
);

publicRouter.get(
  '/:kind',
  asyncHandler(async (req, res) => {
    const doc = (await currentDocs()).find((d) => d.kind === req.params.kind);
    if (!doc) return res.status(404).json({ error: 'Документ не найден' });
    res.json(doc);
  })
);

/* ============================================================
   После входа
   ============================================================ */
const protectedRouter = express.Router();

// Что нужно принять (новые документы или новые версии)
protectedRouter.get(
  '/pending',
  asyncHandler(async (req, res) => {
    const kinds = await requiredKinds(req.user);
    if (!kinds.length) return res.json([]);
    const docs = (await currentDocs()).filter((d) => kinds.includes(d.kind));
    const { rows: accepted } = await query('SELECT document_id FROM document_acceptances WHERE user_id = $1', [req.user.id]);
    const done = new Set(accepted.map((a) => a.document_id));
    res.json(docs.filter((d) => !done.has(d.id)));
  })
);

protectedRouter.post(
  '/accept',
  validateBody(z.object({ document_ids: z.array(z.number().int().positive()).min(1).max(10) }).strict()),
  asyncHandler(async (req, res) => {
    const kinds = await requiredKinds(req.user);
    const docs = (await currentDocs()).filter((d) => kinds.includes(d.kind));
    const allowed = new Map(docs.map((d) => [d.id, d]));
    const ids = req.body.document_ids.filter((id) => allowed.has(id));
    if (!ids.length) return res.status(400).json({ error: 'Нечего принимать' });

    await transaction(async (client) => {
      for (const id of ids) {
        await client.query(
          `INSERT INTO document_acceptances (user_id, document_id, ip, user_agent)
           VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, document_id) DO NOTHING`,
          [req.user.id, id, String(req.ip || '').slice(0, 64), String(req.get('user-agent') || '').slice(0, 300)]
        );
      }
      // Принято согласие на обработку ПДн → отмечаем в карточках учеников
      const kindsAccepted = ids.map((id) => allowed.get(id).kind);
      if (kindsAccepted.includes('consent_parent')) {
        await client.query(
          `UPDATE students SET pd_consent_at = NOW()
            WHERE pd_consent_at IS NULL AND id IN (SELECT student_id FROM parent_students WHERE parent_user_id = $1)`,
          [req.user.id]
        );
      }
      if (kindsAccepted.includes('consent_adult')) {
        await client.query('UPDATE students SET pd_consent_at = NOW() WHERE pd_consent_at IS NULL AND user_id = $1', [req.user.id]);
      }
    });
    console.log(`✅ ${req.user.login} принял документы: ${ids.join(', ')}`);
    res.json({ ok: true });
  })
);

// ------------------------------------------------------------
// Преподаватель: все документы и кто что принял
// ------------------------------------------------------------
protectedRouter.get(
  '/admin',
  requireRole('tutor'),
  asyncHandler(async (req, res) => {
    const docs = await currentDocs();
    const { rows: stats } = await query(
      `SELECT d.kind, d.version, COUNT(a.id)::int AS accepted
         FROM legal_documents d LEFT JOIN document_acceptances a ON a.document_id = d.id
        GROUP BY d.kind, d.version`
    );
    res.json(
      docs.map((d) => ({
        ...d,
        accepted_count: stats.find((s) => s.kind === d.kind && s.version === d.version)?.accepted || 0,
        has_placeholders: /\[[^\]]+\]/.test(d.body),
      }))
    );
  })
);

// Сохранить новую редакцию → все, кому она нужна, примут её при следующем входе
protectedRouter.put(
  '/docs/:kind',
  requireRole('tutor'),
  validateBody(
    z
      .object({
        title: z.string().trim().min(3).max(255),
        body: z.string().trim().min(50, 'Текст слишком короткий').max(100000),
      })
      .strict()
  ),
  asyncHandler(async (req, res) => {
    const { kind } = req.params;
    if (!KINDS.includes(kind)) return res.status(404).json({ error: 'Документ не найден' });
    await ensureDefaults();
    const { rows } = await query(
      `INSERT INTO legal_documents (kind, version, title, body)
       SELECT $1, COALESCE(MAX(version), 0) + 1, $2, $3 FROM legal_documents WHERE kind = $1
       RETURNING id, kind, version, title, published_at`,
      [kind, req.body.title, req.body.body]
    );
    console.log(`📝 Документ ${kind}: версия ${rows[0].version}`);
    res.json(rows[0]);
  })
);

module.exports = { publicRouter, protectedRouter };
