// pages/client/HomeworkPage.jsx — задание глазами ученика (как в Google Classroom)
import { useState } from 'react';
import { api } from '../../api';
import { useLoad, Spinner, ErrorBox, Badge, Icon, Link, Field, useToast, useSubmit } from '../../ui';
import { FileList, FileUploadButton } from '../../components/Files';
import { QuizForm } from '../../components/Quiz';
import { linkLabel } from '../tutor/Assignments';
import { shortDate, relativeDay, time, HW_STATUS, todayISO } from '../../format';

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
          {h.links.length > 0 && (
            <div className="row wrap" style={{ gap: 8, margin: '14px 0' }}>
              {h.links.map((url) => <a key={url} className="btn btn-secondary btn-sm" href={url} target="_blank" rel="noreferrer">{linkLabel(url)}</a>)}
            </div>
          )}
          {h.materials.length > 0 && (
            <div style={{ margin: '18px 0' }}>
              <div className="small muted" style={{ marginBottom: 8 }}>Материалы</div>
              <FileList files={h.materials} />
            </div>
          )}

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

          <FileList
            files={h.attachments}
            canDelete={(f) => canEdit && f.uploaded_by !== null}
            onDeleted={reload}
            empty={!canEdit && <p className="muted small" style={{ marginTop: 0 }}>Файлов нет</p>}
          />

          {canEdit ? (
            <div className="form" style={{ marginTop: 12 }}>
              <FileUploadButton
                label="Добавить файл или фото"
                className="btn btn-secondary"
                upload={(file) => api.uploadFile({ homework_id: h.id }, file)}
                onUploaded={reload}
              />
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
        </aside>
      </div>
    </>
  );
}
