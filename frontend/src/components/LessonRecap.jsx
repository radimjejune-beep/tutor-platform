import {useEffect} from 'react';
import {api} from '../api';
import {useLoad,Link,ErrorBox} from '../ui';
import {shortDate,time} from '../format';
import './expedition.css';
export function LessonRecap({lesson:l,tutor=false,compact=false}){
 useEffect(()=>{if(l.subject&&l.student_id)window.dispatchEvent(new CustomEvent('lf-study-direction',{detail:{studentId:l.student_id,subject:l.subject}}));},[l.id,l.subject]);
 const newLink=`/homework/new?lesson=${l.id}&student=${l.student_id}&subject=${encodeURIComponent(l.subject||'')}`;
 return <section className="lesson-recap" aria-label="Итоги занятия и домашняя работа"><span className="meta-label">{l.subject||'Занятие'} · {shortDate(l.starts_at)} · {time(l.starts_at)}</span><h2>{l.topic||'Что прошли на занятии'}</h2>
 <div className="lesson-recap-summary">{l.summary||'Преподаватель ещё не добавил краткие итоги занятия.'}</div>
 {!!l.items?.length&&<><p className="small muted" style={{marginBottom:0}}>Материалы занятия</p><div className="lesson-recap-items">{l.items.map(i=><Link key={i.id} to={`/lesson/${l.id}`}>{i.title}</Link>)}</div></>}
 <div className="row" style={{marginTop:16}}><Link className="btn btn-secondary btn-sm" to={`/lesson/${l.id}`}>Вспомнить занятие</Link>{tutor&&!compact&&<Link className="btn btn-sm" to={newLink}>Домашка после этого урока</Link>}</div>
 {!!l.homework?.length&&!compact&&<div style={{marginTop:18}}><h3 className="section-title">После урока — сделать дома</h3><div className="list">{l.homework.map(h=><Link key={h.id} className="list-item clickable" to={tutor?`/homework/${h.assignment_id}`:`/homework/${h.id}`}><span className="list-title">{h.title}</span><span className="small muted">{h.status==='checked'?'Проверено':h.status==='submitted'?'На проверке':'Выполнить'}{h.due_on?` · до ${shortDate(h.due_on)}`:''}</span></Link>)}</div></div>}
 </section>;
}
export function HomeworkRecap({homework,tutor=false}){
 const d=useLoad(()=>homework.lesson_id?api.lessonRoom(homework.lesson_id):Promise.resolve(null),[homework.lesson_id]);
 if(!homework.lesson_id||d.loading)return null;if(d.error)return <ErrorBox error={d.error} onRetry={d.reload}/>;if(!d.data)return null;
 return <details className="lesson-recap" open={homework.status==='assigned'}><summary>Вспомнить урок перед домашкой · {d.data.subject}</summary><LessonRecap lesson={d.data} tutor={tutor} compact/></details>;
}
