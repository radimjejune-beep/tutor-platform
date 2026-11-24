import {useState} from 'react';
import {api} from '../api';
import {useLoad,Spinner,ErrorBox,Modal,Field,Link} from '../ui';
import {shortDate} from '../format';

const states={unassessed:'Ещё не проверяли',working:'Тренируем',confirmed:'Получается самостоятельно'};
export default function LanguageProgress({student,tutor=false}) {
 const data=useLoad(()=>api.languageProgress(student.id,student.subject),[student.id,student.subject]);
 const [modal,setModal]=useState(null),[error,setError]=useState('');
 if(data.loading)return <section className="panel language-route"><Spinner/></section>;
 if(data.error)return <section className="panel language-route"><ErrorBox error={data.error} onRetry={data.reload}/></section>;
 const d=data.data;if(!d.enabled)return null;
 const p=d.profile,r=d.route;
 const close=()=>setModal(null),saved=()=>{close();setError('');data.reload();};
 return <section className="panel language-route" aria-label="Путь к следующему языковому уровню">
  <div className="panel-head"><div><span className="meta-label">Языковой маршрут · {d.subject}</span><h2 className="section-title">Путь к следующему уровню</h2></div>{tutor&&<button className="btn btn-secondary btn-sm" onClick={()=>setModal({type:'config'})}>{p?'Настроить маршрут':'Создать маршрут'}</button>}</div>
  {!p?<p className="muted">{tutor?'Укажите отправную точку и цель. Затем отмечайте, что ученик уже умеет делать самостоятельно.':'Преподаватель настроит маршрут и покажет, какие навыки нужны для следующего уровня.'}</p>:<>
   <div className="language-route-hero"><div><span className="small muted">Оценка преподавателя</span><div className="language-route-level">{p.current_level||'Не оценён'} <span aria-hidden="true">→</span> {p.target_level}</div><p className="small muted">{p.current_level===p.target_level?'Поддержание уровня C2':`Цель: ${p.target_level}`}{p.level_confirmed_at?` · уровень отмечен ${shortDate(p.level_confirmed_at)}`:''}</p></div><div><strong className="language-route-count">{r.confirmed} <span>из {r.total}</span></strong><p className="small">целей подтверждено · осталось {r.remaining}</p></div></div>
   <div className="language-route-track" role="progressbar" aria-label={`Цели маршрута к ${p.target_level}`} aria-valuemin={0} aria-valuemax={r.total} aria-valuenow={r.confirmed} aria-valuetext={`${r.confirmed} из ${r.total} целей подтверждено`}><span style={{width:`${r.percent}%`}}/></div>
   <p className="small muted">{r.percent}% целей плана подтверждено. Это ориентир для занятий, а не процент владения языком или официальный результат CEFR. Количество уроков и сданных домашних работ не повышает уровень автоматически.</p>
   <div className="language-route-skills">{r.skills.map(s=><article className="language-route-skill" key={s.key}><div className="row-between"><h3>{s.title}</h3><span className="num small">{s.confirmed}/{s.total}</span></div><ul>{r.items.filter(g=>g.skill===s.key).map(g=><li key={g.key}><div className="language-goal-title">{g.title}</div><span className={`badge ${g.state==='confirmed'&&!g.stale?'badge-green':g.state==='working'||g.stale?'badge-brass':''}`}>{g.stale?'Пора перепроверить':states[g.state]}</span>{g.reference&&!g.reference.unavailable&&<p className="small"><Link to={tutor?g.reference.tutor_link:g.reference.student_link}>Подтверждающая работа: {g.reference.title}</Link></p>}{g.reference?.unavailable&&<p className="small muted">Связанная работа больше недоступна.</p>}{g.evidence&&<p className="small language-evidence">{g.evidence}</p>}{g.assessed_at&&<p className="small muted">Оценка: {shortDate(g.assessed_at)}</p>}{tutor&&<button className="btn btn-quiet btn-sm" aria-label={`Оценить навык: ${g.title}`} onClick={()=>setModal({type:'goal',goal:g})}>Оценить навык</button>}</li>)}</ul></article>)}</div>
   {r.ready&&<div className="learning-note"><strong>{p.current_level===p.target_level?'Все цели поддержания уровня подтверждены.':'Все цели плана подтверждены — можно провести итоговую проверку.'}</strong><p>Уровень меняется после отдельного решения преподавателя с учётом разных заданий и самостоятельности ученика.</p>{tutor&&p.current_level!==p.target_level&&<button className="btn" onClick={()=>setModal({type:'confirm'})}>Подтвердить уровень {p.target_level}</button>}</div>}
   <p className="small muted">Основание текущей оценки: <span className="language-evidence">{p.basis}</span></p>
   <p className="small muted">Наблюдения старше {d.fresh_days} дней остаются в истории, но цели нужно перепроверить. Оценки и комментарии видят ученик и связанный родитель.</p>
   {!!d.signals?.length&&<div className="learning-note"><strong>Из последних проверок грамматики</strong><ul>{d.signals.map(s=><li key={s.topic_id}>{s.title}: {s.correct} из {s.total} · {shortDate(s.at)}</li>)}</ul><p className="small">Эти результаты помогают выбрать тему повторения. Они не оценивают говорение, аудирование, чтение и письмо и не повышают уровень автоматически.</p></div>}
   {['Английский язык','Французский язык'].includes(d.subject)&&<Link className="btn btn-secondary btn-sm" to={tutor?`/students/${student.id}/coach`:'/coach'}>Открыть повторение по ошибкам</Link>}
   {!!d.history.length&&<details className="language-history"><summary>История оценок</summary><ul>{d.history.map(h=><li key={h.id}><span className="small muted">{shortDate(h.created_at)} · </span>{h.event==='assessment'?`${h.details.title} — ${states[h.details.state]}`:h.event==='level_confirmed'?`Подтверждён ${h.details.current_level}`:`Маршрут: ${h.details.current_level||'без оценки'} → ${h.details.target_level}`}<p className="small language-evidence">{h.details.evidence||h.details.basis}</p></li>)}</ul></details>}
  </>}
  {error&&<p className="alert" role="alert">{error}</p>}
  {modal&&<RouteEditor key={`${modal.type}:${modal.goal?.key||''}`} studentId={student.id} data={d} modal={modal} onClose={close} onSaved={saved} onConflict={()=>{close();data.reload();setError('Оценки изменились в другой вкладке. Показана актуальная версия; повторите действие.');}}/>}
 </section>;
}

