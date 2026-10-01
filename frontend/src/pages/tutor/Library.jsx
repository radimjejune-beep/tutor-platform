// pages/tutor/Library.jsx — библиотека преподавателя: теория и задачник
import { useState } from 'react';
import { api } from '../../api';
import { useLoad, Spinner, ErrorBox, Empty, Badge, Icon, Field, Link, Modal, navigate, useToast, useSubmit } from '../../ui';
import { FileList, FileUploadButton } from '../../components/Files';
import LibraryItem, { ItemMeta, examLabel } from '../../components/LibraryItem';
import { relativeDay, dayMonth, time } from '../../format';

const KINDS = { task: 'Задачник', theory: 'Теория' };
const orNull = (v) => (v && String(v).trim() ? String(v).trim() : null);

/* ============================================================
   Фильтры (общие для списка и выбора задач)
   ============================================================ */
function useFilters(kind) {
  const [f, setF] = useState({ kind, subject: '', exam: '', exam_task: '', tag: '', q: '' });
  return [f, setF];
}

function Filters({ f, setF, facets }) {
  return (
    <div className="lib-filters">
      <input className="input" placeholder="Поиск по названию, тексту и заметкам" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
      {facets.subjects.length > 1 && (
        <select className="select" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} aria-label="Предмет">
          <option value="">Все предметы</option>
          {facets.subjects.map((s) => <option key={s}>{s}</option>)}
        </select>
      )}
      <select className="select" value={f.exam} onChange={(e) => setF({ ...f, exam: e.target.value, exam_task: '' })} aria-label="Экзамен">
        <option value="">Любой экзамен</option>
        <option>ОГЭ</option><option>ЕГЭ</option><option>ВПР</option>
      </select>
      {f.exam && (
        <input className="input" type="number" min={1} max={50} placeholder="№ задания" value={f.exam_task}
          onChange={(e) => setF({ ...f, exam_task: e.target.value })} style={{ maxWidth: 130 }} />
      )}
      {facets.tags.length > 0 && (
        <select className="select" value={f.tag} onChange={(e) => setF({ ...f, tag: e.target.value })} aria-label="Тег">
          <option value="">Все теги</option>
          {facets.tags.map((t) => <option key={t} value={t}>#{t}</option>)}
        </select>
      )}
    </div>
  );
}

const loadList = (f) => api.library({ kind: f.kind, subject: f.subject, exam: f.exam, exam_task: f.exam_task, tag: f.tag, q: f.q });

/* ============================================================
   Список
   ============================================================ */
export function LibraryPage({ kind = 'task' }) {
  const [f, setF] = useFilters(kind);
  const facets = useLoad(() => api.libraryFacets(), []);
  const list = useLoad(() => loadList({ ...f, kind }), [kind, f.subject, f.exam, f.exam_task, f.tag, f.q]);
  const [selected, setSelected] = useState(new Set());
  const [toLesson, setToLesson] = useState(false);

  const toggle = (id) => {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Библиотека</h1>
          <div className="lead">{kind === 'task' ? 'Задачник видите только вы. Ученик увидит задачу, когда вы выдадите её на уроке или в задании' : 'Теорию видят все ученики в разделе «Теория»'}</div>
        </div>
        <Link to={`/library/new?kind=${kind}`} className="btn"><Icon name="plus" /> {kind === 'task' ? 'Задача' : 'Теория'}</Link>
      </div>

      <div className="tabs" role="tablist">
        {Object.entries(KINDS).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={kind === k} className={kind === k ? 'active' : ''}
            onClick={() => { setSelected(new Set()); navigate(`/library/${k === 'task' ? 'tasks' : 'theory'}`); }}>{label}</button>
        ))}
      </div>

      {facets.data && <Filters f={f} setF={setF} facets={facets.data} />}

      {kind === 'task' && selected.size > 0 && (
        <div className="select-bar">
          <span>Выбрано: {selected.size}</span>
          <div className="row wrap" style={{ gap: 6 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setSelected(new Set())}>Сбросить</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setToLesson(true)}>На урок</button>
            <button className="btn btn-sm" onClick={() => navigate(`/homework/new?items=${[...selected].join(',')}`)}>Выдать как ДЗ</button>
          </div>
        </div>
      )}

      <section className="panel">
        {list.loading && <Spinner />}
        {list.error && <ErrorBox error={list.error} onRetry={list.reload} />}
        {list.data && !list.data.length && (
          <Empty title={f.q || f.exam || f.tag ? 'Ничего не нашлось' : kind === 'task' ? 'Задачник пуст' : 'Теории пока нет'}
            action={<Link to={`/library/new?kind=${kind}`} className="btn">Добавить</Link>}>
            {kind === 'task' && !f.q && 'Добавляйте задачи с пометками: номер задания ОГЭ/ЕГЭ, теги, заметка для себя.'}
          </Empty>
        )}
        {(list.data || []).map((i) => (
          <div key={i.id} className="assign-row" onClick={() => navigate(`/library/${i.id}`)}>
            {kind === 'task' && (
              <input type="checkbox" className="row-check" checked={selected.has(i.id)} aria-label="Выбрать"
                onClick={(e) => e.stopPropagation()} onChange={() => toggle(i.id)} />
            )}
            <div className="list-main">
              <div className="list-title truncate">{i.title}</div>
              <div className="list-sub truncate">
                {[examLabel(i), i.subject, ...(i.tags || []).map((t) => `#${t}`)].filter(Boolean).join(' · ')}
              </div>
              {i.tutor_note && <div className="list-sub truncate" style={{ color: '#7a5717' }}><Icon name="note" size={13} /> {i.tutor_note}</div>}
            </div>
            {i.files_count > 0 && <Badge>Файлов: {i.files_count}</Badge>}
          </div>
        ))}
      </section>

      {toLesson && (
        <AddToLessonModal itemIds={[...selected]} onClose={() => setToLesson(false)} onDone={() => { setToLesson(false); setSelected(new Set()); }} />
      )}
    </>
  );
}

