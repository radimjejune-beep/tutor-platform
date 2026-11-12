// App.jsx — выбор кабинета по роли и маршруты
// Главная, вход и документы в основном файле; кабинеты грузятся отдельно после входа,
// поэтому главная страница открывается быстрее.
import { TrySandbox } from './components/Sandbox';
import { lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './auth';
import { ToastProvider, Spinner, useRoute } from './ui';
import { Login, ChangePassword, Register, Forgot, ResetPassword } from './pages/Login';
import { LegalPage, PlatformDocPage } from './pages/Legal';
import Join from './pages/Join';
import Landing from './pages/Landing';
import Shop from './pages/Shop';

// Если файл кабинета не загрузился (сайт обновился, пока вкладка была открыта), перезагружаем страницу один раз
const retry = (load) => () => load().catch((err) => {
  let last = 0;
  try { last = Number(sessionStorage.getItem('lf-reloaded') || 0); } catch { /* нет хранилища */ }
  if (Date.now() - last > 60000) {
    try { sessionStorage.setItem('lf-reloaded', String(Date.now())); } catch { /* нет хранилища */ }
    window.location.reload();
    return new Promise(() => {});
  }
  throw err;
});
const TutorApp = lazy(retry(() => import('./cabinets/TutorApp')));
const ClientApp = lazy(retry(() => import('./cabinets/ClientApp')));

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
  if (path.startsWith('/terms/')) return <PlatformDocPage kind={path.split('/')[2]} />;
  if (path.startsWith('/legal/')) return <LegalPage kind={path.split('/')[2]} tutor={params.get('t') || undefined} />;
  // Страница записи репетитора открывается без входа
  if (path.startsWith('/join/')) return <Join login={decodeURIComponent(path.split('/')[2] || '')} />;
  // Восстановление пароля по ссылке из письма работает и без входа
  if (path === '/reset') return <ResetPassword token={params.get('token') || ''} />;
  if (session === undefined) return <Spinner />;
  // Тестовый кабинет без регистрации: ссылку /#/try можно отправить кому угодно
  if (path === '/try') return <TrySandbox />;
  if (!session) {
    if (path === '/register') return <Register />;
    if (path === '/forgot') return <Forgot />;
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
