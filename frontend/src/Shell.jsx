// Shell.jsx — каркас кабинета: боковое меню (компьютер) и нижнее меню (телефон)
import { useAuth } from './auth';
import { BRAND } from './config';
import { createContext, Fragment, useContext, useLayoutEffect, useState, useEffect } from 'react';
import { Icon, Link, goBack, navigate } from './ui';
import NotificationBell from './components/Notifications';
import CommandPalette, { usePaletteHotkey } from './components/CommandPalette';
import { Breadcrumbs } from './components/Breadcrumbs';
import { navHistory } from './components/NavigationHistory';

const ROLE_LABEL = { tutor: 'Преподаватель', student: 'Ученик', parent: 'Родитель', learner:'Самостоятельное обучение' };

export const TUTOR_NAV = [
  { to: '/', label: 'Главная', icon: 'home', group: 'Работа' },
  { to: '/schedule', label: 'Расписание', short: 'Уроки', icon: 'calendar', group: 'Работа' },
  { to: '/students', label: 'Ученики', icon: 'users', group: 'Работа' },
  { to: '/homework', label: 'Задания', short: 'Задания', icon: 'book', countKey: 'homework', group: 'Работа' },
  { to: '/diagnostics', label: 'Диагностика', icon: 'quiz', hideMobile: true, group: 'Работа' },
  { to: '/grammar', label: 'Грамматика', icon: 'library', hideMobile: true, group: 'Материалы' },
  { to: '/library', label: 'Библиотека', short: 'Библ.', icon: 'library', group: 'Материалы' },
  { to: '/wordsets', label: 'Карточки', icon: 'cards', hideMobile: true, group: 'Материалы' },
  { to: '/courses', label: 'Курсы', icon: 'layers', hideMobile: true, group: 'Материалы' },
  { to: '/bank', label: 'Банк заданий', icon: 'library', hideMobile: true, group: 'Материалы' },
  { to: '/market', label: 'Каталог', icon: 'grid', hideMobile: true, group: 'Материалы' },
  { to: '/method', label: 'Методика', icon: 'bulb', hideMobile: true, group: 'Материалы' },
  { to: '/finance', label: 'Доход', icon: 'wallet', hideMobile: true, group: 'Учёт' },
  { to: '/settings', label: 'Настройки', icon: 'settings', hideMobile: true, group: 'Учёт' },
];

export const CLIENT_NAV = [
  { to: '/', label: 'Главная', icon: 'home' },
  { to: '/schedule', label: 'Расписание', short: 'Уроки', icon: 'calendar' },
  { to: '/homework', label: 'Задания', short: 'Задания', icon: 'book', countKey: 'homework' },
  { to: '/words', label: 'Словарь', icon: 'cards', countKey: 'words' },
  { to: '/diagnostics', label: 'Диагностика', icon: 'quiz', hideMobile: true },
  { to: '/family', label: 'Семья и согласия', icon: 'shield', hideMobile: true },
  { to: '/coach', label: 'Повторение', icon: 'quiz', hideMobile: true },
  { to: '/grammar', label: 'Грамматика', icon: 'library', hideMobile: true },
  { to: '/theory', label: 'Теория', icon: 'library', hideMobile: true },
  { to: '/progress', label: 'Прогресс', short: 'Успехи', icon: 'chart' },
  { to: '/payments', label: 'Оплата', icon: 'wallet', hideMobile: true },
  { to: '/marketplace/mine', label: 'Мои курсы', icon: 'layers', hideMobile: true },
  { to: '/marketplace', label: 'Каталог курсов', icon: 'grid', hideMobile: true },
  { to: '/learn', label: 'Как учиться', icon: 'bulb', hideMobile: true },
];

// Активный пункт: точное совпадение для главной, по началу пути для остальных
const isActive = (path, to) =>
  to === '/' ? path === '/' : path === to || path.startsWith(`${to}/`) || (to==='/grammar'&&path.startsWith('/notebook')) || (to === '/students' && path.startsWith('/groups')) || (to==='/market' && (path.startsWith('/marketplace')||path.startsWith('/learn-course')));

// Куда ведёт «Назад» со страницы, если в кабинете ещё не было переходов. null: кнопка не нужна (раздел верхнего уровня или вкладка)
const TABS = { library: ['theory', 'games', 'lessons', 'books', 'tasks'], market: ['mine'], finance: ['pricing'] };
export function parentOf(rawPath) {
  const s = rawPath.split('?')[0].split('/').filter(Boolean);
  if (s.length === 0 || s[0] === 'more') return null;
  if (s[0] === 'password') return '/profile';
  if (s[0] === 'profile' || s[0] === 'help') return null;
  if (s[0] === 'lesson') return '/schedule';
  if (s[0] === 'groups') return '/students';
  if (s.length === 1) return null;
  if (s[0] === 'settings') return null;
  if (TABS[s[0]]?.includes(s[1])) return null;
  if (s[0] === 'homework' && s.length > 2) return `/homework/${s[1]}`;
  if (s[0] === 'bank' && s.length > 2) return `/bank/${s[1]}`;
  if (s[0] === 'words') return '/words';
  if (s[0] === 'diagnostics') return '/diagnostics';
  if (s[0] === 'reports') return '/progress';
  return `/${s[0]}`;
}

