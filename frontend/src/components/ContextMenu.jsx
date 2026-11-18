// components/ContextMenu.jsx — контекстное меню с быстрыми действиями
import { Icon, Link } from '../ui';
import { createPortal } from 'react-dom';
import { useEffect, useRef } from 'react';

export function ContextMenu({ items, onClose, position }) {
  const ref = useRef(null);

  useEffect(() => {
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && onClose();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  if (!items?.length) return null;

  return createPortal(
    <div className="context-menu" ref={ref} style={{ top: position?.y || 0, left: position?.x || 0 }}>
      {items.map((item, i) => (
        item.divider ? (
          <div key={i} className="context-menu-divider" />
        ) : (
          <button
            key={i}
            className="context-menu-item"
            onClick={() => {
              item.onClick?.();
              onClose();
            }}
            disabled={item.disabled}
          >
            {item.icon && <Icon name={item.icon} size={16} />}
            <span>{item.label}</span>
            {item.shortcut && <kbd className="context-menu-shortcut">{item.shortcut}</kbd>}
          </button>
        )
      ))}
    </div>,
    document.body
  );
}

// Быстрые действия для карточек (ученики, уроки, задания)
export function QuickActions({ items, compact }) {
  if (!items?.length) return null;

  return (
    <div className={`quick-actions ${compact ? 'compact' : ''}`}>
      {items.slice(0, compact ? 3 : 5).map((item, i) => (
        item.to ? (
          <Link key={i} to={item.to} className="quick-action" title={item.label}>
            <Icon name={item.icon} size={16} />
            {!compact && <span>{item.label}</span>}
          </Link>
        ) : (
          <button key={i} className="quick-action" onClick={item.onClick} title={item.label}>
            <Icon name={item.icon} size={16} />
            {!compact && <span>{item.label}</span>}
          </button>
        )
      ))}
    </div>
  );
}
