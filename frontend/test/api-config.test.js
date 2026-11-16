import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveApiBase } from '../src/api-config.js';

test('explicit API configuration is respected on the production domain', () => {
  assert.equal(resolveApiBase('https://stage.example.org/api/', 'lessonfold.ru'), 'https://stage.example.org');
});
test('local development and production defaults', () => {
  assert.equal(resolveApiBase('', 'localhost'), 'http://localhost:3001');
  assert.equal(resolveApiBase('', '127.0.0.1'), 'http://localhost:3001');
  assert.equal(resolveApiBase('', '[::1]'), 'http://localhost:3001');
  assert.equal(resolveApiBase('', 'lessonfold.ru'), 'https://api.lessonfold.ru');
  assert.equal(resolveApiBase('', 'test.relaxdev.ru'), 'https://tutor-platform.relaxdev.ru');
});
test('a public site never sends its token to localhost or a malformed URL', () => {
  for (const raw of ['http://localhost:3001', 'https://127.0.0.1:3001', '${API_URL}', 'https://user:password@example.org', 'https://example.org?key=secret', 'https://example.org/#x']) {
    assert.equal(resolveApiBase(raw, 'lessonfold.ru'), 'https://api.lessonfold.ru', raw);
  }
  assert.equal(resolveApiBase('http://localhost:3002/api', 'localhost'), 'http://localhost:3002');
});