/* ============================================================
   Добавить выбранные задачи к уроку
   ============================================================ */
function AddToLessonModal({ itemIds, onClose, onDone }) {
  const toast = useToast();
  const from = new Date(Date.now() - 3 * 3600e3).toISOString();
  const to = new Date(Date.now() + 14 * 864e5).toISOString();
  const lessons = useLoad(() => api.lessons({ from, to }), []);
  const upcoming = (lessons.data || []).filter((l) => l.status === 'scheduled');

  const add = async (l) => {
    try {
      const room = await api.lessonRoom(l.id);
      await api.setLessonItems(l.id, [...room.items.map((i) => i.id), ...itemIds]);
      toast(`Добавлено в урок: ${l.student_name}`);
      onDone();
      navigate(`/lesson/${l.id}`);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <Modal title="Добавить к уроку" onClose={onClose}>
      {lessons.loading && <Spinner />}
      {lessons.data && !upcoming.length && <Empty title="Ближайших уроков нет" />}
      <div className="list">
        {upcoming.map((l) => (
          <div key={l.id} className="list-item clickable" onClick={() => add(l)}>
            <div className="time-chip">{time(l.starts_at)}</div>
            <div className="list-main">
              <div className="list-title">{l.student_name}</div>
              <div className="list-sub">{relativeDay(l.starts_at)}, {dayMonth(l.starts_at)}</div>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

/* ============================================================
   Просмотр и редактирование материала
   ============================================================ */
export function LibraryEditor({ id, presetKind }) {
  const item = useLoad(() => (id ? api.libraryItem(id) : Promise.resolve(null)), [id]);
  const facets = useLoad(() => api.libraryFacets(), []);
  if (item.loading || facets.loading) return <Spinner />;
  if (item.error) return <ErrorBox error={item.error} onRetry={item.reload} />;
  return <EditorForm key={id || 'new'} item={item.data} presetKind={presetKind} facets={facets.data || { subjects: [], tags: [] }} reload={item.reload} />;
}

function EditorForm({ item, presetKind, facets, reload }) {
  const toast = useToast();
  const isNew = !item;
  const [f, setF] = useState({
    kind: item?.kind || presetKind || 'task',
    subject: item?.subject || facets.subjects[0] || 'Английский язык',
    title: item?.title || '',
    body: item?.body || '',
    answer: item?.answer || '',
    exam: item?.exam || '',
    exam_task: item?.exam_task ?? '',
    tags: (item?.tags || []).join(', '),
    tutor_note: item?.tutor_note || '',
    links: (item?.links || []).join('\n'),
  });
  const [pending, setPending] = useState([]);
  const [preview, setPreview] = useState(false);

  const body = () => ({
    kind: f.kind,
    subject: f.subject.trim() || 'Английский язык',
    title: f.title.trim(),
    body: orNull(f.body),
    answer: f.kind === 'task' ? orNull(f.answer) : null,
    exam: f.exam || null,
    exam_task: f.exam && f.exam_task !== '' ? Number(f.exam_task) : null,
    tags: f.tags.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean),
    tutor_note: orNull(f.tutor_note),
    links: f.links.split(/\s+/).map((s) => s.trim()).filter(Boolean),
  });

  const save = useSubmit(async () => {
    if (isNew) {
      const created = await api.createLibraryItem(body());
      for (const file of pending) await api.uploadFile({ library_item_id: created.id }, file);
      toast('Добавлено в библиотеку');
      navigate(`/library/${created.id}`);
    } else {
      await api.updateLibraryItem(item.id, body());
      toast('Сохранено');
      reload();
    }
  });

  const remove = async () => {
    if (!window.confirm(`Удалить «${item.title}»? Из уже выданных заданий задача тоже пропадёт.`)) return;
    await api.deleteLibraryItem(item.id);
    toast('Удалено');
    navigate(`/library/${item.kind === 'task' ? 'tasks' : 'theory'}`);
  };

  const back = `/library/${f.kind === 'task' ? 'tasks' : 'theory'}`;

  return (
    <>
      <Link to={back} className="btn btn-quiet btn-sm" style={{ marginLeft: -10, marginBottom: 10 }}><Icon name="back" /> Библиотека</Link>
      <div className="page-head">
        <h1 className="page-title">{isNew ? (f.kind === 'task' ? 'Новая задача' : 'Новая теория') : f.title || 'Материал'}</h1>
        {!isNew && (
          <div className="row" style={{ gap: 6 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setPreview(!preview)}>{preview ? 'Редактировать' : 'Как увидит ученик'}</button>
            {f.kind === 'task' && <Link to={`/homework/new?items=${item.id}`} className="btn btn-secondary btn-sm">Выдать как ДЗ</Link>}
          </div>
        )}
      </div>

      {preview && !isNew ? (
        <LibraryItem item={{ ...item, ...body(), files: item.files }} />
      ) : (
        <form className="assign-layout" onSubmit={save.submit}>
          <section className="panel form">
            {isNew && (
              <div className="row" style={{ gap: 6 }}>
                {Object.entries(KINDS).map(([k, label]) => (
                  <button type="button" key={k} className={`btn btn-sm ${f.kind === k ? '' : 'btn-secondary'}`} onClick={() => setF({ ...f, kind: k })}>{label}</button>
                ))}
              </div>
            )}
            <Field label="Название">
              <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required autoFocus={isNew}
                placeholder={f.kind === 'task' ? 'Словообразование: -ness, -ment' : 'Present Perfect vs Past Simple'} />
            </Field>
            <Field label={f.kind === 'task' ? 'Условие' : 'Текст'} hint={f.kind === 'task' ? 'Это увидит ученик' : 'Пустая строка — новый абзац'}>
              <textarea className="textarea" style={{ minHeight: 220 }} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
            </Field>
            {f.kind === 'task' && (
              <Field label="Ответ или решение" hint="Видите только вы">
                <textarea className="textarea" style={{ minHeight: 90 }} value={f.answer} onChange={(e) => setF({ ...f, answer: e.target.value })} />
              </Field>
            )}
            <Field label="Ссылки" hint="Видео, Wordwall и т. п. — каждая с новой строки">
              <textarea className="textarea" style={{ minHeight: 60 }} value={f.links} onChange={(e) => setF({ ...f, links: e.target.value })} />
            </Field>
            <Field label="Файлы" hint="PDF, картинки, аудио — до 10 МБ">
              {isNew ? (
                <>
                  {pending.length > 0 && <div className="small muted" style={{ marginBottom: 8 }}>{pending.map((p) => p.name).join(', ')} — загрузятся при сохранении</div>}
                  <FileUploadButton upload={async (file) => file} onUploaded={(file) => setPending((p) => [...p, file])} />
                </>
              ) : (
                <>
                  <FileList files={item.files} canDelete={() => true} onDeleted={reload} />
                  <div style={{ marginTop: item.files.length ? 10 : 0 }}>
                    <FileUploadButton upload={(file) => api.uploadFile({ library_item_id: item.id }, file)} onUploaded={reload} />
                  </div>
                </>
              )}
            </Field>
          </section>

          <aside className="panel work-card form">
            <Field label="Предмет">
              <input className="input" list="subjects" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />
              <datalist id="subjects">{facets.subjects.map((s) => <option key={s} value={s} />)}</datalist>
            </Field>
            <div className="form-row" style={{ gap: 10 }}>
              <Field label="Экзамен">
                <select className="select" value={f.exam} onChange={(e) => setF({ ...f, exam: e.target.value })}>
                  <option value="">Нет</option><option>ОГЭ</option><option>ЕГЭ</option><option>ВПР</option>
                </select>
              </Field>
              <Field label="№ задания">
                <input className="input" type="number" min={1} max={50} disabled={!f.exam} value={f.exam_task} onChange={(e) => setF({ ...f, exam_task: e.target.value })} />
              </Field>
            </div>
            <Field label="Теги" hint={`Через запятую${facets.tags.length ? `. Уже есть: ${facets.tags.slice(0, 8).join(', ')}` : ''}`}>
              <input className="input" value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} placeholder="словообразование, сложное" />
            </Field>
            <Field label="Заметка для себя" hint="Ученики не видят">
              <textarea className="textarea" style={{ minHeight: 80 }} value={f.tutor_note} onChange={(e) => setF({ ...f, tutor_note: e.target.value })}
                placeholder="Пригодится для 13 задания ОГЭ" />
            </Field>
            {save.error && <div className="alert">{save.error}</div>}
            <button className="btn" style={{ height: 46 }} disabled={save.busy}>{save.busy ? 'Сохраняем…' : isNew ? 'Добавить' : 'Сохранить'}</button>
            {!isNew && <button type="button" className="btn btn-danger" onClick={remove}>Удалить</button>}
          </aside>
        </form>
      )}
    </>
  );
}

/* ============================================================
   Выбор задач из задачника (для ДЗ и урока)
   ============================================================ */
export function TaskPicker({ selected, onClose, onPick }) {
  const [f, setF] = useFilters('task');
  const facets = useLoad(() => api.libraryFacets(), []);
  const list = useLoad(() => loadList(f), [f.subject, f.exam, f.exam_task, f.tag, f.q]);
  const [chosen, setChosen] = useState(new Set(selected));

  const toggle = (id) => {
    const n = new Set(chosen);
    n.has(id) ? n.delete(id) : n.add(id);
    setChosen(n);
  };

  return (
    <Modal title="Задачи из задачника" onClose={onClose} wide>
      {facets.data && <Filters f={f} setF={setF} facets={facets.data} />}
      <div style={{ maxHeight: '50vh', overflowY: 'auto', marginTop: 8 }}>
        {list.loading && <Spinner />}
        {list.data && !list.data.length && <Empty title="Ничего не нашлось" action={<Link to="/library/new?kind=task" className="btn btn-secondary btn-sm">Добавить задачу</Link>} />}
        {(list.data || []).map((i) => (
          <label key={i.id} className={`pick-row ${chosen.has(i.id) ? 'on' : ''}`}>
            <input type="checkbox" checked={chosen.has(i.id)} onChange={() => toggle(i.id)} />
            <span className="list-main">
              <span className="list-title" style={{ display: 'block' }}>{i.title}</span>
              <span className="list-sub" style={{ display: 'block' }}>
                {[examLabel(i), ...(i.tags || []).map((t) => `#${t}`)].filter(Boolean).join(' · ') || i.subject}
                {i.tutor_note ? ` — ${i.tutor_note}` : ''}
              </span>
            </span>
          </label>
        ))}
      </div>
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button>
        <button type="button" className="btn" onClick={() => onPick([...chosen])}>Готово{chosen.size ? ` (${chosen.size})` : ''}</button>
      </div>
    </Modal>
  );
}

// Список выбранных задач с возможностью убрать и поменять порядок
export function PickedTasks({ ids, onChange, onAdd, emptyText = 'Задачи не добавлены' }) {
  const items = useLoad(() => api.libraryBatch(ids), [ids.join(',')]);
  const move = (i, d) => {
    const n = [...ids];
    const j = i + d;
    if (j < 0 || j >= n.length) return;
    [n[i], n[j]] = [n[j], n[i]];
    onChange(n);
  };
  return (
    <div>
      {!ids.length && <div className="small muted">{emptyText}</div>}
      {(items.data || []).map((it, i) => (
        <div key={it.id} className="list-item" style={{ padding: '10px 2px' }}>
          <div className="list-main">
            <div className="list-title truncate">{i + 1}. {it.title}</div>
            <div className="list-sub truncate">{[examLabel(it), ...(it.tags || []).map((t) => `#${t}`)].filter(Boolean).join(' · ') || it.subject}</div>
          </div>
          <button type="button" className="icon-btn" aria-label="Выше" onClick={() => move(i, -1)} disabled={i === 0}><Icon name="arrowUp" size={16} /></button>
          <button type="button" className="icon-btn" aria-label="Ниже" onClick={() => move(i, 1)} disabled={i === ids.length - 1}><Icon name="arrowDown" size={16} /></button>
          <button type="button" className="icon-btn" aria-label="Убрать" onClick={() => onChange(ids.filter((x) => x !== it.id))}><Icon name="close" size={16} /></button>
        </div>
      ))}
      <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={onAdd}><Icon name="library" /> Из задачника</button>
    </div>
  );
}

export { ItemMeta };
