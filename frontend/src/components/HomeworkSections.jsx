import { useState } from 'react';
import { api } from '../api';
import { useLoad, Empty, Link, Badge } from '../ui';
import { LearningTabs } from './StudySections';
import { shortDate, plural } from '../format';

export default function HomeworkSections({items,renderRow,studentId}) {
  const sections=useLoad(()=>api.studySections(studentId),[studentId]);
  const diagnostics=useLoad(()=>api.diagnostics(studentId),[studentId]);
  const progress=useLoad(()=>api.progress(studentId),[studentId]);
  const [active,setActive]=useState('all'),[filter,setFilter]=useState('all'),[q,setQ]=useState('');
  const pending=h=>h.status==='assigned';
  const matches=h=>(!q||[h.title,h.section_title,known.get(h.section_id)?.title].filter(Boolean).join(' ').toLowerCase().includes(q.toLowerCase()))&&(filter==='all'||(filter==='todo'?pending(h):h.status==='checked'));
  const known=new Map((sections.data||[]).map(s=>[s.id,s]));
  // Метаданные из списка работ сохраняют группировку даже при временной ошибке загрузки разделов.
  for(const h of items)if(h.section_id&&!known.has(h.section_id))known.set(h.section_id,{id:h.section_id,title:h.section_title||'Раздел'});
  const groups=[...known.values()].map(s=>({...s,items:items.filter(h=>h.section_id===s.id),tests:(diagnostics.data||[]).filter(t=>t.section_id===s.id)}));
  const loose=items.filter(h=>!h.section_id),looseTests=(diagnostics.data||[]).filter(t=>!t.section_id);
  if(loose.length||looseTests.length)groups.push({id:0,title:'Без раздела',items:loose,tests:looseTests});
  const visible=groups.filter(g=>g.items.length||g.tests.length);
  const studied=g=>{const linked=(progress.data?.topics||[]).filter(t=>g.grammar_key&&t.grammar_key===g.grammar_key&&t.skill==='grammar');return linked.length>0&&linked.every(t=>t.status==='done');};
  return <>
    <LearningTabs active="homework"/>
    <div className="row wrap" style={{gap:8}}><input type="search" aria-label="Поиск домашних заданий" className="input" style={{maxWidth:340}} value={q} onChange={e=>setQ(e.target.value)} placeholder="Найти домашнее задание…"/>
    </div>
    <div className="section-filter" role="group" aria-label="Статус домашних заданий">{[['all','Все'],['todo','Нужно выполнить'],['done','Проверенные']].map(([v,label])=><button key={v} className={`btn btn-sm ${filter===v?'':'btn-secondary'}`} aria-pressed={filter===v} onClick={()=>setFilter(v)}>{label}</button>)}</div>
    {visible.length>0&&<>
      <button type="button" className="btn btn-quiet btn-sm" onClick={()=>setActive('all')}>Все разделы</button>
      <div className="learning-grid">{visible.map(g=>{
        const count=g.items.filter(pending).length,checked=g.items.filter(h=>h.status==='checked').length;
        const pendingTests=g.tests.filter(t=>!t.submitted_at).length;
        const due=[...g.items.filter(h=>pending(h)&&h.due_on),...g.tests.filter(t=>!t.submitted_at&&t.due_on)].map(x=>x.due_on).sort()[0];
        return <button className="panel learning-card" type="button" key={g.id} onClick={()=>setActive(String(g.id))} aria-pressed={active===String(g.id)}>
          <span className="meta-label">{g.id?'Моя тема':'Другие работы'}</span><h2 className="section-title">{g.title}</h2>
          <p className="small muted">{g.items.length} {plural(g.items.length,'домашнее задание','домашних задания','домашних заданий')} · {g.tests.length} {plural(g.tests.length,'диагностика','диагностики','диагностик')}</p>
          <Badge tone={count+pendingTests?'brass':'green'}>{count+pendingTests?`К выполнению: ${count+pendingTests}`:'Все материалы выполнены'}</Badge>
          {studied(g)&&<Badge tone="green">Тема пройдена по программе</Badge>}
          <span className="small muted">Проверено домашних работ: {checked} из {g.items.length}</span>
          {due&&<span className="small muted">Ближайший срок: {shortDate(due)}</span>}
          <div className="section-progress" aria-label={`Проверено заданий: ${checked} из ${g.items.length}`}><span style={{width:`${g.items.length?checked/g.items.length*100:0}%`}}/></div>
        </button>;
      })}</div>
    </>}
    {visible.filter(g=>active==='all'||active===String(g.id)).map(g=><section className="panel" key={g.id} style={{marginTop:20}}>
      <div className="panel-head"><h2 className="section-title">{g.title}</h2>{g.grammar_key&&<Link to={`/grammar/${g.grammar_key}`} className="btn btn-secondary btn-sm">Вспомнить правило</Link>}</div>
      {!g.items.filter(matches).length&&<p className="small muted">Нет домашних заданий под выбранный фильтр.</p>}
      {g.items.filter(h=>h.status!=='checked'&&matches(h)).length>0&&<div><h3 className="section-title" style={{fontSize:18}}>Текущие работы</h3>{g.items.filter(h=>h.status!=='checked'&&matches(h)).map(renderRow)}</div>}
      {g.items.filter(h=>h.status==='checked'&&matches(h)).length>0&&<div style={{marginTop:18}}><h3 className="section-title" style={{fontSize:18}}>История работ по теме</h3><p className="small muted">Открой работу, чтобы вспомнить задания, свои ответы и замечания учителя.</p>{g.items.filter(h=>h.status==='checked'&&matches(h)).map(renderRow)}</div>}
      {g.tests.length>0&&<div style={{marginTop:18}}><h3 className="section-title" style={{fontSize:19}}>Проверки по этому разделу</h3>{g.tests.map(t=><Link key={t.id} className="list-item clickable" to={`/diagnostics/runs/${t.id}`}>
        <div className="list-main"><b>{t.title}</b><div className="small muted">{t.due_on?`До ${shortDate(t.due_on)}`:'Без срока'}</div></div><Badge>{t.submitted_at?`${t.result?.score}%`:'Назначено'}</Badge>
      </Link>)}</div>}
    </section>)}
    {!visible.length&&<div className="panel"><Empty title="Домашних заданий пока нет">Учитель добавит материалы и распределит их по темам. Здесь сохранится история твоих работ.</Empty></div>}
    {progress.error&&<p className="small muted">Статус тем по программе временно недоступен. <button className="btn btn-quiet btn-sm" onClick={progress.reload}>Загрузить статус тем</button></p>}
    {(sections.error||diagnostics.error)&&<p className="small muted">Часть связанных материалов не загрузилась. <button className="btn btn-quiet btn-sm" onClick={()=>{sections.reload();diagnostics.reload();}}>Повторить загрузку</button></p>}
  </>;
}
