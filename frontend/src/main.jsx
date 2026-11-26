import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './premium.css';
import './self-study.css';
import './navigation-workspace.css';
import './learning-workspace.css';
import { isAssetLoadError, reloadForNewVersion } from './version-recovery';

// После обновления сайта открытая вкладка может просить старые файлы, которых уже нет, и показывать белый экран.
// Тогда один раз перезагружаем страницу: подтянется новая версия. Защита от зацикливания: не чаще раза в минуту.
window.addEventListener('vite:preloadError', (e) => { if (reloadForNewVersion()) e.preventDefault(); });
window.addEventListener('unhandledrejection', (e) => {
  if (isAssetLoadError(e.reason) && reloadForNewVersion()) e.preventDefault();
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Строки списков, по которым переходят щелчком (ученики, задания, материалы), доступны и с клавиатуры:
// Tab до строки, Enter или пробел открывает её
const ROWS = '.assign-row:not(.book-row):not([data-row-native]):not(a):not(button), .list-item.clickable:not([data-row-native]):not(a):not(button), tr.clickable:not([data-row-native])';
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

// Хостинг не запрещает браузеру кэшировать index.html, поэтому после выхода новой версии
// у человека может открываться старая. Раз в 5 минут и при возврате на вкладку сверяем файл сборки
// с сервером; если вышла новая версия, перезагружаем страницу при следующем переходе по разделам.
(() => {
  const current = () => (document.querySelector('script[type="module"][src*="/assets/index-"]')?.getAttribute('src') || '').split('/').pop();
  let outdated = false;
  const check = async () => {
    try {
      const html = await fetch(`/?v=${Date.now()}`, { cache: 'no-store' }).then((r) => r.text());
      const latest = (html.match(/assets\/(index-[\w-]+\.js)/) || [])[1];
      if (latest && current() && latest !== current()) outdated = true;
    } catch { /* нет сети: проверим позже */ }
  };
  setInterval(check, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  setTimeout(check, 30 * 1000);
  window.addEventListener('hashchange', () => { if (outdated) reloadForNewVersion(); });
})();

// Стрелки перемещают фокус между существующими вкладками; порядок меню не меняется.
document.addEventListener('keydown', e => {
  if (e.altKey || e.ctrlKey || e.metaKey || !['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;
  const current=e.target instanceof Element?e.target.closest('[role="tab"]'):null;
  const group=current?.closest('[role="tablist"]');
  if (!group) return;
  const tabs=[...group.querySelectorAll('[role="tab"]')].filter(el=>!el.disabled&&el.getClientRects().length);
  const index=tabs.indexOf(current);
  if(index<0||!tabs.length)return;
  e.preventDefault();
  const next=tabs[e.key==='Home'?0:e.key==='End'?tabs.length-1:(index+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length];
  const label=next.textContent;
  next.focus();next.click();
  requestAnimationFrame(()=>{
    const selected=[...document.querySelectorAll('[role="tablist"] [role="tab"][aria-selected="true"]')].find(el=>el.textContent===label);
    if(!selected)return;
    selected.focus({preventScroll:true});
    const list=selected.closest('[role="tablist"]'),rect=selected.getBoundingClientRect(),bounds=list.getBoundingClientRect();
    if(rect.left<bounds.left)list.scrollLeft-=bounds.left-rect.left+8;
    if(rect.right>bounds.right)list.scrollLeft+=rect.right-bounds.right+8;
  });
});
