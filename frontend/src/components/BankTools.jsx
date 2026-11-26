import {TrayButton} from './MaterialTray';
import {finishWorkspaceScroll} from '../workspace-state';
import {useEffect,useState} from 'react';
import {api} from '../api';
import {Field,Modal,Spinner,ErrorBox,Empty,Link,useLoad,useToast,navigate,Icon} from '../ui';
import LibraryItem from './LibraryItem';
import ActivityActions from './ActivityActions';
import {GAME_TYPES,gameSize} from '../games/logic';

export function useDesktopBank(){
 const [wide,setWide]=useState(()=>window.matchMedia('(min-width:901px)').matches);
 useEffect(()=>{const media=window.matchMedia('(min-width:901px)'),changed=()=>setWide(media.matches);media.addEventListener('change',changed);return()=>media.removeEventListener('change',changed);},[]);
 return wide;
}
export function BankSearch({books,filters,onSearch}) {
 const [form,setForm]=useState(filters);const key=JSON.stringify(filters);
 useEffect(()=>{setForm(filters);},[key]);
 const change=(k,v)=>setForm(f=>({...f,[k]:v}));
 const count=[form.book,form.kind,form.type,form.level].filter(Boolean).length;
 return <section className="panel bank-search"><h2 className="section-title">Поиск по теме</h2><form onSubmit={e=>{e.preventDefault();onSearch({...form,page:1,search:'1'});}}>
  <div className="bank-query-row"><Field label="Поиск по всему банку"><div className="bank-query-input"><Icon name="search" size={17}/><input className="input" type="search" placeholder="Например, Present Simple или семья" maxLength={200} value={form.q} onChange={e=>change('q',e.target.value)}/></div></Field><button className="btn" type="submit">Найти задания</button></div>
  <div className="bank-query-ideas"><span>Попробуйте:</span>{['Present Simple','Past Simple','семья'].map(q=><button key={q} type="button" onClick={()=>{setForm(f=>({...f,q}));onSearch({...form,q,page:1,search:'1'});}}>{q}</button>)}{filters.search&&<button type="button" onClick={()=>onSearch(null)}>Сбросить поиск</button>}</div>
  <details className="bank-advanced"><summary>Фильтры: сборник, тип и уровень{count?` · выбрано ${count}`:''}</summary><div className="bank-search-fields"><Field label="Сборник"><select className="select" value={form.book} onChange={e=>change('book',e.target.value)}><option value="">Все сборники</option>{books.map(b=><option value={b.id} key={b.id}>{b.short}{b.level?` · ${b.level}`:''}</option>)}</select></Field>
   <Field label="Материал"><select className="select" value={form.kind} onChange={e=>{change('kind',e.target.value);if(e.target.value!=='game')change('type','');}}><option value="">Любой</option><option value="game">Интерактивное упражнение</option><option value="theory">Объяснение</option><option value="task">Задание для обсуждения</option></select></Field>
   <Field label="Тип упражнения"><select className="select" value={form.type} onChange={e=>{change('type',e.target.value);if(e.target.value)change('kind','game');}}><option value="">Любой</option>{Object.entries(GAME_TYPES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></Field>
   <Field label="Уровень сборника"><select className="select" value={form.level} onChange={e=>change('level',e.target.value)}><option value="">Любой</option>{['A1','A2','B1','B2'].map(k=><option key={k}>{k}</option>)}</select></Field>
  </div><p className="small muted">Уровень берётся из разметки сборника. Материалы без указанного уровня доступны с фильтром «Любой».</p><button className="btn btn-secondary btn-sm" type="button" onClick={()=>{setForm(f=>({...f,book:'',kind:'',type:'',level:''}));onSearch({...form,book:'',kind:'',type:'',level:'',page:1,search:'1'});}}>Сбросить фильтры</button></details>
 </form></section>;
}

export function BankSearchResults({filters,onSearch}) {
 const data=useLoad(()=>api.bankSearch({q:filters.q,book:filters.book,kind:filters.kind,type:filters.type,level:filters.level,page:filters.page}),[JSON.stringify(filters)]),[open,setOpen]=useState(null);
 useEffect(()=>{if(!data.loading&&data.data)finishWorkspaceScroll();},[data.loading,data.data]);
 if(data.loading)return <div className="panel bank-search-wait"><Spinner/></div>;if(data.error)return <ErrorBox error={data.error} onRetry={data.reload}/>;
 const result=data.data;
 return <section className="bank-search-results" aria-label="Результаты поиска заданий"><div className="row-between wrap"><h2 className="section-title">Найдено: {result.total}</h2><span className="small muted">{result.total?`Страница ${result.page} из ${result.pages}`:''}</span></div>
  {!result.items.length&&<div className="panel"><Empty title="Подходящих заданий не найдено">Измените запрос или уберите часть фильтров. Например, попробуйте «вопросы» или Present Simple.</Empty></div>}
  <div className="market-grid">{result.items.map(it=><article className="market-card" key={it.id}><span className="meta-label">{it.book_title} · Unit {it.unit}{it.book_level?` · ${it.book_level}`:''}</span><h3 className="lib-title">{it.title}</h3><p className="small muted">{it.game?`${GAME_TYPES[it.game.type]?.label||'Упражнение'} · ${gameSize(it.game)}`:it.kind==='theory'?'Объяснение':'Задание для обсуждения'} · {it.author}</p><div className="row wrap"><button className="btn btn-sm bank-preview-trigger" onClick={()=>setOpen(it)}>Посмотреть</button>{it.taken_id&&<Link className="btn btn-quiet btn-sm" to={`/library/${it.taken_id}`}>В библиотеке</Link>}</div><TrayButton item={it}/><details className="bank-card-actions"><summary>Ещё действия</summary><BankUseActions item={it} onTaken={data.reload}/><ActivityActions source="bank" id={it.id} compact/></details></article>)}</div>
  {result.pages>1&&<div className="row wrap bank-pagination"><button className="btn btn-secondary" disabled={result.page<=1} onClick={()=>onSearch({...filters,page:result.page-1})}>← Предыдущая</button><span className="small">{result.page} / {result.pages}</span><button className="btn btn-secondary" disabled={result.page>=result.pages} onClick={()=>onSearch({...filters,page:result.page+1})}>Следующая →</button></div>}
  {open&&<BankPreview id={open.id} taken={open.taken_id} onClose={()=>setOpen(null)} onTaken={data.reload}/>}
 </section>;
}
export function BankUseActions({item,onTaken,includeTake=true}) {
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[lesson,setLesson]=useState(false),toast=useToast();
 const take=async()=>{const r=await api.bankTake(item.id);onTaken?.();return r.library_id;};
 const act=async homework=>{setBusy(true);setError('');try{const id=await take();if(homework)navigate(`/homework/new?items=${id}`);else toast(item.taken_id?'Материал уже в библиотеке':'Добавлено в библиотеку');}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <div className="bank-use"><div className="row wrap">{includeTake&&!item.taken_id&&<button className="btn btn-sm" disabled={busy} onClick={()=>act(false)}>Взять себе</button>}<button className="btn btn-secondary btn-sm" disabled={busy} onClick={()=>setLesson(true)}>На урок</button><button className="btn btn-secondary btn-sm" disabled={busy} onClick={()=>act(true)}>В домашку</button></div>{error&&<p className="alert" role="alert">{error}</p>}{lesson&&<LessonPick item={item} take={take} onClose={()=>setLesson(false)}/>}</div>;
}
export function BankPreview({id,onClose,taken,onTaken}) {
 const data=useLoad(()=>api.bankItem(id),[id]);
 return <Modal title="Задание из банка" onClose={onClose} drawer>{data.loading?<Spinner/>:data.error?<ErrorBox error={data.error} onRetry={data.reload}/>:<><p className="small muted">Проверьте задание перед уроком. Ответы в этом предпросмотре не сохраняются в истории ученика.</p><LibraryItem item={data.data} compactGame={data.data.game?.type==='sheet'}/><div style={{marginTop:16}}><BankUseActions item={{...data.data,taken_id:taken}} onTaken={onTaken}/></div><ActivityActions source="bank" id={id}/><div className="modal-actions"><button className="btn btn-secondary" onClick={onClose}>Закрыть</button>{taken&&<Link className="btn" to={`/library/${taken}`}>Открыть в библиотеке</Link>}</div></>}</Modal>;
}
function LessonPick({item,take,onClose}) {
 const students=useLoad(()=>api.students('active'),[]),[sid,setSid]=useState(''),[lesson,setLesson]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(null);
 const add=async()=>{setBusy(true);setError('');try{const id=await take(),r=await api.appendLessonItems(Number(lesson),[id]);setDone({id:lesson,added:r.added});}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <Modal title="Добавить в занятие" onClose={onClose}><p>{item.title}</p>{done?<><p role="status">{done.added?'Материал добавлен к задачам занятия.':'Этот материал уже есть в занятии.'}</p><div className="row wrap"><Link className="btn" to={`/lesson/${done.id}`}>Открыть урок</Link><button className="btn btn-secondary" onClick={onClose}>Вернуться к банку</button></div></>:<>
  {students.loading?<Spinner/>:students.error?<ErrorBox error={students.error} onRetry={students.reload}/>:<Field label="Ученик"><select className="select" value={sid} onChange={e=>{setSid(e.target.value);setLesson('');}}><option value="">Выберите ученика</option>{students.data.map(s=><option value={s.id} key={s.id}>{s.full_name}</option>)}</select></Field>}
  {sid&&<LessonChoices key={sid} sid={sid} value={lesson} onChange={setLesson}/>}
  <p className="small muted">Копия останется в вашей библиотеке. Для группового занятия материал добавится всем участникам. Уже подготовленные задачи сохранятся.</p><button className="btn" disabled={busy||!lesson} onClick={add}>{busy?'Добавляем…':'Добавить в урок'}</button>
 </>}{error&&<p className="alert" role="alert">{error}</p>}</Modal>;
}
function LessonChoices({sid,value,onChange}) {
 const data=useLoad(()=>api.lessons({student_id:Number(sid),from:new Date(Date.now()-7*864e5).toISOString(),to:new Date(Date.now()+90*864e5).toISOString()}),[sid]);
 if(data.loading)return <Spinner/>;if(data.error)return <ErrorBox error={data.error} onRetry={data.reload}/>;const list=data.data.filter(l=>l.status==='scheduled');
 return list.length?<Field label="Занятие"><select className="select" value={value} onChange={e=>onChange(e.target.value)}><option value="">Выберите занятие</option>{list.map(l=><option key={l.id} value={l.id}>{new Date(l.starts_at).toLocaleString('ru-RU')} · {l.topic||'Занятие'}{l.group_id?' · группа':''}</option>)}</select></Field>:<p className="learning-note">Нет запланированных занятий в ближайшие 90 дней. <Link to={`/students/${sid}/lessons`}>Запланировать занятие</Link></p>;
}
