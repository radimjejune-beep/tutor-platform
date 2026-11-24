import {StartWritingReview,WritingInbox} from '../learning/WritingReview';
import {HomeworkRecap,LessonRecap} from '../../components/LessonRecap';
import SubjectInput from '../../components/SubjectInput';
import {useAuth} from '../../auth';
import {readWorkspace,saveWorkspace,finishWorkspaceScroll} from '../../workspace-state';
import {assignmentForStudent,assignmentView,sortAssignments} from '../../assignment-workspace';
import { BackLink } from '../../Shell';
import { SectionPicker, LearningTabs } from '../../components/StudySections';
// pages/tutor/Assignments.jsx — задания:
// список → редактор → страница задания → проверка работы ученика
import { MethodTip } from '../Method';
import FormulaBar from '../../components/FormulaBar';
import { MathText } from '../../components/MathText';
import { useSubject } from '../../subjects';
import { useEffect,useRef,useState } from 'react';
import Materials, { UploadArea, Comments } from '../../components/Materials';
import { SheetContext } from '../../games/Sheet';
import { api } from '../../api';
import { useLoad, Spinner, ErrorBox, Empty, Badge, Icon, Link, Field, Modal, navigate, useToast, useSubmit, readDraft, clearDraft, useDraftSave, DraftNotice } from '../../ui';
import { FileList, FileUploadButton } from '../../components/Files';
import { QuizEditor, QuizForm, cleanQuestions } from '../../components/Quiz';
import LibraryItem from '../../components/LibraryItem';
import { TaskPicker, PickedTasks } from './Library';
import { ResultLine, byItem, GameResultsPanel, averageBest } from '../../components/GameResults';
import { shortDate, fullDate, relativeDay, time, HW_STATUS, plural, todayISO } from '../../format';
import WordPaste from '../../components/WordPaste';

const orNull = (v) => (v && String(v).trim() ? String(v).trim() : null);
const dueText = (d) => (d ? `Срок: ${shortDate(d)}` : 'Без срока');

function EditorOption({title,count,defaultOpen=false,children}){
 return <details className="editor-option" open={defaultOpen}><summary><span>{title}</span>{count>0&&<span className="badge">{count}</span>}</summary><div className="editor-option-body">{children}</div></details>;
}

/* ============================================================
   Список заданий
   ============================================================ */
const homeworkSections=a=>a.homework_sections||[{id:a.section_id,title:a.section_title}];
const matchesHomeworkSection=(a,section)=>section==='all'||homeworkSections(a).some(s=>String(s.id||0)===section);
const assignmentSearch=a=>[a.title,...homeworkSections(a).map(s=>s.title),...a.students].filter(Boolean).join(' ').toLowerCase();

