const test=require('node:test'),assert=require('node:assert/strict');
test('commerce: оплата, очередь писем и PDF-вложения',{skip:!process.env.TEST_COMMERCE_DATABASE_URL},async t=>{
 process.env.LF_DATABASE_URL=process.env.TEST_COMMERCE_DATABASE_URL;process.env.LF_DB_SCHEMA='commerce_fixture';process.env.LF_PUBLIC_URL='https://shop.lessonfold.test';process.env.LF_BOT_TOKEN='';process.env.BOT_TOKEN='';
 const {config}=require('../lessonfold/src/config');config.payEnabled=true;config.mailEnabled=true;
 const db=require('../lessonfold/src/db'),store=require('../lessonfold/src/store'),catalog=require('../lessonfold/src/catalog'),orders=require('../lessonfold/src/orders'),queue=require('../lessonfold/src/mail-queue'),mail=require('../lessonfold/src/mail'),pay=require('../lessonfold/src/pay');
 await db.migrate();await store.migrate();await orders.migrate();t.after(()=>db.close());
 const pdfDoc=await require('pdf-lib').PDFDocument.create();pdfDoc.addPage([300,200]);const pdf=Buffer.from(await pdfDoc.save());
 for(const sku of ['demo-first','demo-second']){await store.putFile(`lesson/${sku}/html`,'text/html; charset=utf-8',Buffer.from('<!doctype html><p>Original lesson {{BUYER}}</p>'),'fixture');await store.putFile(`lesson/${sku}/pdf`,'application/pdf',pdf,'fixture');}
 const products={};for(const [i,sku]of ['demo-first','demo-second'].entries())products[sku]={title:'Original lesson '+i,name:'Original lesson '+i,type:'lesson',book:'original',grade:'A1',module:'module',moduleTitle:'Original collection',status:i?'soon':'available',price:249,files:{html:`db:lesson/${sku}/html`,pdf:`db:lesson/${sku}/pdf`},fileName:sku};
 products['demo-pack']={title:'Original collection',type:'pack',book:'original',grade:'A1',module:'module',moduleTitle:'Original collection',status:'preorder',price:399,includes:['demo-first','demo-second']};
 const raw={textbooks:[{id:'original',title:'Original materials'}],products};await db.kvSet('catalog',JSON.stringify(raw));await catalog.loadFromDb();await db.kvSet('settings',JSON.stringify({seller:{name:'Test Seller',inn:'000000000000',email:'seller@example.test'}}));
 const payments=new Map(),delivered=[];let failure=false;
 pay.createPayment=async x=>{const id='fixture-'+require('crypto').randomUUID();payments.set(id,{id,status:'pending',paid:false,metadata:{order_id:x.orderId},amount:{value:x.amountRub.toFixed(2),currency:'RUB'}});return {id,confirmation:{confirmation_url:'https://pay.example.test/'+id}};};pay.getPayment=async id=>payments.get(id);
 mail.send=async m=>{if(failure)return {sent:false,error:'fixture temporary SMTP failure'};delivered.push(m);return {sent:true};};
 const until=async fn=>{for(let i=0;i<100;i++){if(await fn())return;await new Promise(r=>setTimeout(r,10));}throw Error('Fixture timed out');};
 const make=async(sku='demo-first',email='buyer@example.test')=>orders.create({sku,email,news:false,ip:'fixture-'+Math.random()});
 const paid=async o=>{Object.assign(payments.get(o.yk_payment_id),{status:'succeeded',paid:true});return orders.sync(o);};
 let main;
 await t.test('email обязателен, сумма берётся из каталога, неподтверждённый webhook ничего не выдаёт',async()=>{
  await assert.rejects(make('demo-first','bad-address'),/почты/);const made=await make();main=await orders.byId(made.order.id);assert.equal(main.amount_rub,249);assert.equal(main.email,'buyer@example.test');
  await orders.webhook({event:'payment.succeeded',object:{id:main.yk_payment_id,paid:true}});assert.equal((await orders.byId(main.id)).status,'pending');assert.equal(delivered.length,0);
 });
 await t.test('неверная сумма не открывает файлы и не создаёт письмо',async()=>{
  const made=await make(),o=await orders.byId(made.order.id),p=payments.get(o.yk_payment_id);Object.assign(p,{status:'succeeded',paid:true,amount:{value:'1.00',currency:'RUB'}});await orders.sync(o);assert.equal((await orders.byId(o.id)).status,'pending');assert.equal((await db.q('SELECT 1 FROM order_mail_jobs WHERE order_id=$1',[o.id])).rowCount,0);
 });
 await t.test('сбой почты не отменяет оплату; повторная попытка отправляет письмо с персональным PDF',async()=>{
  failure=true;await paid(main);await until(async()=>Boolean((await db.q('SELECT last_error FROM order_mail_jobs WHERE order_id=$1',[main.id])).rows[0]?.last_error));
  assert.equal((await orders.byId(main.id)).status,'paid');assert.equal((await orders.byId(main.id)).emailed_at,null);assert.equal((await db.q('SELECT * FROM order_mail_jobs WHERE order_id=$1',[main.id])).rowCount,1);
  failure=false;await db.q('UPDATE order_mail_jobs SET next_at=NOW() WHERE order_id=$1',[main.id]);await Promise.all([queue.flush({orderId:main.id}),queue.flush({orderId:main.id})]);
  assert.ok((await orders.byId(main.id)).emailed_at);assert.equal(delivered.filter(m=>m.to===main.email).length,1);const message=delivered.at(-1);assert.match(message.text,new RegExp(main.token));assert.equal(message.attachments.length,1);assert.match(message.attachments[0].filename,/Teacher\.pdf$/);assert.ok((await require('pdf-lib').PDFDocument.load(message.attachments[0].data)).getPageCount()===1);
  await Promise.all([orders.webhook({event:'payment.succeeded',object:{id:main.yk_payment_id}}),orders.webhook({event:'payment.succeeded',object:{id:main.yk_payment_id}})]);assert.equal(delivered.length,1);assert.equal((await db.q('SELECT 1 FROM order_mail_jobs WHERE order_id=$1',[main.id])).rowCount,1);
 });
 await t.test('пока SMTP не настроен, оплаченная покупка остаётся в очереди без ложного «отправлено»',async()=>{
  config.mailEnabled=false;const x=await make('demo-first','second@example.test'),o=await orders.byId(x.order.id);await paid(o);const job=(await db.q('SELECT * FROM order_mail_jobs WHERE order_id=$1',[o.id])).rows[0];assert.equal(job.attempts,0);assert.equal(job.sent_at,null);assert.equal((await orders.byId(o.id)).emailed_at,null);
  config.mailEnabled=true;await queue.flush({orderId:o.id});assert.ok((await orders.byId(o.id)).emailed_at);
 });
 await t.test('выход нового урока пакета ставит письмо в очередь атомарно и переживает сбой',async()=>{
  const x=await make('demo-pack','pack@example.test'),o=await orders.byId(x.order.id);await paid(o);await until(async()=>Boolean((await orders.byId(o.id)).emailed_at));
  raw.products['demo-second'].status='available';await db.kvSet('catalog',JSON.stringify(raw));await catalog.loadFromDb();failure=true;await orders.releases();const key=`release:${o.id}:demo-second`;let row=(await db.q('SELECT * FROM order_mail_jobs WHERE id=$1',[key])).rows[0];assert.ok(row);assert.equal(row.sent_at,null);assert.ok(row.last_error);
  await orders.releases();assert.equal((await db.q('SELECT 1 FROM order_mail_jobs WHERE id=$1',[key])).rowCount,1);failure=false;await db.q('UPDATE order_mail_jobs SET next_at=NOW() WHERE id=$1',[key]);await queue.flush({jobId:key});assert.ok((await db.q('SELECT sent_at FROM order_mail_jobs WHERE id=$1',[key])).rows[0].sent_at);
 });
 await t.test('восстановление отправляет только оплаченные заказы; возврат отменяет ожидающую выдачу',async()=>{
  const before=delivered.length;await orders.restore('nobody@example.test');assert.equal(delivered.length,before);await orders.restore(main.email);assert.equal(delivered.length,before+1);assert.match(delivered.at(-1).text,new RegExp(main.token));
  config.mailEnabled=false;const x=await make('demo-first','refund@example.test'),o=await orders.byId(x.order.id);await paid(o);await db.q("UPDATE orders SET status='refunded' WHERE id=$1",[o.id]);config.mailEnabled=true;await queue.flush({orderId:o.id});assert.ok((await db.q('SELECT canceled_at FROM order_mail_jobs WHERE order_id=$1',[o.id])).rows[0].canceled_at);assert.ok(!delivered.some(m=>m.to==='refund@example.test'));
 });
 await t.test('возврат не завершает заказ до подтверждения платёжного сервиса',async()=>{
  const x=await make('demo-first','refund-flow@example.test'),o=await orders.byId(x.order.id);await paid(o);await until(async()=>Boolean((await orders.byId(o.id)).emailed_at));
  let state={id:'refund-fixture',payment_id:o.yk_payment_id,status:'pending',amount:{value:'249.00',currency:'RUB'}};let created=0;
  pay.refund=async()=>{created++;return state;};pay.getRefund=async()=>state;
  assert.equal((await orders.refund(o.id)).status,'paid');assert.equal((await orders.refund(o.id)).refund_state,'pending');assert.equal(created,1);
  state={...state,status:'succeeded'};await orders.webhook({event:'refund.succeeded',object:{id:state.id,payment_id:o.yk_payment_id}});assert.equal((await orders.byId(o.id)).status,'refunded');
 });
 await t.test('MIME содержит PDF-вложение и UTF-8; заголовки защищены от переносов строк',()=>{
  const m=require('../lessonfold/src/mail').buildMessage({from:'materials@lessonfold.ru',fromName:'Lessonfold',to:'buyer@example.test',subject:'Ваш урок',text:'Урок готов',html:'<p>Урок готов</p>',attachments:[{filename:'Teacher.pdf',data:pdf}]});assert.match(m,/multipart\/mixed/);assert.match(m,/multipart\/alternative/);assert.match(m,/Content-Disposition: attachment/);assert.ok(m.includes(pdf.toString('base64').slice(0,50)));assert.match(m,/Subject: =\?UTF-8\?B\?/);
  assert.throws(()=>require('../lessonfold/src/mail').buildMessage({from:'materials@lessonfold.ru',to:'x@example.test\r\nBcc: bad@example.test',subject:'Test'}),/Недопустимые/);
 });
});

