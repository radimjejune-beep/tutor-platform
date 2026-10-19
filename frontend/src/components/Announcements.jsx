// components/Announcements.jsx — объявления на главной
// Ученику и родителю: лента от преподавателя. Репетитору: свои объявления (создать, изменить, удалить)
// и объявления платформы от сисадмина.
import { useState } from 'react';
import { api } from '../api';
import { useLoad, Icon, Modal, Field, useSubmit, useToast, Badge } from '../ui';
import { useAuth } from '../auth';
import { shortDate, todayISO } from '../format';

function Item({ a, actions }) {
  return (
    <article className={`ann ${a.pinned ? 'pinned' : ''} ${a.active === false ? 'faded' : ''}`}>
      <div className="ann-head">
        <h3 className="ann-title">{a.pinned && <Icon name="flag" size={15} />} {a.title}</h3>
        {actions}
      </div>
      {a.body && <p className="ann-body">{a.body}</p>}
      <div className="ann-foot small muted">
        <span>{shortDate(a.created_at)}{a.author ? ` · ${a.author}` : ''}</span>
        {a.expires_on && <span>{a.active === false ? 'закончилось' : `до ${shortDate(a.expires_on)}`}</span>}
        {a.audience === 'tutors' && <Badge tone="brass">всем репетиторам</Badge>}
        {a.link && <a href={a.link} target="_blank" rel="noreferrer" className="ann-link">Открыть ссылку →</a>}
      </div>
    </article>
  );
}

// Лента для ученика и родителя
export function ClientAnnouncements() {
  const list = useLoad(() => api.announcements(), []);
  if (!list.data?.length) return null;
  return (
    <section className="ann-feed" aria-label="Объявления">
      {list.data.map((a) => <Item key={a.id} a={a} />)}
    </section>
  );
}

// Блок на главной репетитора
export function TutorAnnouncements() {
  const { user } = useAuth();
  const toast = useToast();
  const list = useLoad(() => api.announcements(), []);
  const [edit, setEdit] = useState(null);
  const [showOld, setShowOld] = useState(false);
  if (list.loading || list.error) return null;
  const { mine, platform } = list.data;
  const active = mine.filter((a) => a.active);
  const old = mine.filter((a) => !a.active);
  const remove = async (a) => {
    if (!window.confirm(`Удалить объявление «${a.title}»?`)) return;
    try { await api.deleteAnnouncement(a.id); list.reload(); } catch (err) { toast(err.message, 'error'); }
  };
  const actions = (a) => (
    <span className="row" style={{ gap: 2 }}>
      <button className="icon-btn" aria-label="Изменить" onClick={() => setEdit(a)}><Icon name="edit" size={16} /></button>
      <button className="icon-btn" aria-label="Удалить" onClick={() => remove(a)}><Icon name="trash" size={16} /></button>
    </span>
  );
  return (
    <section className="panel" style={{ marginTop: 24 }}>
      {platform.length > 0 && (
        <div className="ann-feed" style={{ marginBottom: 18 }}>
          {platform.map((a) => <Item key={a.id} a={a} />)}
        </div>
      )}
      <div className="panel-head">
        <h2 className="section-title">Объявления для учеников</h2>
        <button className="btn btn-secondary btn-sm" onClick={() => setEdit({})}><Icon name="plus" /> Объявление</button>
      </div>
      {!active.length && <p className="small muted" style={{ margin: 0 }}>Ученики и родители видят объявления вверху своей главной. Например: каникулы, перенос занятий, новый набор слов, акция «приведи друга».</p>}
      <div className="ann-feed">{active.map((a) => <Item key={a.id} a={a} actions={actions(a)} />)}</div>
      {old.length > 0 && (
        <>
          <button className="btn btn-quiet btn-sm" style={{ marginTop: 8 }} onClick={() => setShowOld(!showOld)}>{showOld ? 'Скрыть прошедшие' : `Прошедшие (${old.length})`}</button>
          {showOld && <div className="ann-feed">{old.map((a) => <Item key={a.id} a={a} actions={actions(a)} />)}</div>}
        </>
      )}
      {edit && <EditModal a={edit} isAdmin={user.is_admin} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); list.reload(); }} />}
    </section>
  );
}

function EditModal({ a, isAdmin, onClose, onSaved }) {
  const isNew = !a.id;
  const [f, setF] = useState({
    title: a.title || '', body: a.body || '', link: a.link || '', expires_on: a.expires_on ? String(a.expires_on).slice(0, 10) : '',
    pinned: Boolean(a.pinned), audience: a.audience || 'students', notify: isNew,
  });
  const set = (patch) => setF({ ...f, ...patch });
  const save = useSubmit(async () => {
    const body = { title: f.title.trim(), body: f.body.trim() || null, link: f.link.trim() || null, expires_on: f.expires_on || null, pinned: f.pinned };
    if (isAdmin) body.audience = f.audience;
    if (isNew) await api.createAnnouncement({ ...body, notify: f.notify });
    else await api.updateAnnouncement(a.id, body);
    onSaved();
  });
  return (
    <Modal title={isNew ? 'Новое объявление' : 'Объявление'} onClose={onClose}>
      <form className="form" onSubmit={save.submit}>
        <Field label="Заголовок"><input className="input" value={f.title} onChange={(e) => set({ title: e.target.value })} maxLength={200} placeholder="Каникулы с 1 по 10 ноября" autoFocus required /></Field>
        <Field label="Текст"><textarea className="textarea" rows={4} value={f.body} onChange={(e) => set({ body: e.target.value })} maxLength={5000} placeholder="Занятий не будет. Чтобы не забыть слова, занимайтесь в разделе «Словарь»: там новые наборы карточек." /></Field>
        <Field label="Ссылка" hint="Необязательно: статья, запись урока, форма"><input className="input" type="url" value={f.link} onChange={(e) => set({ link: e.target.value })} placeholder="https://" /></Field>
        <div className="form-row">
          <Field label="Показывать до" hint="Пусто: пока не удалите"><input className="input" type="date" min={todayISO()} value={f.expires_on} onChange={(e) => set({ expires_on: e.target.value })} /></Field>
          {isAdmin && (
            <Field label="Кому">
              <select className="select" value={f.audience} onChange={(e) => set({ audience: e.target.value })}>
                <option value="students">Моим ученикам и родителям</option>
                <option value="tutors">Всем репетиторам платформы</option>
              </select>
            </Field>
          )}
        </div>
        <label className="check"><input type="checkbox" checked={f.pinned} onChange={(e) => set({ pinned: e.target.checked })} /> Закрепить вверху</label>
        {isNew && <label className="check"><input type="checkbox" checked={f.notify} onChange={(e) => set({ notify: e.target.checked })} /> Отправить уведомление в колокольчик</label>}
        {save.error && <div className="alert">{save.error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn" disabled={save.busy || !f.title.trim()}>{save.busy ? 'Сохраняем…' : isNew ? 'Опубликовать' : 'Сохранить'}</button>
        </div>
      </form>
    </Modal>
  );
}
