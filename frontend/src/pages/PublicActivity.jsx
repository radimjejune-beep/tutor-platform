import {useCallback,useEffect,useState} from 'react';
import {publicActivity,publicActivityFile} from '../api';
import {useLoad,Spinner,ErrorBox} from '../ui';
import LibraryItem from '../components/LibraryItem';
import {ActivityMediaContext} from '../components/ActivityMedia';
export default function PublicActivity({token,embed=false}) {
 const data=useLoad(()=>publicActivity(token),[token]),[full,setFull]=useState(false);
 const media=useCallback(id=>publicActivityFile(token,id),[token]);
 useEffect(()=>{const prev=document.title;document.title=data.data?.title?`${data.data.title} · Lessonfold`:'Упражнение · Lessonfold';return()=>{document.title=prev;};},[data.data?.title]);
 useEffect(()=>{const changed=()=>setFull(Boolean(document.fullscreenElement));document.addEventListener('fullscreenchange',changed);return()=>document.removeEventListener('fullscreenchange',changed);},[]);
 const toggle=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{/* Отдельная страница уже не содержит меню кабинета. */}};
 return <div className={`activity-page ${embed?'embedded':''}`}>
  <header className="activity-header"><span className="serif">Lessonfold</span><button type="button" className="btn btn-secondary btn-sm" onClick={toggle}>{full?'Свернуть':'На весь экран'}</button></header>
  <main className="activity-content">{data.loading?<Spinner/>:data.error?<ErrorBox error={data.error} onRetry={data.reload}/>:<ActivityMediaContext.Provider value={media}>
   <LibraryItem item={data.data}/><p className="small muted activity-footnote">Тренировка по ссылке. Результат показывается здесь и не записывается в историю ученика.</p>
  </ActivityMediaContext.Provider>}</main>
 </div>;
}
