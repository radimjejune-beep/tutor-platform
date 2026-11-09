import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// После обновления сайта открытая вкладка может просить старые файлы, которых уже нет, и показывать белый экран.
// Тогда один раз перезагружаем страницу: подтянется новая версия. Защита от зацикливания: не чаще раза в минуту.
function reloadForNewVersion() {
  try {
    const last = Number(sessionStorage.getItem('lf-reloaded') || 0);
    if (Date.now() - last < 60000) return false;
    sessionStorage.setItem('lf-reloaded', String(Date.now()));
  } catch { /* без хранилища просто перезагрузим */ }
  window.location.reload();
  return true;
}
window.addEventListener('vite:preloadError', (e) => { if (reloadForNewVersion()) e.preventDefault(); });
window.addEventListener('unhandledrejection', (e) => {
  if (/Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(String(e.reason?.message || e.reason))) reloadForNewVersion();
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Строки списков, по которым переходят щелчком (ученики, задания, материалы), доступны и с клавиатуры:
// Tab до строки, Enter или пробел открывает её
const ROWS = '.assign-row:not(.book-row), .list-item.clickable, tr.clickable';
const markRows = () => document.querySelectorAll(ROWS).forEach((el) => {
  if (!el.hasAttribute('tabindex')) { el.setAttribute('tabindex', '0'); el.setAttribute('role', 'button'); }
});
new MutationObserver(markRows).observe(document.getElementById('root'), { childList: true, subtree: true });
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target instanceof HTMLElement && e.target.matches(ROWS)) {
    e.preventDefault();
    e.target.click();
  }
});
