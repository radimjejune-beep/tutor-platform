import { useState } from 'react';
import { api } from '../api';
import { useLoad, ErrorBox, Field, Link } from '../ui';

export function SectionPicker({value,onChange}) {
  const list=useLoad(()=>api.studySections(),[]),topics=useLoad(()=>api.grammarTopics(),[]);
  const [adding,setAdding]=useState(false),[title,setTitle]=useState(''),[grammar,setGrammar]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const create=async()=>{setBusy(true);setError('');try{const s=await api.createStudySection({title:title.trim(),grammar_key:grammar||null});onChange(s.id);setAdding(false);setTitle('');list.reload();}catch(e){setError(e.message);}finally{setBusy(false);}};
  return <div className="form">
    <Field label="Раздел обучения" hint="Объединяет домашние задания и диагностики. Например, Spotlight 6 · Модуль 3.">
      <select className="select" aria-label="Раздел обучения" value={value||''} onChange={e=>onChange(Number(e.target.value)||null)} disabled={list.loading}>
        <option value="">Без раздела</option>{(list.data||[]).map(s=><option key={s.id} value={s.id}>{s.title}</option>)}
      </select>
    </Field>
    {list.error&&<ErrorBox error={list.error} onRetry={list.reload}/>}
    {!adding?<button className="btn btn-quiet btn-sm" type="button" onClick={()=>setAdding(true)}>+ Новый раздел</button>:<div className="learning-note form">
      <Field label="Название раздела"><input className="input" aria-label="Название раздела" value={title} maxLength={160} onChange={e=>setTitle(e.target.value)} placeholder="Present Simple или Модуль 3"/></Field>
      <Field label="Объяснение грамматики в разделе"><select className="select" aria-label="Грамматика раздела" value={grammar} onChange={e=>setGrammar(e.target.value)}><option value="">Не привязывать</option>{(topics.data||[]).map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></Field>
      {error&&<div className="alert" role="alert">{error}</div>}
      <div className="row" style={{gap:8}}><button type="button" className="btn btn-sm" disabled={busy||!title.trim()} onClick={create}>Создать раздел</button><button type="button" className="btn btn-secondary btn-sm" onClick={()=>setAdding(false)}>Отмена</button></div>
    </div>}
  </div>;
}
export function LearningTabs({active}) {
  return <div className="row wrap" style={{gap:8,marginBottom:20}}>
    <Link className={`btn btn-sm ${active==='homework'?'':'btn-secondary'}`} to="/homework">Домашние задания</Link>
    <Link className={`btn btn-sm ${active==='diagnostics'?'':'btn-secondary'}`} to="/diagnostics">Диагностика по темам</Link>
    <Link className="btn btn-secondary btn-sm" to="/grammar">Справочник грамматики</Link>
  </div>;
}
