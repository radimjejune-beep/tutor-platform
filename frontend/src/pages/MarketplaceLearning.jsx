import {useState} from 'react';
import {api} from '../api';
import {useAuth} from '../auth';
import {Link,useLoad,Spinner,ErrorBox} from '../ui';
import {BreadcrumbEntity,BackLink} from '../Shell';
export function CourseMine(){
 const d=useLoad(()=>api.myMarketplaceCourses(),[]),{user}=useAuth();
 if(d.loading)return <Spinner/>;if(d.error)return <ErrorBox error={d.error} onRetry={d.reload}/>;
 return <><div className="page-head"><h1 className="page-title">Мои курсы</h1><p className="muted">Назначенные занятия и приобретённые материалы. Выполненные занятия можно открыть снова. Счётчик занятий не является оценкой языкового уровня.</p>{user.role==='tutor'&&<Link className="btn btn-secondary" to="/marketplace">Найти курс</Link>}</div>
 <div className="commerce-grid">{d.data.map(e=><article className="panel" key={e.enrollment_id}><h2 className="section-title">{e.title}</h2><p>{e.completed} из {e.total} занятий пройдено{e.student_id?` · ${e.student_name||'Ученик'}`:''}</p><progress aria-label="Пройдено занятий" max={e.total||1} value={e.completed}/><div className="row"><Link className="btn" to={`/learn-course/${e.enrollment_id}`}>Открыть</Link></div>{user.role==='tutor'&&!e.student_id&&<Assign purchase={e.purchase_id}/>}</article>)}</div>
 {!d.data.length&&<p className="panel">Пока нет назначенных курсов. {user.role==='tutor'?<Link to="/courses">Открыть учебные курсы</Link>:'Преподаватель добавит курс, когда он понадобится для занятий.'}</p>}</>;
}
function Assign({purchase}){
 const d=useLoad(()=>api.students(),[]),[id,setId]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(false);
 const assign=async()=>{setBusy(true);setError('');try{await api.assignMarketplaceCourse(purchase,Number(id));setDone(true);}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <div className="commerce-unit"><label className="field">Назначить ученику<select className="input" value={id} onChange={e=>{setId(e.target.value);setDone(false);}}><option value="">Выберите ученика</option>{(d.data||[]).map(s=><option key={s.id} value={s.id}>{s.full_name}</option>)}</select></label><button className="btn btn-secondary" disabled={!id||busy} onClick={assign}>Назначить курс</button>{done&&<p role="status">Курс появился в кабинете ученика.</p>}{(error||d.error)&&<ErrorBox error={error||d.error}/>}</div>;
}
export function CoursePlayer({id}){
 const d=useLoad(()=>api.courseEnrollment(id),[id]),[selected,setSelected]=useState([0,0]);
 if(d.loading)return <Spinner/>;if(d.error)return <ErrorBox error={d.error} onRetry={d.reload}/>;
 const e=d.data,[mi,ui]=selected,u=e.modules[mi]?.units[ui],attempt=e.attempts.find(a=>a.module_index===mi&&a.unit_index===ui);
 return <><BreadcrumbEntity path={`/learn-course/${id}`} label={e.title}/><BackLink to="/marketplace/mine">Мои курсы</BackLink><h1 className="page-title">{e.title}</h1><div className="commerce-player"><aside className="panel"><h2 className="section-title">Программа курса</h2>{e.modules.map((m,i)=><div key={i}><h3>{m.title}</h3>{m.units.map((unit,j)=><button key={j} className={`commerce-lesson ${mi===i&&ui===j?'active':''}`} aria-current={mi===i&&ui===j?'step':undefined} onClick={()=>setSelected([i,j])}>{e.attempts.some(a=>a.module_index===i&&a.unit_index===j)?'✓ ':''}{unit.title}</button>)}</div>)}</aside>
 <section className="panel">{u?<Unit key={`${id}-${mi}-${ui}`} enrollment={e} unit={u} mi={mi} ui={ui} attempt={attempt} onDone={d.reload}/>:<p>В курсе пока нет занятий.</p>}</section></div></>;
}
function Unit({enrollment:e,unit:u,mi,ui,attempt,onDone}){
 const [answers,setAnswers]=useState(attempt?.answers||{}),[response,setResponse]=useState(attempt?.response||''),[result,setResult]=useState(attempt?.result),[comment,setComment]=useState(attempt?.comment||''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const readOnly=e.read_only||e.teacher&&!!e.student_id;
 const submit=async()=>{setBusy(true);setError('');try{setResult(await api.courseAttempt(e.id,{module_index:mi,unit_index:ui,answers,response}));onDone();}catch(err){setError(err.message);}finally{setBusy(false);}};
 const review=async()=>{setBusy(true);setError('');try{await api.reviewCourseAttempt(e.id,{module_index:mi,unit_index:ui,comment});onDone();}catch(err){setError(err.message);}finally{setBusy(false);}};
 return <><h2 className="section-title">{u.title}</h2>{['text','assignment'].includes(u.type)&&<div className="commerce-prose">{u.content}</div>}
 {u.type==='video'&&<><a className="btn btn-secondary" href={u.url} target="_blank" rel="noopener noreferrer">Открыть видео</a><p className="small muted">Видео откроется на внешнем сайте.</p></>}
 {u.type==='quiz'&&u.questions.map(q=><fieldset className="commerce-question" disabled={readOnly||busy} key={q.id}><legend>{q.prompt}</legend>{q.type==='choice'?q.options.map((o,j)=><label className="commerce-check" key={j}><input type="radio" name={`answer-${q.id}`} checked={String(answers[q.id])===String(j)} onChange={()=>setAnswers(p=>({...p,[q.id]:j}))}/>{o}</label>):<input className="input" aria-label={q.prompt} maxLength={300} value={answers[q.id]??''} onChange={ev=>setAnswers(p=>({...p,[q.id]:ev.target.value}))}/>}</fieldset>)}
 {u.type==='assignment'&&<label className="field">Ответ<textarea className="input" readOnly={readOnly} rows={7} maxLength={30000} value={response} onChange={ev=>setResponse(ev.target.value)}/></label>}
 {result&&<p role="status">{result.score!=null?`Результат: ${result.score}%`:result.pending_review?'Ответ отправлен преподавателю':'Занятие отмечено как пройденное'}</p>}
 {result?.results&&u.questions?.map(q=><p key={q.id} className="small">{result.results[q.id]?'✓':'Повторите'} · {q.prompt}</p>)}
 {attempt?.comment&&<div className="panel"><b>Комментарий преподавателя</b><p className="commerce-prose">{attempt.comment}</p></div>}
 {!readOnly&&<button className="btn" disabled={busy} onClick={submit}>{u.type==='quiz'?'Проверить ответы':u.type==='assignment'?'Отправить ответ':'Отметить как пройденное'}</button>}
 {e.teacher&&e.student_id&&attempt&&u.type==='assignment'&&<><label className="field">Комментарий ученику<textarea className="input" maxLength={5000} value={comment} onChange={ev=>setComment(ev.target.value)}/></label><button className="btn" disabled={busy||!comment.trim()} onClick={review}>Сохранить проверку</button></>}
 {e.read_only&&<p className="small muted">Родителю доступен просмотр результатов и комментариев.</p>}{error&&<ErrorBox error={error}/>}</>;
}
