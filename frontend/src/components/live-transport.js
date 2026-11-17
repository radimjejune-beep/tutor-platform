import {API_BASE, getToken} from '../api';

// Fetch keeps the credential in an Authorization header, never in a shared URL.
export async function streamLesson(id, signal, onSnapshot, onAlive) {
  const res = await fetch(`${API_BASE}/api/live/lessons/${id}/stream`, {headers:{Authorization:`Bearer ${getToken()}`,Accept:'text/event-stream'},signal});
  if (!res.ok) { const body = await res.json().catch(()=>({})); throw Object.assign(Error(body.error || 'Не удалось подключить совместное упражнение'),{status:res.status}); }
  if (!res.headers.get('content-type')?.includes('text/event-stream')) throw Error('Ожидаем подключение к упражнению');
  const reader=res.body.getReader(), decoder=new TextDecoder(); let buffer='';
  try {
    while (!signal.aborted) {
      const {value,done}=await reader.read(); if(done)throw Error('Связь прервалась'); onAlive();
      buffer+=decoder.decode(value,{stream:true}).replace(/\r\n/g,'\n');
      if(buffer.length>2e6)throw Error('Ответ сервера слишком большой');
      let end;
      while((end=buffer.indexOf('\n\n'))>=0) {
        const frame=buffer.slice(0,end);buffer=buffer.slice(end+2);
        const type=frame.split('\n').find(l=>l.startsWith('event:'))?.slice(6).trim();
        const data=frame.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');
        if(!data)continue;const parsed=JSON.parse(data);
        if(type==='snapshot')onSnapshot(parsed);
        if(type==='access-error')throw Object.assign(Error(parsed.error),{status:parsed.status});
      }
    }
  } finally { await reader.cancel().catch(()=>{}); }
}
