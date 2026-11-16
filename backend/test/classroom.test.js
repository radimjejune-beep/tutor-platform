const test=require('node:test'),assert=require('node:assert/strict');
test('classroom: личные разделы и отдельные ссылки на настоящем HTTP/PostgreSQL',{skip:!process.env.TEST_CLASSROOM_DATABASE_URL},async t=>{
 process.env.DATABASE_URL=process.env.TEST_CLASSROOM_DATABASE_URL;process.env.JWT_SECRET='classroom-fixture-secret-for-tests-only-123456';
 const express=require('express'),{query,pool}=require('../src/db'),auth=require('../src/middleware/auth');
 await require('../src/services/migrate').migrate({log:()=>{}});await require('../src/services/schema').ensureAll();await require('../src/services/bank').seed();
 const app=express();app.use(express.json());const activity=require('../src/routes/activities');app.use('/activities',activity.publicRouter);
 app.use(auth.authenticate,auth.requirePasswordChanged);
 app.use('/activity-links',activity.router);app.use('/learning',require('../src/routes/learning'));app.use('/homework',require('../src/routes/homework'));app.use('/assignments',require('../src/routes/assignments'));
 app.use((err,req,res,next)=>res.status(err.status||500).json({error:err.message}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 t.after(async()=>{await new Promise(r=>server.close(r));await pool.end();});const base=`http://127.0.0.1:${server.address().port}`;
 const user=async(role,owner)=>{const {rows:[u]}=await query("INSERT INTO users(role,login,password_hash,full_name,tutor_id,must_change_password) VALUES($1,$2,'fixture','Private person',$3,false) RETURNING *",[role,role+'_'+Math.random(),owner||null]);return {...u,token:auth.signToken(u)};};
 const a=await user('tutor'),b=await user('tutor'),s1=await user('student',a.id),s2=await user('student',a.id),parent=await user('parent',a.id);
 for(const u of [s1,s2])u.sid=(await query("INSERT INTO students(user_id,tutor_id,full_name) VALUES($1,$2,'Private student') RETURNING id",[u.id,a.id])).rows[0].id;
 await query('INSERT INTO parent_students(parent_user_id,student_id) VALUES($1,$2)',[parent.id,s1.sid]);
 const req=async(u,path,method='GET',body,status=200)=>{const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(u?{Authorization:'Bearer '+u.token}:{})},body:body===undefined?undefined:JSON.stringify(body)});const out=await r.json();assert.equal(r.status,status,JSON.stringify({path,out}));return out;};
 const section=async(u,title)=>(await req(u,'/learning/sections','POST',{title},201)).id;
 const first=await section(a,'Default'),personal=await section(a,'Personal'),third=await section(a,'Later'),foreign=await section(b,'Foreign');
 const assignment=await req(a,'/assignments','POST',{title:'Shared homework',student_ids:[s1.sid,s2.sid],section_id:first},201);
 const works=(await req(a,'/assignments/'+assignment.id)).submissions,h1=works.find(h=>h.student_id===s1.sid).id,h2=works.find(h=>h.student_id===s2.sid).id;
 await query("UPDATE homework SET status='checked',student_answer='Saved answer',score=88,tutor_feedback='Saved feedback',submitted_at=NOW() WHERE id=$1",[h1]);
 const state=(await query('SELECT * FROM homework WHERE id=$1',[h1])).rows[0];
 const move=(u,ids,target,sid=s1.sid,status=200)=>req(u,`/learning/students/${sid}/homework-sections`,'PATCH',{homework_ids:ids,section_id:target},status);
 await t.test('перенос одного ученика сохраняет результаты и не меняет другого',async()=>{
  await move(a,[h1],personal);const one=await req(s1,'/homework/'+h1),two=await req(s2,'/homework/'+h2);
  assert.equal(one.section_id,personal);assert.equal(two.section_id,first);assert.equal(one.section_title,'Personal');
  const now=(await query('SELECT * FROM homework WHERE id=$1',[h1])).rows[0];for(const key of Object.keys(state).filter(k=>!['section_id','section_overridden'].includes(k)))assert.deepEqual(now[key],state[key],key);
  assert.deepEqual((await req(s1,'/learning/sections')).map(s=>s.id),[personal]);assert.deepEqual((await req(parent,'/learning/sections')).map(s=>s.id),[personal]);
 });
 await t.test('явное «без раздела» устойчиво к изменению общего задания и повторным миграциям',async()=>{
  await move(a,[h1],null);await req(a,'/assignments/'+assignment.id,'PATCH',{section_id:third});
  assert.equal((await req(s1,'/homework/'+h1)).section_id,null);assert.equal((await req(s2,'/homework/'+h2)).section_id,third);
  assert.deepEqual(await require('../src/services/migrate').migrate({log:()=>{}}),[]);assert.equal((await req(s1,'/homework/'+h1)).section_id,null);
 });
 await t.test('чужие разделы, ученики, роли и смешанные списки закрыты; перенос атомарный',async()=>{
  await move(a,[h1,h2],personal,s1.sid,404);assert.equal((await req(s1,'/homework/'+h1)).section_id,null);
  await move(a,[h1],foreign,s1.sid,404);await move(b,[h1],foreign,s1.sid,404);await move(s1,[h1],personal,s1.sid,403);await move(parent,[h1],personal,s1.sid,403);
  await move(a,[h1,h1],personal,s1.sid,400);await move(a,[],personal,s1.sid,400);
 });
 await t.test('групповой перенос и удаление раздела сохраняют работы без возврата к общему разделу',async()=>{
  const extra=await req(a,'/assignments','POST',{title:'Extra',student_ids:[s1.sid]},201),eh=(await req(a,'/assignments/'+extra.id)).submissions[0].id;
  assert.equal((await move(a,[h1,eh],personal)).updated,2);await req(a,'/learning/sections/'+personal,'DELETE');
  assert.equal((await req(s1,'/homework/'+h1)).section_id,null);assert.equal((await req(s1,'/homework/'+eh)).section_id,null);assert.equal((await req(s2,'/homework/'+h2)).section_id,third);
 });
 const {rows:[lib]}=await query(`INSERT INTO library_items(tutor_id,kind,subject,title,body,answer,tutor_note,game) VALUES($1,'game','Английский язык','Standalone exercise','Public instruction','PRIVATE_ANSWER','PRIVATE_NOTE',$2) RETURNING id`,[a.id,JSON.stringify({type:'gaps',text:'Nora [works] here.',mode:'type',distractors:[]})]);
 const {rows:[pic]}=await query("INSERT INTO files(library_item_id,filename,mime,size_bytes,data,uploaded_by) VALUES($1,'selected.png','image/png',3,$2,$3) RETURNING id",[lib.id,Buffer.from([1,2,3]),a.id]);
 const {rows:[other]}=await query("INSERT INTO library_items(tutor_id,kind,subject,title) VALUES($1,'task','Английский язык','Other private exercise') RETURNING id",[b.id]);
 const {rows:[privateFile]}=await query("INSERT INTO files(library_item_id,filename,mime,size_bytes,data,uploaded_by) VALUES($1,'private.png','image/png',3,$2,$3) RETURNING id",[other.id,Buffer.from([4,5,6]),b.id]);
 let token;
 await t.test('гость видит выбранный материал, без заметок, ответа, учеников и доступа к другим файлам',async()=>{
  token=(await req(a,'/activity-links/library/'+lib.id,'POST',{})).token;assert.match(token,/^[a-f0-9]{64}$/);
  const publicItem=await req(null,'/activities/'+token);const encoded=JSON.stringify(publicItem);for(const secret of ['PRIVATE_ANSWER','PRIVATE_NOTE','Private person','Private student','tutor_id','uploaded_by'])assert.ok(!encoded.includes(secret),secret);
  const f=await fetch(`${base}/activities/${token}/files/${pic.id}`);assert.equal(f.status,200);assert.deepEqual(Buffer.from(await f.arrayBuffer()),Buffer.from([1,2,3]));
  await req(null,`/activities/${token}/files/${privateFile.id}`,'GET',undefined,404);await req(b,'/activity-links/library/'+lib.id,'POST',{},404);await req(s1,'/activity-links/library/'+lib.id,'POST',{},403);
  await req(null,'/activities/not-a-token','GET',undefined,404);await req(null,'/activities/'+'f'.repeat(64),'GET',undefined,404);
 });
 await t.test('стабильная ссылка, конкурентное создание, отключение и новая ссылка',async()=>{
  const many=await Promise.all([1,2,3].map(()=>req(a,'/activity-links/library/'+lib.id,'POST',{})));assert.ok(many.every(r=>r.token===token));
  await req(b,'/activity-links/library/'+lib.id,'DELETE');await req(null,'/activities/'+token);
  await req(a,'/activity-links/library/'+lib.id,'DELETE');await req(null,'/activities/'+token,'GET',undefined,404);
  const next=(await req(a,'/activity-links/library/'+lib.id,'POST',{})).token;assert.notEqual(next,token);await req(null,'/activities/'+token,'GET',undefined,404);await req(null,'/activities/'+next);token=next;
 });
 await t.test('слайды скрывают заметки учителя; банк скрытых материалов и отключённый учитель закрывают ссылку',async()=>{
  const {rows:[slides]}=await query("INSERT INTO library_items(tutor_id,kind,subject,title,html) VALUES($1,'deck','Английский язык','Slides',$2) RETURNING id",[a.id,JSON.stringify({v:1,slides:[{id:'s1',type:'text',text:'Public text',notes:'SECRET_SLIDE_NOTE'}]})]);
  const st=(await req(a,'/activity-links/library/'+slides.id,'POST',{})).token;assert.ok(!JSON.stringify(await req(null,'/activities/'+st)).includes('SECRET_SLIDE_NOTE'));
  const {rows:[bank]}=await query("SELECT id FROM bank_items WHERE book='atanasyan-geom-7-9' LIMIT 1");const bt=(await req(a,'/activity-links/bank/'+bank.id,'POST',{})).token;
  assert.equal((await req(null,'/activities/'+bt)).subject,'Математика');await query('UPDATE bank_items SET hidden=true WHERE id=$1',[bank.id]);await req(null,'/activities/'+bt,'GET',undefined,404);
  await query('UPDATE users SET is_active=false WHERE id=$1',[a.id]);await req(null,'/activities/'+token,'GET',undefined,404);await req(null,`/activities/${token}/files/${pic.id}`,'GET',undefined,404);
 });
});
