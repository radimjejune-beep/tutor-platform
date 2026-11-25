import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, mkdir, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {staticServer} from '../scripts/static-server.mjs';
import {checkDeployment} from '../scripts/check-deployment.mjs';

async function serve(t, server) {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}
const html = '<script type="module" src="/assets/index-12345678.js"></script><link rel="stylesheet" href="/assets/index-12345678.css">';

test('deployment check accepts fresh HTML, correctly typed immutable assets and genuine 404s', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'lf-deployment-'));
  t.after(() => rm(directory, {recursive:true, force:true}));
  await mkdir(join(directory, 'assets'));
  await writeFile(join(directory, 'index.html'), html);
  await writeFile(join(directory, 'assets/index-12345678.js'), 'export {};');
  await writeFile(join(directory, 'assets/index-12345678.css'), 'body{}');
  const result = await checkDeployment(await serve(t, staticServer(directory)));
  assert.equal(result.ok, true);
  assert.equal(result.checks.length, 6);
});

test('deployment check rejects HTML fallback for absent assets and missing cache policy', async t => {
  const server = createServer((req, res) => { res.writeHead(200, {'Content-Type':'text/html'}); res.end(req.method === 'HEAD' ? '' : html); });
  const result = await checkDeployment(await serve(t, server));
  assert.equal(result.ok, false);
  assert.equal(result.checks.find(check => check.name === 'HTML').ok, false);
  assert.equal(result.checks.filter(check => check.name.startsWith('Отсутствующий')).every(check => !check.ok), true);
  assert.equal(result.checks.filter(check => check.name === 'Файл сборки').every(check => !check.ok), true);
});
