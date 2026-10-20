// pages/client/HomeworkPage.jsx — задание глазами ученика (как в Google Classroom)
import { useState } from 'react';
import { api } from '../../api';
import { useLoad, Spinner, ErrorBox, Badge, Icon, Link, Field, useToast, useSubmit } from '../../ui';
import Materials, { UploadArea, Comments } from '../../components/Materials';
import { QuizForm } from '../../components/Quiz';
import VocabPractice from '../../components/VocabPractice';
import { AssignmentTasks } from '../tutor/Assignments';
import { shortDate, relativeDay, time, HW_STATUS, todayISO } from '../../format';
import { useSubject } from '../../subjects';
import Study from '../../components/Study';
import { SetProgress } from './SetStudy';

export default function HomeworkPage({ id, isParent }) {
  const hw = useLoad(() => api.homeworkItem(id), [id]);
  if (hw.loading) return <Spinner />;
  if (hw.error) return <ErrorBox error={hw.error} onRetry={hw.reload} />;
  return <HomeworkView key={hw.data.status} h={hw.data} isParent={isParent} reload={hw.reload} />;
}

function HomeworkView({ h, isParent, reload }) {
  const toast = useToast();
  const [answer, setAnswer] = useState(h.student_answer || '');
  const [quiz, setQuiz] = useState(h.quiz_answers || {});
  const canEdit = !isParent && h.status === 'assigned';
  const overdue = h.status === 'assigned' && h.due_on && h.due_on < todayISO();
  const unanswered = h.questions.filter((q) => quiz[q.id] === undefined || quiz[q.id] === '').length;

  const submit = useSubmit(async () => {
    if (unanswered && !window.confirm(`Без ответа осталось вопросов: ${unanswered}. Всё равно сдать?`)) return;
    await api.submitHomework(h.id, {
      student_answer: answer.trim() || undefined,
      quiz_answers: h.questions.length ? quiz : undefined,
    });
    toast('Работа сдана');
    reload();
  });
  const unsubmit = useSubmit(async () => {
    await api.unsubmitHomework(h.id);
    toast('Отправка отменена, можно поправить');
    reload();
  });

  const statusBadge = overdue ? <Badge tone="red">Просрочено</Badge> : <Badge tone={HW_STATUS[h.status].tone}>{HW_STATUS[h.status].label}</Badge>;

  return (
    <>
      <Link to="/homework" className="btn btn-quiet btn-sm" style={{ marginLeft: -10, marginBottom: 10 }}><Icon name="back" /> Задания</Link>
      <div className="assign-layout">
        <div>
          <div className="assign-head">
            <div className="assign-icon"><Icon name={h.questions.length ? 'quiz' : 'book'} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 className="assign-title">{h.title}</h1>
              <div className="assign-meta">{h.due_on ? `Сдать до ${shortDate(h.due_on)}` : 'Без срока'}</div>
            </div>
          </div>

          {h.description && <p className="instructions" style={{ marginTop: 0 }}>{h.description}</p>}
          {(h.materials.length > 0 || h.links.length > 0) && (
            <div style={{ margin: '18px 0' }}>
              <Materials files={h.materials} links={h.links} />
            </div>
          )}

          {h.library_item_ids?.length > 0 && (
            <AssignmentTasks ids={h.library_item_ids} homework={h} canPlay={h.status !== 'checked'} />
          )}

          {h.word_set_id && <HomeworkCards h={h} isParent={isParent} />}

          {h.vocab_practice && <PracticeBlock h={h} canEdit={canEdit} isParent={isParent} reload={reload} />}

          {h.questions.length > 0 && (
            <section style={{ marginTop: 24 }}>
              <div className="row-between" style={{ marginBottom: 12 }}>
                <h2 className="section-title">Тест</h2>
                {h.status === 'checked' && h.quiz_points && (
                  <span className="muted small">{h.quiz_points.earned} из {h.quiz_points.total} баллов</span>
                )}
              </div>
              {isParent && !h.quiz_answers ? (
                <p className="muted">Тест ещё не пройден</p>
              ) : (
                <QuizForm
                  questions={h.questions}
                  answers={quiz}
                  onChange={setQuiz}
                  mode={canEdit ? 'answer' : 'view'}
                  results={h.status === 'checked' ? h.quiz_results : undefined}
                />
              )}
              {h.status === 'submitted' && <p className="small muted" style={{ marginTop: 10 }}>Результат появится после проверки преподавателем.</p>}
            </section>
          )}
        </div>

        <aside className="panel work-card">
          <div className="work-status">
            <h2 className="section-title">{isParent ? 'Работа ученика' : 'Ваша работа'}</h2>
            {statusBadge}
          </div>

          {h.status === 'checked' && (
            <div style={{ marginBottom: 18 }}>
              {h.score !== null && <div className="score-big num">{h.score}%</div>}
              {h.tutor_feedback && (
                <div className="panel" style={{ background: 'var(--green-soft)', border: 0, boxShadow: 'none', padding: 14, marginTop: 12 }}>
                  <div className="small" style={{ fontWeight: 600, color: 'var(--green-ink)', marginBottom: 4 }}>Комментарий преподавателя</div>
                  <div style={{ whiteSpace: 'pre-line' }}>{h.tutor_feedback}</div>
                </div>
              )}
            </div>
          )}
          {h.status === 'assigned' && h.tutor_feedback && (
            <div className="note" style={{ marginBottom: 14 }}>Преподаватель вернул на доработку: {h.tutor_feedback}</div>
          )}

          {h.attachments.length > 0 ? (
            <Materials files={h.attachments} canDelete={(f) => canEdit && f.uploaded_by !== null} onDeleted={reload} />
          ) : !canEdit && <p className="muted small" style={{ marginTop: 0 }}>Файлов нет</p>}

          {canEdit ? (
            <div className="form" style={{ marginTop: 12 }}>
              <UploadArea upload={(file) => api.uploadFile({ homework_id: h.id }, file)} onUploaded={reload} hint="Фото тетради, запись голоса, файлы" />
              <Field label="Ответ или комментарий">
                <textarea className="textarea" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Можно написать ответы здесь или прикрепить фото тетради" />
              </Field>
              {submit.error && <div className="alert">{submit.error}</div>}
              <button className="btn" style={{ height: 48 }} disabled={submit.busy} onClick={submit.submit}>
                {submit.busy ? 'Отправляем…' : 'Сдать'}
              </button>
            </div>
          ) : (
            <>
              {h.student_answer && <p className="instructions" style={{ marginBottom: 0 }}>{h.student_answer}</p>}
              {h.status === 'submitted' && (
                <div style={{ marginTop: 14 }}>
                  <div className="small muted">Сдано {relativeDay(h.submitted_at).toLowerCase()} в {time(h.submitted_at)}</div>
                  {!isParent && (
                    <button className="btn btn-secondary" style={{ marginTop: 12, width: '100%' }} disabled={unsubmit.busy} onClick={unsubmit.submit}>
                      Отменить отправку
                    </button>
                  )}
                </div>
              )}
            </>
          )}
          <Comments homeworkId={h.id} />
        </aside>
      </div>
    </>
  );
}

