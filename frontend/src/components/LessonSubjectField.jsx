import {useEffect} from 'react';
import {api} from '../api';
import {useLoad,Field,ErrorBox} from '../ui';
export default function LessonSubjectField({studentId,value,onChange}){
 const d=useLoad(()=>api.studentSubjects(Number(studentId)),[studentId]);
 useEffect(()=>{if(d.data&&!d.data.subjects.includes(value))onChange(d.data.primary);},[d.data,value]);
 if(d.error)return <ErrorBox error={d.error} onRetry={d.reload}/>;
 return <Field label="Направление занятия"><select className="select" aria-label="Направление занятия" value={value||d.data?.primary||''} disabled={d.loading} onChange={e=>onChange(e.target.value)}>{!d.data&&<option>Загружаем направления…</option>}{d.data?.subjects.map(s=><option key={s}>{s}</option>)}</select><span className="small muted">Второй язык добавляется в карточке ученика. Смена направления занятия переносит связанные с ним домашки.</span></Field>;
}
