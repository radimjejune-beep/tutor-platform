import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Read-only check of the public frontend, including the stale-asset failure mode.
export async function checkDeployment(base, fetchImpl = fetch) {
  const origin = new URL(base);
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password) throw new Error('Укажите HTTP(S)-адрес сайта без логина и пароля');
  origin.pathname = '/'; origin.search = ''; origin.hash = '';
  const checks = [];
  async function get(path, method = 'HEAD') {
    const url = new URL(path, origin).href;
    try {
      const response = await fetchImpl(url, { method, cache: 'no-store', signal: AbortSignal.timeout(15000) });
      return { url, status: response.status, type: response.headers.get('content-type') || '', cache: response.headers.get('cache-control') || '', text: method === 'GET' ? await response.text() : '' };
    } catch (error) { return { url, status: 0, type: '', cache: '', text: '', error: error.cause?.code || error.message }; }
  }
  const html = await get('/', 'GET');
  checks.push({ name: 'HTML', ...html, text: undefined, ok: html.status === 200 && /text\/html/i.test(html.type) && /\bno-store\b/i.test(html.cache) });
  const assets = [...new Set([...html.text.matchAll(/(?:src|href)=["'](\/assets\/[^"']+\.(?:js|css))["']/g)].map(match => match[1]))];
  checks.push({ name: 'Ссылки на JS и CSS', ok: assets.some(path => path.endsWith('.js')) && assets.some(path => path.endsWith('.css')) });
  for (const path of assets) {
    const asset = await get(path);
    const mime = path.endsWith('.css') ? /text\/css/i : /(?:application|text)\/javascript/i;
    checks.push({ name: 'Файл сборки', ...asset, text: undefined, ok: asset.status === 200 && mime.test(asset.type) && /\bimmutable\b/i.test(asset.cache) });
  }
  for (const extension of ['js', 'css']) {
    const missing = await get(`/assets/lessonfold-check-missing-${randomUUID()}.${extension}`);
    checks.push({ name: `Отсутствующий ${extension.toUpperCase()}`, ...missing, text: undefined, ok: missing.status === 404 && !/text\/html/i.test(missing.type) && /\bno-store\b/i.test(missing.cache) });
  }
  return { base: origin.href, ok: checks.every(check => check.ok), checks };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await checkDeployment(process.argv[2] || 'https://lessonfold.ru');
    for (const check of result.checks) console.log(`${check.ok ? 'OK' : 'ОШИБКА'} · ${check.name}${check.url ? ` · ${check.url} · ${check.status} · ${check.type || 'нет MIME'} · ${check.cache || 'нет Cache-Control'}` : ''}${check.error ? ` · ${check.error}` : ''}`);
    if (result.checks.some(check => check.status === 0)) console.error('Не удалось получить HTTP-ответ: проверьте доступ к сайту, сеть и доверие к сертификату в среде проверки. Настройки сайта не менялись.');
    else if (!result.ok) console.error('Проверьте тип сборки Docker, контекст frontend и frontend/Dockerfile в RelaxDev. Инструкция: FIX_LOADING_RELAXDEV.md. Проверка не меняет настройки сайта.');
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
