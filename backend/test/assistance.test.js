'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('crypto');
test('assistance: live / coaching / lesson drafts over HTTP and PostgreSQL',{skip:!process.env.TEST_ASSISTANCE_DATABASE_URL},async t=>{
 process.env.DATABASE_URL=process.env.TEST_ASSISTANCE_DATABASE_URL;process.env.JWT_SECRET='assistance-local-fixture-secret-only-1234567';
 const express=require('express'),{query,pool}=require('../src/db'),auth=require('../src/middleware/auth');
 await require('../src/services/migrate').migrate({log:()=>{}});await require('../src/services/schema').ensureAll();await require('../src/services/bank').seed();
 const hub=require('../src/learning/live-hub'),coach=require('../src/learning/coaching'),grammar=require('../src/learning/grammar'),d=require('../src/learning/diagnostics');
 const app=express();app.use(express.json({limit:'200kb'}));app.use(auth.authenticate,auth.requirePasswordChanged);
 app.use('/bank',require('../src/routes/bank'));app.use('/live',require('../src/routes/live'));app.use('/coaching',require('../src/routes/coaching'));app.use('/lessons',require('../src/routes/lessons'));app.use('/games',require('../src/routes/games'));
 app.use((e,req,res,next)=>{if(e.status>=500||!e.status)console.error(e.stack);res.status(e.status||500).json({error:e.message});});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await hub.close();await pool.end();});const base=`http://127.0.0.1:${server.address().port}`;
 const user=async(role,owner)=>{const {rows:[u]}=await query("INSERT INTO users(role,login,password_hash,full_name,tutor_id,must_change_password,subject) VALUES($1,$2,'fixture','Test person',$3,false,'Английский язык') RETURNING *",[role,'assist_'+randomUUID().slice(0,14),owner||null]);return {...u,tid:owner||u.id,token:auth.signToken(u)};};
 const a=await user('tutor'),b=await user('tutor'),s1=await user('student',a.id),s2=await user('student',a.id),parent=await user('parent',a.id),foreign=await user('student',b.id);
 for(const u of [s1,s2,foreign])u.sid=(await query("INSERT INTO students(user_id,tutor_id,full_name,subject) VALUES($1,$2,$3,'Английский язык') RETURNING id",[u.id,u.tid,u===s1?'Anna':'Other pupil'])).rows[0].id;
 await query('INSERT INTO parent_students(parent_user_id,student_id) VALUES($1,$2)',[parent.id,s1.sid]);
 const req=async(u,path,method='GET',body,status=200)=>{const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(u?{Authorization:'Bearer '+u.token}:{})},body:body===undefined?undefined:JSON.stringify(body)});const out=await r.json();assert.equal(r.status,status,JSON.stringify({path,out}));return out;};
 const mklesson=async(sid,group=null)=>(await query("INSERT INTO lessons(student_id,starts_at,duration_min,topic,private_notes,group_id) VALUES($1,CURRENT_DATE+INTERVAL '3 days 12 hours',60,'Next lesson','Keep private note',$2) RETURNING id",[sid,group])).rows[0].id;
 const mkitem=async(tid,game,title='Grammar exercise',key='present-simple')=>(await query("INSERT INTO library_items(tutor_id,kind,subject,title,body,game,grammar_key) VALUES($1,'game','Английский язык',$2,'Instruction',$3,$4) RETURNING id",[tid,title,JSON.stringify(game),key])).rows[0].id;
 const game={type:'sheet',blocks:[{t:'choice',q:'She ___ here.',options:['work','works'],correct:1},{t:'gaps',text:'He [works] here and [lives] near.'}]},ans={blocks:{0:1,1:['works','lives']}};
 // Sheet answers use numeric block keys directly (the same format as the browser).
 const good={b:{0:1,1:['works','lives']}};
 const item=await mkitem(a.id,game),otherItem=await mkitem(b.id,game),lesson=await mklesson(s1.sid),lesson2=await mklesson(s2.sid),foreignLesson=await mklesson(foreign.sid);
 await query('INSERT INTO lesson_items(lesson_id,item_id,position) VALUES($1,$2,0),($3,$2,0)',[lesson,item,lesson2]);
 let session;
 await t.test('teacher controls, native snapshots, owned lesson/items and same request idempotency',async()=>{
  await req(s1,`/live/lessons/${lesson}/start`,'POST',{item_id:item,request_key:randomUUID()},403);
  await req(b,`/live/lessons/${lesson}`,'GET',undefined,404);await req(a,`/live/lessons/${foreignLesson}`,'GET',undefined,404);
  await req(a,`/live/lessons/${lesson}/start`,'POST',{item_id:otherItem,request_key:randomUUID()},404);
  const key=randomUUID();session=(await req(a,`/live/lessons/${lesson}/start`,'POST',{item_id:item,request_key:key})).id;
  assert.equal((await req(a,`/live/lessons/${lesson}/start`,'POST',{item_id:item,request_key:key})).id,session);
  await query("UPDATE library_items SET title='Edited later' WHERE id=$1",[item]);assert.equal((await req(s1,`/live/lessons/${lesson}`)).session.title,'Grammar exercise');
  const v=await req(parent,`/live/lessons/${lesson}`);assert.equal(v.responses.length,1);assert.deepEqual(v.members,[]);
  await req(s2,`/live/lessons/${lesson}`,'GET',undefined,404);
 });
 const cid=randomUUID(),save=(u,l,s,answers,rev,submit=false,status=200,client=cid)=>req(u,`/live/lessons/${l}/sessions/${s}/${submit?'submit':'draft'}`,'PUT',{answers,expected_revision:rev,client_id:client},status);
 await t.test('draft revisions prevent lost updates; server grades and submission counts once',async()=>{
  const first=await save(s1,lesson,session,good,0);assert.equal(first.response.revision,1);
  const conflict=await save(s1,lesson,session,{0:0},0,false,409,randomUUID());assert.deepEqual(conflict.current.answers,good);
  const teacher=await req(a,`/live/lessons/${lesson}`);assert.equal(teacher.responses[0].draft_details.length,3);
  const [x,y]=await Promise.all([save(s1,lesson,session,good,1,true),save(s1,lesson,session,good,1,true)]);assert.equal(x.result.score,100);assert.equal(y.result.score,100);assert.equal(Number(x.again)+Number(y.again),1);
  assert.equal((await query('SELECT count(*)::int n FROM game_results WHERE lesson_id=$1',[lesson])).rows[0].n,1);
  assert.equal((await query('SELECT points FROM student_activity WHERE student_id=$1',[s1.sid])).rows[0].points,3);
  await save(parent,lesson,session,good,2,true,403);await save(s1,lesson,session,good,2,false,409);
 });
 await t.test('ended sessions reject drafts, old submission remains idempotent, new session independent',async()=>{
  await req(a,`/live/lessons/${lesson}/end`,'POST',{session_id:session});assert.equal((await save(s1,lesson,session,good,2,true)).again,true);
  const fresh=(await req(a,`/live/lessons/${lesson}/start`,'POST',{item_id:item,request_key:randomUUID()})).id;
  await req(a,`/live/lessons/${lesson}/end`,'POST',{session_id:session});assert.equal((await req(s1,`/live/lessons/${lesson}`)).session.status,'active');
  await req(a,`/lessons/${lesson}/items`,'PUT',{item_ids:[]});assert.equal((await req(s1,`/live/lessons/${lesson}`)).session.status,'ended');await save(s1,lesson,fresh,good,0,false,409);
  await req(a,`/lessons/${lesson}/items`,'PUT',{item_ids:[item,otherItem]},404);assert.equal((await query('SELECT count(*)::int n FROM lesson_items WHERE lesson_id=$1',[lesson])).rows[0].n,0);
  await req(a,`/lessons/${lesson}/items`,'PUT',{item_ids:[item]});
 });
 await t.test('group answers isolated for pupil/parent, teacher sees both and group shares one session',async()=>{
  const gid=(await query("INSERT INTO groups(tutor_id,name) VALUES($1,'Test group') RETURNING id",[a.id])).rows[0].id;
  await query('UPDATE lessons SET group_id=$1 WHERE id=ANY($2::int[])',[gid,[lesson,lesson2]]);
  const r=await req(a,`/live/lessons/${lesson2}/start`,'POST',{item_id:item,request_key:randomUUID()});await save(s2,lesson2,r.id,{0:0},0);
  assert.equal((await req(a,`/live/lessons/${lesson}`)).responses.length,2);
  const v=await req(s1,`/live/lessons/${lesson}`);assert.equal(v.session.id,r.id);assert.equal(v.responses.length,1);assert.equal(v.responses[0].student_id,s1.sid);assert.deepEqual(v.responses[0].answers,{});
  assert.equal((await req(parent,`/live/lessons/${lesson}`)).responses.length,1);
  await save(s1,lesson2,r.id,good,0,false,404);
  await query('UPDATE lessons SET group_id=NULL WHERE id=ANY($1::int[])',[[lesson,lesson2]]);
 });
 await t.test('bounded input, all native grading formats, unsupported voice rejection',async()=>{
  const live=require('../src/learning/live');assert.equal(live.boundedAnswers({x:'a'.repeat(9000)}),false);assert.equal(live.boundedAnswers({x:{x:{x:{x:{x:{x:{x:{x:1}}}}}}}}),false);assert.equal(live.boundedAnswers(JSON.parse('{"__proto__":{}}')),false);
  const fixtures=[{type:'match',pairs:[{a:'one',b:'один'},{a:'two',b:'два'}]},{type:'order',sentences:['We work here.']},{type:'gaps',text:'We [work] here.',mode:'type'},{type:'groups',groups:[{name:'First',items:['one']},{name:'Second',items:['two']}]},{type:'quick',template:'quiz',items:[{q:'Test?',a:'yes',wrong:['no']}]},game,{type:'board',elements:[{id:'a',k:'input',text:'Test',a:'yes',x:0,y:0,w:100,h:40}]}];
  const right=[{pairs:{0:0,1:1}},{sentences:[['We','work','here.']]},{gaps:['work']},{items:{'0-0':0,'1-0':1}},{r:{0:'yes'}},good,{e:{a:'yes'}}];
  for(const [i,f]of fixtures.entries()){const parsed=require('../src/services/games').gameSchema.parse(f),iid=await mkitem(a.id,parsed,'Native '+f.type);await query('INSERT INTO lesson_items(lesson_id,item_id,position) VALUES($1,$2,10)',[lesson,iid]);const sid=(await req(a,`/live/lessons/${lesson}/start`,'POST',{item_id:iid,request_key:randomUUID()})).id;const view=await req(a,`/live/lessons/${lesson}`);assert.ok(view.responses[0].draft_details.length>0,f.type);const done=await save(s1,lesson,sid,right[i],0,true);assert.equal(done.result.score,100,f.type);}
  
  const voice=await mkitem(a.id,{type:'sheet',blocks:[{t:'voice',q:'Say hello'}]});await query('INSERT INTO lesson_items(lesson_id,item_id,position) VALUES($1,$2,2)',[lesson,voice]);await req(a,`/live/lessons/${lesson}/start`,'POST',{item_id:voice,request_key:randomUUID()},422);
 });
 await t.test('authenticated SSE receives database notifications and revokes changed password',async()=>{
  await req(null,`/live/lessons/${lesson}/stream?token=${s1.token}`,'GET',undefined,401);
  const controller=new AbortController(),stream=await fetch(base+`/live/lessons/${lesson}/stream`,{headers:{Authorization:'Bearer '+s1.token},signal:controller.signal});assert.ok(stream.headers.get('content-type').includes('text/event-stream'));
  const reader=stream.body.getReader(),decoder=new TextDecoder();let data='';
  async function until(text,timeout=7500){const end=Date.now()+timeout;while(!data.includes(text)){if(Date.now()>end)assert.fail('SSE timeout: '+data);const r=await Promise.race([reader.read(),new Promise((_,reject)=>setTimeout(()=>reject(Error('SSE read timeout')),timeout).unref())]);if(r.done)break;data+=decoder.decode(r.value);}assert.ok(data.includes(text),data);}
  await until('event: snapshot');data='';const r=await req(a,`/live/lessons/${lesson}/start`,'POST',{item_id:item,request_key:randomUUID()});await until(`"id":${r.id}`);
  data='';await query("UPDATE users SET password_hash='revoked' WHERE id=$1",[s1.id]);await until('event: access-error');assert.ok(data.includes('401'));controller.abort();await reader.cancel().catch(()=>{});
  await query("UPDATE users SET password_hash='fixture' WHERE id=$1",[s1.id]);
 });
 let review,nextReview;
 await t.test('helper uses real last result, minimum evidence, scope and one practice per baseline',async()=>{
  let p=await req(s1,`/coaching/students/${s1.sid}`);assert.equal(p.topics[0].topic_id,'present-simple');assert.equal(p.topics[0].source.score,100);
  await req(s2,`/coaching/students/${s1.sid}`,'GET',undefined,404);await req(parent,`/coaching/students/${s1.sid}/reviews`,'POST',{topic_id:'present-simple'},403);
  const x=await req(a,`/coaching/students/${s1.sid}/reviews`,'POST',{topic_id:'present-simple'});review=x.id;
  assert.equal((await req(s1,`/coaching/students/${s1.sid}/reviews`,'POST',{topic_id:'present-simple'})).id,review);
  const v=await req(s1,`/coaching/reviews/${review}`);assert.equal(v.questions.length,3);assert.ok(v.article.form);assert.ok(v.questions.every(q=>!Object.hasOwn(q,'correct')&&!Object.hasOwn(q,'explanation')));
  const pv=await req(parent,`/coaching/reviews/${review}`);assert.deepEqual(pv.questions,[]);await req(s2,`/coaching/reviews/${review}`,'GET',undefined,404);await req(b,`/coaching/reviews/${review}`,'GET',undefined,404);
 });
 await t.test('practice schedules different recheck after seven days; cannot unlock by URL or submit early',async()=>{
  const original=await req(a,`/coaching/reviews/${review}`),answers=Object.fromEntries(original.questions.map(q=>[q.id,q.correct[0]]));
  const r=await req(s1,`/coaching/reviews/${review}/submit`,'POST',{answers});assert.equal(r.result.score,100);nextReview=r.next.id;
  assert.ok(new Date(r.next.available_at)-Date.now()>6.99*864e5);
  const again=await req(s1,`/coaching/reviews/${review}/submit`,'POST',{answers:{}});assert.equal(again.again,true);assert.equal(again.result.score,100);
  const next=await req(s1,`/coaching/reviews/${nextReview}`);assert.equal(next.locked,true);assert.deepEqual(next.questions,[]);
  await req(s1,`/coaching/reviews/${nextReview}/submit`,'POST',{answers},409);await req(a,`/coaching/reviews/${review}/submit`,'POST',{answers},403);
  const raw=await coach.loadReview(nextReview);assert.ok(raw.questions.every(q=>!original.questions.some(p=>p.prompt===q.prompt)));
  const p=await req(s1,`/coaching/students/${s1.sid}`);assert.equal(p.topics[0].status,'waiting');assert.equal(p.topics[0].source.kind,'exercise');
 });
 await t.test('due recheck updates evidence; new checks invalidate older unfinished practice',async()=>{
  await query("UPDATE coaching_reviews SET available_at=NOW()-INTERVAL '1 second' WHERE id=$1",[nextReview]);let v=await req(s1,`/coaching/reviews/${nextReview}`);assert.equal(v.locked,false);assert.equal(v.questions.length,3);
  const raw=await coach.loadReview(nextReview),answers=Object.fromEntries(raw.questions.map(q=>[q.id,q.correct[0]]));await req(s1,`/coaching/reviews/${nextReview}/submit`,'POST',{answers});assert.equal((await req(parent,`/coaching/students/${s1.sid}`)).topics[0].source.kind,'recheck');
  const old=(await req(s1,`/coaching/students/${s1.sid}/reviews`,'POST',{topic_id:'present-simple'})).id;
  await query('INSERT INTO game_results(item_id,student_id,user_id,correct,total,score,details,grammar_key) VALUES($1,$2,$3,0,1,0,\'[]\',\'present-simple\')',[item,s1.sid,s1.id]);
  v=await req(s1,`/coaching/reviews/${old}`);assert.equal(v.stale,true);assert.deepEqual(v.questions,[]);await req(s1,`/coaching/reviews/${old}/submit`,'POST',{answers:{}},409);
  assert.equal((await req(s1,`/coaching/students/${s1.sid}`)).topics[0].status,'insufficient');
 });
 let plan,applyLesson;
 const patch=p=>({version:p.version,title:p.title,stages:p.stages.map(s=>({id:s.id,title:s.title,minutes:s.minutes,selected:s.selected,note:s.note,material_id:s.material_id||null,...(s.source.type==='generated'?{body:s.source.item.body}:{} )}))});
 await t.test('manual next lesson preview is owned, durable, accurate duration and editable',async()=>{
  plan=await req(a,`/coaching/students/${s1.sid}/preparations`,'POST',{duration:60,topic_ids:['present-simple']},201);assert.equal(plan.duration,60);assert.equal(plan.stages.reduce((n,s)=>n+s.minutes,0),60);assert.equal(Object.keys(plan.previews).length,5);
  assert.equal((await req(a,`/coaching/preparations/${plan.id}`)).id,plan.id);await req(b,`/coaching/preparations/${plan.id}`,'GET',undefined,404);await req(s1,`/coaching/preparations/${plan.id}`,'GET',undefined,403);
  const body=patch(plan);body.title='Edited lesson';body.stages.reverse();body.stages[0].note='Private stage note';body.stages.find(s=>s.body).body='Edited instructions';
  const changed=await req(a,`/coaching/preparations/${plan.id}`,'PATCH',body);assert.equal(changed.version,2);assert.equal(changed.stages[0].id,body.stages[0].id);await req(a,`/coaching/preparations/${plan.id}`,'PATCH',body,409);plan=changed;
  const bad=patch(plan);bad.stages[0].material_id=otherItem;await req(a,`/coaching/preparations/${plan.id}`,'PATCH',bad,404);
 });
 await t.test('apply appends atomically, preserves notes/materials, idempotent and private to teacher',async()=>{
  applyLesson=await mklesson(s1.sid);await query('INSERT INTO lesson_items(lesson_id,item_id,position) VALUES($1,$2,0)',[applyLesson,item]);
  await req(a,`/coaching/preparations/${plan.id}/apply`,'POST',{version:plan.version,lesson_id:foreignLesson},404);
  const r=await req(a,`/coaching/preparations/${plan.id}/apply`,'POST',{version:plan.version,lesson_id:applyLesson});assert.ok(r.added>0);
  const notes=(await query('SELECT private_notes FROM lessons WHERE id=$1',[applyLesson])).rows[0].private_notes;assert.ok(notes.startsWith('Keep private note'));assert.ok(notes.includes('Private stage note'));
  const items=(await query('SELECT * FROM lesson_items WHERE lesson_id=$1 ORDER BY position',[applyLesson])).rows;assert.equal(items[0].item_id,item);
  assert.equal((await req(a,`/coaching/preparations/${plan.id}/apply`,'POST',{version:plan.version,lesson_id:applyLesson})).again,true);assert.equal((await query('SELECT count(*)::int n FROM lesson_items WHERE lesson_id=$1',[applyLesson])).rows[0].n,items.length);
  assert.equal((await req(s1,`/lessons/${applyLesson}/room`)).private_notes,undefined);
 });
 await t.test('bank search filters scope, kind, type and source level; escapes wildcards and paginates',async()=>{
  await req(s1,'/bank/search?q=present','GET',undefined,403);
  const url='/bank/search?book=murphy-essential-4&kind=game&type=sheet&level=A1',first=await req(a,url),second=await req(a,url+'&page=2');assert.ok(first.total>24);assert.equal(first.items.length,24);assert.ok(first.items.every(i=>i.book==='murphy-essential-4'&&i.kind==='game'&&i.game.type==='sheet'));assert.ok(second.items.every(i=>!first.items.some(j=>j.id===i.id)));assert.equal(second.total,first.total);
  assert.equal((await req(a,'/bank/search?q='+encodeURIComponent("unlikely_literal_%_' OR true --"))).total,0);
  await req(a,'/bank/search?page=-1','GET',undefined,400);await req(a,'/bank/search?book=unknown','GET',undefined,404);
  assert.equal((await req(a,'/bank/search?book=murphy-essential-4&level=B2')).total,0);
  assert.ok((await req(a,'/bank/search?book=murphy-english-5&level=B1')).total>0);
  assert.equal((await req(a,'/bank/search?q=%25')).total,0);
  const exact=await req(a,'/bank/search?q=present%20simple&level=A1&type=sheet');assert.ok(exact.total>0);assert.ok(!exact.items.some(i=>i.book==='murphy-essential-4'&&i.unit==='20'),'Present Perfect + Past Simple is not a Present Simple match');
  const hidden=first.items[0];await query('UPDATE bank_items SET hidden=true WHERE id=$1',[hidden.id]);assert.ok(!(await req(a,url)).items.some(i=>i.id===hidden.id));await query('UPDATE bank_items SET hidden=false WHERE id=$1',[hidden.id]);
 });
 await t.test('bank lesson shortcut appends concurrently and rejects foreign/closed targets without changing materials',async()=>{
  const one=await mkitem(a.id,game,'Append one'),two=await mkitem(a.id,game,'Append two'),before=(await query('SELECT item_id FROM lesson_items WHERE lesson_id=$1',[applyLesson])).rows.map(x=>x.item_id);
  const add=(u,ids,lid=applyLesson,status=200)=>req(u,`/lessons/${lid}/append-items`,'POST',{item_ids:ids},status);
  await Promise.all([add(a,[one]),add(a,[two])]);const after=(await query('SELECT item_id FROM lesson_items WHERE lesson_id=$1',[applyLesson])).rows.map(x=>x.item_id);assert.ok([...before,one,two].every(i=>after.includes(i)));assert.equal((await add(a,[one,one])).added,0);
  await add(s1,[one],applyLesson,403);await add(a,[otherItem],applyLesson,404);await add(b,[otherItem],applyLesson,404);await add(a,[one],foreignLesson,404);
  await query("UPDATE lessons SET status='done' WHERE id=$1",[applyLesson]);await add(a,[one],applyLesson,409);await query("UPDATE lessons SET status='scheduled' WHERE id=$1",[applyLesson]);
  assert.deepEqual((await query('SELECT item_id FROM lesson_items WHERE lesson_id=$1 ORDER BY item_id',[applyLesson])).rows.map(x=>x.item_id),after.sort((a,b)=>a-b));
 });
 await t.test('no-data plan states uncertainty; invalid duration, deletion and hidden bank roll back',async()=>{
  const p=await req(a,`/coaching/students/${s2.sid}/preparations`,'POST',{duration:20,topic_ids:[]},201);assert.equal(p.stages.reduce((n,s)=>n+s.minutes,0),20);assert.ok(p.reasons.some(r=>r.title.includes('Недостаточно')));
  await req(a,`/coaching/students/${s1.sid}/preparations`,'POST',{duration:10,topic_ids:[]},400);
  const prepared=await req(a,`/coaching/students/${s2.sid}/preparations`,'POST',{duration:60,topic_ids:['present-simple']},201),body=patch(prepared);body.stages[4].material_id=item;
  const u=await req(a,`/coaching/preparations/${prepared.id}`,'PATCH',body),lid=await mklesson(s2.sid);await query('DELETE FROM library_items WHERE id=$1',[item]);const before=(await query('SELECT count(*)::int n FROM library_items WHERE tutor_id=$1',[a.id])).rows[0].n;
  await req(a,`/coaching/preparations/${u.id}/apply`,'POST',{version:u.version,lesson_id:lid},409);assert.equal((await query('SELECT count(*)::int n FROM library_items WHERE tutor_id=$1',[a.id])).rows[0].n,before);assert.equal((await query('SELECT count(*)::int n FROM lesson_items WHERE lesson_id=$1',[lid])).rows[0].n,0);
 });
 await t.test('every grammar topic can generate valid original practice and a separate recheck',()=>{
  const planner=require('../src/learning/lesson-planner'),{gameSchema,grade,parseGaps}=require('../src/services/games');
  for(const topic of grammar.topics){const item=planner.generated(topic.id,true);assert.ok(gameSchema.safeParse(item.game).success,topic.id);assert.equal(item.game.blocks.length,3);const b={};item.game.blocks.forEach((q,i)=>{b[i]=q.t==='choice'?q.correct:parseGaps(q.text).gaps.map(g=>g[0]);});assert.equal(grade(item.game,{b}).score,100,topic.id);assert.ok(planner.generated(topic.id,false).body.length>30);}
 });
 await t.test('course unit material stays owned and is preferred over a random library item',async()=>{
  const current=await mkitem(a.id,game,'Course activity',null),cid=(await query("INSERT INTO courses(tutor_id,title) VALUES($1,'Own course') RETURNING id",[a.id])).rows[0].id;
  const uid=(await query("INSERT INTO course_units(course_id,position,code,title,item_ids) VALUES($1,1,'1A','Current unit',$2) RETURNING id",[cid,[current]])).rows[0].id;
  await query('UPDATE students SET course_unit_id=$2 WHERE id=$1',[s2.sid,uid]);const p=await req(a,`/coaching/students/${s2.sid}/preparations`,'POST',{duration:45,topic_ids:[]},201);assert.equal(p.stages.find(s=>s.id==='main').source.id,current);assert.ok(p.reasons.some(r=>r.title.includes('Own course')));
 });
 await t.test('bank limits and hidden source fail atomically; an already taken item can be reused',async()=>{
  const {rows:[g]}=await query("SELECT id FROM bank_items WHERE book='murphy-essential-4' AND unit='1' AND kind='game' AND NOT hidden ORDER BY author_id IS NOT NULL,id LIMIT 1");
  const p=await req(a,`/coaching/students/${s2.sid}/preparations`,'POST',{duration:60,topic_ids:['mu-e4-1']},201),lid=await mklesson(s2.sid);assert.ok(p.stages.some(s=>s.source.type==='bank'));
  await query('UPDATE bank_items SET hidden=true WHERE id=$1',[g.id]);let before=(await query('SELECT count(*)::int n FROM library_items WHERE tutor_id=$1',[a.id])).rows[0].n;
  await req(a,`/coaching/preparations/${p.id}/apply`,'POST',{version:p.version,lesson_id:lid},409);assert.equal((await query('SELECT count(*)::int n FROM library_items WHERE tutor_id=$1',[a.id])).rows[0].n,before);await query('UPDATE bank_items SET hidden=false WHERE id=$1',[g.id]);
  await query("UPDATE users SET plan='start',plan_until=NULL WHERE id=$1",[a.id]);require('../src/services/plans').forget(a.id);await query('INSERT INTO bank_takes(item_id,tutor_id,library_id) SELECT id,$1,NULL FROM bank_items WHERE id<>$2 AND id NOT IN(SELECT item_id FROM bank_takes WHERE tutor_id=$1) LIMIT 15',[a.id,g.id]);
  await req(a,`/coaching/preparations/${p.id}/apply`,'POST',{version:p.version,lesson_id:lid},409);assert.equal((await query('SELECT count(*)::int n FROM lesson_items WHERE lesson_id=$1',[lid])).rows[0].n,0);
  await query("UPDATE users SET plan='tutor',plan_until=NOW()+INTERVAL '1 year' WHERE id=$1",[a.id]);require('../src/services/plans').forget(a.id);await req(a,`/coaching/preparations/${p.id}/apply`,'POST',{version:p.version,lesson_id:lid});
  const q=await req(a,`/coaching/students/${s2.sid}/preparations`,'POST',{duration:60,topic_ids:['mu-e4-1']},201);await query("UPDATE users SET plan='start',plan_until=NULL WHERE id=$1",[a.id]);require('../src/services/plans').forget(a.id);const lid2=await mklesson(s2.sid);await req(a,`/coaching/preparations/${q.id}/apply`,'POST',{version:q.version,lesson_id:lid2});
 });

});
