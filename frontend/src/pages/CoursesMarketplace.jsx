import {useState} from 'react';
import {api} from '../api';
import {useAuth} from '../auth';
import {Link,useLoad,Spinner,ErrorBox} from '../ui';
export default function CoursesMarketplace(){
 const {user}=useAuth(),[q,setQ]=useState(''),d=useLoad(()=>api.marketplaceCourses(),[]);
 if(d.loading)return <Spinner/>;if(d.error)return <ErrorBox error={d.error} onRetry={d.reload}/>;
 const rows=d.data.courses.filter(c=>(c.title+' '+c.description).toLowerCase().includes(q.toLowerCase()));
 return <><div className="page-head"><h1 className="page-title">Курсы Lessonfold</h1><p className="muted">Готовые занятия для дополнительной практики. Купленный курс можно назначить своим ученикам.</p><div className="row"><Link className="btn btn-secondary" to="/shop">Интерактивные уроки и PDF</Link>{user&&<Link className="btn btn-secondary" to="/marketplace/mine">Мои курсы</Link>}{user?.role==='tutor'&&<Link className="btn btn-secondary" to="/marketplace/author">Курсы автора</Link>}</div></div>
 <label className="field">Найти курс<input className="input" type="search" placeholder="Тема или название" value={q} onChange={e=>setQ(e.target.value)}/></label>
 <div className="commerce-grid">{rows.map(c=><article className="panel" key={c.id}><span className="meta-label">Lessonfold · {c.level}</span><h2 className="section-title">{c.title}</h2><p className="commerce-description">{c.description}</p><p>{c.total_lessons} занятий · {c.price_type==='free'?'Бесплатно':c.currency==='RUB'?`${(c.price_amount/100).toLocaleString('ru-RU')} ₽`:'Цена уточняется'}</p><Link className="btn" to={`/marketplace/courses/${c.slug}`}>О курсе</Link></article>)}</div>
 {!rows.length&&<section className="panel"><p>{q?'По этому запросу курсов нет. Попробуйте другую тему.':'Новые курсы готовятся к публикации. Доступные учебные курсы остаются в вашем кабинете.'}</p>{user?.role==='tutor'&&<Link to="/courses">Открыть мои учебные курсы</Link>}</section>}</>;
}
