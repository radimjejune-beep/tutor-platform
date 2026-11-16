'use strict';
const db=require('./db'),catalog=require('./catalog'),store=require('./store');
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
let ready;
function ensure(){if(!ready)ready=db.q(`CREATE TABLE IF NOT EXISTS subscription_events(
 id SERIAL PRIMARY KEY,tutor_id INTEGER NOT NULL,actor TEXT NOT NULL,reason TEXT NOT NULL,
 before_state JSONB NOT NULL,after_state JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
 CREATE INDEX IF NOT EXISTS subscription_events_tutor ON subscription_events(tutor_id,created_at);`).catch(e=>{ready=null;throw e;});return ready;}
async function platformAvailable(){
 if(!process.env.LF_PUBLIC_URL)return false;
 const {rows}=await db.q("SELECT COUNT(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name IN('role','plan','plan_until')");return rows[0].n===3;
}
async function subscriptions(q=''){
 const available=await platformAvailable();if(!available)return {available:false,tutors:[],requests:[],events:[]};await ensure();
 const {rows:tutors}=await db.q(`SELECT id,full_name,login,email,is_active,plan,plan_until,created_at FROM public.users WHERE role='tutor' AND NOT is_admin
 AND (COALESCE(full_name,'') ILIKE $1 OR login ILIKE $1 OR COALESCE(email,'') ILIKE $1) ORDER BY created_at DESC,id DESC LIMIT 300`,['%'+String(q).slice(0,160)+'%']);
 const {rows:requests}=await db.q(`SELECT r.*,u.full_name,u.login,u.email FROM public.plan_requests r JOIN public.users u ON u.id=r.tutor_id WHERE r.status='pending' ORDER BY r.created_at LIMIT 100`);
 const {rows:events}=await db.q('SELECT * FROM subscription_events ORDER BY created_at DESC LIMIT 30');
 const effective=require('../../src/services/plans').effective;
 return {available:true,tutors:tutors.map(u=>({...u,current:effective(u)})),requests,events};
}
async function grant({id,plan,until,reason,request_id},actor){
 if(!await platformAvailable())fail(409,'Подписки платформы недоступны');await ensure();
 id=Number(id);if(!Number.isInteger(id)||id<=0||id>2147483647||!['start','tutor','trial'].includes(plan))fail(422,'Проверьте преподавателя и тариф');
 reason=String(reason||'').trim();if(!reason||reason.length>1000)fail(422,'Укажите основание изменения тарифа');
 if(until&&(!/^\d{4}-\d{2}-\d{2}$/.test(until)||Number.isNaN(Date.parse(until))||new Date(until).toISOString().slice(0,10)!==until))fail(422,'Проверьте дату окончания');
 const end=until?`${until}T23:59:59+03:00`:null;
 await db.transaction(async c=>{
  const before=(await c.query("SELECT id,login,plan,plan_until FROM public.users WHERE id=$1 AND role='tutor' AND NOT is_admin FOR UPDATE",[id])).rows[0];if(!before)fail(404,'Преподаватель не найден');
  if(request_id){const r=(await c.query("SELECT id FROM public.plan_requests WHERE id=$1 AND tutor_id=$2 AND status='pending' FOR UPDATE",[request_id,id])).rows[0];if(!r)fail(409,'Заявка уже обработана или не найдена');}
  await c.query('UPDATE public.users SET plan=$2,plan_until=$3 WHERE id=$1',[id,plan,end]);
  await c.query('INSERT INTO subscription_events(tutor_id,actor,reason,before_state,after_state) VALUES($1,$2,$3,$4,$5)',[id,actor,reason,JSON.stringify(before),JSON.stringify({plan,plan_until:end})]);
  if(request_id)await c.query("UPDATE public.plan_requests SET status='approved',handled_by=$2,resolved_at=NOW(),updated_at=NOW() WHERE id=$1",[request_id,actor]);
 });require('../../src/services/plans').forget(id);await store.log(actor,'тариф изменён вручную',`Преподаватель #${id}: ${plan}; основание: ${reason}`);return {ok:true};
}
async function closeRequest(id,actor){
 if(!await platformAvailable())fail(409,'Подписки недоступны');
 const r=await db.q("UPDATE public.plan_requests SET status='closed',handled_by=$2,resolved_at=NOW(),updated_at=NOW() WHERE id=$1 AND status='pending' RETURNING id",[id,actor]);if(!r.rowCount)fail(409,'Заявка уже обработана');await store.log(actor,'заявка на тариф закрыта',String(id));return {ok:true};
}
async function summary(days=30){
 days=[7,30,90,365].includes(Number(days))?Number(days):30;
 const {rows:[sales]}=await db.q(`WITH o AS(SELECT * FROM orders WHERE paid_at>=NOW()-make_interval(days=>$1)),
 legacy AS(SELECT p.* FROM purchases p WHERE p.kind='paid' AND p.created_at>=NOW()-make_interval(days=>$1)
 AND NOT EXISTS(SELECT 1 FROM orders x WHERE p.tg_charge_id='yk:'||x.yk_payment_id))
 SELECT (COALESCE((SELECT SUM(amount_rub) FROM o WHERE status IN('paid','refunded')),0)+COALESCE((SELECT SUM(amount_rub) FROM legacy),0))::bigint AS gross,
 COALESCE((SELECT SUM(amount_rub) FROM o WHERE status='refunded'),0)::bigint AS refunds,
 ((SELECT COUNT(*) FROM o WHERE status IN('paid','refunded'))+(SELECT COUNT(*) FROM legacy))::int AS sales,
 (SELECT COUNT(*)::int FROM orders WHERE status='pending') AS pending,
 (SELECT COUNT(*)::int FROM order_mail_jobs WHERE sent_at IS NULL AND canceled_at IS NULL) AS mail_waiting`,[days]);
 const platform=await platformAvailable();let subs=null;
 if(platform)subs=(await db.q(`SELECT COUNT(*) FILTER(WHERE is_active AND plan IN('tutor','pro') AND(plan_until IS NULL OR plan_until>NOW()))::int AS active,
 COUNT(*) FILTER(WHERE is_active AND plan='trial' AND(plan_until IS NULL OR plan_until>NOW()))::int AS trial,
 COUNT(*) FILTER(WHERE is_active AND plan IN('tutor','pro') AND plan_until BETWEEN NOW() AND NOW()+INTERVAL '7 days')::int AS ending FROM public.users WHERE role='tutor' AND NOT is_admin`)).rows[0];
 return {days,sales:{...sales,gross:Number(sales.gross),refunds:Number(sales.refunds),net:Number(sales.gross)-Number(sales.refunds)},subscriptions:subs,products:{total:Object.keys(catalog.get().products).length,ready:Object.values(catalog.get().products).filter(p=>p.status==='available').length},subscription_payments:false};
}
async function buyers(q=''){
 return (await db.q(`SELECT lower(email) AS email,COUNT(*)::int AS orders,COUNT(*) FILTER(WHERE status='paid')::int AS paid,
 COALESCE(SUM(amount_rub) FILTER(WHERE status='paid'),0)::bigint AS net,MAX(created_at) AS last_order,BOOL_OR(news) AS news FROM orders
 WHERE email<>'' AND email ILIKE $1 GROUP BY lower(email) ORDER BY MAX(created_at) DESC LIMIT 300`,['%'+String(q).slice(0,160)+'%'])).rows;
}
async function mails(){return (await db.q(`SELECT j.id,j.order_id,j.kind,j.attempts,j.next_at,j.lease_until,j.sent_at,j.canceled_at,j.last_error,j.created_at,COALESCE(o.email,j.recipient) AS email,o.title
 FROM order_mail_jobs j LEFT JOIN orders o ON o.id=j.order_id ORDER BY j.created_at DESC LIMIT 200`)).rows;}
async function retry(id,actor){
 const r=await db.q(`UPDATE order_mail_jobs SET attempts=0,next_at=NOW(),lease=NULL,lease_until=NULL,last_error=NULL WHERE id=$1 AND sent_at IS NULL AND canceled_at IS NULL AND(lease_until IS NULL OR lease_until<NOW()) RETURNING id`,[String(id).slice(0,300)]);
 if(!r.rowCount)fail(409,'Письмо уже отправлено, отменено или сейчас обрабатывается');await store.log(actor,'повторная попытка отправки письма',String(id));require('./mail-queue').flush({jobId:id}).catch(e=>console.error('mail queue',e.message));return {ok:true};
}
module.exports={ensure,subscriptions,grant,closeRequest,summary,buyers,mails,retry};
