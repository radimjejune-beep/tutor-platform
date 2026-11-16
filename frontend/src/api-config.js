// Чистая функция: тот же выбор адреса проверяется тестами без браузера.
const localHost = (host) => /^(localhost|127(?:\.\d{1,3}){3}|\[?::1\]?)$/i.test(host) || /\.localhost$/i.test(host);

export function resolveApiBase(raw, hostname = '') {
  const local = localHost(hostname);
  const value = String(raw || '').trim();
  if (value && !/[\s${}]/.test(value)) {
    try {
      const url = new URL(value);
      if ((url.protocol === 'https:' || (local && url.protocol === 'http:')) &&
          !url.username && !url.password && !url.search && !url.hash && (local || !localHost(url.hostname))) {
        return url.href.replace(/\/+$/, '').replace(/\/api$/, '');
      }
    } catch { /* Ошибочная переменная: используем известный адрес. */ }
  }
  if (local) return 'http://localhost:3001';
  return /(^|\.)lessonfold\.ru$/i.test(hostname) ? 'https://api.lessonfold.ru' : 'https://tutor-platform.relaxdev.ru';
}
