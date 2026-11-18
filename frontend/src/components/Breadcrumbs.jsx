// components/Breadcrumbs.jsx — хлебные крошки для навигации
import { Icon, Link, goBack } from '../ui';
import { useMemo } from 'react';

const ROUTE_LABELS = {
  '/': 'Главная',
  '/schedule': 'Расписание',
  '/students': 'Ученики',
  '/groups': 'Группы',
  '/homework': 'Задания',
  '/diagnostics': 'Диагностика',
  '/grammar': 'Грамматика',
  '/library': 'Библиотека',
  '/wordsets': 'Карточки',
  '/courses': 'Курсы',
  '/bank': 'Банк заданий',
  '/market': 'Каталог',
  '/method': 'Методика',
  '/finance': 'Доход',
  '/settings': 'Настройки',
  '/words': 'Словарь',
  '/family': 'Семья и согласия',
  '/coach': 'Повторение',
  '/theory': 'Теория',
  '/progress': 'Прогресс',
  '/payments': 'Оплата',
  '/learn': 'Как учиться',
  '/profile': 'Профиль',
  '/help': 'Помощь',
  '/shop': 'Готовые уроки',
};

export function Breadcrumbs({ path, entities = {} }) {
  const crumbs = useMemo(() => {
    const segments = path.split('?')[0].split('/').filter(Boolean);
    const result = [{ to: '/', label: 'Главная' }];

    if (segments.length === 0) return result;

    let currentPath = '';
    for (let i = 0; i < segments.length; i++) {
      currentPath += `/${segments[i]}`;
      const label = ROUTE_LABELS[currentPath] || entities[segments[i]] || segments[i];

      // Пропускаем технические сегменты
      if (['new', 'edit', 'access'].includes(segments[i])) continue;

      result.push({ to: currentPath, label });
    }

    return result;
  }, [path, entities]);

  if (crumbs.length <= 1) return null;

  return (
    <nav className="breadcrumbs" aria-label="Навигация">
      {crumbs.map((crumb, i) => (
        <span key={crumb.to} className="breadcrumb-item">
          {i > 0 && <Icon name="chevron-right" size={14} className="breadcrumb-sep" />}
          {i === crumbs.length - 1 ? (
            <span className="breadcrumb-current">{crumb.label}</span>
          ) : (
            <Link to={crumb.to} className="breadcrumb-link">{crumb.label}</Link>
          )}
        </span>
      ))}
    </nav>
  );
}

// Умная кнопка "Назад" с контекстом
export function SmartBackButton({ path, label }) {
  const parent = useMemo(() => {
    const segments = path.split('?')[0].split('/').filter(Boolean);
    if (segments.length <= 1) return null;
    return `/${segments.slice(0, -1).join('/')}`;
  }, [path]);

  if (!parent) return null;

  return (
    <button
      type="button"
      className="back-btn smart"
      onClick={() => goBack(parent)}
      aria-label={`Назад к ${ROUTE_LABELS[parent] || 'предыдущей странице'}`}
    >
      <Icon name="back" size={16} />
      <span className="back-label">{label || ROUTE_LABELS[parent] || 'Назад'}</span>
    </button>
  );
}
