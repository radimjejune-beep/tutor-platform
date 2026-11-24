import {SyncStudyDirection} from '../../components/StudyArea';
import { useState } from 'react';
import { api } from '../../api';
import { useSubject } from '../../subjects';
import { useAuth } from '../../auth';
import { useLoad, Spinner, ErrorBox, Empty, Link, Badge, Field, useToast, navigate, readDraft, writeDraft, clearDraft } from '../../ui';
import { BackLink } from '../../Shell';
import { QuizEditor, QuizForm, cleanQuestions } from '../../components/Quiz';
import { LearningTabs, SectionPicker } from '../../components/StudySections';
import { shortDate, todayISO, plural } from '../../format';

const STATUS={repeat:'Стоит повторить',practice:'Нужна практика',confident:'Хороший результат',insufficient:'Мало данных'};
const tone=s=>s==='confident'?'green':s==='repeat'?'red':s==='practice'?'brass':undefined;
export function TopicReport({result}) {
  if(!result)return null;
  return <section className="panel"><div className="panel-head"><h2 className="section-title">Что получилось и что повторить</h2><b className="num">{result.earned} / {result.total} · {result.score}%</b></div>
    <p className="small muted">Вывод относится к этой проверке. При количестве вопросов меньше трёх данных для вывода о теме недостаточно.</p>
    <div className="learning-results">{result.topics.map(t=><div className="learning-result" key={t.topic_id}>
      <div>{t.topic_id.startsWith('item-')?<b>{t.title}</b>:<Link to={`/grammar/${t.topic_id}`}><b>{t.title}</b></Link>}<div className="small muted">{t.correct} из {t.total} вопросов · {t.score}% баллов</div></div>
      <Badge tone={tone(t.status)}>{STATUS[t.status]}</Badge>
      {!t.topic_id.startsWith('item-')&&<Link className="btn btn-secondary btn-sm" to={`/grammar/${t.topic_id}`}>Объяснение и практика</Link>}
    </div>)}</div>
  </section>;
}
export function DiagnosticsList({student}) {
  const {user}=useAuth(),isTutor=user.role==='tutor';
  const direction=useSubject(student?.subject);
  const list=useLoad(()=>api.diagnostics(student?.id,isTutor?null:direction.subject),[student?.id,isTutor,direction.subject]);
  if(list.loading)return <Spinner/>;
  if(list.error)return <ErrorBox error={list.error} onRetry={list.reload}/>;
  return <><div className="page-head"><div><h1 className="page-title">Диагностика по темам</h1><p className="lead">{isTutor?'Проверки для выбранных учеников: результаты по каждой теме и подсказки для повторения.':'Назначенные проверки и результаты по темам. Выполняй тест самостоятельно, а после сдачи посмотри разбор.'}</p></div>
    {isTutor&&<Link className="btn" to="/diagnostics/new">Создать тест</Link>}</div><LearningTabs active="diagnostics"/>
    {!list.data.length?<div className="panel"><Empty title={isTutor?'Проверок пока нет':'Учитель пока не назначил проверку'}/></div>:
    <div className="learning-grid">{list.data.map(t=><Link className="panel learning-card" key={t.id} to={isTutor?`/diagnostics/tests/${t.id}`:`/diagnostics/runs/${t.id}`}>
      <span className="meta-label">{t.subject||''} · {t.section_title||'Без раздела'}</span><h2 className="section-title">{t.title}</h2>
      <p className="small muted">{t.due_on?`До ${shortDate(t.due_on)}`:'Без срока'}</p>
      {isTutor?<Badge>Сдали {t.submitted} из {t.total}</Badge>:t.submitted_at?<Badge tone="green">{t.result?.score}% · результат</Badge>:<Badge tone={t.due_on&&t.due_on<todayISO()?'red':'brass'}>{user.role==='parent'?'Ожидает выполнения':'Пройти тест'}</Badge>}
    </Link>)}</div>}
  </>;
}
export function DiagnosticBuilder() {
  const students=useLoad(()=>api.students(),[]),topics=useLoad(()=>api.grammarTopics(),[]);
  if(students.loading||topics.loading)return <Spinner/>;
  if(students.error||topics.error)return <ErrorBox error={students.error||topics.error} onRetry={()=>{students.reload();topics.reload();}}/>;
  return <Builder students={students.data.filter(s=>s.status!=='archived')} topics={topics.data}/>;
}
function Builder({students,topics:allTopics}) {
  const key='diagnostic:new',toast=useToast();
  const [topicQuery,setTopicQuery]=useState('');
  const [initial]=useState(()=>readDraft(key)?.value);
  const [f,setF]=useState(()=>({subject:'Английский язык',...(initial?.f||{title:'Проверка по пройденному',instructions:'',due_on:'',section_id:null,mode:'covered',student_ids:[],topic_ids:[],per_topic:3,request_key:crypto.randomUUID()})}));
  const topics=allTopics.filter(t=>t.subject===f.subject);
  const [papers,setPapers]=useState(initial?.papers||[]),[manual,setManual]=useState(initial?.manual||[]),[busy,setBusy]=useState(false),[error,setError]=useState('');
  // Сохраняем черновик сразу после действий, включая индивидуальные варианты.
  const persist=(nf=f,np=papers,nm=manual)=>writeDraft(key,{f:nf,papers:np,manual:nm});
  const change=(patch,reset=false)=>{const next={...f,...patch};setF(next);if(reset)setPapers([]);persist(next,reset?[]:papers);setError('');};
  const toggle=(field,value)=>change({[field]:f[field].includes(value)?f[field].filter(x=>x!==value):[...f[field],value]},true);
  const preview=async()=>{setBusy(true);setError('');try{
    const r=await api.diagnosticPreview({subject:f.subject,student_ids:f.student_ids,mode:f.mode,topic_ids:f.topic_ids,per_topic:Number(f.per_topic),max_topics:8});
    setPapers(r.papers);persist(f,r.papers);
  }catch(e){setError(e.message);}finally{setBusy(false);}};
  const publish=async e=>{e.preventDefault();setBusy(true);setError('');try{
    if(!f.student_ids.length)throw Error('Выберите учеников');
    const selected=f.mode==='manual'?f.student_ids.map(student_id=>({student_id,questions:manual})):papers;
    if(!selected.length||selected.some(p=>!p.questions.length))throw Error('Сначала сформируйте вопросы');
    const body={subject:f.subject,title:f.title.trim(),instructions:f.instructions,due_on:f.due_on||null,section_id:f.section_id||null,mode:f.mode,request_key:f.request_key,
      papers:selected.map(p=>({student_id:p.student_id,questions:cleanQuestions(p.questions).map(q=>({...q,topic_id:q.topic_id||(f.subject==='Французский язык'?'fr-etre':'present-simple'),explanation:q.explanation||''}))}))};
    const r=await api.createDiagnostic(body);clearDraft(key);toast('Тест назначен выбранным ученикам');navigate(`/diagnostics/tests/${r.id}`);
  }catch(e){setError(e.message);}finally{setBusy(false);}};
  const meta=(q,i,set)=><div className="form-row" style={{marginBottom:12}}>
    <Field label="Проверяемая тема"><select className="select" aria-label={`Тема вопроса ${i+1}`} value={q.topic_id||(f.subject==='Французский язык'?'fr-etre':'present-simple')} onChange={e=>set({topic_id:e.target.value})}>{topics.map(t=><option key={t.id} value={t.id}>{t.label||t.title}</option>)}</select></Field>
    <Field label="Пояснение после сдачи"><input className="input" aria-label={`Пояснение вопроса ${i+1}`} value={q.explanation||''} maxLength={2000} onChange={e=>set({explanation:e.target.value})}/></Field>
  </div>;
  const addBank=async()=>{setBusy(true);try{const id=f.topic_ids[0]||(f.subject==='Французский язык'?'fr-etre':'present-simple'),bank=await api.grammarBank(id);
    const next=[...manual,...bank.map(q=>({...q,id:crypto.randomUUID().slice(0,8)}))].slice(0,50);setManual(next);persist(f,papers,next);
  }catch(e){setError(e.message);}finally{setBusy(false);}};
  return <><BackLink to="/diagnostics">Диагностика</BackLink><div className="page-head"><h1 className="page-title">Создать диагностический тест</h1></div>
    <form onSubmit={publish} className="stack">
      <section className="panel form"><Field label="Язык теста"><select className="select" aria-label="Язык теста" value={f.subject} onChange={e=>{setManual([]);const next={...f,subject:e.target.value,section_id:null,topic_ids:[],request_key:crypto.randomUUID()};setF(next);setPapers([]);persist(next,[],[]);setError('');}}><option>Английский язык</option><option>Французский язык</option></select></Field><Field label="Название теста"><input className="input" aria-label="Название теста" value={f.title} required maxLength={200} onChange={e=>change({title:e.target.value})}/></Field>
        <Field label="Инструкция"><textarea className="textarea" aria-label="Инструкция теста" value={f.instructions} maxLength={4000} onChange={e=>change({instructions:e.target.value})}/></Field>
        <Field label="Срок сдачи"><input className="input" aria-label="Срок сдачи" type="date" value={f.due_on} onChange={e=>change({due_on:e.target.value})}/></Field>
        <SectionPicker subject={f.subject} value={f.section_id} onChange={section_id=>change({section_id})}/>
      </section>
      <section className="panel"><h2 className="section-title">Кому назначить</h2><p className="small muted">Вариант и результат сохраняются отдельно для каждого ученика.</p>
        {!students.length&&<Empty title="Сначала добавьте учеников"/>}
        <div className="learning-checks">{students.map(s=><label className="check" key={s.id}><input type="checkbox" checked={f.student_ids.includes(s.id)} onChange={()=>toggle('student_ids',s.id)}/><span>{s.full_name}</span></label>)}</div>
      </section>
      <section className="panel form"><Field label="Как собрать тест"><select className="select" aria-label="Как собрать тест" value={f.mode} onChange={e=>change({mode:e.target.value},true)}>
        <option value="covered">По пройденному у каждого ученика</option><option value="topics">По выбранным темам</option><option value="manual">Составить вручную</option>
      </select></Field>
      {f.mode==='covered'?<p className="muted">Берём до 8 последних пройденных грамматических тем из программы каждого ученика. Учитель отмечает их в карточке ученика → «Прогресс». Объяснение в справочнике можно привязать к каждой теме программы.</p>:
        <><p className="small muted">Выберите темы для автоматической сборки. В ручном режиме первая выбранная тема используется кнопкой «Добавить готовые вопросы».</p>
        <Field label="Найти тему или юнит"><input type="search" className="input" aria-label="Поиск тем теста" value={topicQuery} onChange={e=>setTopicQuery(e.target.value)} placeholder={f.subject==='Французский язык'?'Être, avoir, articles…':'Present Simple, Essential, English · 5 · Unit 52…'}/></Field>
        <div className="learning-topic-picker">{topics.filter(t=>!topicQuery||`${t.label||t.title} ${t.aliases.join(' ')}`.toLowerCase().includes(topicQuery.toLowerCase())).map(t=><label className="check" key={t.id}><input type="checkbox" checked={f.topic_ids.includes(t.id)} onChange={()=>toggle('topic_ids',t.id)}/><span>{t.label||t.title}</span></label>)}</div></>}
      {f.mode==='covered'&&<div className="row wrap" style={{gap:8}}>{students.filter(s=>f.student_ids.includes(s.id)).map(s=><Link key={s.id} className="btn btn-secondary btn-sm" to={`/students/${s.id}/progress`}>{s.full_name}: программа</Link>)}</div>}
      {f.mode!=='manual'&&<><Field label="Вопросов на тему"><select className="select" aria-label="Вопросов на тему" value={f.per_topic} onChange={e=>change({per_topic:Number(e.target.value)},true)}>{[3,4,5,6].map(n=><option key={n}>{n}</option>)}</select></Field>
        <button type="button" className="btn btn-secondary" disabled={busy||!f.student_ids.length} onClick={preview}>Сформировать варианты</button></>}
      </section>
      {f.mode==='manual'?<section className="panel"><h2 className="section-title">Свои вопросы</h2><p className="small muted">Выбор ответа и короткий текстовый ответ. Привяжите вопрос к теме для отчёта. Для вывода по теме нужно минимум 3 вопроса. Максимум в тесте — 50.</p>
        <button type="button" className="btn btn-secondary btn-sm" disabled={busy||manual.length>=50} onClick={addBank}>Добавить готовые вопросы</button>
        <QuizEditor questions={manual} renderMeta={meta} onChange={next=>{setManual(next);persist(f,papers,next);}}/>
      </section>:papers.map((p,pi)=><details className="panel" key={p.student_id} open={papers.length===1}>
        <summary><b>{p.student_name}</b> · {p.questions.length} {plural(p.questions.length,'вопрос','вопроса','вопросов')} · {p.topic_ids.length} {plural(p.topic_ids.length,'тема','темы','тем')}</summary>
        {p.omitted>0&&<p className="small muted">Ещё {p.omitted} пройденных тем не вошли в эту проверку. Их можно выбрать отдельным тестом.</p>}
        <QuizEditor questions={p.questions} renderMeta={meta} onChange={next=>{const np=papers.map((x,i)=>i===pi?{...x,questions:next}:x);setPapers(np);persist(f,np);}}/>
      </details>)}
      {error&&<div className="alert" role="alert">{error}</div>}
      <div className="panel row wrap" style={{gap:12}}><button className="btn" disabled={busy||!f.student_ids.length||(f.mode==='manual'?!manual.length:!papers.length)}>Назначить тест</button>
        <span className="small muted">До выдачи можно проверить и изменить вопросы. Для новой еженедельной или ежемесячной проверки создайте отдельный тест.</span></div>
    </form>
  </>;
}
export function DiagnosticTest({id}) {
  const data=useLoad(()=>api.diagnosticTest(id),[id]);
  if(data.loading)return <Spinner/>;if(data.error)return <ErrorBox error={data.error} onRetry={data.reload}/>;
  const t=data.data;
  return <><BackLink to="/diagnostics">Диагностика</BackLink><div className="page-head"><div><h1 className="page-title">{t.title}</h1><p className="lead">Сдали {t.runs.filter(r=>r.submitted_at).length} из {t.runs.length}. {t.due_on?`Срок: ${shortDate(t.due_on)}`:'Без срока'}</p></div><Link className="btn btn-secondary" to="/diagnostics/new">Новая проверка</Link></div>
    <section className="panel">{t.runs.map(r=><Link className="list-item clickable" to={`/diagnostics/runs/${r.id}`} key={r.id}>
      <div className="list-main"><b>{r.student_name}</b><div className="small muted">{r.question_count} {plural(r.question_count,'вопрос','вопроса','вопросов')}</div></div><Badge tone={r.submitted_at?'green':'brass'}>{r.submitted_at?`${r.result.score}% · разбор`:'Ожидает выполнения'}</Badge>
    </Link>)}</section>
    {t.runs.filter(r=>r.result).map(r=><details className="panel" key={r.id} style={{marginTop:16}}><summary>{r.student_name} · результат по темам</summary><TopicReport result={r.result}/></details>)}
  </>;
}
export function DiagnosticRun({id}) {
  const data=useLoad(()=>api.diagnosticRun(id),[id]);
  if(data.loading)return <Spinner/>;if(data.error)return <ErrorBox error={data.error} onRetry={data.reload}/>;
  return <Run key={`${id}:${Boolean(data.data.submitted_at)}`} run={data.data} reload={data.reload}/>;
}
function Run({run:r,reload}) {
  const {user}=useAuth(),toast=useToast(),editable=user.role==='student'&&!r.submitted_at,key=`diagnostic:${r.id}`;
  const [answers,setAnswers]=useState(()=>{const local=editable?readDraft(key):null;return local&&local.at>(r.draft_at?new Date(r.draft_at).getTime():0)?local.value:r.answers;});
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[confirm,setConfirm]=useState(false),[saved,setSaved]=useState('');
  const change=next=>{setAnswers(next);writeDraft(key,next);setSaved('Черновик сохранён в этом браузере');setConfirm(false);};
  const missing=r.questions.filter(q=>answers[q.id]===undefined||answers[q.id]==='').length;
  const submit=async()=>{if(missing&&!confirm){setConfirm(true);return;}setBusy(true);setError('');try{await api.submitDiagnostic(r.id,answers);clearDraft(key);reload();}catch(e){setError(e.message);}finally{setBusy(false);}};
  const save=async()=>{setBusy(true);setError('');try{await api.diagnosticDraft(r.id,answers);setSaved('Черновик сохранён на сервере');toast('Черновик сохранён');}catch(e){setError(e.message);}finally{setBusy(false);}};
  return <><SyncStudyDirection studentId={r.student_id} subject={r.subject}/><BackLink to="/diagnostics">Диагностика</BackLink><div className="page-head"><div><h1 className="page-title">{r.title}</h1><p className="lead">{r.student_name} · {r.due_on?`до ${shortDate(r.due_on)}`:'без срока'}</p></div></div>
    {r.result&&<TopicReport result={r.result}/>}
    {user.role==='parent'&&!r.submitted_at?<section className="panel"><Empty title="Ученик ещё не сдал тест">После сдачи здесь появятся результат, разбор по темам и объяснения для повторения.</Empty></section>:
    <section className="panel" style={{marginTop:20}}>{r.instructions&&<p className="instructions">{r.instructions}</p>}
      {editable&&<p className="small muted">Одна сдача на эту проверку. Можно сохранить черновик и продолжить позже. После сдачи откроются правильные ответы.</p>}
      <fieldset className="learning-fieldset" disabled={busy}><QuizForm questions={r.questions} answers={answers} onChange={change} mode={editable?'answer':r.submitted_at?'review':'key'} results={r.result?.results}/></fieldset>
      {r.result&&r.questions.filter((q,i,all)=>!r.result.results[q.id]&&q.explanation&&all.findIndex(x=>!r.result.results[x.id]&&x.topic_id===q.topic_id&&x.explanation===q.explanation)===i).map(q=><div className="learning-note" key={q.id}><b>{q.prompt}</b><p>{q.explanation}</p><Link to={`/grammar/${q.topic_id}`}>Открыть объяснение темы</Link></div>)}
      {editable&&<><p className="small muted" role="status">{saved||`Отвечено ${r.questions.length-missing} из ${r.questions.length}`}</p>
        {confirm&&<div className="alert" role="alert">Без ответа: {missing}. Можно вернуться к вопросам или сдать работу с пропусками.</div>}
        <div className="row wrap" style={{gap:8}}><button className="btn" disabled={busy} onClick={submit}>{confirm?'Сдать с пропусками':'Завершить тест'}</button><button className="btn btn-secondary" disabled={busy} onClick={save}>Сохранить черновик</button></div></>}
      {error&&<div className="alert" role="alert">{error}</div>}
    </section>}
  </>;
}
