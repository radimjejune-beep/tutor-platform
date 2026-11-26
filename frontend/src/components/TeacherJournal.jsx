import {useEffect,useRef,useState} from 'react';
import {api} from '../api';
import {Badge,ErrorBox,Field,Icon,Link,Modal,Spinner,useLoad,useSubmit,useToast,readDraft,clearDraft,useDraftSave,DraftNotice} from '../ui';
import {todayISO,dayMonth,weekday,cap} from '../format';
import {readWorkspace,saveWorkspace} from '../workspace-state';
import TodayLessons from './TodayLessons';
import './teacher-journal.css';
const timezone=()=>Intl.DateTimeFormat().resolvedOptions().timeZone;
const dateObject=day=>new Date(day+'T12:00:00');
const nextDay=(day,step=1)=>{const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+step);return d.toISOString().slice(0,10);};

export default function TeacherJournal({dashboard,onChanged,onOpenLesson}){
 const [today,setToday]=useState(todayISO),[date,setDate]=useState(()=>{const p=readWorkspace('journal-day',{});return p.anchor===todayISO()&&/^20\d{2}-\d{2}-\d{2}$/.test(p.date||'')?p.date:todayISO();});
 const [hand,setHand]=useState(()=>readWorkspace('journal-appearance',{hand:true}).hand!==false),[view,setView]=useState('lessons');
 const [compact,setCompact]=useState(()=>matchMedia('(max-width:760px)').matches),[planning,setPlanning]=useState(null),[overrides,setOverrides]=useState({});
 const history=useLoad(()=>dashboard.date===date?Promise.resolve(null):api.dashboard({date,timezone:timezone()}),[date,dashboard.date]);
 useEffect(()=>setOverrides(previous=>Object.keys(previous).length?{}:previous),[dashboard.today,history.data]);
 useEffect(()=>{const media=matchMedia('(max-width:760px)'),changed=()=>setCompact(media.matches);media.addEventListener('change',changed);return()=>media.removeEventListener('change',changed);},[]);
 useEffect(()=>{const tick=()=>{const day=todayISO();setToday(previous=>{if(previous!==day){setDate(value=>value===previous?day:value);}return day;});};const timer=setInterval(tick,60000);window.addEventListener('focus',tick);return()=>{clearInterval(timer);window.removeEventListener('focus',tick);};},[]);
 useEffect(()=>saveWorkspace('journal-day',{date,anchor:today}),[date,today]);
 useEffect(()=>{saveWorkspace('journal-appearance',{hand});},[hand]);
 const data=dashboard.date===date?dashboard:history.data?.date===date?history.data:null;
 const lessons=(data?.today||[]).map(l=>overrides[l.id]===undefined?l:{...l,private_notes:overrides[l.id]});
 const count=new Set(lessons.map(l=>l.group_id?`${l.group_id}:${l.starts_at}`:l.id)).size;
 const changeDate=value=>{if(/^20\d{2}-\d{2}-\d{2}$/.test(value))setDate(value);};
 const lessonChanged=()=>{history.reload();onChanged();};
 return <section className={`teacher-journal ${hand?'handwritten':''}`} aria-label="Ежедневник преподавателя">
  <div className="journal-toolbar"><div><span className="journal-caption">Личное рабочее пространство</span><h2>Мой ежедневник</h2></div><div className="journal-toolbar-actions"><button type="button" className="btn btn-quiet btn-sm" aria-pressed={hand} onClick={()=>setHand(v=>!v)}>Рукописный вид</button><Link to="/schedule" className="btn btn-secondary btn-sm">Вся неделя</Link></div></div>
  <div className="journal-datebar"><div className="journal-date-controls"><button className="icon-btn" type="button" aria-label="Предыдущий день" disabled={date<='2000-01-01'} onClick={()=>setDate(nextDay(date,-1))}><Icon name="back"/></button><label className="journal-date-input"><span className="sr-only">Дата ежедневника</span><input className="input" type="date" min="2000-01-01" max="2099-12-31" value={date} onChange={e=>changeDate(e.target.value)}/></label><button className="icon-btn" type="button" aria-label="Следующий день" disabled={date>='2099-12-31'} onClick={()=>setDate(nextDay(date))}><Icon name="chevron-right" size={18}/></button><button type="button" className="btn btn-quiet btn-sm" disabled={date===today} onClick={()=>setDate(today)}>Сегодня</button></div><p className="small muted">Личные дела и планы видите только вы</p></div>
  {compact&&<div className="journal-page-switch" aria-label="Страницы ежедневника"><button type="button" className={`btn btn-sm ${view==='lessons'?'':'btn-secondary'}`} aria-pressed={view==='lessons'} onClick={()=>setView('lessons')}>Занятия</button><button type="button" className={`btn btn-sm ${view==='personal'?'':'btn-secondary'}`} aria-pressed={view==='personal'} onClick={()=>setView('personal')}>Мои дела и заметки</button></div>}
  <div className="journal-book">
   <div className="journal-page journal-lessons" hidden={compact&&view!=='lessons'}><header className="journal-page-heading"><div><span className="journal-caption">{cap(weekday(dateObject(date)))}</span><h3 className="journal-hand">{dayMonth(dateObject(date))}</h3></div><Badge>{history.loading&&dashboard.date!==date?'Загружаем…':`Занятий: ${count}`}</Badge></header>
    {history.loading&&dashboard.date!==date?<div className="journal-loading"><Spinner/></div>:history.error&&dashboard.date!==date?<ErrorBox error={history.error} onRetry={history.reload}/>:<TodayLessons lessons={lessons} journal onPlan={setPlanning} onChanged={lessonChanged} onOpenLesson={onOpenLesson}/>}
    {!history.loading&&!lessons.length&&<p className="journal-caption">Запишите личные дела справа или добавьте занятие через кнопку вверху страницы.</p>}
   </div>
   <div className="journal-page journal-personal" hidden={compact&&view!=='personal'}><header className="journal-page-heading"><div><span className="journal-caption">Только для вас</span><h3 className="journal-hand">Дела и мысли</h3></div><Icon name="note" size={22}/></header><PersonalDay key={date} date={date}/></div>
  </div>
  {planning&&<PlanModal lesson={planning} onClose={()=>setPlanning(null)} onSaved={text=>{setOverrides(old=>{const patch={...old};for(const l of lessons)if(planning.group_id?l.group_id===planning.group_id&&l.starts_at===planning.starts_at:l.id===planning.id)patch[l.id]=text;return patch;});setPlanning(current=>current?.id===planning.id?null:current);if(dashboard.date===date)onChanged();else history.reload();}}/>}
 </section>;
}