// Своя кнопка «Назад» на странице (с подписью раздела). Пока она есть, общая из каркаса не показывается.
// Обе возвращают туда, откуда пришли, а при открытии по прямой ссылке ведут в раздел to.
const BackCtx = createContext(null);
const BreadcrumbNames = createContext(null);
export function BreadcrumbEntity({path,label}) {
  const set=useContext(BreadcrumbNames);
  useEffect(()=>{if(!set||!label)return;set(prev=>({...prev,[path]:label}));return()=>set(prev=>{if(prev[path]!==label)return prev;const next={...prev};delete next[path];return next;});},[set,path,label]);
  return null;
}
export function BackLink({ to, children }) {
  const mark = useContext(BackCtx);
  useLayoutEffect(() => {
    if (!mark) return undefined;
    mark(true);
    return () => mark(false);
  }, [mark]);
  // С подписью раздела («Ученики», «Задания») ведёт именно туда, а не на предыдущую страницу
  return <BackButton to={to} direct={Boolean(children)}>{children}</BackButton>;
}
function BackButton({ to, children, direct }) {
  return (
    <button type="button" className="back-btn" onClick={() => (direct ? navigate(to) : goBack(to))}>
      <Icon name="back" size={16} /> <span className="back-label">{children || 'Назад'}</span>
    </button>
  );
}

function BackBar({ path, hidden }) {
  const parent = parentOf(path);
  if (!parent || hidden) return null;
  return <BackButton to={parent}>Назад</BackButton>;
}

