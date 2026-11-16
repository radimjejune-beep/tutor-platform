import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { staticServer } from '../scripts/static-server.mjs';

test('production: HTML свежий, assets immutable, отсутствующий файл — 404 без HTML', async t => {
  const root = await mkdtemp(join(tmpdir(), 'lf-static-'));
  await mkdir(join(root, 'assets'));
  await writeFile(join(root, 'index.html'), '<!doctype html><h1>Lessonfold</h1>');
  await writeFile(join(root, 'assets/index-12345678.js'), 'export const ok = true;');
  await writeFile(join(root, 'assets/index-12345678.css'), 'body { color: black; }');
  const server = staticServer(root);
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  t.after(async () => { await new Promise(done => server.close(done)); await rm(root, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const url of ['/', '/index.html', '/?lf_reload=123', '/dashboard']) {
    const r = await fetch(base + url, { headers:{ Accept:'text/html' } });
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /text\/html/);
    assert.equal(r.headers.get('cache-control'), 'no-store');
  }
  for (const [name, mime] of [['js', 'application/javascript'], ['css', 'text/css']]) {
    const r = await fetch(`${base}/assets/index-12345678.${name}`);
    assert.equal(r.status, 200);
    assert.ok(r.headers.get('content-type').startsWith(mime));
    assert.match(r.headers.get('cache-control'), /immutable/);
    const missing = await fetch(`${base}/assets/old-file.${name}`, {headers:{Accept:'text/html'}});
    assert.equal(missing.status, 404);
    assert.equal(missing.headers.get('cache-control'), 'no-store');
    assert.doesNotMatch(await missing.text(), /<!doctype html>/);
  }
  for (const url of ['/fonts/missing.woff', '/.env', '/%2eenv', '/bad%00.js']) {
    assert.equal((await fetch(base + url)).status, 404, url);
  }
  assert.equal((await fetch(base + '/bad%ZZ')).status, 400);
  assert.equal((await fetch(base + '/', {method:'POST'})).status, 405);
  const head = await fetch(base + '/', {method:'HEAD'});
  assert.equal(await head.text(), '');
  assert.ok(Number(head.headers.get('content-length')) > 0);
});