test('SMTP: защищённый диалог, буфер ответов и отсутствие пароля в ошибке',async()=>{
 const tls=require('tls'),net=require('net'),{EventEmitter}=require('events');const originalTLS=tls.connect,originalNet=net.connect;
 const make=mode=>{const socket=new EventEmitter();socket.writes=[];socket.end=()=>{};socket.destroy=()=>{};socket.write=s=>{
  socket.writes.push(s);let reply=s.startsWith('EHLO')?'250-fixture\r\n250 AUTH LOGIN\r\n':s.startsWith('AUTH LOGIN')?'334 username\r\n':socket.writes.at(-2)?.startsWith('AUTH LOGIN')?'334 password\r\n':socket.writes.at(-3)?.startsWith('AUTH LOGIN')?(mode==='bad'?'535 bad authentication\r\n':'235 ok\r\n'):s.startsWith('DATA')?'354 ready\r\n':'250 ok\r\n';
  socket.emit('data',Buffer.from(reply));return true;
 };process.nextTick(()=>socket.emit('data',Buffer.from('220 fixture SMTP\r\n')));return socket;};
 try{
  let socket;tls.connect=()=>socket=make('ok');const {smtpSend}=require('../lessonfold/src/mail');await smtpSend({host:'fixture',port:465,secure:true,user:'u@example.test',pass:'fixture-secret',from:'u@example.test',to:'x@example.test',data:'body',timeout:500});assert.ok(socket.writes.some(s=>s.startsWith('AUTH LOGIN')));
  tls.connect=()=>make('bad');await assert.rejects(smtpSend({host:'fixture',port:465,secure:true,user:'u@example.test',pass:'fixture-secret',from:'u@example.test',to:'x@example.test',data:'body',timeout:500}),e=>!e.message.includes('fixture-secret')&&!e.message.includes(Buffer.from('fixture-secret').toString('base64'))&&e.message.includes('AUTH'));
  net.connect=()=>socket=make('ok');await assert.rejects(smtpSend({host:'fixture',port:587,secure:false,user:'u@example.test',pass:'fixture-secret',from:'u@example.test',to:'x@example.test',data:'body',timeout:500}),/STARTTLS/);assert.ok(!socket.writes.some(s=>s.startsWith('AUTH LOGIN')));
 }finally{tls.connect=originalTLS;net.connect=originalNet;}
});
