import {useEffect,useId,useState} from 'react';
import {useAuth} from '../auth';
import {api} from '../api';
import {useLoad,Spinner,ErrorBox,Link,Field} from '../ui';
import './expedition.css';
export const TRAIL_POINTS=[[55,300],[145,282],[185,240],[280,222],[330,165],[418,146],[467,92],[540,48]];
export function trailPoint(fraction){const f=Math.max(0,Math.min(1,fraction)),dist=TRAIL_POINTS.slice(1).map((p,i)=>Math.hypot(p[0]-TRAIL_POINTS[i][0],p[1]-TRAIL_POINTS[i][1]));let left=f*dist.reduce((a,b)=>a+b,0);for(let i=0;i<dist.length;i++){if(left<=dist[i]){const p=TRAIL_POINTS[i],q=TRAIL_POINTS[i+1],t=left/dist[i];return [p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t];}left-=dist[i];}return TRAIL_POINTS.at(-1);}
function Mountain({step=0,blocked=false,motion=true,peak=1,obstacle='camp'}){
 const id=useId().replace(/:/g,''),[x,y]=trailPoint(step/20);
 return <svg className={`trail-mountain${motion&&!blocked?' trail-motion':''}`} viewBox="0 0 620 350" role="img" aria-label={`Вершина ${peak}. Пройдено ${step} из 20 шагов.${blocked?' Сейчас привал.':''}`}>
  <defs><linearGradient id={id+'sky'} x2="0" y2="1"><stop stopColor="#eaf1eb"/><stop offset="1" stopColor="#faf8f0"/></linearGradient><linearGradient id={id+'rock'} x2=".7" y2="1"><stop stopColor="#71917a"/><stop offset="1" stopColor="#d9e2cb"/></linearGradient></defs>
  <rect width="620" height="350" rx="20" fill={`url(#${id}sky)`}/><circle cx="97" cy="66" r="25" fill="#ead9a5"/>
  <g className="trail-cloud" fill="#fff" opacity=".7"><ellipse cx="207" cy="65" rx="48" ry="12"/><ellipse cx="180" cy="60" rx="20" ry="13"/></g>
  <path d="M0 296 140 150 246 283 355 137 532 323 620 235V350H0" fill="#dce6d8"/>
  <path d="M145 350 316 170 409 214 540 31 620 142V350" fill={`url(#${id}rock)`}/>
  <path d="m500 87 40-56 42 59-27-11-12 11-15-16Z" fill="#fafff8"/>
  <path d="M540 31 542 10" stroke="#284d40" strokeWidth="3"/><path d="M542 10h28l-7 8h-21" fill="#cfa75e"/>
  <path d="M0 327 95 295 176 320 273 286 374 330 483 300 620 321V350H0" fill="#aec3a3" opacity=".6"/>
  <path d={'M'+TRAIL_POINTS.map(p=>p.join(',')).join('L')} fill="none" stroke="#fffdf5" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"/>
  <path d={'M'+TRAIL_POINTS.map(p=>p.join(',')).join('L')} fill="none" stroke="#789378" strokeWidth="2" strokeDasharray="2 9" strokeLinecap="round"/>
  {[0,.25,.5,.75,1].map((f,i)=>{const p=trailPoint(f);return <g key={f}><circle cx={p[0]} cy={p[1]} r="7" fill={step/20>=f?'#284d40':'#fbfcf7'} stroke="#789378" strokeWidth="2"/>{i>0&&i<4&&<path d={`M${p[0]+10},${p[1]-3}v-20h17l-6 6 6 6h-17`} fill="#ddc38e" stroke="#8a6b35" strokeWidth="1.5"/>}</g>})}
  <g className="trail-avatar" style={{transform:`translate(${x}px,${y}px)`}}><ellipse cy="2" rx="13" ry="4" fill="#284d4028"/><g className="trail-walker"><path d="m-5-5-4-13 6-12 8 2 6 12-6 1 1 11" fill="#c7964f"/><rect x="-12" y="-28" width="9" height="16" rx="3" fill="#315443"/><circle cy="-35" r="7" fill="#d7ae87"/><path d="M-8-37h17l-4-5H-3Z" fill="#284d40"/><path d="m-4-9-3 11m11-11 4 11m0-21 8-5 2 25" fill="none" stroke="#244236" strokeWidth="3" strokeLinecap="round"/></g></g>
  {blocked&&obstacle==='dragon'&&<g transform={`translate(${Math.min(550,x+66)},${Math.max(78,y-34)})`}><g className={motion?'trail-dragon trail-dragon-motion':'trail-dragon'}><path d="M-22 0Q-57-30-44-39L-15-17Q-2-42 23-24L31-40 37-21Q60-14 47 2L23 4Q22 23-4 18L-31 32-24 12Q-43 13-49-3Z" fill="#65816b" stroke="#314d3c" strokeWidth="2"/><path d="M-23-6-41-30-13-15 6-24-2-8Z" fill="#bdc89b"/><path d="m26-24 4-10 5 12" fill="#d7b974"/><circle cx="37" cy="-11" r="3" fill="#fff"/><circle cx="38" cy="-11" r="1.5" fill="#233b2e"/><path d="m40-1 6-2M3 17l-1 7m13-8 1 7" fill="none" stroke="#314d3c" strokeWidth="3" strokeLinecap="round"/><path d="m-40 22-6 8 11-1" fill="#d7b974"/></g></g>}
  <text x="25" y="332" fill="#284d40" fontSize="11">Базовый лагерь</text>
 </svg>;
}
export default function TrailCard({student,tutor=false}){
 const {user}=useAuth(),parent=user.role==='parent',subject=student.subject;
 const data=useLoad(()=>parent?api.trail(student.id,subject):api.syncTrail(student.id,subject),[student.id,subject]);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [reason,setReason]=useState(''),[amount,setAmount]=useState(1),[bypass,setBypass]=useState(false),[grantKey,setGrantKey]=useState(()=>crypto.randomUUID());
 const motionKey=`lf-trail-motion:${user.id}`;
 const [motion,setMotion]=useState(()=>{try{const s=localStorage.getItem(motionKey);return s?s==='on':!matchMedia('(prefers-reduced-motion: reduce)').matches;}catch{return false;}});
 const act=async fn=>{setBusy(true);setError('');try{await fn();await data.reload();}catch(e){setError(e.message);if(e.status===409)data.reload();}finally{setBusy(false);}};
 const grant=async e=>{e.preventDefault();setBusy(true);setError('');try{await api.grantTrail(student.id,subject,{version:data.data.version,request_key:grantKey,steps:Number(amount),reason,bypass_gate:bypass});await data.reload();setReason('');setGrantKey(crypto.randomUUID());}catch(e){setError(e.message);if(e.status===409)data.reload();}finally{setBusy(false);}};
 const settings=patch=>act(()=>api.configureTrail(student.id,subject,{version:data.data.version,paused:data.data.paused,gate_overdue:data.data.gate_overdue,mode:data.data.mode,obstacle:data.data.obstacle,...patch}));
 const toggleMotion=()=>{const next=!motion;setMotion(next);try{localStorage.setItem(motionKey,next?'on':'off');}catch{}};
 if(data.loading&&!data.data)return <section className="panel"><Spinner/></section>;
 if(data.error)return <section className="panel"><ErrorBox error={data.error} onRetry={data.reload}/></section>;
 const d=data.data;
 return <section className="trail-card panel" aria-label="Учебное восхождение"><div className="panel-head"><div><span className="meta-label">Моя экспедиция · {subject}</span><h2 className="section-title">Шаг за шагом к вершине</h2></div><button type="button" className="btn btn-quiet btn-sm" aria-pressed={motion} onClick={toggleMotion}>{motion?'Выключить анимацию':'Включить анимацию'}</button></div>
 <div className="trail-layout"><Mountain step={d.step||0} blocked={d.blocked} motion={motion} peak={d.peak||1} obstacle={d.obstacle}/><div className="trail-story">
 {!d.active?<><h3>Начните свой маршрут</h3><p>Проверенные работы и освоенные навыки станут шагами восхождения. Уже выданные до старта домашки подъём не задерживают.</p>{!parent?<button className="btn" disabled={busy} onClick={()=>act(()=>api.startTrail(student.id,subject))}>{busy?'Начинаем…':'Начать восхождение'}</button>:<p className="small muted">Начать маршрут может ученик или преподаватель.</p>}</>:<><span className="trail-state">{d.blocked?(d.obstacle==='dragon'?'Дракон у тропы':'На привале'):d.on_peak?'Вершина достигнута':'В пути'}</span><h3>Вершина {d.peak}</h3><div className="trail-count"><b>{d.step}</b><span>из 20 шагов</span></div><div className="trail-meter" role="progressbar" aria-label="Шаги до вершины" aria-valuemin={0} aria-valuemax={20} aria-valuenow={d.step}><i style={{width:`${d.step*5}%`}}/></div>
 <p>{d.paused?'Преподаватель поставил маршрут на паузу. Работы можно продолжать выполнять.':d.blocked?'Осталась просроченная домашка этого направления. После сдачи подъём продолжится.':d.on_peak?'Следующий новый шаг откроет путь к следующей вершине.':'Следующий шаг — выполнить работу, повторить ошибку или подтвердить навык с преподавателем.'}</p>
 {d.pending>0&&<p className="trail-held">Шагов в ожидании: {d.pending}. Они сохранятся до продолжения маршрута.</p>}
 <p className="small muted">Всего шагов: {d.steps}. Покорено вершин: {d.completed_peaks}. Достигнутые высоты не отнимаются.</p>
 {!parent&&<button className="btn btn-secondary btn-sm" disabled={busy} onClick={()=>act(()=>api.syncTrail(student.id,subject))}>Обновить маршрут</button>}</>}
 </div></div>
 {!!d.overdue?.length&&d.gate_overdue&&<div className="trail-next"><h3>Что поможет продолжить</h3>{d.overdue.map(h=><div className="row-between" key={h.id}><Link to={tutor?`/homework/${h.assignment_id}/review/${h.id}`:`/homework/${h.id}`}>{h.title}</Link>{tutor&&<button className="btn btn-quiet btn-sm" disabled={busy} onClick={()=>act(()=>api.exemptTrailHomework(h.id,true))}>Не задерживать маршрут</button>}</div>)}</div>}
 <details className="trail-rules"><summary>За что даются шаги</summary><ul><li>Проверенная домашка: от 70% или принята преподавателем без балльной оценки.</li><li>Принятая преподавателем письменная работа.</li><li>Персональная разминка с результатом от 70% — один раз за день.</li><li>Освоенная тема с прикреплённой проверенной работой — для любого предмета.</li><li>Впервые подтверждённая цель языкового маршрута.</li><li>Шаги, которые преподаватель добавил вручную с пояснением.</li></ul><p className="small muted">Каждое основание засчитывается один раз. Домашка, правка текста и подтверждение навыка — отдельные этапы. Учёт начинается со старта этого направления. Это маршрут учебной активности, а не уровень языка или сертификат.</p></details>
 {tutor&&d.active&&<details className="trail-rules"><summary>Настройки преподавателя</summary><div className="trail-settings">
 <Field label="Как начислять шаги"><select className="select" value={d.mode} disabled={busy} onChange={e=>settings({mode:e.target.value})}><option value="mixed">Автоматически + вручную</option><option value="auto">Только автоматически</option><option value="manual">Только вручную</option></select></Field>
 <p className="small muted">Ручной режим подходит для любых предметов и устных заданий. После возвращения автоматики учитываются новые события; накопленные высоты сохраняются.</p>
 <Field label="Персонаж у препятствия"><select className="select" disabled={busy} value={d.obstacle} onChange={e=>settings({obstacle:e.target.value})}><option value="camp">Спокойный привал</option><option value="dragon">Дружелюбный дракон</option></select></Field>
 <label className="row"><input type="checkbox" checked={d.gate_overdue} disabled={busy} onChange={e=>settings({gate_overdue:e.target.checked})}/>Приостанавливать подъём из-за просроченной домашки</label><button className="btn btn-secondary btn-sm" disabled={busy} onClick={()=>settings({paused:!d.paused})}>{d.paused?'Продолжить маршрут':'Пауза по договорённости'}</button><p className="small muted">Срок можно перенести в задании. Пауза и исключение домашки не меняют оценок и доступ к занятиям. Персонаж появляется только во время препятствия.</p>
 {d.mode!=='auto'&&<form className="trail-grant form" onSubmit={grant}><h3 className="section-title">Добавить шаги вручную</h3><Field label="Сколько шагов"><select className="select" value={amount} disabled={busy} onChange={e=>{setAmount(Number(e.target.value));setGrantKey(crypto.randomUUID());}}>{Array.from({length:20},(_,i)=><option key={i+1}>{i+1}</option>)}</select></Field><Field label="За какое достижение"><input className="input" required minLength={3} maxLength={220} value={reason} onChange={e=>{setReason(e.target.value);setGrantKey(crypto.randomUUID());}} placeholder="Самостоятельно объяснила решение задачи"/></Field><label className="row"><input type="checkbox" checked={bypass} onChange={e=>{setBypass(e.target.checked);setGrantKey(crypto.randomUUID());}}/>Засчитать сразу, даже если маршрут на паузе</label><p className="small muted">Начисление и ваше пояснение будут видны ученику и родителю. Без этой галочки шаги подождут окончания паузы.</p><button className="btn" disabled={busy||reason.trim().length<3}>Добавить шаги</button></form>}
 </div></details>}
 {d.events?.length>0&&<details className="trail-rules"><summary>Последние шаги</summary><ul>{d.events.map(e=><li key={e.id}>{e.title} · +{e.steps||1} · {e.credited_at?'засчитано':'в ожидании'}</li>)}</ul></details>}
 {error&&<p className="alert" role="alert">{error}</p>}</section>;
}
