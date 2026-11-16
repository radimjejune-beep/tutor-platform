const test=require('node:test'),assert=require('node:assert/strict');
test('кабинет продаж: роли, команда, подписки и совместная публикация',{skip:!process.env.TEST_SALES_DATABASE_URL},async t=>{
 process.env.DATABASE_URL=process.env.TEST_SALES_DATABASE_URL;process.env.LF_DATABASE_URL=process.env.TEST_SALES_DATABASE_URL;process.env.LF_DB_SCHEMA='sales_fixture';process.env.LF_PUBLIC_URL='http://127.0.0.1';process.env.LF_BOT_TOKEN='';process.env.BOT_TOKEN='';
 const platform=require('../src/db');await require('../src/services/migrate').migrate({log:()=>{}});await require('../src/services/plans').ensure();
 const db=require('../lessonfold/src/db'),store=require('../lessonfold/src/store'),catalog=require('../lessonfold/src/catalog'),orders=require('../lessonfold/src/orders'),sales=require('../lessonfold/src/sales');
 await db.migrate();await store.migrate();await orders.migrate();await sales.ensure();
 const raw={textbooks:[{id:'original',title:'Original'}],products:{'demo-lesson':{title:'Original lesson',type:'lesson',status:'soon',book:'original',grade:'A1',module:'demo',moduleTitle:'Demo',price:249}}};await db.kvSet('catalog',JSON.stringify(raw));await catalog.loadFromDb();
 for(const [login,name,role]of [['rskochka@lessonfold.ru','Кочка Радим Сергеевич','admin'],['iaavasyev@lessonfold.ru','Авасьев Илья Андреевич','admin'],['manager@example.test','Manager','manager'],['editor@example.test','Editor','editor'],['finance@example.test','Finance','finance']])await store.createAdmin(login,'fixture-password-12345',name,role);
 const server=require('http').createServer(require('../lessonfold/src/web').createHandler({}));server.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 t.after(async()=>{await new Promise(r=>server.close(r));await db.close();await platform.pool.end();});
 const sessions={};for(const login of ['RSKochka@lessonfold.ru','IAAvasyev@lessonfold.ru','manager@example.test','editor@example.test','finance@example.test']){
  const r=await fetch(base+'/admin/api/login',{method:'POST',headers:{'x-lf-admin':'1','content-type':'application/json'},body:JSON.stringify({login,password:'fixture-password-12345'})});assert.equal(r.status,200);sessions[login.toLowerCase()]=r.headers.get('set-cookie').split(';')[0];
 }
 const req=async(who,path,method='GET',body,status=200)=>{const r=await fetch(base+'/admin/api'+path,{method,headers:{'x-lf-admin':'1',Cookie:sessions[who]||'','content-type':'application/json'},body:body?JSON.stringify(body):undefined});const d=await r.json();assert.equal(r.status,status,JSON.stringify({path,d}));return d;};const owner='rskochka@lessonfold.ru',colleague='iaavasyev@lessonfold.ru';
 await t.test('корпоративные email работают без регистра, у двух владельцев полный доступ',async()=>{
  for(const a of [owner,colleague]){const r=await req(a,'/me');assert.equal(r.role,'admin');assert.ok(r.permissions.includes('all'));assert.ok(r.display_name);assert.equal((await req(a,'/admins')).admins.length,5);}
  await req('', '/sales/summary','GET',null,401);await req('manager@example.test','/admins','GET',null,403);await req('editor@example.test','/orders','GET',null,403);await req('finance@example.test','/settings','GET',null,403);
 });
 await t.test('ограниченные роли не могут возвращать деньги, менять доступы и получать исходные файлы',async()=>{
  await req('manager@example.test','/sales/subscriptions');await req('editor@example.test','/catalog');await req('finance@example.test','/sales/summary');
  for(const a of ['manager@example.test','editor@example.test','finance@example.test']){await req(a,'/orders/00000000-0000-0000-0000-000000000000/refund','POST',{},403);await req(a,'/sales/subscriptions','PUT',{id:1,plan:'tutor',reason:'No'},403);}
  await req('finance@example.test','/files/lesson%2Fdemo%2Fhtml','GET',null,403);
 });
 const {rows:[u]}=await platform.query("INSERT INTO users(role,login,password_hash,full_name,email,is_admin,plan) VALUES('tutor','sales_fixture_tutor','x','Teacher buyer','teacher@example.test',false,'start') RETURNING id",[]);
 await t.test('заявки сохраняются без дублей, выдача тарифа записывает автора и не считается оплатой',async()=>{
  const {loadRoutes,call}=require('./helpers'),route=loadRoutes('routes/plans.js').mod.router,user={id:u.id,tid:u.id,role:'tutor'};
  assert.equal((await call(route,'POST','/request',{user,body:{plan:'tutor',period:'month'}})).status,200);assert.equal((await call(route,'POST','/request',{user,body:{plan:'tutor',period:'year'}})).status,200);
  let r=await req(colleague,'/sales/subscriptions');assert.equal(r.requests.length,1);assert.equal(r.requests[0].requested_amount,4990);
  await req(colleague,'/sales/subscriptions','PUT',{id:u.id,plan:'tutor',until:'2027-12-31',reason:'Manual support grant',request_id:r.requests[0].id});r=await req(owner,'/sales/subscriptions');assert.equal(r.requests.length,0);assert.equal(r.events[0].actor,colleague);assert.equal(r.tutors.find(t=>t.id===u.id).current.id,'tutor');
  const s=await req(owner,'/sales/summary');assert.equal(s.subscription_payments,false);assert.equal(s.sales.net,0);
 });
 await t.test('сотрудники, смена прав и отключение сессий работают; последнего полного админа нельзя удалить',async()=>{
  await req(owner,'/admins/manager%40example.test','PATCH',{role:'editor'});assert.equal((await req('manager@example.test','/me')).role,'editor');await req('manager@example.test','/orders','GET',null,403);
  await req(owner,'/admins/editor%40example.test','DELETE');await req('editor@example.test','/me','GET',null,401);
  const results=await Promise.allSettled([store.deleteAdmin(owner),store.deleteAdmin(colleague)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await store.listAdmins()).filter(a=>a.role==='admin').length,1);
 });
 await t.test('совместные сохранения каталога не затирают друг друга',async()=>{
  await catalog.loadFromDb();const a=structuredClone(catalog.getRaw()),b=structuredClone(catalog.getRaw());a.products['demo-lesson'].description='Edit A';b.products['demo-lesson'].description='Edit B';const result=await Promise.all([catalog.save(a,async()=>true),catalog.save(b,async()=>true)]);assert.equal(result.filter(r=>r.ok).length,1);assert.equal(result.filter(r=>r.conflict).length,1);
 });
 await t.test('выручка не удваивает заказ из бота и показывает возвраты отдельно',async()=>{
  await db.upsertUser({id:123,username:'fixture',first_name:'Fixture'});
  for(const [id,status,amount]of [['sale-a','paid',249],['sale-b','refunded',199]])await db.q('INSERT INTO orders(id,token,email,sku,title,amount_rub,status,yk_payment_id,paid_at) VALUES($1,$1,$2,$3,$3,$4,$5,$1,NOW())',[id,'buyer@example.test','demo-lesson',amount,status]);
  await db.addPurchase({userId:123,sku:'demo-lesson',kind:'paid',amountRub:249,tgChargeId:'yk:sale-a'});
  const r=await sales.summary(30);assert.equal(r.sales.gross,448);assert.equal(r.sales.refunds,199);assert.equal(r.sales.net,249);assert.equal(r.sales.sales,2);
 });
});
