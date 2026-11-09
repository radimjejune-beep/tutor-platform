// pages/Profile.jsx — профиль: кто я, имя, тариф, Telegram, пароль, помощь и выход. Для всех ролей.
import { useState } from 'react';
import { useAuth } from '../auth';
import { api } from '../api';
import { Field, Icon, Link, useLoad, useSubmit, useToast } from '../ui';
import { ChangePassword } from './Login';
import TelegramCard from '../components/TelegramCard';

const ROLE = { tutor: 'Преподаватель', student: 'Ученик', parent: 'Родитель' };
const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

function NameForm({ user, refresh }) {
  const toast = useToast();
  const [name, setName] = useState(user.full_name || '');
  const { busy, error, submit } = useSubmit(async () => {
    await api.setProfile(name);
    await refresh();
    toast('Имя сохранено');
  });
  return (
    <form className="form" onSubmit={submit} style={{ maxWidth: 460 }}>
      <Field label="Имя" hint="Так вас видят ученики и родители: в расписании, сообщениях и боте">
        <input className="input" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} required />
      </Field>
      {error && <div className="alert">{error}</div>}
      <div><button className="btn" disabled={busy || name.trim() === (user.full_name || '')}>{busy ? 'Сохраняем…' : 'Сохранить имя'}</button></div>
    </form>
  );
}

function PlanLine() {
  const plan = useLoad(() => api.myPlan().catch(() => null), []);
  const p = plan.data?.current;
  if (!p) return null;
  const until = p.until ? new Date(p.until).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) : null;
  return (
    <Link to="/settings/plan" className="profile-row">
      <Icon name="wallet" size={18} />
      <span><b>Тариф: {p.name}</b>{until && <span className="muted">, до {until}</span>}</span>
      <span className="muted small">Подробнее</span>
    </Link>
  );
}

export default function Profile() {
  const { user, students, logout, refresh } = useAuth();
  const tutor = user.role === 'tutor';
  const [pwd, setPwd] = useState(false);
  return (
    <>
      <div className="page-head"><h1 className="page-title">Профиль</h1></div>

      <section className="panel profile-card">
        <div className="profile-avatar serif">{initials(user.full_name)}</div>
        <div>
          <div className="profile-name">{user.full_name}</div>
          <div className="muted">{ROLE[user.role]}, логин <b>{user.login}</b></div>
          {!tutor && students.length > 0 && (
            <div className="muted small" style={{ marginTop: 4 }}>{user.role === 'parent' ? 'Дети' : 'Ученик'}: {students.map((s) => s.full_name).join(', ')}</div>
          )}
        </div>
      </section>

      {tutor && (
        <section className="panel" style={{ marginTop: 20 }}>
          <h2 className="section-title" style={{ marginBottom: 14 }}>Данные</h2>
          <NameForm user={user} refresh={refresh} />
        </section>
      )}

      <section className="panel profile-links" style={{ marginTop: 20 }}>
        {tutor && <PlanLine />}
        {tutor && (
          <Link to="/settings" className="profile-row"><Icon name="settings" size={18} /><span><b>Настройки</b><span className="muted"> предмет, запись учеников, документы</span></span><span /></Link>
        )}
        <Link to="/help" className="profile-row"><Icon name="book" size={18} /><span><b>Как пользоваться</b><span className="muted"> короткая инструкция по разделам</span></span><span /></Link>
        <button type="button" className="profile-row" onClick={() => setPwd((v) => !v)}><Icon name="key" size={18} /><span><b>Сменить пароль</b></span><span className="muted small">{pwd ? 'Свернуть' : ''}</span></button>
      </section>

      {pwd && <div style={{ marginTop: 20 }}><ChangePassword onDone={() => setPwd(false)} /></div>}

      {!tutor && <TelegramCard style={{ marginTop: 20 }} />}

      <button type="button" className="btn btn-danger profile-logout" onClick={logout}><Icon name="logout" size={18} /> Выйти из аккаунта</button>
    </>
  );
}
