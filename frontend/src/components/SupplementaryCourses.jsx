import {useState} from 'react';
import {api} from '../api';
import {useLoad,Spinner,ErrorBox,Field,Link,Modal,navigate} from '../ui';
import {HW_STATUS,shortDate} from '../format';

export function CourseTemplates(){
 const data=useLoad(()=>api.courseTemplates(),[]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 if(data.loading)return <Spinner/>;
 if(data.error)return <ErrorBox error={data.error} onRetry={data.reload}/>;
 if(!data.data.length)return null;
 const install=async()=>{if(busy)return;setBusy(true);setError('');try{const r=await api.installVocabularyCourse();navigate(`/courses/${r.course_id}`);}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <section className="panel" style={{marginBottom:24}} aria-label="Готовые дополнительные курсы"><span className="meta-label">Готовый курс Lessonfold</span>{data.data.map(t=><div key={t.id}><h2 className="section-title" style={{marginTop:10}}>{t.title}</h2><p>{t.description}</p><p className="small muted">{t.units} тем · {t.words} слов и выражений · {t.materials} материалов. При добавлении создаётся ваша редактируемая копия в курсах и папках библиотеки. Учитывается лимит взятия материалов из банка на вашем тарифе.</p>{t.installed_course_id?<Link className="btn" to={`/courses/${t.installed_course_id}`}>Открыть готовый курс</Link>:<button className="btn" disabled={busy} onClick={install}>{busy?'Добавляем курс…':'Добавить готовый курс'}</button>}<p className="small muted">После добавления: «Ученики → ученик → Курс → Дополнительная практика». Основной учебник менять не нужно. На тарифе с небольшим лимитом можно брать упражнения по отдельности из банка.</p><Link to="/bank/lf-elementary-vocabulary/1">Посмотреть упражнения в банке</Link></div>)}{error&&<p className="alert" role="alert">{error}</p>}</section>;
}

export default function SupplementaryCourses({student,tutor=false}){
 const data=useLoad(()=>Promise.all([api.supplementaryCourses(student.id,student.subject),tutor?api.courses():Promise.resolve([])]),[student.id,tutor]);
 const [courseId,setCourseId]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 if(data.loading)return <Spinner/>;
 if(data.error)return <ErrorBox error={data.error} onRetry={data.reload}/>;
 const [d,allCourses]=data.data;const courses=allCourses.filter(c=>c.subject===student.subject);
 if(!tutor&&!d.enrollments.length)return null;
 const enroll=async(id,active=true)=>{if(busy)return;setBusy(true);setError('');try{await api.enrollSupplementary(student.id,{course_id:Number(id),active});setCourseId('');data.reload();}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <section className="panel supplemental-courses" aria-label="Дополнительная практика" style={{margin:'24px 0'}}><div className="panel-head"><h2 className="section-title">Дополнительная практика</h2>{tutor&&<Link className="small" to="/courses">Выбрать готовый курс</Link>}</div><p className="small muted">{tutor?'Подключайте дополнительный курс по выбранному предмету рядом с основной программой. Темы и этапы можно выдавать в любом порядке.':'Здесь курсы, которые преподаватель подключил для дополнительной практики. Выданные этапы также находятся в домашних заданиях.'}</p>
  {tutor&&<form className="row wrap supplemental-enroll" onSubmit={e=>{e.preventDefault();if(courseId)enroll(courseId);}}><Field label="Дополнительный курс"><select className="select" value={courseId} onChange={e=>setCourseId(e.target.value)} disabled={busy}><option value="">Выберите курс</option>{courses.filter(c=>!d.enrollments.some(e=>e.course_id===c.id&&e.active)).map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></Field><button className="btn btn-secondary" disabled={busy||!courseId}>Подключить ученику</button></form>}
  {d.enrollments.map(e=><Enrollment key={e.id} enrollment={e} stages={d.stages} student={student} tutor={tutor} reload={data.reload} onPause={()=>enroll(e.course_id,!e.active)} busy={busy}/>)}
  {error&&<p className="alert" role="alert">{error}</p>}
 </section>;
}
function Enrollment({enrollment:e,stages,student,tutor,reload,onPause,busy}){
 const units=tutor?e.units:e.units.filter(u=>u.assignments.length);
 const [selected,setSelected]=useState(()=>units.find(u=>u.assignments.length)?.id||units[0]?.id||''),[assigning,setAssigning]=useState(false);
 const u=units.find(u=>u.id===Number(selected))||units[0];
 const done=e.totals.submitted;
 return <article className="supplemental-enrollment"><div className="row-between wrap"><h3>{e.title}</h3>{tutor&&<button className="btn btn-quiet btn-sm" onClick={onPause} disabled={busy}>{e.active?'Приостановить курс':'Возобновить курс'}</button>}</div><p className="small muted">{e.active?'Подключён':'Приостановлен'} · выдано этапов: {e.totals.given} · сдано: {done}. Сдано не означает «освоено»; открытые ответы оценивает преподаватель.</p>{tutor&&<Link className="small" to={`/courses/${e.course_id}`}>Материалы и редактирование курса</Link>}
  {units.length?<><Field label={`Тема курса «${e.title}»`}><select className="select" value={u.id} onChange={ev=>setSelected(ev.target.value)}>{units.map(u=><option key={u.id} value={u.id}>{u.code}. {u.title}{u.assignments.length?` · выдано: ${u.assignments.length}`:''}</option>)}</select></Field><div className="row-between wrap"><span className="small">{u.words} слов и выражений · {u.materials} материалов</span>{tutor&&e.active&&<button className="btn btn-sm" onClick={()=>setAssigning(true)}>Выдать этап</button>}</div>
  <div className="list">{u.assignments.map(a=><Link key={a.homework_id} className="list-item" to={tutor?`/homework/${a.assignment_id}`:`/homework/${a.homework_id}`}><div className="list-main"><div className="list-title">{stages[a.stage]}</div><div className="list-sub">{shortDate(a.created_at)} · {HW_STATUS[a.status]?.label||a.status}{a.score!==null?` · оценка ${a.score}%`:a.quiz_score!==null?` · тест ${a.quiz_score}%`:''}</div></div><span className="small">Открыть →</span></Link>)}</div>{!u.assignments.length&&<p className="small muted">Этапы этой темы ещё не выданы.</p>}</>:<p className="muted">Преподаватель ещё не выдал задания из этого курса.</p>}
  {!tutor&&<Link className="btn btn-secondary btn-sm" to="/words">Повторить слова в словаре</Link>}
  {assigning&&<AssignmentModal studentId={student.id} courseId={e.course_id} unit={u} stages={stages} onClose={()=>setAssigning(false)} onSaved={()=>{setAssigning(false);reload();}}/>}
 </article>;
}
function AssignmentModal({studentId,courseId,unit:u,stages,onClose,onSaved}){
 const [stage,setStage]=useState(u.stages[0]),[due,setDue]=useState(''),[key]=useState(()=>crypto.randomUUID()),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const assign=async ev=>{ev.preventDefault();if(busy)return;setBusy(true);setError('');try{await api.assignSupplementary(studentId,{course_id:courseId,unit_id:u.id,stage,due_on:due||null,request_key:key});onSaved();}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <Modal title="Дополнительное задание" onClose={busy?()=>{}:onClose}><form onSubmit={assign}><fieldset className="learning-fieldset" disabled={busy}><p>{u.code}. {u.title}</p><Field label="Этап практики"><select className="select" value={stage} onChange={ev=>setStage(ev.target.value)}>{u.stages.map(s=><option key={s} value={s}>{stages[s]}</option>)}</select></Field><p className="small muted">Материалов: {u.stage_counts[stage]}. Слова темы будут добавлены в словарь; существующие слова и график повторения сохранятся. Открытые ответы требуют проверки преподавателем.</p><Field label="Срок выполнения"><input className="input" type="date" value={due} onChange={ev=>setDue(ev.target.value)}/></Field><div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button><button className="btn">{busy?'Выдаём…':'Выдать задание'}</button></div></fieldset>{error&&<p className="alert" role="alert">{error}</p>}</form></Modal>;
}
