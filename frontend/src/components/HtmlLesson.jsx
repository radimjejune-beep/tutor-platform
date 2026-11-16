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
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const latest = useRef(null);
  const busy = useRef(false);
  const signature = useRef(null);
  const epoch = useRef(0);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  const saveResult = async (r) => {
    if (!finishRef.current || busy.current) return;
    const key = JSON.stringify(r);
    if (key === signature.current) return;
    busy.current = true;
    const version = epoch.current;
    setSaving(true);
    setSaved(null);
    setSaveError(null);
    try {
      await finishRef.current(r, null, Math.round((Date.now() - started.current) / 1000));
      if (version === epoch.current) { signature.current = key; setSaved(r); }
    } catch (err) {
      if (version === epoch.current) setSaveError(err.message || 'Не удалось сохранить результат');
    } finally {
      if (version === epoch.current) {
        busy.current = false;
        setSaving(false);
        // Если урок прислал новый итог во время запроса, сохраняем последний после него.
        if (latest.current && JSON.stringify(latest.current) !== key) saveRef.current(latest.current);
      }
    }
  };
  const saveRef = useRef(saveResult);
  saveRef.current = saveResult;

  useEffect(() => {
    started.current = Date.now();
    latest.current = null;
    signature.current = null;
    busy.current = false;
    setSaved(null);
    setSaving(false);
    setSaveError(null);
    const onMsg = (e) => {
      if (!frame.current || e.source !== frame.current.contentWindow) return;
      const d = e.data;
      if (!d || d.type !== 'lessonfold:result') return;
      const rawTotal = Number(d.total);
      const rawCorrect = Number(d.correct);
      if (!Number.isFinite(rawTotal) || rawTotal < 1 || !Number.isFinite(rawCorrect)) return;
      const total = Math.min(1000, Math.round(rawTotal));
      const r = { correct: Math.max(0, Math.min(total, Math.round(rawCorrect))), total, details: Array.isArray(d.details) ? d.details.slice(0, 60) : [] };
      latest.current = r;
      saveRef.current(r);
    };
    window.addEventListener('message', onMsg);
    return () => { epoch.current++; window.removeEventListener('message', onMsg); };
  }, [html]);

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
          {saving && <span className="small" role="status">Сохраняем результат…</span>}
          {saveError && <span className="small" role="alert">{saveError} <button type="button" className="btn btn-secondary btn-sm" onClick={() => saveRef.current(latest.current)}>Повторить сохранение</button></span>}
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