function RouteEditor({studentId,data:d,modal,onClose,onSaved,onConflict}){
 const p=d.profile,g=modal.goal;
 const sources=useLoad(()=>modal.type==='goal'?api.evidenceOptions(studentId,d.subject):Promise.resolve([]),[studentId,d.subject,modal.type]);
 const [reference,setReference]=useState(g?.reference&&!g.reference.unavailable?`${g.reference.kind}:${g.reference.id}`:'');
 const [current,setCurrent]=useState(p?.current_level||''),[target,setTarget]=useState(p?.target_level||'A1');
 const [basis,setBasis]=useState(modal.type==='config'?p?.basis||'':''),[state,setState]=useState(g?.state||'unassessed'),[evidence,setEvidence]=useState(g?.evidence||'');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const config=modal.type==='config',confirm=modal.type==='confirm';
 const targets=d.levels.slice(1).filter(v=>!current||d.levels.indexOf(v)>d.levels.indexOf(current)||(current==='C2'&&v==='C2'));
 const save=async e=>{
  e.preventDefault();if(busy)return;setBusy(true);setError('');
  try{
   if(config)await api.configureLanguage(studentId,{version:p?.version||0,subject:d.subject,current_level:current||null,target_level:target,basis});
   else if(confirm)await api.confirmLanguageLevel(studentId,{version:p.version,subject:d.subject,basis});
   else await api.assessLanguageGoal(studentId,g.key,{version:p.version,subject:d.subject,state,evidence,evidence_ref:reference?{kind:reference.split(':')[0],id:Number(reference.split(':')[1])}:null});
   onSaved();
  }catch(e){if(e.status===409)onConflict();else setError(e.message);}finally{setBusy(false);}
 };
 return <Modal title={config?'Настройка языкового маршрута':confirm?`Подтвердить ${p.target_level}`:'Оценка навыка'} onClose={busy?()=>{}:onClose}>
  <form onSubmit={save}><fieldset className="learning-fieldset" disabled={busy}>
   {config?<><p className="small muted">Текущий уровень задаёт преподаватель по наблюдениям или входной проверке. Поле «Уровень» в карточке ученика не является подтверждённой оценкой и сюда автоматически не переносится.</p><Field label="Текущий уровень по оценке преподавателя"><select className="select" value={current} onChange={e=>{const c=e.target.value;setCurrent(c);if(c&&d.levels.indexOf(target)<=d.levels.indexOf(c))setTarget(d.levels[Math.min(d.levels.indexOf(c)+1,d.levels.length-1)]);}}><option value="">Ещё не оценивали</option>{d.levels.map(v=><option key={v}>{v}</option>)}</select></Field><Field label="Целевой уровень"><select className="select" value={target} onChange={e=>setTarget(e.target.value)}>{targets.map(v=><option key={v}>{v}</option>)}</select></Field></>:confirm?<p>Подтвердите итоговую оценку после проверки всех четырёх навыков. Следующий маршрут откроется автоматически, история сохранится. Это оценка преподавателя, не сертификат CEFR.</p>:<><p>{g.title}</p><Field label="Как получается сейчас"><select className="select" value={state} onChange={e=>setState(e.target.value)}>{Object.entries(states).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field><Field label="Подтверждающая работа" hint="Можно связать проверенную домашку, принятую письменную работу или результат диагностики. Без ссылки сохраните описание наблюдения."><select className="select" value={reference} onChange={e=>setReference(e.target.value)}><option value="">Наблюдение преподавателя без ссылки</option>{sources.data?.map(v=><option key={`${v.kind}:${v.id}`} value={`${v.kind}:${v.id}`}>{v.title}</option>)}</select></Field><Field label="Основание оценки" hint="Например: диалог о поездке на уроке 17.11; без подсказок задал вопросы и уточнил детали. Комментарий виден семье."><textarea className="textarea" maxLength={1500} required={state==='confirmed'} value={evidence} onChange={e=>setEvidence(e.target.value)}/></Field></>}
   {(config||confirm)&&<Field label={confirm?'На чём основана итоговая оценка':'Основание и цель маршрута'} hint="Укажите проверку или наблюдения; если уровень ещё неизвестен, опишите план входной диагностики. Текст виден семье."><textarea className="textarea" minLength={5} maxLength={1500} required value={basis} onChange={e=>setBasis(e.target.value)}/></Field>}
   <div className="row wrap"><button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button><button className="btn" type="submit">{busy?'Сохраняем…':confirm?'Подтвердить уровень':'Сохранить'}</button></div>
  </fieldset>{error&&<p className="alert" role="alert">{error}</p>}</form>
 </Modal>;
}
