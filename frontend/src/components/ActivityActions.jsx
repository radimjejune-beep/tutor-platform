import {useState} from 'react';
import {api} from '../api';
import {Modal,useToast} from '../ui';
export const activityUrl=token=>`${location.origin}${location.pathname}#/activity/${token}`;
export default function ActivityActions({source='library',id,compact=false}) {
 const [token,setToken]=useState(null),[busy,setBusy]=useState(false),[dialog,setDialog]=useState(false),[error,setError]=useState('');
 const toast=useToast();
 const create=async()=>{const r=await api.createActivityLink(source,id);setToken(r.token);return r.token;};
 const open=async()=>{
  const win=window.open('about:blank','_blank');if(win)win.opener=null;
  setBusy(true);setError('');try{const next=await create();if(win)win.location.replace(activityUrl(next));else{setDialog(true);toast('Откройте ссылку в новой вкладке');}}catch(e){win?.close();setError(e.message);setDialog(true);}finally{setBusy(false);}
 };
 const copy=async()=>{setBusy(true);setError('');try{const next=await create();try{await navigator.clipboard.writeText(activityUrl(next));toast('Ссылка скопирована');}catch{setDialog(true);toast('Выделите ссылку и скопируйте вручную');}}catch(e){setError(e.message);setDialog(true);}finally{setBusy(false);}};
 const settings=async()=>{setDialog(true);setBusy(true);setError('');try{setToken((await api.activityLink(source,id)).token);}catch(e){setError(e.message);}finally{setBusy(false);}};
 const revoke=async()=>{setBusy(true);setError('');try{await api.disableActivityLink(source,id);setToken(null);toast('Ссылка отключена');}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <div className="activity-actions" onClick={e=>e.stopPropagation()}>
  <div className="row wrap" style={{gap:8}}><button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={open}>{compact?'Показать':'Показать на уроке'}</button><button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={copy}>Скопировать ссылку</button><button type="button" className="btn btn-quiet btn-sm" disabled={busy} onClick={settings}>Настройки ссылки</button></div>
  {!compact&&<p className="small muted" style={{margin:'8px 0'}}>Откроется один материал с его вложениями, без входа и меню кабинета.</p>}
  {dialog&&<Modal title="Ссылка на отдельное задание" onClose={()=>setDialog(false)}>
   <p className="small muted">Любой, кому передадут эту ссылку, сможет открыть материал и его вложения. Данные кабинета и заметки преподавателя не показываются. Результаты тренировки не сохраняются в истории учеников.</p>
   {error&&<div className="alert" role="alert">{error}</div>}
   {token?<><label className="field"><span className="field-label">Ссылка на задание</span><input className="input" aria-label="Ссылка на задание" value={activityUrl(token)} readOnly onFocus={e=>e.target.select()}/></label>
    <a className="btn btn-secondary btn-sm" href={activityUrl(token)} target="_blank" rel="noopener noreferrer">Открыть отдельно</a>
    <details style={{marginTop:16}}><summary>Вставить в доску или сайт</summary><p className="small muted">Если доска поддерживает iframe, вставьте этот код. В остальных случаях добавьте обычную ссылку.</p><textarea className="textarea" aria-label="Код вставки задания" readOnly value={`<iframe src="${activityUrl(token)}?embed=1" title="Упражнение Lessonfold" width="100%" height="720" style="border:0" allow="fullscreen" referrerpolicy="no-referrer"></iframe>`} onFocus={e=>e.target.select()}/></details>
   </>:<p className="muted">Активной ссылки нет. Создание новой ссылки не восстановит ранее отключённый адрес.</p>}
   <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={()=>setDialog(false)}>Закрыть</button>{token&&<button type="button" className="btn btn-secondary" disabled={busy} onClick={revoke}>Отключить ссылку</button>}<button type="button" className="btn" disabled={busy} onClick={copy}>{token?'Скопировать ссылку':'Создать ссылку'}</button></div>
  </Modal>}
 </div>;
}
