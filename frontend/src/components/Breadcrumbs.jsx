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
  '/notebook': 'Грамматическая тетрадь',
  '/library': 'Библиотека',
  '/wordsets': 'Карточки',
  '/courses': 'Курсы',
  '/bank': 'Банк заданий',
  '/market': 'Каталог',
  '/marketplace':'Курсы Lessonfold',
  '/marketplace/author':'Курсы автора',
  '/marketplace/mine':'Мои курсы',
  '/learn-course':'Мои курсы',
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
  '/lesson':'Комната урока',
  '/more':'Ещё',
  '/password':'Пароль',
};

export function Breadcrumbs({ path, entities = {} }) {
  const crumbs = useMemo(() => {
    const segments = path.split('?')[0].split('/').filter(Boolean);
    const result = [{ to: '/', label: 'Главная' }];

    if (segments.length === 0) return result;

    let currentPath = '';
    for (let i = 0; i < segments.length; i++) {
      currentPath += `/${segments[i]}`;
      const tabs={lessons:'Занятия',course:'Курс',words:'Словарь',homework:'Задания',coach:'Помощник',progress:'Прогресс',reports:'Отчёты',finance:'Оплаты',access:'Доступ',plan:'Тариф',mine:'Мои курсы',author:'Курсы автора'};
      const label = entities[currentPath] || ROUTE_LABELS[currentPath] || tabs[segments[i]] || (/^\d+$/.test(segments[i])?(segments[0]==='writing'?'Письменная работа':segments[0]==='workouts'?'Персональная разминка':'Карточка'):segments[i]);

      // Пропускаем технические сегменты
      if (['new','edit','reviews','runs'].includes(segments[i])||(i===0&&['writing','workouts'].includes(segments[i]))) continue;
      if(i>0 && i<segments.length-1 && !entities[currentPath] && !ROUTE_LABELS[currentPath] && !/^\d+$/.test(segments[i])) continue;

      result.push({ to:currentPath==='/learn-course'?'/marketplace/mine':currentPath, label });
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
            <span className="breadcrumb-current" aria-current="page">{crumb.label}</span>
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
