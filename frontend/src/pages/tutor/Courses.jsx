// pages/tutor/Courses.jsx — курсы по учебнику: юниты, материалы к уроку, ДЗ и слова каждого юнита
import { useState } from 'react';
import { api } from '../../api';
import { useLoad, Spinner, ErrorBox, Empty, Icon, Link, navigate, Modal, Field, useSubmit, useToast } from '../../ui';
import { ImportButton, TaskPicker, PickedTasks } from './Library';
import { parseWordLines } from '../../components/Vocab';
import { plural } from '../../format';

export function CoursesList() {
  const list = useLoad(() => api.courses(), []);
  const [creating, setCreating] = useState(false);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Курсы</h1>
          <div className="lead">Учебник по юнитам: что делать на уроке, что задать на дом и какие слова выучить.</div>
        </div>
        <div className="row wrap">
          <ImportButton onDone={list.reload} />
          <button className="btn" onClick={() => setCreating(true)}><Icon name="plus" /> Курс</button>
        </div>
      </div>

      <section className="panel">
        {list.loading && <Spinner />}
        {list.error && <ErrorBox error={list.error} onRetry={list.reload} />}
        {list.data && !list.data.length && (
          <Empty title="Курсов пока нет" action={<button className="btn" onClick={() => setCreating(true)}>Создать курс</button>}>
            Создайте курс вручную или загрузите готовый файл импорта (кнопка «Импорт»).
          </Empty>
        )}
        {(list.data || []).map((c) => (
          <div key={c.id} className="assign-row" onClick={() => navigate(`/courses/${c.id}`)}>
            <div className="assign-icon"><Icon name="layers" /></div>
            <div className="list-main">
              <div className="lib-title">{c.title}</div>
              <div className="list-sub">{[c.level, c.subject].filter(Boolean).join(' · ')}</div>
            </div>
            <div className="counter"><b>{c.unit_count}</b><span>{plural(c.unit_count, 'юнит', 'юнита', 'юнитов')}</span></div>
            <div className="counter"><b>{c.student_count}</b><span>{plural(c.student_count, 'ученик', 'ученика', 'учеников')}</span></div>
          </div>
        ))}
      </section>

      {creating && <CourseModal onClose={() => setCreating(false)} onSaved={(c) => navigate(`/courses/${c.id}`)} />}
    </>
  );
}

