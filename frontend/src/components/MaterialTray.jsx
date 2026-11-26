import {useEffect,useState} from 'react';
import {useAuth} from '../auth';
import {api} from '../api';
import {useLoad,Modal,Link,Spinner,ErrorBox,navigate} from '../ui';
import {normalizeTray} from '../learning-flow.js';
import {shortDate,time} from '../format';
const key=id=>`lf-material-tray:${id}`;
const memory=new Map();
const read=id=>{try{const raw=sessionStorage.getItem(key(id));if(raw!==null)memory.set(id,normalizeTray(JSON.parse(raw)));}catch{}return memory.get(id)||[];};
export function useMaterialTray() {
  const {user}=useAuth(),[items,setItems]=useState(()=>read(user.id));
  useEffect(()=>{setItems(read(user.id));const update=e=>{if(e.detail===user.id)setItems(read(user.id));};window.addEventListener('lf-material-tray',update);return()=>window.removeEventListener('lf-material-tray',update);},[user.id]);
  const update=fn=>{const next=normalizeTray(fn(read(user.id)));memory.set(user.id,next);try{sessionStorage.setItem(key(user.id),JSON.stringify(next));}catch{}setItems(next);window.dispatchEvent(new CustomEvent('lf-material-tray',{detail:user.id}));};
  return {items,has:(source,id)=>items.some(i=>i.source===source&&i.id===Number(id)),toggle:(source,item)=>update(old=>old.some(i=>i.source===source&&i.id===Number(item.id))?old.filter(i=>i.source!==source||i.id!==Number(item.id)):[...old,{source,id:Number(item.id),title:item.title,kind:item.kind}]),restore:items=>update(()=>items),clear:()=>update(()=>[]),clearSource:source=>update(old=>old.filter(i=>i.source!==source)),remove:(source,id)=>update(old=>old.filter(i=>i.source!==source||i.id!==Number(id)))};
}
export function TrayButton({source='bank',item}) {
  const tray=useMaterialTray(),active=tray.has(source,item.id);
  return <button type="button" className={`btn btn-secondary btn-sm tray-toggle ${active?'is-selected':''}`} aria-pressed={active} disabled={!active&&tray.items.length>=40} onClick={e=>{e.stopPropagation();tray.toggle(source,item);}}>{active?'В подборке ✓':'В подборку'}</button>;
}
export default function MaterialTray() {
  const tray=useMaterialTray(),[expanded,setExpanded]=useState(false),[picking,setPicking]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[cleared,setCleared]=useState(null);
  useEffect(()=>{if(!cleared)return;const timer=setTimeout(()=>setCleared(null),12000);return()=>clearTimeout(timer);},[cleared]);
  if(!tray.items.length)return cleared?<aside className="material-tray tray-cleared" aria-label="Подборка материалов"><span role="status">Подборка очищена</span><button className="btn btn-secondary btn-sm" onClick={()=>{tray.restore(cleared);setCleared(null);}}>Отменить очистку</button></aside>:null;
  const resolve=async()=>{
    const ids=[];for(const item of tray.items){const id=item.source==='bank'?(await api.bankTake(item.id)).library_id:item.id;if(!Number.isSafeInteger(Number(id))||Number(id)<=0)throw Error('Не удалось подготовить материал: '+item.title);ids.push(Number(id));}return [...new Set(ids)];
  };
  const assign=async()=>{setBusy(true);setError('');try{const ids=await resolve();navigate('/homework/new?items='+ids.join(','));}catch(e){setError(e.message);}finally{setBusy(false);}};
  return <aside className="material-tray" aria-label="Подборка материалов"><div className="material-tray-bar"><button type="button" className="tray-summary" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}><b>Подборка · {tray.items.length}</b><span>Сохраняется при смене раздела</span></button><div className="row wrap"><button className="btn btn-secondary btn-sm" disabled={busy} onClick={()=>setPicking(true)}>На урок</button><button className="btn btn-sm" disabled={busy} onClick={assign}>{busy?'Подготавливаем…':'Выдать ДЗ'}</button><button className="btn btn-quiet btn-sm" disabled={busy} onClick={()=>{setCleared(tray.items);tray.clear();}}>Очистить</button></div></div>
  {error&&<p className="alert" role="alert">{error}</p>}{expanded&&<ul className="tray-items">{tray.items.map(i=><li key={i.source+':'+i.id}><span>{i.title}<small>{i.source==='bank'?'Банк заданий':'Библиотека'}</small></span><button className="btn btn-quiet btn-sm" aria-label={'Убрать из подборки: '+i.title} disabled={busy} onClick={()=>tray.remove(i.source,i.id)}>Убрать</button></li>)}</ul>}
  {picking&&<TrayLessonPick resolve={resolve} onClose={()=>setPicking(false)}/>}</aside>;
}
function TrayLessonPick({resolve,onClose}) {
  const from=new Date().toISOString(),to=new Date(Date.now()+30*864e5).toISOString();
  const data=useLoad(()=>api.lessons({from,to}),[]),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const add=async l=>{setBusy(true);setError('');try{const ids=await resolve(),room=await api.lessonRoom(l.id);await api.setLessonItems(l.id,[...new Set([...(room.items||[]).map(i=>i.id),...ids])]);onClose();navigate('/lesson/'+l.id);}catch(e){setError(e.message);}finally{setBusy(false);}};
  const rows=(data.data||[]).filter(l=>l.status==='scheduled');
  return <Modal title="Подборка для урока" onClose={()=>!busy&&onClose()}><p className="small muted">Выберите занятие на ближайшие 30 дней. Текущие материалы урока сохранятся.</p>{data.loading?<Spinner/>:data.error?<ErrorBox error={data.error} onRetry={data.reload}/>:!rows.length?<p>Ближайших занятий нет. <Link to="/schedule" onClick={onClose}>Открыть расписание</Link></p>:<div className="tray-lesson-list">{rows.map(l=><button className="btn btn-secondary" disabled={busy} key={l.id} onClick={()=>add(l)}><span>{l.student_name}<small>{l.subject} · {shortDate(l.starts_at)} · {time(l.starts_at)}</small></span><span>Добавить</span></button>)}</div>}{error&&<p className="alert" role="alert">{error}</p>}</Modal>;
}