export function AssignmentsList() {
 const {user}=useAuth(),toast=useToast(),initial=readWorkspace('assignments',{view:'active',student:'all',section:'all',search:'',page:1});
 const lastFilters=useRef(null);
 const list=useLoad(()=>api.assignments(),[]),[view,setView]=useState(()=>new URLSearchParams(location.hash.split('?')[1]||'').get('status')==='submitted'?'review':initial.view),[student,setStudent]=useState(initial.student),[section,setSection]=useState(initial.section),[search,setSearch]=useState(initial.search),[page,setPage]=useState(initial.page),[selected,setSelected]=useState(new Set()),[archiving,setArchiving]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{saveWorkspace('assignments',{view,student,section,search,page});},[view,student,section,search,page]);
 useEffect(()=>{const key=JSON.stringify([view,student,section,search]);if(lastFilters.current!==null&&lastFilters.current!==key){setSelected(new Set());setPage(1);}lastFilters.current=key;},[view,student,section,search]);
 useEffect(()=>{if(!list.loading&&list.data)finishWorkspaceScroll();},[list.loading,list.data]);
 if(list.loading)return <Spinner/>;if(list.error)return <ErrorBox error={list.error} onRetry={list.reload}/>;
 const all=list.data,scoped=all.map(a=>assignmentForStudent(a,student)).filter(Boolean),counts=Object.fromEntries(['active','review','history','archive','all'].map(v=>[v,scoped.filter(a=>assignmentView(a,v)).length]));
 const pupils=[...new Map(all.flatMap(a=>a.recipients||[]).filter(r=>r.student_id).map(r=>[String(r.student_id),r.student_name])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'ru'));
 const rows=scoped.filter(a=>assignmentView(a,view)&&matchesHomeworkSection(a,section)&&assignmentSearch(a).includes(search.trim().toLowerCase())).sort(sortAssignments),pages=Math.max(1,Math.ceil(rows.length/25)),currentPage=Math.min(page,pages),visible=rows.slice((currentPage-1)*25,currentPage*25),toCheck=all.filter(a=>!a.archived_at).reduce((n,a)=>n+a.submitted,0);
 const toggle=id=>setSelected(old=>{const next=new Set(old);next.has(id)?next.delete(id):next.add(id);return next;});
 const archive=async archived=>{setBusy(true);setError('');try{await api.archiveAssignments([...selected],archived);setSelected(new Set());setArchiving(false);await list.reload();toast(archived?'Убрано в архив преподавателя. Работы учеников сохранены.':'Задания возвращены в рабочие списки');}catch(e){setError(e.message);}finally{setBusy(false);}};
 const reset=()=>{setSearch('');setStudent('all');setSection('all');setView('active');};
 return <><header className="page-head"><div><h1 className="page-title">Задания</h1><p className="lead">{toCheck?`Работ на проверку: ${toCheck}`:'Новых работ на проверку нет'}. Текущая работа отдельно от истории.</p></div><Link className="btn" to="/homework/new"><Icon name="plus"/>Выдать задание</Link></header><LearningTabs active="homework"/>
 <div className="assignment-views" role="group" aria-label="Рабочие списки заданий">{[['active','В работе'],['review','На проверку'],['history','Завершённые'],['archive','Архив']].map(([v,label])=><button key={v} className={`btn ${view===v?'':'btn-secondary'}`} aria-pressed={view===v} onClick={()=>setView(v)}>{label}<span className="badge">{counts[v]}</span></button>)}<button className="btn btn-quiet" aria-pressed={view==='all'} onClick={()=>setView('all')}>Все выдачи · {counts.all}</button></div>
 <section className="panel assignment-filters"><label className="field">Поиск по заданию, ученику или теме<input className="input" type="search" aria-label="Поиск заданий преподавателя" placeholder="Например, Present Simple или имя ученика" value={search} onChange={e=>setSearch(e.target.value)}/></label><label className="field">Ученик<select className="select" aria-label="Ученик в списке заданий" value={student} onChange={e=>setStudent(e.target.value)}><option value="all">Все ученики</option>{pupils.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><label className="field">Раздел<select className="select" aria-label="Фильтр по разделу ученика" value={section} onChange={e=>setSection(e.target.value)}><option value="all">Все разделы</option><option value="0">Без раздела</option>{[...new Map(scoped.flatMap(homeworkSections).filter(s=>s.id).map(s=>[s.id,s.title])).entries()].map(([id,title])=><option key={id} value={id}>{title}</option>)}</select></label><button className="btn btn-quiet" onClick={reset}>Сбросить фильтры</button></section>
 {view==='archive'&&<p className="small muted">Архив очищает только рабочий список преподавателя. Задания, ответы и доступ ученика сохраняются.</p>}
 <div className="assignment-workspace"><aside className="panel assignment-students"><h2 className="section-title">По ученикам</h2><button className={`assignment-person ${student==='all'?'active':''}`} onClick={()=>setStudent('all')}>Все ученики</button>{pupils.map(([id,name])=>{const n=all.map(a=>assignmentForStudent(a,id)).filter(a=>a&&assignmentView(a,'active')).length;return <button className={`assignment-person ${student===id?'active':''}`} key={id} onClick={()=>setStudent(id)}><span>{name}</span><span className="badge">{n}</span></button>;})}</aside>
 <section className="panel assignment-results" aria-label="Выданные задания"><div className="row-between wrap assignment-list-head"><p className="small muted" role="status">{({active:'В работе',review:'На проверку',history:'Завершённые',archive:'Архив',all:'Все выдачи'})[view]} · {rows.length} {plural(rows.length,'выдача','выдачи','выдач')}</p>{visible.length>0&&<label className="check"><input type="checkbox" aria-label="Выбрать задания на странице" checked={visible.every(a=>selected.has(a.id))} onChange={e=>{const checked=e.target.checked;setSelected(old=>{const next=new Set(old);for(const a of visible)checked?next.add(a.id):next.delete(a.id);return next;});}}/>Выбрать на странице</label>}</div>
 {selected.size>0&&<div className="select-bar"><span>Выбрано: {selected.size}</span><div className="row wrap"><button className="btn btn-secondary btn-sm" disabled={busy} onClick={()=>setSelected(new Set())}>Снять выбор</button>{view==='archive'?<button className="btn btn-sm" disabled={busy} onClick={()=>archive(false)}>Вернуть из архива</button>:<button className="btn btn-secondary btn-sm" onClick={()=>setArchiving(true)}>Убрать в архив</button>}</div></div>}
 {error&&<ErrorBox error={error}/>} {!rows.length&&<Empty title={all.length?'В этом списке пока нет заданий':'Заданий пока нет'} action={all.length?<button className="btn btn-secondary" onClick={reset}>Показать текущие</button>:<Link className="btn" to="/homework/new">Выдать первое задание</Link>}>{view==='active'?'Завершённые работы находятся в истории. Старые выдачи можно убрать в архив без удаления.':'Измените ученика, тему или рабочий список.'}</Empty>}
 {visible.map(a=><article key={a.id} className="assign-row" data-row-native role="group" aria-label={`Задание: ${a.title}`}><input type="checkbox" aria-label={`Выбрать задание: ${a.title}`} checked={selected.has(a.id)} onChange={()=>toggle(a.id)}/><div className="list-main"><Link className="list-title row-title-link" to={`/homework/${a.id}`}>{a.title}</Link><div className="list-sub">{a.students.join(', ')||'Без получателей'} · {dueText(a.due_on)}</div><div className="assignment-row-status">{a.submitted>0&&<Badge tone="brass">На проверку: {a.submitted}</Badge>}{a.overdue>0&&<Badge tone="red">Просрочено: {a.overdue}</Badge>}{a.total>0&&a.checked>=a.total&&<Badge tone="green">Завершено</Badge>}{a.archived_at&&<Badge>Архив</Badge>}<span className="small muted">Проверено: {a.checked} из {a.total}</span></div></div><Link className="btn btn-secondary btn-sm" to={`/homework/${a.id}`}>{a.submitted?'Проверить':'Открыть'}</Link></article>)}
 {pages>1&&<nav className="workspace-pagination" aria-label="Страницы заданий"><button className="btn btn-secondary" disabled={currentPage===1} onClick={()=>setPage(p=>p-1)}>Назад</button><span>{currentPage} из {pages}</span><button className="btn btn-secondary" disabled={currentPage===pages} onClick={()=>setPage(p=>p+1)}>Дальше</button></nav>}</section></div>
 {archiving&&<Modal title="Убрать задания в архив?" onClose={()=>!busy&&setArchiving(false)}><p>Выбрано выдач: {selected.size}. Из рабочего списка преподавателя уйдёт вся выбранная выдача, включая всех её получателей. Задания и ответы учеников не удалятся.</p>{all.some(a=>selected.has(a.id)&&a.submitted>0)&&<p className="alert">Есть работы, которые ждут проверки. В архиве их можно открыть и вернуть в текущие.</p>}{error&&<ErrorBox error={error}/>}<div className="modal-actions"><button className="btn btn-secondary" disabled={busy} onClick={()=>setArchiving(false)}>Отмена</button><button className="btn" disabled={busy} onClick={()=>archive(true)}>{busy?'Сохраняем…':'Убрать в архив'}</button></div></Modal>}</>;
}


