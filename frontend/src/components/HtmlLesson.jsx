// components/HtmlLesson.jsx — готовый интерактивный HTML-урок внутри кабинета
// Урок работает в изолированной рамке: доступа к кабинету и паролю у него нет.
// Чтобы результат сохранился, урок вызывает window.Lessonfold.report({ correct, total, details })
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../ui';

const BRIDGE = `<script>
window.Lessonfold = {
  report: function (r) {
    r = r || {};
    parent.postMessage({ type: 'lessonfold:result', correct: r.correct, total: r.total, details: r.details || [] }, '*');
  }
};
</script>`;

// Мост ставим первым, чтобы урок мог вызвать его в любой момент
export function withBridge(html) {
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => `${m}${BRIDGE}`);
  return BRIDGE + html;
}

export default function HtmlLesson({ html, onFinish }) {
  const frame = useRef(null);
  const started = useRef(Date.now());
  const [full, setFull] = useState(false);
  const [saved, setSaved] = useState(null);

  useEffect(() => {
    const onMsg = (e) => {
      if (!frame.current || e.source !== frame.current.contentWindow) return;
      const d = e.data;
      if (!d || d.type !== 'lessonfold:result') return;
      const total = Number(d.total) || 0;
      if (!total) return;
      const r = { correct: Math.min(total, Number(d.correct) || 0), total, details: Array.isArray(d.details) ? d.details.slice(0, 60) : [] };
      setSaved(r);
      onFinish?.(r, null, Math.round((Date.now() - started.current) / 1000));
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [onFinish]);

  useEffect(() => {
    if (!full) return undefined;
    const onKey = (e) => e.key === 'Escape' && setFull(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [full]);

  return (
    <div className={`html-lesson ${full ? 'full' : ''}`}>
      <div className="html-lesson-bar">
        <span className="meta-label">Интерактивный урок</span>
        <div className="row" style={{ gap: 8 }}>
          {saved && onFinish && <span className="small" style={{ color: 'var(--ok)' }}>Результат сохранён: {saved.correct} из {saved.total}</span>}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setFull(!full)}>
            {full ? 'Свернуть' : 'На весь экран'}
          </button>
        </div>
      </div>
      <iframe ref={frame} title="Интерактивный урок" srcDoc={withBridge(html)} sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
        allow="autoplay; fullscreen" />
    </div>
  );
}
