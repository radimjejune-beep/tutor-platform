// pages/tutor/Groups.jsx — группы: список, состав, занятия группы
import { useState } from 'react';
import { api } from '../../api';
import { useLoad, Spinner, ErrorBox, Empty, Badge, Icon, Link, navigate, Modal, Field, useSubmit, useToast } from '../../ui';
import { NewLessonModal } from './modals';
import { GroupFinishModal } from '../../components/GroupLesson';
import { rub, relativeDay, time, dayMonth, shortDate, LESSON_STATUS, plural } from '../../format';

export function PeopleTabs({ active }) {
  return (
    <div className="tabs" role="tablist">
      <button role="tab" aria-selected={active === 'students'} className={active === 'students' ? 'active' : ''} onClick={() => navigate('/students')}>Ученики</button>
      <button role="tab" aria-selected={active === 'groups'} className={active === 'groups' ? 'active' : ''} onClick={() => navigate('/groups')}>Группы</button>
    </div>
  );
}

export function GroupsList() {
  const list = useLoad(() => api.groups(), []);
  const [adding, setAdding] = useState(false);
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Группы</h1>
          <div className="lead">Ученики, которые занимаются вместе. Занятие ставится всей группе, отметка у каждого своя.</div>
        </div>
        <button className="btn" onClick={() => setAdding(true)}><Icon name="plus" /> Группа</button>
      </div>
      <PeopleTabs active="groups" />
      <section className="panel">
        {list.loading && <Spinner />}
        {list.error && <ErrorBox error={list.error} onRetry={list.reload} />}
        {list.data && !list.data.length && (
          <Empty title="Групп пока нет" action={<button className="btn" onClick={() => setAdding(true)}>Создать группу</button>}>
            Например, «Мини-группа 3 класс» или «Подготовка к ОГЭ, вторник».
          </Empty>
        )}
        {(list.data || []).map((g) => (
          <div key={g.id} className="list-item clickable" onClick={() => navigate(`/groups/${g.id}`)}>
            <div className="avatar">{g.members.length}</div>
            <div className="list-main">
              <div className="list-title">{g.name}</div>
              <div className="list-sub truncate">
                {g.members.map((m) => m.full_name.split(' ')[0]).join(', ') || 'Пока никого'}
                {g.next_lesson_at && `. Следующее: ${relativeDay(g.next_lesson_at).toLowerCase()} в ${time(g.next_lesson_at)}`}
              </div>
            </div>
            {g.level && <Badge>{g.level}</Badge>}
          </div>
        ))}
      </section>
      {adding && <GroupModal onClose={() => setAdding(false)} onSaved={(g) => navigate(`/groups/${g.id}`)} />}
    </>
  );
}

