'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('crypto');
test('platform commerce: ЮKassa, права на курсы и повторные уведомления',{skip:!process.env.TEST_PLATFORM_COMMERCE_DATABASE_URL},async t=>{
 process.env.PLATFORM_OWNER_NAME='Test Seller';process.env.PLATFORM_OWNER_INN='000000000000';process.env.PLATFORM_EMAIL='seller@example.test';
 process.env.DATABASE_URL=process.env.TEST_PLATFORM_COMMERCE_DATABASE_URL;process.env.LF_DATABASE_URL=process.env.DATABASE_URL;process.env.LF_DB_SCHEMA='platform_commerce_fixture';process.env.LF_PUBLIC_URL='https://shop.example.test';process.env.JWT_SECRET='platform-commerce-fixture-secret-at-least-32';
 const {query,pool}=require('../src/db');await require('../src/services/migrate').migrate({log:()=>{}});await require('../src/services/schema').ensureAll();
 const db=require('../lessonfold/src/db'),store=require('../lessonfold/src/store'),orders=require('../lessonfold/src/orders'),pay=require('../lessonfold/src/pay'),commerce=require('../lessonfold/src/commerce'),plans=require('../src/services/plans'),{config}=require('../lessonfold/src/config');
 require('../lessonfold/src/embed').isReady=()=>true;
 config.payEnabled=true;config.mailEnabled=false;config.recurringEnabled=true;
 await db.migrate();await store.migrate();await orders.migrate();await db.kvSet('settings',JSON.stringify({seller:{name:'Test Seller',inn:'000000000000',email:'seller@example.test'}}));
 const users=[],payments=new Map();let starts=0,throwAfterCreate=false;
 const user=async(role='tutor',tid=null)=>{const u=(await query("INSERT INTO users(role,login,password_hash,full_name,tutor_id,plan,plan_until) VALUES($1,$2,'test','Fixture',$3,'start',NULL) RETURNING *",[role,'comm_'+randomUUID().slice(0,15),tid])).rows[0];users.push(u);return {...u,tid:u.role==='tutor'?u.id:tid};};
 pay.createPayment=async x=>{let p=[...payments.values()].find(p=>p.metadata.order_id===x.orderId);if(!p){starts++;p={id:randomUUID(),status:'pending',paid:false,amount:{value:Number(x.amountRub).toFixed(2),currency:'RUB'},metadata:{order_id:x.orderId},payment_method:{id:'saved-method-private-token',saved:true},confirmation:{confirmation_url:'https://pay.example.test/'+x.orderId}};payments.set(p.id,p);}if(throwAfterCreate)throw Error('fixture timeout after provider created payment');return p;};
 pay.getPayment=async id=>payments.get(id);
 const payOrder=async id=>{const o=await orders.byId(id);Object.assign(payments.get(o.yk_payment_id),{status:'succeeded',paid:true});return orders.sync(o);};
 const body=(extra={})=>({quoted_amount:extra.course_id?120000:49900,request_key:randomUUID(),email:'buyer@example.test',offer_accept:true,period:'month',terms_version:commerce.TERMS,...extra});
 const express=require('express'),auth=require('../src/middleware/auth'),market=require('../src/routes/marketplace');
 const app=express();app.use(express.json({limit:'2mb'}));app.use('/public',market.publicRouter);app.use(auth.authenticate);app.use('/marketplace',market.router);app.use('/billing',require('../src/routes/payments'));app.use((err,req,res,next)=>res.status(err.status||500).json({error:err.message}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
 const req=async(u,path,method='GET',data)=>{const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(u?{Authorization:'Bearer '+auth.signToken(u)}:{})},body:data?JSON.stringify(data):undefined});return {status:response.status,body:await response.json()};};
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await db.close();await pool.end();});
 await t.test('месяц и год учитывают конец месяца, включая 29 февраля',()=>{assert.equal(commerce.addPeriod('2027-01-31T10:20:00Z','month').toISOString(),'2027-02-28T10:20:00.000Z');assert.equal(commerce.addPeriod('2028-02-29T10:20:00Z','year').toISOString(),'2029-02-28T10:20:00.000Z');});
 await t.test('сумма серверная, до подтверждения доступа нет, два webhook дают один период',async()=>{
  const u=await user(),b=body({amount:1}),r=await commerce.checkout(u,b,'subscription'),o=await orders.byId(r.id);assert.equal(o.amount_rub,499);assert.equal((await plans.planOf(u.id)).id,'start');
  await orders.webhook({event:'payment.succeeded',object:{id:o.yk_payment_id}});assert.equal((await plans.planOf(u.id)).id,'start');
  payments.get(o.yk_payment_id).amount.value='1.00';Object.assign(payments.get(o.yk_payment_id),{status:'succeeded',paid:true});await orders.sync(o);assert.equal((await plans.planOf(u.id)).id,'start');
  payments.get(o.yk_payment_id).amount.value='499.00';await Promise.all([orders.sync(o),orders.sync(o)]);assert.equal((await plans.planOf(u.id)).id,'tutor');assert.equal((await query('SELECT * FROM billing_grants WHERE tutor_id=$1',[u.id])).rowCount,1);assert.equal((await db.q('SELECT * FROM order_mail_jobs WHERE order_id=$1',[o.id])).rowCount,1);
  assert.equal((await commerce.checkout(u,b,'subscription')).id,o.id);await assert.rejects(commerce.checkout(u,{...b,period:'year'},'subscription'),/использован/);
 });
 await t.test('таймаут не теряет заказ: повтор использует тот же idempotence key',async()=>{
  const u=await user(),b=body();throwAfterCreate=true;const before=starts;await assert.rejects(commerce.checkout(u,b,'subscription'),/timeout/);assert.equal((await db.q('SELECT * FROM orders WHERE platform_user_id=$1',[u.id])).rowCount,1);
  throwAfterCreate=false;const r=await commerce.checkout(u,b,'subscription');assert.equal(starts,before+1);await payOrder(r.id);assert.equal((await plans.planOf(u.id)).id,'tutor');
 });
 await t.test('отключение не даёт старому checkout повторно включить автосписание',async()=>{
  const u=await user();await assert.rejects(commerce.checkout(u,body({auto_renew:true}),'subscription'),/согласие/);
  const r=await commerce.checkout(u,body({auto_renew:true,recurring_accept:true}),'subscription');await commerce.cancel(u.id);await payOrder(r.id);
  assert.equal((await commerce.status(u.id)).profile.auto_renew,false);assert.equal((await plans.planOf(u.id)).id,'tutor');
 });
 await t.test('автопродление зашифровано, два фоновых процесса создают один платёж',async()=>{
  const u=await user(),r=await commerce.checkout(u,body({auto_renew:true,recurring_accept:true}),'subscription');await payOrder(r.id);
  let p=(await query('SELECT * FROM billing_profiles WHERE tutor_id=$1',[u.id])).rows[0];assert.equal(p.auto_renew,true);assert.ok(!p.payment_method_cipher.includes('saved-method'));assert.equal(commerce.cipher(p.payment_method_cipher,true),'saved-method-private-token');
  await query("UPDATE billing_profiles SET next_charge_at=NOW()-INTERVAL '1 second' WHERE tutor_id=$1",[u.id]);const n=starts;await Promise.all([commerce.renewDue(),commerce.renewDue()]);assert.equal(starts,n+1);
  const o=(await db.q("SELECT * FROM orders WHERE platform_user_id=$1 AND payload->>'renewal'='true'",[u.id])).rows[0];await payOrder(o.id);assert.equal((await query('SELECT * FROM billing_grants WHERE tutor_id=$1',[u.id])).rowCount,2);
  await commerce.cancel(u.id);await query("UPDATE billing_profiles SET next_charge_at=NOW()-INTERVAL '1 second' WHERE tutor_id=$1",[u.id]);const end=starts;await commerce.renewDue();assert.equal(starts,end);
 });
 let course,buyer,purchase,enrollment;
 await t.test('витрина скрывает контент и ответы, покупка выдаёт неизменяемую редакцию',async()=>{
  buyer=await user();course=(await query("INSERT INTO marketplace_courses(author_id,title,slug,description,modules,status,price_type,price_amount,currency) VALUES($1,'Fixture course',$2,'Original description',$3,'published','paid',120000,'RUB') RETURNING *",[buyer.id,'fixture-'+randomUUID(),JSON.stringify([{title:'Part one',units:[{title:'Original rule',type:'text',content:'PRIVATE PAID RULE'},{title:'Practice',type:'quiz',questions:[{id:'q1',type:'text',prompt:'Complete: I … a tutor.',options:[],correct:['am'],points:1}]},{title:'Writing',type:'assignment',content:'Write an original sentence.'}]}])])).rows[0];
  const publicPage=await req(null,'/public/courses/'+course.slug);assert.equal(publicPage.status,200);assert.ok(!JSON.stringify(publicPage.body).includes('PRIVATE'));assert.ok(!JSON.stringify(publicPage.body).includes('correct'));
  const r=await commerce.checkout(buyer,body({course_id:course.id}),'course');await payOrder(r.id);purchase=(await query('SELECT * FROM course_purchases WHERE order_id=$1',[r.id])).rows[0];enrollment=(await query('SELECT * FROM marketplace_enrollments WHERE purchase_id=$1',[purchase.id])).rows[0];
  await query("UPDATE marketplace_courses SET modules='[]',title='Changed after sale' WHERE id=$1",[course.id]);const access=await req(buyer,'/marketplace/enrollments/'+enrollment.id);assert.equal(access.status,200);assert.equal(access.body.modules[0].units[0].content,'PRIVATE PAID RULE');assert.ok(!access.body.modules[0].units[1].questions[0].correct);
  const foreign=await user();assert.equal((await req(foreign,'/marketplace/enrollments/'+enrollment.id)).status,404);
  assert.equal((await req(buyer,'/marketplace/enrollments/'+enrollment.id+'/attempt','POST',{module_index:0,unit_index:1,answers:{q1:'am'},result:{score:0}})).body.score,100);
 });
 await t.test('ученик видит только назначенное, родитель только читает; ответы оценивает сервер',async()=>{
  const studentUser=await user('student',buyer.id),parent=await user('parent',buyer.id),outsider=await user();
  const s=(await query("INSERT INTO students(user_id,tutor_id,full_name,category) VALUES($1,$2,'Fixture student','adult') RETURNING *",[studentUser.id,buyer.id])).rows[0];await query('INSERT INTO parent_students(parent_user_id,student_id) VALUES($1,$2)',[parent.id,s.id]);
  const assigned=await req(buyer,`/marketplace/purchases/${purchase.id}/assign`,'POST',{student_id:s.id});assert.equal(assigned.status,200);const id=assigned.body.id;
  assert.equal((await req(outsider,`/marketplace/purchases/${purchase.id}/assign`,'POST',{student_id:s.id})).status,404);
  assert.equal((await req(studentUser,`/marketplace/enrollments/${id}`)).status,200);assert.equal((await req(parent,`/marketplace/enrollments/${id}`)).body.read_only,true);
  assert.equal((await req(parent,`/marketplace/enrollments/${id}/attempt`,'POST',{module_index:0,unit_index:1,answers:{q1:'am'}})).status,403);
  assert.equal((await req(studentUser,`/marketplace/enrollments/${id}/attempt`,'POST',{module_index:0,unit_index:1,answers:{q1:'is'},score:100})).body.score,0);
 });
 await t.test('возврат pending сохраняет доступ; succeeded отзывает только соответствующую покупку',async()=>{
  const o=(await db.q('SELECT * FROM orders WHERE id=$1',[purchase.order_id])).rows[0];let state={id:'refund-'+randomUUID(),payment_id:o.yk_payment_id,status:'pending',amount:{value:o.amount_rub.toFixed(2),currency:'RUB'}};pay.refund=async()=>state;pay.getRefund=async()=>state;
  await orders.refund(o.id);assert.equal((await req(buyer,'/marketplace/enrollments/'+enrollment.id)).status,200);state.status='succeeded';await orders.refund(o.id);assert.equal((await req(buyer,'/marketplace/enrollments/'+enrollment.id)).status,404);
  const u=await user();await query("UPDATE users SET plan='tutor',plan_until=NOW()+INTERVAL '1 year' WHERE id=$1",[u.id]);const r=await commerce.checkout(u,body(),'subscription');await payOrder(r.id);const so=await orders.byId(r.id);state={...state,id:'refund-'+randomUUID(),payment_id:so.yk_payment_id,amount:{value:'499.00',currency:'RUB'}};await orders.refund(so.id);assert.equal((await plans.planOf(u.id)).id,'tutor');
 });
 await t.test('поздний дублирующий платёж возвращается без отзыва первой покупки',async()=>{
  const u=await user();const template=(await orders.byId(purchase.order_id)).payload.course;
  await query("UPDATE marketplace_courses SET modules=$2 WHERE id=$1",[course.id,JSON.stringify(template.modules)]);
  const old=await commerce.checkout(u,body({course_id:course.id}),'course');await db.q("UPDATE orders SET created_at=NOW()-INTERVAL '24 hours' WHERE id=$1",[old.id]);
  const recent=await commerce.checkout(u,body({course_id:course.id}),'course');await payOrder(recent.id);
  pay.refund=async x=>({id:'refund-'+randomUUID(),payment_id:x.paymentId,status:'succeeded',amount:{value:Number(x.amountRub).toFixed(2),currency:'RUB'}});
  await payOrder(old.id);assert.equal((await orders.byId(old.id)).status,'refunded');
  const purchases=(await query('SELECT * FROM course_purchases WHERE buyer_id=$1 AND is_active',[u.id])).rows;assert.equal(purchases.length,1);assert.equal(purchases[0].order_id,recent.id);
 });

 await t.test('внешний частичный возврат учитывается; полный возврат возвращает остаток',async()=>{
  const u=await user(),r=await commerce.checkout(u,body(),'subscription');await payOrder(r.id);const o=await orders.byId(r.id);
  pay.getRefund=async()=>({id:'partial-'+o.id,payment_id:o.yk_payment_id,status:'succeeded',amount:{value:'99.00',currency:'RUB'}});
  await orders.webhook({event:'refund.succeeded',object:{id:'partial-'+o.id,payment_id:o.yk_payment_id}});assert.equal(Number((await orders.byId(o.id)).refunded_rub),99);assert.equal((await plans.planOf(u.id)).id,'tutor');
  let amount;pay.refund=async x=>{amount=x.amountRub;return {id:'rest-'+o.id,payment_id:o.yk_payment_id,status:'succeeded',amount:{value:Number(x.amountRub).toFixed(2),currency:'RUB'}};};
  await orders.refund(o.id);assert.equal(amount,400);assert.equal((await orders.byId(o.id)).status,'refunded');assert.equal((await plans.planOf(u.id)).id,'start');
 });

 await t.test('публикация доступна администратору, нормализует вопросы; изменение цены требует обновления формы',async()=>{
  const author=await user();assert.equal((await req(author,'/marketplace/author','POST',{})).status,403);
  await query('UPDATE users SET is_admin=TRUE WHERE id=$1',[author.id]);
  const created=await req(author,'/marketplace/author','POST',{});assert.equal(created.status,201);const id=created.body.id;
  const data={title:'Original course',description:'Original description',category:'english',level:'beginner',price_type:'paid',price_amount:120000,modules:[{title:'Module',units:[{title:'Quiz',type:'quiz',questions:[{id:'q1',type:'text',prompt:'Complete the sentence.',correct:['am']}]}]}]};
  assert.equal((await req(author,`/marketplace/author/${id}`,'PUT',data)).status,200);
  assert.equal((await req(author,`/marketplace/author/${id}/publish`,'POST',{})).status,422);
  assert.equal((await req(author,`/marketplace/author/${id}/publish`,'POST',{rights_confirmed:true})).status,200);
  const saved=(await query('SELECT * FROM marketplace_courses WHERE id=$1',[id])).rows[0];assert.ok(saved.rights_confirmed_at);assert.equal(saved.modules[0].units[0].questions[0].points,1);
  await query("UPDATE marketplace_courses SET audience='self',outcomes='[\"Keep my outcomes\"]',estimated_hours=2 WHERE id=$1",[id]);
  assert.equal((await req(author,`/marketplace/author/${id}`,'PUT',data)).status,200);const kept=(await query('SELECT audience,outcomes,estimated_hours FROM marketplace_courses WHERE id=$1',[id])).rows[0];assert.deepEqual(kept,{audience:'self',outcomes:['Keep my outcomes'],estimated_hours:2});
  assert.equal((await req(author,`/marketplace/author/${id}/publish`,'POST',{rights_confirmed:true})).status,200);
  const u=await user();await assert.rejects(commerce.checkout(u,body({course_id:id,quoted_amount:100}),'course'),/Цена изменилась/);assert.equal((await db.q('SELECT * FROM orders WHERE platform_user_id=$1',[u.id])).rowCount,0);
 });

 await t.test('самостоятельный покупатель оплачивает личный курс, повторная сверка не дублирует доступ, возврат отзывает его',async()=>{
  const u=await user('learner'),author=await user();
  const course=(await query("INSERT INTO marketplace_courses(author_id,title,slug,status,price_type,price_amount,currency,modules,audience) VALUES($1,'Independent',$2,'published','paid',120000,'RUB',$3,'self') RETURNING *",[author.id,'independent-'+randomUUID(),JSON.stringify([{title:'Module',units:[{title:'Read',type:'text',content:'Original practice'}]}])])).rows[0];
  await assert.rejects(commerce.checkout(u,body(),'subscription'),/недоступен/);
  const r=await commerce.checkout(u,body({course_id:course.id}),'course');assert.equal((await req(u,'/marketplace/mine')).body.length,0);
  await payOrder(r.id);await orders.sync(await orders.byId(r.id));const mine=(await req(u,'/marketplace/mine')).body;assert.equal(mine.length,1);assert.equal((await req(u,'/marketplace/enrollments/'+mine[0].enrollment_id)).body.read_only,false);
  assert.equal((await query('SELECT buyer_type FROM course_purchases WHERE order_id=$1',[r.id])).rows[0].buyer_type,'student');
  assert.equal((await req(u,'/marketplace/purchases/'+mine[0].purchase_id+'/assign','POST',{student_id:1})).status,403);
  pay.refund=async x=>({id:'learner-refund-'+x.paymentId,payment_id:x.paymentId,status:'succeeded',amount:{value:Number(x.amountRub).toFixed(2),currency:'RUB'}});
  await orders.refund(r.id);assert.equal((await req(u,'/marketplace/mine')).body.length,0);assert.equal((await req(u,'/marketplace/enrollments/'+mine[0].enrollment_id)).status,404);
 });
 await t.test('личный покупатель не может купить курс для преподавателя, а parent может учиться в собственной покупке',async()=>{
  const author=await user(),u=await user('learner'),parent=await user('parent',author.id);
  const course=(await query("INSERT INTO marketplace_courses(author_id,title,slug,status,price_type,price_amount,currency,modules,audience) VALUES($1,'Teacher course',$2,'published','paid',120000,'RUB',$3,'tutor') RETURNING *",[author.id,'teacher-'+randomUUID(),JSON.stringify([{title:'Module',units:[{title:'Read',type:'text',content:'Original'},{title:'Write',type:'assignment',content:'Write your own sentence.'}]}])])).rows[0];
  await assert.rejects(commerce.checkout(u,body({course_id:course.id}),'course'),/преподавателей/);await query("UPDATE marketplace_courses SET audience='both' WHERE id=$1",[course.id]);
  const r=await commerce.checkout(parent,body({course_id:course.id}),'course');await payOrder(r.id);const mine=(await req(parent,'/marketplace/mine')).body;assert.equal(mine.length,1);const e=mine[0].enrollment_id;assert.equal((await req(parent,'/marketplace/enrollments/'+e)).body.read_only,false);assert.equal((await req(parent,'/marketplace/enrollments/'+e+'/attempt','POST',{module_index:0,unit_index:0,answers:{}})).status,200);
  const childUser=await user('student',author.id),child=(await query("INSERT INTO students(user_id,tutor_id,full_name,category) VALUES($1,$2,'Family fixture','adult') RETURNING id",[childUser.id,author.id])).rows[0];await query('INSERT INTO parent_students(parent_user_id,student_id) VALUES($1,$2)',[parent.id,child.id]);
  const assigned=await req(parent,'/marketplace/purchases/'+mine[0].purchase_id+'/assign','POST',{student_id:child.id});assert.equal(assigned.status,200);const eid=assigned.body.id;assert.equal((await req(parent,'/marketplace/enrollments/'+eid)).body.read_only,true);assert.equal((await req(childUser,'/marketplace/enrollments/'+eid)).body.requires_review,false);assert.equal((await req(childUser,'/marketplace/enrollments/'+eid+'/attempt','POST',{module_index:0,unit_index:1,answers:{},response:'My own answer.'})).body.pending_review,false);
  assert.equal((await req(parent,'/marketplace/enrollments/'+eid+'/attempt','POST',{module_index:0,unit_index:1,answers:{},response:'Answer as a parent'})).status,403);
 });

 await t.test('существующий совершеннолетний ученик покупает свой курс без подписки преподавателя',async()=>{
  const author=await user(),u=await user('student',author.id);await query("INSERT INTO students(user_id,tutor_id,full_name,category) VALUES($1,$2,'Adult student','adult')",[u.id,author.id]);
  const c=(await query("INSERT INTO marketplace_courses(author_id,title,slug,status,price_type,price_amount,currency,modules) VALUES($1,'Adult self course',$2,'published','paid',120000,'RUB',$3) RETURNING id",[author.id,'adult-'+randomUUID(),JSON.stringify([{title:'Module',units:[{title:'Read',type:'text',content:'Original'}]}])])).rows[0];
  const r=await commerce.checkout(u,body({course_id:c.id}),'course');await payOrder(r.id);assert.equal((await req(u,'/marketplace/mine')).body.length,1);assert.equal((await plans.planOf(u.id)).id,'start');
 });

});
