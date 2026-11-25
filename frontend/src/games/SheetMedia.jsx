import {useEffect,useState,useRef} from 'react';
import {useActivityMedia} from '../components/ActivityMedia';
import {Icon,useToast} from '../ui';
function useMedia(id) {
  const loadFile=useActivityMedia(),[state,setState]=useState({url:null,error:false}),[retry,setRetry]=useState(0);
  useEffect(()=>{setState({url:null,error:false});if(!id)return;let alive=true,url;
    loadFile(id).then(blob=>{if(!alive)return;url=URL.createObjectURL(blob);setState({url,error:false});}).catch(()=>{if(alive)setState({url:null,error:true});});
    return()=>{alive=false;if(url)URL.revokeObjectURL(url);};
  },[id,loadFile,retry]);
  return {...state,retry:()=>setRetry(value=>value+1)};
}
export function useFileUrl(id){return useMedia(id).url;}

// Ссылка YouTube → id ролика (для встроенного плеера)
export function ytId(url) {
  const m = String(url || '').match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export function FileImage({id,alt='',...rest}){
 const {url,error}=useMedia(id);
 return url?<img src={url} alt={alt} {...rest}/>:<span className="sheet-img-wait">{error?'Картинка временно недоступна':'Загружаем картинку…'}</span>;
}
export function FileAudio({id}){
 const {url,error,retry}=useMedia(id);
 return url?<audio className="sheet-audio" controls preload="metadata" src={url}/>:<div className="sheet-media-state" role="status">{error?<><span>Не удалось загрузить запись.</span><button type="button" className="btn btn-secondary btn-sm" onClick={retry}>Повторить загрузку аудио</button></>:<span>Загружаем аудио…</span>}</div>;
}

export function AttachButton({accept,label,onFile}){
 const [busy,setBusy]=useState(false),input=useRef(),toast=useToast();
 return <><input ref={input} type="file" accept={accept} hidden disabled={busy} onChange={async event=>{const file=event.target.files[0];event.target.value='';if(!file)return;setBusy(true);try{await onFile(file);}catch(error){toast(error.message,'error');}finally{setBusy(false);}}}/><button type="button" className="btn btn-quiet btn-sm" disabled={busy} onClick={()=>input.current.click()}><Icon name="clip"/>{busy?'Загружаем…':label}</button></>;
}
