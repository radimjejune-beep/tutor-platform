// pages/tutor/StudentCourse.jsx — вкладки ученика «Курс» и «Словарь»
import { useState } from 'react';
import { api } from '../../api';
import { useLoad, Spinner, ErrorBox, Empty, Icon, Link, useToast, Field } from '../../ui';
import { unitLabel } from '../../components/FinishLesson';
import { FlashSession, VocabList, VocabStats, AddWordsModal } from '../../components/Vocab';
import { plural } from '../../format';
import { useSubject } from '../../subjects';

export function CourseTab({ student, onChange }) {
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
      const extra = r?.vocab_added ? `, в словарь добавлено ${r.vocab_added} ${plural(r.vocab_added, 'слово', 'слова', 'слов')}` : '';
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
          <li>Когда ученик переходит на юнит, слова юнита сами попадают в его словарь.</li>
          <li>В комнате урока кнопка «Материалы юнита» добавляет упражнения в урок.</li>
          <li>«Завершить урок» отмечает занятие, выдаёт ДЗ по юниту и может перевести на следующий.</li>
          <li>Ошибки в упражнениях попадают в словарь, ученик повторяет их по карточкам.</li>
        </ol>
      </section>
    </div>
  );
}

export function WordsTab({ student }) {
  const subj = useSubject(student.subject);
  const vocab = useLoad(() => api.vocab(student.id), [student.id]);
  const [adding, setAdding] = useState(false);
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
      {adding && <AddWordsModal studentId={student.id} subject={student.subject} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); vocab.reload(); }} />}
    </>
  );
}
