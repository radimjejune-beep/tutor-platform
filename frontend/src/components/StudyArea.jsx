import {StudySubjectContext} from '../study-context';
import {useEffect,useState} from 'react';
import {useAuth} from '../auth';
import {api} from '../api';
import {useLoad,Modal,Field,ErrorBox,Spinner,navigate} from '../ui';
import SubjectInput from './SubjectInput';
import './expedition.css';

export default function StudyArea({student,tutor=false,children}){
 const {user}=useAuth(),data=useLoad(()=>api.studentSubjects(student.id),[student.id]);
 const key=`lf-direction:${user.id}:${student.id}`;
 const [choice,setChoice]=useState(()=>{try{return localStorage.getItem(key)||'';}catch{return '';}}),[adding,setAdding]=useState(false),[next,setNext]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{try{setChoice(localStorage.getItem(key)||'');}catch{setChoice('');}},[key]);
 const subjects=data.data?.subjects||[student.subject||'Английский язык'];
 const current=subjects.includes(choice)?choice:data.data?.primary||student.subject||subjects[0];
 const select=value=>{setChoice(value);try{localStorage.setItem(key,value);}catch{/* private storage */}};
 useEffect(()=>{const change=e=>{if(Number(e.detail?.studentId)===student.id&&subjects.includes(e.detail.subject))select(e.detail.subject);};window.addEventListener('lf-study-direction',change);return()=>window.removeEventListener('lf-study-direction',change);},[student.id,key,subjects.join('|')]);
 const changeDirection=value=>{select(value);if(!tutor){const route=location.hash.slice(1).split('?')[0];if(/^\/lesson\/\d+$/.test(route))navigate('/schedule');else if(/^\/homework\/\d+$/.test(route))navigate('/homework');else if(/^\/(writing|workouts)\/\d+$|^\/diagnostics\/runs\/\d+$/.test(route))navigate('/progress');else if(/^\/grammar\/.+/.test(route))navigate('/grammar');}};
 const add=async e=>{e.preventDefault();setBusy(true);setError('');try{await api.addStudentSubject(student.id,next);await data.reload();select(next);setAdding(false);setNext('');}catch(e){setError(e.message);}finally{setBusy(false);}};
 if(data.loading&&!data.data)return <Spinner/>;
 return <><div className="study-direction"><label>Направление обучения<select className="select" value={current} onChange={e=>changeDirection(e.target.value)}>{subjects.map(s=><option key={s}>{s}</option>)}</select></label><details className="study-direction-help"><summary>Как разделяются предметы</summary><p className="small muted">Занятия, задания и прогресс ведутся отдельно по каждому предмету. Оплаты и доступ родителя общие.</p></details>{tutor&&<button type="button" className="btn btn-secondary btn-sm" onClick={()=>setAdding(true)}>Добавить направление</button>}</div>
 {data.error&&<ErrorBox error={data.error} onRetry={data.reload}/>}
 <StudySubjectContext.Provider value={{studentId:student.id,subject:current}}><div key={`${student.id}:${current}`} className="study-content">{children({...student,subject:current,course_id:data.data?.directions?.find(d=>d.subject===current)?.course_id??(current===data.data?.primary?student.course_id:null),course_unit_id:data.data?.directions?.find(d=>d.subject===current)?.course_unit_id??(current===data.data?.primary?student.course_unit_id:null)})}</div></StudySubjectContext.Provider>
 {adding&&<Modal title="Ещё одно направление" onClose={()=>setAdding(false)}><form onSubmit={add}><p>Ученица или ученик продолжит пользоваться тем же аккаунтом. Родительские связи и общий баланс сохранятся.</p><Field label="Предмет или язык"><SubjectInput value={next} onChange={setNext}/></Field><div className="row wrap"><button type="button" className="btn btn-secondary" onClick={()=>setAdding(false)}>Отмена</button><button className="btn" disabled={busy||!next.trim()}>{busy?'Добавляем…':'Добавить'}</button></div>{error&&<p className="alert" role="alert">{error}</p>}</form></Modal>}
 </>;
}

export function SyncStudyDirection({studentId,subject}){useEffect(()=>{if(studentId&&subject)window.dispatchEvent(new CustomEvent('lf-study-direction',{detail:{studentId:Number(studentId),subject}}));},[studentId,subject]);return null;}
