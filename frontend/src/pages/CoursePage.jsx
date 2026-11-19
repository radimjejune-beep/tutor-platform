import {useState} from 'react';
import {api} from '../api';
import {useAuth} from '../auth';
import {Link,useLoad,Spinner,ErrorBox,navigate} from '../ui';
import {BreadcrumbEntity,BackLink} from '../Shell';
import Checkout from '../components/Checkout';
export default function CoursePage({slug}){
 const d=useLoad(()=>api.marketplaceCourse(slug),[slug]),{user}=useAuth(),[checkout,setCheckout]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 if(d.loading)return <Spinner/>;if(d.error)return <ErrorBox error={d.error} onRetry={d.reload}/>;const c=d.data;
 const enroll=async()=>{setBusy(true);try{const e=await api.enrollFreeCourse(c.id);navigate(`/learn-course/${e.id}`);}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <><BreadcrumbEntity path={`/marketplace/courses/${slug}`} label={c.title}/><BackLink to="/marketplace">Курсы Lessonfold</BackLink><header className="page-head"><h1 className="page-title">{c.title}</h1><p className="commerce-description">{c.description}</p></header>
 <section className="panel"><h2 className="section-title">Программа</h2>{c.modules.map((m,i)=><details key={i} open><summary>{i+1}. {m.title}</summary><ol>{m.units.map((u,j)=><li key={j}>{u.title}</li>)}</ol></details>)}<p>{c.price_type==='free'?'Бесплатный курс':c.currency==='RUB'?`${(c.price_amount/100).toLocaleString('ru-RU')} ₽ · Разовая покупка`:'Цена пока не настроена'}</p>
 {!user?<Link className="btn" to="/login">Войти для покупки и назначения</Link>:user.role!=='tutor'?<p className="muted">Курс назначает преподаватель. Назначенные занятия доступны в «Моих курсах».</p>:c.price_type==='free'?<button className="btn" disabled={busy} onClick={enroll}>Добавить в мои курсы</button>:c.price_type==='paid'&&c.currency==='RUB'?<button className="btn" onClick={()=>setCheckout(true)}>Купить курс</button>:null}
 {error&&<ErrorBox error={error}/>}<p className="small muted">Платформа сохраняет купленную редакцию курса. Разовую покупку можно использовать со своими учениками по условиям оферты.</p></section>
 {checkout&&<Checkout course={c} onClose={()=>{setCheckout(false);d.reload();}}/>}</>;
}
