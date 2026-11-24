'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('crypto');
const catalog=require('../src/learning/language-catalog');
test('language route: original catalog has unique complete goals for all six target levels',()=>{
 assert.equal(catalog.goals.length,72);assert.equal(catalog.byKey.size,72);
 for(const level of catalog.levels.slice(1))for(const skill of Object.keys(catalog.skills))assert.equal(catalog.goals.filter(g=>g.level===level&&g.skill===skill).length,3);
 assert.equal(catalog.isLanguage('Математика'),false);assert.equal(catalog.isLanguage('Русский язык'),false);assert.equal(catalog.isLanguage('Русский как иностранный'),true);
 assert.equal(catalog.isLanguage('Французский язык'),true);
});
test('language route: HTTP, PostgreSQL, family scope and level confirmation',{skip:!process.env.TEST_LANGUAGE_DATABASE_URL},async t=>{
 process.env.DATABASE_URL=process.env.TEST_LANGUAGE_DATABASE_URL;process.env.JWT_SECRET='language-local-testing-secret-1234567890';
 const express=require('express'),{query,pool}=require('../src/db'),auth=require('../src/middleware/auth');
 await require('../src/services/migrate').migrate({log:()=>{}});await require('../src/services/schema').ensureAll();
 const app=express();app.use(express.json());app.use(auth.authenticate,auth.requirePasswordChanged,require('../src/services/guardians').middleware);app.use('/progress',require('../src/routes/language-progress'));
 app.use((e,req,res,next)=>{if(!e.status)console.error(e);res.status(e.status||500).json({error:e.message});});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await pool.end();});
 const user=async(role,tid)=>(await query("INSERT INTO users(role,login,password_hash,full_name,tutor_id,must_change_password,subject) VALUES($1,$2,'test','Language test',$3,false,'Английский язык') RETURNING *",[role,'lang_'+randomUUID().slice(0,12),tid||null])).rows[0];
 const a=await user('tutor'),b=await user('tutor'),u=await user('student',a.id),other=await user('student',a.id),parent=await user('parent',a.id),minor=await user('student',a.id);
 const st=async(user,category='adult')=>(await query("INSERT INTO students(user_id,tutor_id,full_name,category,subject,level) VALUES($1,$2,'Learner',$3,'Английский язык','Old free text') RETURNING id",[user.id,user.tutor_id,category])).rows[0].id;
 const sid=await st(u),oid=await st(other),kid=await st(minor,'child'),own=await st(parent);
 await query('INSERT INTO parent_students(parent_user_id,student_id) VALUES($1,$2)',[parent.id,sid]);
 const req=async(user,path,method='GET',body,status=200,context)=>{const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+auth.signToken(user,context)},body:body===undefined?undefined:JSON.stringify(body)});const x=await r.json();assert.equal(r.status,status,JSON.stringify({path,x}));return x;};
 const url=id=>`/progress/students/${id}/language`,subject='Английский язык';let data;
 const config=(version=0,current_level='A1',target_level='A2')=>({version,subject,current_level,target_level,basis:'Входная беседа и письменная работа'});
 const check=async(key,state='confirmed',evidence='Самостоятельный ответ на занятии')=>{data=await req(a,url(sid)+'/goals/'+encodeURIComponent(key),'PATCH',{version:data.profile.version,subject,state,evidence});};
 await t.test('empty state does not infer CEFR from existing student level; read is private and minors stay gated',async()=>{
  const x=await req(u,url(sid));assert.equal(x.profile,null);assert.equal(x.enabled,true);
  await req(other,url(sid),'GET',undefined,404);await req(b,url(sid),'GET',undefined,404);await req(parent,url(oid),'GET',undefined,404);
  await req(minor,url(kid),'GET',undefined,403);await req(parent,url(sid),'GET',undefined,404,'self');
 });
 await t.test('only tutor configures; invalid and descending targets rejected; versioned create is durable',async()=>{
  await req(u,url(sid),'PUT',config(),403);await req(parent,url(sid),'PUT',config(),403);
  await req(a,url(sid),'PUT',config(0,'A2','A1'),422);await req(a,url(sid),'PUT',{...config(),current_level:'B3'},400);
  data=await req(a,url(sid),'PUT',config());assert.equal(data.route.remaining,12);assert.equal(data.route.percent,0);assert.equal(data.profile.current_level,'A1');
  await req(a,url(sid),'PUT',config(),409);assert.equal((await req(parent,url(sid))).profile.id,data.profile.id);
 });
 await t.test('goal evidence is required; wrong level and prototype keys do not write; only the teacher edits',async()=>{
  const body={version:data.profile.version,subject,state:'confirmed',evidence:''};
  await req(a,url(sid)+'/goals/A2:speaking:1','PATCH',body,422);await req(a,url(sid)+'/goals/B2:speaking:1','PATCH',{...body,evidence:'A task'},422);
  await req(a,url(sid)+'/goals/__proto__','PATCH',body,422);await req(u,url(sid)+'/goals/A2:speaking:1','PATCH',body,403);await req(parent,url(sid)+'/goals/A2:speaking:1','PATCH',body,403);
  await check('A2:speaking:1');assert.equal(data.route.confirmed,1);assert.equal(data.route.remaining,11);assert.equal(data.route.skills.find(s=>s.key==='speaking').confirmed,1);
 });
 await t.test('optimistic concurrency prevents a stale teacher tab overwriting a newer observation',async()=>{
  const body={version:data.profile.version,subject,state:'working',evidence:'Ещё нужна подсказка'};
  const run=()=>fetch(base+url(sid)+'/goals/A2:reading:1',{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:'Bearer '+auth.signToken(a)},body:JSON.stringify(body)});
  const statuses=(await Promise.all([run(),run()])).map(r=>r.status).sort();assert.deepEqual(statuses,[200,409]);data=await req(a,url(sid));
 });
 await t.test('lesson counts, planned topics and good grammar checks never auto promote a level',async()=>{
  await query("INSERT INTO progress_topics(student_id,title,status,skill) VALUES($1,'Finished theme','done','grammar')",[sid]);
  await req(a,url(sid)+'/confirm','POST',{version:data.profile.version,subject,basis:'Проверили всё'},409);assert.equal((await req(u,url(sid))).profile.current_level,'A1');
  const testid=(await query("INSERT INTO diagnostic_tests(tutor_id,title,mode,request_key,request_hash) VALUES($1,'Grammar signal','manual',$2,$3) RETURNING id",[a.id,randomUUID(),'x'.repeat(64)])).rows[0].id;
  await query("INSERT INTO diagnostic_runs(test_id,student_id,questions,result,submitted_at) VALUES($1,$2,'[]',$3,NOW())",[testid,sid,JSON.stringify({topics:[{topic_id:'present-simple',total:3,correct:3,score:100}]})]);
  data=await req(a,url(sid));assert.equal(data.signals[0].score,100);assert.equal(data.route.confirmed,1);assert.equal(data.profile.current_level,'A1');
 });
 await t.test('stale observations remain visible but do not count toward readiness',async()=>{
  await query("UPDATE language_checks SET assessed_at=NOW()-INTERVAL '91 days' WHERE profile_id=$1",[data.profile.id]);
  data=await req(a,url(sid));assert.equal(data.route.confirmed,0);assert.equal(data.route.items.find(g=>g.key==='A2:speaking:1').stale,true);await check('A2:speaking:1');
 });
 await t.test('all twelve confirmed goals require a separate final teacher decision; history and old student field survive',async()=>{
  for(const g of data.route.items)if(g.key!=='A2:speaking:1')await check(g.key);
  assert.equal(data.route.ready,true);assert.equal(data.route.percent,100);assert.equal(data.profile.current_level,'A1');
  const version=data.profile.version;data=await req(a,url(sid)+'/confirm','POST',{version,subject,basis:'Итоговый разговор, аудирование, чтение и письмо без подсказок'});
  assert.equal(data.profile.current_level,'A2');assert.equal(data.profile.target_level,'B1');assert.equal(data.route.confirmed,0);
  assert.ok(data.history.some(h=>h.event==='level_confirmed'));assert.equal((await query('SELECT level FROM students WHERE id=$1',[sid])).rows[0].level,'Old free text');
  await req(a,url(sid)+'/confirm','POST',{version,subject,basis:'Повторная отправка'},409);
 });
 await t.test('two enrolled languages retain independent evidence when the primary language changes',async()=>{
  const v=data.profile.version;await query("INSERT INTO student_subjects(student_id,subject) VALUES($1,'Английский язык'),($1,'Немецкий язык') ON CONFLICT DO NOTHING",[sid]);
  await query("UPDATE students SET subject='Немецкий язык' WHERE id=$1",[sid]);
  assert.equal((await req(u,url(sid))).profile,null);const german=await req(a,url(sid),'PUT',{...config(0),subject:'Немецкий язык'});assert.equal(german.route.confirmed,0);
  assert.equal((await req(u,url(sid)+'?subject='+encodeURIComponent(subject))).profile.current_level,'A2');
  await req(a,url(sid),'PUT',config(v-1),409);await query("UPDATE students SET subject='Английский язык' WHERE id=$1",[sid]);data=await req(a,url(sid));assert.equal(data.profile.current_level,'A2');
 });
 await t.test('other subjects are excluded; foreign language is enabled without English grammar signals; C2 caps without C3',async()=>{
  await query("UPDATE students SET subject='Математика' WHERE id=$1",[oid]);assert.equal((await req(other,url(oid))).enabled,false);await req(a,url(oid),'PUT',config(),422);
  await query("UPDATE students SET subject='Французский язык' WHERE id=$1",[oid]);let x=await req(a,url(oid),'PUT',{...config(0,'C1','C2'),subject:'Французский язык'});assert.deepEqual(x.signals,[]);
  for(const g of x.route.items)x=await req(a,url(oid)+'/goals/'+g.key,'PATCH',{version:x.profile.version,subject:x.subject,state:'confirmed',evidence:'Самостоятельное выполнение задания'});
  x=await req(a,url(oid)+'/confirm','POST',{version:x.profile.version,subject:x.subject,basis:'Итоговая проверка всех навыков'});assert.equal(x.profile.current_level,'C2');assert.equal(x.profile.target_level,'C2');await req(a,url(oid)+'/confirm','POST',{version:x.profile.version,subject:x.subject,basis:'Повтор уровня'},409);
 });
 await t.test('parent personal context can view only their own route, parent context reads only linked children',async()=>{
  await req(a,url(own),'PUT',config(0,null,'A1'));assert.ok((await req(parent,url(own),'GET',undefined,200,'self')).profile);await req(parent,url(sid),'GET',undefined,404,'self');await req(parent,url(own),'GET',undefined,404);
 });
});
