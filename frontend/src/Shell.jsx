// Shell.jsx — каркас кабинета: боковое меню (компьютер) и нижнее меню (телефон)
import { useAuth } from './auth';
import { BRAND } from './config';
import { Icon, Link } from './ui';

const ROLE_LABEL = { tutor: 'Преподаватель', student: 'Ученик', parent: 'Родитель' };

export const TUTOR_NAV = [
  { to: '/', label: 'Главная', icon: 'home' },
  { to: '/schedule', label: 'Расписание', icon: 'calendar' },
  { to: '/students', label: 'Ученики', icon: 'users' },
  { to: '/homework', label: 'Задания', short: 'Задания', icon: 'book', countKey: 'homework' },
  { to: '/finance', label: 'Доход', icon: 'wallet' },
  { to: '/settings', label: 'Настройки', short: 'Ещё', icon: 'settings' },
];

export const CLIENT_NAV = [
  { to: '/', label: 'Главная', icon: 'home' },
  { to: '/schedule', label: 'Расписание', icon: 'calendar' },
  { to: '/homework', label: 'Задания', short: 'Задания', icon: 'book', countKey: 'homework' },
  { to: '/progress', label: 'Прогресс', icon: 'chart' },
  { to: '/payments', label: 'Оплата', icon: 'wallet' },
];

// Активный пункт: точное совпадение для главной, по началу пути для остальных
const isActive = (path, to) => (to === '/' ? path === '/' : path === to || path.startsWith(`${to}/`));

export function Shell({ nav, path, counts = {}, children }) {
  const { user, logout } = useAuth();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-name">{BRAND.name}</div>
          <div className="brand-rule" />
        </div>

        <nav className="nav" aria-label="Разделы">
          {nav.map((item) => (
            <Link key={item.to} to={item.to} className={isActive(path, item.to) ? 'active' : ''}>
              <Icon name={item.icon} />
              {item.label}
              {counts[item.countKey] > 0 && <span className="count">{counts[item.countKey]}</span>}
            </Link>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="who">{user.full_name}</div>
          <div className="who-role">
            {ROLE_LABEL[user.role]}, логин {user.login}
          </div>
          <div className="row" style={{ marginTop: 12, gap: 4 }}>
            <Link to="/password" className="btn btn-quiet btn-sm">
              <Icon name="key" /> Пароль
            </Link>
            <button className="btn btn-quiet btn-sm" onClick={logout}>
              <Icon name="logout" /> Выйти
            </button>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="brand-name">{BRAND.name}</div>
          <div className="row" style={{ gap: 2 }}>
            <Link to="/password" className="icon-btn" aria-label="Сменить пароль">
              <Icon name="key" size={20} />
            </Link>
            <button className="icon-btn" onClick={logout} aria-label="Выйти">
              <Icon name="logout" size={20} />
            </button>
          </div>
        </header>

        <main className="content">{children}</main>

        <nav className="tabbar" aria-label="Разделы">
          {nav.map((item) => (
            <Link key={item.to} to={item.to} className={isActive(path, item.to) ? 'active' : ''}>
              <Icon name={item.icon} />
              {item.short || item.label}
              {counts[item.countKey] > 0 && <span className="dot" />}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
