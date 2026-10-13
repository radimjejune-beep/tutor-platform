// pages/tutor/Admin.jsx — сисадмин: репетиторы на платформе и регистрация
// Здесь видна только сводка. Ученики, материалы и деньги репетиторов отсюда не открываются
import { useState } from 'react';
import { api } from '../../api';
import { useLoad, Spinner, ErrorBox, Badge, Icon, Modal, Field, useSubmit, useToast } from '../../ui';
import { relativeDay, shortDate } from '../../format';

export default function AdminPage() {
  const toast = useToast();
  const data = useLoad(() => api.adminTutors(), []);
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState(null);

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
              <tr><th>Репетитор</th><th>Учеников</th><th>Уроков за 30 дней</th><th>Последний вход</th><th /></tr>
            </thead>
            <tbody>
              {tutors.map((t) => (
                <tr key={t.id} className={t.is_active ? '' : 'off'}>
                  <td>
                    <div className="list-title">{t.full_name} {t.is_admin && <Badge>сисадмин</Badge>} {!t.is_active && <Badge tone="red">отключён</Badge>}</div>
                    <div className="list-sub">{t.login} · с {shortDate(t.created_at)}{t.must_change_password ? ' · ещё не сменил временный пароль' : ''}</div>
                  </td>
                  <td className="num">{t.students}</td>
                  <td className="num">{t.lessons_30d}</td>
                  <td className="small muted">{t.last_login_at ? relativeDay(t.last_login_at) : 'не входил'}</td>
                  <td>
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
