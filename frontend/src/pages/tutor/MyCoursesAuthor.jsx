import {useState} from 'react';
import {api} from '../../api';
import {useAuth} from '../../auth';
import {Link,useLoad,Spinner,ErrorBox,navigate} from '../../ui';
import {BreadcrumbEntity,BackLink} from '../../Shell';
export default function MyCoursesAuthor({id}){return id?<Editor key={id} id={id}/>:<List/>;}
function List(){
 const d=useLoad(()=>api.authorCourses(),[]),{user}=useAuth(),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const create=async()=>{setBusy(true);try{const r=await api.createAuthorCourse();navigate(`/marketplace/author/${r.id}`);}catch(e){setError(e.message);}finally{setBusy(false);}};
 if(d.loading)return <Spinner/>;if(d.error)return <ErrorBox error={d.error} onRetry={d.reload}/>;
 return <><BackLink to="/marketplace">Витрина</BackLink><div className="page-head"><h1 className="page-title">Курсы автора</h1><p className="muted">Публикацией управляет команда Lessonfold. Ваши прежние курсы сохранены.</p>{user.is_admin&&<button className="btn" disabled={busy} onClick={create}>Создать курс</button>}</div>{error&&<ErrorBox error={error}/>}<div className="commerce-grid">{d.data.map(c=><article className="panel" key={c.id}><h2 className="section-title">{c.title}</h2><p>{({draft:'Черновик',published:'Опубликован',pending:'На проверке',archived:'Архив'})[c.status]} · Редакция {c.content_version}</p><Link className="btn btn-secondary" to={`/marketplace/author/${c.id}`}>Открыть редактор</Link>{c.status==='published'&&<Link className="btn btn-secondary" to={`/marketplace/courses/${c.slug}`}>Страница курса</Link>}</article>)}</div>{!d.data.length&&<p className="panel">Курсов для витрины пока нет. Учебные курсы остались в разделе <Link to="/courses">«Курсы»</Link>.</p>}</>;
}
function Editor({id}){
 const d=useLoad(()=>api.authorCourse(id),[id]);
 if(d.loading)return <Spinner/>;if(d.error)return <ErrorBox error={d.error} onRetry={d.reload}/>;
 return <CourseForm initial={d.data} onReload={d.reload}/>;
}
function CourseForm({initial,onReload}){
 const {user}=useAuth();const [b,setB]=useState(()=>({...initial,modules:Array.isArray(initial.modules)?initial.modules:[]})),[rub,setRub]=useState(initial.currency==='RUB'?String((initial.price_amount||0)/100):''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[rights,setRights]=useState(false);
 const patch=v=>{setB(p=>({...p,...v}));setMessage('');};
 const module=(mi,v)=>patch({modules:b.modules.map((m,i)=>i===mi?{...m,...v}:m)});
 const unit=(mi,ui,v)=>module(mi,{units:b.modules[mi].units.map((u,j)=>j===ui?{...u,...v}:u)});
 const save=async publish=>{setBusy(true);setError('');setMessage('');try{
  if(b.price_type==='paid'&&(!/^\d+$/.test(rub)||Number(rub)<1))throw Error('Укажите цену целым числом в рублях. Старые цены в других валютах не конвертируются автоматически.');
  await api.saveAuthorCourse(b.id,{title:b.title,description:b.description||'',category:b.category||'english',level:b.level||'beginner',price_type:b.price_type==='free'?'free':'paid',price_amount:b.price_type==='free'?0:Number(rub)*100,modules:b.modules,audience:b.audience||'both',outcomes:(b.outcomes||[]).map(x=>x.trim()).filter(Boolean),estimated_hours:b.estimated_hours?Number(b.estimated_hours):null});
  if(publish){await api.publishAuthorCourse(b.id);setMessage('Курс опубликован.');}else setMessage('Черновик сохранён. Для продаж опубликуйте курс.');
 }catch(e){setError(e.message);}finally{setBusy(false);}};
 return <><BreadcrumbEntity path={`/marketplace/author/${b.id}`} label={b.title}/><BackLink to="/marketplace/author">Курсы автора</BackLink><h1 className="page-title">Редактор курса</h1><p className="muted">Сохранение снимает курс с публикации до следующей проверки. Купленные редакции сохраняются.</p>
 <fieldset className="commerce-fieldset" disabled={busy}><section className="panel">
 <label className="field">Название<input className="input" maxLength={200} value={b.title} onChange={e=>patch({title:e.target.value})}/></label>
 <label className="field">Описание<textarea className="input" rows={4} maxLength={20000} value={b.description||''} onChange={e=>patch({description:e.target.value})}/></label>
 <div className="row"><label className="field">Доступ<select className="input" value={b.price_type==='free'?'free':'paid'} onChange={e=>patch({price_type:e.target.value})}><option value="free">Бесплатно</option><option value="paid">Разовая покупка</option></select></label>{b.price_type!=='free'&&<label className="field">Цена, ₽<input className="input" inputMode="numeric" value={rub} placeholder="Введите цену в рублях" onChange={e=>setRub(e.target.value)}/></label>}</div>
 <div className="course-filter-row"><label className="field">Для кого курс<select className="select" value={b.audience||'both'} onChange={e=>patch({audience:e.target.value})}><option value="both">Самостоятельно и с преподавателем</option><option value="self">Только личное самостоятельное обучение</option><option value="tutor">Для преподавателей и их учеников</option></select></label><label className="field">Уровень<select className="select" value={b.level||'beginner'} onChange={e=>patch({level:e.target.value})}>{!['beginner','A1','A2','B1','B2','C1','C2','elementary','intermediate','advanced'].includes(b.level)&&<option value={b.level}>{b.level}</option>}{['beginner','A1','A2','B1','B2','C1','C2','elementary','intermediate','advanced'].map(l=><option key={l} value={l}>{l}</option>)}</select></label><label className="field">Ориентировочно часов<input className="input" type="number" min="1" max="2000" value={b.estimated_hours||''} onChange={e=>patch({estimated_hours:e.target.value})}/></label></div>
 <label className="field">Чему научится покупатель — по одному результату в строке<textarea className="textarea" rows={4} value={(b.outcomes||[]).join('\n')} onChange={e=>patch({outcomes:e.target.value.split('\n')})}/></label>
 {initial.currency!=='RUB'&&<p className="small muted">В старой версии указана другая валюта. Перед публикацией задайте цену в рублях.</p>}</section>
 {b.modules.map((m,mi)=><section className="panel" key={mi}><label className="field">Раздел {mi+1}<input className="input" maxLength={200} value={m.title} onChange={e=>module(mi,{title:e.target.value})}/></label>
 {(m.units||[]).map((u,ui)=><article className="commerce-unit" key={ui}><label className="field">Название занятия<input className="input" value={u.title||''} maxLength={200} onChange={e=>unit(mi,ui,{title:e.target.value})}/></label>
 <label className="field">Формат<select className="input" value={u.type} onChange={e=>unit(mi,ui,{type:e.target.value})}>{!['text','video','quiz','assignment'].includes(u.type)&&<option value={u.type}>{u.type} — прежний формат</option>}<option value="text">Объяснение</option><option value="video">Ссылка на видео</option><option value="quiz">Тест с автопроверкой</option><option value="assignment">Письменное задание</option></select></label>
 {['text','assignment'].includes(u.type)&&<label className="field">Текст<textarea className="input" rows={6} value={typeof u.content==='string'?u.content:''} maxLength={30000} onChange={e=>unit(mi,ui,{content:e.target.value})}/></label>}
 {['text','video'].includes(u.type)&&<label className="commerce-check"><input type="checkbox" checked={u.preview===true} onChange={e=>unit(mi,ui,{preview:e.target.checked})}/>Открыть это занятие бесплатно на странице курса</label>}
 {u.type==='assignment'&&<label className="field">Пример для самостоятельной проверки (необязательно)<textarea className="textarea" maxLength={10000} value={u.model_answer||''} onChange={e=>unit(mi,ui,{model_answer:e.target.value})}/></label>}
 {u.type==='quiz'&&<label className="field">Порог зачёта, %<input className="input" type="number" min="1" max="100" value={u.pass_score??70} onChange={e=>unit(mi,ui,{pass_score:Number(e.target.value)})}/></label>}
 {u.type==='video'&&<label className="field">HTTPS-ссылка<input className="input" type="url" value={u.url||''} onChange={e=>unit(mi,ui,{url:e.target.value})}/></label>}
 {u.type==='quiz'&&<><QuizEditor questions={u.questions||[]} onChange={questions=>unit(mi,ui,{questions})}/></>}
 {!['text','video','quiz','assignment'].includes(u.type)&&<p>Содержимое прежнего формата сохранено. Перед публикацией адаптируйте занятие в один из доступных форматов.</p>}
 <button type="button" className="btn btn-secondary" onClick={()=>module(mi,{units:m.units.filter((_,j)=>j!==ui)})}>Удалить занятие из черновика</button></article>)}
 <button className="btn btn-secondary" onClick={()=>module(mi,{units:[...(m.units||[]),{title:'Новое занятие',type:'text',content:''}]})}>Добавить занятие</button></section>)}
 <button className="btn btn-secondary" onClick={()=>patch({modules:[...b.modules,{title:'Новый раздел',units:[]}]})}>Добавить раздел</button>
 <section className="panel">{user.is_admin&&<label className="commerce-check"><input type="checkbox" checked={rights} onChange={e=>setRights(e.target.checked)}/>Подтверждаю право продавать текст, изображения, видео и остальные материалы курса.</label>}<div className="row"><button className="btn btn-secondary" onClick={()=>save(false)}>Сохранить черновик</button>{user.is_admin&&<button className="btn" disabled={!rights} onClick={()=>save(true)}>Сохранить и опубликовать</button>}</div></section></fieldset>
 {error&&<ErrorBox error={error}/>} {message&&<p role="status" className="panel">{message}</p>}</>;
}
function QuizEditor({questions,onChange}){
 const set=(i,v)=>onChange(questions.map((q,j)=>i===j?{...q,...v}:q));
 return <>{questions.map((q,i)=><div className="panel" key={q.id}><label className="field">Вопрос {i+1}<input className="input" value={q.prompt} onChange={e=>set(i,{prompt:e.target.value})}/></label>
 {q.type==='choice'?<><p className="small muted">Отметьте правильный вариант.</p>{q.options.map((o,j)=><label className="commerce-check" key={j}><input type="radio" name={`correct-${q.id}`} checked={q.correct[0]===j} onChange={()=>set(i,{correct:[j]})}/><input className="input" aria-label={`Вариант ${j+1}`} value={o} onChange={e=>set(i,{options:q.options.map((v,k)=>j===k?e.target.value:v)})}/></label>)}</>:<label className="field">Правильные ответы, каждый с новой строки<textarea className="input" value={q.correct.join('\n')} onChange={e=>set(i,{correct:e.target.value.split('\n')})}/></label>}
 <button className="btn btn-secondary" onClick={()=>onChange(questions.filter((_,j)=>j!==i))}>Убрать вопрос</button></div>)}
 <div className="row"><button className="btn btn-secondary" disabled={questions.length>=50} onClick={()=>onChange([...questions,{id:crypto.randomUUID().slice(0,8),type:'choice',prompt:'',options:['','',''],correct:[0],points:1}])}>Добавить вопрос с выбором</button><button className="btn btn-secondary" disabled={questions.length>=50} onClick={()=>onChange([...questions,{id:crypto.randomUUID().slice(0,8),type:'text',prompt:'',options:[],correct:[''],points:1}])}>Добавить вопрос с вводом</button></div></>;
}
