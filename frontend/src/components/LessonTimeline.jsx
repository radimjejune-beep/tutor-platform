import {useState} from 'react';
import {api} from '../api';
import {useLoad,Link,Spinner,ErrorBox,Badge} from '../ui';
import {shortDate,time,LESSON_STATUS} from '../format';
import {LessonRecap} from './LessonRecap';
function TimelineEntry({lesson,first,tutor}) {
  const [open,setOpen]=useState(first);
  const data=useLoad(()=>open?api.lessonRoom(lesson.id):Promise.resolve(null),[lesson.id,open]);
  return <article className="learning-timeline-entry"><div className="learning-timeline-date"><span>{shortDate(lesson.starts_at)}</span><small>{time(lesson.starts_at)}</small></div><div className="learning-timeline-content"><div className="row-between wrap"><h3>{lesson.topic||'Занятие'}</h3><Badge tone={LESSON_STATUS[lesson.status]?.tone}>{LESSON_STATUS[lesson.status]?.label||lesson.status}</Badge></div>
  {lesson.summary&&!open&&<p className="learning-timeline-summary">{lesson.summary}</p>}
  <div className="row wrap"><button className="btn btn-secondary btn-sm" aria-expanded={open} onClick={()=>setOpen(!open)}>{open?'Свернуть':'Итог, материалы и домашка'}</button>{tutor&&lesson.status==='scheduled'&&<Link className="btn btn-secondary btn-sm" to={`/lesson/${lesson.id}`}>Подвести итог</Link>}</div>
  {open&&<div className="learning-timeline-detail">{data.loading?<Spinner/>:data.error?<ErrorBox error={data.error} onRetry={data.reload}/>:data.data&&<LessonRecap lesson={data.data} tutor={tutor}/>}</div>}</div></article>;
}
export default function LessonTimeline({lessons,tutor=false}) {
  const [limit,setLimit]=useState(5);
  return <section className="panel lesson-history"><div className="panel-head"><div><h2 className="section-title">История обучения</h2><p className="small muted">Что прошли → материалы урока → домашняя работа.</p></div><span className="badge">{lessons.length}</span></div>{!lessons.length?<p className="small muted">Здесь появятся занятия, их итоги и связанные домашние работы.</p>:<><div className="learning-timeline">{lessons.slice(0,limit).map((l,i)=><TimelineEntry key={l.id} lesson={l} first={i===0} tutor={tutor}/>)}</div>{lessons.length>limit&&<button className="btn btn-secondary" onClick={()=>setLimit(n=>n+5)}>Ещё занятия</button>}</>}</section>;
}
