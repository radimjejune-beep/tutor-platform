const KEY = 'lf-reloaded';
const PARAM = 'lf_reload';
const COOLDOWN = 60000;
let lastAttempt = 0;

export function isAssetLoadError(error) {
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|not a valid JavaScript MIME type|non CSS MIME types|Unable to preload CSS|Failed to load module script/i.test(String(error?.message || error || ''));
}

// Сохраняем адрес страницы и hash-маршрут, меняя только ключ кэша документа.
// URL также ограничивает повтор, когда sessionStorage недоступен (например, приватный режим).
export function recoveryUrl(href, lastReload = 0, now = Date.now(), force = false) {
  const url = new URL(href);
  const times = [Number(lastReload), Number(url.searchParams.get(PARAM))]
    .filter((at) => Number.isFinite(at) && at > 0 && at <= now);
  const last = Math.max(0, ...times);
  if (!force && last && now - last < COOLDOWN) return null;
  url.searchParams.set(PARAM, String(now));
  return url.href;
}

export function reloadForNewVersion({ force = false } = {}) {
  if (typeof window.__lfBootRecovery === 'function') return window.__lfBootRecovery(force);
  let previous = lastAttempt;
  try { previous = Math.max(previous, Number(sessionStorage.getItem(KEY)) || 0); } catch { /* URL остаётся защитой от цикла. */ }
  const now = Date.now();
  const next = recoveryUrl(window.location.href, previous, now, force);
  if (!next) return false;
  lastAttempt = now;
  try { sessionStorage.setItem(KEY, String(now)); } catch { /* Хранилище необязательно. */ }
  window.location.replace(next);
  return true;
}
