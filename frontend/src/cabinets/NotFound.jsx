import { Empty, Link } from '../ui';

// Страница «не найдено» для обоих кабинетов
export const NotFound = () => (
  <div className="panel">
    <Empty title="Такой страницы нет" action={<Link to="/" className="btn">На главную</Link>} />
  </div>
);
