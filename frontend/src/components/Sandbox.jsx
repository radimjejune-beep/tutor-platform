// components/Sandbox.jsx — тестовый кабинет: страница /try, плашка у преподавателя и возврат из кабинета ученика
import { useEffect, useState } from 'react';
import { api, getToken, setToken } from '../api';
import { useAuth } from '../auth';
import { Icon, Spinner, Link, useLoad } from '../ui';

const BACK = 'lf-sandbox-tutor'; // токен тестового преподавателя, пока смотрим кабинет ученика
const back = () => { try { return sessionStorage.getItem(BACK); } catch { return null; } };

// /#/try: создать свой тестовый кабинет и сразу войти. Ссылку можно отправить кому угодно.
export function TrySandbox() {
  const { session, refresh, logout } = useAuth();
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(Boolean(session));
  useEffect(() => {
    if (confirm) return;
    api.sandboxCreate()
      .then(async ({ token }) => { setToken(token); try { sessionStorage.removeItem(BACK); } catch { /* нет хранилища */ } await refresh(); window.location.hash = '#/'; })
      .catch((e) => setError(e.message));
  }, [confirm]); // eslint-disable-line react-hooks/exhaustive-deps
  if (confirm) {
    return (
      <div className="try-page">
        <h1 className="page-title">Тестовый кабинет</h1>
        <p>Вы уже вошли. Чтобы открыть тестовый кабинет, нужно выйти из текущего аккаунта.</p>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={() => { setToken(null); setConfirm(false); }}>Выйти и открыть</button>
          <Link to="/" className="btn btn-secondary">Остаться</Link>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="try-page">
        <h1 className="page-title">Не получилось</h1>
        <p className="alert">{error}</p>
        <button className="btn btn-secondary" onClick={logout}>На главную</button>
      </div>
    );
  }
  return <div className="try-page"><Spinner /><p className="muted">Готовим тестовый кабинет с примерами…</p></div>;
}

// Плашка в тестовом кабинете преподавателя
export function SandboxBar() {
  const info = useLoad(() => api.sandboxInfo().catch(() => null), []);
  const { refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  if (!info.data?.sandbox) return null;
  const until = info.data.until ? new Date(info.data.until).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) : '';
  const asStudent = async () => {
    setBusy(true);
    try {
      const { token } = await api.sandboxAsStudent();
      try { sessionStorage.setItem(BACK, getToken()); } catch { /* нет хранилища */ }
      setToken(token);
      await refresh();
      window.location.hash = '#/';
    } catch (e) { window.alert(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="sandbox-bar">
      <Icon name="star" size={18} />
      <div><b>Тестовый кабинет.</b> Пробуйте всё: ученики и данные здесь вымышленные, их видите только вы. Кабинет удалится {until ? `${until}` : 'через несколько дней'}.</div>
      <button className="btn btn-sm" disabled={busy} onClick={asStudent}>{busy ? 'Открываем…' : 'Кабинет ученика'}</button>
    </div>
  );
}

// В кабинете ученика, открытом из тестового кабинета: вернуться к преподавателю
export function SandboxBackBar() {
  const { refresh, user } = useAuth();
  const token = back();
  if (!token) return null;
  const go = async () => {
    setToken(token);
    try { sessionStorage.removeItem(BACK); } catch { /* нет хранилища */ }
    await refresh();
    window.location.hash = '#/';
  };
  return (
    <div className="sandbox-bar">
      <Icon name="user" size={18} />
      <div><b>Так видит кабинет ученик {user?.full_name?.replace(' (пример)', '')}.</b> Задания можно выполнять и сдавать, потом проверить их в кабинете преподавателя.</div>
      <button className="btn btn-sm" onClick={go}>Вернуться к преподавателю</button>
    </div>
  );
}