function GroupModal({ group, onClose, onSaved }) {
  const students = useLoad(() => (group ? Promise.resolve([]) : api.students()), []);
  const [f, setF] = useState({
    name: group?.name || '',
    level: group?.level || '',
    default_price: group?.default_price ?? '',
    default_duration: group?.default_duration ?? 60,
    call_link: group?.call_link || '',
    board_link: group?.board_link || '',
  });
  const [ids, setIds] = useState(new Set());
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = useSubmit(async () => {
    const data = {
      name: f.name,
      level: f.level.trim() || null,
      default_price: Number(f.default_price) || 0,
      default_duration: Number(f.default_duration) || 60,
      call_link: f.call_link.trim() || null,
      board_link: f.board_link.trim() || null,
    };
    onSaved(group ? await api.updateGroup(group.id, data) : await api.createGroup({ ...data, student_ids: [...ids] }));
  });
  return (
    <Modal title={group ? 'Группа' : 'Новая группа'} onClose={onClose} wide>
      <form className="form" onSubmit={save.submit}>
        <div className="form-row">
          <Field label="Название"><input className="input" value={f.name} onChange={set('name')} placeholder="Мини-группа, 3 класс" required autoFocus /></Field>
          <Field label="Уровень"><input className="input" value={f.level} onChange={set('level')} placeholder="A1" /></Field>
        </div>
        <div className="form-row">
          <Field label="Цена с ученика за занятие"><input className="input" type="number" min={0} step={50} value={f.default_price} onChange={set('default_price')} placeholder="900" /></Field>
          <Field label="Длительность, мин"><input className="input" type="number" min={15} max={240} step={5} value={f.default_duration} onChange={set('default_duration')} /></Field>
        </div>
        <Field label="Ссылка на звонок" hint="Одна на всю группу"><input className="input" value={f.call_link} onChange={set('call_link')} placeholder="https://telemost.yandex.ru/j/..." /></Field>
        <Field label="Ссылка на доску"><input className="input" value={f.board_link} onChange={set('board_link')} /></Field>
        {!group && (
          <Field label="Кто в группе">
            <div className="student-pick">
              {(students.data || []).map((s) => (
                <label key={s.id} className={ids.has(s.id) ? 'on' : ''}>
                  <input type="checkbox" checked={ids.has(s.id)} onChange={() => { const n = new Set(ids); n.has(s.id) ? n.delete(s.id) : n.add(s.id); setIds(n); }} />
                  {s.full_name}
                </label>
              ))}
            </div>
          </Field>
        )}
        {save.error && <div className="alert">{save.error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn" disabled={save.busy}>Сохранить</button>
        </div>
      </form>
    </Modal>
  );
}

export function GroupPage({ id }) {
  const toast = useToast();
  const group = useLoad(() => api.group(id), [id]);
  const students = useLoad(() => api.students(), []);
  const [modal, setModal] = useState(null);
  const [adding, setAdding] = useState('');

  if (group.loading) return <Spinner />;
  if (group.error) return <ErrorBox error={group.error} onRetry={group.reload} />;
  const g = group.data;
  const memberIds = new Set(g.members.map((m) => m.id));
  const others = (students.data || []).filter((s) => !memberIds.has(s.id));
  const now = Date.now();
  const upcoming = g.lessons.filter((l) => new Date(l.starts_at).getTime() > now - l.duration_min * 60000);
  const past = g.lessons.filter((l) => !upcoming.includes(l)).reverse();

  const act = (fn, msg) => async () => {
    try {
      await fn();
      if (msg) toast(msg);
      group.reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <>
      <Link to="/groups" className="btn btn-quiet btn-sm" style={{ marginLeft: -10, marginBottom: 10 }}><Icon name="back" /> Группы</Link>
      <div className="page-head">
        <div>
          <h1 className="page-title">{g.name}</h1>
          <div className="lead">
            {[g.level, `${g.members.length} ${plural(g.members.length, 'ученик', 'ученика', 'учеников')}`, `${rub(g.default_price)} с ученика`, `${g.default_duration} мин`].filter(Boolean).join(' · ')}
          </div>
        </div>
        <div className="row wrap">
          <button className="btn btn-secondary" onClick={() => setModal({ type: 'edit' })}><Icon name="edit" /> Группа</button>
          <Link to={`/homework/new?students=${[...memberIds].join(',')}`} className="btn btn-secondary">Задание группе</Link>
          <button className="btn" onClick={() => setModal({ type: 'lesson' })}><Icon name="plus" /> Занятие</button>
        </div>
      </div>

      <div className="grid grid-main">
        <section className="panel">
          <h2 className="section-title" style={{ marginBottom: 12 }}>Ближайшие занятия</h2>
          {!upcoming.length && <Empty title="Занятий нет" action={<button className="btn" onClick={() => setModal({ type: 'lesson' })}>Поставить занятие</button>} />}
          <div className="list">
            {upcoming.map((l) => {
              const first = l.students[0];
              const scheduled = l.students.some((s) => s.status === 'scheduled');
              return (
                <div key={l.starts_at} className="list-item">
                  <div className="time-chip">{time(l.starts_at)}</div>
                  <div className="list-main">
                    <div className="list-title">{relativeDay(l.starts_at)}, {dayMonth(l.starts_at)}</div>
                    <div className="list-sub">{l.topic || `${l.duration_min} минут`}</div>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    {first && <Link to={`/lesson/${first.lesson_id}`} className="btn btn-secondary btn-sm">Комната</Link>}
                    {scheduled && <button className="btn btn-sm" onClick={() => setModal({ type: 'finish', session: l })}><Icon name="check" /> Завершить</button>}
                    {scheduled && <button className="icon-btn" title="Отменить для всех" aria-label="Отменить для всех"
                      onClick={act(() => api.cancelGroupLesson(g.id, l.starts_at), 'Занятие отменено для всех')}><Icon name="close" size={16} /></button>}
                  </div>
                </div>
              );
            })}
          </div>
          {past.length > 0 && (
            <>
              <h2 className="section-title" style={{ margin: '24px 0 8px' }}>Прошедшие</h2>
              <div className="list">
                {past.slice(0, 8).map((l) => (
                  <div key={l.starts_at} className="list-item">
                    <div className="list-main">
                      <div className="list-title">{shortDate(l.starts_at)}, {time(l.starts_at)}{l.topic ? ` · ${l.topic}` : ''}</div>
                      <div className="list-sub">
                        {l.students.map((s) => `${s.student_name.split(' ')[0]}: ${LESSON_STATUS[s.status]?.label.toLowerCase()}`).join(', ')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="panel">
          <h2 className="section-title" style={{ marginBottom: 12 }}>Состав</h2>
          <div className="list">
            {g.members.map((m) => (
              <div key={m.id} className="list-item">
                <div className="list-main">
                  <Link to={`/students/${m.id}`} className="list-title" style={{ color: 'var(--ink)' }}>{m.full_name}</Link>
                  {m.level && <div className="list-sub">{m.level}</div>}
                </div>
                <button className="icon-btn" title="Убрать из группы" aria-label="Убрать из группы"
                  onClick={act(() => api.removeGroupMember(g.id, m.id), 'Ученик убран из группы, его будущие занятия группы удалены')}><Icon name="close" size={16} /></button>
              </div>
            ))}
          </div>
          {others.length > 0 && (
            <div className="row" style={{ marginTop: 12, gap: 8 }}>
              <select className="select" value={adding} onChange={(e) => setAdding(e.target.value)} style={{ flex: 1 }}>
                <option value="">Добавить ученика</option>
                {others.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
              <button className="btn btn-sm" disabled={!adding}
                onClick={act(async () => { const r = await api.addGroupMember(g.id, Number(adding)); setAdding(''); toast(r.added ? `Добавлен, будущих занятий: ${r.added}` : 'Ученик добавлен'); })}>
                Добавить
              </button>
            </div>
          )}
        </section>
      </div>

      {modal?.type === 'edit' && <GroupModal group={g} onClose={() => setModal(null)} onSaved={() => { setModal(null); group.reload(); }} />}
      {modal?.type === 'lesson' && <NewLessonModal groupId={g.id} onClose={() => setModal(null)} onSaved={() => { setModal(null); group.reload(); }} />}
      {modal?.type === 'finish' && (
        <GroupFinishModal groupId={g.id} session={modal.session} onClose={() => setModal(null)} onDone={() => { setModal(null); group.reload(); }} />
      )}
    </>
  );
}