// Отработка слов внутри задания
function PracticeBlock({ h, canEdit, isParent, reload }) {
  const [run, setRun] = useState(false);
  const r = h.vocab_result;
  const subj = useSubject();
  return (
    <section style={{ marginTop: 24 }}>
      <div className="row-between" style={{ marginBottom: 12 }}>
        <h2 className="section-title">{subj.isLang ? 'Отработка слов' : 'Отработка терминов'}</h2>
        {r && <span className="muted small">{r.correct} из {r.total}</span>}
      </div>
      {run ? (
        <div className="panel"><VocabPractice studentId={h.student_id} homeworkId={h.id} count={h.vocab_practice.count} onDone={() => { setRun(false); reload(); }} /></div>
      ) : (
        <div className="panel words-hero">
          <div style={{ minWidth: 0 }}>
            <div className="serif" style={{ fontSize: 26, fontWeight: 500 }}>{h.vocab_practice.count} {subj.isLang ? 'слов из вашего словаря' : 'терминов из вашего списка'}</div>
            <div className="small muted">{subj.isLang ? 'Выбрать перевод, написать слово, вставить в предложение, узнать на слух.' : 'Выбрать определение, написать термин, вставить в предложение.'}</div>
          </div>
          {canEdit && !isParent && (
            <button className="btn" onClick={() => setRun(true)}><Icon name="play" /> {r ? 'Пройти ещё раз' : 'Начать'}</button>
          )}
          {isParent && !r && <span className="small muted">Ещё не пройдено</span>}
        </div>
      )}
    </section>
  );
}

// Слова к уроку: набор карточек задания, учим прямо здесь
function HomeworkCards({ h, isParent }) {
  const [open, setOpen] = useState(false);
  const set = useLoad(() => (open ? api.wordSet(h.word_set_id, h.student_id) : Promise.resolve(null)), [open, h.word_set_id]);
  const [progress, setProgress] = useState(null);
  const [levels, setLevels] = useState(null);
  const learned = progress ? progress.learned : h.word_set_learned;
  const total = progress ? progress.total : h.word_set_count;
  const onFinish = async (mode, results, sec) => {
    const r = await api.saveSetProgress(h.word_set_id, { student_id: h.student_id, mode, duration_sec: sec, results: results.map((x) => ({ term: x.term, ok: x.ok })) });
    if (!r.saved) return null;
    setProgress(r.progress);
    setLevels(new Map(r.words.map((w) => [w.term, w.level])));
    return `Сохранено. Выучено ${r.progress.learned} из ${r.progress.total}. Преподаватель это увидит.`;
  };
  const words = set.data ? set.data.words.map((w) => ({ key: w.term.toLowerCase(), term: w.term, translation: w.translation, example: w.example, level: levels ? levels.get(w.term) ?? 0 : w.level })) : [];
  return (
    <section style={{ marginTop: 24 }}>
      <div className="row-between" style={{ marginBottom: 12 }}>
        <h2 className="section-title">Слова к уроку</h2>
        <span className="muted small">выучено {learned} из {total}</span>
      </div>
      <div className="panel">
        {!open ? (
          <div className="words-hero">
            <div style={{ minWidth: 0 }}>
              <div className="serif" style={{ fontSize: 26, fontWeight: 500 }}>{h.word_set_title}</div>
              <div className="small muted">Карточки, заучивание, письмо, подбор и тест. Учи, пока все слова не станут выученными.</div>
              <div className="bar" style={{ marginTop: 10, maxWidth: 360 }}><span style={{ width: `${total ? (learned / total) * 100 : 0}%` }} /></div>
            </div>
            {!isParent ? <button className="btn" onClick={() => setOpen(true)}><Icon name="play" /> {learned ? 'Продолжить' : 'Учить слова'}</button>
              : <Link to={`/words/set/${h.word_set_id}`} className="btn btn-secondary">Посмотреть слова</Link>}
          </div>
        ) : set.loading ? <Spinner /> : set.error ? <ErrorBox error={set.error} onRetry={set.reload} /> : (
          <>
            {progress && <div style={{ marginBottom: 16 }}><SetProgress p={progress} /></div>}
            <Study words={words} subject={h.subject} onFinish={onFinish} />
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}><button className="btn btn-quiet btn-sm" onClick={() => setOpen(false)}>Свернуть</button></div>
          </>
        )}
      </div>
    </section>
  );
}