function PersonalDay({date}){
 const [entries,setEntries]=useState(null),[error,setError]=useState(''),[editing,setEditing]=useState(null),[refresh,setRefresh]=useState(0),[busy,setBusy]=useState(()=>new Set()),toast=useToast();
 const draftKey='journal-personal:'+date,[draft]=useState(()=>readDraft(draftKey)),[text,setText]=useState(draft?.value?.text||''),[kind,setKind]=useState(draft?.value?.kind||'task');
 useDraftSave(draftKey,{text,kind},Boolean(text.trim()));
 useEffect(()=>{let alive=true;setError('');api.journal({date,timezone:timezone()}).then(r=>{if(alive)setEntries(r.entries);}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[date,refresh]);
 const add=useSubmit(async()=>{const entry=await api.createJournalEntry({date,kind,body:text});setEntries(list=>[...(list||[]),entry]);setText('');clearDraft(draftKey);toast(kind==='task'?'Дело записано':'Заметка записана');});
 const change=async(entry,patch)=>{setBusy(old=>new Set([...old,entry.id]));setError('');if(typeof patch.done==='boolean')setEntries(list=>list.map(item=>item.id===entry.id?{...item,done:patch.done}:item));try{const updated=await api.updateJournalEntry(entry.id,{...patch,version:entry.version});setEntries(list=>list.flatMap(item=>item.id!==entry.id?[item]:updated.day===date?[updated]:[]));if(patch.date)toast('Перенесено на '+dayMonth(dateObject(patch.date)));}catch(e){if(typeof patch.done==='boolean')setEntries(list=>list.map(item=>item.id===entry.id?entry:item));setError(e.message);}finally{setBusy(old=>{const next=new Set(old);next.delete(entry.id);return next;});}};
 const remove=async entry=>{if(!window.confirm('Удалить эту запись из вашего ежедневника?'))return;setBusy(old=>new Set([...old,entry.id]));setError('');try{await api.deleteJournalEntry(entry.id,entry.version);setEntries(list=>list.filter(item=>item.id!==entry.id));toast('Запись удалена');}catch(e){setError(e.message);}finally{setBusy(old=>{const next=new Set(old);next.delete(entry.id);return next;});}};
 const menuAction=(event,fn)=>{event.currentTarget.closest('details').open=false;fn();};
 return <div className="journal-personal-content">
  {error&&<ErrorBox error={error} onRetry={()=>setRefresh(v=>v+1)}/>}
  {entries===null&&!error?<Spinner/>:<div className="journal-entries" aria-live="polite">{entries?.length?entries.map(entry=><article key={entry.id} className={`journal-entry ${entry.done?'done':''}`}>
   {entry.kind==='task'?<input className="journal-check" type="checkbox" aria-label={'Выполнено: '+entry.body.slice(0,100)} checked={entry.done} disabled={busy.has(entry.id)} onChange={e=>change(entry,{done:e.target.checked})}/>:<span className="journal-note-mark" aria-hidden="true">·</span>}
   <p className={`journal-hand ${entry.body.length>180?'long':''}`}>{entry.body}</p><details className="journal-entry-menu" onKeyDown={e=>{if(e.key==='Escape'){e.currentTarget.open=false;e.currentTarget.querySelector('summary').focus();}}}><summary aria-label={'Действия с записью: '+entry.body.slice(0,50)}>•••</summary><div><button type="button" disabled={busy.has(entry.id)} onClick={e=>menuAction(e,()=>setEditing(entry))}>Править или перенести</button>{entry.kind==='task'&&!entry.done&&date<'2099-12-31'&&<button type="button" disabled={busy.has(entry.id)} onClick={e=>menuAction(e,()=>change(entry,{date:nextDay(date)}))}>{date===todayISO()?'Перенести на завтра':'На следующий день'}</button>}<button type="button" disabled={busy.has(entry.id)} onClick={e=>menuAction(e,()=>remove(entry))}>Удалить</button></div></details>
  </article>):<p className="journal-empty journal-hand">Здесь место для ваших дел и идей.</p>}</div>}
  <form className="journal-add-form" onSubmit={add.submit}><label className="field">Новая запись<select className="select" aria-label="Вид личной записи" value={kind} onChange={e=>setKind(e.target.value)}><option value="task">Дело с отметкой о выполнении</option><option value="note">Личная заметка</option></select></label><label className="field"><span className="sr-only">Текст личной записи</span><textarea className="textarea" rows={3} required maxLength={4000} value={text} onChange={e=>setText(e.target.value)} placeholder="Что хочется сделать или сохранить?" onKeyDown={e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();e.currentTarget.form.requestSubmit();}}}/></label>{add.error&&<ErrorBox error={add.error}/>}<button className="btn btn-secondary" disabled={add.busy||!text.trim()||entries===null}>{add.busy?'Записываем…':'Записать в мой день'}</button><p className="journal-caption">Не попадает в кабинет ученика и не отправляется в уведомления.</p></form>
  {editing&&<EntryModal entry={editing} onClose={()=>setEditing(null)} onSaved={entry=>{setEntries(list=>list.flatMap(item=>item.id!==entry.id?[item]:entry.day===date?[entry]:[]));setEditing(null);}}/>}
 </div>;
}
function EntryModal({entry,onClose,onSaved}){
 const [body,setBody]=useState(entry.body),[date,setDate]=useState(entry.day),toast=useToast(),save=useSubmit(async()=>{const changed=await api.updateJournalEntry(entry.id,{body,date,version:entry.version});toast(date===entry.day?'Запись сохранена':'Запись перенесена');onSaved(changed);});
 return <Modal title="Личная запись" onClose={onClose}><form className="form" onSubmit={save.submit}><Field label="Дата"><input type="date" className="input" required min="2000-01-01" max="2099-12-31" value={date} onChange={e=>setDate(e.target.value)}/></Field><Field label="Текст"><textarea className="textarea" required rows={5} maxLength={4000} value={body} onChange={e=>setBody(e.target.value)}/></Field>{save.error&&<ErrorBox error={save.error}/>}<div className="row wrap"><button className="btn" disabled={save.busy}>{save.busy?'Сохраняем…':'Сохранить запись'}</button><button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button></div></form></Modal>;
}
function PlanModal({lesson,onClose,onSaved}){
 const key='journal-plan:'+lesson.id,[draft]=useState(()=>readDraft(key)),[text,setText]=useState(draft?.value?.text??lesson.private_notes??''),toast=useToast();
 useDraftSave(key,{text},text!==(lesson.private_notes||''));
 const save=useSubmit(async()=>{const value=text.trim()||null;if(lesson.group_id)await api.updateGroupPlan(lesson.group_id,{starts_at:lesson.starts_at,private_notes:value});else await api.updateLesson(lesson.id,{private_notes:value});clearDraft(key);toast('План сохранён в ежедневнике');onSaved(value);});
 return <Modal title={'План занятия · '+(lesson.group_name||lesson.student_name)} onClose={onClose}><form className="form" onSubmit={save.submit}><DraftNotice at={draft?.at} onReset={()=>{clearDraft(key);setText(lesson.private_notes||'');}}/><Field label="Что планируем на уроке" hint="Только для вас. Эта запись не меняет статус урока и не видна ученику или родителю."><textarea className="textarea" rows={7} maxLength={5000} value={text} onChange={e=>setText(e.target.value)} placeholder="Повторить прошлую тему, разобрать вопросы, оставить время на практику…"/></Field>{lesson.group_id&&<p className="small muted">Общий план сохранится для всех участников этого занятия группы.</p>}{save.error&&<ErrorBox error={save.error}/>}<div className="row wrap"><button className="btn" disabled={save.busy}>{save.busy?'Сохраняем…':'Сохранить план'}</button><button className="btn btn-secondary" type="button" onClick={onClose}>Отмена</button></div></form></Modal>;
}
