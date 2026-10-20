// pages/tutor/Assignments.jsx — задания в стиле Google Classroom:
// список → редактор → страница задания → проверка работы ученика
import { useState } from 'react';
import Materials, { UploadArea, Comments } from '../../components/Materials';
import { SheetContext } from '../../games/Sheet';
import { api } from '../../api';
import { useLoad, Spinner, ErrorBox, Empty, Badge, Icon, Link, Field, navigate, useToast, useSubmit } from '../../ui';
import { FileList, FileUploadButton } from '../../components/Files';
import { QuizEditor, QuizForm, cleanQuestions } from '../../components/Quiz';
import LibraryItem from '../../components/LibraryItem';
import { TaskPicker, PickedTasks } from './Library';
import { ResultLine, byItem, GameResultsPanel, averageBest } from '../../components/GameResults';
import { shortDate, fullDate, relativeDay, time, HW_STATUS, plural, todayISO } from '../../format';
import WordPaste from '../../components/WordPaste';

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
                {a.task_count ? `. Задач: ${a.task_count}` : ''}
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
export function AssignmentEditor({ id, presetStudentId, presetStudents, presetItems }) {
  const isNew = !id;
  const data = useLoad(() => Promise.all([api.students(), id ? api.assignment(id) : Promise.resolve(null)]), [id]);
  if (data.loading) return <Spinner />;
  if (data.error) return <ErrorBox error={data.error} onRetry={data.reload} />;
  const [students, assignment] = data.data;
  return <EditorForm isNew={isNew} students={students} assignment={assignment} presetStudentId={presetStudentId} presetStudents={presetStudents} presetItems={presetItems} onFilesChanged={data.reload} />;
}

