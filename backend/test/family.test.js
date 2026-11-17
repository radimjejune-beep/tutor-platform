'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('crypto');
test('family: guardian records, restricted minors and own learner context',{skip:!process.env.TEST_FAMILY_DATABASE_URL},async t=>{
 process.env.DATABASE_URL=process.env.TEST_FAMILY_DATABASE_URL;process.env.JWT_SECRET='family-local-test-secret-12345678901234567890';
 const express=require('express'),{query,pool}=require('../src/db'),auth=require('../src/middleware/auth');
 await require('../src/services/migrate').migrate({log:()=>{}});await require('../src/services/schema').ensureAll();
 const app=express();app.use(express.json());app.use('/auth',require('../src/routes/auth'));
 app.use(auth.authenticate,auth.requirePasswordChanged,require('../src/services/guardians').middleware);
 app.use('/legal',require('../src/routes/legal').protectedRouter);app.use('/students',require('../src/routes/students'));app.use('/homework',require('../src/routes/homework'));app.use('/assignments',require('../src/routes/assignments'));app.use('/learning',require('../src/routes/learning'));app.use('/live',require('../src/routes/live'));app.use('/lessons',require('../src/routes/lessons'));app.use('/games',require('../src/routes/games'));
 app.use((e,req,res,next)=>{if(!e.status)console.error(e.stack);res.status(e.status||500).json({error:e.message});});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await require('../src/learning/live-hub').close();await pool.end();});
 const user=async(role,tid)=>{const u=(await query("INSERT INTO users(role,login,password_hash,full_name,tutor_id,must_change_password) VALUES($1,$2,'hash','Test person',$3,false) RETURNING *",[role,'family_'+randomUUID().slice(0,15),tid||null])).rows[0];return {...u,token:auth.signToken(u)};};
 const a=await user('tutor'),b=await user('tutor'),p=await user('parent',a.id),kid=await user('student',a.id),teen=await user('student',a.id),stranger=await user('student',b.id),adult=await user('student',a.id);
 const st=async(u,category='adult')=>(await query('INSERT INTO students(user_id,tutor_id,full_name,category) VALUES($1,$2,$3,$4) RETURNING id',[u?.id||null,u?.tutor_id||a.id,u?.role==='parent'?'Parent own learning':'Test pupil',category])).rows[0].id;
 kid.sid=await st(kid,'child');teen.sid=await st(teen,'teen');stranger.sid=await st(stranger,'child');p.sid=await st(p);adult.sid=await st(adult);
 await query('INSERT INTO parent_students(parent_user_id,student_id) VALUES($1,$2),($1,$3)',[p.id,kid.sid,teen.sid]);
 const req=async(u,path,method='GET',body,status=200)=>{const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+u.token},body:body===undefined?undefined:JSON.stringify(body)}),x=await r.json();assert.equal(r.status,status,JSON.stringify({path,x}));return x;};
 const docs=async(u=p)=>(await req(u,'/legal/family')).documents.map(d=>d.id);
 const approve=(u,ids,docids,status=200)=>req(u,'/legal/guardian-accept','POST',{student_ids:ids,document_ids:docids,relationship:'parent',declaration:true},status);
 let ids=await docs();
 await t.test('child and teen wait for a parent; teacher checkbox and direct API do not bypass',async()=>{
  await query('UPDATE students SET pd_consent_at=NOW() WHERE id=ANY($1::int[])',[[kid.sid,teen.sid]]);
  for(const u of [kid,teen,p]){const denied=await req(u,'/homework','GET',undefined,403);assert.equal(denied.code,'GUARDIAN_CONSENT_REQUIRED');}
  assert.equal((await req(kid,'/legal/family')).can_use,false);
  await approve(kid,[kid.sid],ids,403);await approve(a,[kid.sid],ids,403);
  await req(p,'/legal/guardian-accept','POST',{student_ids:[kid.sid],document_ids:ids,relationship:'parent',declaration:false},400);
  await approve(p,[stranger.sid],ids,404);await approve(p,[kid.sid],[ids[0],ids[1],999999],409);
 });
 await t.test('ordinary adult acknowledgement grants no child access; explicit child selection is durable and idempotent',async()=>{
  await req(p,'/legal/accept','POST',{document_ids:ids});await req(kid,'/homework','GET',undefined,403);
  await approve(p,[kid.sid],ids);await approve(p,[kid.sid],ids);
  assert.equal((await req(kid,'/legal/family')).can_use,true);assert.equal((await req(teen,'/legal/family')).can_use,false);
  assert.deepEqual(await req(kid,'/homework'),[]);await req(teen,'/homework','GET',undefined,403);
  const rows=(await query('SELECT * FROM guardian_acceptances WHERE student_id=$1',[kid.sid])).rows;assert.equal(rows.length,3);assert.ok(rows.every(r=>r.parent_user_id===p.id&&r.accepted_at&&r.ip&&r.user_agent));
 });
 await t.test('new version needs renewed approval; old evidence remains; later children are not automatically approved',async()=>{
  await query("INSERT INTO legal_documents(tutor_id,kind,version,title,body) SELECT tutor_id,kind,version+1,title,body FROM legal_documents WHERE id=$1",[ids[0]]);
  ids=await docs();await req(kid,'/homework','GET',undefined,403);await approve(p,[kid.sid,teen.sid],ids);
  await req(kid,'/homework');await req(teen,'/homework');assert.equal((await query('SELECT count(*)::int n FROM guardian_acceptances WHERE student_id=$1',[kid.sid])).rows[0].n,4);
  const late=await user('student',a.id);late.sid=await st(late,'child');await query('INSERT INTO parent_students(parent_user_id,student_id) VALUES($1,$2)',[p.id,late.sid]);await req(late,'/homework','GET',undefined,403);await query('DELETE FROM parent_students WHERE parent_user_id=$1 AND student_id=$2',[p.id,late.sid]);
 });
 let self;
 await t.test('one parent can select own learner context; token cannot read/answer children in that context',async()=>{
  const me=await req(p,'/auth/me');assert.equal(me.students.filter(s=>s.is_self).length,1);assert.equal(me.students.length,3);
  const r=await req(p,'/auth/profile','POST',{mode:'self'});self={...p,token:r.token};const own=await req(self,'/auth/me');assert.equal(own.user.role,'student');assert.equal(own.user.account_role,'parent');assert.equal(own.user.context,'self');
  await req(self,`/homework?student_id=${kid.sid}`,'GET',undefined,404);assert.deepEqual(await req(self,`/homework?student_id=${p.sid}`),[]);
  await approve(self,[kid.sid],ids,403);await req(kid,'/auth/profile','POST',{mode:'self'},403);await req(kid,'/auth/profile','POST',{mode:'parent'},403);
  await req({...kid,token:auth.signToken(kid,'self')},'/auth/me','GET',undefined,401);
 });
 await t.test('own homework is editable in own context; parent view cannot submit a child result',async()=>{
  const assignment=await req(a,'/assignments','POST',{title:'Own work',student_ids:[p.sid]},201),hw=(await req(a,'/assignments/'+assignment.id)).submissions[0];
  await req(p,'/homework/'+hw.id,'GET',undefined,404);await req(self,'/homework/'+hw.id);await req(self,'/homework/'+hw.id+'/submit','POST',{student_answer:'My own answer'});
  const child=await req(a,'/assignments','POST',{title:'Child work',student_ids:[kid.sid]},201),ch=(await req(a,'/assignments/'+child.id)).submissions[0];
  await req(p,'/homework/'+ch.id+'/submit','POST',{student_answer:'Parent answer'},403);await req(self,'/homework/'+ch.id+'/submit','POST',{student_answer:'Parent answer'},404);
  await req(p,'/games/1/results','POST',{student_id:kid.sid,answers:{}},403);
  const back=await req(self,'/auth/profile','POST',{mode:'parent'});assert.equal((await req({...p,token:back.token},'/auth/me')).user.role,'parent');
 });
 await t.test('teacher can connect an adult learner as parent, but cannot connect a minor or another tutor login',async()=>{
  await req(a,`/students/${kid.sid}/parents`,'POST',{parent_user_id:adult.id},201);assert.equal((await req(adult,'/auth/me')).user.role,'parent');assert.equal((await req(adult,'/auth/me')).students.length,2);
  await req(a,`/students/${kid.sid}/parents`,'POST',{parent_user_id:teen.id},409);await req(a,`/students/${kid.sid}/parents`,'POST',{parent_user_id:stranger.id},409);
  await req(a,`/students/${adult.sid}/parents`,'POST',{parent_user_id:adult.id},409);
  const empty=(await query("INSERT INTO students(tutor_id,full_name,category) VALUES($1,'Own profile','adult') RETURNING id",[a.id])).rows[0].id;
  const another=await user('parent',a.id);await req(a,`/students/${empty}/family-login`,'POST',{parent_user_id:another.id});assert.equal((await req(another,'/auth/me')).students[0].is_self,true);
  await req(a,`/students/${teen.sid}/family-login`,'POST',{parent_user_id:another.id},422);await req(b,`/students/${empty}/family-login`,'POST',{parent_user_id:another.id},404);
 });
 await t.test('revocation is audited; removed/disabled parent cannot keep a child unlocked',async()=>{
  await req(p,'/legal/guardian-revoke','POST',{student_id:kid.sid});await req(kid,'/homework','GET',undefined,403);
  assert.equal((await query('SELECT count(*)::int n FROM guardian_acceptances WHERE student_id=$1 AND revoked_at IS NOT NULL',[kid.sid])).rows[0].n,4);
  await approve(p,[kid.sid],ids);await query('UPDATE users SET is_active=false WHERE id=$1',[p.id]);await req(kid,'/homework','GET',undefined,403);await query('UPDATE users SET is_active=true WHERE id=$1',[p.id]);
  await query('DELETE FROM parent_students WHERE parent_user_id=$1 AND student_id=$2',[p.id,kid.sid]);await req(kid,'/homework','GET',undefined,403);await query('INSERT INTO parent_students(parent_user_id,student_id) VALUES($1,$2)',[p.id,kid.sid]);await req(kid,'/homework');
 });
 await t.test('live stream stops after guardian approval is revoked',async()=>{
  const lid=(await query("INSERT INTO lessons(student_id,starts_at) VALUES($1,NOW()) RETURNING id",[kid.sid])).rows[0].id;
  const abort=new AbortController(),r=await fetch(base+`/live/lessons/${lid}/stream`,{headers:{Authorization:'Bearer '+kid.token},signal:abort.signal}),reader=r.body.getReader();assert.equal(r.status,200);
  let data='';const until=async text=>{const end=Date.now()+8000;while(!data.includes(text)){assert.ok(Date.now()<end,data);const part=await Promise.race([reader.read(),new Promise((_,rej)=>setTimeout(()=>rej(Error('SSE timeout')),8000).unref())]);if(part.done)break;data+=new TextDecoder().decode(part.value);}assert.ok(data.includes(text),data);};
  await until('event: snapshot');await req(p,'/legal/guardian-revoke','POST',{student_id:kid.sid});data='';await until('event: access-error');assert.ok(data.includes('403'));abort.abort();await reader.cancel().catch(()=>{});
 });
});
