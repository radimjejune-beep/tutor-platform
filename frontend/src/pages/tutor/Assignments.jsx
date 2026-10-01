// pages/tutor/Assignments.jsx — задания в стиле Google Classroom:
// список → редактор → страница задания → проверка работы ученика
import { useState } from 'react';
import { api } from '../../api';
import { useLoad, Spinner, ErrorBox, Empty, Badge, Icon, Link, Field, navigate, useToast, useSubmit } from '../../ui';
import { FileList, FileUploadButton } from '../../components/Files';
import { QuizEditor, QuizForm, cleanQuestions } from '../../components/Quiz';
import { shortDate, fullDate, relativeDay, time, HW_STATUS, plural, todayISO } from '../../format';

const orNull = (v) => (v && String(v).trim() ? String(v).trim() : null);
const dueText = (d) => (d ? `Срок: ${shortDate(d)}` : 'Без срока');

/* ============================================================
   Список заданий
   ============================================================ */
export function AssignmentsList() {
  const list = useLoad(() => api.assignments(), []);
  if (list.loading) return <Spinner />;
  if (list.error) return <ErrorBox error={list.error} onRetry={list.reload} />;
  const toCheck = list.data.reduce((n, a) => n + a.submitted, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Задания</h1>
          <div className="lead">{toCheck ? `Ждут проверки: ${toCheck}` : 'Новых работ на проверку нет'}</div>
        </div>
        <Link to="/homework/new" className="btn"><Icon name="plus" /> Задание</Link>
      </div>

      <section className="panel">
        {!list.data.length && (
          <Empty title="Заданий пока нет" action={<Link to="/homework/new" className="btn">Создать первое задание</Link>}>
            Одно задание можно выдать сразу нескольким ученикам, приложить материалы и тест с автопроверкой.
          </Empty>
        )}
        {list.data.map((a) => (
          <div key={a.id} className="assign-row" onClick={() => navigate(`/homework/${a.id}`)}>
            <div className="assign-icon"><Icon name={a.question_count ? 'quiz' : 'book'} /></div>
            <div className="list-main">
              <div className="list-title truncate">{a.title}</div>
              <div className="list-sub truncate">
                {dueText(a.due_on)}. {a.students.join(', ')}
                {a.question_count ? `. Тест: ${a.question_count} ${plural(a.question_count, 'вопрос', 'вопроса', 'вопросов')}` : ''}
              </div>
            </div>
            {a.submitted > 0 && <Badge tone="brass">На проверку: {a.submitted}</Badge>}
            {a.overdue > 0 && <Badge tone="red">Просрочено: {a.overdue}</Badge>}
            <div className="counter"><b className="num">{a.submitted + a.checked}</b><span>сдали из {a.total}</span></div>
          </div>
        ))}
      </section>
    </>
  );
}

/* ============================================================
   Создание и редактирование задания
   ============================================================ */
export function AssignmentEditor({ id, presetStudentId }) {
  const isNew = !id;
  const data = useLoad(() => Promise.all([api.students(), id ? api.assignment(id) : Promise.resolve(null)]), [id]);
  if (data.loading) return <Spinner />;
  if (data.error) return <ErrorBox error={data.error} onRetry={data.reload} />;
  const [students, assignment] = data.data;
  return <EditorForm isNew={isNew} students={students} assignment={assignment} presetStudentId={presetStudentId} onFilesChanged={data.reload} />;
}