function EditorForm({ isNew, students, assignment, presetStudentId, presetStudents, presetItems, onFilesChanged }) {
  const toast = useToast();
  const assignedIds = new Set((assignment?.submissions || []).map((s) => s.student_id));
  const [f, setF] = useState({
    title: assignment?.title || '',
    description: assignment?.description || '',
    links: (assignment?.links || []).join('\n'),
    due_on: assignment?.due_on || '',
    questions: assignment?.questions || [],
    students: new Set(presetStudents?.length ? presetStudents : presetStudentId ? [presetStudentId] : []),
    vocab: assignment ? Boolean(assignment.vocab_practice) : false,
    vocabCount: assignment?.vocab_practice?.count || 12,
    items: assignment?.library_item_ids || presetItems || [],
    setId: assignment?.word_set_id || null,
  });
  const [newWords, setNewWords] = useState([]); // слова к уроку: новый набор из вставленного списка
  const [pendingFiles, setPendingFiles] = useState([]); // для нового задания — загрузим после создания
  const [showQuiz, setShowQuiz] = useState(Boolean(assignment?.questions?.length));
  const [picking, setPicking] = useState(false);

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
      library_item_ids: f.items,
      vocab_practice: f.vocab ? { count: Number(f.vocabCount) } : null,
    };
    // Слова к уроку: вставленный список становится набором карточек этого задания
    if (newWords.length) {
      const who = isNew ? [...f.students] : [...new Set([...(assignment.submissions || []).map((s) => s.student_id), ...f.students])];
      if (f.setId) {
        const cur = await api.wordSet(f.setId);
        const have = new Set(cur.words.map((w) => w.term.toLowerCase()));
        await api.updateWordSet(f.setId, { words: [...cur.words, ...newWords.filter((w) => !have.has(w.term.toLowerCase()))].slice(0, 500) });
      } else {
        const created = await api.createWordSet({ title: `Слова: ${f.title.trim()}`.slice(0, 200), words: newWords.slice(0, 500), for_all: false, student_ids: who.length ? who : undefined });
        body.word_set_id = created.id;
      }
    }
    if (!body.word_set_id) body.word_set_id = f.setId || null;
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
            <Field label="Ссылки" hint="Каждая с новой строки. YouTube откроется прямо в задании">
              <textarea className="textarea" style={{ minHeight: 64 }} value={f.links} onChange={(e) => setF({ ...f, links: e.target.value })} />
            </Field>
            <Field label="Материалы" hint="Аудирование, фото страниц, PDF, видео">
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
                  <UploadArea upload={async (file) => file} onUploaded={(file) => setPendingFiles((p) => [...p, file])} />
                </>
              ) : (
                <>
                  <Materials files={assignment.files} canDelete={() => true} onDeleted={onFilesChanged} />
                  <div style={{ marginTop: assignment.files.length ? 10 : 0 }}>
                    <UploadArea upload={(file) => api.uploadFile({ assignment_id: assignment.id }, file)} onUploaded={onFilesChanged} />
                  </div>
                </>
              )}
            </Field>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <h2 className="section-title">Задачи из задачника</h2>
                <div className="small muted">Ученик увидит условия; ответы и ваши заметки — нет</div>
              </div>
            </div>
            <PickedTasks ids={f.items} onChange={(items) => setF({ ...f, items })} onAdd={() => setPicking(true)} />
            {picking && (
              <TaskPicker selected={f.items} onClose={() => setPicking(false)}
                onPick={(items) => { setPicking(false); setF({ ...f, items }); }} />
            )}
          </section>

          <HomeworkWords setId={f.setId} onSetId={(setId) => setF({ ...f, setId })} words={newWords} onWords={setNewWords} />

          <section className="panel">
            <div className="panel-head">
              <div>
                <h2 className="section-title">Отработка слов</h2>
                <div className="small muted">Упражнения на слова из словаря ученика: сначала забытые и ошибки, потом слова текущего юнита</div>
              </div>
            </div>
            <label className="check">
              <input type="checkbox" checked={f.vocab} onChange={(e) => setF({ ...f, vocab: e.target.checked })} />
              <span>Добавить отработку слов</span>
            </label>
            {f.vocab && (
              <div className="row" style={{ marginTop: 10, paddingLeft: 28 }}>
                <span className="small muted">Сколько слов</span>
                <select className="select" style={{ width: 110, height: 38 }} value={f.vocabCount} onChange={(e) => setF({ ...f, vocabCount: e.target.value })}>
                  {[8, 12, 16, 20, 30].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            )}
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
          {(d.files.length > 0 || d.links.length > 0) && <div style={{ margin: '18px 0' }}><Materials files={d.files} links={d.links} /></div>}

          {d.library_item_ids?.length > 0 && <AssignmentTasks ids={d.library_item_ids} showPrivate />}

          {d.word_set && (
            <section style={{ marginTop: 24 }}>
              <h2 className="section-title" style={{ marginBottom: 10 }}>Слова к уроку</h2>
              <Link to={`/wordsets/${d.word_set.id}`} className="list-item clickable" style={{ color: 'inherit', textDecoration: 'none', border: '1px solid var(--line)', borderRadius: 10, padding: '12px 14px' }}>
                <div className="avatar" style={{ background: 'var(--surface-2)' }}><Icon name="cards" size={20} /></div>
                <div className="list-main"><div className="list-title">{d.word_set.title}</div><div className="list-sub">{d.word_set.word_count} {plural(d.word_set.word_count, 'карточка', 'карточки', 'карточек')}. Ученик учит их прямо в задании</div></div>
              </Link>
            </section>
          )}

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
                    {d.word_set ? `. Слова: ${s.set_learned} из ${d.word_set.word_count}${s.set_sessions ? '' : ', не учил'}` : ''}
                  </div>
                </div>
                {s.status === 'checked' ? (
                  <Badge tone="green">{s.score !== null ? `${s.score}%` : 'Проверено'}</Badge>
                ) : s.status === 'submitted' ? (
                  <Badge tone="brass">{s.quiz_score !== null ? `Тест ${s.quiz_score}%` : s.vocab_result ? `Слова ${s.vocab_result.correct}/${s.vocab_result.total}` : 'Проверить'}</Badge>
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
  const data = useLoad(async () => {
    const [hw, assignment, results] = await Promise.all([
      api.homeworkItem(homeworkId),
      api.assignment(assignmentId),
      api.gameResults({ homework_id: homeworkId }).catch(() => []),
    ]);
    const items = await api.libraryBatch(hw.library_item_ids || []);
    return [hw, assignment, items, results];
  }, [homeworkId]);
  if (data.loading) return <Spinner />;
  if (data.error) return <ErrorBox error={data.error} onRetry={data.reload} />;
  const [hw, assignment, items, results] = data.data;
  return <ReviewForm key={homeworkId} hw={hw} assignment={assignment} items={items} results={results} reload={data.reload} />;
}

function ReviewForm({ hw, assignment, items, results, reload }) {
  const toast = useToast();
  const [feedback, setFeedback] = useState(hw.tutor_feedback || '');
  const gamesAvg = averageBest(items, results);
  // Подсказка оценки: тест и упражнения вместе
  const vocabPct = hw.vocab_result?.total ? Math.round((hw.vocab_result.correct / hw.vocab_result.total) * 100) : null;
  const auto = [hw.quiz_score, gamesAvg, vocabPct].filter((x) => x !== null && x !== undefined);
  const suggested = auto.length ? Math.round(auto.reduce((a, b) => a + b, 0) / auto.length) : null;
  const [score, setScore] = useState(hw.score ?? suggested ?? '');

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
          {hw.attachments.length ? <Materials files={hw.attachments} /> : <p className="muted" style={{ margin: 0 }}>Файлов нет</p>}

          <GameResultsPanel items={items} results={results} />

          {hw.vocab_practice && (
            <section style={{ marginTop: 26 }}>
              <div className="row-between">
                <h2 className="section-title">Отработка слов</h2>
                <span className="muted small">
                  {hw.vocab_result ? `${hw.vocab_result.correct} из ${hw.vocab_result.total}, ${vocabPct}%` : 'Не пройдена'}
                </span>
              </div>
              {hw.vocab_result && hw.vocab_result.correct < hw.vocab_result.total && (
                <p className="small muted" style={{ margin: '6px 0 0' }}>Слова с ошибками уже вернулись в повторение. Их видно во вкладке «Словарь» ученика.</p>
              )}
            </section>
          )}

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
          <Field label="Баллы, %" hint={suggested !== null
            ? `Посчитано автоматически${hw.quiz_score !== null ? `: тест ${hw.quiz_score}%` : ''}${gamesAvg !== null ? `${hw.quiz_score !== null ? ',' : ':'} упражнения ${gamesAvg}%` : ''}${vocabPct !== null ? `, слова ${vocabPct}%` : ''}. Можно изменить`
            : 'Необязательно'}>
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
          <Comments homeworkId={hw.id} />
        </aside>
      </div>
    </>
  );
}

// Задачи и упражнения из библиотеки внутри задания
// homework { id, student_id, status } — ученик проходит упражнения, результат сохраняется в эту работу
export function AssignmentTasks({ ids, showPrivate, homework, canPlay }) {
  const data = useLoad(
    () => Promise.all([api.libraryBatch(ids), homework ? api.gameResults({ homework_id: homework.id }).catch(() => []) : Promise.resolve([])]),
    [ids.join(','), homework?.id]
  );
  if (!data.data?.[0]?.length) return null;
  const [items, results] = data.data;
  const map = byItem(results);
  const hasGames = items.some((i) => i.kind === 'game');
  const save = (itemId) => async (answers, _r, duration_sec) => {
    await api.saveGameResult(itemId, { student_id: homework.student_id, homework_id: homework.id, answers, duration_sec });
    data.reload();
  };
  return (
    <section style={{ marginTop: 22 }}>
      <h2 className="section-title" style={{ marginBottom: 12 }}>{hasGames ? 'Задачи и упражнения' : 'Задачи'}</h2>
      <SheetContext.Provider value={{ homeworkId: canPlay && homework ? homework.id : null }}>
        <div className="stack" style={{ gap: 12 }}>
          {items.map((it, i) => (
            <LibraryItem key={it.id} item={it} index={i} showPrivate={showPrivate}
              onGameFinish={canPlay && homework ? save(it.id) : undefined}
              gameExtra={homework ? <ResultLine results={map[it.id]} who={canPlay ? 'Ваш' : 'Лучший'} /> : null} />
          ))}
        </div>
      </SheetContext.Provider>
    </section>
  );
}

/* ============================================================
   Слова к уроку: набор карточек внутри задания
   ============================================================ */
function HomeworkWords({ setId, onSetId, words, onWords }) {
  const sets = useLoad(() => api.wordSets(), []);
  const [mode, setMode] = useState(setId ? 'set' : 'none');
  const current = sets.data?.find((x) => x.id === setId);
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2 className="section-title">Слова к уроку</h2>
          <div className="small muted">Карточки прямо в задании: ученик учит их как в Quizlet, вы видите, сколько выучено</div>
        </div>
      </div>
      <div className="seg" style={{ marginBottom: 12 }}>
        <button type="button" className={mode === 'none' ? 'on' : ''} onClick={() => { setMode('none'); onSetId(null); onWords([]); }}>Без слов</button>
        <button type="button" className={mode === 'new' ? 'on' : ''} onClick={() => { setMode('new'); onSetId(null); }}>Вставить список</button>
        <button type="button" className={mode === 'set' ? 'on' : ''} onClick={() => setMode('set')}>Готовый набор</button>
      </div>
      {mode === 'new' && (
        <>
          <WordPaste onWords={(w) => onWords(w)} rows={6} placeholder={'Слова к уроку: слово и перевод через Tab, тире или запятую\n\nhurry up - поторопиться\nbring - приносить\nalways - всегда'} />
          <div className="small muted" style={{ marginTop: 8 }}>{words.length ? `Создастся набор «Слова: название задания» из ${words.length} карточек. Его можно поправить потом в разделе «Карточки».` : 'Набор создастся при сохранении задания.'}</div>
        </>
      )}
      {mode === 'set' && (
        sets.loading ? <Spinner /> : (
          <>
            <select className="select" value={setId || ''} onChange={(e) => onSetId(Number(e.target.value) || null)}>
              <option value="">Выберите набор</option>
              {(sets.data || []).map((x) => <option key={x.id} value={x.id}>{x.title} ({x.word_count})</option>)}
            </select>
            {!sets.data?.length && <div className="small muted" style={{ marginTop: 8 }}>Наборов пока нет. Выберите «Вставить список» или создайте набор в разделе «Карточки».</div>}
            {current && (
              <div className="row wrap" style={{ gap: 8, marginTop: 10 }}>
                <span className="small muted">{current.word_count} {plural(current.word_count, 'карточка', 'карточки', 'карточек')}</span>
                <Link to={`/wordsets/${current.id}`} className="btn btn-quiet btn-sm">Открыть набор</Link>
              </div>
            )}
            {setId && (
              <details style={{ marginTop: 12 }}>
                <summary className="small" style={{ cursor: 'pointer' }}>Добавить в этот набор ещё слова</summary>
                <div style={{ marginTop: 10 }}><WordPaste onWords={(w) => onWords(w)} rows={4} /></div>
              </details>
            )}
          </>
        )
      )}
    </section>
  );
}
