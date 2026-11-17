'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('crypto');
const c=require('../src/bank/elementary-vocabulary'),games=require('../src/services/games');
function answers(g){
 if(g.type==='match')return {pairs:Object.fromEntries(g.pairs.map((_,i)=>[i,i]))};
 if(g.type==='gaps')return {gaps:games.parseGaps(g.text).gaps.map(a=>a[0])};
 if(g.type==='order')return {sentences:g.sentences.map(s=>s.split(' '))};
 if(g.type==='sheet')return {b:Object.fromEntries(g.blocks.map((b,i)=>[i,b.t==='choice'?b.correct:b.t==='dictation'?b.text:'Original answer']))};
}
test('vocabulary content: 60 original topic sets, 600 entries, 612 materials and complete stages',()=>{
 assert.equal(c.units.length,60);assert.equal(c.units.reduce((n,u)=>n+u.words.length,0),600);assert.equal(c.bank.length,612);assert.equal(new Set(c.bank.map(b=>b.key)).size,612);
 for(const u of c.units){assert.equal(u.words.length,10);assert.equal(new Set(u.words.map(w=>w.term.toLowerCase())).size,10);assert.equal(new Set(u.words.map(w=>w.translation)).size,10);for(const w of u.words){assert.ok(w.example.includes(w.term));assert.equal(w.marked.match(/{/g).length,1);}const p=c.packs.get(u.code);assert.equal(p.learn.length,4);assert.equal(p.practice.length,4);assert.ok(p.check.length>=2);assert.ok(p.all.every(k=>c.bank.some(b=>b.key===k)));}
 const all=require('../src/bank/seed').SEED;assert.equal(all.filter(b=>b.book===c.id).length,612);assert.equal(require('../src/bank/vocab').vocabOf(c.id,'60').length,10);
});
test('vocabulary content: every automatic item grades its key and rejects blanks; transfer stays manual',()=>{
 let total=0,manual=0;
 for(const b of c.bank){if(b.kind!=='game')continue;const valid=games.gameSchema.safeParse(b.game);assert.ok(valid.success,b.key+': '+valid.error?.message);const right=games.grade(valid.data,answers(valid.data)),blank=games.grade(valid.data,{});assert.equal(right.correct,right.total,b.key);if(right.total)assert.equal(blank.correct,0,b.key);total+=right.total;manual+=right.manual||0;}
 assert.equal(total,3900);assert.equal(manual,120);
});
test('vocabulary course: teacher install, supplementary enrollment and homework over PostgreSQL',{skip:!process.env.TEST_VOCABULARY_DATABASE_URL},async t=>{
 process.env.DATABASE_URL=process.env.TEST_VOCABULARY_DATABASE_URL;process.env.JWT_SECRET='vocabulary-local-test-secret-1234567890';
 const express=require('express'),{query,pool}=require('../src/db'),auth=require('../src/middleware/auth');
 await require('../src/services/migrate').migrate({log:()=>{}});await require('../src/services/schema').ensureAll();
 for(const b of c.bank)await query('INSERT INTO bank_items(book,unit,kind,title,body,game,seed_key) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(seed_key) DO UPDATE SET hidden=false',[b.book,b.unit,b.kind,b.title,b.body,b.game?JSON.stringify(games.gameSchema.parse(b.game)):null,b.key]);
 const app=express();app.use(express.json());app.use(auth.authenticate,auth.requirePasswordChanged,require('../src/services/guardians').middleware);app.use('/supplementary-courses',require('../src/routes/supplementary-courses'));app.use('/courses',require('../src/routes/courses'));app.use('/homework',require('../src/routes/homework'));app.use('/games',require('../src/routes/games'));
 app.use((e,req,res,next)=>{if(!e.status)console.error(e);res.status(e.status||500).json({error:e.message});});const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await pool.end();});
 const user=async(role,tid)=>(await query("INSERT INTO users(role,login,password_hash,full_name,tutor_id,must_change_password,subject) VALUES($1,$2,'test','Vocabulary test',$3,false,'Английский язык') RETURNING *",[role,'voc_'+randomUUID().slice(0,12),tid||null])).rows[0];
 const a=await user('tutor'),b=await user('tutor'),u=await user('student',a.id),sibling=await user('student',a.id),p=await user('parent',a.id),kid=await user('student',a.id);
 await query("UPDATE users SET plan='tutor',plan_until=NOW()+INTERVAL '1 year' WHERE id=$1",[a.id]);await query("UPDATE users SET plan='start',plan_until=NULL WHERE id=$1",[b.id]);
 const st=async(x,cat='adult')=>(await query("INSERT INTO students(user_id,tutor_id,full_name,category) VALUES($1,$2,'Learner',$3) RETURNING id",[x.id,x.tutor_id,cat])).rows[0].id;
 const sid=await st(u),other=await st(sibling),minor=await st(kid,'child');await query('INSERT INTO parent_students(parent_user_id,student_id) VALUES($1,$2)',[p.id,sid]);
 const main=(await query("INSERT INTO courses(tutor_id,title,subject) VALUES($1,'Main course','Английский язык') RETURNING id",[a.id])).rows[0].id;await query('UPDATE students SET course_id=$2 WHERE id=$1',[sid,main]);
 const req=async(user,path,method='GET',body,status=200)=>{const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+auth.signToken(user)},body:body===undefined?undefined:JSON.stringify(body)}),x=await r.json();assert.equal(r.status,status,JSON.stringify({path,x}));return x;};
 const url=id=>'/supplementary-courses/students/'+id;let course,unit,work;
 await t.test('catalog shows the explicit coverage; only teacher installs; free quota failure leaves no partial course',async()=>{
  const list=await req(a,'/supplementary-courses/templates');assert.equal(list[0].words,600);assert.equal(list[0].materials,612);await req(u,'/supplementary-courses/templates','GET',undefined,403);
  await req(b,'/supplementary-courses/templates/elementary-vocabulary/install','POST',{},403);assert.equal((await query('SELECT COUNT(*)::int n FROM courses WHERE tutor_id=$1',[b.id])).rows[0].n,0);
  await req(p,'/supplementary-courses/templates/elementary-vocabulary/install','POST',{},403);
 });
 await t.test('install creates all units and reusable bank copies atomically; repeated install keeps one course',async()=>{
  course=(await req(a,'/supplementary-courses/templates/elementary-vocabulary/install','POST',{})).course_id;const again=await req(a,'/supplementary-courses/templates/elementary-vocabulary/install','POST',{});assert.equal(again.course_id,course);assert.equal(again.again,true);
  const units=(await query('SELECT * FROM course_units WHERE course_id=$1 ORDER BY position',[course])).rows;assert.equal(units.length,60);assert.equal(units.reduce((n,u)=>n+u.vocab.length,0),600);unit=units[0];assert.equal(unit.practice_packs.learn.length,4);assert.equal((await query('SELECT COUNT(*)::int n FROM bank_takes WHERE tutor_id=$1',[a.id])).rows[0].n,612);
 });
 await t.test('teacher connects supplemental course without replacing main; students and other tutors cannot enroll',async()=>{
  await req(u,url(sid),'PUT',{course_id:course,active:true},403);await req(b,url(sid),'PUT',{course_id:course,active:true},404);await req(a,url(sid),'PUT',{course_id:course,active:true});await req(a,url(sid),'PUT',{course_id:course,active:true});
  assert.equal((await query('SELECT course_id FROM students WHERE id=$1',[sid])).rows[0].course_id,main);assert.equal((await req(u,url(sid))).enrollments.length,1);await req(sibling,url(sid),'GET',undefined,404);await req(kid,url(minor),'GET',undefined,403);
  const view=await req(a,'/courses/'+course);assert.equal(view.students.length,1);assert.equal(view.students[0].supplementary,true);assert.equal((await req(a,'/courses')).find(c=>c.id===course).student_count,1);await req(b,'/courses/'+course,'GET',undefined,404);
 });
 await t.test('stage homework is specific to the pupil, idempotent, adds unit words without changing personal spaced repetition',async()=>{
  await query("INSERT INTO vocab_items(student_id,term,translation,box,due_on) VALUES($1,'parent','Личный перевод',5,CURRENT_DATE+30)",[sid]);
  const body={course_id:course,unit_id:unit.id,stage:'learn',due_on:null,request_key:randomUUID()};work=await req(a,url(sid)+'/assign','POST',body);assert.equal(work.vocab_added,9);
  const again=await req(a,url(sid)+'/assign','POST',body);assert.equal(again.homework_id,work.homework_id);assert.equal(again.again,true);await req(a,url(sid)+'/assign','POST',{...body,stage:'practice'},409);
  const hw=await req(u,'/homework/'+work.homework_id);assert.equal(hw.library_item_ids.length,4);await req(sibling,'/homework/'+work.homework_id,'GET',undefined,404);await req(p,'/homework/'+work.homework_id);
  const word=(await query("SELECT translation,box FROM vocab_items WHERE student_id=$1 AND term='parent'",[sid])).rows[0];assert.deepEqual(word,{translation:'Личный перевод',box:5});assert.equal((await query('SELECT course_id FROM students WHERE id=$1',[sid])).rows[0].course_id,main);
 });
 await t.test('learner completes native exercise and homework; parent stays read-only; progress shows submission',async()=>{
  const item=unit.practice_packs.learn[1],game=(await query('SELECT game FROM library_items WHERE id=$1',[item])).rows[0].game;
  const r=await req(u,'/games/'+item+'/results','POST',{student_id:sid,homework_id:work.homework_id,answers:answers(game)},201);assert.equal(r.score,100);
  await req(p,'/games/'+item+'/results','POST',{student_id:sid,homework_id:work.homework_id,answers:answers(game)},403);
  await req(u,'/homework/'+work.homework_id+'/submit','POST',{student_answer:'Выполнил этап узнавания слов.'});assert.equal((await req(p,url(sid))).enrollments[0].totals.submitted,1);
 });
 await t.test('only the chosen pack is issued; closed course blocks new work but existing homework remains',async()=>{
  const next=await req(a,url(sid)+'/assign','POST',{course_id:course,unit_id:unit.id,stage:'practice',due_on:null,request_key:randomUUID()});assert.equal((await req(u,'/homework/'+next.homework_id)).library_item_ids.length,4);
  await req(a,url(sid),'PUT',{course_id:course,active:false});assert.equal((await req(u,url(sid))).enrollments.length,0);await req(u,'/homework/'+work.homework_id);
  await req(a,url(sid)+'/assign','POST',{course_id:course,unit_id:unit.id,stage:'check',due_on:null,request_key:randomUUID()},409);await req(a,url(sid),'PUT',{course_id:course,active:true});
 });
 await t.test('deleted or foreign library material cannot leak through a changed stage; mutation rolls back',async()=>{
  const otherItem=(await query("INSERT INTO library_items(tutor_id,kind,title,subject) VALUES($1,'task','Private','Английский язык') RETURNING id",[b.id])).rows[0].id;
  await query('UPDATE course_units SET homework_item_ids=$2,practice_packs=$3 WHERE id=$1',[unit.id,[otherItem],JSON.stringify({learn:[otherItem]})]);const before=(await query('SELECT COUNT(*)::int n FROM homework WHERE student_id=$1',[sid])).rows[0].n;
  await req(a,url(sid)+'/assign','POST',{course_id:course,unit_id:unit.id,stage:'learn',due_on:null,request_key:randomUUID()},409);assert.equal((await query('SELECT COUNT(*)::int n FROM homework WHERE student_id=$1',[sid])).rows[0].n,before);
 });
 await t.test('reinstalling a deleted course reuses already owned materials even after a paid plan ends',async()=>{
  await query('DELETE FROM courses WHERE id=$1',[course]);await query("UPDATE users SET plan='start',plan_until=NULL WHERE id=$1",[a.id]);require('../src/services/plans').forget(a.id);
  const before=(await query('SELECT COUNT(*)::int n FROM library_items WHERE tutor_id=$1',[a.id])).rows[0].n;
  const installed=await req(a,'/supplementary-courses/templates/elementary-vocabulary/install','POST',{});assert.notEqual(installed.course_id,course);assert.equal((await query('SELECT COUNT(*)::int n FROM library_items WHERE tutor_id=$1',[a.id])).rows[0].n,before);assert.equal((await query('SELECT COUNT(*)::int n FROM bank_takes WHERE tutor_id=$1',[a.id])).rows[0].n,612);
 });
});
