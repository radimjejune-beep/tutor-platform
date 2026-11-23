'use strict';
// Единая платёжная цепочка магазина и платформы. Только серверная проверка ЮKassa выдаёт доступ.
const crypto=require('crypto');
const db=require('./db');
const {config}=require('./config');
const pay=require('./pay');
const TERMS='2026-11-18';
const COURSE_TERMS='2026-11-19';
const fail=(message,status=422)=>Object.assign(Error(message),{status});
const plans=()=>require('../../src/services/plans');
const orders=()=>require('./orders');
const PERIODS=['month','year'];
function addPeriod(date,period){
 const d=new Date(date),day=d.getUTCDate();d.setUTCDate(1);
 if(period==='year')d.setUTCFullYear(d.getUTCFullYear()+1);else d.setUTCMonth(d.getUTCMonth()+1);
 const end=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,end));return d;
}
function paidUntil(row,grants,now=new Date()){
 let end=(!['trial','start'].includes(row.plan)&&row.plan_until&&new Date(row.plan_until)>now)?new Date(row.plan_until):new Date(now);
 for(const g of grants){if(!g.revoked_at&&new Date(g.starts_at)<=end&&new Date(g.ends_at)>end)end=new Date(g.ends_at);}
 return end;
}
function cipher(text,decode=false){
 if(config.billingKey.length<32)throw fail('Автопродление временно недоступно',503);
 const key=crypto.createHash('sha256').update(config.billingKey).digest();
 if(decode){const [iv,tag,body]=text.split('.').map(x=>Buffer.from(x,'base64url'));const c=crypto.createDecipheriv('aes-256-gcm',key,iv);c.setAuthTag(tag);return Buffer.concat([c.update(body),c.final()]).toString();}
 const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',key,iv),body=Buffer.concat([c.update(text),c.final()]);return [iv,c.getAuthTag(),body].map(x=>x.toString('base64url')).join('.');
}
async function available(){
 // Для подписок и курсов требуется общая база: отдельный магазин продолжает работать самостоятельно.
 if(!process.env.LF_PUBLIC_URL || config.databaseUrl!==process.env.DATABASE_URL)return false;
 const row=(await db.q("SELECT to_regclass('public.billing_grants') AS t,to_regclass('orders') AS o")).rows[0];return Boolean(row?.t&&row?.o);
}
async function ready(){
 if(!require('./embed').isReady()||!await available())throw fail('Магазин платформы ещё запускается или использует другую базу',503);
 if(!config.payEnabled)throw fail('Оплата пока не подключена',503);
 if(!await orders().sellerReady())throw fail('Сначала необходимо опубликовать реквизиты продавца',503);
}
async function status(tutorId){
 const enabled=await available();
 const p=enabled?(await db.q('SELECT auto_renew,period,next_charge_at,payment_method_label FROM public.billing_profiles WHERE tutor_id=$1',[tutorId])).rows[0]:null;
 const rows=enabled?(await db.q("SELECT id,token,confirmation_url,title,kind,amount_rub,status,created_at,paid_at,refund_state FROM orders WHERE platform_user_id=$1 ORDER BY created_at DESC LIMIT 50",[tutorId])).rows:[];
 return {enabled:enabled&&require('./embed').isReady()&&config.payEnabled&&await orders().sellerReady(),recurring_available:enabled&&config.recurringEnabled&&config.billingKey.length>=32,prices:{month:plans().PLANS.tutor.price,year:plans().PLANS.tutor.year},terms_version:TERMS,profile:p||{auto_renew:false},orders:rows.map(o=>({...o,...dto(o)})),platform_offer_url:config.platformUrl+'/#/terms/terms',offer_url:config.publicUrl+'/offer'};
}
async function checkout(user,data,kind,{ip=null}={}){
 await ready();
 if(kind==='subscription'?user.role!=='tutor':!await require('../../src/services/course-buyers').canPurchase(user))throw fail('Этот тип покупки недоступен для аккаунта',403);
 if(!/^[0-9a-f-]{36}$/i.test(data.request_key||''))throw fail('Обновите форму оплаты');
 if(data.offer_accept!==true)throw fail('Необходимо принять оферту');
 const email=String(data.email||'').trim().toLowerCase();if(!orders().EMAIL_RE.test(email))throw fail('Проверьте email');
 if(kind==='subscription'){
  const owner=require('../../src/legal/platform').owner();
  if(!/^\d{12}$/.test(owner.inn)||!owner.name||!owner.email)throw fail('Реквизиты владельца платформы пока не опубликованы',503);
  if(!PERIODS.includes(data.period)||data.terms_version!==TERMS)throw fail('Условия оплаты обновились. Откройте форму заново',409);
  if(user.is_admin)throw fail('Администратору подписка не требуется',409);
  if(data.auto_renew && (!config.recurringEnabled||config.billingKey.length<32||data.recurring_accept!==true))throw fail('Автопродление недоступно или согласие не подтверждено');
 }
 if(!Number.isInteger(data.quoted_amount)||data.quoted_amount<=0)throw fail('Обновите цену в форме оплаты',409);
 const input={kind,email,quoted_amount:data.quoted_amount,...(kind==='subscription'?{period:data.period,auto_renew:data.auto_renew===true,terms_version:TERMS,offer_version:require('../../src/legal/platform').VERSION}:{course_id:Number(data.course_id),offer_version:COURSE_TERMS})};
 const order=await db.transaction(async c=>{
  const account=(await c.query("SELECT id,role,is_active,plan,plan_until,is_admin FROM public.users WHERE id=$1 FOR UPDATE",[user.id])).rows[0];
  if(!account?.is_active||(kind==='subscription'?account.role!=='tutor':!await require('../../src/services/course-buyers').canPurchase(account,c)))throw fail('Аккаунт недоступен',403);
  if(kind==='subscription'&&['tutor','pro'].includes(account.plan)&&!account.plan_until)throw fail('Вам уже выдан бессрочный тариф',409);
  let o=(await c.query('SELECT * FROM orders WHERE platform_user_id=$1 AND request_key=$2',[user.id,data.request_key])).rows[0];
  if(o && JSON.stringify(o.payload.input)!==JSON.stringify(JSON.parse(JSON.stringify(input)))){
   if(crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex')!==o.payload.input_hash)throw fail('Этот запрос уже использован. Откройте новую форму',409);
  }
  if(!o){
   const recent=(await c.query("SELECT COUNT(*)::int AS n FROM orders WHERE platform_user_id=$1 AND created_at>NOW()-INTERVAL '1 hour'",[user.id])).rows[0].n;
   if(recent>=20)throw fail('Слишком много новых заказов. Попробуйте через час',429);
   // Нельзя двумя кликами/двумя вкладками купить два периода или дважды один курс.
   const pending=(await c.query("SELECT * FROM orders WHERE platform_user_id=$1 AND status='pending' AND kind=$2 AND sku=$3 AND created_at>NOW()-INTERVAL '23 hours' ORDER BY created_at DESC LIMIT 1",[user.id,kind,kind==='subscription'?'plan:tutor':`course:${input.course_id}`])).rows[0];
   if(pending)throw fail('У вас уже есть незавершённая оплата. Откройте её в истории покупок или дождитесь отмены',409);
   let payload={input,input_hash:crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex')},amount,title;
   if(kind==='subscription'){
    const p=plans().PLANS.tutor;amount=data.period==='year'?p.year:p.price;title=`Тариф «Репетитор» — ${data.period==='year'?'год':'месяц'}`;
   }else{
    const course=(await c.query("SELECT * FROM public.marketplace_courses WHERE id=$1 AND status='published' FOR SHARE",[input.course_id])).rows[0];
    if(!course||course.price_type!=='paid'||course.currency!=='RUB'||!Number.isInteger(course.price_amount)||course.price_amount<=0||course.price_amount%100!==0)throw fail('Курс сейчас нельзя купить',409);
    if((await c.query('SELECT 1 FROM public.course_purchases WHERE buyer_id=$1 AND course_id=$2 AND is_active',[user.id,course.id])).rowCount)throw fail('Курс уже приобретён. Откройте «Мои курсы»',409);
    if(account.role!=='tutor'&&course.audience==='tutor')throw fail('Курс предназначен для преподавателей',403);
    payload.course={id:course.id,title:course.title,version:course.content_version,modules:course.modules,audience:course.audience||'both'};amount=course.price_amount/100;title=course.title;
   }
   if(amount*100!==data.quoted_amount)throw fail('Цена изменилась. Откройте форму покупки заново',409);
   const id=crypto.randomUUID(),token=crypto.randomBytes(24).toString('base64url');
   o=(await c.query("INSERT INTO orders(id,token,email,sku,title,amount_rub,kind,platform_user_id,request_key,payload,ip) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *",[id,token,email,kind==='subscription'?'plan:tutor':`course:${input.course_id}`,title,amount,kind,user.id,data.request_key,JSON.stringify(payload),ip])).rows[0];
   if(kind==='subscription'){
    if(!input.auto_renew)await c.query('UPDATE public.billing_profiles SET auto_renew=FALSE,payment_method_cipher=NULL,next_charge_at=NULL,revoked_at=NOW() WHERE tutor_id=$1',[user.id]);
    await c.query(`INSERT INTO public.billing_profiles(tutor_id,latest_intent_order_id) VALUES($1,$2) ON CONFLICT(tutor_id) DO UPDATE SET latest_intent_order_id=$2,updated_at=NOW()`,[user.id,id]);
   }
  }
  return o;
 });
 return beginPayment(order);
}
async function beginPayment(order,renewal=false){
 return db.transaction(async c=>{
  await c.query('SELECT id FROM public.users WHERE id=$1 FOR UPDATE',[order.platform_user_id]);
  const o=(await c.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[order.id])).rows[0];
  if(o.status!=='pending')return dto(o);
  let method;
  if(renewal){const p=(await c.query('SELECT * FROM public.billing_profiles WHERE tutor_id=$1 FOR UPDATE',[o.platform_user_id])).rows[0];
   if(!p?.auto_renew||p.consent_order_id!==o.payload.consent_order_id){await c.query("UPDATE orders SET status='canceled' WHERE id=$1 AND yk_payment_id IS NULL",[o.id]);return dto(o);}
   method=cipher(p.payment_method_cipher,true);
  }
  return payOrder(c,o,method);
 });
}
function dto(o){return {id:o.id,status:o.status,url:`${config.publicUrl}/o/${o.token}`,confirmation_url:o.confirmation_url||null};}
async function payOrder(c,o,methodId){
 if(o.yk_payment_id)return dto(o);
 if(Date.now()-new Date(o.created_at)>23*3600000)throw fail('Срок повторной оплаты истёк. Обратитесь в поддержку',409);
 const payment=await pay.createPayment({orderId:o.id,amountRub:o.amount_rub,email:o.email,description:o.title,returnUrl:`${config.publicUrl}/o/${o.token}`,saveMethod:o.payload.input?.auto_renew===true,methodId,subject:o.kind==='subscription'?'service':'intellectual_activity'});
 if(!payment.id)throw fail('Платёжный сервис не вернул номер платежа',502);
 const url=payment.confirmation?.confirmation_url||null;
 if(url && new URL(url).protocol!=='https:')throw fail('Некорректный адрес оплаты',502);
 await c.query('UPDATE orders SET yk_payment_id=$2,confirmation_url=$3 WHERE id=$1',[o.id,payment.id,url]);
 return dto({...o,yk_payment_id:payment.id,confirmation_url:url});
}
async function settle(order,pmt){
 await db.transaction(async c=>{
  // Один порядок блокировок с checkout/renew/cancel: сначала tutor, затем order/profile.
  const user=(await c.query('SELECT * FROM public.users WHERE id=$1 FOR UPDATE',[order.platform_user_id])).rows[0];
  const o=(await c.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[order.id])).rows[0];
  if(!o||o.status!=='pending')return;
  if(o.kind==='subscription'){
   const grants=(await c.query('SELECT * FROM public.billing_grants WHERE tutor_id=$1 AND revoked_at IS NULL ORDER BY starts_at',[user.id])).rows;
   const start=paidUntil(user,grants),end=addPeriod(start,o.payload.input.period);
   await c.query('INSERT INTO public.billing_grants(tutor_id,order_id,period,starts_at,ends_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(order_id) DO NOTHING',[user.id,o.id,o.payload.input.period,start,end]);
   const profile=(await c.query('SELECT * FROM public.billing_profiles WHERE tutor_id=$1 FOR UPDATE',[user.id])).rows[0];
   if(profile?.latest_intent_order_id===o.id){
    const auto=o.payload.input.auto_renew&&config.recurringEnabled&&pmt.payment_method?.saved===true;
    await c.query('UPDATE public.billing_profiles SET auto_renew=$2,period=$3,payment_method_cipher=$4,payment_method_label=$5,next_charge_at=$6,consent_order_id=$7,updated_at=NOW() WHERE tutor_id=$1',[user.id,!!auto,o.payload.input.period,auto?cipher(pmt.payment_method.id):null,auto?'Сохранённый способ ЮKassa':null,auto?end:null,auto?o.id:null]);
   }else if(o.payload.renewal && profile?.auto_renew && profile.consent_order_id===o.payload.consent_order_id){
    await c.query('UPDATE public.billing_profiles SET next_charge_at=$2,updated_at=NOW() WHERE tutor_id=$1',[user.id,end]);
   }
   await c.query("INSERT INTO public.billing_audit(tutor_id,event,order_id,details) VALUES($1,'paid',$2,$3)",[user.id,o.id,JSON.stringify({start,end,period:o.payload.input.period})]);
  }else if(o.kind==='course'){
   // Снимок сохраняет купленную редакцию; редактирование автором не меняет оплаченный материал.
   const course=o.payload.course;
   // Параллельный старый заказ не может выдать две покупки: вместо потери денег сохраняем заказ для возврата оператором.
   const existing=(await c.query('SELECT id FROM public.course_purchases WHERE buyer_id=$1 AND course_id=$2 AND is_active',[user.id,course.id])).rows[0];
   if(existing){await c.query("UPDATE orders SET auto_refund=TRUE,note='Повторная оплата курса: ожидается автоматический возврат' WHERE id=$1",[o.id]);}
   else {const p=(await c.query(`INSERT INTO public.course_purchases(course_id,buyer_id,buyer_type,payment_method,payment_id,amount_paid,currency,platform_fee,author_earnings,order_id,verified_at,content_snapshot)
    VALUES($1,$2,$7,'yookassa',$3,$4,'RUB',0,$4,$5,NOW(),$6) RETURNING id`,[course.id,user.id,o.yk_payment_id,o.amount_rub*100,o.id,JSON.stringify(course),user.role==='tutor'?'tutor':'student'])).rows[0];
   await c.query('INSERT INTO public.marketplace_enrollments(purchase_id,user_id) VALUES($1,$2)',[p.id,user.id]);}
  }else throw Error('Неизвестный тип заказа');
  await c.query("UPDATE orders SET status='paid',paid_at=NOW() WHERE id=$1",[o.id]);
  await c.query("INSERT INTO order_mail_jobs(id,order_id,kind) SELECT $1,id,'paid' FROM orders WHERE id=$2 AND NOT auto_refund ON CONFLICT DO NOTHING",['paid:'+o.id,o.id]);
 });
 const updated=await orders().byId(order.id);
 if(updated.auto_refund){try{return await orders().refund(order.id);}catch(e){console.error('duplicate payment refund pending',order.id,e.message);return updated;}}
 require('./mail-queue').flush({orderId:order.id}).catch(e=>console.error('commerce mail queue',e.message));
 return orders().byId(order.id);
}
async function revoke(c,o){
 if(o.kind==='subscription'){
  await c.query('UPDATE public.billing_grants SET revoked_at=NOW() WHERE order_id=$1',[o.id]);
  await c.query("UPDATE public.billing_profiles SET auto_renew=FALSE,payment_method_cipher=NULL,next_charge_at=NULL,latest_intent_order_id=NULL,revoked_at=NOW() WHERE tutor_id=$1",[o.platform_user_id]);
  await c.query("INSERT INTO public.billing_audit(tutor_id,event,order_id) VALUES($1,'refunded',$2)",[o.platform_user_id,o.id]);
 }else if(o.kind==='course')await c.query('UPDATE public.course_purchases SET is_active=FALSE,refunded_at=NOW() WHERE order_id=$1',[o.id]);
}
async function cancel(tutorId){
 if(!await available())throw fail('Магазин не настроен',503);
 await db.transaction(async c=>{
  await c.query('SELECT id FROM public.users WHERE id=$1 FOR UPDATE',[tutorId]);
  await c.query("INSERT INTO public.billing_profiles(tutor_id,revoked_at) VALUES($1,NOW()) ON CONFLICT(tutor_id) DO UPDATE SET auto_renew=FALSE,payment_method_cipher=NULL,payment_method_label=NULL,next_charge_at=NULL,latest_intent_order_id=NULL,revoked_at=NOW(),updated_at=NOW()",[tutorId]);
  await c.query("INSERT INTO public.billing_audit(tutor_id,event) VALUES($1,'auto_renew_disabled')",[tutorId]);
 });return {ok:true};
}
async function renewDue(){
 if(!config.recurringEnabled||!await available())return;
 const due=(await db.q('SELECT tutor_id FROM public.billing_profiles WHERE auto_renew AND next_charge_at<=NOW() ORDER BY next_charge_at LIMIT 50')).rows;
 for(const row of due){
  try{
   const renewalOrder=await db.transaction(async c=>{
    const u=(await c.query('SELECT id,is_active,email FROM public.users WHERE id=$1 FOR UPDATE',[row.tutor_id])).rows[0];
    const p=(await c.query('SELECT * FROM public.billing_profiles WHERE tutor_id=$1 FOR UPDATE',[row.tutor_id])).rows[0];
    if(!u?.is_active||!p.auto_renew||!p.payment_method_cipher||!p.next_charge_at||new Date(p.next_charge_at)>new Date())return;
    // Не более одной попытки списания на период, включая сбои сети и несколько процессов.
    const key=`renew:${p.consent_order_id}:${new Date(p.next_charge_at).toISOString()}`;
    let o=(await c.query('SELECT * FROM orders WHERE platform_user_id=$1 AND request_key=$2',[u.id,key])).rows[0];
    if(!o){
     const original=await orders().byId(p.consent_order_id);
     if(!original||original.refund_state==='pending'||original.status!=='paid')return;
     const id=crypto.randomUUID(),token=crypto.randomBytes(24).toString('base64url'),payload={input:{period:p.period,auto_renew:false},renewal:true,consent_order_id:p.consent_order_id};
     const price=p.period==='year'?plans().PLANS.tutor.year:plans().PLANS.tutor.price;
     // При изменении цены требуется новое согласие: старую подписку не списываем по новой цене.
     if(price!==original.amount_rub){await c.query('UPDATE public.billing_profiles SET auto_renew=FALSE,payment_method_cipher=NULL,next_charge_at=NULL WHERE tutor_id=$1',[u.id]);return;}
     o=(await c.query("INSERT INTO orders(id,token,email,sku,title,amount_rub,kind,platform_user_id,request_key,payload) VALUES($1,$2,$3,'plan:tutor','Продление тарифа «Репетитор»',$4,'subscription',$5,$6,$7) RETURNING *",[id,token,original.email,price,u.id,key,JSON.stringify(payload)])).rows[0];
    }
    return o;
   });
   if(renewalOrder?.status==='pending'){await beginPayment(renewalOrder,true);const created=await orders().byId(renewalOrder.id);if(created.yk_payment_id)await orders().sync(created);}
  }catch(e){console.error('subscription renewal failed',row.tutor_id,e.message);}
 }
 // Все созданные списания сверяются тем же механизмом, что и платежи с переходом.
}
function letter(o){
 const esc=require('./delivery').escapeHtml,url=config.platformUrl+(o.kind==='subscription'?'/#/settings/plan':'/#/marketplace/mine');
 return {subject:`Покупка Lessonfold: ${o.title}`,text:`Оплачен заказ ${orders().shortId(o)}: ${o.title}, ${o.amount_rub} ₽.\nОткрыть в кабинете: ${url}\nСтатус заказа: ${config.publicUrl}/o/${o.token}\nЕсли письмо пришло по ошибке, свяжитесь с support@lessonfold.ru.`,html:`<p>Оплачен заказ ${orders().shortId(o)}: ${esc(o.title)}, ${o.amount_rub} ₽.</p><p><a href="${url}">Открыть в кабинете Lessonfold</a></p><p>Войдите под аккаунтом, с которого оформлена покупка.</p>`};
}
module.exports={beginPayment,TERMS,addPeriod,paidUntil,cipher,available,status,checkout,settle,revoke,cancel,renewDue,dto};