function CourseModal({ course, onClose, onSaved }) {
  const [title, setTitle] = useState(course?.title || '');
  const [level, setLevel] = useState(course?.level || '');
  const [description, setDescription] = useState(course?.description || '');
  const save = useSubmit(async () => {
    const data = { title, level: level.trim() || null, description: description.trim() || null };
    onSaved(course ? await api.updateCourse(course.id, data) : await api.createCourse(data));
  });
  return (
    <Modal title={course ? 'Курс' : 'Новый курс'} onClose={onClose}>
      <form className="form" onSubmit={save.submit}>
        <Field label="Название"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Solutions Elementary 3rd ed." autoFocus /></Field>
        <Field label="Уровень"><input className="input" value={level} onChange={(e) => setLevel(e.target.value)} placeholder="A1–A2" /></Field>
        <Field label="Описание"><textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        {save.error && <div className="alert">{save.error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn" disabled={save.busy}>Сохранить</button>
        </div>
      </form>
    </Modal>
  );
}

export function CourseEditor({ id }) {
  const toast = useToast();
  const course = useLoad(() => api.course(id), [id]);
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(null); // id раскрытого юнита или 'new'

  if (course.loading) return <Spinner />;
  if (course.error) return <ErrorBox error={course.error} onRetry={course.reload} />;
  const c = course.data;
  const titles = Object.fromEntries(c.items.map((i) => [i.id, i.title]));

  const move = async (i, d) => {
    const ids = c.units.map((u) => u.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    try {
      await api.orderUnits(c.id, ids);
      course.reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  const remove = async () => {
    if (!window.confirm(`Удалить курс «${c.title}»? Материалы в библиотеке останутся.`)) return;
    try {
      await api.deleteCourse(c.id);
      navigate('/courses');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <>
      <Link to="/courses" className="btn btn-quiet btn-sm" style={{ marginLeft: -10, marginBottom: 10 }}><Icon name="back" /> Курсы</Link>
      <div className="page-head">
        <div>
          <h1 className="page-title">{c.title}</h1>
          <div className="lead">{[c.level, `${c.units.length} ${plural(c.units.length, 'юнит', 'юнита', 'юнитов')}`].filter(Boolean).join(' · ')}</div>
        </div>
        <div className="row wrap">
          <button className="btn btn-quiet btn-sm" onClick={remove}><Icon name="trash" /> Удалить</button>
          <button className="btn btn-secondary" onClick={() => setEditing(true)}><Icon name="edit" /> Курс</button>
          <button className="btn" onClick={() => setOpen('new')}><Icon name="plus" /> Юнит</button>
        </div>
      </div>

      <div className="grid grid-main">
        <section className="panel" style={{ padding: 0 }}>
          {!c.units.length && open !== 'new' && (
            <Empty title="Юнитов пока нет" action={<button className="btn" onClick={() => setOpen('new')}>Добавить юнит</button>}>
              Юнит — это один урок по учебнику: упражнения на урок, ДЗ и слова.
            </Empty>
          )}
          {c.units.map((u, i) => (
            <div key={u.id} className={`unit-block ${open === u.id ? 'open' : ''}`}>
              <div className="unit-block-head" onClick={() => setOpen(open === u.id ? null : u.id)}>
                <span className="unit-code">{u.code || i + 1}</span>
                <div className="list-main">
                  <div className="list-title">{u.title}</div>
                  <div className="list-sub">
                    {[u.item_ids.length && `${u.item_ids.length} на урок`, u.homework_item_ids.length && `${u.homework_item_ids.length} в ДЗ`, u.vocab.length && `${u.vocab.length} слов`]
                      .filter(Boolean).join(' · ') || 'Пусто'}
                  </div>
                </div>
                <button className="icon-btn" aria-label="Выше" disabled={i === 0} onClick={(e) => { e.stopPropagation(); move(i, -1); }}><Icon name="arrowUp" size={16} /></button>
                <button className="icon-btn" aria-label="Ниже" disabled={i === c.units.length - 1} onClick={(e) => { e.stopPropagation(); move(i, 1); }}><Icon name="arrowDown" size={16} /></button>
              </div>
              {open === u.id && (
                <UnitEditor key={u.id} unit={u} titles={titles} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); course.reload(); }} />
              )}
            </div>
          ))}
          {open === 'new' && (
            <div className="unit-block open">
              <UnitEditor courseId={c.id} titles={titles} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); course.reload(); }} />
            </div>
          )}
        </section>

        <section className="panel">
          <h2 className="section-title" style={{ marginBottom: 12 }}>Ученики на курсе</h2>
          {!c.students.length && <p className="muted small" style={{ margin: 0 }}>Запишите ученика во вкладке «Курс» в его карточке.</p>}
          <div className="list">
            {c.students.map((s) => {
              const u = c.units.find((x) => x.id === s.course_unit_id);
              return (
                <Link key={s.id} to={`/students/${s.id}/course`} className="list-item">
                  <div className="list-main">
                    <div className="list-title">{s.full_name}</div>
                    <div className="list-sub">{u ? [u.code, u.title].filter(Boolean).join(' ') : 'Юнит не выбран'}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>

      {editing && <CourseModal course={c} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); course.reload(); }} />}
    </>
  );
}

const vocabToText = (vocab = []) => vocab.map((w) => [w.term, w.translation, w.example].filter(Boolean).join(' — ')).join('\n');

function UnitEditor({ unit, courseId, onClose, onSaved }) {
  const toast = useToast();
  const [code, setCode] = useState(unit?.code || '');
  const [title, setTitle] = useState(unit?.title || '');
  const [goals, setGoals] = useState(unit?.goals || '');
  const [items, setItems] = useState(unit?.item_ids || []);
  const [hw, setHw] = useState(unit?.homework_item_ids || []);
  const [vocab, setVocab] = useState(vocabToText(unit?.vocab));
  const [picking, setPicking] = useState(null); // 'items' | 'hw'

  const save = useSubmit(async () => {
    const data = {
      code: code.trim() || null,
      title,
      goals: goals.trim() || null,
      item_ids: items,
      homework_item_ids: hw,
      vocab: parseWordLines(vocab),
    };
    if (unit) await api.updateUnit(unit.id, data);
    else await api.createUnit(courseId, data);
    toast('Юнит сохранён');
    onSaved();
  });
  const remove = async () => {
    if (!window.confirm(`Удалить юнит «${unit.title}»?`)) return;
    try {
      await api.deleteUnit(unit.id);
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <form className="form unit-editor" onSubmit={save.submit}>
      <div className="form-row" style={{ gridTemplateColumns: '110px 1fr' }}>
        <Field label="Код"><input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="1F" maxLength={20} /></Field>
        <Field label="Название"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Brotherly love?" /></Field>
      </div>
      <Field label="Цель юнита" hint="Видна вам в комнате урока">
        <input className="input" value={goals} onChange={(e) => setGoals(e.target.value)} placeholder="Прилагательные с предлогами: angry about, proud of…" />
      </Field>

      <div className="grid grid-2" style={{ gap: 18 }}>
        <div>
          <div className="row-between" style={{ marginBottom: 4 }}>
            <span className="meta-label">На урок</span>
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => setPicking('items')}><Icon name="plus" /> Выбрать</button>
          </div>
          <PickedTasks ids={items} onChange={setItems} emptyText="Упражнения не выбраны" />
        </div>
        <div>
          <div className="row-between" style={{ marginBottom: 4 }}>
            <span className="meta-label">В ДЗ</span>
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => setPicking('hw')}><Icon name="plus" /> Выбрать</button>
          </div>
          <PickedTasks ids={hw} onChange={setHw} emptyText="Если пусто, в ДЗ уйдут упражнения урока" />
        </div>
      </div>

      <Field label="Слова юнита" hint="По одному на строку: слово — перевод — пример. Попадут в словарь ученика, когда он перейдёт на юнит">
        <textarea className="textarea" style={{ minHeight: 140 }} value={vocab} onChange={(e) => setVocab(e.target.value)}
          placeholder={'keen on — увлекаться\nproud of — гордиться — Are you proud of your sister?'} />
      </Field>

      {save.error && <div className="alert">{save.error}</div>}
      <div className="row-between">
        {unit ? <button type="button" className="btn btn-quiet btn-sm" onClick={remove}><Icon name="trash" /> Удалить юнит</button> : <span />}
        <div className="row">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn" disabled={save.busy}>{save.busy ? 'Сохраняем…' : 'Сохранить'}</button>
        </div>
      </div>

      {picking && (
        <TaskPicker selected={picking === 'items' ? items : hw} onClose={() => setPicking(null)}
          onPick={(next) => { (picking === 'items' ? setItems : setHw)(next); setPicking(null); }} />
      )}
    </form>
  );
}
