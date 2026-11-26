import { useState, useEffect } from 'react';
import { api } from '../../api';
import { useLoad, Spinner, ErrorBox, Empty, Link, useToast } from '../../ui';
import { BackLink, BreadcrumbEntity } from '../../Shell';
import { plural } from '../../format';
import { QuizForm } from '../../components/Quiz';
import {useAuth} from '../../auth';
import {GrammarContent} from '../../components/GrammarContent.jsx';
import GrammarNotebook from './GrammarNotebook.jsx';
import '../../components/grammar-notebook.css';

export default function Grammar({ topic,student }) {
  const {user}=useAuth();
  const catalog=new URLSearchParams(window.location.hash.split('?')[1]||'').get('catalog')==='1';
  if(!topic&&user.role!=='tutor'&&!catalog)return <GrammarNotebook student={student}/>;
  return topic ? <Article key={topic} topic={topic} /> : <Search subject={student?.subject}/>;
}
function Search({subject}) {
  const [q,setQ]=useState(''),[book,setBook]=useState('core'),[language,setLanguage]=useState(subject||'Английский язык');
  const [query,setQuery]=useState(q);
  useEffect(()=>{const timer=setTimeout(()=>setQuery(q),220);return()=>clearTimeout(timer);},[q]);
  const list=useLoad(()=>api.grammarTopics(query,language),[query,language]);
  const visible=(list.data||[]).filter(t=>book==='all'||(book==='core'?!t.book_id:t.book_id===book));
  return <>
    <div className="page-head"><div><h1 className="page-title">Грамматика под рукой</h1><p className="lead">Найди тему, вспомни правило и закрепи материал на практике.</p></div></div>
    <div className="notebook-tabs"><Link className="btn btn-secondary btn-sm" to="/notebook">Грамматические тетради</Link><span className="btn btn-sm active">Готовые объяснения</span></div>
    <label className="field"><span className="field-label">Язык</span><select className="select" value={language} onChange={e=>{setLanguage(e.target.value);setBook('core');}}><option>Английский язык</option><option>Французский язык</option></select></label>
    <label className="field"><span className="field-label">Материалы</span><select className="input" value={book} onChange={e=>setBook(e.target.value)}>
      <option value="core">Общие темы</option>{language==='Английский язык'&&<><option value="murphy-essential-4">К Essential Grammar in Use · 4th edition</option><option value="murphy-english-5">К English Grammar in Use · 5th edition</option></>}<option value="all">Все материалы</option>
    </select></label>
    {book.startsWith('murphy-')&&<p className="small muted">Объяснения и упражнения Lessonfold. Название книги и номер юнита помогают найти тему; материалы не связаны с автором или издательством.</p>}
    <label className="field"><span className="field-label">Что нужно объяснить?</span>
      <input className="input" type="search" value={q} onChange={e=>setQ(e.target.value)} placeholder={language==='Французский язык'?'Être, avoir, отрицание, вопросы…':'Present Simple, артикли, вопросы или номер юнита…'} /></label>
    {list.loading&&!list.data?<Spinner/>:list.error?<ErrorBox error={list.error} onRetry={list.reload}/>:<>
      <p className="small muted" role="status" aria-live="polite">{(list.loading||q!==query)?'Обновляем список · ':''}{visible.length} {plural(visible.length,'тема','темы','тем')} · объяснения на русском · уровни A1–B2</p>
      {!visible.length&&<Empty title="Такую тему пока не нашли">Попробуй английское название или ключевое слово: например, «прошедшее» или «вопросы».</Empty>}
      <div className="learning-grid">{visible.map(t=><Link key={t.id} className="panel learning-card" to={`/grammar/${t.id}`}>
        <span className="meta-label">{t.level}{t.book_short&&` · ${t.book_short} · Unit ${t.unit}`}</span><h2 className="section-title">{t.title}</h2><p className="muted">{t.when}</p><span className="small">{t.extended?'Подробный разбор · ':''}Теория и практика →</span>
      </Link>)}</div></>}
  </>;
}
function Article({topic}) {
  const {user}=useAuth();
  const data=useLoad(()=>api.grammarTopic(topic),[topic]);
  if(data.loading)return <Spinner/>;
  if(data.error)return <ErrorBox error={data.error} onRetry={data.reload}/>;
  const t=data.data;
  return <><BreadcrumbEntity path={`/grammar/${topic}`} label={t.title}/><BackLink to="/grammar">Справочник грамматики</BackLink>
    <div className="page-head"><div><span className="meta-label">{t.level} · {t.book_short?`${t.book_short} · Unit ${t.unit}`:'Грамматика'}</span><h1 className="page-title">{t.title}</h1></div></div>
    {t.notice&&<p className="small muted">{t.notice}</p>}
    <div className="grammar-article-layout"><section className="panel"><GrammarContent blocks={t.content}/></section><aside className="panel grammar-article-aside"><h2 className="section-title">От понимания к практике</h2><p className="small muted">Прочитай разбор, сравни примеры и выполни задания ниже.</p><a className="btn btn-secondary btn-sm" href="#grammar-practice" onClick={e=>{e.preventDefault();document.getElementById('grammar-practice')?.scrollIntoView({behavior:'smooth',block:'start'});}}>К практике</a>{user.role==='tutor'&&<Link className="btn btn-sm" to={'/notebook/new?source='+encodeURIComponent(topic)}>В тетрадь ученика</Link>}</aside></div><Practice topic={topic} count={t.practice_count}/>

  </>;
}
function Practice({topic,count}) {
  const [size,setSize]=useState(6);
  const [qs,setQs]=useState(null),[answers,setAnswers]=useState({}),[result,setResult]=useState(null),[busy,setBusy]=useState(false);
  const toast=useToast();
  const start=async()=>{setBusy(true);try{setQs(await api.grammarPractice(topic,size));setAnswers({});setResult(null);}catch(e){toast(e.message,'error');}finally{setBusy(false);}};
  const check=async()=>{setBusy(true);try{
    const given=Object.fromEntries(qs.map(q=>[q.id,q.type==='choice'&&answers[q.id]!==undefined?q.options[answers[q.id]]:answers[q.id]??'']));
    const r=await api.checkGrammarPractice(topic,{question_ids:qs.map(q=>q.id),answers:given});
    setAnswers(Object.fromEntries(r.questions.map(q=>[q.id,q.type==='choice'?q.options.indexOf(given[q.id]):given[q.id]])));
    setQs(r.questions);setResult(r.result);
  }catch(e){toast(e.message,'error');}finally{setBusy(false);}};
  return <section className="panel" id="grammar-practice" style={{marginTop:24,scrollMarginTop:90}}><h2 className="section-title">Закрепить тему</h2><p className="muted">Выбери объём практики. Здесь {count} вопросов в пуле; варианты выбираются случайно и могут повторяться. Эта тренировка не меняет результат контрольного теста.</p><label className="field"><span className="field-label">Объём тренировки</span><select className="select" aria-label="Объём тренировки" value={size} disabled={busy||Boolean(qs&&!result)} onChange={e=>setSize(Number(e.target.value))}><option value={3}>Быстро вспомнить · 3 вопроса</option><option value={6}>Потренироваться · 6 вопросов</option>{count>=12&&<option value={12}>Закрепить подробно · 12 вопросов</option>}</select></label>
    {qs&&<QuizForm questions={qs} answers={answers} onChange={setAnswers} mode={result?'review':'answer'} results={result?.results}/>}
    {result&&<div className="learning-note" role="status"><b>{result.earned} из {result.total}</b><p>{result.score===100?'Все ответы верны. Попробуй объяснить правило своими словами.':'Посмотри правильные ответы и вернись к правилу выше.'}</p></div>}
    {result&&<div className="grammar-review-list"><h3 className="section-title">Почему именно так</h3>{qs.map((q,i)=><details key={q.id}><summary>{i+1}. {q.prompt}</summary><p>{q.explanation}</p></details>)}</div>}
    <div className="row wrap" style={{gap:8,marginTop:16}}>
      {qs&&!result?<button type="button" className="btn" disabled={busy} onClick={check}>Проверить ответы</button>:<button type="button" className="btn" disabled={busy} onClick={start}>{qs?'Попробовать ещё':'Начать практику'}</button>}
    </div>
  </section>;
}
