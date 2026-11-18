// components/FloatingActionButton.jsx — плавающая кнопка действия (FAB)
import { useState } from 'react';
import { Icon } from '../ui';

export function FloatingActionButton({ actions, primaryAction }) {
  const [open, setOpen] = useState(false);

  if (!actions?.length && !primaryAction) return null;

  const handlePrimary = () => {
    if (actions?.length) {
      setOpen(!open);
    } else if (primaryAction) {
      primaryAction.onClick?.();
    }
  };

  return (
    <div className="fab-container">
      {open && actions && (
        <div className="fab-menu">
          {actions.map((action, i) => (
            <button
              key={i}
              className="fab-menu-item"
              onClick={() => {
                action.onClick?.();
                setOpen(false);
              }}
              title={action.label}
            >
              <Icon name={action.icon} size={20} />
              <span className="fab-menu-label">{action.label}</span>
            </button>
          ))}
        </div>
      )}
      <button
        className={`fab ${open ? 'open' : ''}`}
        onClick={handlePrimary}
        aria-label={primaryAction?.label || 'Действия'}
      >
        <Icon name={open ? 'x' : (primaryAction?.icon || 'plus')} size={24} />
      </button>
    </div>
  );
}