export function Shell({ nav, path, counts = {}, children }) {
  const { user, logout } = useAuth();
  const [palette, setPalette] = useState(false);
  const [ownBack, setOwnBack] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [entities,setEntities]=useState({});
  const activeTo=user.role==='learner'&&(path.startsWith('/learn-course/')||path==='/marketplace/mine')?'/':nav.filter(n=>isActive(path,n.to)).sort((a,b)=>b.to.length-a.to.length)[0]?.to;
  usePaletteHotkey(setPalette);

  useLayoutEffect(()=>{navHistory.clear();return()=>navHistory.clear();},[user.id,user.role,user.context]);
  useEffect(()=>{navHistory.push(path);},[path,user.id,user.role,user.context]);

  const toggleGroup = (group) => {
    setCollapsedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  return (
    <div className="shell">
      <a className="skip-link" href="#workspace-content" onClick={e=>{e.preventDefault();document.getElementById('workspace-content')?.focus();}}>Перейти к содержимому</a>
      <aside className="sidebar">
        <div className="brand"><Link to="/" className="brand-lockup" aria-label="Lessonfold — главная кабинета"><img className="brand-symbol" src="/icon.svg" alt=""/><span className="brand-name">{BRAND.name}</span></Link></div>

        <div className="side-tools">
          <button className="search-btn" onClick={() => setPalette(true)} title="Быстрый поиск (Ctrl+K)">
            <Icon name="search" size={16} /> <span>Поиск</span> <kbd>Ctrl K</kbd>
          </button>
          {user.role!=='learner'&&<NotificationBell path={path} />}
        </div>

        <nav className="nav" aria-label="Разделы">
          {nav.map((item, i) => {
            const showGroupHeader = item.group && item.group !== nav[i - 1]?.group;
            const isCollapsed = collapsedGroups[item.group];

            return (
              <Fragment key={item.to}>
                {showGroupHeader && (
                  <button
                    className="nav-group-toggle"
                    onClick={() => toggleGroup(item.group)}
                    aria-expanded={!isCollapsed}
                  >
                    <Icon name={isCollapsed ? 'chevron-right' : 'chevron-down'} size={14} />
                    <span className="nav-group-label">{item.group}</span>
                  </button>
                )}
                {!isCollapsed && (
                  <Link to={item.to} className={activeTo===item.to ? 'active' : ''} aria-current={activeTo===item.to?'page':undefined}>
                    <Icon name={item.icon} />
                    {item.label}
                    {counts[item.countKey] > 0 && <span className="count">{counts[item.countKey]}</span>}
                  </Link>
                )}
              </Fragment>
            );
          })}
        </nav>

        {user.role === 'tutor' && (
          <Link to="/shop" className="side-shop">
            <Icon name="grid" size={16} /> Готовые интерактивные уроки
          </Link>
        )}

        <div className="sidebar-foot">
          <Link to="/profile" className={`who-link${path === '/profile' ? ' active' : ''}`} title="Профиль">
            <span className="who-ava">{String(user.full_name || '?').trim()[0]?.toUpperCase()}</span>
            <span style={{ minWidth: 0 }}>
              <span className="who truncate">{user.full_name}</span>
              <span className="who-role truncate">{ROLE_LABEL[user.role]}, логин {user.login}</span>
            </span>
          </Link>
          <div className="row" style={{ marginTop: 10, gap: 4 }}>
            <Link to="/help" className="btn btn-quiet btn-sm">
              <Icon name="book" /> Помощь
            </Link>
            <button className="btn btn-quiet btn-sm" onClick={logout}>
              <Icon name="logout" /> Выйти
            </button>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="workspace-heading"><b>{nav.find(n=>n.to===activeTo)?.label||'Lessonfold'}</b><span className="workspace-role">{ROLE_LABEL[user.role]}</span></div>
          <Link to="/" className="brand-name" aria-label="Lessonfold — главная кабинета"><img className="brand-symbol" src="/icon.svg" alt=""/>{BRAND.name}</Link>
          <div className="row" style={{ gap: 2 }}>
            <button className="icon-btn" onClick={() => setPalette(true)} aria-label="Поиск"><Icon name="search" size={20} /></button>
            {user.role!=='learner'&&<NotificationBell path={path} compact />}
            <Link to="/profile" className="icon-btn" aria-label="Профиль">
              <Icon name="user" size={20} />
            </Link>
            <button className="icon-btn" onClick={logout} aria-label="Выйти">
              <Icon name="logout" size={20} />
            </button>
          </div>
        </header>

        <BackCtx.Provider value={setOwnBack}>
          <main className="content" id="workspace-content" tabIndex={-1}>
            <div className="content-nav">
              <BackBar path={path} hidden={ownBack} />
              <Breadcrumbs path={path} entities={entities} />
            </div>
            <BreadcrumbNames.Provider value={setEntities}>{children}</BreadcrumbNames.Provider>
          </main>
        </BackCtx.Provider>
        <CommandPalette open={palette} onClose={() => setPalette(false)} role={user.role} nav={nav} />

        <nav className="tabbar" aria-label="Разделы">
          {nav.filter((item) => !item.hideMobile).map((item) => (
            <Link key={item.to} to={item.to} className={activeTo===item.to ? 'active' : ''} aria-current={activeTo===item.to?'page':undefined}>
              <Icon name={item.icon} />
              {item.short || item.label}
              {counts[item.countKey] > 0 && <span className="dot" />}
            </Link>
          ))}
          {/* На телефоне всё, что не поместилось в нижнее меню, открывается через «Ещё» */}
          <Link to="/more" className={path === '/more' || nav.some((i) => i.hideMobile && isActive(path, i.to)) ? 'active' : ''}>
            <Icon name="grid" />
            Ещё
            {nav.some((i) => i.hideMobile && counts[i.countKey] > 0) && <span className="dot" />}
          </Link>
        </nav>
      </div>
    </div>
  );
}

// «Ещё» на телефоне: разделы, которые не поместились в нижнее меню, и выход
export function MoreMenu({ nav, counts = {} }) {
  const { user, logout,students } = useAuth();
  // Витрина уроков нужна репетиторам; ученикам и родителям её не показываем
  const items = [
    ...((user.role==='parent'||user.role==='student'&&students.some(s=>s.category==='adult'))?[{to:'/purchases',label:'Покупки курсов',icon:'wallet'}]:[]),
    ...nav.filter((i) => i.hideMobile),
    ...(user.role === 'tutor' ? [{ to: '/shop', label: 'Готовые интерактивные уроки', icon: 'grid' }] : []),
    { to: '/profile', label: 'Профиль', icon: 'user' },
    { to: '/help', label: 'Как пользоваться', icon: 'book' },
  ];
  return (
    <>
      <div className="page-head"><h1 className="page-title">Ещё</h1></div>
      <nav className="panel more-menu" aria-label="Остальные разделы">
        {items.map((i) => (
          <Link key={i.to} to={i.to}>
            <Icon name={i.icon} size={20} />
            <span>{i.label}</span>
            {counts[i.countKey] > 0 && <span className="count">{counts[i.countKey]}</span>}
          </Link>
        ))}
        <button type="button" onClick={logout}><Icon name="logout" size={20} /><span>Выйти</span></button>
      </nav>
      <p className="small muted" style={{ marginTop: 14 }}>{user.full_name}, логин {user.login}</p>
    </>
  );
}
