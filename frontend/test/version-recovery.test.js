import test from 'node:test';
import assert from 'node:assert/strict';
import { isAssetLoadError, recoveryUrl } from '../src/version-recovery.js';

test('Safari and Chromium asset errors are recognized; application errors are not', () => {
  for (const message of [
    "'text/html' is not a valid JavaScript MIME type.",
    'Did not parse stylesheet because non CSS MIME types are not allowed in strict mode.',
    'Failed to fetch dynamically imported module: https://lessonfold.ru/assets/old.js',
    'Importing a module script failed.',
    'Unable to preload CSS for /assets/old.css',
  ]) assert.equal(isAssetLoadError(new TypeError(message)), true, message);
  assert.equal(isAssetLoadError(new TypeError("Cannot read properties of undefined (reading 'filter')")), false);
});

test('recovery bypasses cached HTML and preserves the current route and query', () => {
  const next = new URL(recoveryUrl('https://lessonfold.ru/?campaign=one#/homework/new?student=42', 0, 100000));
  assert.equal(next.origin, 'https://lessonfold.ru');
  assert.equal(next.searchParams.get('campaign'), 'one');
  assert.equal(next.searchParams.get('lf_reload'), '100000');
  assert.equal(next.hash, '#/homework/new?student=42');
});

test('automatic recovery cannot loop, even without sessionStorage', () => {
  const next = recoveryUrl('https://lessonfold.ru/#/login', 0, 100000);
  assert.equal(recoveryUrl(next, 0, 100001), null);
  assert.equal(recoveryUrl('https://lessonfold.ru/#/', 99999, 100000), null);
  assert.ok(recoveryUrl(next, 0, 160001));
});

test('an explicit user retry is allowed during the cooldown', () => {
  assert.ok(recoveryUrl('https://lessonfold.ru/?lf_reload=100000#/', 100000, 100001, true));
});
