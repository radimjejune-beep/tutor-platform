import {useCallback,useEffect,useRef,useState} from 'react';
import {api} from '../api';
import {useAuth} from '../auth';
import {Badge,ErrorBox,Link,readDraft,writeDraft,clearDraft} from '../ui';
import GamePlayer from '../games/Players';
import {streamLesson} from './live-transport';

export function isLiveGame(i) { return i.kind==='game' && i.game && !(i.game.type==='sheet' && i.game.blocks?.some(b=>b.t==='voice')); }
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const show=v=>v===null||v===undefined||v===''?'—':Array.isArray(v)?v.map(show).join(' · '):typeof v==='object'?Object.values(v).map(show).join(' · '):String(v);

export default function LiveLesson({lesson,onActive}) {
  const {user}=useAuth(),teacher=user.role==='tutor';
  const [state,setState]=useState(null),[network,setNetwork]=useState('Подключаемся…'),[error,setError]=useState(''),[busy,setBusy]=useState(false),[selected,setSelected]=useState(''),[pupil,setPupil]=useState('');
  const retryStart=useRef(null);
  const accept=useCallback(s=>{setState(s);setError('');onActive?.(s.session?.status==='active'?s.session.item_id:null);},[onActive]);
  useEffect(()=>{
    let cancelled=false,fatal=false,last=0,backoff=500,timer,polling=false;const abort=new AbortController();
    const stop=e=>{if([401,403,404].includes(e.status)){fatal=true;setError(e.message);setNetwork('Доступ закрыт');abort.abort();}};
    const poll=async()=>{if(cancelled||fatal||polling||Date.now()-last<6500)return;polling=true;try{accept(await api.liveState(lesson.id));setNetwork('Обновление через несколько секунд');}catch(e){if(!cancelled){setError(e.message);stop(e);}}finally{polling=false;}};
    const run=async()=>{if(cancelled||fatal)return;try{await streamLesson(lesson.id,abort.signal,s=>{if(!cancelled){accept(s);setNetwork('Связь установлена');backoff=500;}},()=>{last=Date.now();});}catch(e){if(cancelled)return;stop(e);if(!fatal){setNetwork('Восстанавливаем связь…');timer=setTimeout(run,backoff);backoff=Math.min(backoff*2,5000);}}};
    poll();run();const interval=setInterval(poll,3000);
    return()=>{cancelled=true;abort.abort();clearInterval(interval);clearTimeout(timer);onActive?.(null);};
  },[lesson.id,accept,onActive]);
  const session=state?.session,active=session?.status==='active',games=lesson.items.filter(isLiveGame);
  const start=async()=>{const item=Number(selected||games[0]?.id);if(!item)return;setBusy(true);setError('');
    if(retryStart.current?.item_id!==item)retryStart.current={item_id:item,request_key:crypto.randomUUID()};
    try{await api.liveStart(lesson.id,retryStart.current);retryStart.current=null;accept(await api.liveState(lesson.id));}catch(e){setError(e.message);}finally{setBusy(false);}};
  const end=async()=>{setBusy(true);try{await api.liveEnd(lesson.id,session.id);accept(await api.liveState(lesson.id));}catch(e){setError(e.message);}finally{setBusy(false);}};
  const response=state?.responses.find(r=>r.student_id===Number(pupil))||state?.responses[0];
  return <section className="panel live-panel" aria-label="Совместное упражнение">
    <div className="row-between wrap"><div><div className="meta-label">Совместное упражнение</div><h2 className="section-title">{active?session.title:session?'Упражнение завершено':'Решаем вместе'}</h2></div><span className="small muted" role="status">{network}</span></div>
    {teacher&&<><p className="small muted">Запустите упражнение — оно появится в комнате ученика. Вы будете видеть его ответы по мере заполнения.</p>
      {lesson.status==='scheduled'&&<div className="row wrap"><label className="live-choice">Упражнение<select className="select" aria-label="Упражнение для совместного решения" value={selected||games[0]?.id||''} onChange={e=>{setSelected(e.target.value);retryStart.current=null;}}>{!games.length&&<option value="">Добавьте упражнение в задачи урока</option>}{games.map(i=><option key={i.id} value={i.id}>{i.title}</option>)}</select></label><button className="btn btn-sm" disabled={busy||!games.length} onClick={start}>{active?'Начать заново / сменить':'Начать вместе'}</button>{active&&<button className="btn btn-secondary btn-sm" disabled={busy} onClick={end}>Завершить упражнение</button>}</div>}
      <p className="small muted">Доступны встроенные упражнения с текстовыми ответами. Интерактивные HTML-уроки и запись голоса открываются в задачах ниже.</p>
    </>}
    {error&&<div className="alert" role="alert">{error}</div>}
    {session&&teacher&&<div className="live-inspector">
      {state.responses.length>1&&<label>Ответы ученика<select className="select" value={response?.student_id||''} onChange={e=>setPupil(e.target.value)}>{state.responses.map(r=><option key={r.student_id} value={r.student_id}>{r.name}{r.submitted_at?' · сдано':''}</option>)}</select></label>}
      {response&&<><div className="row-between wrap"><b>{response.name}</b><Badge tone={response.submitted_at?'green':'brass'}>{response.submitted_at?`Сдано · ${response.result?.score}%`:response.revision?'Работает над ответом':'Ждём ответа'}</Badge></div>
        {response.updated_at&&<p className="small muted">Сохранено: {new Date(response.updated_at).toLocaleTimeString('ru-RU')} · версия {response.revision}</p>}
        {(response.draft_details||[]).map((d,i)=><div className="live-answer" key={i}><b>{i+1}. {show(d.prompt||d.question||d.text||'Ответ')}</b><div>Ответ: {show(d.given)}</div>{response.submitted_at&&<span className="small">{d.manual?'Проверяет преподаватель':d.ok?'Верно':'Нужно разобрать'}</span>}</div>)}
        <details><summary>Показать правильные ответы</summary>{(response.draft_details||[]).map((d,i)=><p key={i}>{i+1}. {show(d.expected)}</p>)}</details>
      </>}
    </div>}
    {!teacher&&active&&response&&user.role==='student'&&<LiveAnswer key={`${session.id}:${response.student_id}`} lessonId={lesson.id} session={session} remote={response}/>}
    {!teacher&&user.role==='parent'&&session&&<p>Здесь работает ученик. {response?.submitted_at?`Результат: ${response.result?.score}%.`:'После сдачи здесь появится результат.'}</p>}
    {!teacher&&!active&&<p className="muted">{session?'Ответы сохранены. Следующее упражнение запустит преподаватель.':'Когда преподаватель запустит упражнение, оно появится здесь автоматически.'}</p>}
    {teacher&&<Link className="small" to={`/students/${lesson.student_id}/coach`}>Подсказки по ошибкам и план следующего занятия →</Link>}
  </section>;
}

