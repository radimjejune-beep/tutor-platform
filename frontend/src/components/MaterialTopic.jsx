import {useState} from 'react';
import {api} from '../api';
import {Modal,Field,useLoad,Spinner,ErrorBox} from '../ui';
export default function MaterialTopic({id}) {
 const [open,setOpen]=useState(false);
 return <div style={{marginTop:12}}><button className="btn btn-quiet btn-sm" onClick={()=>setOpen(true)}>Тема для анализа ошибок</button>{open&&<Editor id={id} onClose={()=>setOpen(false)}/>}</div>;
}
function Editor({id,onClose}) {
 const data=useLoad(()=>Promise.all([api.grammarTopics(),api.materialTopic(id)]),[id]);
 return <Modal title="Тема упражнения" onClose={onClose}>{data.loading?<Spinner/>:data.error?<ErrorBox error={data.error} onRetry={data.reload}/>:<Form id={id} data={data.data} onClose={onClose}/>}</Modal>;
}
function Form({id,data:[topics,current],onClose}) {
 const [topic,setTopic]=useState(current.topic_id||''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const save=async()=>{setBusy(true);try{await api.setMaterialTopic(id,topic||null);onClose();}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <><p className="small muted">Укажите одну тему, если всё упражнение проверяет именно её. Для смешанных заданий используйте диагностику с темой у каждого вопроса.</p><Field label="Грамматическая тема"><select aria-label="Грамматическая тема" className="select" value={topic} onChange={e=>setTopic(e.target.value)}><option value="">Определять по юниту банка, если он указан</option>{topics.map(t=><option key={t.id} value={t.id}>{t.title}{t.book_short?` · ${t.book_short} U${t.unit}`:''}</option>)}</select></Field>{current.effective_topic_id&&!current.topic_id&&<p className="small muted">По юниту банка: {topics.find(t=>t.id===current.effective_topic_id)?.title}</p>}<button className="btn" disabled={busy} onClick={save}>Сохранить тему</button>{error&&<p className="alert">{error}</p>}</>;
}
