import {SyncStudyDirection} from '../../components/StudyArea';
import {useState} from 'react';
import {useAuth} from '../../auth';
import {api} from '../../api';
import {useLoad,Spinner,ErrorBox,Link,navigate,readDraft,writeDraft,clearDraft} from '../../ui';
import {QuizForm} from '../../components/Quiz';
import GamePlayer from '../../games/Players';
import {TopicReport} from './Diagnostics';
import {BackLink} from '../../Shell';
import '../../components/expedition.css';
export function WorkoutCard({student,tutor=false}){
 const {user}=useAuth(),parent=user.role==='parent',data=useLoad(()=>api.workoutOptions(student.id,student.subject),[student.id,student.subject]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const start=async()=>{setBusy(true);try{const r=await api.startWorkout(student.id,student.subject);navigate(`/workouts/${r.id}`);}catch(e){setError(e.message);}finally{setBusy(false);}};
 if(data.loading&&!data.data)return null;if(data.error)return <section className="panel workout-card"><ErrorBox error={data.error} onRetry={data.reload}/></section>;
 const d=data.data,today=d.today,topics=today?.topics||d.suggestions.map(t=>({id:t.topic_id,title:t.title}));
 return <section className="panel workout-card"><div className="panel-head"><div><span className="meta-label">Персональная практика · {student.subject}</span><h2 className="section-title">10 минут на мои ошибки</h2></div>{today?<Link className="btn btn-secondary btn-sm" to={`/workouts/${today.id}`}>{today.submitted_at?'Разбор сегодняшней разминки':'Продолжить разминку'}</Link>:!parent&&topics.length>0&&<button className="btn btn-sm" disabled={busy} onClick={start}>{busy?'Готовим…':tutor?'Подготовить разминку':'Начать разминку'}</button>}</div>
 <p className="small muted">{topics.length?'Короткая подборка по последним затруднениям. Разбор покажет, к какому правилу вернуться. Время ориентировочное, таймера нет.':'По последним проверкам сейчас нет подходящих тем: данных ещё мало или недавнее повторение прошло успешно. Для любого предмета подходят авторские листы с выбором ответа, пропусками и короткими ответами; свободные тексты проверяет преподаватель.'}</p>
 {!!topics.length&&<div className="workout-topics">{topics.map(t=><span key={t.id} className="workout-topic">{t.title}</span>)}</div>}
 {today?.submitted_at&&<p className="small">Сохранённый результат: {today.result.score}%. {today.result.score>=70?'Разминка может дать один шаг восхождения.':'Ошибки можно повторить отдельно без изменения оценки.'}</p>}{error&&<p className="alert" role="alert">{error}</p>}</section>;
}
export default function Workout({id}){
 const data=useLoad(()=>api.workout(id),[id]);if(data.loading)return <Spinner/>;if(data.error)return <ErrorBox error={data.error} onRetry={data.reload}/>;
 return <WorkoutForm key={`${id}:${Boolean(data.data.submitted_at)}`} initial={data.data}/>;
}
function WorkoutForm({initial}){
 const {user}=useAuth(),[r,setR]=useState(initial),key=`workout:${r.id}`,[answers,setAnswers]=useState(()=>r.answers||readDraft(key)?.value||{}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[confirm,setConfirm]=useState(false),[practice,setPractice]=useState(false);
 const editable=user.role==='student'&&!r.submitted_at,missing=r.questions.filter(q=>answers[q.id]===undefined||answers[q.id]==='').length;
 const submit=async()=>{if(missing&&!confirm){setConfirm(true);return;}setBusy(true);setError('');try{const next=await api.submitWorkout(r.id,answers);setR(next);clearDraft(key);}catch(e){setError(e.message);}finally{setBusy(false);}};
 const wrong=r.submitted_at?r.questions.filter(q=>!r.result.results[q.id]):[];
 const focused={type:'sheet',blocks:wrong.map(q=>q.type==='choice'?{t:'choice',q:q.prompt,options:q.options,correct:q.correct[0]}:{t:'rewrite',q:q.prompt,src:'',a:q.correct.join('|')})};
 return <><SyncStudyDirection studentId={r.student_id} subject={r.subject}/><BackLink to={user.role==='tutor'?`/students/${r.student_id}/progress`:'/progress'}>Прогресс и маршрут</BackLink><header className="page-head"><div><span className="meta-label">{r.subject} · персональная практика</span><h1 className="page-title">10 минут на мои ошибки</h1><p className="lead">{r.questions.length} вопросов по вашим последним затруднениям. Проходите в своём темпе.</p></div></header>
 <section className="panel" style={{marginBottom:22}}><h2 className="section-title">Почему выбраны эти темы</h2>{r.topics.map(t=><div key={t.id}><p><b>{t.title}</b> · {t.reason}</p>{t.id.startsWith('item-')?(t.source?.link&&<Link className="small" to={t.source.link}>Вернуться к исходной работе</Link>):<Link className="small" to={`/grammar/${t.id}`}>Вспомнить объяснение</Link>}</div>)}</section>
 {r.result&&<TopicReport result={r.result}/>}
 <section className="panel"><QuizForm questions={r.questions} answers={answers} onChange={a=>{if(!editable)return;setAnswers(a);writeDraft(key,a);setConfirm(false);}} mode={editable?'answer':r.submitted_at?'review':user.role==='tutor'?'key':'view'} results={r.result?.results}/>
 {editable&&<><p className="small muted">Черновик хранится в этом браузере. Результат проверит сервер. Первая сдача зафиксирует сегодняшнюю попытку.</p>{confirm&&<p className="alert" role="alert">Осталось без ответа: {missing}. Можно вернуться к вопросам или сдать как есть.</p>}<button className="btn" disabled={busy} onClick={submit}>{busy?'Проверяем…':confirm?'Сдать как есть':'Проверить разминку'}</button></>}
 {r.submitted_at&&<><p className="small muted">Эта тренировка помогает выбрать повторение, но не подтверждает языковой уровень автоматически.</p>{wrong.map(q=><p className="learning-note" key={q.id}><b>{q.prompt}</b>{q.explanation&&<><br/>{q.explanation}</>}</p>)}{wrong.length>0&&<button className="btn btn-secondary" onClick={()=>setPractice(!practice)}>{practice?'Скрыть тренировку ошибок':'Повторить ошибки без сохранения оценки'}</button>}{practice&&<div style={{marginTop:20}}><GamePlayer game={focused} title="Работа над ошибками разминки"/></div>}<p><Link to={user.role==='tutor'?`/students/${r.student_id}/progress`:'/progress'}>Вернуться к восхождению</Link></p></>}
 {error&&<p className="alert" role="alert">{error}</p>}</section></>;
}
