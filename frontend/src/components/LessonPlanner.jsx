import {useState} from 'react';
import {api} from '../api';
import {useLoad,Spinner,ErrorBox,Link,Field,readDraft,writeDraft,clearDraft} from '../ui';
import LibraryItem from './LibraryItem';
import {TopicChooser} from '../pages/learning/Coach';

export default function LessonPlanner({student}) {
 const options=useLoad(()=>api.preparationOptions(student.id),[student.id]);
 const [duration,setDuration]=useState(student.default_duration||60),[topics,setTopics]=useState([]),[manual,setManual]=useState(false),[plan,setPlan]=useState(null),[lesson,setLesson]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[recovery,setRecovery]=useState(false);
 const key=`preparation:${student.id}`,persist=p=>{setPlan(p);writeDraft(key,p);setMessage('Есть несохранённые изменения');};
 const open=async id=>{setBusy(true);setError('');try{const p=await api.preparation(id),local=readDraft(key)?.value;if(local?.id===p.id&&!p.applied_at){if(local.version===p.version){setPlan(local);setMessage('Восстановлены изменения из этого браузера');}else{setPlan(p);setRecovery(true);}}else setPlan(p);}catch(e){setError(e.message);}finally{setBusy(false);}};
 const generate=async()=>{setBusy(true);setError('');try{const p=await api.prepareLesson(student.id,{duration:Number(duration),topic_ids:topics});setPlan(p);clearDraft(key);setMessage('Черновик создан. Проверьте материалы и длительность этапов.');options.reload();}catch(e){setError(e.message);}finally{setBusy(false);}};
 const saved=async()=>{
  const p=await api.savePreparation(plan.id,{version:plan.version,title:plan.title,stages:plan.stages.map(s=>({id:s.id,title:s.title,minutes:Number(s.minutes),selected:s.selected,note:s.note,material_id:s.material_id||null,...(s.source.type==='generated'?{body:s.source.item.body||''}:{})}))});setPlan(p);clearDraft(key);setMessage('Изменения сохранены');return p;
 };
 const save=async()=>{setBusy(true);setError('');try{await saved();options.reload();}catch(e){setError(e.message);}finally{setBusy(false);}};
 const apply=async()=>{setBusy(true);setError('');try{const p=await saved();const r=await api.applyPreparation(p.id,{version:p.version,lesson_id:Number(lesson)});setPlan(await api.preparation(p.id));setMessage(r.again?'План уже добавлен в это занятие':`План добавлен. Новых материалов: ${r.added}`);clearDraft(key);options.reload();}catch(e){setError(e.message);}finally{setBusy(false);}};
 const stage=(id,patch)=>persist({...plan,stages:plan.stages.map(s=>s.id===id?{...s,...patch}:s)});
 const move=(i,d)=>{const next=[...plan.stages],j=i+d;if(j<0||j>=next.length)return;[next[i],next[j]]=[next[j],next[i]];persist({...plan,stages:next});};
 const total=plan?.stages.filter(s=>s.selected).reduce((n,s)=>n+Number(s.minutes||0),0)||0;
 return <section className="panel planner" style={{marginTop:28}} aria-label="План следующего занятия"><div className="meta-label">Подготовка к уроку</div><h2 className="section-title">Черновик следующего занятия</h2><p className="muted">Помощник учитывает последние проверки, слова для повторения, текущий юнит и вашу библиотеку. Материалы добавляются в урок после вашей проверки.</p>
  <div className="row wrap"><Field label="Длительность, минут"><input aria-label="Длительность, минут" className="input" type="number" min="20" max="120" value={duration} onChange={e=>setDuration(e.target.value)}/></Field><button className="btn" disabled={busy||duration<20||duration>120} onClick={generate}>{busy?'Подождите…':'Составить черновик'}</button><button className="btn btn-secondary" onClick={()=>setManual(!manual)}>Выбрать темы вручную</button></div>
  {topics.length>0&&<p>Выбрано тем: {topics.length} <button className="btn btn-quiet btn-sm" onClick={()=>setTopics([])}>Использовать результаты проверок</button></p>}
  {manual&&<TopicChooser busy={topics.length>=2} onChoose={id=>setTopics(v=>[...new Set([...v,id])].slice(0,2))}/>}
  {options.loading?<Spinner/>:options.error?<ErrorBox error={options.error} onRetry={options.reload}/>:<Field label="Сохранённые черновики"><select aria-label="Сохранённые черновики" className="select" value={plan?.id||''} onChange={e=>{if(e.target.value)open(e.target.value);}}><option value="">Открыть черновик</option>{options.data.drafts.map(p=><option key={p.id} value={p.id}>{p.title} · {p.duration} мин{p.applied_at?' · добавлен в урок':''}</option>)}</select></Field>}
  {readDraft(key)?.value&&!plan&&<button className="btn btn-secondary" disabled={busy} onClick={()=>open(readDraft(key).value.id)}>Продолжить локальный черновик</button>}
  {recovery&&<div className="alert">Черновик изменён в другой вкладке. Открыта серверная версия. <details><summary>Мои несохранённые заметки</summary><div className="instructions">{readDraft(key)?.value?.stages.map(s=>`${s.title}\n${s.note}\n${s.source.item?.body||''}`).join('\n\n')}</div></details></div>}
  {plan&&<>
   <details style={{margin:'18px 0'}}><summary>Почему предложен такой план</summary>{plan.reasons.map((r,i)=><p key={i}><b>{r.title}</b><br/>{r.reason}{r.source&&<> · {new Date(r.source.at).toLocaleDateString('ru-RU')}{r.source.link&&<> · <Link to={r.source.link}>Источник</Link></>}</>}</p>)}</details>
   <fieldset className="learning-fieldset" disabled={busy||!!plan.applied_at}><Field label="Название плана"><input aria-label="Название плана" className="input" maxLength="255" value={plan.title} onChange={e=>persist({...plan,title:e.target.value})}/></Field>
    {plan.stages.map((s,i)=><details className="planner-stage" key={s.id} open={i===0}><summary><b>{s.title}</b> · {s.minutes} мин{s.selected?'':' · выключен'}</summary><div style={{marginTop:14}}><div className="row-between wrap"><label className="row"><input type="checkbox" checked={s.selected} onChange={e=>stage(s.id,{selected:e.target.checked})}/>Включить этап</label><div className="row"><button className="btn btn-quiet btn-sm" type="button" aria-label={`Выше: ${s.title}`} disabled={i===0} onClick={()=>move(i,-1)}>↑</button><button className="btn btn-quiet btn-sm" type="button" aria-label={`Ниже: ${s.title}`} disabled={i===plan.stages.length-1} onClick={()=>move(i,1)}>↓</button></div></div>
     <div className="planner-fields"><Field label="Этап"><input aria-label="Этап" className="input" maxLength="255" value={s.title} onChange={e=>stage(s.id,{title:e.target.value})}/></Field><Field label="Минут"><input aria-label="Минут" className="input" type="number" min="1" max="120" value={s.minutes} onChange={e=>stage(s.id,{minutes:e.target.value})}/></Field></div>
     <p className="small"><b>Материал: </b>{s.source.title||s.source.item?.title}</p><MaterialPreview id={s.material_id} item={s.source.type==='generated'?s.source.item:plan.previews?.[s.id]}/>
     <Field label="Заменить своим материалом"><select aria-label="Заменить своим материалом" className="select" value={s.material_id||''} onChange={e=>stage(s.id,{material_id:Number(e.target.value)||null})}><option value="">Оставить предложенный материал</option>{options.data?.materials.map(m=><option value={m.id} key={m.id}>{m.title}</option>)}</select></Field>
     {s.source.type==='generated'&&!s.material_id&&<Field label="Текст материала"><textarea aria-label="Текст материала" className="textarea" maxLength="12000" value={s.source.item.body||''} onChange={e=>stage(s.id,{source:{...s.source,item:{...s.source.item,body:e.target.value}}})}/></Field>}
     <Field label="Заметки к этапу — только преподавателю"><textarea aria-label="Заметки к этапу — только преподавателю" className="textarea" maxLength="3000" value={s.note} onChange={e=>stage(s.id,{note:e.target.value})}/></Field>
    </div></details>)}
   </fieldset><p><b>Итого: {total} минут</b></p>
   {plan.applied_at?<Link className="btn" to={`/lesson/${plan.applied_lesson_id}`}>Открыть подготовленное занятие</Link>:<><div className="row wrap"><button className="btn btn-secondary" disabled={busy||total<20||total>120} onClick={save}>Сохранить изменения</button><label className="live-choice">Занятие для плана<select className="select" value={lesson} onChange={e=>setLesson(e.target.value)}><option value="">Выберите будущее занятие</option>{options.data?.lessons.map(l=><option key={l.id} value={l.id}>{new Date(l.starts_at).toLocaleString('ru-RU')} · {l.duration_min} мин · {l.topic||'Занятие'}</option>)}</select></label><button className="btn" disabled={busy||!lesson||total<20||total>120} onClick={apply}>Сохранить и добавить в урок</button></div><p className="small muted">Материалы будут добавлены к существующим. План этапов останется в заметках преподавателя. Для группы подготовьте материалы в общем уроке.</p>{options.data&&!options.data.lessons.length&&<Link to={`/students/${student.id}/lessons`}>Сначала запланировать занятие →</Link>}</>}
  </>}
  {message&&<p role="status" className="small muted">{message}</p>}{error&&<div role="alert" className="alert">{error}</div>}
 </section>;
}

function MaterialPreview({id,item}) {
 const [opened,setOpened]=useState(false);
 return <details onToggle={e=>setOpened(e.currentTarget.open)}><summary>Просмотреть материал и задания</summary>{opened&&(id?<OwnPreview key={id} id={id}/>:item?<LibraryItem item={item}/>:<p className="muted">Сохраните и заново откройте черновик, чтобы загрузить материал.</p>)}</details>;
}
function OwnPreview({id}) {const data=useLoad(()=>api.libraryItem(id),[id]);return data.loading?<Spinner/>:data.error?<ErrorBox error={data.error} onRetry={data.reload}/>:<LibraryItem item={data.data}/>;}
