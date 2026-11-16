import {useState} from 'react';
import {api} from '../api';
import {useLoad,Spinner,ErrorBox,Empty,Badge,Icon,Link,Modal,Field,useToast} from '../ui';
import {SectionPicker} from './StudySections';
import {HW_STATUS,shortDate,plural} from '../format';

export default function StudentHomework({student}) {
 const hw=useLoad(()=>api.homework({student_id:student.id}),[student.id]);
 const sections=useLoad(()=>api.studySections(),[]),toast=useToast();
 const [active,setActive]=useState('all'),[q,setQ]=useState(''),[status,setStatus]=useState('all'),[picked,setPicked]=useState([]);
 const [dialog,setDialog]=useState(null),[creating,setCreating]=useState(false);
 const items=hw.data||[],known=new Map((sections.data||[]).map(s=>[s.id,s]));
 for(const h of items)if(h.section_id&&!known.has(h.section_id))known.set(h.section_id,{id:h.section_id,title:h.section_title||'Раздел'});
 const ids=new Set(items.map(h=>h.section_id).filter(Boolean));if(active!=='all'&&active!=='0')ids.add(Number(active));
 const groups=[...known.values()].filter(s=>ids.has(s.id));
 const visible=items.filter(h=>(active==='all'||String(h.section_id||0)===active)&&(status==='all'||h.status===status)&&[h.title,h.section_title].filter(Boolean).join(' ').toLowerCase().includes(q.toLowerCase()));
 const toggle=id=>setPicked(prev=>prev.includes(id)?prev.filter(x=>x!==id):prev.length<200?[...prev,id]:prev);
 const moved=target=>{setDialog(null);setPicked([]);setActive(String(target||0));hw.reload();sections.reload();toast('Раздел заданий обновлён');};
 return <section className="panel">
  <div className="panel-head row wrap"><h2 className="section-title">Задания ученика</h2><div className="row wrap" style={{gap:8}}>
   <button type="button" className="btn btn-secondary btn-sm" onClick={()=>setCreating(true)}>Новый раздел</button>
   <Link to={`/homework/new?student=${student.id}`} className="btn btn-sm"><Icon name="plus"/> Задание</Link>
  </div></div>
  <p className="small muted">Распределяйте уже выданные задания по темам. Перенос действует только для этого ученика; ответы и оценки сохраняются.</p>
  {sections.error&&<ErrorBox error={sections.error} onRetry={sections.reload}/>}
  <div className="row wrap section-filter" role="group" aria-label="Разделы заданий ученика" style={{gap:8}}>
   {[{id:'all',title:'Все задания'},...groups,{id:0,title:'Без раздела'}].map(s=><button type="button" key={s.id} className={`btn btn-sm ${active===String(s.id)?'':'btn-secondary'}`} aria-pressed={active===String(s.id)} onClick={()=>{setActive(String(s.id));setPicked([]);}}>{s.title} · {s.id==='all'?items.length:items.filter(h=>String(h.section_id||0)===String(s.id)).length}</button>)}
  </div>
  <div className="row wrap" style={{gap:8,margin:'16px 0'}}>
   <input type="search" className="input" style={{maxWidth:320}} aria-label="Поиск заданий ученика" placeholder="Найти задание…" value={q} onChange={e=>setQ(e.target.value)}/>
   <select className="select" style={{width:'auto',maxWidth:'100%'}} aria-label="Статус заданий ученика" value={status} onChange={e=>setStatus(e.target.value)}><option value="all">Все статусы</option>{Object.entries(HW_STATUS).map(([key,s])=><option key={key} value={key}>{s.label}</option>)}</select>
   {active!=='all'&&<button type="button" className="btn btn-secondary btn-sm" disabled={!items.some(h=>String(h.section_id||0)!==active)} onClick={()=>setDialog({mode:'add',target:Number(active)||null})}>Добавить выданные задания</button>}
  </div>
  {hw.loading?<Spinner/>:hw.error?<ErrorBox error={hw.error} onRetry={hw.reload}/>:<>
   {visible.length>0&&<div className="row wrap" style={{gap:8,marginBottom:12}}>
    <button type="button" className="btn btn-quiet btn-sm" onClick={()=>setPicked(visible.slice(0,200).map(h=>h.id))}>Выбрать все в списке</button>
    {picked.length>0&&<><span className="small">Выбрано: {picked.length}</span><button type="button" className="btn btn-sm" onClick={()=>setDialog({mode:'move',ids:picked,target:active==='all'?null:Number(active)||null})}>Перенести выбранные</button><button type="button" className="btn btn-quiet btn-sm" onClick={()=>setPicked([])}>Снять выбор</button></>}
   </div>}
   {!visible.length&&<Empty title={items.length?'В этом разделе пока нет подходящих заданий':'Заданий пока нет'}>Добавьте выданные задания в раздел или создайте новое.</Empty>}
   {visible.map(h=><div key={h.id} className="student-homework-row">
    <input type="checkbox" aria-label={`Выбрать задание «${h.title}»`} checked={picked.includes(h.id)} onChange={()=>toggle(h.id)}/>
    <Link className="student-homework-main" to={`/homework/${h.assignment_id}/review/${h.id}`}><b>{h.title}</b><span className="small muted">{h.section_title||'Без раздела'} · {h.due_on?`До ${shortDate(h.due_on)}`:'Без срока'}</span></Link>
    <Badge tone={h.status==='checked'?'green':HW_STATUS[h.status].tone}>{h.status==='checked'&&h.score!==null?`${h.score}%`:HW_STATUS[h.status].label}</Badge>
    <button type="button" className="btn btn-secondary btn-sm" aria-label={`Перенести задание «${h.title}»`} onClick={()=>setDialog({mode:'move',ids:[h.id],target:h.section_id})}>Перенести</button>
   </div>)}
  </>}
  {creating&&<CreateSection onClose={()=>setCreating(false)} onCreated={s=>{setCreating(false);setActive(String(s.id));sections.reload();}}/>}
  {dialog&&<MoveHomework key={`${dialog.mode}-${dialog.target}-${dialog.ids?.join(',')}`} student={student} items={items} dialog={dialog} onClose={()=>setDialog(null)} onDone={moved}/>}
 </section>;
}
function CreateSection({onClose,onCreated}) {
 const [title,setTitle]=useState(''),[grammar,setGrammar]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const topics=useLoad(()=>api.grammarTopics(),[]);
 const save=async e=>{e.preventDefault();setBusy(true);setError('');try{onCreated(await api.createStudySection({title:title.trim(),grammar_key:grammar||null}));}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <Modal title="Новый раздел" onClose={onClose}><form className="form" onSubmit={save}>
  <Field label="Название раздела"><input className="input" aria-label="Название раздела" value={title} maxLength={160} onChange={e=>setTitle(e.target.value)} placeholder="Например, Present Simple" autoFocus required/></Field>
  <Field label="Объяснение грамматики"><select className="select" aria-label="Грамматика раздела" value={grammar} onChange={e=>setGrammar(e.target.value)}><option value="">Не привязывать</option>{(topics.data||[]).map(t=><option key={t.id} value={t.id}>{t.label||t.title}</option>)}</select></Field>
  {topics.error&&<ErrorBox error={topics.error} onRetry={topics.reload}/>}
  <p className="small muted">После создания добавьте в раздел уже выданные задания. Ученик увидит раздел, когда в нём появятся его работы.</p>
  {error&&<div className="alert" role="alert">{error}</div>}
  <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button><button type="submit" className="btn" disabled={busy||!title.trim()}>Создать раздел</button></div>
 </form></Modal>;
}
function MoveHomework({student,items,dialog,onClose,onDone}) {
 const [target,setTarget]=useState(dialog.target||null),[ids,setIds]=useState(dialog.ids||[]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const candidates=items.filter(h=>h.section_id!==dialog.target),[q,setQ]=useState('');
 const save=async()=>{setBusy(true);setError('');try{await api.moveStudentHomework(student.id,{homework_ids:ids,section_id:target});onDone(target);}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <Modal title={dialog.mode==='add'?'Добавить выданные задания':'Перенести задания'} onClose={onClose} wide>
  <p className="small muted">Меняется только раздел работ этого ученика. Сданные ответы, файлы и результаты сохранятся.</p>
  {dialog.mode==='add'?<>
   <input type="search" className="input" aria-label="Найти выданное задание" placeholder="Найти задание…" value={q} onChange={e=>setQ(e.target.value)}/>
   <div className="learning-topic-picker">{candidates.filter(h=>h.title.toLowerCase().includes(q.toLowerCase())).map(h=><label className="check" key={h.id}><input type="checkbox" checked={ids.includes(h.id)} onChange={()=>setIds(prev=>prev.includes(h.id)?prev.filter(x=>x!==h.id):prev.length<200?[...prev,h.id]:prev)}/><span>{h.title}<small className="muted" style={{display:'block'}}>{h.section_title||'Без раздела'} · {HW_STATUS[h.status].label}</small></span></label>)}</div>
  </>:<SectionPicker value={target} onChange={setTarget}/>}
  <p className="small muted">Выбрано {ids.length} {plural(ids.length,'задание','задания','заданий')}. За один перенос — до 200.</p>
  {error&&<div className="alert" role="alert">{error}</div>}
  <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button><button type="button" className="btn" disabled={busy||!ids.length} onClick={save}>{busy?'Переносим…':'Сохранить раздел заданий'}</button></div>
 </Modal>;
}
