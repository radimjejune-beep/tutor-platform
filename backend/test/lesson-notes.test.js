'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

test('post-lesson text editing preserves accounting, access and saved work', { skip: !process.env.TEST_DATABASE_URL }, async t => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  const { query, pool } = require('../src/db');
  await require('../src/services/migrate').migrate({ log: () => {} });
  await require('../src/services/schema').ensureAll();
  const person = async (role, tutorId) => (await query(
    "INSERT INTO users(role,login,password_hash,full_name,tutor_id) VALUES($1,$2,'fixture',$2,$3) RETURNING *",
    [role, 'notes_' + randomUUID().slice(0, 16), tutorId || null]
  )).rows[0];
  const owner = await person('tutor'), other = await person('tutor');
  const pupil = await person('student', owner.id), parent = await person('parent', owner.id);
  await query("UPDATE users SET plan='tutor',plan_until=NOW()+INTERVAL '1 year' WHERE id=$1", [owner.id]);
  const student = (await query("INSERT INTO students(tutor_id,user_id,full_name,category,subject) VALUES($1,$2,'Notes fixture','adult','Английский язык') RETURNING id", [owner.id, pupil.id])).rows[0];
  await query('INSERT INTO parent_students(parent_user_id,student_id) VALUES($1,$2)', [parent.id, student.id]);
  const subscription = (await query("INSERT INTO subscriptions(student_id,title,lessons_total,price_total,starts_on) VALUES($1,'Fixture package',4,3600,'2020-01-01') RETURNING id", [student.id])).rows[0];
  await query('INSERT INTO payments(student_id,subscription_id,amount) VALUES($1,$2,3600)', [student.id, subscription.id]);
  const auth = require('../src/middleware/auth');
  const server = require('../src/server').listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port + '/api';
  const request = async (user, path, method = 'GET', body) => {
    const response = await fetch(base + path, { method, headers: { Authorization: 'Bearer ' + auth.signToken(user), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() };
  };
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await pool.end(); });
  const makeLesson = async (status, charged) => (await query(
    "INSERT INTO lessons(student_id,starts_at,duration_min,status,price,charged,subscription_id,subject,topic,summary,private_notes,summary_sent_at) VALUES($1,NOW()-INTERVAL '2 hours',60,$2,900,$3,$4,'Английский язык','Before topic','Saved before failure','Only tutor',NOW()-INTERVAL '1 hour') RETURNING *",
    [student.id, status, charged, charged ? subscription.id : null]
  )).rows[0];
  const accounting = async () => ({
    subscriptions: (await query('SELECT * FROM subscriptions WHERE student_id=$1 ORDER BY id', [student.id])).rows,
    payments: (await query('SELECT * FROM payments WHERE student_id=$1 ORDER BY id', [student.id])).rows,
    notifications: (await query('SELECT * FROM notifications ORDER BY id')).rows,
  });
  const withoutNotes = row => Object.fromEntries(Object.entries(row).filter(([key]) => !['topic', 'summary', 'private_notes'].includes(key)));

  await t.test('completed, missed, cancelled and legacy uncharged lessons accept notes without any accounting change', async () => {
    for (const [status, charged] of [['done', true], ['done', false], ['missed', true], ['cancelled', false], ['scheduled', false]]) {
      const lesson = await makeLesson(status, charged), before = await accounting();
      const r = await request(owner, '/lessons/' + lesson.id + '/notes', 'PATCH', { topic: 'Updated topic', summary: 'What we practised', private_notes: 'Private correction' });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      const saved = (await query('SELECT * FROM lessons WHERE id=$1', [lesson.id])).rows[0];
      assert.equal(saved.summary, 'What we practised');
      assert.deepEqual(withoutNotes(saved), withoutNotes(lesson));
      assert.deepEqual(await accounting(), before);
      const retry = await request(owner, '/lessons/' + lesson.id + '/notes', 'PATCH', { summary: 'What we practised' });
      assert.equal(retry.status, 200);
      assert.deepEqual(await accounting(), before);
    }
  });
  await t.test('public recaps update for pupil and parent while private notes stay hidden', async () => {
    const lesson = await makeLesson('done', true);
    assert.equal((await request(owner, '/lessons/' + lesson.id + '/notes', 'PATCH', { summary: 'New recap', private_notes: 'Teacher secret' })).status, 200);
    for (const user of [pupil, parent]) {
      const room = await request(user, '/lessons/' + lesson.id + '/room');
      assert.equal(room.status, 200, JSON.stringify(room.body));
      assert.equal(room.body.summary, 'New recap');
      assert.equal(room.body.private_notes, undefined);
    }
  });
  await t.test('notes cannot change price, status or dates, and rejected input leaves saved text intact', async () => {
    const lesson = await makeLesson('done', true);
    for (const body of [{ status: 'scheduled' }, { summary: 'overwrite', price: 0 }, { starts_at: new Date().toISOString() }, {}, { summary: 'x'.repeat(5001) }]) {
      assert.equal((await request(owner, '/lessons/' + lesson.id + '/notes', 'PATCH', body)).status, 400);
      assert.deepEqual((await query('SELECT * FROM lessons WHERE id=$1', [lesson.id])).rows[0], lesson);
    }
    const r = await request(owner, '/lessons/' + lesson.id + '/notes', 'PATCH', { summary: null });
    assert.equal(r.status, 200); assert.equal(r.body.summary, null); assert.equal(r.body.topic, lesson.topic);
  });
  await t.test('another tutor, pupils and parents cannot edit the lesson', async () => {
    const lesson = await makeLesson('done', true);
    for (const [user, status] of [[other, 404], [pupil, 403], [parent, 403]]) assert.equal((await request(user, '/lessons/' + lesson.id + '/notes', 'PATCH', { summary: 'Unauthorized edit' })).status, status);
    assert.equal((await request(owner, '/lessons/2147483646/notes', 'PATCH', { summary: 'Missing' })).status, 404);
    assert.deepEqual((await query('SELECT * FROM lessons WHERE id=$1', [lesson.id])).rows[0], lesson);
  });
});
