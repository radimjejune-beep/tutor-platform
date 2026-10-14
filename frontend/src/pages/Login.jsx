// pages/Login.jsx — вход и смена временного пароля
import { useState } from 'react';
import { useLoad } from '../ui';
import { useAuth } from '../auth';
import { api } from '../api';
import { BRAND } from '../config';
import { Field, useSubmit, Link } from '../ui';
import { LEGAL_LINKS } from './Legal';
import SubjectInput from '../components/SubjectInput';

function AuthLayout({ children }) {
  return (
    <div className="auth">
      <div className="auth-art">
        <div>
          <div className="brand-name" style={{ fontSize: 30 }}>{BRAND.name}</div>
          <div className="brand-rule" />
        </div>
        <div className="auth-quote">
          Каждое занятие, задание и шаг вперёд в одном месте
        </div>
        <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 14, position: 'relative' }}>
          {BRAND.tagline}
        </div>
      </div>
      <div className="auth-form-wrap">
        <div className="auth-card">{children}</div>
      </div>
    </div>
  );
}

export function Login() {
  const { login } = useAuth();
  const [form, setForm] = useState({ login: '', password: '' });
  const { busy, error, submit } = useSubmit(() => login(form.login.trim(), form.password));
  const reg = useLoad(() => api.registrationStatus().catch(() => ({ open: false })), []);

  return (
    <AuthLayout>
      <h1 className="page-title">Вход в кабинет</h1>
      <p className="muted" style={{ margin: '8px 0 28px' }}>
        Логин и пароль выдаёт преподаватель
      </p>
      <form className="form" onSubmit={submit}>
        <Field label="Логин">
          <input
            className="input"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck="false"
            placeholder="ivan.petrov"
            value={form.login}
            onChange={(e) => setForm({ ...form, login: e.target.value })}
            required
          />
        </Field>
        <Field label="Пароль">
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
        </Field>
        {error && <div className="alert">{error}</div>}
        <button className="btn" disabled={busy} style={{ marginTop: 6, height: 48 }}>
          {busy ? 'Входим…' : 'Войти'}
        </button>
      </form>
      <p className="muted small" style={{ marginTop: 22 }}>
        Забыли пароль? Напишите преподавателю, он задаст новый.
      </p>
      {reg.data?.open && (
        <div className="register-cta">
          <span>Вы репетитор?</span> <Link to="/register">Создать свой кабинет бесплатно</Link>
        </div>
      )}
      <p className="small" style={{ marginTop: 28, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {LEGAL_LINKS.map((l) => <Link key={l.kind} to={`/legal/${l.kind}`} className="muted">{l.label}</Link>)}
      </p>
    </AuthLayout>
  );
}

export function ChangePassword({ forced, onDone }) {
  const { refresh, logout } = useAuth();
  const [form, setForm] = useState({ current: '', next: '', repeat: '' });
  const { busy, error, submit, setError } = useSubmit(async () => {
    if (form.next !== form.repeat) {
      setError('Пароли не совпадают');
      return;
    }
    await api.changePassword(form.current, form.next);
    await refresh();
    onDone?.();
  });

  const body = (
    <>
      <h1 className="page-title">{forced ? 'Придумайте пароль' : 'Смена пароля'}</h1>
      <p className="muted" style={{ margin: '8px 0 28px' }}>
        {forced ? 'Временный пароль нужно заменить на свой. Минимум 6 символов.' : 'Минимум 6 символов.'}
      </p>
      <form className="form" onSubmit={submit}>
        <Field label={forced ? 'Временный пароль' : 'Текущий пароль'}>
          <input className="input" type="password" autoComplete="current-password" value={form.current}
            onChange={(e) => setForm({ ...form, current: e.target.value })} required />
        </Field>
        <Field label="Новый пароль">
          <input className="input" type="password" autoComplete="new-password" minLength={6} value={form.next}
            onChange={(e) => setForm({ ...form, next: e.target.value })} required />
        </Field>
        <Field label="Повторите новый пароль">
          <input className="input" type="password" autoComplete="new-password" minLength={6} value={form.repeat}
            onChange={(e) => setForm({ ...form, repeat: e.target.value })} required />
        </Field>
        {error && <div className="alert">{error}</div>}
        <button className="btn" disabled={busy} style={{ height: 48 }}>
          {busy ? 'Сохраняем…' : 'Сохранить пароль'}
        </button>
        {forced && (
          <button type="button" className="btn btn-quiet" onClick={logout}>
            Выйти
          </button>
        )}
      </form>
    </>
  );

  return forced ? <AuthLayout>{body}</AuthLayout> : <div className="panel" style={{ maxWidth: 460 }}>{body}</div>;
}

// Регистрация репетитора: свой кабинет, ученики и расписание. Пока бесплатно
export function Register() {
  const { register } = useAuth();
  const [f, setF] = useState({ full_name: '', subject: '', login: '', password: '', repeat: '', accept: false });
  const { busy, error, submit, setError } = useSubmit(async () => {
    if (f.password !== f.repeat) return setError('Пароли не совпадают');
    await register({ full_name: f.full_name.trim(), login: f.login.trim().toLowerCase(), password: f.password, subject: f.subject.trim(), accept: f.accept });
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <AuthLayout>
      <h1 className="page-title">Свой кабинет репетитора</h1>
      <p className="muted" style={{ margin: '8px 0 28px' }}>
        Расписание, оплаты, задания, курсы по учебникам и кабинеты для учеников и родителей. Сейчас бесплатно.
      </p>
      <form className="form" onSubmit={submit}>
        <Field label="Имя и фамилия">
          <input className="input" value={f.full_name} onChange={set('full_name')} autoComplete="name" required />
        </Field>
        <Field label="Предмет" hint="Основной. Можно поменять в настройках, у каждого ученика можно указать свой">
          <SubjectInput value={f.subject} onChange={(v) => setF({ ...f, subject: v })} required />
        </Field>
        <Field label="Логин" hint="Латиница, цифры и точка. Его вы будете вводить при входе">
          <input className="input" value={f.login} onChange={set('login')} autoCapitalize="none" spellCheck="false" autoComplete="username" placeholder="anna.teacher" required />
        </Field>
        <div className="form-row">
          <Field label="Пароль" hint="Минимум 8 символов">
            <input className="input" type="password" value={f.password} onChange={set('password')} minLength={8} autoComplete="new-password" required />
          </Field>
          <Field label="Ещё раз">
            <input className="input" type="password" value={f.repeat} onChange={set('repeat')} minLength={8} autoComplete="new-password" required />
          </Field>
        </div>
        <label className="check" style={{ alignItems: 'flex-start' }}>
          <input type="checkbox" checked={f.accept} onChange={(e) => setF({ ...f, accept: e.target.checked })} required style={{ marginTop: 3 }} />
          <span className="small">Понимаю, что сервис работает в тестовом режиме. За данные своих учеников и их согласия на обработку отвечаю я сам.</span>
        </label>
        {error && <div className="alert">{error}</div>}
        <button className="btn" disabled={busy || !f.accept} style={{ height: 48 }}>{busy ? 'Создаём…' : 'Создать кабинет'}</button>
        <Link to="/" className="btn btn-quiet">У меня уже есть вход</Link>
      </form>
    </AuthLayout>
  );
}
