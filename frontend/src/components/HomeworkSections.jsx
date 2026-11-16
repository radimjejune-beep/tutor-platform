import { useState } from 'react';
import { api } from '../api';
import { useLoad, Empty, Link, Badge, Field, useToast } from '../ui';
import { LearningTabs } from './StudySections';
import { shortDate, plural } from '../format';

export default function HomeworkSections({items,renderRow,studentId,tutor=false}) {
  const sections=useLoad(()=>api.studySections(studentId),[studentId]);
  const diagnostics=useLoad(()=>api.diagnostics(studentId),[studentId]);
  const [active,setActive]=useState('all'),[filter,setFilter]=useState('all'),[q,setQ]=useState(''),[manage,setManage]=useState(false);
  const pending=h=>tutor?h.total>h.checked+h.submitted:h.status==='assigned';
  const matches=h=>(!q||[h.title,h.section_title,known.get(h.section_id)?.title].filter(Boolean).join(' ').toLowerCase().includes(q.toLowerCase()))&&(filter==='all'||(filter==='todo'?pending(h):tutor?h.checked>0:h.status==='checked'));
  const known=new Map((sections.data||[]).map(s=>[s.id,s]));
  // Метаданные из списка работ сохраняют группировку даже при временной ошибке загрузки разделов.
  for(const h of items)if(h.section_id&&!known.has(h.section_id))known.set(h.section_id,{id:h.section_id,title:h.section_title||'Раздел'});
  const groups=[...known.values()].map(s=>({...s,items:items.filter(h=>h.section_id===s.id),tests:(diagnostics.data||[]).filter(t=>t.section_id===s.id)}));
  const loose=items.filter(h=>!h.section_id),looseTests=(diagnostics.data||[]).filter(t=>!t.section_id);
  if(loose.length||looseTests.length)groups.push({id:0,title:'Без раздела',items:loose,tests:looseTests});
  const visible=groups.filter(g=>tutor||g.items.length||g.tests.length);
  return <>
    <LearningTabs active="homework"/>
    <div className="row wrap" style={{gap:8}}><input type="search" aria-label="Поиск домашних заданий" className="input" style={{maxWidth:340}} value={q} onChange={e=>setQ(e.target.value)} placeholder="Найти домашнее задание…"/>
      {tutor&&<button className="btn btn-secondary btn-sm" onClick={()=>setManage(!manage)}>{manage?'Закрыть настройку':'Настроить разделы'}</button>}
    </div>
    {manage&&<SectionManager sections={sections.data||[]} onChanged={()=>{sections.reload();setActive('all');}}/>}
    <div className="section-filter" role="group" aria-label="Статус домашних заданий">{[['all','Все'],['todo','Нужно выполнить'],['done','Проверенные']].map(([v,label])=><button key={v} className={`btn btn-sm ${filter===v?'':'btn-secondary'}`} aria-pressed={filter===v} onClick={()=>setFilter(v)}>{label}</button>)}</div>
    {visible.length>0&&<>
      <button type="button" className="btn btn-quiet btn-sm" onClick={()=>setActive('all')}>Все разделы</button>
      <div className="learning-grid">{visible.map(g=>{
        const count=g.items.filter(pending).length,checked=g.items.filter(h=>tutor?h.checked===h.total&&h.total>0:h.status==='checked').length;
        const pendingTests=g.tests.filter(t=>tutor?t.submitted<t.total:!t.submitted_at).length;
        const due=[...g.items.filter(h=>pending(h)&&h.due_on),...g.tests.filter(t=>(tutor?t.submitted<t.total:!t.submitted_at)&&t.due_on)].map(x=>x.due_on).sort()[0];
        return <button className="panel learning-card" type="button" key={g.id} onClick={()=>setActive(String(g.id))} aria-pressed={active===String(g.id)}>
          <span className="meta-label">Раздел обучения</span><h2 className="section-title">{g.title}</h2>
          <p className="small muted">{g.items.length} {plural(g.items.length,'домашнее задание','домашних задания','домашних заданий')} · {g.tests.length} {plural(g.tests.length,'диагностика','диагностики','диагностик')}</p>
          <Badge tone={count+pendingTests?'brass':'green'}>{count+pendingTests?`К выполнению: ${count+pendingTests}`:'Все материалы выполнены'}</Badge>
          {due&&<span className="small muted">Ближайший срок: {shortDate(due)}</span>}
          <div className="section-progress" aria-label={`Проверено заданий: ${checked} из ${g.items.length}`}><span style={{width:`${g.items.length?checked/g.items.length*100:0}%`}}/></div>
        </button>;
      })}</div>
    </>}
    {visible.filter(g=>active==='all'||active===String(g.id)).map(g=><section className="panel" key={g.id} style={{marginTop:20}}>
      <div className="panel-head"><h2 className="section-title">{g.title}</h2>{g.grammar_key&&<Link to={`/grammar/${g.grammar_key}`} className="btn btn-secondary btn-sm">Вспомнить правило</Link>}</div>
      {!g.items.filter(matches).length?<p className="small muted">Нет домашних заданий под выбранный фильтр.</p>:g.items.filter(matches).map(renderRow)}
      {g.tests.length>0&&<div style={{marginTop:18}}><h3 className="section-title" style={{fontSize:19}}>Проверки по этому разделу</h3>{g.tests.map(t=><Link key={t.id} className="list-item clickable" to={tutor?`/diagnostics/tests/${t.id}`:`/diagnostics/runs/${t.id}`}>
        <div className="list-main"><b>{t.title}</b><div className="small muted">{t.due_on?`До ${shortDate(t.due_on)}`:'Без срока'}</div></div><Badge>{tutor?`${t.submitted}/${t.total} сдали`:t.submitted_at?`${t.result?.score}%`:'Назначено'}</Badge>
      </Link>)}</div>}
    </section>)}
    {!visible.length&&<div className="panel"><Empty title={tutor?'Заданий пока нет':'Домашних заданий пока нет'}>{tutor?'Выберите или создайте раздел при выдаче задания.':'Учитель добавит материалы и распределит их по разделам.'}</Empty></div>}
    {(sections.error||diagnostics.error)&&<p className="small muted">Часть связанных материалов не загрузилась. <button className="btn btn-quiet btn-sm" onClick={()=>{sections.reload();diagnostics.reload();}}>Повторить загрузку</button></p>}
  </>;
}
function SectionManager({sections,onChanged}) {
  const topics=useLoad(()=>api.grammarTopics(),[]),toast=useToast();
  const [edit,setEdit]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const save=async()=>{setBusy(true);setError('');try{await api.updateStudySection(edit.id,{title:edit.title.trim(),grammar_key:edit.grammar_key||null});setEdit(null);onChanged();}catch(e){setError(e.message);}finally{setBusy(false);}};
  const remove=async s=>{if(!window.confirm(`Удалить раздел «${s.title}»? Работы и результаты сохранятся в «Без раздела».`))return;setBusy(true);try{await api.deleteStudySection(s.id);onChanged();toast('Раздел удалён, работы сохранены');}catch(e){setError(e.message);}finally{setBusy(false);}};
  return <section className="panel" style={{marginTop:16}}><h2 className="section-title">Разделы обучения</h2><p className="small muted">Новый раздел создаётся при выдаче домашнего задания или теста. Здесь можно изменить название и привязать объяснение грамматики.</p>
    {sections.map(s=><div className="list-item" key={s.id}><div className="list-main">{s.title}</div><button className="btn btn-secondary btn-sm" disabled={busy} onClick={()=>{setEdit({...s});setError('');}}>Изменить</button><button className="btn btn-quiet btn-sm" disabled={busy} onClick={()=>remove(s)}>Удалить</button></div>)}
    {edit&&<div className="learning-note form"><Field label="Новое название раздела"><input className="input" aria-label="Новое название раздела" value={edit.title} maxLength={160} onChange={e=>setEdit({...edit,title:e.target.value})}/></Field>
      <Field label="Грамматика раздела"><select className="select" aria-label="Грамматика раздела" value={edit.grammar_key||''} onChange={e=>setEdit({...edit,grammar_key:e.target.value})}><option value="">Не привязывать</option>{(topics.data||[]).map(t=><option value={t.id} key={t.id}>{t.title}</option>)}</select></Field>
      <div className="row" style={{gap:8}}><button className="btn btn-sm" disabled={busy||!edit.title.trim()} onClick={save}>Сохранить раздел</button><button className="btn btn-secondary btn-sm" onClick={()=>setEdit(null)}>Отмена</button></div></div>}
    {error&&<div className="alert" role="alert">{error}</div>}
  </section>;
}
