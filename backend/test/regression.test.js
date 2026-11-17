// Real HTTP requests and real PostgreSQL. Only an explicitly supplied disposable TEST_DATABASE_URL is used.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

test('audit: security and subscription regressions', { skip: !process.env.TEST_DATABASE_URL }, async (t) => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.JWT_SECRET = 'audit-only-secret-not-for-production-123456789';
  const express = require('express');
  const { query, pool } = require('../src/db');
  const auth = require('../src/middleware/auth');
  await require('../src/services/migrate').migrate({ log: () => {} });
  await require('../src/services/schema').ensureAll();
  const app = express();
  app.use(express.json());
  app.use('/auth', require('../src/routes/auth'));
  app.use('/public', require('../src/routes/leads').publicRouter);
  app.use(auth.authenticate, auth.requirePasswordChanged);
  app.get('/identity', (req, res) => res.json(req.user));
  app.use('/students', require('../src/routes/students'));
  app.use('/leads', require('../src/routes/leads').router);
  app.use('/books', require('../src/routes/books'));
  app.use('/plan', require('../src/routes/plans').router);
  app.use('/booking', require('../src/routes/booking'));
  app.use('/games', require('../src/routes/games'));
  app.use('/finance', require('../src/routes/finance'));
  app.use('/bank', require('../src/routes/bank'));
  app.use('/groups', require('../src/routes/groups'));
  app.use((err, req, res, next) => res.status(500).json({ error: err.message }));
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(async () => { await new Promise((r) => server.close(r)); await pool.end(); });
  const request = async (method, path, user, body) => {
    const r = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${typeof user === 'string' ? user : auth.signToken(user)}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: r.status, body: await r.json() };
  };
  const tutor = async () => (await query(`INSERT INTO users (role, login, full_name, password_hash, plan)
    VALUES ('tutor', $1, 'Audit tutor', 'hash', 'start') RETURNING *`, [`audit_${crypto.randomUUID()}`])).rows[0];
  const student = async (u, extra = '') => (await query(`INSERT INTO students (tutor_id, full_name ${extra ? ', '+extra : ''}) VALUES ($1, 'Audit student' ${extra ? ', TRUE' : ''}) RETURNING *`, [u.id])).rows[0];

  await t.test('a token without a password stamp is rejected', async () => {
    const u = await tutor();
    const legacy = require('jsonwebtoken').sign({ userId: u.id }, process.env.JWT_SECRET);
    assert.equal((await request('GET', '/identity', legacy)).status, 401);
  });
  await t.test('deactivating a tutor also closes access for their students', async () => {
    const u = await tutor();
    const { rows: [s] } = await query(`INSERT INTO users (role, login, full_name, password_hash, tutor_id) VALUES ('student', $1, 'Child', 'hash', $2) RETURNING *`, [`audit_${crypto.randomUUID()}`, u.id]);
    await query('UPDATE users SET is_active = FALSE WHERE id = $1', [u.id]);
    assert.equal((await request('GET', '/identity', s)).status, 401);
  });
  await t.test('a password reset link can be consumed only once, including parallel requests', async () => {
    const u = await tutor();
    const token = crypto.randomBytes(32).toString('hex');
    await query(`INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, NOW()+INTERVAL '1 hour')`, [u.id, crypto.createHash('sha256').update(token).digest('hex')]);
    const r = await Promise.all([request('POST', '/auth/reset', null, { token, password: 'first-password' }), request('POST', '/auth/reset', null, { token, password: 'second-password' })]);
    assert.deepEqual(r.map((v) => v.status).sort(), [200, 400]);
  });
  await t.test('parallel student creation cannot exceed the free plan limit', async () => {
    const u = await tutor(); await student(u); await student(u);
    const r = await Promise.all(Array.from({ length: 4 }, (_, i) => request('POST', '/students', u, { full_name: `Parallel ${i}` })));
    assert.equal(r.filter((v) => v.status === 201).length, 1, JSON.stringify(r));
    assert.equal((await query('SELECT COUNT(*)::int AS n FROM students WHERE tutor_id=$1', [u.id])).rows[0].n, 3);
  });
  await t.test('the active student limit does not block creating an archived student', async () => {
    const u = await tutor(); await student(u); await student(u); await student(u);
    assert.equal((await request('POST', '/students', u, { full_name: 'Archived student', status: 'archived' })).status, 201);
  });
  await t.test('plan usage excludes demo students', async () => {
    const u = await tutor(); await student(u); await student(u, 'is_demo');
    const r = await request('GET', '/plan', u);
    assert.equal(r.status, 200); assert.equal(r.body.usage.students, 1);
  });
  await t.test('parallel conversion of one lead creates one student', async () => {
    const u = await tutor();
    const { rows: [lead] } = await query(`INSERT INTO leads (tutor_id, full_name, contact, age_group, consent_at) VALUES ($1, 'Audit lead', 'test contact', 'adult', NOW()) RETURNING id`, [u.id]);
    const r = await Promise.all([request('POST', `/leads/${lead.id}/convert`, u), request('POST', `/leads/${lead.id}/convert`, u)]);
    assert.ok(r.every((v) => v.status === 200 || v.status === 201), JSON.stringify(r));
    assert.equal(r[0].body.student_id, r[1].body.student_id);
    assert.equal((await query('SELECT COUNT(*)::int AS n FROM students WHERE tutor_id=$1', [u.id])).rows[0].n, 1);
  });
  await t.test('parallel book reservations cannot exceed storage quota', async () => {
    const u = await tutor();
    const r = await Promise.all([1, 2].map((i) => request('POST', '/books', u, { title: `Book ${i}`, filename: 'book.pdf', mime: 'application/pdf', size_bytes: 60 * 1024 * 1024 })));
    assert.deepEqual(r.map((v) => v.status).sort(), [201, 402]);
  });
  await t.test('parallel bank copies cannot exceed the monthly free allowance', async () => {
    const u = await tutor();
    const ids = [];
    for (let i = 0; i < 16; i++) {
      const { rows: [item] } = await query(`INSERT INTO bank_items (book, unit, kind, title) VALUES ('audit', '1', 'task', $1) RETURNING id`, [`Audit ${i}`]);
      ids.push(item.id);
    }
    for (const id of ids.slice(0, 14)) await query('INSERT INTO bank_takes (item_id,tutor_id) VALUES ($1,$2)', [id,u.id]);
    const r = await Promise.all(ids.slice(14).map((id) => request('POST', `/bank/items/${id}/take`, u)));
    assert.deepEqual(r.map((v) => v.status).sort(), [200, 402]);
  });
  await t.test('taking the same bank item twice creates only one copy', async () => {
    const u = await tutor();
    const { rows: [item] } = await query(`INSERT INTO bank_items (book, unit, kind, title) VALUES ('audit', '1', 'task', 'Same item') RETURNING id`);
    const r = await Promise.all([request('POST', `/bank/items/${item.id}/take`, u), request('POST', `/bank/items/${item.id}/take`, u)]);
    assert.ok(r.every((v) => v.status === 200), JSON.stringify(r));
    assert.equal(r[0].body.library_id,r[1].body.library_id);
  });
  await t.test('a new booking cannot pass a lesson_id to exclude an occupied time', async () => {
    const u = await tutor(); const s = await student(u);
    const { rows: [child] } = await query(`INSERT INTO users (role, login, full_name, password_hash, tutor_id) VALUES ('student', $1, 'Child', 'hash', $2) RETURNING *`, [`audit_${crypto.randomUUID()}`, u.id]);
    await query('UPDATE students SET user_id=$2 WHERE id=$1', [s.id, child.id]);
    const r = await request('POST', '/booking/requests', child, { kind: 'book', student_id: s.id, lesson_id: 1, starts_at: new Date(Date.now()+3*864e5).toISOString() });
    assert.equal(r.status, 400);
  });
  await t.test('the income summary requires the paid finance feature', async () => {
    const u = await tutor();
    assert.equal((await request('GET', '/finance/summary', u)).status, 402);
  });
  await t.test('a parent cannot submit learning results on behalf of a child', async () => {
    const u = await tutor(); const a = await student(u); const b = await student(u);
    const { rows: [p] } = await query(`INSERT INTO users (role, login, full_name, password_hash, tutor_id) VALUES ('parent', $1, 'Parent', 'hash', $2) RETURNING *`, [`audit_${crypto.randomUUID()}`, u.id]);
    await query('INSERT INTO parent_students (parent_user_id,student_id) VALUES ($1,$2),($1,$3)', [p.id,a.id,b.id]);
    const { rows: [item] } = await query(`INSERT INTO library_items (kind,subject,title,html,tutor_id) VALUES ('html','English','Audit HTML','<p>Test</p>',$1) RETURNING id`, [u.id]);
    const { rows: [l] } = await query(`INSERT INTO lessons (student_id, starts_at) VALUES ($1,NOW()) RETURNING id`, [a.id]);
    await query('INSERT INTO lesson_items (lesson_id,item_id) VALUES ($1,$2)', [l.id,item.id]);
    assert.equal((await request('POST', `/games/${item.id}/results`, p, { student_id:b.id,answers:{correct:1,total:1} })).status, 403);
    assert.equal((await request('POST', `/games/${item.id}/results`, p, { student_id:a.id, lesson_id:l.id,answers:{correct:1,total:1} })).status, 403);
  });
  await t.test('one tutor cannot read another tutor’s student', async () => {
    const a = await tutor(); const b = await tutor(); const s = await student(a);
    assert.equal((await request('GET', `/students/${s.id}`, b)).status, 404);
  });
  await t.test('Zod 4 accepts named answers on the public enquiry form', async () => {
    const u = await tutor();
    await query('INSERT INTO settings (key,value) VALUES ($1,$2)', [`profile:${u.id}`, JSON.stringify({ enabled: true })]);
    const r = await request('POST', `/public/tutors/${u.login}/leads`, null, {
      full_name: 'Audit enquiry', contact: '@audit_contact', answers: { q1: 1, q2: 'test' }, consent: true,
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));
  });
  await t.test('Zod 4 preserves the Russian consent error', async () => {
    const r = await request('POST', '/auth/register', null, {
      full_name: 'Audit teacher', email: 'audit@example.com', password: 'audit-password', subject: 'English', accept: false,
    });
    assert.equal(r.status, 400);
    assert.ok(r.body.details.some((s) => s.includes('Нужно принять условия платформы')));
  });
  await t.test('Zod 4 accepts attendance keyed by student and records the actual status', async () => {
    const u = await tutor(); const s = await student(u);
    await query("UPDATE users SET plan='tutor' WHERE id=$1", [u.id]);
    const g = await request('POST', '/groups', u, { name: 'Audit group', student_ids: [s.id] });
    assert.equal(g.status, 201, JSON.stringify(g.body));
    const startsAt = new Date().toISOString();
    const { rows: [l] } = await query('INSERT INTO lessons (student_id,starts_at,group_id) VALUES ($1,$2,$3) RETURNING id', [s.id, startsAt, g.body.id]);
    const r = await request('POST', `/groups/${g.body.id}/lessons/finish`, u, { starts_at: startsAt, attendance: { [s.id]: 'missed' } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal((await query('SELECT status FROM lessons WHERE id=$1', [l.id])).rows[0].status, 'missed');
  });
  await t.test('backup reads one consistent snapshot while other requests change data', async () => {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const { Pool } = require('pg');
    await query('CREATE TABLE audit_snapshot_a (value integer); CREATE TABLE audit_snapshot_z (value integer); INSERT INTO audit_snapshot_a VALUES (1); INSERT INTO audit_snapshot_z VALUES (1)');
    const writer = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    const client = await pool.connect();
    const connect = pool.connect;
    const clientQuery = client.query;
    let changed = false;
    client.query = async function (...args) {
      const result = await clientQuery.apply(this, args);
      if (!changed && String(args[0]).includes('FROM "audit_snapshot_a"') && result.rows.length) {
        changed = true;
        await writer.query('BEGIN; UPDATE audit_snapshot_a SET value=2; UPDATE audit_snapshot_z SET value=2; COMMIT');
      }
      return result;
    };
    pool.connect = async () => client;
    process.env.BACKUP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'lf-audit-snapshot-'));
    let file;
    try { file = await require('../src/services/backup').makeFile('audit-backup-key'); }
    finally { pool.connect = connect; client.query = clientQuery; await writer.end(); }
    const lines = require('../src/services/backup').openFile(file, 'audit-backup-key');
    const values = {};
    let table;
    for (const row of lines) {
      if (!Array.isArray(row)) table = row.table;
      else if (table === 'audit_snapshot_a' || table === 'audit_snapshot_z') values[table] = row[0];
    }
    assert.equal(changed, true);
    assert.deepEqual(values, { audit_snapshot_a: 1, audit_snapshot_z: 1 });
    fs.rmSync(process.env.BACKUP_DIR, { recursive: true, force: true });
  });
});
