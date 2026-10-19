// pages/tutor/WordSets.jsx — наборы карточек: список, редактор со вставкой как в Quizlet, кто учит
import { useMemo, useState } from 'react';
import { api } from '../../api';
import { useLoad, Spinner, ErrorBox, Empty, Badge, Icon, Link, navigate, useToast, Field, Modal } from '../../ui';
import WordPaste from '../../components/WordPaste';
import Study, { wordsCount } from '../../components/Study';
import { shortDate } from '../../format';
import { useSubject } from '../../subjects';

export function WordSetsList() {
  const sets = useLoad(() => Promise.all([api.wordSets(), api.students()]), []);
  const subj = useSubject();
  if (sets.loading) return <Spinner />;
  if (sets.error) return <ErrorBox error={sets.error} onRetry={sets.reload} />;
  const [list, students] = sets.data;
  const names = new Map(students.map((s) => [s.id, s.full_name]));
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Наборы карточек</h1>
          <div className="lead">{subj.isLang ? 'Слова' : 'Термины'}, которые ученики учат сами, когда нет уроков: карточки, заучивание, письмо, подбор и тест. Вставьте список из Word, Excel или Quizlet.</div>
        </div>
        <Link to="/wordsets/new" className="btn"><Icon name="plus" /> Новый набор</Link>
      </div>
      <section className="panel">
        {!list.length && (
          <Empty title="Наборов пока нет" action={<Link to="/wordsets/new" className="btn">Создать первый набор</Link>}>
            Например, слова юнита, неправильные глаголы или фразы для экзамена.
          </Empty>
        )}
        <div className="list">
          {list.map((s) => (
            <Link key={s.id} to={`/wordsets/${s.id}`} className="list-item clickable" style={{ color: 'inherit', textDecoration: 'none' }}>
              <div className="avatar" style={{ background: 'var(--surface-2)' }}><Icon name="cards" size={20} /></div>
              <div className="list-main">
                <div className="list-title truncate">{s.title}</div>
                <div className="list-sub">
                  {wordsCount(s.word_count)} · {s.for_all ? 'всем ученикам' : s.student_ids.length ? s.student_ids.map((id) => names.get(id)?.split(' ')[0]).filter(Boolean).join(', ') : 'никому не выдан'}
                  {s.last_practice ? ` · учили ${shortDate(s.last_practice)}` : ''}
                </div>
              </div>
              {s.learners > 0 && <Badge tone="green">учат: {s.learners}</Badge>}
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

const emptyRow = () => ({ term: '', translation: '', example: '' });

export function WordSetEditor({ id }) {
  const isNew = !id;
  const data = useLoad(() => Promise.all([isNew ? Promise.resolve(null) : api.wordSet(id), api.students()]), [id]);
  if (data.loading) return <Spinner />;
  if (data.error) return <ErrorBox error={data.error} onRetry={data.reload} />;
  return <Editor key={id || 'new'} set={data.data[0]} students={data.data[1].filter((s) => s.status !== 'archived')} onSaved={data.reload} />;
}

function Editor({ set, students, onSaved }) {
  const toast = useToast();
  const subj = useSubject();
  const [title, setTitle] = useState(set?.title || '');
  const [description, setDescription] = useState(set?.description || '');
  const [rows, setRows] = useState(set?.words?.length ? set.words.map((w) => ({ term: w.term, translation: w.translation || '', example: w.example || '' })) : [emptyRow(), emptyRow(), emptyRow()]);
  const [forAll, setForAll] = useState(set ? set.for_all : true);
  const [picked, setPicked] = useState(new Set(set?.student_ids || []));
  const [pasted, setPasted] = useState({ words: [], clear: null });
  const [showPaste, setShowPaste] = useState(!set);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  const [showExamples, setShowExamples] = useState(rows.some((r) => r.example));

  const filled = rows.filter((r) => r.term.trim());
  const dupes = useMemo(() => {
    const seen = new Map();
    filled.forEach((r) => { const k = r.term.trim().toLowerCase(); seen.set(k, (seen.get(k) || 0) + 1); });
    return new Set([...seen].filter(([, n]) => n > 1).map(([k]) => k));
  }, [filled]);

  const addPasted = () => {
    const keep = rows.filter((r) => r.term.trim() || r.translation.trim());
    const have = new Set(keep.map((r) => r.term.trim().toLowerCase()));
    const add = pasted.words.filter((w) => { const k = w.term.toLowerCase(); if (have.has(k)) return false; have.add(k); return true; }).map((w) => ({ term: w.term, translation: w.translation || '', example: w.example || '' }));
    setRows([...keep, ...add]);
    if (add.some((r) => r.example)) setShowExamples(true);
    pasted.clear?.();
    setShowPaste(false);
    toast(`Добавлено карточек: ${add.length}${pasted.words.length > add.length ? `, повторы пропущены: ${pasted.words.length - add.length}` : ''}`);
  };
  const setRow = (i, patch) => setRows(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  const save = async () => {
    setError('');
    if (!title.trim()) return setError('Напишите название набора');
    if (!filled.length) return setError('Добавьте хотя бы одно слово');
    if (!forAll && !picked.size) return setError('Выберите учеников или откройте набор всем');
    setBusy(true);
    try {
      const body = {
        title: title.trim(),
        description: description.trim() || null,
        words: filled.map((r) => ({ term: r.term.trim(), translation: r.translation.trim() || null, example: r.example.trim() || null })),
        for_all: forAll,
        student_ids: forAll ? [] : [...picked],
      };
      if (set) {
        await api.updateWordSet(set.id, body);
        toast('Сохранено');
        onSaved();
      } else {
        const r = await api.createWordSet(body);
        toast('Набор создан. Ученики уже видят его в разделе «Словарь»');
        navigate(`/wordsets/${r.id}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!window.confirm(`Удалить набор «${set.title}»? Прогресс учеников по нему тоже удалится.`)) return;
    try {
      await api.deleteWordSet(set.id);
      navigate('/wordsets');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <>
      <Link to="/wordsets" className="btn btn-quiet btn-sm" style={{ marginLeft: -10, marginBottom: 10 }}><Icon name="back" /> Наборы</Link>
      <div className="page-head">
        <div>
          <h1 className="page-title">{set ? set.title : 'Новый набор'}</h1>
          <div className="lead">{filled.length ? wordsCount(filled.length) : 'Пока пусто'}{set ? ` · изменён ${shortDate(set.updated_at)}` : ''}</div>
        </div>
        <div className="row wrap">
          {filled.filter((r) => r.translation.trim()).length >= 2 && <button className="btn btn-secondary" onClick={() => setPreview(true)}><Icon name="play" /> Попробовать</button>}
          {set && <button className="btn btn-secondary" onClick={remove}><Icon name="trash" /> Удалить</button>}
        </div>
      </div>

      <section className="panel">
        <div className="form">
          <Field label="Название"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={subj.isLang ? 'Solutions 1G: внешность' : 'Формулы сокращённого умножения'} maxLength={200} /></Field>
          <Field label="Описание" hint="Необязательно. Ученик увидит его над набором"><input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Выучить к следующему уроку" maxLength={2000} /></Field>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2 className="section-title">Импорт списком</h2>
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => setShowPaste(!showPaste)}>{showPaste ? 'Свернуть' : 'Вставить список'}</button>
        </div>
        {showPaste ? (
          <>
            <p className="small muted" style={{ marginTop: 0 }}>Скопируйте две колонки из таблицы (или экспорт из Quizlet) и вставьте сюда. Третья колонка станет примером.</p>
            <WordPaste onWords={(words, clear) => setPasted({ words, clear })} />
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
              <button type="button" className="btn" disabled={!pasted.words.length} onClick={addPasted}>Добавить в набор{pasted.words.length ? ` (${pasted.words.length})` : ''}</button>
            </div>
          </>
        ) : <p className="small muted" style={{ margin: 0 }}>Можно вставить сразу много слов: слово и перевод через Tab, тире или запятую.</p>}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2 className="section-title">Карточки</h2>
          <label className="check small"><input type="checkbox" checked={showExamples} onChange={(e) => setShowExamples(e.target.checked)} /> Примеры</label>
        </div>
        <div className="ws-rows">
          {rows.map((r, i) => (
            <div key={i} className={`ws-row ${dupes.has(r.term.trim().toLowerCase()) ? 'dupe' : ''}`}>
              <span className="ws-n">{i + 1}</span>
              <div className="ws-fields">
                <input className="input" value={r.term} onChange={(e) => setRow(i, { term: e.target.value })} placeholder={subj.isLang ? 'Слово' : 'Термин'} aria-label={`Слово ${i + 1}`} maxLength={200} />
                <input className="input" value={r.translation} onChange={(e) => setRow(i, { translation: e.target.value })} placeholder={subj.Meaning} aria-label={`${subj.Meaning} ${i + 1}`} maxLength={300}
                  onKeyDown={(e) => { if (e.key === 'Tab' && !e.shiftKey && i === rows.length - 1 && !showExamples) setRows([...rows, emptyRow()]); }} />
                {showExamples && <input className="input ws-ex" value={r.example} onChange={(e) => setRow(i, { example: e.target.value })} placeholder="Пример (необязательно)" aria-label={`Пример ${i + 1}`} maxLength={1000} />}
              </div>
              <button type="button" className="icon-btn" aria-label="Удалить строку" onClick={() => setRows(rows.length > 1 ? rows.filter((_, k) => k !== i) : [emptyRow()])}><Icon name="close" size={16} /></button>
            </div>
          ))}
        </div>
        {dupes.size > 0 && <div className="small" style={{ color: 'var(--danger)', marginTop: 8 }}>Есть повторы. При сохранении останется одна карточка.</div>}
        <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={() => setRows([...rows, emptyRow()])}><Icon name="plus" /> Карточка</button>
      </section>

      <section className="panel">
        <h2 className="section-title">Кто видит набор</h2>
        <div className="seg" style={{ margin: '12px 0' }}>
          <button type="button" className={forAll ? 'on' : ''} onClick={() => setForAll(true)}>Все мои ученики</button>
          <button type="button" className={!forAll ? 'on' : ''} onClick={() => setForAll(false)}>Выбранные</button>
        </div>
        {!forAll && (
          <div className="ws-students">
            {students.map((s) => (
              <label key={s.id} className="check">
                <input type="checkbox" checked={picked.has(s.id)} onChange={(e) => { const n = new Set(picked); if (e.target.checked) n.add(s.id); else n.delete(s.id); setPicked(n); }} />
                {s.full_name}
              </label>
            ))}
            {!students.length && <span className="muted small">Учеников пока нет.</span>}
          </div>
        )}
        <p className="small muted" style={{ marginBottom: 0 }}>Ученик найдёт набор в разделе «{subj.vocabTitle}» и сможет учить его сам в любое время. Слова с ошибками попадут в его личный словарь на повторение.</p>
      </section>

      {error && <div className="alert" style={{ marginBottom: 16 }}>{error}</div>}
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
        <Link to="/wordsets" className="btn btn-secondary">Отмена</Link>
        <button className="btn" onClick={save} disabled={busy}>{busy ? 'Сохраняем…' : set ? 'Сохранить' : 'Создать набор'}</button>
      </div>

      {set?.learners?.length > 0 && (
        <section className="panel" style={{ marginTop: 24 }}>
          <h2 className="section-title">Кто учит</h2>
          <table className="ws-table" style={{ marginTop: 10 }}>
            <thead><tr><th>Ученик</th><th>Выучено</th><th>Занятий</th><th>Последний раз</th></tr></thead>
            <tbody>
              {set.learners.map((l) => (
                <tr key={l.id} className="clickable" onClick={() => navigate(`/students/${l.id}/words`)}>
                  <td>{l.full_name}</td>
                  <td>{l.learned} из {set.words.length}</td>
                  <td>{l.sessions}</td>
                  <td className="muted">{l.last_practice ? shortDate(l.last_practice) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {preview && (
        <Modal title="Так набор видит ученик" onClose={() => setPreview(false)} wide>
          <Study words={filled.map((r) => ({ key: r.term.trim().toLowerCase(), term: r.term.trim(), translation: r.translation.trim(), example: r.example.trim() || null, level: 0 }))} />
        </Modal>
      )}
    </>
  );
}