function EditorForm({ isNew, students, assignment, presetStudentId, onFilesChanged }) {
  const toast = useToast();
  const assignedIds = new Set((assignment?.submissions || []).map((s) => s.student_id));
  const [f, setF] = useState({
    title: assignment?.title || '',
    description: assignment?.description || '',
    links: (assignment?.links || []).join('\n'),
    due_on: assignment?.due_on || '',
    questions: assignment?.questions || [],
    students: new Set(presetStudentId ? [presetStudentId] : []),
  });
  const [pendingFiles, setPendingFiles] = useState([]); // для нового задания — загрузим после создания
  const [showQuiz, setShowQuiz] = useState(Boolean(assignment?.questions?.length));

  const toggle = (sid) => {
    const next = new Set(f.students);
    next.has(sid) ? next.delete(sid) : next.add(sid);
    setF({ ...f, students: next });
  };

  const { busy, error, submit } = useSubmit(async () => {
    const body = {
      title: f.title.trim(),
      description: orNull(f.description),
      links: f.links.split(/\s+/).map((s) => s.trim()).filter(Boolean),
      due_on: f.due_on || null,
      questions: showQuiz ? cleanQuestions(f.questions) : [],
    };
    if (isNew) {
      if (!f.students.size) throw new Error('Выберите хотя бы одного ученика');
      const created = await api.createAssignment({ ...body, student_ids: [...f.students] });
      for (const file of pendingFiles) await api.uploadFile({ assignment_id: created.id }, file);
      toast(`Задание выдано: ${f.students.size} ${plural(f.students.size, 'ученик', 'ученика', 'учеников')}`);
      navigate(`/homework/${created.id}`);
    } else {
      await api.updateAssignment(assignment.id, { ...body, add_student_ids: [...f.students] });
      toast('Задание сохранено');
      navigate(`/homework/${assignment.id}`);
    }
  });

  const active = students.filter((s) => !assignedIds.has(s.id));

  return (
    <>
      <Link to={isNew ? '/homework' : `/homework/${assignment.id}`} className="btn btn-quiet btn-sm" style={{ marginLeft: -10, marginBottom: 10 }}>
        <Icon name="back" /> {isNew ? 'Задания' : 'К заданию'}
      </Link>
      <div className="page-head"><h1 className="page-title">{isNew ? 'Новое задание' : 'Изменить задание'}</h1></div>

      <form onSubmit={submit} className="assign-layout">
        <div className="stack">
          <section className="panel form">
            <Field label="Название">
              <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required autoFocus={isNew}
                placeholder="Workbook, Unit 4: упражнения 1–4" />
            </Field>
            <Field label="Инструкция">
              <textarea className="textarea" style={{ minHeight: 140 }} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })}
                placeholder="Что сделать и как сдать: например, сфотографировать страницу тетради" />
            </Field>
            <Field label="Ссылки" hint="Холст, Wordwall, видео — каждая с новой строки">
              <textarea className="textarea" style={{ minHeight: 64 }} value={f.links} onChange={(e) => setF({ ...f, links: e.target.value })} />
            </Field>
            <Field label="Материалы" hint="PDF, фото страниц, аудио — до 10 МБ каждый">
              {isNew ? (
                <>
                  {pendingFiles.length > 0 && (
                    <div className="files" style={{ marginBottom: 10 }}>
                      {pendingFiles.map((file, i) => (
                        <div key={i} className="file">
                          <span className="file-main" style={{ cursor: 'default' }}>
                            <span className="file-thumb"><span className="file-kind">Файл</span></span>
                            <span className="file-text"><span className="file-name">{file.name}</span><span className="file-size">загрузится при сохранении</span></span>
                          </span>
                          <button type="button" className="icon-btn" aria-label="Убрать" onClick={() => setPendingFiles(pendingFiles.filter((_, k) => k !== i))}><Icon name="close" size={18} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  <FileUploadButton upload={async (file) => file} onUploaded={(file) => setPendingFiles((p) => [...p, file])} />
                </>
              ) : (
                <>
                  <FileList files={assignment.files} canDelete={() => true} onDeleted={onFilesChanged} />
                  <div style={{ marginTop: assignment.files.length ? 10 : 0 }}>
                    <FileUploadButton upload={(file) => api.uploadFile({ assignment_id: assignment.id }, file)} onUploaded={onFilesChanged} />
                  </div>
                </>
              )}
            </Field>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <h2 className="section-title">Тест с автопроверкой</h2>
                <div className="small muted">Оценка посчитается сама, ученик увидит разбор после вашей проверки</div>
              </div>
              {!showQuiz && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowQuiz(true)}><Icon name="plus" /> Добавить тест</button>}
            </div>
            {showQuiz && <QuizEditor questions={f.questions} onChange={(questions) => setF({ ...f, questions })} />}
            {assignment?.submissions?.some((s) => s.status !== 'assigned') && showQuiz && (
              <div className="note" style={{ marginTop: 14 }}>Работы уже сдают. Если поменяете ответы, оценки за тест пересчитаются.</div>
            )}
          </section>
        </div>

        <aside className="panel work-card form">
          <Field label="Срок сдачи">
            <input className="input" type="date" min={isNew ? todayISO() : undefined} value={f.due_on} onChange={(e) => setF({ ...f, due_on: e.target.value })} />
          </Field>
          <Field label={isNew ? 'Кому выдать' : 'Добавить учеников'}>
            {!active.length ? (
              <div className="small muted">{isNew ? 'Сначала добавьте учеников' : 'Задание уже выдано всем ученикам'}</div>
            ) : (
              <div className="student-pick" style={{ gridTemplateColumns: '1fr' }}>
                {active.map((s) => (
                  <label key={s.id} className={f.students.has(s.id) ? 'on' : ''}>
                    <input type="checkbox" checked={f.students.has(s.id)} onChange={() => toggle(s.id)} />
                    {s.full_name}
                  </label>
                ))}
              </div>
            )}
          </Field>
          {!isNew && assignedIds.size > 0 && (
            <div className="small muted">Уже выдано: {assignment.submissions.map((s) => s.student_name).join(', ')}</div>
          )}
          {error && <div className="alert">{error}</div>}
          <button className="btn" disabled={busy} style={{ height: 48 }}>
            {busy ? 'Сохраняем…' : isNew ? 'Выдать задание' : 'Сохранить'}
          </button>
        </aside>
      </form>
    </>
  );
}

/* ============================================================
   Страница задания: инструкция, материалы, тест с ключом, работы учеников
   ============================================================ */
export function AssignmentPage({ id }) {
  const toast = useToast();
  const a = useLoad(() => api.assignment(id), [id]);
  if (a.loading) return <Spinner />;
  if (a.error) return <ErrorBox error={a.error} onRetry={a.reload} />;
  const d = a.data;
  const done = d.submissions.filter((s) => s.status !== 'assigned').length;

  const remove = async () => {
    if (!window.confirm(`Удалить задание «${d.title}» вместе с работами учеников?`)) return;
    await api.deleteAssignment(d.id);
    toast('Задание удалено');
    navigate('/homework');
  };

  return (
    <>
      <Link to="/homework" className="btn btn-quiet btn-sm" style={{ marginLeft: -10, marginBottom: 10 }}><Icon name="back" /> Задания</Link>
      <div className="assign-layout">
        <div>
          <div className="assign-head">
            <div className="assign-icon"><Icon name={d.questions.length ? 'quiz' : 'book'} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 className="assign-title">{d.title}</h1>
              <div className="assign-meta">Выдано {fullDate(d.created_at)}. {dueText(d.due_on)}</div>
            </div>
            <div className="row" style={{ gap: 4 }}>
              <Link to={`/homework/${d.id}/edit`} className="btn btn-secondary btn-sm"><Icon name="edit" /> Изменить</Link>
              <button className="icon-btn" aria-label="Удалить задание" onClick={remove}><Icon name="trash" size={19} /></button>
            </div>
          </div>

          {d.description && <p className="instructions" style={{ marginTop: 0 }}>{d.description}</p>}
          {d.links.length > 0 && (
            <div className="row wrap" style={{ gap: 8, margin: '14px 0' }}>
              {d.links.map((url) => <a key={url} className="btn btn-secondary btn-sm" href={url} target="_blank" rel="noreferrer">{linkLabel(url)}</a>)}
            </div>
          )}
          {d.files.length > 0 && <div style={{ margin: '18px 0' }}><FileList files={d.files} /></div>}

          {d.questions.length > 0 && (
            <section style={{ marginTop: 24 }}>
              <h2 className="section-title" style={{ marginBottom: 12 }}>Тест и правильные ответы</h2>
              <QuizForm questions={d.questions} mode="key" />
            </section>
          )}
        </div>

        <aside className="panel work-card">
          <div className="panel-head">
            <h2 className="section-title">Работы учеников</h2>
            <span className="muted small">{done} из {d.submissions.length}</span>
          </div>
          <div className="list">
            {d.submissions.map((s) => (
              <div key={s.id} className="list-item clickable" onClick={() => navigate(`/homework/${d.id}/review/${s.id}`)}>
                <div className="list-main">
                  <div className="list-title truncate">{s.student_name}</div>
                  <div className="list-sub">
                    {s.status === 'assigned' ? (d.due_on && d.due_on < todayISO() ? 'Просрочено' : 'Ещё не сдал') : `Сдано ${relativeDay(s.submitted_at).toLowerCase()} в ${time(s.submitted_at)}`}
                    {s.files_count ? `, файлов: ${s.files_count}` : ''}
                  </div>
                </div>
                {s.status === 'checked' ? (
                  <Badge tone="green">{s.score !== null ? `${s.score}%` : 'Проверено'}</Badge>
                ) : s.status === 'submitted' ? (
                  <Badge tone="brass">{s.quiz_score !== null ? `Тест ${s.quiz_score}%` : 'Проверить'}</Badge>
                ) : null}
              </div>
            ))}
          </div>
          <Link to={`/homework/${d.id}/edit`} className="btn btn-quiet btn-sm" style={{ marginTop: 10 }}><Icon name="plus" /> Выдать ещё ученикам</Link>
        </aside>
      </div>
    </>
  );
}

export function linkLabel(url) {
  if (url.includes('holst')) return 'Доска в Холсте';
  if (url.includes('wordwall')) return 'Wordwall';
  if (url.includes('youtu')) return 'Видео';
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return 'Ссылка';
  }
}

/* ============================================================
   Проверка работы ученика
   ============================================================ */
export function ReviewPage({ assignmentId, homeworkId }) {
  const data = useLoad(() => Promise.all([api.homeworkItem(homeworkId), api.assignment(assignmentId)]), [homeworkId]);
  if (data.loading) return <Spinner />;
  if (data.error) return <ErrorBox error={data.error} onRetry={data.reload} />;
  return <ReviewForm key={homeworkId} hw={data.data[0]} assignment={data.data[1]} reload={data.reload} />;
}

function ReviewForm({ hw, assignment, reload }) {
  const toast = useToast();
  const [feedback, setFeedback] = useState(hw.tutor_feedback || '');
  const [score, setScore] = useState(hw.score ?? hw.quiz_score ?? '');

  // Следующая работа на проверку в этом задании
  const next = assignment.submissions.find((s) => s.status === 'submitted' && s.id !== hw.id);
  const goNext = () => navigate(next ? `/homework/${assignment.id}/review/${next.id}` : `/homework/${assignment.id}`);

  const check = useSubmit(async () => {
    await api.updateHomework(hw.id, { status: 'checked', tutor_feedback: orNull(feedback), score: score === '' ? null : Number(score) });
    toast(`Проверено: ${hw.student_name}`);
    goNext();
  });
  const sendBack = useSubmit(async () => {
    await api.updateHomework(hw.id, { status: 'assigned', tutor_feedback: orNull(feedback) });
    toast('Отправлено на доработку');
    goNext();
  });

  return (
    <>
      <Link to={`/homework/${assignment.id}`} className="btn btn-quiet btn-sm" style={{ marginLeft: -10, marginBottom: 10 }}><Icon name="back" /> {assignment.title}</Link>
      <div className="assign-layout">
        <div>
          <div className="assign-head">
            <div className="avatar" style={{ width: 48, height: 48, fontSize: 16 }}>
              {hw.student_name.split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <h1 className="assign-title">{hw.student_name}</h1>
              <div className="assign-meta">
                {hw.submitted_at && hw.status !== 'assigned' ? `Сдано ${relativeDay(hw.submitted_at).toLowerCase()} в ${time(hw.submitted_at)}` : 'Работа ещё не сдана'}
                {hw.due_on && hw.submitted_at && hw.submitted_at.slice(0, 10) > hw.due_on ? ', после срока' : ''}
              </div>
            </div>
            <Badge tone={HW_STATUS[hw.status].tone}>{HW_STATUS[hw.status].label}</Badge>
          </div>

          <h2 className="section-title" style={{ marginBottom: 8 }}>Ответ</h2>
          {hw.student_answer ? <p className="instructions" style={{ marginTop: 0 }}>{hw.student_answer}</p> : <p className="muted" style={{ marginTop: 0 }}>Без текста</p>}

          <h2 className="section-title" style={{ margin: '22px 0 10px' }}>Файлы ученика</h2>
          <FileList files={hw.attachments} empty={<p className="muted" style={{ margin: 0 }}>Файлов нет</p>} />

          {hw.questions.length > 0 && (
            <section style={{ marginTop: 26 }}>
              <div className="row-between" style={{ marginBottom: 12 }}>
                <h2 className="section-title">Тест</h2>
                {hw.quiz_points && <span className="muted small">{hw.quiz_points.earned} из {hw.quiz_points.total} баллов, {hw.quiz_score}%</span>}
              </div>
              {hw.quiz_answers ? (
                <QuizForm questions={hw.questions} answers={hw.quiz_answers} mode="view" results={hw.quiz_results} />
              ) : (
                <p className="muted">Тест не пройден</p>
              )}
            </section>
          )}
        </div>

        <aside className="panel work-card form">
          <h2 className="section-title">Оценка</h2>
          <Field label="Баллы, %" hint={hw.quiz_score !== null ? `Тест проверился сам: ${hw.quiz_score}%. Можно изменить` : 'Необязательно'}>
            <input className="input" type="number" min={0} max={100} value={score} onChange={(e) => setScore(e.target.value)} style={{ maxWidth: 140 }} />
          </Field>
          <Field label="Комментарий ученику">
            <textarea className="textarea" value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Что получилось, что поправить" />
          </Field>
          {(check.error || sendBack.error) && <div className="alert">{check.error || sendBack.error}</div>}
          <button type="button" className="btn" style={{ height: 46 }} disabled={check.busy} onClick={check.submit}>
            {hw.status === 'checked' ? 'Сохранить оценку' : 'Проверено'}
          </button>
          {hw.status !== 'assigned' && (
            <button type="button" className="btn btn-secondary" disabled={sendBack.busy} onClick={sendBack.submit}>Вернуть на доработку</button>
          )}
          {next && <div className="small muted">Следующая работа: {next.student_name}</div>}
        </aside>
      </div>
    </>
  );
}
