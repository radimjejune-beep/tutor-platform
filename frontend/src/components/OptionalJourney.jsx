import {useState} from 'react';
import {useAuth} from '../auth';
import TrailCard from './TrailCard';
export default function OptionalJourney({student,tutor=false}) {
  const {user}=useAuth(),key=`lf-journey-view:${user.id}:${student.id}`, [show,setShow]=useState(()=>{try{return localStorage.getItem(key)!=='hidden';}catch{return true;}});
  const toggle=()=>{const value=!show;setShow(value);try{localStorage.setItem(key,value?'shown':'hidden');}catch{}};
  return <section className="optional-journey"><div className="row-between wrap"><p className="small muted">Визуальный маршрут — по желанию. Навыки и результаты сохраняются при любом виде.</p><button className="btn btn-quiet btn-sm" aria-expanded={show} onClick={toggle}>{show?'Скрыть восхождение':'Показать восхождение'}</button></div>{show&&<TrailCard student={student} tutor={tutor}/>}</section>;
}
