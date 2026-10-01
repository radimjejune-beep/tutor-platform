// ui.jsx — общие компоненты: роутер, иконки, модальные окна, уведомления, загрузка данных
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

/* ============================================================
   Простой роутер на #хэше: #/students/5 → ['students', '5']
   ============================================================ */
const getPath = () => window.location.hash.replace(/^#/, '') || '/';

export function useRoute() {
  const [path, setPath] = useState(getPath);
  useEffect(() => {
    const on = () => {
      setPath(getPath());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return path;
}

export const navigate = (to) => {
  window.location.hash = to;
};

export function Link({ to, className, children, ...rest }) {
  return (
    <a href={`#${to}`} className={className} {...rest}>
      {children}
    </a>
  );
}

/* ============================================================
   Загрузка данных: const { data, loading, error, reload } = useLoad(() => api.x(), [deps])
   ============================================================ */
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const load = useCallback(async (silent = false) => {
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fnRef.current();
      setState({ data, loading: false, error: null });
    } catch (error) {
      setState({ data: null, loading: false, error });
    }
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...state, reload: () => load(true) };
}

/* ============================================================
   Уведомления
   ============================================================ */
const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef();
  const show = useCallback((text, type = 'ok') => {
    clearTimeout(timer.current);
    setToast({ text, type });
    timer.current = setTimeout(() => setToast(null), 3200);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div className={`toast ${toast.type === 'error' ? 'error' : ''}`} role="status">
          {toast.text}
        </div>
      )}
    </ToastContext.Provider>
  );
}

/* ============================================================
   Модальное окно
   ============================================================ */
export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Закрыть">
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Форма в модальном окне: сама показывает ошибку и блокирует кнопку на время сохранения
export function useSubmit(fn) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e?.preventDefault();
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, submit, setError };
}

/* ============================================================
   Мелкие компоненты
   ============================================================ */
export const Spinner = () => <div className="spinner" aria-label="Загрузка" />;

export function Empty({ title, children, action }) {
  return (
    <div className="empty">
      <div className="serif">{title}</div>
      {children && <div>{children}</div>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

export function Badge({ tone, children }) {
  return <span className={`badge ${tone ? `badge-${tone}` : ''}`}>{children}</span>;
}

export function Field({ label, hint, children }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="panel">
      <Empty title="Не получилось загрузить" action={onRetry && <button className="btn btn-secondary" onClick={onRetry}>Обновить</button>}>
        {error.message}
      </Empty>
    </div>
  );
}

// Блок «Абонемент»: латунные отметки по числу оставшихся занятий
export function PassMarks({ total, remaining }) {
  const shown = Math.min(total, 24);
  const used = Math.max(0, total - remaining);
  return (
    <div className="pass" aria-label={`Осталось ${remaining} из ${total}`}>
      {Array.from({ length: shown }, (_, i) => (
        <i key={i} className={i < used ? 'used' : ''} />
      ))}
    </div>
  );
}

export function Bar({ value }) {
  return (
    <div className="bar" aria-hidden="true">
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/* ============================================================
   Иконки (линейные, 24×24)
   ============================================================ */
const PATHS = {
  home: 'M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z',
  calendar: 'M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  users: 'M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM20 19v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.15a3.5 3.5 0 0 1 0 6.7',
  book: 'M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5zM5 19.5A1.5 1.5 0 0 0 6.5 21H19M9 7h6',
  chart: 'M4 20h16M7 16v-4M12 16V8M17 16v-7',
  wallet: 'M4 7a2 2 0 0 1 2-2h11v4M4 7v11a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H6a2 2 0 0 1-2-2Zm12.5 7.5h.01',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  close: 'M6 6l12 12M18 6 6 18',
  plus: 'M12 5v14M5 12h14',
  logout: 'M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3M10 16l4-4-4-4M14 12H4',
  board: 'M4 5h16v11H4zM9 20h6M12 16v4',
  back: 'M15 18l-6-6 6-6',
  key: 'M14.5 9.5a4 4 0 1 1-1.2-2.8M14.5 9.5H20v3M17.5 9.5v2.5',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  trash: 'M5 7h14M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3',
  report: 'M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM9 12h6M9 16h6M13 3v5h5',
  clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  library: 'M4 4h4v16H4zM10 4h4v16h-4zM16.5 4.5l3.5 1-3.6 14.5-3.5-1z',
  video: 'M4 7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM16 10l5-3v10l-5-3',
  send: 'M21 3 10 14M21 3l-7 18-4-7-7-4z',
  note: 'M5 4h14v11l-5 5H5zM14 20v-5h5',
  clip: 'm20 11.5-7.8 7.8a5 5 0 0 1-7-7l8.2-8.2a3.3 3.3 0 0 1 4.7 4.7l-8.2 8.2a1.7 1.7 0 0 1-2.4-2.4l7.5-7.5',
  quiz: 'M9 5h10M9 12h10M9 19h10M4.5 5l.8.8L7 4M4.5 12l.8.8L7 11M5 18.5h1.5',
  arrowUp: 'M12 19V5M6 11l6-6 6 6',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z',
  shield: 'M12 3 4.5 6v5.5c0 4.6 3.2 8.6 7.5 9.5 4.3-.9 7.5-4.9 7.5-9.5V6zM9 12l2 2 4-4',
  arrowDown: 'M12 5v14M6 13l6 6 6-6',
};

export function Icon({ name, size }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
