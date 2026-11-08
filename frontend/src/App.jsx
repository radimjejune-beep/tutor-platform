// App.jsx — выбор кабинета по роли и маршруты
// Главная, вход и документы в основном файле; кабинеты грузятся отдельно после входа,
// поэтому главная страница открывается быстрее.
import { lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './auth';
import { ToastProvider, Spinner, useRoute } from './ui';
import { Login, ChangePassword, Register } from './pages/Login';
import { LegalPage } from './pages/Legal';
import Join from './pages/Join';
import Landing from './pages/Landing';
import Shop from './pages/Shop';

const TutorApp = lazy(() => import('./cabinets/TutorApp'));
const ClientApp = lazy(() => import('./cabinets/ClientApp'));

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </ToastProvider>
  );
}

function Root() {
  const { session, user } = useAuth();
  const route = useRoute();
  const [path, search] = route.split('?');
  const params = new URLSearchParams(search || '');

  // Документы открываются и без входа
  if (path.startsWith('/legal/')) return <LegalPage kind={path.split('/')[2]} tutor={params.get('t') || undefined} />;
  // Страница записи репетитора открывается без входа
  if (path.startsWith('/join/')) return <Join login={decodeURIComponent(path.split('/')[2] || '')} />;
  if (session === undefined) return <Spinner />;
  if (!session) {
    if (path === '/register') return <Register />;
    // Главная до входа: страница платформы. Витрина готовых уроков отдельно: /shop
    if (path === '/' || path === '') return <Landing />;
    if (path === '/shop') return <Shop />;
    return <Login />;
  }
  // Витрина уроков открывается и после входа (ссылка «Готовые уроки» в меню)
  if (path === '/shop') return <Shop />;
  // После входа со страницы /login открываем главную кабинета
  if (path === '/login' || path === '/register') { window.location.hash = '#/'; return <Spinner />; }
  if (user.must_change_password) return <ChangePassword forced />;
  return (
    <Suspense fallback={<Spinner />}>
      {user.role === 'tutor' ? <TutorApp path={path} params={params} /> : <ClientApp path={path} />}
    </Suspense>
  );
}
