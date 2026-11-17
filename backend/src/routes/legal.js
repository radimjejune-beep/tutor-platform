// routes/legal.js — оферта, политика, согласия: версии, принятие, редактирование
const express = require('express');
const { z } = require('zod');
const { query, transaction } = require('../db');
const { requireRole } = require('../middleware/auth');
const { validateBody, asyncHandler } = require('../middleware/validate');
const DEFAULTS = require('../legal/defaults');

const KINDS = ['offer', 'privacy', 'consent_adult', 'consent_parent'];

// У каждого репетитора свои документы. При первом обращении кладём ему черновики (версия 1)
const seeded = new Set();
async function ensureDefaults(tutorId) {
  if (seeded.has(tutorId)) return;
  for (const kind of KINDS) {
    await query(
      `INSERT INTO legal_documents (kind, version, title, body, tutor_id)
       SELECT $1::varchar, 1, $2::varchar, $3::text, $4::int
        WHERE NOT EXISTS (SELECT 1 FROM legal_documents WHERE kind = $1::varchar AND tutor_id = $4::int)`,
      [kind, DEFAULTS[kind].title, DEFAULTS[kind].body, tutorId]
    );
  }
  seeded.add(tutorId);
}

// Текущие (последние) версии документов репетитора
async function currentDocs(tutorId) {
  await ensureDefaults(tutorId);
  const { rows } = await query(
    `SELECT DISTINCT ON (kind) id, kind, version, title, body, published_at
       FROM legal_documents WHERE tutor_id = $1 ORDER BY kind, version DESC, id DESC`,
    [tutorId]
  );
  return rows;
}

// Открытая ссылка на документы: ?t=<логин репетитора>, без него — документы сисадмина
async function publicTutorId(login) {
  const { rows } = await query(
    `SELECT id FROM users WHERE role = 'tutor' AND is_active
        AND (($1::varchar IS NOT NULL AND login = $1::varchar) OR ($1::varchar IS NULL AND is_admin))
      ORDER BY id LIMIT 1`,
    [login ? String(login).toLowerCase().slice(0, 64) : null]
  );
  return rows[0]?.id ?? null;
}

// Какие документы должен принять пользователь
async function requiredKinds(user) {
  if (user.role === 'parent') return ['offer', 'privacy', 'consent_parent'];
  if (user.role === 'student') {
    const { rows } = await query('SELECT category FROM students WHERE user_id = $1', [user.id]);
    // Взрослый ученик сам заключает договор; за несовершеннолетнего — родитель
    return rows[0]?.category === 'adult' ? ['offer', 'privacy', 'consent_adult'] : [];
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
    const tid = await publicTutorId(req.query.t);
    if (!tid) return res.json([]);
    res.json((await currentDocs(tid)).filter((d) => d.kind !== 'consent_adult' && d.kind !== 'consent_parent'));
  })
);

publicRouter.get(
  '/:kind',
  asyncHandler(async (req, res) => {
    const tid = await publicTutorId(req.query.t);
    const doc = tid && (await currentDocs(tid)).find((d) => d.kind === req.params.kind);
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
    const docs = (await currentDocs(req.user.tid)).filter((d) => kinds.includes(d.kind));
    const { rows: accepted } = await query('SELECT document_id FROM document_acceptances WHERE user_id = $1', [req.user.id]);
    const done = new Set(accepted.map((a) => a.document_id));
    res.json(docs.filter((d) => !done.has(d.id)));
  })
);