/* ============================================================
   Создание и редактирование задания
   ============================================================ */
export function AssignmentEditor({ id, presetStudentId, presetStudents, presetItems }) {
  const isNew = !id;
  const linkedId=isNew?Number(new URLSearchParams(location.hash.split('?')[1]||'').get('lesson'))||null:null;
  const data = useLoad(() => Promise.all([api.students(), id ? api.assignment(id) : Promise.resolve(null),linkedId?api.lessonRoom(linkedId):Promise.resolve(null)]), [id,linkedId]);
  if (data.loading) return <Spinner />;
  if (data.error) return <ErrorBox error={data.error} onRetry={data.reload} />;
  const [students, assignment,lesson] = data.data;
  return <EditorForm lesson={lesson} isNew={isNew} students={students} assignment={assignment} presetStudentId={presetStudentId} presetStudents={presetStudents} presetItems={presetItems} onFilesChanged={data.reload} />;
}

function EditorForm({ lesson,isNew, students, assignment, presetStudentId, presetStudents, presetItems, onFilesChanged }) {
  const subj = useSubject();
  const toast = useToast();
  const assignedIds = new Set((assignment?.submissions || []).map((s) => s.student_id));
  // Черновик: незаконченное задание сохраняется в браузере и возвращается при следующем открытии
  const dkey = isNew ? (lesson?`assign:new:lesson:${lesson.id}`:'assign:new') : `assign:${assignment.id}`;
  const [base] = useState(() => ({
    subject:lesson?.subject||assignment?.subject||new URLSearchParams(location.hash.split('?')[1]||'').get('subject')||'',
    title: assignment?.title || (lesson?.topic?`После урока: ${lesson.topic}`:''),
    section_id: assignment?.section_id || null,
    description: assignment?.description || '',
    links: (assignment?.links || []).join('\n'),
    due_on: assignment?.due_on || '',
    questions: assignment?.questions || [],
    students: new Set(lesson?[lesson.student_id]:presetStudents?.length ? presetStudents : presetStudentId ? [presetStudentId] : []),
    vocab: assignment ? Boolean(assignment.vocab_practice) : false,
    vocabCount: assignment?.vocab_practice?.count || 12,
    items: assignment?.library_item_ids || presetItems || [],
    setId: assignment?.word_set_id || null,
    answer_mode: assignment?.answer_mode || 'both',
  }));
  const [draft] = useState(() => readDraft(dkey));
  const restored = draft?.value?.f;
  const [f, setF] = useState(() => (restored ? { ...base, ...restored, students: new Set(restored.students || []) } : base));
  const [newWords, setNewWords] = useState(() => draft?.value?.newWords || []); // слова к уроку: новый набор из вставленного списка
  const [pendingFiles, setPendingFiles] = useState([]); // для нового задания — загрузим после создания
  const [showQuiz, setShowQuiz] = useState(() => (draft?.value ? Boolean(draft.value.showQuiz) : Boolean(assignment?.questions?.length)));
  const [restoredAt, setRestoredAt] = useState(restored ? draft.at : null);
  const snapshot = { f: { ...f, students: [...f.students] }, newWords, showQuiz, hadFiles: pendingFiles.length > 0 };
  const baseJson = useState(() => JSON.stringify({ ...base, students: [...base.students] }))[0];
  const changed = JSON.stringify(snapshot.f) !== baseJson || newWords.length > 0;
  useDraftSave(dkey, snapshot, changed);
  const resetDraft = () => { clearDraft(dkey); setF(base); setNewWords([]); setShowQuiz(Boolean(assignment?.questions?.length)); setRestoredAt(null); };
  const [picking, setPicking] = useState(false);

  const toggle = (sid) => {
    const next = new Set(f.students);
    next.has(sid) ? next.delete(sid) : next.add(sid);
    setF({ ...f, students: next });
  };

  const { busy, error, submit } = useSubmit(async () => {
    const body = {
      title: f.title.trim(),
      section_id: f.section_id || null,
      description: orNull(f.description),
      links: f.links.split(/\s+/).map((s) => s.trim()).filter(Boolean),
      due_on: f.due_on || null,
      questions: showQuiz ? cleanQuestions(f.questions) : [],
      library_item_ids: f.items,
      vocab_practice: f.vocab ? { count: Number(f.vocabCount) } : null,
      answer_mode: f.answer_mode,
    };
    // Слова к уроку: вставленный список становится набором карточек этого задания
    if (newWords.length) {
      const who = isNew ? [...f.students] : [...new Set([...(assignment.submissions || []).map((s) => s.student_id), ...f.students])];
      if (f.setId) {
        const cur = await api.wordSet(f.setId);
        const have = new Set(cur.words.map((w) => w.term.toLowerCase()));
        await api.updateWordSet(f.setId, { words: [...cur.words, ...newWords.filter((w) => !have.has(w.term.toLowerCase()))].slice(0, 500) });
      } else {
        const created = await api.createWordSet({ subject:f.subject||lesson?.subject||undefined,title: `${subj.Items}: ${f.title.trim()}`.slice(0, 200), words: newWords.slice(0, 500), for_all: false, student_ids: who.length ? who : undefined });
        body.word_set_id = created.id;
      }
    }
    if (!body.word_set_id) body.word_set_id = f.setId || null;
    if (isNew) {
      if (!f.students.size) throw new Error('Выберите хотя бы одного ученика');
      const created = await api.createAssignment({ ...body, subject:f.subject||undefined,lesson_id:lesson?.id, student_ids: [...f.students] });
      clearDraft(dkey);
      for (const file of pendingFiles) await api.uploadFile({ assignment_id: created.id }, file);
      toast(`Задание выдано: ${f.students.size} ${plural(f.students.size, 'ученик', 'ученика', 'учеников')}`);
      navigate(`/homework/${created.id}`);
    } else {
      await api.updateAssignment(assignment.id, { ...body, add_student_ids: [...f.students] });
      clearDraft(dkey);
      toast('Задание сохранено');
      navigate(`/homework/${assignment.id}`);
    }
  });

  const active = students.filter((s) => !assignedIds.has(s.id)&&(!lesson||s.id===lesson.student_id));

  return (
    <>
      <BackLink to={isNew ? '/homework' : `/homework/${assignment.id}`}>{isNew ? 'Задания' : 'К заданию'}</BackLink>
      <div className="page-head"><h1 className="page-title">{isNew ? 'Новое задание' : 'Изменить задание'}</h1></div>
      {isNew && !restoredAt && <MethodTip slug="homework" text="Сколько задавать и как проверять быстро:" />}
      <DraftNotice at={restoredAt} onReset={resetDraft} text={draft?.value?.hadFiles ? 'Восстановлен черновик задания. Файлы прикрепите заново' : 'Восстановлен несохранённый черновик задания'} />

      <div className="editor-guide" aria-label="Как выдать задание"><span><b>1</b>Название и инструкция</span><span><b>2</b>Материалы</span><span><b>3</b>Ученики и срок</span></div>
      <form onSubmit={submit} className="assign-layout">
        <div className="stack">
          {lesson&&<LessonRecap lesson={lesson} tutor compact/>}
          <FormulaBar />
          <section className="panel form">
            <Field label="Название">
              <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required autoFocus={isNew}
                placeholder={subj.isLang ? 'Workbook, Unit 4: упражнения 1–4' : 'Параграф 12: задачи 1–5'} />
            </Field>
            {isNew&&<Field label="Направление задания">{lesson?<p>{lesson.subject} · выбран язык занятия</p>:<SubjectInput value={f.subject} onChange={subject=>setF({...f,subject,section_id:null})} placeholder="Основное направление выбранных учеников"/>}</Field>}
            <SectionPicker subject={lesson?.subject||f.subject} value={f.section_id} onChange={section_id=>setF({...f,section_id})}/>
            {assignment&&<p className="small muted">Раздел применяется к работам без личного переноса. Размещение, изменённое в карточке ученика, сохраняется.</p>}
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
            <AnswerModeField value={f.answer_mode} onChange={(v) => setF({ ...f, answer_mode: v })}
              hasFiles={isNew ? pendingFiles.length > 0 : assignment.files.length > 0} />
          </section>

          <EditorOption title="Упражнения из библиотеки" count={f.items.length} defaultOpen={f.items.length>0}>
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2 className="section-title">Задачи из задачника</h2>
                <div className="small muted">Ученик увидит условия; ответы и ваши заметки не увидит</div>
              </div>
            </div>
            <PickedTasks ids={f.items} onChange={(items) => setF({ ...f, items })} onAdd={() => setPicking(true)} />
            {picking && (
              <TaskPicker selected={f.items} onClose={() => setPicking(false)}
                onPick={(items) => { setPicking(false); setF({ ...f, items }); }} />
            )}
          </section>
          </EditorOption>

          <EditorOption title="Слова и карточки к заданию" count={newWords.length} defaultOpen={Boolean(f.setId||newWords.length)}><HomeworkWords setId={f.setId} onSetId={(setId) => setF({ ...f, setId })} words={newWords} onWords={setNewWords} /></EditorOption>

          <EditorOption title="Повторение слов ученика" count={0} defaultOpen={f.vocab}>
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2 className="section-title">Отработка {subj.items}</h2>
                <div className="small muted">Упражнения на {subj.items} из {subj.ofVocab} ученика: сначала забытые и ошибки, потом {subj.items} текущего юнита</div>
              </div>
            </div>
            <label className="check">
              <input type="checkbox" checked={f.vocab} onChange={(e) => setF({ ...f, vocab: e.target.checked })} />
              <span>Добавить отработку {subj.items}</span>
            </label>
            {f.vocab && (
              <div className="row" style={{ marginTop: 10, paddingLeft: 28 }}>
                <span className="small muted">Сколько карточек</span>
                <select className="select" style={{ width: 110, height: 38 }} value={f.vocabCount} onChange={(e) => setF({ ...f, vocabCount: e.target.value })}>
                  {[8, 12, 16, 20, 30].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            )}
          </section>
          </EditorOption>

          <EditorOption title="Тест с автопроверкой" count={f.questions.length} defaultOpen={showQuiz}>
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
          </EditorOption>
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
  const subj = useSubject();
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
      <BackLink to="/homework">Задания</BackLink>
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

          {d.description && <MathText as="p" className="instructions" style={{ marginTop: 0 }}>{d.description}</MathText>}
          {(d.files.length > 0 || d.links.length > 0) && <div style={{ margin: '18px 0' }}><Materials files={d.files} links={d.links} /></div>}

          {d.library_item_ids?.length > 0 && <AssignmentTasks ids={d.library_item_ids} showPrivate />}

          {d.word_set && (
            <section style={{ marginTop: 24 }}>
              <h2 className="section-title" style={{ marginBottom: 10 }}>{subj.Items} к уроку</h2>
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
                    {d.word_set ? `. Карточки: ${s.set_learned} из ${d.word_set.word_count}${s.set_sessions ? '' : ', не учил'}` : ''}
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
  const subj = useSubject();
  const toast = useToast();
  // Черновик комментария к работе: не пропадёт, если отвлечься и уйти со страницы
  const fkey = `review:${hw.id}`;
  const [feedback, setFeedback] = useState(() => readDraft(fkey)?.value ?? hw.tutor_feedback ?? '');
  useDraftSave(fkey, feedback, feedback !== (hw.tutor_feedback || ''));
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
    clearDraft(fkey);
    toast(`Проверено: ${hw.student_name}`);
    goNext();
  });
  const sendBack = useSubmit(async () => {
    await api.updateHomework(hw.id, { status: 'assigned', tutor_feedback: orNull(feedback) });
    clearDraft(fkey);
    toast('Отправлено на доработку');
    goNext();
  });

  return (
    <>
      <BackLink to={`/homework/${assignment.id}`}>{assignment.title}</BackLink>
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
          {hw.student_answer&&['submitted','checked'].includes(hw.status)&&<StartWritingReview sourceKind="homework" sourceId={hw.id}/>}
          <HomeworkRecap homework={hw} tutor/>
          <WritingInbox studentId={hw.student_id} subject={hw.subject} homeworkId={hw.id}/>
          {hw.student_answer ? <MathText as="p" className="instructions" style={{ marginTop: 0 }}>{hw.student_answer}</MathText> : <p className="muted" style={{ marginTop: 0 }}>Без текста</p>}

          <h2 className="section-title" style={{ margin: '22px 0 10px' }}>Файлы ученика</h2>
          {hw.attachments.length ? <Materials files={hw.attachments} /> : <p className="muted" style={{ margin: 0 }}>Файлов нет</p>}

          <GameResultsPanel items={items} results={results} />

          {hw.vocab_practice && (
            <section style={{ marginTop: 26 }}>
              <div className="row-between">
                <h2 className="section-title">Отработка {subj.items}</h2>
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
              draftKey={canPlay && homework ? `hw:${homework.id}:item:${it.id}` : undefined}
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
  const subj = useSubject();
  const sets = useLoad(() => api.wordSets(), []);
  const [mode, setMode] = useState(setId ? 'set' : 'none');
  const current = sets.data?.find((x) => x.id === setId);
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2 className="section-title">{subj.Items} к уроку</h2>
          <div className="small muted">Карточки прямо в задании: ученик учит их в пяти режимах, вы видите, сколько выучено</div>
        </div>
      </div>
      <div className="seg" style={{ marginBottom: 12 }}>
        <button type="button" className={mode === 'none' ? 'on' : ''} onClick={() => { setMode('none'); onSetId(null); onWords([]); }}>Без карточек</button>
        <button type="button" className={mode === 'new' ? 'on' : ''} onClick={() => { setMode('new'); onSetId(null); }}>Вставить список</button>
        <button type="button" className={mode === 'set' ? 'on' : ''} onClick={() => setMode('set')}>Готовый набор</button>
      </div>
      {mode === 'new' && (
        <>
          <WordPaste onWords={(w) => onWords(w)} rows={6} placeholder={`${subj.Items} к уроку: ${subj.item[0]} и ${subj.meaning} через Tab, тире или запятую\n\n${subj.lessonExample}`} />
          <div className="small muted" style={{ marginTop: 8 }}>{words.length ? `Создастся набор «${subj.Items}: название задания» из ${words.length} карточек. Его можно поправить потом в разделе «Карточки».` : 'Набор создастся при сохранении задания.'}</div>
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
                <summary className="small" style={{ cursor: 'pointer' }}>Добавить в этот набор ещё {subj.items}</summary>
                <div style={{ marginTop: 10 }}><WordPaste onWords={(w) => onWords(w)} rows={4} /></div>
              </details>
            )}
          </>
        )
      )}
    </section>
  );
}

// Как ученик отвечает на задание: текстом прямо на сайте, фото и файлами, и так и так, или ответ не нужен
const ANSWER_MODES = [
  ['text', 'Текстом на сайте', 'Под заданием будет поле «Ваш ответ», ученик пишет ответы туда'],
  ['files', 'Фото или файлом', 'Ученик прикладывает фото тетради, аудио или документ'],
  ['both', 'Текстом или файлом', 'Можно и написать, и приложить файл'],
  ['none', 'Ответ не нужен', 'Посмотреть, послушать или прочитать. Ученик просто отмечает «Сделано»'],
];
function AnswerModeField({ value, onChange, hasFiles }) {
  const cur = ANSWER_MODES.find((m) => m[0] === value) || ANSWER_MODES[2];
  return (
    <Field label="Как ученик отвечает" hint={cur[2]}>
      {hasFiles && value === 'both' && (
        <div className="note small" style={{ marginBottom: 8 }}>К заданию приложены файлы. Уточните, где ученику писать ответ: в поле на сайте или в тетради с фото.</div>
      )}
      <div className="seg seg-wrap">
        {ANSWER_MODES.map(([k, label]) => (
          <button key={k} type="button" className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{label}</button>
        ))}
      </div>
    </Field>
  );
}
