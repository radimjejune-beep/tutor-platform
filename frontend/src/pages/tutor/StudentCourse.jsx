// pages/tutor/StudentCourse.jsx — вкладки ученика «Курс» и «Словарь»
import { useState } from 'react';
import { api } from '../../api';
import { useLoad, Spinner, ErrorBox, Empty, Icon, Link, useToast, Field, Modal } from '../../ui';
import { unitLabel } from '../../components/FinishLesson';
import { FlashSession, VocabList, VocabStats, AddWordsModal } from '../../components/Vocab';
import { plural, dayMonth, time } from '../../format';
import { useSubject } from '../../subjects';

export function CourseTab({ student, onChange }) {
  const subj = useSubject(student.subject);
  const toast = useToast();
  const data = useLoad(() => Promise.all([api.studentCourse(student.id), api.courses()]), [student.id]);
  const [busy, setBusy] = useState(false);

  if (data.loading) return <Spinner />;
  if (data.error) return <ErrorBox error={data.error} onRetry={data.reload} />;
  const [sc, courses] = data.data;

  const run = (fn, msg) => async () => {
    setBusy(true);
    try {
      const r = await fn();
      const extra = r?.vocab_added ? `, ${subj.toVocab} добавлено ${r.vocab_added} ${plural(r.vocab_added, ...subj.item)}` : '';
      toast(`${msg}${extra}`);
      data.reload();
      onChange?.();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!courses.length) {
    return (
      <div className="panel">
        <Empty title="Курсов пока нет" action={<Link to="/courses" className="btn">Создать курс</Link>}>
          Курс — это учебник по юнитам: материалы к уроку, ДЗ и слова каждого юнита. Можно загрузить готовый файл импорта.
        </Empty>
      </div>
    );
  }

  return (
    <div className="grid grid-main">
      <section className="panel">
        <div className="panel-head">
          <h2 className="section-title">Курс</h2>
          {sc.course && <Link to={`/courses/${sc.course.id}`} className="small muted">Открыть курс</Link>}
        </div>
        <Field label="Учебник">
          <select className="select" value={sc.course?.id || ''} disabled={busy}
            onChange={(e) => {
              const id = Number(e.target.value) || null;
              run(() => api.setStudentCourse(student.id, { course_id: id }), id ? 'Ученик записан на курс' : 'Курс снят')();
            }}>
            <option value="">Без курса</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </Field>

        {sc.course && (
          <>
            <div className="unit-list" role="list">
              {sc.units.map((u) => {
                const current = sc.unit?.id === u.id;
                const passed = sc.unit && sc.units.findIndex((x) => x.id === sc.unit.id) > sc.units.findIndex((x) => x.id === u.id);
                return (
                  <button key={u.id} role="listitem" className={`unit-row ${current ? 'current' : ''} ${passed ? 'passed' : ''}`} disabled={busy || current}
                    onClick={run(() => api.setStudentCourse(student.id, { course_id: sc.course.id, unit_id: u.id }), `Текущий юнит: ${unitLabel(u)}`)}>
                    <span className="unit-code">{u.code || '·'}</span>
                    <span className="unit-title">{u.title}</span>
                    <span className="small muted hide-sm">{[u.item_count && `${u.item_count} упр.`, u.vocab_count && `${u.vocab_count} сл.`].filter(Boolean).join(' · ')}</span>
                    {current && <span className="meta-label">сейчас</span>}
                  </button>
                );
              })}
            </div>
            {sc.unit && (
              <div className="row wrap" style={{ gap: 8, marginTop: 16 }}>
                <button className="btn btn-secondary btn-sm" disabled={busy} onClick={run(() => api.unitHomework(sc.unit.id, { student_id: student.id }), 'ДЗ по юниту выдано')}>
                  Выдать ДЗ по {sc.unit.code || 'юниту'}
                </button>
                <button className="btn btn-sm" disabled={busy} onClick={run(() => api.nextUnit(student.id), 'Следующий юнит')}>
                  Следующий юнит <Icon name="arrowDown" />
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <section className="panel">
        <h2 className="section-title" style={{ marginBottom: 12 }}>Как это работает</h2>
        <ol className="steps" style={{ marginTop: 0 }}>
          <li>Когда ученик переходит на юнит, {subj.items} юнита сами попадают {subj.toVocab.replace('мои', 'его')}.</li>
          <li>В комнате урока кнопка «Материалы юнита» добавляет упражнения в урок.</li>
          <li>«Завершить урок» отмечает занятие, выдаёт ДЗ по юниту и может перевести на следующий.</li>
          <li>Ошибки в упражнениях попадают {subj.toVocab.replace('мои', 'его')}, ученик повторяет их по карточкам.</li>
        </ol>
      </section>
    </div>
  );
}

export function WordsTab({ student }) {
  const subj = useSubject(student.subject);
  const vocab = useLoad(() => api.vocab(student.id), [student.id]);
  const [adding, setAdding] = useState(false);
  const [giving, setGiving] = useState(false);
  const [session, setSession] = useState(false);

  if (vocab.loading) return <Spinner />;
  if (vocab.error) return <ErrorBox error={vocab.error} onRetry={vocab.reload} />;
  const { items, stats } = vocab.data;

  return (
    <>
      <section className="panel words-hero">
        <VocabStats stats={stats} />
        <div className="row wrap" style={{ gap: 8 }}>
          {stats.due > 0 && !session && <button className="btn btn-secondary" onClick={() => setSession(true)}><Icon name="play" /> Повторить на уроке</button>}
          <button className="btn btn-secondary" onClick={() => setGiving(true)}><Icon name="cards" /> Наборы карточек</button>
          <button className="btn" onClick={() => setAdding(true)}><Icon name="plus" /> {subj.isLang ? 'Слова' : 'Термины'}</button>
        </div>
      </section>
      {session && (
        <section className="panel">
          <FlashSession studentId={student.id} subject={student.subject} onDone={() => { setSession(false); vocab.reload(); }} />
        </section>
      )}
      <section className="panel">
        {items.length ? (
          <VocabList items={items} tutor onChanged={vocab.reload} />
        ) : (
          <Empty title={`${subj.vocabTitle}: пока пусто`}>Добавьте вручную, запишите ученика на курс или выдайте упражнение: ошибки попадут сюда сами.</Empty>
        )}
      </section>
      <PracticeActivity studentId={student.id} />
      {adding && <AddWordsModal studentId={student.id} subject={student.subject} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); vocab.reload(); }} />}
      {giving && <GiveSetsModal student={student} onClose={() => setGiving(false)} onSaved={() => { setGiving(false); vocab.reload(); }} />}
    </>
  );
}

// Выдать ученику наборы карточек: перетащить (или нажать) из «Ваши наборы» в «Выданы ученику».
// Слова выданных наборов сразу попадают в словарь ученика.
function GiveSetsModal({ student, onClose, onSaved }) {
  const toast = useToast();
  const sets = useLoad(() => api.wordSets(), []);
  const [given, setGiven] = useState(null); // Set id наборов, выданных этому ученику
  const [drag, setDrag] = useState(null);
  const [busy, setBusy] = useState(false);
  if (sets.loading) return <Modal title="Наборы карточек" onClose={onClose}><Spinner /></Modal>;
  if (sets.error) return <Modal title="Наборы карточек" onClose={onClose}><ErrorBox error={sets.error} onRetry={sets.reload} /></Modal>;
  const list = sets.data;
  const start = new Set(list.filter((x) => !x.for_all && (x.student_ids || []).includes(student.id)).map((x) => x.id));
  const cur = given || start;
  const put = (id, on) => { const n = new Set(cur); if (on) n.add(id); else n.delete(id); setGiven(n); };
  const forAll = list.filter((x) => x.for_all);
  const mine = list.filter((x) => !x.for_all && cur.has(x.id));
  const rest = list.filter((x) => !x.for_all && !cur.has(x.id));

  const save = async () => {
    setBusy(true);
    try {
      let added = 0;
      for (const x of list.filter((y) => !y.for_all)) {
        const was = start.has(x.id); const now = cur.has(x.id);
        if (was === now) continue;
        const ids = (x.student_ids || []).filter((i) => i !== student.id);
        const r = await api.updateWordSet(x.id, { student_ids: now ? [...ids, student.id] : ids });
        added += r.synced?.added || 0;
      }
      toast(added ? `В словарь ученика добавлено слов: ${added}` : 'Сохранено');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const card = (x, on) => (
    <button key={x.id} type="button" draggable className="set-chip" onDragStart={() => setDrag(x.id)} onDragEnd={() => setDrag(null)} onClick={() => put(x.id, !on)}>
      <b>{x.title}</b><small>{x.word_count} {plural(x.word_count, 'карточка', 'карточки', 'карточек')}</small>
    </button>
  );
  const zone = (on, label, items, empty) => (
    <div className={`set-zone ${drag ? 'drop' : ''}`} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (drag) put(drag, on); setDrag(null); }}>
      <div className="meta-label">{label}</div>
      {items.length ? items.map((x) => card(x, on)) : <p className="small muted" style={{ margin: 0 }}>{empty}</p>}
    </div>
  );
  return (
    <Modal title={`Наборы карточек: ${student.full_name}`} onClose={onClose} wide>
      <p className="small muted" style={{ marginTop: 0 }}>Перетащите набор в правую колонку или просто нажмите на него. Слова выданных наборов сразу появятся в словаре ученика и попадут в повторение.</p>
      {!list.length ? (
        <Empty title="Наборов пока нет" action={<Link to="/wordsets" className="btn btn-secondary btn-sm">Создать набор</Link>}>Наборы можно собрать в разделе «Карточки» или из слов юнита в банке заданий.</Empty>
      ) : (
        <div className="set-zones">
          {zone(false, 'Ваши наборы', rest, 'Все наборы уже выданы')}
          {zone(true, 'Выданы ученику', mine, 'Перетащите сюда набор')}
        </div>
      )}
      {forAll.length > 0 && <p className="small muted">Наборы для всех учеников видны ему и так: {forAll.map((x) => `«${x.title}»`).join(', ')}.</p>}
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button>
        <button type="button" className="btn" disabled={busy || !given} onClick={save}>{busy ? 'Сохраняем…' : 'Сохранить'}</button>
      </div>
    </Modal>
  );
}

// Самостоятельные занятия ученика: наборы карточек, словарь, разминки
const MODE_LABEL = { cards: 'карточки', learn: 'заучивание', write: 'письмо', match: 'подбор', test: 'тест', vocab: 'тренировка' };
export function PracticeActivity({ studentId }) {
  const act = useLoad(() => api.practiceActivity(studentId), [studentId]);
  if (!act.data) return null;
  const { items, week } = act.data;
  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="section-title">Занимался сам</h2>
        <span className="small muted">за 7 дней: {week.sessions} {plural(week.sessions, 'тренировка', 'тренировки', 'тренировок')}, {week.days} {plural(week.days, 'день', 'дня', 'дней')}</span>
      </div>
      {!items.length && <p className="small muted" style={{ margin: 0 }}>Пока ни одной самостоятельной тренировки. Создайте набор в разделе «Карточки», и ученик увидит его в своём словаре.</p>}
      <div className="list">
        {items.slice(0, 12).map((x) => (
          <div key={x.id} className="list-item">
            <div className="list-main">
              <div className="list-title truncate">{x.title}</div>
              <div className="list-sub">{MODE_LABEL[x.mode] || x.mode} · {dayMonth(x.created_at)}, {time(x.created_at)}{x.duration_sec ? ` · ${Math.max(1, Math.round(x.duration_sec / 60))} мин` : ''}</div>
            </div>
            <span className={`small ${x.total && x.correct / x.total >= 0.8 ? '' : 'muted'}`}>{x.correct} из {x.total}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
