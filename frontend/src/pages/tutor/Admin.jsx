// pages/tutor/Admin.jsx — сисадмин: репетиторы на платформе и регистрация
// Здесь видна только сводка. Ученики, материалы и деньги репетиторов отсюда не открываются
import { useState } from 'react';
import { useAuth } from '../../auth';
import { api } from '../../api';
import { useLoad, Spinner, ErrorBox, Badge, Icon, Modal, Field, useSubmit, useToast } from '../../ui';
import { relativeDay, shortDate } from '../../format';


// Метрики продукта и состояние сервиса (только сисадмин)
function Metrics() {
  const m = useLoad(() => api.adminMetrics(), []);
  if (!m.data) return null;
  const d = m.data;
  const tiles = [
    ['Репетиторов', d.tutors, `новых за 7 дней: ${d.new_7}, за 30: ${d.new_30}`],
    ['Платят сейчас', d.paying, `≈ ${d.mrr.toLocaleString('ru-RU')} ₽ в месяц · в пробном: ${d.in_trial}`],
    ['Активация', d.activation_pct == null ? 'нет данных' : `${d.activation_pct}%`, 'ученик добавлен, вошёл и сдал задание (за первые 7+ дней)'],
    ['Удержание, 4-я неделя', d.retention_w4_pct == null ? 'нет данных' : `${d.retention_w4_pct}%`, 'урок на этой неделе у тех, кто пришёл 4–8 недель назад'],
    ['Пробный → оплата', d.conversion_pct == null ? 'нет данных' : `${d.conversion_pct}%`, `из ${d.trial_done ?? 0} закончивших пробный`],
    ['Отток за 30 дней', d.churn_pct == null ? 'нет данных' : `${d.churn_pct}%`, `не продлили: ${d.churned_30}`],
    ['Активны на неделе', d.active_week, 'был хотя бы один урок за 7 дней'],
    ['Учеников', d.students, 'активных у всех репетиторов'],
  ];
  return (
    <section className="panel" style={{ marginBottom: 24 }}>
      <h2 className="section-title">Метрики</h2>
      <div className="metric-grid">
        {tiles.map(([t, v, h]) => <div key={t} className="metric"><span className="small muted">{t}</span><b className={`serif${v === 'нет данных' ? ' metric-none' : ''}`}>{v}</b><span className="small muted">{h}</span></div>)}
      </div>
    </section>
  );
}

function SystemState() {
  const toast = useToast();
  const s = useLoad(() => api.adminSystem(), []);
  const [busy, setBusy] = useState(false);
  if (!s.data) return null;
  const d = s.data;
  const b = d.backup;
  const run = async () => {
    setBusy(true);
    try { const r = await api.adminBackup(); toast(`Копия готова: ${Math.round(r.size / 1024)} КБ`); s.reload(); } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  };
  const row = (ok, text, hint) => <li className={ok ? 'ok' : 'bad'}><span>{ok ? '✓' : '!'}</span><div><b>{text}</b>{hint && <div className="small muted">{hint}</div>}</div></li>;
  return (
    <section className="panel" style={{ marginBottom: 24 }}>
      <div className="row-between wrap">
        <h2 className="section-title">Состояние сервиса</h2>
        <button className="btn btn-secondary btn-sm" disabled={busy || !d.backup_key} onClick={run}>{busy ? 'Делаем копию…' : 'Сделать копию сейчас'}</button>
      </div>
      <ul className="sys-list">
        {row(b?.ok && Date.now() - new Date(b.at) < 36 * 36e5, b?.ok ? `Резервная копия: ${new Date(b.at).toLocaleString('ru-RU')}` : b ? 'Последняя копия не удалась' : 'Копий ещё не было', b?.ok ? `${Math.round(b.size / 1024)} КБ, ${b.where === 's3' ? 'в хранилище S3' : 'только на сервере'}` : b?.error || 'Копия делается каждую ночь')}
        {row(d.backup_key, d.backup_key ? 'Ключ шифрования копий задан' : 'Не задан BACKUP_KEY', 'Храните его отдельно от сервера: без него копию не расшифровать')}
        {row(d.s3, d.s3 ? 'Хранилище S3 подключено' : 'Хранилище S3 не подключено', 'S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY: копии и файлы вне сервера')}
        {row(d.legal, d.legal ? 'Реквизиты для документов заданы' : 'Реквизиты не заданы', 'PLATFORM_OWNER_NAME, PLATFORM_OWNER_INN, PLATFORM_EMAIL: попадают в оферту и подвал сайта')}
        <li className={d.mail ? 'ok' : 'bad'}><span>{d.mail ? '✓' : '!'}</span><div><b>{d.mail ? 'Почта для писем настроена' : 'Почта для писем не настроена'}</b><div className="small muted">SMTP_HOST, SMTP_USER, SMTP_PASS: письма восстановления пароля</div>{d.mail && <button type="button" className="btn btn-quiet btn-sm" style={{ marginTop: 4 }} onClick={() => api.adminTestMail().then((r) => toast(`Письмо отправлено на ${r.to}`)).catch((e) => toast(e.message, 'error'))}>Отправить тестовое письмо себе</button>}</div></li>
        {row(d.telegram, d.telegram ? 'Telegram-бот работает' : 'Telegram-бот выключен', 'TELEGRAM_BOT_TOKEN: напоминания ученикам и сообщения вам о сбоях')}
      </ul>
      {d.errors?.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary className="small">Последние ошибки сервера: {d.errors.length}</summary>
          <ul className="err-list">{d.errors.map((e, i) => <li key={i}><span className="small muted">{new Date(e.at).toLocaleString('ru-RU')} · {e.where}</span><div className="small">{e.message}</div></li>)}</ul>
        </details>
      )}
    </section>
  );
}

