import {useState} from 'react';
import {api} from '../api';
import {useAuth} from '../auth';
import {useLoad,Spinner,ErrorBox} from '../ui';
export default function Checkout({kind='course',course,period='month',onClose}){
 const {user}=useAuth(),state=useLoad(()=>api.billing(),[]);
 const [email,setEmail]=useState(user?.email||''),[auto,setAuto]=useState(false),[offer,setOffer]=useState(false),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[key]=useState(()=>crypto.randomUUID());
 if(state.loading)return <Spinner/>;if(state.error)return <ErrorBox error={state.error} onRetry={state.reload}/>;
 const amount=kind==='subscription'?state.data.prices[period]:course.price_amount/100;
 const submit=async e=>{e.preventDefault();setBusy(true);setError('');try{
  const body={email,quoted_amount:Math.round(amount*100),offer_accept:offer,request_key:key,period,auto_renew:auto,recurring_accept:consent,terms_version:state.data.terms_version};
  const result=kind==='subscription'?await api.checkoutPlan(body):await api.checkoutCourse(course.id,body);
  window.location.assign(result.confirmation_url||result.url);
 }catch(e){setError(e.message);setBusy(false);}};
 return <section className="panel commerce-checkout"><h2 className="section-title">{kind==='subscription'?'Оплата тарифа':course.title}</h2>
 <p>{amount.toLocaleString('ru-RU')} ₽{kind==='subscription'?period==='year'?' за год':' за месяц':''}</p>
 {!state.data.enabled?<p className="muted">Продажи пока не открыты. Материалы и ваш кабинет сохранены.</p>:<form onSubmit={submit}>
 <label className="field">Email для подтверждения покупки<input className="input" type="email" required maxLength={250} value={email} disabled={busy} onChange={e=>setEmail(e.target.value)}/></label>
 {kind==='subscription'&&<><label className="commerce-check"><input type="checkbox" checked={auto} disabled={busy||!state.data.recurring_available} onChange={e=>{setAuto(e.target.checked);setConsent(false);}}/>Автоматически продлевать подписку</label>
 <p className="small muted">Без автопродления вы оплачиваете каждый период самостоятельно. Разовая оплата отключит прежнее автопродление при создании заказа. Уже оплаченный срок сохранится при отключении.</p>
 {auto&&<label className="commerce-check"><input type="checkbox" required checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/>Согласен на сохранение способа оплаты в ЮKassa и списание {amount.toLocaleString('ru-RU')} ₽ {period==='year'?'ежегодно':'ежемесячно'} после окончания оплаченного срока до отключения в «Настройки → Тариф». Условия от {state.data.terms_version}.</label>}
 </>}
 <label className="commerce-check"><input type="checkbox" required checked={offer} disabled={busy} onChange={e=>setOffer(e.target.checked)}/>Принимаю <a href={kind==='subscription'?state.data.platform_offer_url:state.data.offer_url} target="_blank" rel="noopener noreferrer">оферту продавца</a>.</label>
 {error&&<ErrorBox error={error}/>}
 <button className="btn" disabled={busy||!offer||auto&&!consent}>{busy?'Открываем ЮKassa…':`Перейти к оплате ${amount.toLocaleString('ru-RU')} ₽`}</button>
 <p className="small muted">Данные карты вводятся в ЮKassa. Доступ откроется после подтверждения платежа.</p>
 </form>}
 <button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>Закрыть</button>
 </section>;
}
export function BillingHistory(){
 const d=useLoad(()=>api.billing(),[]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 if(d.loading)return <Spinner/>;if(d.error)return <ErrorBox error={d.error} onRetry={d.reload}/>;
 const cancel=async()=>{setBusy(true);setError('');try{await api.cancelRenewal();d.reload();}catch(e){setError(e.message);}finally{setBusy(false);}};
 const sync=async id=>{setBusy(true);setError('');try{await api.syncOrder(id);d.reload();window.dispatchEvent(new Event('lf-billing-updated'));}catch(e){setError(e.message);}finally{setBusy(false);}};
 const p=d.data.profile,labels={pending:'Ждёт оплаты',paid:'Оплачен',refunded:'Возвращён',canceled:'Отменён'};
 return <section className="panel"><h2 className="section-title">Оплата и продление</h2><p>{p.auto_renew?`Автопродление включено. Следующая оплата: ${new Date(p.next_charge_at).toLocaleDateString('ru-RU')}.`:'Автопродление выключено.'}</p>
 {p.auto_renew&&<><button className="btn btn-secondary" disabled={busy} onClick={cancel}>Отключить автопродление</button><p className="small muted">Оплаченный срок сохраняется. Платёж, созданный до отключения, ещё может завершиться; по нему можно обратиться за возвратом.</p></>}
 {error&&<ErrorBox error={error}/>}
 {d.data.orders.length?<div className="commerce-orders">{d.data.orders.map(o=><article key={o.id}><div><b>{o.title}</b><p className="small muted">{new Date(o.created_at).toLocaleDateString('ru-RU')} · {o.amount_rub} ₽ · {labels[o.status]||o.status}{o.refund_state==='pending'?' · Возврат обрабатывается':''}</p></div><div className="row"><a className="btn btn-secondary" href={o.url} target="_blank" rel="noopener noreferrer">Заказ</a>{o.status==='pending'&&<button className="btn btn-secondary" disabled={busy} onClick={()=>sync(o.id)}>Проверить оплату</button>}{o.status==='pending'&&o.confirmation_url&&<a className="btn" href={o.confirmation_url}>Оплатить</a>}</div></article>)}</div>:<p className="muted">Покупок пока нет.</p>}
 </section>;
}
