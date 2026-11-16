const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('audit: legacy migrations and atomic journal', { skip: !process.env.TEST_MIGRATION_DATABASE_URL }, async (t) => {
  process.env.DATABASE_URL = process.env.TEST_MIGRATION_DATABASE_URL;
  const { pool } = require('../src/db');
  t.after(() => pool.end());
  const dir = path.join(__dirname, '../migrations');
  const migrate = require('../src/services/migrate').migrate;
  for (const f of fs.readdirSync(dir).filter((f) => /^\d{3}_/.test(f) && Number(f.slice(0, 3)) <= 13).sort()) {
    await pool.query(fs.readFileSync(path.join(dir, f), 'utf8'));
  }
  await t.test('a manually initialized legacy database receives migrations 014–018', async () => {
    const applied = await migrate({ log: () => {} });
    assert.equal(applied.length, 5);
    assert.ok(applied[0].startsWith('014_'));
    const { rows } = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='email'");
    assert.equal(rows.length, 1);
    assert.deepEqual(await migrate({ log: () => {} }), []);
  });
  await t.test('an incorrect old journal is repaired when newer columns are missing', async () => {
    await pool.query('ALTER TABLE users DROP COLUMN email');
    await pool.query('ALTER TABLE homework DROP COLUMN draft, DROP COLUMN draft_at');
    await pool.query('DROP TABLE password_resets');
    const applied = await migrate({ log: () => {} });
    assert.deepEqual(applied.map((f) => Number(f.slice(0, 3))), [15, 17, 18]);
    assert.deepEqual(await migrate({ log: () => {} }), []);
  });
  await t.test('a failed historical SQL file does not partially commit its schema', async () => {
    const filename = '019_audit_transaction.sql';
    const originalRead = fs.readFileSync;
    const originalList = fs.readdirSync;
    fs.readdirSync = function (target, ...rest) { const result = originalList.call(this, target, ...rest); return String(target) === dir ? [...result, filename] : result; };
    fs.readFileSync = function (target, ...rest) {
      if (String(target) === path.join(dir, filename)) return 'BEGIN;\nCREATE TABLE audit_transaction_probe(id integer);\nCOMMIT;\nSELECT audit_function_that_does_not_exist();';
      return originalRead.call(this, target, ...rest);
    };
    try { await assert.rejects(migrate({ log: () => {} }), /audit_function_that_does_not_exist/); }
    finally { fs.readFileSync = originalRead; fs.readdirSync = originalList; }
    assert.equal((await pool.query("SELECT to_regclass('public.audit_transaction_probe') AS name")).rows[0].name, null);
    assert.equal((await pool.query('SELECT 1 FROM schema_migrations WHERE name=$1', [filename])).rows.length, 0);
  });
});