protectedRouter.get('/family',asyncHandler(async(req,res)=>{
 const docs=await currentDocs(req.user.tid),state=await require('../services/guardians').status(req.user);
 res.json({...state,documents:req.user.role==='parent'?docs.filter(d=>['offer','privacy','consent_parent'].includes(d.kind)):[]});
}));
protectedRouter.post('/guardian-accept',requireRole('parent'),validateBody(z.object({student_ids:z.array(z.number().int().positive()).min(1).max(30),document_ids:z.array(z.number().int().positive()).length(3),relationship:z.enum(['parent','guardian']),declaration:z.literal(true)}).strict()),asyncHandler(async(req,res)=>{
 const docs=(await currentDocs(req.user.tid)).filter(d=>['offer','privacy','consent_parent'].includes(d.kind));
 const ids=[...new Set(req.body.document_ids)],students=[...new Set(req.body.student_ids)];
 if(ids.length!==3||docs.length!==3||!docs.every(d=>ids.includes(d.id)))return res.status(409).json({error:'Редакция документов изменилась. Обновите страницу.'});
 await transaction(async db=>{
  const {rows:owned}=await db.query("SELECT s.id FROM students s JOIN parent_students ps ON ps.student_id=s.id WHERE s.id=ANY($1::int[]) AND ps.parent_user_id=$2 AND s.tutor_id=$3 AND s.category<>'adult' FOR SHARE OF s",[students,req.user.id,req.user.tid]);
  if(owned.length!==students.length)throw Object.assign(Error('Ребёнок не привязан к вашему аккаунту'),{status:404});
  for(const sid of students)for(const id of ids)await db.query(`INSERT INTO guardian_acceptances(parent_user_id,student_id,document_id,relationship,ip,user_agent) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(parent_user_id,student_id,document_id) WHERE revoked_at IS NULL DO NOTHING`,[req.user.id,sid,id,req.body.relationship,String(req.ip||'').slice(0,64),String(req.get('user-agent')||'').slice(0,300)]);
  for(const id of ids)await db.query('INSERT INTO document_acceptances(user_id,document_id,ip,user_agent) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[req.user.id,id,String(req.ip||'').slice(0,64),String(req.get('user-agent')||'').slice(0,300)]);
  await db.query('UPDATE students SET pd_consent_at=NOW() WHERE id=ANY($1::int[])',[students]);
 });res.json({ok:true});
}));
protectedRouter.post('/guardian-revoke',requireRole('parent'),validateBody(z.object({student_id:z.number().int().positive()}).strict()),asyncHandler(async(req,res)=>{
 const {rows:[s]}=await query('SELECT s.id FROM students s JOIN parent_students ps ON ps.student_id=s.id WHERE s.id=$1 AND ps.parent_user_id=$2 AND s.tutor_id=$3',[req.body.student_id,req.user.id,req.user.tid]);if(!s)return res.status(404).json({error:'Ребёнок не найден'});
 await query('UPDATE guardian_acceptances SET revoked_at=NOW() WHERE parent_user_id=$1 AND student_id=$2 AND revoked_at IS NULL',[req.user.id,s.id]);res.json({ok:true});
}));

protectedRouter.post(
  '/accept',
  validateBody(z.object({ document_ids: z.array(z.number().int().positive()).min(1).max(10) }).strict()),
  asyncHandler(async (req, res) => {
    const kinds = await requiredKinds(req.user);
    const docs = (await currentDocs(req.user.tid)).filter((d) => kinds.includes(d.kind));
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
      // Подтверждение за ребёнка записывается только отдельным действием /guardian-accept.
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
    const docs = await currentDocs(req.user.id);
    const { rows: stats } = await query(
      `SELECT d.kind, d.version, COUNT(a.id)::int AS accepted
         FROM legal_documents d LEFT JOIN document_acceptances a ON a.document_id = d.id
        WHERE d.tutor_id = $1
        GROUP BY d.kind, d.version`,
      [req.user.id]
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
    await ensureDefaults(req.user.id);
    const { rows } = await query(
      `INSERT INTO legal_documents (kind, version, title, body, tutor_id)
       SELECT $1::varchar, COALESCE(MAX(version), 0) + 1, $2::varchar, $3::text, $4::int
         FROM legal_documents WHERE kind = $1::varchar AND tutor_id = $4::int
       RETURNING id, kind, version, title, published_at`,
      [kind, req.body.title, req.body.body, req.user.id]
    );
    console.log(`📝 Документ ${kind}: версия ${rows[0].version}`);
    res.json(rows[0]);
  })
);

module.exports = { publicRouter, protectedRouter };