function LiveAnswer({lessonId,session,remote}) {
  const key=`live:${lessonId}:${session.id}:${remote.student_id}`;
  const [initial]=useState(()=>{const saved=readDraft(key)?.value;return {saved,answers:saved?.revision===remote.revision?saved.answers:remote.answers,conflict:saved&&saved.revision!==remote.revision&&!same(saved.answers,remote.answers)?remote:null};});
  const [conflict,setConflict]=useState(initial.conflict),[message,setMessage]=useState(initial.saved?'Восстановлен черновик':'Ответы сохраняются автоматически'),[error,setError]=useState(''),[epoch,setEpoch]=useState(0),[result,setResult]=useState(remote.result),[seed,setSeed]=useState(initial.answers);
  const ref=useRef({answers:initial.answers,revision:remote.revision,ack:remote.answers,client:crypto.randomUUID(),conflict:initial.conflict,ended:false,submitted:Boolean(remote.submitted_at),inflight:null,timer:null,mounted:true});
  const s=ref.current;
  const persist=()=>writeDraft(key,{answers:s.answers,revision:s.revision});
  const accept=useCallback(r=>{
    if(!r)return;
    if(r.submitted_at){s.submitted=true;s.ack=r.answers;s.answers=r.answers;s.revision=r.revision;clearDraft(key);if(s.mounted){setResult(r.result);setMessage('Результат сохранён');}return;}
    if(r.revision<=s.revision)return;
    if(r.client_id===s.client){s.revision=r.revision;s.ack=r.answers;persist();return;}
    if(!same(s.answers,s.ack)||s.inflight){s.conflict=r;if(s.mounted)setConflict(r);return;}
    s.revision=r.revision;s.ack=r.answers;s.answers=r.answers;persist();if(s.mounted){setSeed(r.answers);setEpoch(v=>v+1);setMessage('Продолжение из другой вкладки');}
  },[]);
  useEffect(()=>{accept(remote);},[remote,accept]);
  const save=useCallback(async()=>{
    if(s.inflight)return s.inflight;if(s.submitted||s.conflict||s.ended||same(s.answers,s.ack))return;
    const sent=s.answers,expected=s.revision;
    const p=api.liveSave(lessonId,session.id,{answers:sent,expected_revision:expected,client_id:s.client}).then(r=>{
      s.revision=Math.max(s.revision,r.response.revision);s.ack=sent;persist();if(s.mounted){setError('');setMessage('Черновик сохранён на сервере');}
    }).catch(e=>{if(e.body?.current){s.conflict=e.body.current;if(s.mounted)setConflict(e.body.current);}if(s.mounted){setError(e.message);setMessage('Черновик сохранён только в этом браузере');}throw e;}).finally(()=>{s.inflight=null;});
    s.inflight=p;return p;
  },[lessonId,session.id]);
  const draft=useCallback(answers=>{if(s.submitted||same(answers,s.answers))return;s.answers=answers;persist();if(s.mounted)setMessage('Сохраняем…');clearTimeout(s.timer);s.timer=setTimeout(()=>save().then(()=>{if(!same(s.answers,s.ack)&&s.mounted&&!s.conflict)s.timer=setTimeout(()=>save().catch(()=>{}),350);}).catch(()=>{}),350);},[save]);
  useEffect(()=>{s.mounted=true;const t=setInterval(()=>save().catch(()=>{}),3000);return()=>{s.mounted=false;clearInterval(t);clearTimeout(s.timer);};},[save]);
  useEffect(()=>{if(session.status!=='active'){s.ended=true;clearTimeout(s.timer);}},[session.status]);
  const submit=async(answers,_r,duration_sec)=>{clearTimeout(s.timer);s.answers=answers;persist();await s.inflight;
    if(s.conflict)throw Error('Сначала выберите сохранённый ответ из другой вкладки');
    try{const r=await api.liveSave(lessonId,session.id,{answers,expected_revision:s.revision,client_id:s.client,duration_sec},true);accept(r.response);return r;}catch(e){if(e.body?.current){s.conflict=e.body.current;setConflict(e.body.current);}throw e;}};
  const load=()=>{const r=s.conflict;s.conflict=null;s.answers=r.answers;s.ack=r.answers;s.revision=r.revision;clearDraft(key);setSeed(r.answers);setEpoch(v=>v+1);setConflict(null);setError('');accept(r);};
  return <div className="live-student">
    <p className="small muted" role="status">{message}</p>
    {conflict?<div className="alert"><b>Ответ изменён в другой вкладке</b><p>Ваш черновик сохранён в этом браузере. Скопируйте нужный текст перед загрузкой другой версии.</p><details><summary>Мой черновик</summary><div className="instructions">{show(s.answers)}</div></details><button className="btn btn-secondary" onClick={load}>Загрузить сохранённый ответ</button></div>:<GamePlayer key={epoch} game={session.game} initialAnswers={seed} initialResult={result} onDraft={draft} onFinish={submit} allowRetry={false}/>}
    {error&&<p className="alert" role="alert">{error}</p>}
  </div>;
}
