// test/db.test.js — проверки с базой данных. Нужен DATABASE_URL на пустую тестовую базу:
//   DATABASE_URL=postgres://postgres@localhost:5432/lessonfold_test npm test
// Без DATABASE_URL эти проверки пропускаются.
const { src, loadRoutes, call, uniq, hasDb } = require('./helpers');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-test-secret-test-secret-123';
const opts = { skip: hasDb ? false : 'нет DATABASE_URL' };

test('база данных', opts, async (t) => {
  process.env.BACKUP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'lf-bk-'));
  process.env.BACKUP_KEY = 'test-key-for-backups-only';
  const { query, pool } = require(src('db.js'));
  t.after(() => pool.end && pool.end().catch(() => {}));

  await t.test('миграции и схема накатываются, повторный запуск ничего не ломает', async () => {
    const { migrate } = require(src('services/migrate.js'));
    const { ensureAll } = require(src('services/schema.js'));
    await migrate();
    await ensureAll();
    await migrate();
    const { rows } = await query('SELECT COUNT(*)::int AS n FROM schema_migrations');
    const files = fs.readdirSync(path.join(__dirname, '..', 'migrations')).filter((f) => /^\d{3}_.*\.sql$/.test(f));
    assert.equal(rows[0].n, files.length);
  });

  const tutor = async (extra = {}) => {
    const login = uniq('t');
    const { rows } = await query(
      `INSERT INTO users (role, login, password_hash, full_name, is_admin) VALUES ('tutor', $1, 'x', $1, $2) RETURNING id`,
      [login, Boolean(extra.is_admin)]
    );
    const id = rows[0].id;
    if (extra.sql) await query(extra.sql, [id]);
    return { id, tid: id, role: 'tutor', login, is_admin: Boolean(extra.is_admin) };
  };
  const student = async (tid, name = 'Ученик') => (await query('INSERT INTO students (full_name, tutor_id) VALUES ($1, $2) RETURNING id', [name, tid])).rows[0].id;

  await t.test('преподаватель не видит чужих учеников', async () => {
    const auth = require(src('middleware/auth.js'));
    const a = await tutor();
    const b = await tutor();
    const sa = await student(a.id);
    assert.equal(await auth.canAccessStudent(a, sa), true);
    assert.equal(await auth.canAccessStudent(b, sa), false);
    assert.equal(await auth.owns(b, 'students', sa), false);
    const ids = await auth.accessibleStudentIds(b);
    assert.equal((ids || []).includes(sa), false);
  });

  await t.test('на «Старте» не больше 3 учеников', async () => {
    const plans = require(src('services/plans.js'));
    const a = await tutor({ sql: "UPDATE users SET plan = 'start', plan_until = NULL WHERE id = $1" });
    plans.forget(a.id);
    for (const n of ['А', 'Б']) await student(a.id, n);
    assert.equal(await plans.studentLimit(a.id), null);
    await student(a.id, 'В');
    assert.match(String(await plans.studentLimit(a.id)), /3/);
  });

  await t.test('условия платформы: новая редакция ждёт согласия, после принятия больше не спрашивает', async () => {
    const { mod } = loadRoutes('routes/platformDocs.js');
    const prot = mod.protectedRouter;
    const a = await tutor();
    let out = await call(prot, 'GET', '/', { user: a });
    assert.equal(out.body.pending, true);
    assert.equal(out.body.docs.length, 3);
    out = await call(prot, 'POST', '/accept', { user: a });
    assert.equal(out.body.ok, true);
    out = await call(prot, 'GET', '/', { user: a });
    assert.equal(out.body.pending, false);
    const b = await tutor();
    await mod.acceptOnRegister(b.id, '10.0.0.1');
    assert.equal((await call(prot, 'GET', '/', { user: b })).body.pending, false);
    const pub = await call(mod.publicRouter, 'GET', '/:kind', { params: { kind: 'nope' } });
    assert.equal(pub.status, 404);
  });

  await t.test('первые шаги на главной отмечаются по мере работы', async () => {
    const { mod } = loadRoutes('routes/dashboard.js');
    const a = await tutor();
    let out = await call(mod, 'GET', '/onboarding', { user: a });
    assert.equal(out.body.steps.length, 5);
    assert.equal(out.body.steps.find((s) => s.key === 'student').done, false);
    await student(a.id);
    out = await call(mod, 'GET', '/onboarding', { user: a });
    assert.equal(out.body.steps.find((s) => s.key === 'student').done, true);
  });

  await t.test('метрики для сисадмина: только сисадмину, числа считаются', async () => {
    const { mod } = loadRoutes('routes/admin.js');
    const plain = await tutor();
    const admin = await tutor({ is_admin: true });
    const denied = await call(mod, 'GET', '/metrics', { user: plain });
    assert.equal(denied.status, 403);
    const out = await call(mod, 'GET', '/metrics', { user: admin });
    assert.equal(out.status, 200);
    assert.ok(out.body.tutors >= 1);
    assert.equal(typeof out.body.mrr, 'number');
    const sys = await call(mod, 'GET', '/system', { user: admin });
    assert.equal(sys.body.backup_key, true);
  });

  await t.test('сообщения пробного периода уходят один раз', async () => {
    const trial = require(src('services/trial.js'));
    const a = await tutor({ sql: "UPDATE users SET plan = 'trial', plan_until = NOW() + INTERVAL '1 day', created_at = NOW() - INTERVAL '13 days' WHERE id = $1" });
    await trial.run();
    await trial.run();
    const { rows } = await query("SELECT kind FROM trial_messages WHERE user_id = $1", [a.id]);
    assert.deepEqual(rows.map((r) => r.kind), ['ending']);
    const n = await query("SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND kind = 'trial'", [a.id]);
    assert.equal(n.rows[0].n, 1);
  });

  await t.test('резервная копия: шифруется, читается своим ключом и не читается чужим', async () => {
    const backup = require(src('services/backup.js'));
    const a = await tutor();
    const r = await backup.run({ reason: 'тест' });
    assert.equal(r.ok, true, r.error);
    const file = path.join(process.env.BACKUP_DIR, r.file);
    const lines = backup.openFile(file, process.env.BACKUP_KEY);
    const head = lines.findIndex((l) => l.table === 'users');
    const cols = lines[head].columns;
    const loginAt = cols.indexOf('login');
    const users = [];
    for (let i = head + 1; i < lines.length && Array.isArray(lines[i]); i++) users.push(lines[i][loginAt]);
    assert.ok(users.includes(a.login));
    assert.throws(() => backup.openFile(file, 'wrong-key'));
    assert.equal((await backup.state()).ok, true);
  });

  await t.test('учебники и файлы уходят в S3, если оно настроено, и удаляются оттуда', async () => {
    const s3 = require(src('services/s3.js'));
    const bucket = new Map();
    const saved = { ...s3 };
    Object.assign(s3, {
      enabled: () => true,
      putBuffer: async (k, buf) => { bucket.set(k, Buffer.from(buf)); },
      getBuffer: async (k) => { if (!bucket.has(k)) throw new Error('нет объекта'); return bucket.get(k); },
      remove: async (k) => { bucket.delete(k); },
      list: async (prefix) => [...bucket.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key, size: 1, modified: new Date(0) })),
    });
    t.after(() => Object.assign(s3, saved));
    const { mod } = loadRoutes('routes/books.js');
    const a = await tutor();
    const content = Buffer.from('%PDF-1.4 test book '.repeat(50));
    const made = await call(mod, 'POST', '/', { user: a, body: { title: 'Книга', filename: 'b.pdf', mime: 'application/pdf', size_bytes: content.length } });
    assert.equal(made.status, 201, JSON.stringify(made.body));
    const { id, part_size: partSize, parts } = made.body;
    for (let n = 0; n < parts; n++) {
      const r = await call(mod, 'PUT', '/:id/parts/:n', { user: a, params: { id, n }, body: content.subarray(n * partSize, (n + 1) * partSize) });
      assert.equal(r.body.ok, true, JSON.stringify(r.body));
    }
    assert.equal((await call(mod, 'POST', '/:id/finish', { user: a, params: { id } })).body.ok, true);
    const { rows } = await query('SELECT data, s3_key FROM library_book_parts WHERE book_id = $1', [id]);
    assert.ok(rows.every((r) => r.data === null && r.s3_key));
    const file = await call(mod, 'GET', '/:id/file', { user: a, params: { id }, query: {} });
    assert.equal(Buffer.compare(file.body, content), 0);
    const other = await tutor();
    assert.equal((await call(mod, 'GET', '/:id/file', { user: other, params: { id }, query: {} })).status, 404);
    assert.equal(bucket.size, parts);
    await call(mod, 'DELETE', '/:id', { user: a, params: { id } });
    assert.equal(bucket.size, 0);
    const storage = require(src('services/storage.js'));
    bucket.set('files/2020-01/lost', Buffer.from('x'));
    assert.equal(await storage.sweep(), 1);
  });

  await t.test('пример для нового преподавателя: создаётся, не мешает тарифу и первым шагам, удаляется целиком', async () => {
    const { mod } = loadRoutes('routes/demo.js');
    const dash = loadRoutes('routes/dashboard.js').mod;
    const plans = require(src('services/plans.js'));
    const a = await tutor({ sql: "UPDATE users SET plan = 'start', plan_until = NULL WHERE id = $1" });
    plans.forget(a.id);
    assert.equal((await call(mod, 'GET', '/', { user: a })).body.active, false);
    const made = await call(mod, 'POST', '/', { user: a });
    assert.equal(made.status, 201, JSON.stringify(made.body));
    assert.equal((await call(mod, 'POST', '/', { user: a })).status, 409);
    const { rows: st } = await query('SELECT id FROM students WHERE tutor_id = $1', [a.id]);
    assert.equal(st.length, 2);
    const { studentFinance } = require(src('services/billing.js'));
    const fin = await Promise.all(st.map((s) => studentFinance({ query }, s.id)));
    assert.ok(fin.some((f) => f.lessons_remaining > 0), JSON.stringify(fin));
    const onb = await call(dash, 'GET', '/onboarding', { user: a });
    assert.equal(onb.body.steps.find((s) => s.key === 'student').done, false);
    assert.equal(await plans.studentLimit(a.id), null);
    const sub = await query("SELECT COUNT(*)::int AS n FROM homework h JOIN students s ON s.id = h.student_id WHERE s.tutor_id = $1 AND h.status = 'submitted'", [a.id]);
    assert.equal(sub.rows[0].n, 1);
    await call(mod, 'DELETE', '/', { user: a });
    const left = await query('SELECT (SELECT COUNT(*) FROM students WHERE tutor_id = $1)::int AS s, (SELECT COUNT(*) FROM assignments WHERE tutor_id = $1)::int AS a', [a.id]);
    assert.deepEqual(left.rows[0], { s: 0, a: 0 });
  });

  await t.test('после проведённого урока без ДЗ преподавателю приходит напоминание, один раз', async () => {
    const nudge = require(src('services/hwnudge.js'));
    await nudge.ensure();
    const a = await tutor();
    const s1 = await student(a.id, 'Без ДЗ');
    const s2 = await student(a.id, 'С ДЗ');
    const lesson = (sid) => query(`INSERT INTO lessons (student_id, starts_at, duration_min, status, price) VALUES ($1, NOW() - INTERVAL '2 hours', 60, 'done', 1000)`, [sid]);
    await lesson(s1); await lesson(s2);
    const { rows: asg } = await query(`INSERT INTO assignments (title, tutor_id) VALUES ('ДЗ', $1) RETURNING id`, [a.id]);
    await query('INSERT INTO homework (assignment_id, student_id) VALUES ($1, $2)', [asg[0].id, s2]);
    await nudge.run();
    await nudge.run();
    const { rows } = await query("SELECT title, link FROM notifications WHERE user_id = $1 AND kind = 'homework_nudge'", [a.id]);
    assert.equal(rows.length, 1, JSON.stringify(rows));
    assert.match(rows[0].title, /Без ДЗ/);
    assert.equal(rows[0].link, `/homework/new?student=${s1}`);
  });

  await t.test('библиотека: папки создаются (тело запроса доходит до маршрута)', async () => {
    const { mod } = loadRoutes('routes/folders.js');
    const a = await tutor();
    const r = await call(mod, 'POST', '/', { user: a, body: { title: 'Разговорные темы' } });
    assert.equal(r.status, 201, JSON.stringify(r.body));
  });

  await t.test('вход по почте: регистрация с почтой, вход по почте и по логину, одна почта на кабинет', async () => {
    const { mod } = loadRoutes('routes/auth.js');
    const r = mod.router || mod;
    await query(`INSERT INTO settings (key, value) VALUES ('registration', '{"open":true}') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`);
    const body = { full_name: 'Анна Учитель', email: 'Anna.T@Mail.ru', password: 'secret123', subject: 'Английский язык', accept: true };
    const reg = await call(r, 'POST', '/register', { body, ip: '10.0.0.1' });
    assert.equal(reg.status, 201, JSON.stringify(reg.body));
    assert.equal(reg.body.user.email, 'anna.t@mail.ru');
    assert.match(reg.body.user.login, /^anna\.t/);
    const dup = await call(r, 'POST', '/register', { body: { ...body, email: 'anna.t@mail.ru' }, ip: '10.0.0.2' });
    assert.equal(dup.status, 409);
    const byMail = await call(r, 'POST', '/login', { body: { login: 'anna.t@mail.ru', password: 'secret123' }, ip: '10.0.0.3' });
    assert.equal(byMail.status, 200, JSON.stringify(byMail.body));
    const byLogin = await call(r, 'POST', '/login', { body: { login: reg.body.user.login, password: 'secret123' }, ip: '10.0.0.4' });
    assert.equal(byLogin.status, 200);
    const bad = await call(r, 'POST', '/login', { body: { login: 'anna.t@mail.ru', password: 'wrong' }, ip: '10.0.0.5' });
    assert.equal(bad.status, 401);
  });

  await t.test('восстановление пароля: ссылка по почте, одноразовая, старый пароль больше не подходит', async () => {
    const r = loadRoutes('routes/auth.js').mod;
    const R = r.router || r;
    const mailer = require(src('services/mailer.js'));
    const sent = [];
    const orig = mailer.send;
    mailer.send = async (m) => { sent.push(m); return true; };
    try {
      const login = uniq('rp');
      await query(`INSERT INTO users (role, login, email, password_hash, full_name) VALUES ('tutor', $1, $2, $3, 'Рита')`, [login, `${login}@mail.ru`, await require('bcryptjs').hash('oldpass123', 4)]);
      const none = await call(R, 'POST', '/forgot', { body: { email: 'nobody@mail.ru' }, ip: '10.1.0.1' });
      assert.equal(none.status, 200);
      assert.equal(sent.length, 0);
      const f = await call(R, 'POST', '/forgot', { body: { email: `${login.toUpperCase()}@MAIL.RU` }, ip: '10.1.0.2' });
      assert.equal(f.status, 200);
      assert.equal(sent.length, 1);
      const token = sent[0].text.match(/token=([a-f0-9]{64})/)[1];
      const bad = await call(R, 'POST', '/reset', { body: { token: 'a'.repeat(64), password: 'newpass123' }, ip: '10.1.0.3' });
      assert.equal(bad.status, 400);
      const ok = await call(R, 'POST', '/reset', { body: { token, password: 'newpass123' }, ip: '10.1.0.4' });
      assert.equal(ok.status, 200, JSON.stringify(ok.body));
      const again = await call(R, 'POST', '/reset', { body: { token, password: 'other12345' }, ip: '10.1.0.5' });
      assert.equal(again.status, 400);
      const oldPw = await call(R, 'POST', '/login', { body: { login, password: 'oldpass123' }, ip: '10.1.0.6' });
      assert.equal(oldPw.status, 401);
      const newPw = await call(R, 'POST', '/login', { body: { login: `${login}@mail.ru`, password: 'newpass123' }, ip: '10.1.0.7' });
      assert.equal(newPw.status, 200);
    } finally { mailer.send = orig; }
  });

  await t.test('конструктор уроков: урок из слайдов сохраняется, кривой отклоняется, ученик не видит заметок', async () => {
    const mod = loadRoutes('routes/library.js').mod.router;
    const a = await tutor();
    const deck = { v: 1, theme: 'paper', slides: [
      { id: 's1', type: 'title', title: 'Present Continuous', notes: 'Цель урока' },
      { id: 's2', type: 'questions', title: 'Speak', items: ['What are you doing now?'], timer: 120, notes: 'Не исправлять' },
    ] };
    const bad = await call(mod, 'POST', '/', { user: a, body: { kind: 'deck', subject: 'Английский', title: 'Кривой', html: '{"v":1,"slides":[]}' } });
    assert.equal(bad.status, 400, JSON.stringify(bad.body));
    const r = await call(mod, 'POST', '/', { user: a, body: { kind: 'deck', subject: 'Английский', title: 'Урок', html: JSON.stringify(deck) } });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const list = await call(mod, 'GET', '/', { user: a, query: { kind: 'html' } });
    assert.ok(list.body.some((x) => x.id === r.body.id && x.kind === 'deck'), 'урок виден во вкладке «Уроки»');
    const own = await call(mod, 'GET', '/:id', { user: a, params: { id: r.body.id } });
    assert.equal(JSON.parse(own.body.html).slides[0].notes, 'Цель урока');
    const { forStudent } = require(src('services/deck.js'));
    const shown = JSON.parse(forStudent({ kind: 'deck', html: own.body.html }).html);
    assert.ok(shown.slides.every((x) => !x.notes));
    const up = await call(mod, 'PATCH', '/:id', { user: a, params: { id: r.body.id }, body: { kind: 'deck', html: '{"v":2}' } });
    assert.equal(up.status, 400);
  });

  await t.test('тестовый кабинет: создаётся с примером, открывает кабинет ученика, не виден в метриках, удаляется через срок', async () => {
    const { mod } = loadRoutes('routes/sandbox.js');
    const made = await call(mod.publicRouter, 'POST', '/', { ip: '10.1.1.1' });
    assert.equal(made.status, 201, JSON.stringify(made.body));
    const { rows: [u] } = await query("SELECT id, login, plan FROM users WHERE is_sandbox AND role = 'tutor' ORDER BY id DESC LIMIT 1");
    assert.match(u.login, /^test-/);
    const me = { id: u.id, tid: u.id, role: 'tutor', login: u.login };
    const st = await query('SELECT COUNT(*)::int AS n FROM students WHERE tutor_id = $1 AND user_id IS NOT NULL', [u.id]);
    assert.equal(st.rows[0].n, 2);
    assert.equal((await call(mod.router, 'GET', '/', { user: me })).body.sandbox, true);
    const as = await call(mod.router, 'POST', '/as-student', { user: me, body: {} });
    assert.ok(as.body.token, JSON.stringify(as.body));
    const plain = await tutor();
    assert.equal((await call(mod.router, 'POST', '/as-student', { user: plain, body: {} })).status, 403);
    const admin = await tutor({ is_admin: true });
    const list = await call(loadRoutes('routes/admin.js').mod, 'GET', '/tutors', { user: admin });
    assert.equal(JSON.stringify(list.body).includes(u.login), false);
    await query("UPDATE users SET created_at = NOW() - INTERVAL '10 days' WHERE id = $1", [u.id]);
    assert.ok((await mod.cleanup()) >= 1);
    const left = await query('SELECT (SELECT COUNT(*) FROM users WHERE login LIKE $1)::int AS u, (SELECT COUNT(*) FROM students WHERE tutor_id = $2)::int AS s', [`${u.login}%`, u.id]);
    assert.deepEqual(left.rows[0], { u: 0, s: 0 });
  });

  await t.test('черновик ответа ученика сохраняется и очищается при сдаче', async () => {
    const { mod } = loadRoutes('routes/homework.js');
    await mod.ensureDraft();
    const a = await tutor();
    const sid = await student(a.id, 'Черновик');
    const { rows: [u] } = await query(`INSERT INTO users (role, login, password_hash, full_name, tutor_id) VALUES ('student', $1, 'x', 'Черновик', $2) RETURNING id`, [uniq('s'), a.id]);
    await query('UPDATE students SET user_id = $1 WHERE id = $2', [u.id, sid]);
    const { rows: [asg] } = await query(`INSERT INTO assignments (title, tutor_id) VALUES ('ДЗ', $1) RETURNING id`, [a.id]);
    const { rows: [hw] } = await query('INSERT INTO homework (assignment_id, student_id) VALUES ($1, $2) RETURNING id', [asg.id, sid]);
    const me = { id: u.id, role: 'student', tid: a.id, student_ids: [sid] };
    const sUser = me;
    const r = await call(mod, 'PUT', '/:id/draft', { user: sUser, params: { id: hw.id }, body: { student_answer: 'Half done', quiz_answers: { q1: 'a' } } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const d = await query('SELECT draft, status FROM homework WHERE id = $1', [hw.id]);
    assert.equal(d.rows[0].draft.student_answer, 'Half done');
    assert.equal(d.rows[0].status, 'assigned');
    const sub = await call(mod, 'POST', '/:id/submit', { user: sUser, params: { id: hw.id }, body: { student_answer: 'Done' } });
    assert.equal(sub.status, 200, JSON.stringify(sub.body));
    const after = await query('SELECT draft, status FROM homework WHERE id = $1', [hw.id]);
    assert.equal(after.rows[0].draft, null);
    assert.equal((await call(mod, 'PUT', '/:id/draft', { user: sUser, params: { id: hw.id }, body: { student_answer: 'x' } })).status, 409);
  });

  await t.test('фоновая задача не запускается дважды одновременно', async () => {
    const { withLock } = require(src('services/jobs.js'));
    const { pool } = require(src('db.js'));
    const [c1, c2] = [await pool.connect(), await pool.connect()];
    const pids = [(await c1.query('SELECT pg_backend_pid() AS p')).rows[0].p, (await c2.query('SELECT pg_backend_pid() AS p')).rows[0].p];
    c1.release(); c2.release();
    if (pids[0] === pids[1]) return; // упрощённый драйвер с одним соединением: блокировка общая, проверять нечего
    let inside = 0;
    let max = 0;
    const job = () => withLock('test-lock', async () => { inside++; max = Math.max(max, inside); await new Promise((r) => setTimeout(r, 150)); inside--; return 'done'; });
    const res = await Promise.all([job(), job()]);
    assert.equal(max, 1);
    assert.ok(res.some((x) => x?.skipped || x === undefined || x === null));
  });
});
