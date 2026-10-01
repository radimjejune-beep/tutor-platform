// pages/Login.jsx — вход и смена временного пароля
import { useState } from 'react';
import { useAuth } from '../auth';
import { api } from '../api';
import { BRAND } from '../config';
import { Field, useSubmit } from '../ui';

function AuthLayout({ children }) {
  return (
    <div className="auth">
      <div className="auth-art">
        <div>
          <div className="brand-name" style={{ fontSize: 24 }}>{BRAND.name}</div>
          <div className="brand-rule" />
        </div>
        <div className="auth-quote">
          Каждое занятие, задание и шаг вперёд в одном месте
        </div>
        <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 14, position: 'relative' }}>
          Расписание, домашние задания, прогресс и отчёты
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
        Забыли пароль? Напишите преподавателю — он задаст новый.
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
