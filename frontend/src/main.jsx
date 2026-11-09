import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

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
