import { useState } from 'react';
import { api } from '../../api';
import { useLoad, Spinner, ErrorBox, Empty, Link, useToast } from '../../ui';
import { BackLink } from '../../Shell';
import { plural } from '../../format';
import { QuizForm } from '../../components/Quiz';

export default function Grammar({ topic }) {
  return topic ? <Article key={topic} topic={topic} /> : <Search />;
}
function Search() {
  const [q,setQ]=useState('');
  const list=useLoad(()=>api.grammarTopics(q),[q]);
  return <>
    <div className="page-head"><div><h1 className="page-title">Грамматика под рукой</h1><p className="lead">Найди тему, вспомни правило и проверь себя на короткой практике.</p></div></div>
    <label className="field"><span className="field-label">Что нужно объяснить?</span>
      <input className="input" type="search" value={q} onChange={e=>setQ(e.target.value)} placeholder="Present Simple, артикли, вопросы, do / does…" /></label>
    {list.loading?<Spinner/>:list.error?<ErrorBox error={list.error} onRetry={list.reload}/>:<>
      <p className="small muted">{list.data.length} {plural(list.data.length,'тема','темы','тем')} · объяснения на русском · уровни A1–B1</p>
      {!list.data.length&&<Empty title="Такую тему пока не нашли">Попробуй английское название или ключевое слово: например, «прошедшее» или «вопросы».</Empty>}
      <div className="learning-grid">{list.data.map(t=><Link key={t.id} className="panel learning-card" to={`/grammar/${t.id}`}>
        <span className="meta-label">{t.level}</span><h2 className="section-title">{t.title}</h2><p className="muted">{t.when}</p><span className="small">Объяснение и практика →</span>
      </Link>)}</div></>}
  </>;
}
function Article({topic}) {
  const data=useLoad(()=>api.grammarTopic(topic),[topic]);
  if(data.loading)return <Spinner/>;
  if(data.error)return <ErrorBox error={data.error} onRetry={data.reload}/>;
  const t=data.data;
  return <><BackLink to="/grammar">Справочник грамматики</BackLink>
    <div className="page-head"><div><span className="meta-label">{t.level} · Грамматика</span><h1 className="page-title">{t.title}</h1></div></div>
    <div className="learning-article"><section className="panel"><h2 className="section-title">Когда использовать</h2><p>{t.when}</p>
      <h2 className="section-title">Как построить</h2><p className="learning-rule">{t.form}</p>
      <h2 className="section-title">Примеры</h2><ul>{t.examples.map((s,i)=><li key={i}>{s}</li>)}</ul>
      <div className="learning-note"><b>Обрати внимание</b><p>{t.mistake}</p></div>
    </section><Practice topic={topic}/></div>
  </>;
}
function Practice({topic}) {
  const [qs,setQs]=useState(null),[answers,setAnswers]=useState({}),[result,setResult]=useState(null),[busy,setBusy]=useState(false);
  const toast=useToast();
  const start=async()=>{setBusy(true);try{setQs(await api.grammarPractice(topic));setAnswers({});setResult(null);}catch(e){toast(e.message,'error');}finally{setBusy(false);}};
  const check=async()=>{setBusy(true);try{
    const given=Object.fromEntries(qs.map(q=>[q.id,q.type==='choice'&&answers[q.id]!==undefined?q.options[answers[q.id]]:answers[q.id]??'']));
    const r=await api.checkGrammarPractice(topic,{question_ids:qs.map(q=>q.id),answers:given});
    setAnswers(Object.fromEntries(r.questions.map(q=>[q.id,q.type==='choice'?q.options.indexOf(given[q.id]):given[q.id]])));
    setQs(r.questions);setResult(r.result);
  }catch(e){toast(e.message,'error');}finally{setBusy(false);}};
  return <section className="panel"><h2 className="section-title">Проверить себя</h2><p className="muted">Три вопроса для тренировки. Эта практика не меняет результат контрольного теста.</p>
    {qs&&<QuizForm questions={qs} answers={answers} onChange={setAnswers} mode={result?'review':'answer'} results={result?.results}/>}
    {result&&<div className="learning-note" role="status"><b>{result.earned} из {result.total}</b><p>{result.score===100?'Все ответы верны. Попробуй объяснить правило своими словами.':'Посмотри правильные ответы и вернись к правилу выше.'}</p></div>}
    <div className="row wrap" style={{gap:8,marginTop:16}}>
      {qs&&!result?<button type="button" className="btn" disabled={busy} onClick={check}>Проверить ответы</button>:<button type="button" className="btn" disabled={busy} onClick={start}>{qs?'Попробовать ещё':'Начать практику'}</button>}
    </div>
  </section>;
}
