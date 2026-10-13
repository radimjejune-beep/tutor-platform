// components/Notifications.jsx — колокольчик: счётчик непрочитанных и список уведомлений
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { Icon, navigate, Spinner } from '../ui';
import { BRAND } from '../config';
import { relativeDay, time } from '../format';

export default function NotificationBell({ path, compact }) {
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const box = useRef(null);

  const refresh = useCallback(() => {
    api.unreadCount().then((r) => setUnread(r.unread)).catch(() => {});
  }, []);

  // Счётчик: при переходах, раз в минуту и когда вкладка снова активна
  useEffect(() => { refresh(); }, [path, refresh]);
  useEffect(() => {
    const t = setInterval(refresh, 60000);
    const onVis = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [refresh]);
  useEffect(() => {
    document.title = unread ? `(${unread}) ${BRAND.name}` : BRAND.name;
  }, [unread]);

  // Закрыть по клику мимо и по Escape
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const toggle = () => {
    if (!open) {
      setItems(null);
      api.notifications().then((r) => { setItems(r.items); setUnread(r.unread); }).catch(() => setItems([]));
    }
    setOpen(!open);
  };

  const go = (n) => {
    if (!n.read_at) {
      api.markRead({ ids: [n.id] }).catch(() => {});
      setUnread((u) => Math.max(0, u - 1));
    }
    setOpen(false);
    if (n.link) navigate(n.link);
  };
  const readAll = () => {
    api.markRead({ all: true }).then(() => {
      setUnread(0);
      setItems((list) => (list || []).map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
    }).catch(() => {});
  };

  return (
    <div className={`bell ${compact ? 'compact' : ''}`} ref={box}>
      <button className={compact ? 'icon-btn' : 'bell-btn'} onClick={toggle} aria-expanded={open} aria-label={`Уведомления${unread ? `: ${unread} новых` : ''}`}>
        <Icon name="bell" size={compact ? 20 : 18} />
        {!compact && <span>Уведомления</span>}
        {unread > 0 && <span className="bell-count">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="bell-panel" role="dialog" aria-label="Уведомления">
          <div className="bell-head">
            <span className="meta-label">Уведомления</span>
            {unread > 0 && <button className="btn btn-quiet btn-sm" onClick={readAll}>Прочитать все</button>}
          </div>
          <div className="bell-list">
            {!items && <Spinner />}
            {items && !items.length && <div className="bell-empty">Пока ничего нового. Здесь появятся задания, оценки, переносы и итоги уроков.</div>}
            {(items || []).map((n) => (
              <button key={n.id} className={`bell-item ${n.read_at ? '' : 'unread'}`} onClick={() => go(n)}>
                <span className="bell-title">{n.title}</span>
                {n.body && <span className="bell-body">{n.body}</span>}
                <span className="bell-when">{relativeDay(n.created_at)}, {time(n.created_at)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
