// pages/Login.jsx — вход и смена временного пароля
import { useState } from 'react';
import { useLoad } from '../ui';
import { useAuth } from '../auth';
import { api, setToken } from '../api';
import { BRAND } from '../config';
import { Field, useSubmit, Link } from '../ui';
import { LEGAL_LINKS } from './Legal';
import {returnFromLocation} from '../auth-return';
import SubjectInput from '../components/SubjectInput';

function AuthLayout({ children }) {
  return (
    <div className="auth">
      <div className="auth-mobile-brand"><Link to="/" className="brand-name" aria-label="Lessonfold — на главную"><img className="brand-symbol" src="/icon.svg" alt=""/>{BRAND.name}</Link></div>
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
      <Link to="/" className="btn btn-quiet btn-sm auth-back" style={{ marginLeft: -10, marginBottom: 14 }}>← На главную</Link>
      <h1 className="page-title">Вход в кабинет</h1>
      <p className="muted" style={{ margin: '8px 0 28px' }}>
        Входите по почте или логину. Ученикам и родителям доступ выдаёт преподаватель; для самостоятельных курсов можно создать свой аккаунт.
      </p>
      <form className="form" onSubmit={submit}>
        <Field label="Почта или логин">
          <input
            className="input"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck="false"
            inputMode="email"
            placeholder="anna@mail.ru или ivan.petrov"
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
        <Link to="/forgot">Забыли пароль?</Link> Восстановим по почте. Ученикам без почты новый пароль задаёт преподаватель.
      </p>
      {reg.data?.open && (
        <div className="register-cta">
          <Link to={`/learn-register?return=${encodeURIComponent(returnFromLocation())}`}>Хочу учиться самостоятельно</Link><br/><span>Вы репетитор?</span> <Link to="/register">Создать свой кабинет бесплатно</Link>
        </div>
      )}
      <div className="register-cta" style={{ marginTop: 10 }}>
        <span>Хотите сначала посмотреть?</span> <Link to="/try">Открыть тестовый кабинет</Link>
      </div>
      <p className="small" style={{ marginTop: 28, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {LEGAL_LINKS.map((l) => <Link key={l.kind} to={`/legal/${l.kind}`} className="muted">{l.label}</Link>)}
      </p>
    </AuthLayout>
  );
}

// Восстановление пароля: письмо со ссылкой на почту
export function Forgot() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const { busy, error, submit } = useSubmit(async () => { await api.forgotPassword(email.trim().toLowerCase()); setSent(true); });
  return (
    <AuthLayout>
      <Link to="/login" className="btn btn-quiet btn-sm" style={{ marginLeft: -10, marginBottom: 14 }}>← Ко входу</Link>
      <h1 className="page-title">Восстановление пароля</h1>
      {sent ? (
        <p className="muted" style={{ margin: '8px 0 28px' }}>
          Если эта почта привязана к кабинету, на неё придёт письмо со ссылкой. Ссылка действует час. Письма нет несколько минут? Проверьте папку «Спам».
        </p>
      ) : (
        <>
          <p className="muted" style={{ margin: '8px 0 28px' }}>Укажите почту, привязанную к кабинету. Пришлём ссылку для нового пароля.</p>
          <form className="form" onSubmit={submit}>
            <Field label="Почта">
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoCapitalize="none" required />
            </Field>
            {error && <div className="alert">{error}</div>}
            <button className="btn" disabled={busy} style={{ height: 48 }}>{busy ? 'Отправляем…' : 'Прислать ссылку'}</button>
          </form>
          <p className="muted small" style={{ marginTop: 22 }}>Ученикам без почты новый пароль задаёт преподаватель.</p>
        </>
      )}
    </AuthLayout>
  );
}

export function ResetPassword({ token }) {
  const [f, setF] = useState({ password: '', repeat: '' });
  const [done, setDone] = useState(false);
  const { busy, error, submit, setError } = useSubmit(async () => {
    if (f.password !== f.repeat) return setError('Пароли не совпадают');
    await api.resetPassword(token, f.password);
    setToken(null);
    setDone(true);
  });
  return (
    <AuthLayout>
      <h1 className="page-title">Новый пароль</h1>
      {done ? (
        <>
          <p className="muted" style={{ margin: '8px 0 28px' }}>Пароль изменён. Войдите с новым паролем.</p>
          <a className="btn" href="#/login" onClick={() => setTimeout(() => window.location.reload(), 50)}>Войти</a>
        </>
      ) : !token ? (
        <p className="muted" style={{ margin: '8px 0 28px' }}>Ссылка неполная. Откройте её из письма целиком или <Link to="/forgot">запросите новую</Link>.</p>
      ) : (
        <form className="form" onSubmit={submit} style={{ marginTop: 20 }}>
          <Field label="Новый пароль" hint="Минимум 8 символов">
            <input className="input" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} minLength={8} autoComplete="new-password" required />
          </Field>
          <Field label="Ещё раз">
            <input className="input" type="password" value={f.repeat} onChange={(e) => setF({ ...f, repeat: e.target.value })} minLength={8} autoComplete="new-password" required />
          </Field>
          {error && <div className="alert">{error}</div>}
          <button className="btn" disabled={busy} style={{ height: 48 }}>{busy ? 'Сохраняем…' : 'Сохранить пароль'}</button>
        </form>
      )}
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
    const r = await api.changePassword(form.current, form.next);
    if (r?.token) setToken(r.token);
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
  const [f, setF] = useState({ full_name: '', subject: '', email: '', password: '', repeat: '', accept: false });
  const { busy, error, submit, setError } = useSubmit(async () => {
    const destination=returnFromLocation();
    if (f.password !== f.repeat) return setError('Пароли не совпадают');
    await register({ full_name: f.full_name.trim(), email: f.email.trim().toLowerCase(), password: f.password, subject: f.subject.trim(), accept: f.accept });
    window.location.hash=destination;
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <AuthLayout>
      <h1 className="page-title">Свой кабинет репетитора</h1>
      <p className="muted" style={{ margin: '8px 0 28px' }}>
        Расписание, домашние задания с автопроверкой, словарь и учёт оплат. 14 дней всё открыто бесплатно.
      </p>
      <form className="form" onSubmit={submit}>
        <Field label="Имя и фамилия">
          <input className="input" value={f.full_name} onChange={set('full_name')} autoComplete="name" required />
        </Field>
        <Field label="Предмет" hint="Основной. Можно поменять в настройках, у каждого ученика можно указать свой">
          <SubjectInput value={f.subject} onChange={(v) => setF({ ...f, subject: v })} required />
        </Field>
        <Field label="Почта" hint="По ней вы будете входить. Ученики её не видят">
          <input className="input" type="email" value={f.email} onChange={set('email')} autoCapitalize="none" spellCheck="false" autoComplete="email" placeholder="anna@mail.ru" required />
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
          <span className="small">Принимаю <a href="#/terms/terms" target="_blank" rel="noopener">условия использования</a> и <a href="#/terms/dpa" target="_blank" rel="noopener">поручение на обработку данных учеников</a>, ознакомлен(а) с <a href="#/terms/privacy" target="_blank" rel="noopener">политикой конфиденциальности</a>.</span>
        </label>
        {error && <div className="alert">{error}</div>}
        <button className="btn" disabled={busy || !f.accept} style={{ height: 48 }}>{busy ? 'Создаём…' : 'Создать кабинет'}</button>
        <Link to="/" className="btn btn-quiet">У меня уже есть вход</Link>
      </form>
    </AuthLayout>
  );
}

export function LearnerRegister(){
 const {register}=useAuth(),[f,setF]=useState({full_name:'',email:'',password:'',repeat:'',accept:false,adult:false,privacy:false});
 const {busy,error,submit,setError}=useSubmit(async()=>{const destination=returnFromLocation();if(f.password!==f.repeat)return setError('Пароли не совпадают');await register({full_name:f.full_name.trim(),email:f.email.trim(),password:f.password,adult_confirmed:f.adult,accept:f.accept,privacy_acknowledged:f.privacy,terms_version:1},true);window.location.hash=destination;});
 const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
 return <AuthLayout><h1 className="page-title">Учиться самостоятельно</h1><p className="muted">Личный кабинет для курсов английского. Подписка репетитора не нужна. Регистрация здесь — для пользователей от 18 лет.</p><form className="form" onSubmit={submit}>
 <Field label="Как к вам обращаться"><input className="input" autoComplete="name" maxLength={120} required minLength={2} value={f.full_name} onChange={set('full_name')}/></Field>
 <Field label="Почта для входа и покупок"><input className="input" autoComplete="email" type="email" maxLength={255} required value={f.email} onChange={set('email')}/></Field>
 <Field label="Пароль — минимум 8 символов"><input className="input" autoComplete="new-password" type="password" minLength={8} maxLength={100} required value={f.password} onChange={set('password')}/></Field>
 <Field label="Повторите пароль"><input className="input" autoComplete="new-password" type="password" minLength={8} required value={f.repeat} onChange={set('repeat')}/></Field>
 <label className="commerce-check"><input type="checkbox" required checked={f.adult} onChange={e=>setF(p=>({...p,adult:e.target.checked}))}/>Мне исполнилось 18 лет</label>
 <label className="commerce-check"><input type="checkbox" required checked={f.accept} onChange={e=>setF(p=>({...p,accept:e.target.checked}))}/><span>Принимаю <Link to="/terms/learning_terms" target="_blank">условия самостоятельного обучения</Link></span></label>
 <label className="commerce-check"><input type="checkbox" required checked={f.privacy} onChange={e=>setF(p=>({...p,privacy:e.target.checked}))}/><span>Ознакомлен(а) с <Link to="/terms/learning_privacy" target="_blank">информацией об обработке данных</Link> и <Link to="/terms/privacy" target="_blank">политикой платформы</Link></span></label>
 {error&&<div className="alert" role="alert">{error}</div>}<button className="btn" disabled={busy||!f.adult||!f.accept||!f.privacy}>{busy?'Создаём кабинет…':'Создать учебный аккаунт'}</button>
 <Link to={`/login?return=${encodeURIComponent(returnFromLocation())}`}>Уже есть аккаунт — войти</Link><p className="small muted">До 18 лет доступ организует преподаватель с участием родителя. Этот аккаунт не заменяет профиль ребёнка.</p></form></AuthLayout>;
}