export default function AdminPage() {
  const toast = useToast();
  const data = useLoad(() => api.adminTutors(), []);
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState(null);
  const { user } = useAuth();
  const [opening, setOpening] = useState(false);
  // Админка магазина: одноразовая ссылка, вход без отдельного пароля
  const openShopAdmin = async () => {
    const w = window.open('', '_blank');
    setOpening(true);
    try {
      const { url } = await api.shopAdminLink();
      if (w) w.location.href = url; else window.location.href = url;
    } catch (err) {
      if (w) w.close();
      toast(err.message, 'error');
    } finally {
      setOpening(false);
    }
  };

  if (data.loading) return <Spinner />;
  if (data.error) return <ErrorBox error={data.error} onRetry={data.reload} />;
  const { tutors, registration_open: open } = data.data;

  const act = (fn, msg) => async () => {
    try {
      const r = await fn();
      if (r?.password) setSecret(r);
      else if (msg) toast(msg);
      data.reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Учителя</h1>
          <div className="lead">У каждого репетитора свой кабинет: ученики, расписание, деньги и материалы. Друг друга они не видят.</div>
        </div>
        <button className="btn" onClick={() => setCreating(true)}><Icon name="plus" /> Репетитор</button>
      </div>

      <Metrics />
      <SystemState />

      <section className="panel" style={{ marginBottom: 24 }}>
        <div className="row-between wrap">
          <div style={{ minWidth: 0 }}>
            <h2 className="section-title">Магазин уроков</h2>
            <div className="small muted" style={{ marginTop: 6 }}>
              Уроки, курсы, цены, картинки и тексты на главной странице. Всё, что опубликуете там, сразу появится на витрине. Входят все сисадмины, отдельный пароль не нужен.
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <a className="btn btn-secondary" href="#/shop">Посмотреть витрину</a>
            <button className="btn" onClick={openShopAdmin} disabled={opening}><Icon name="grid" /> Открыть админку магазина</button>
          </div>
        </div>
      </section>

      <section className="panel" style={{ marginBottom: 24 }}>
        <div className="row-between wrap">
          <div style={{ minWidth: 0 }}>
            <h2 className="section-title">Регистрация</h2>
            <div className="small muted" style={{ marginTop: 6 }}>
              {open ? 'Открыта: на странице входа есть ссылка «Создать свой кабинет бесплатно».' : 'Закрыта: новых репетиторов добавляете только вы.'}
            </div>
          </div>
          <button className={`btn ${open ? 'btn-secondary' : ''}`} onClick={act(() => api.adminSetRegistration(!open), open ? 'Регистрация закрыта' : 'Регистрация открыта')}>
            {open ? 'Закрыть регистрацию' : 'Открыть регистрацию'}
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="table-scroll">
          <table className="admin-table">
            <thead>
              <tr><th>Репетитор</th><th>Тариф</th><th>Учеников</th><th>Уроков за 30 дней</th><th>Последний вход</th><th /></tr>
            </thead>
            <tbody>
              {tutors.map((t) => (
                <tr key={t.id} className={t.is_active ? '' : 'off'}>
                  <td>
                    <div className="list-title">{t.full_name} {t.is_admin && <Badge>сисадмин</Badge>} {!t.is_active && <Badge tone="red">отключён</Badge>}</div>
                    <div className="list-sub">{t.login} · с {shortDate(t.created_at)}{t.must_change_password ? ' · ещё не сменил временный пароль' : ''}</div>
                  </td>
                  <td>{t.is_admin ? <span className="small muted">без ограничений</span> : <PlanCell t={t} onSaved={data.reload} />}</td>
                  <td className="num">{t.students}</td>
                  <td className="num">{t.lessons_30d}</td>
                  <td className="small muted">{t.last_login_at ? relativeDay(t.last_login_at) : 'не входил'}</td>
                  <td>
                    {t.id !== user.id && t.is_active && (
                      <div className="row" style={{ gap: 6, justifyContent: 'flex-end', marginBottom: t.is_admin ? 0 : 6 }}>
                        <button className="btn btn-quiet btn-sm" onClick={act(() => api.adminSetTutorAdmin(t.id, !t.is_admin), t.is_admin ? 'Права сисадмина сняты' : 'Теперь это сисадмин: учителя и магазин уроков')}>
                          {t.is_admin ? 'Снять права сисадмина' : 'Сделать сисадмином'}
                        </button>
                      </div>
                    )}
                    {!t.is_admin && (
                      <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn btn-quiet btn-sm" onClick={act(() => api.adminResetTutor(t.id))}>Новый пароль</button>
                        <button className="btn btn-secondary btn-sm" onClick={act(() => api.adminSetTutorActive(t.id, !t.is_active), t.is_active ? 'Отключён вместе с учениками' : 'Включён')}>
                          {t.is_active ? 'Отключить' : 'Включить'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {creating && <CreateTutorModal onClose={() => setCreating(false)} onCreated={(r) => { setCreating(false); setSecret(r); data.reload(); }} />}
      {secret && <SecretModal data={secret} onClose={() => setSecret(null)} />}
    </>
  );
}

// Тариф репетитора: выбрать и до какой даты. Без даты — бессрочно
function PlanCell({ t, onSaved }) {
  const toast = useToast();
  const [plan, setPlan] = useState(t.plan || 'start');
  const [until, setUntil] = useState(t.plan_until ? String(t.plan_until).slice(0, 10) : '');
  const changed = plan !== (t.plan || 'start') || until !== (t.plan_until ? String(t.plan_until).slice(0, 10) : '');
  const save = async () => {
    try { await api.adminSetPlan(t.id, plan, until); toast('Тариф сохранён'); onSaved(); } catch (err) { toast(err.message, 'error'); }
  };
  const month = () => { const d = new Date(); d.setMonth(d.getMonth() + 1); setUntil(d.toISOString().slice(0, 10)); };
  const year = () => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); setUntil(d.toISOString().slice(0, 10)); };
  return (
    <div className="plan-cell">
      <div className="small"><b>{t.plan_now}</b></div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        <select className="select select-sm" value={plan} onChange={(e) => setPlan(e.target.value)} aria-label="Тариф">
          <option value="start">Старт</option>
          <option value="tutor">Репетитор</option>
          <option value="trial">Пробный</option>
        </select>
        <input type="date" className="input input-sm" value={until} onChange={(e) => setUntil(e.target.value)} aria-label="До даты" />
      </div>
      <div className="row" style={{ gap: 4 }}>
        <button type="button" className="btn btn-quiet btn-sm" onClick={month}>+ месяц</button>
        <button type="button" className="btn btn-quiet btn-sm" onClick={year}>+ год</button>
        {changed && <button type="button" className="btn btn-sm" onClick={save}>Сохранить</button>}
      </div>
    </div>
  );
}

function CreateTutorModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [login, setLogin] = useState('');
  const save = useSubmit(async () => {
    onCreated(await api.adminCreateTutor({ full_name: name.trim(), login: login.trim() || undefined }));
  });
  return (
    <Modal title="Новый репетитор" onClose={onClose}>
      <form className="form" onSubmit={save.submit}>
        <Field label="Имя и фамилия"><input className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus /></Field>
        <Field label="Логин" hint="Можно не заполнять: придумается из имени"><input className="input" value={login} onChange={(e) => setLogin(e.target.value)} autoCapitalize="none" /></Field>
        {save.error && <div className="alert">{save.error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn" disabled={save.busy}>Создать</button>
        </div>
      </form>
    </Modal>
  );
}

// Логин и временный пароль: показываются один раз
function SecretModal({ data, onClose }) {
  const toast = useToast();
  const text = `Вход в Lessonfold: ${window.location.origin}\nЛогин: ${data.login}\nВременный пароль: ${data.password}\nПри первом входе придумайте свой пароль.`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast('Скопировано');
    } catch {
      toast('Не удалось скопировать, выделите текст вручную', 'error');
    }
  };
  return (
    <Modal title="Данные для входа" onClose={onClose}>
      <div className="secret">
        <div className="secret-row"><span>Логин</span><strong>{data.login}</strong></div>
        <div className="secret-row"><span>Временный пароль</span><strong>{data.password}</strong></div>
      </div>
      <p className="small muted">Пароль больше не покажется. При первом входе репетитор придумает свой.</p>
      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={copy}>Скопировать для отправки</button>
        <button className="btn" onClick={onClose}>Готово</button>
      </div>
    </Modal>
  );
}
