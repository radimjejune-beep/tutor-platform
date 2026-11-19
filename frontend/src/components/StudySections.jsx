import { useState } from 'react';
import { api } from '../api';
import { useLoad, ErrorBox, Field, Link, useToast } from '../ui';

export function SectionPicker({value,onChange}) {
  const list=useLoad(()=>api.studySections(),[]),topics=useLoad(()=>api.grammarTopics(),[]),toast=useToast();
  const [adding,setAdding]=useState(false),[managing,setManaging]=useState(false),[title,setTitle]=useState(''),[grammar,setGrammar]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const create=async()=>{setBusy(true);setError('');try{const s=await api.createStudySection({title:title.trim(),grammar_key:grammar||null});onChange(s.id);setAdding(false);setTitle('');list.reload();if(s.reused)toast('Выбран существующий раздел; его объяснение сохранено');}catch(e){setError(e.message);}finally{setBusy(false);}};
  return <div className="form">
    <Field label="Раздел обучения" hint="Раздел появится в кабинете выбранного ученика. Например, Present Simple или Spotlight 6 · Модуль 3.">
      <select className="select" aria-label="Раздел обучения" value={value||''} onChange={e=>{onChange(Number(e.target.value)||null);setManaging(false);setAdding(false);}} disabled={list.loading}>
        <option value="">Без раздела</option>{(list.data||[]).map(s=><option key={s.id} value={s.id}>{s.title}</option>)}
      </select>
    </Field>
    {list.error&&<ErrorBox error={list.error} onRetry={list.reload}/>}
    {value&&!adding&&<button type="button" className="btn btn-quiet btn-sm" onClick={()=>setManaging(!managing)}>{managing?'Закрыть настройку':'Изменить выбранный раздел'}</button>}
    {managing&&value&&<SectionManager sections={(list.data||[]).filter(s=>s.id===Number(value))} onChanged={(change)=>{if(change?.deletedId===Number(value))onChange(null);setManaging(false);list.reload();}}/>}
    {!adding?<button className="btn btn-quiet btn-sm" type="button" onClick={()=>{setAdding(true);setManaging(false);}}>+ Новый раздел</button>:<div className="learning-note form">
      <Field label="Название раздела"><input className="input" aria-label="Название раздела" value={title} maxLength={160} onChange={e=>setTitle(e.target.value)} placeholder="Present Simple или Модуль 3"/></Field>
      <Field label="Объяснение грамматики в разделе"><select className="select" aria-label="Грамматика раздела" value={grammar} onChange={e=>setGrammar(e.target.value)}><option value="">Не привязывать</option>{(topics.data||[]).map(t=><option key={t.id} value={t.id}>{t.label||t.title}</option>)}</select></Field>
      {error&&<div className="alert" role="alert">{error}</div>}
      <div className="row" style={{gap:8}}><button type="button" className="btn btn-sm" disabled={busy||!title.trim()} onClick={create}>Создать раздел</button><button type="button" className="btn btn-secondary btn-sm" onClick={()=>setAdding(false)}>Отмена</button></div>
    </div>}
  </div>;
}
export function LearningTabs({active}) {
  return <nav className="learning-tabs" aria-label="Учебные материалы">
    <Link className={`btn btn-sm ${active==='homework'?'':'btn-secondary'}`} to="/homework">Домашние задания</Link>
    <Link className={`btn btn-sm ${active==='diagnostics'?'':'btn-secondary'}`} to="/diagnostics">Диагностика по темам</Link>
    <Link className="btn btn-secondary btn-sm" to="/grammar">Справочник грамматики</Link>
  </nav>;
}

function SectionManager({sections,onChanged}) {
  const topics=useLoad(()=>api.grammarTopics(),[]),toast=useToast();
  const [edit,setEdit]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const save=async()=>{setBusy(true);setError('');try{await api.updateStudySection(edit.id,{title:edit.title.trim(),grammar_key:edit.grammar_key||null});setEdit(null);onChanged();}catch(e){setError(e.message);}finally{setBusy(false);}};
  const remove=async s=>{if(!window.confirm(`Удалить раздел «${s.title}»? Работы и результаты сохранятся в «Без раздела».`))return;setBusy(true);try{await api.deleteStudySection(s.id);onChanged({deletedId:s.id});toast('Раздел удалён, работы сохранены');}catch(e){setError(e.message);}finally{setBusy(false);}};
  return <section className="panel" style={{marginTop:16}}><h2 className="section-title">Настройка выбранного раздела</h2><p className="small muted">Изменения будут видны ученикам, которым выданы работы в этом разделе.</p>
    {sections.map(s=><div className="list-item" key={s.id}><div className="list-main">{s.title}</div><button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={()=>{setEdit({...s});setError('');}}>Изменить</button><button type="button" className="btn btn-quiet btn-sm" disabled={busy} onClick={()=>remove(s)}>Удалить</button></div>)}
    {edit&&<div className="learning-note form"><Field label="Новое название раздела"><input className="input" aria-label="Новое название раздела" value={edit.title} maxLength={160} onChange={e=>setEdit({...edit,title:e.target.value})}/></Field>
      <Field label="Грамматика раздела"><select className="select" aria-label="Грамматика раздела" value={edit.grammar_key||''} onChange={e=>setEdit({...edit,grammar_key:e.target.value})}><option value="">Не привязывать</option>{(topics.data||[]).map(t=><option value={t.id} key={t.id}>{t.label||t.title}</option>)}</select></Field>
      <div className="row" style={{gap:8}}><button type="button" className="btn btn-sm" disabled={busy||!edit.title.trim()} onClick={save}>Сохранить раздел</button><button type="button" className="btn btn-secondary btn-sm" onClick={()=>setEdit(null)}>Отмена</button></div></div>}
    {error&&<div className="alert" role="alert">{error}</div>}
  </section>;
}
