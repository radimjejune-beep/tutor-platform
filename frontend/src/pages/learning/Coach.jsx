import {useState} from 'react';
import {api} from '../../api';
import {useAuth} from '../../auth';
import {useLoad,Spinner,ErrorBox,Empty,Link,Badge,Field,navigate,readDraft,writeDraft,clearDraft} from '../../ui';
import {BackLink} from '../../Shell';
import {QuizForm} from '../../components/Quiz';
import {TopicReport} from './Diagnostics';
import LessonPlanner from '../../components/LessonPlanner';

const STATUS={repeat:'Стоит повторить',practice:'Нужна практика',insufficient:'Мало данных',confident:'Хороший результат',waiting:'Повторная проверка позже',due:'Пора проверить снова',no_data:'Без проверки'};
const date=v=>new Date(v).toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'});
export function CoachSummary({studentId}) {
 const data=useLoad(()=>api.coach(studentId),[studentId]);
 if(!data.data)return null;const p=data.data,due=p.topics.filter(t=>t.status==='due').length;
 return <Link to="/coach" className="words-strip"><span><span className="meta-label">Повторение по ошибкам</span><span className="serif words-strip-title">{due?`Пора проверить снова: ${due}`:p.weak?`Темы для повторения: ${p.weak}`:'Объяснения, практика и проверка через неделю'}</span></span><span className="btn btn-sm">Открыть</span></Link>;
}
export default function Coach({student,isParent=false,tutor=false}) {
 const data=useLoad(()=>api.coach(student.id),[student.id]),[busy,setBusy]=useState(''),[error,setError]=useState(''),[manual,setManual]=useState(false);
 const start=async topic=>{setBusy(topic);setError('');try{const r=await api.startReview(student.id,topic);navigate(`/coach/reviews/${r.id}`);}catch(e){setError(e.message);}finally{setBusy('');}};
 return <><div className="page-head"><div><h1 className="page-title">{tutor?'Помощник преподавателя':'Что повторить'}</h1><p className="lead">{tutor?'Результаты ученика → объяснение и практика → повторная проверка через неделю.':'Вспомни объяснение, выполни три задания и проверь себя через неделю.'}</p></div></div>
  {data.loading?<Spinner/>:data.error?<ErrorBox error={data.error} onRetry={data.reload}/>:<>
   <p className="small muted">{data.data.note}</p>
   {!data.data.topics.length&&<div className="panel"><Empty title="Пока нет результатов по темам">Пройденная диагностика или упражнение с указанной темой помогут выбрать повторение. Можно выбрать тему вручную.</Empty></div>}
   <div className="learning-grid">{data.data.topics.map(t=><article className="panel learning-card" key={t.topic_id}>
    <Badge tone={t.status==='confident'?'green':['repeat','due'].includes(t.status)?'red':'brass'}>{STATUS[t.status]}</Badge><h2 className="section-title">{t.title}</h2><p>{t.reason}</p>
    {t.source&&<p className="small muted">{t.source.title} · {date(t.source.at)}{t.source.link&&<> · <Link to={t.source.link}>Посмотреть проверку</Link></>}</p>}
    {t.recheck&&!t.recheck.submitted_at&&<p className="small">Повторная проверка: {date(t.recheck.available_at)}</p>}
    <div className="row wrap"><Link className="btn btn-secondary btn-sm" to={t.grammar_link}>Объяснение</Link>
     {t.status==='due'?<Link className="btn btn-sm" to={`/coach/reviews/${t.recheck.id}`}>{isParent||tutor?'Посмотреть проверку':'Проверить себя'}</Link>:t.practice?<Link className="btn btn-sm" to={`/coach/reviews/${t.practice.id}`}>{t.practice.submitted_at?'Разбор тренировки':isParent||tutor?'Посмотреть тренировку':'Продолжить'}</Link>:!isParent&&<button className="btn btn-sm" disabled={!!busy} onClick={()=>start(t.topic_id)}>{busy===t.topic_id?'Готовим…':tutor?'Назначить повторение':'Повторить · 3 задания'}</button>}
    </div>
   </article>)}</div>
  </>}
  {error&&<div className="alert" role="alert">{error}</div>}
  {!isParent&&<div className="panel" style={{marginTop:20}}><button className="btn btn-secondary" onClick={()=>setManual(!manual)}>Выбрать другую тему</button>{manual&&<TopicChooser onChoose={start} busy={!!busy}/>}</div>}
  {tutor&&<LessonPlanner key={student.id} student={student}/>}
 </>;
}
export function TopicChooser({onChoose,busy}) {
 const data=useLoad(()=>api.grammarTopics(),[]),[value,setValue]=useState(''),[q,setQ]=useState('');
 const visible=(data.data||[]).filter(t=>`${t.title} ${t.book_short||''} ${t.unit||''}`.toLowerCase().includes(q.toLowerCase()));
 return <div className="stack" style={{gap:10,marginTop:16}}><Field label="Найти тему"><input aria-label="Найти тему" className="input" value={q} onChange={e=>setQ(e.target.value)} placeholder="Present Simple, вопросы…"/></Field>{data.error?<ErrorBox error={data.error} onRetry={data.reload}/>:<Field label="Тема грамматики"><select aria-label="Тема грамматики" className="select" value={value} onChange={e=>setValue(e.target.value)}><option value="">Выберите тему</option>{visible.map(t=><option key={t.id} value={t.id}>{t.title}{t.book_short?` · ${t.book_short} U${t.unit}`:''}</option>)}</select></Field>}<button className="btn btn-sm" disabled={busy||!value} onClick={()=>onChoose(value)}>Выбрать тему</button></div>;
}
export function CoachReview({id}) {
 const data=useLoad(()=>api.review(id),[id]);if(data.loading)return <Spinner/>;if(data.error)return <ErrorBox error={data.error} onRetry={data.reload}/>;
 return <Review key={`${id}:${Boolean(data.data.submitted_at)}`} review={data.data} reload={data.reload}/>;
}
function Review({review:r,reload}) {
 const {user}=useAuth(),tutor=user.role==='tutor',back=tutor?`/students/${r.student_id}/coach`:'/coach',key=`review:${r.id}`;
 const editable=user.role==='student'&&!r.submitted_at&&!r.locked&&!r.stale;
 const [answers,setAnswers]=useState(()=>r.submitted_at?r.answers:readDraft(key)?.value||{}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[confirm,setConfirm]=useState(false);
 const change=a=>{setAnswers(a);writeDraft(key,a);setConfirm(false);};
 const missing=r.questions.filter(q=>answers[q.id]===undefined||answers[q.id]==='').length;
 const submit=async()=>{if(missing&&!confirm){setConfirm(true);return;}setBusy(true);try{await api.submitReview(r.id,answers);clearDraft(key);reload();}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <><BackLink to={back}>Повторение по темам</BackLink><div className="page-head"><div><span className="meta-label">{r.mode==='practice'?'Объяснение и три задания':'Повторная проверка'}</span><h1 className="page-title">{r.title}</h1></div></div>
  {r.result&&<TopicReport result={r.result}/>}
  {r.stale?<div className="panel"><p>Появилась новая проверка по этой теме. Откройте помощника для актуального повторения.</p><Link className="btn" to={back}>Открыть помощника</Link></div>:<>
   {r.article&&<section className="panel" style={{marginBottom:20}}><h2 className="section-title">Вспомнить правило</h2><p>{r.article.when}</p><p className="learning-rule">{r.article.form}</p><ul>{r.article.examples.map((v,i)=><li key={i}>{v}</li>)}</ul><p>{r.article.mistake}</p><Link to={`/grammar/${r.topic_id}`}>Полное объяснение темы</Link></section>}
   {r.locked&&!tutor?<div className="panel"><h2 className="section-title">Проверка откроется {date(r.available_at)}</h2><p>Пауза помогает проверить, что осталось в памяти после тренировки.</p><button className="btn btn-secondary" onClick={reload}>Проверить доступность</button></div>:r.questions.length?<section className="panel">
    {tutor&&!r.submitted_at&&<p className="small muted">Предпросмотр преподавателя с ключами. Отвечать и сдавать работу может только ученик.{r.locked&&` Для ученика откроется ${date(r.available_at)}.`}</p>}
    <fieldset className="learning-fieldset" disabled={busy}><QuizForm questions={r.questions} answers={answers} onChange={change} mode={editable?'answer':r.submitted_at?'review':'key'} results={r.result?.results}/></fieldset>
    {r.submitted_at&&r.questions.filter(q=>!r.result.results[q.id]&&q.explanation).map(q=><p className="learning-note" key={q.id}>{q.explanation}</p>)}
    {editable&&<><p className="small muted">Ответы сохраняются в этом браузере. После сдачи откроется разбор.</p>{confirm&&<p className="alert">Без ответа: {missing}. Можно вернуться к вопросам или сдать с пропусками.</p>}<button className="btn" disabled={busy} onClick={submit}>{busy?'Сохраняем…':confirm?'Сдать с пропусками':'Сдать и проверить'}</button></>}
   </section>:<p className="panel">Ученик ещё не выполнил тренировку.</p>}
   {r.submitted_at&&r.mode==='practice'&&<p className="learning-note">Тренировка завершена. Повторная проверка появится в помощнике через семь дней. Этот результат ещё не означает, что тема усвоена надолго.</p>}
  </>}{error&&<div className="alert" role="alert">{error}</div>}
 </>;
}
