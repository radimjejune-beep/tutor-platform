'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('crypto');
if(process.env.TEST_EXPEDITION_DATABASE_URL)process.env.DATABASE_URL=process.env.TEST_EXPEDITION_DATABASE_URL;
const {validateAnnotation}=require('../src/learning/writing-feedback'),{trailPosition}=require('../src/learning/trail');
test('feedback anchors must match the exact submitted revision and cannot split an emoji',()=>{
 const text='A😀 café';validateAnnotation(text,{start:1,end:3,quote:'😀'});
 for(const b of [{start:1,end:2,quote:text.slice(1,2)},{start:-1,end:2,quote:''},{start:4,end:8,quote:'cafe'},{start:0,end:100,quote:text}])assert.throws(()=>validateAnnotation(text,b),e=>e.status===422);
 validateAnnotation(text,{start:0,end:0,quote:''});
});
test('the mountain preserves its summit before opening the next one',()=>{
 assert.deepEqual(trailPosition(0),{steps:0,peak:1,on_peak:false,step:0,completed_peaks:0});
 assert.equal(trailPosition(20).step,20);assert.equal(trailPosition(20).on_peak,true);
 assert.equal(trailPosition(21).peak,2);assert.equal(trailPosition(21).step,1);
 assert.equal(trailPosition(40).completed_peaks,2);assert.equal(trailPosition(-5).steps,0);
});
test('expedition: one pupil, two languages, lesson homework, writing revisions and independent trails',{skip:!process.env.TEST_EXPEDITION_DATABASE_URL},async t=>{
 process.env.DATABASE_URL=process.env.TEST_EXPEDITION_DATABASE_URL;process.env.JWT_SECRET='expedition-test-local-key-1234567890';
 const {query,pool}=require('../src/db'),auth=require('../src/middleware/auth');
 await require('../src/services/migrate').migrate({log:()=>{}});await require('../src/services/schema').ensureAll();
 const app=require('../src/server'),server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await pool.end();});
 const user=async(role,tid)=>{const {rows:[u]}=await query("INSERT INTO users(role,login,password_hash,full_name,tutor_id,must_change_password,subject) VALUES($1,$2,'fixture','Expedition person',$3,false,'Английский язык') RETURNING *",[role,'exp_'+randomUUID().slice(0,14),tid||null]);return {...u,token:auth.signToken(u)};};
 const teacher=await user('tutor'),other=await user('tutor'),pupil=await user('student',teacher.id),parent=await user('parent',teacher.id);
 const {rows:[s]}=await query("INSERT INTO students(user_id,tutor_id,full_name,subject) VALUES($1,$2,'Expedition pupil','Английский язык') RETURNING id",[pupil.id,teacher.id]);
 await query('INSERT INTO parent_students(parent_user_id,student_id) VALUES($1,$2)',[parent.id,s.id]);
 const EN='Английский язык',FR='Французский язык',q=subject=>'?subject='+encodeURIComponent(subject),base=`http://127.0.0.1:${server.address().port}/api`;
 const req=async(u,method,path,body,status=200)=>{const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+u.token},body:body===undefined?undefined:JSON.stringify(body)}),j=await r.json();assert.equal(r.status,status,JSON.stringify({path,j}));return j;};
 const exp=(subject,suffix)=>`/expedition/students/${s.id}/${suffix}${q(subject)}`;
 await req(teacher,'POST',`/study/students/${s.id}/subjects`,{subject:FR});await req(other,'GET',`/study/students/${s.id}/subjects`,undefined,404);
 await req(pupil,'POST',exp(EN,'trail/start'),{});await req(pupil,'POST',exp(FR,'trail/start'),{});
 const [lesson]=await req(teacher,'POST','/lessons',{student_id:s.id,subject:FR,starts_at:new Date(Date.now()+864e5).toISOString(),topic:'Au café'},201);
 const made=await req(teacher,'POST','/assignments',{title:'Écrire après le cours',student_ids:[s.id],lesson_id:lesson.id,subject:FR,answer_mode:'text'},201);
 const detail=await req(teacher,'GET','/assignments/'+made.id),hid=detail.submissions[0].id;
 const h=await req(pupil,'GET','/homework/'+hid);assert.equal(h.subject,FR);assert.equal(h.lesson_id,lesson.id);
 await req(teacher,'POST','/assignments',{title:'Invalid lesson direction',student_ids:[s.id],lesson_id:lesson.id,subject:EN},400);
 const text='Je suis au café. Elle parle.';await req(pupil,'POST',`/homework/${hid}/submit`,{student_answer:text});
 let w=await req(teacher,'POST','/expedition/writing',{source_kind:'homework',source_id:hid},201);w=await req(teacher,'GET','/expedition/writing/'+w.id);
 w=await req(teacher,'POST',`/expedition/writing/${w.id}/annotations`,{version:w.version,revision:1,start:17,end:21,quote:'Elle',body:'Qui parle ? Utilisez je.',category:'content'});
 assert.equal((await req(pupil,'GET','/expedition/writing/'+w.id)).annotations.length,0);
 await req(other,'GET','/expedition/writing/'+w.id,undefined,404);await req(parent,'POST',`/expedition/writing/${w.id}/revisions`,{version:w.version,text:'No'},403);
 w=await req(teacher,'POST',`/expedition/writing/${w.id}/publish`,{version:w.version});const old=w.version;
 w=await req(pupil,'POST',`/expedition/writing/${w.id}/revisions`,{version:w.version,text:'Je suis au café. Je parle.'});assert.equal(w.versions[0].text,text);assert.equal(w.versions.length,2);
 await req(pupil,'POST',`/expedition/writing/${w.id}/revisions`,{version:old,text:'Stale text'},409);await req(teacher,'POST',`/expedition/writing/${w.id}/accept`,{version:w.version});
 let fr=await req(parent,'GET',exp(FR,'trail'));assert.equal(fr.steps,1);
 const overdue=await req(teacher,'POST','/assignments',{title:'Overdue EN',student_ids:[s.id],subject:EN,due_on:'2020-01-01'},201);
 const earned=await req(teacher,'POST','/assignments',{title:'Reviewed EN',student_ids:[s.id],subject:EN},201),eh=(await req(teacher,'GET','/assignments/'+earned.id)).submissions[0].id;
 await req(teacher,'PATCH','/homework/'+eh,{status:'checked',score:90});let en=await req(pupil,'POST',exp(EN,'trail/sync'),{});assert.equal(en.blocked,true);assert.equal(en.pending,1);assert.equal(en.steps,0);assert.equal((await req(parent,'GET',exp(FR,'trail'))).blocked,false);
 const oh=(await req(teacher,'GET','/assignments/'+overdue.id)).submissions[0].id;await req(pupil,'POST',`/homework/${oh}/submit`,{student_answer:'Done'});en=await req(parent,'GET',exp(EN,'trail'));assert.equal(en.steps,1);assert.equal(en.blocked,false);assert.equal((await req(pupil,'POST',exp(EN,'trail/sync'),{})).steps,1);
 // The same written word belongs to separate direction-specific vocabularies.
 for(const [subject,translation] of [[EN,'разговор'],[FR,'кот']])await req(pupil,'POST','/vocab/mine',{student_id:s.id,subject,items:[{term:'chat',translation}]},201);
 assert.equal((await req(pupil,'GET',`/vocab?student_id=${s.id}&subject=${encodeURIComponent(FR)}`)).items.find(w=>w.term==='chat').translation,'кот');
 const preview=await req(teacher,'POST','/learning/diagnostics/preview',{student_ids:[s.id],subject:FR,mode:'topics',topic_ids:['fr-etre'],per_topic:3});assert.equal(preview.papers[0].questions.length,3);
 const diagnostic=await req(teacher,'POST','/learning/diagnostics',{title:'Français A1',subject:FR,mode:'topics',request_key:randomUUID(),papers:preview.papers.map(({student_id,questions})=>({student_id,questions}))},201);
 const run=(await req(teacher,'GET','/learning/diagnostics/tests/'+diagnostic.id)).runs[0];assert.equal((await req(pupil,'GET','/learning/diagnostics/runs/'+run.id)).subject,FR);
 assert.equal((await req(pupil,'GET',`/learning/diagnostics?student_id=${s.id}&subject=${encodeURIComponent(EN)}`)).length,0);
 for(const subject of [EN,FR]){await req(pupil,'GET',`/dashboard?student_id=${s.id}&subject=${encodeURIComponent(subject)}`);await req(pupil,'GET',`/progress/students/${s.id}/recommendations?subject=${encodeURIComponent(subject)}`);}
 const MATH='Математика';await req(teacher,'POST',`/study/students/${s.id}/subjects`,{subject:MATH});
 let math=await req(pupil,'POST',exp(MATH,'trail/start'),{});
 math=await req(teacher,'PATCH',exp(MATH,'trail'),{version:math.version,paused:false,gate_overdue:false,mode:'manual',obstacle:'dragon'});assert.equal(math.obstacle,'dragon');
 const oldMath=await req(teacher,'POST','/assignments',{title:'First math task',student_ids:[s.id],subject:MATH},201),mh=(await req(teacher,'GET','/assignments/'+oldMath.id)).submissions[0].id;
 await req(teacher,'PATCH','/homework/'+mh,{status:'checked',score:100});assert.equal((await req(pupil,'POST',exp(MATH,'trail/sync'),{})).steps,0);
 const grant={version:math.version,request_key:randomUUID(),steps:2,reason:'Самостоятельно объяснил решение задачи'};
 await req(pupil,'POST',exp(MATH,'trail/grants'),grant,403);await req(other,'POST',exp(MATH,'trail/grants'),grant,404);
 math=await req(teacher,'POST',exp(MATH,'trail/grants'),grant);assert.equal(math.steps,2);
 assert.equal((await req(teacher,'POST',exp(MATH,'trail/grants'),grant)).steps,2);await req(teacher,'POST',exp(MATH,'trail/grants'),{...grant,reason:'Changed grant'},409);
 math=await req(teacher,'PATCH',exp(MATH,'trail'),{version:math.version,paused:true,gate_overdue:false,mode:'manual',obstacle:'dragon'});
 math=await req(teacher,'POST',exp(MATH,'trail/grants'),{version:math.version,request_key:randomUUID(),steps:3,reason:'Уверенно решил три примера'});assert.equal(math.pending,3);assert.equal(math.steps,2);
 math=await req(teacher,'POST',exp(MATH,'trail/grants'),{version:math.version,request_key:randomUUID(),steps:1,reason:'Особое достижение на уроке',bypass_gate:true});assert.equal(math.steps,3);assert.equal(math.pending,3);
 math=await req(teacher,'PATCH',exp(MATH,'trail'),{version:math.version,paused:false,gate_overdue:false,mode:'auto',obstacle:'camp'});assert.equal(math.steps,6);assert.equal(math.pending,0);
 // Turning automation on does not award old reviewed work retroactively.
 assert.equal((await req(pupil,'POST',exp(MATH,'trail/sync'),{})).steps,6);
 await req(teacher,'POST',exp(MATH,'trail/grants'),{version:math.version,request_key:randomUUID(),steps:1,reason:'Manual in auto mode'},409);
 const topic=(await req(teacher,'POST','/progress/topics',{student_id:s.id,subject:MATH,items:[{title:'Умею объяснить решение задачи',skill:'other'}]},201))[0];
 await req(teacher,'PATCH','/progress/topics/'+topic.id,{evidence_ref:{kind:'homework',id:hid}},422);
 await req(teacher,'PATCH','/progress/topics/'+topic.id,{status:'done',evidence_ref:{kind:'homework',id:mh},evidence_note:'Показал ход рассуждения без подсказки'});
 const progress=await req(pupil,'GET',`/progress/students/${s.id}${q(MATH)}`);assert.equal(progress.topics[0].reference.id,mh);assert.equal((await req(parent,'GET',exp(MATH,'trail'))).steps,7);
 const game={type:'sheet',blocks:[{t:'choice',q:'2 + 2 = ?',options:['4','5'],correct:0},{t:'choice',q:'3 + 3 = ?',options:['6','7'],correct:0},{t:'rewrite',q:'Вычислите',src:'2 + 5',a:'7'}]};
 const grade=require('../src/services/games').grade(game,{b:{0:1,1:1,2:'8'}});
 const item=(await query("INSERT INTO library_items(tutor_id,kind,subject,title,game) VALUES($1,'game',$2,'Сложение целых чисел',$3) RETURNING id",[teacher.id,MATH,JSON.stringify(game)])).rows[0].id;
 await query("INSERT INTO game_results(item_id,student_id,user_id,subject,correct,total,score,details) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",[item,s.id,pupil.id,MATH,grade.correct,grade.total,grade.score,JSON.stringify(grade.details)]);
 const choices=await req(pupil,'GET',exp(MATH,'workout'));assert.equal(choices.suggestions.length,1);assert.equal(choices.suggestions[0].questions,undefined);
 const pack=await req(pupil,'POST',exp(MATH,'workout'),{}),publicPack=await req(pupil,'GET','/expedition/workouts/'+pack.id),teacherPack=await req(teacher,'GET','/expedition/workouts/'+pack.id);assert.equal(publicPack.questions.length,3);assert.ok(publicPack.questions.every(q=>!Object.hasOwn(q,'correct')));
 const answers=Object.fromEntries(teacherPack.questions.map(q=>[q.id,q.correct[0]]));const result=await req(pupil,'POST',`/expedition/workouts/${pack.id}/submit`,{answers});assert.equal(result.result.score,100);assert.equal(result.result.topics[0].title,'Сложение целых чисел');assert.equal((await req(parent,'GET',exp(MATH,'trail'))).steps,8);

 // Reclassifying historical homework preserves results and cannot duplicate a
 // reward that has already been credited in another direction.
 const frBefore=(await req(parent,'GET',exp(FR,'trail'))).steps;
 await req(parent,'PATCH',`/expedition/homework/${eh}/context`,{subject:FR,lesson_id:lesson.id},403);
 await req(other,'PATCH',`/expedition/homework/${eh}/context`,{subject:FR,lesson_id:lesson.id},404);
 await req(teacher,'PATCH',`/expedition/homework/${eh}/context`,{subject:EN,lesson_id:lesson.id},422);
 await req(teacher,'PATCH',`/expedition/homework/${eh}/context`,{subject:FR,lesson_id:lesson.id});
 const moved=await req(pupil,'GET','/homework/'+eh);assert.equal(moved.subject,FR);assert.equal(moved.lesson_id,lesson.id);assert.equal(moved.score,90);assert.equal(moved.status,'checked');
 assert.equal((await req(parent,'GET',exp(FR,'trail'))).steps,frBefore);assert.equal((await req(parent,'GET',exp(EN,'trail'))).steps,1);
 const frSection=await req(teacher,'POST','/learning/sections',{title:'Основы',subject:FR,grammar_key:'fr-etre'},201),enSection=await req(teacher,'POST','/learning/sections',{title:'Основы',subject:EN,grammar_key:'be'},201);assert.notEqual(frSection.id,enSection.id);
 await req(teacher,'PATCH',`/learning/students/${s.id}/homework-sections`,{homework_ids:[eh],section_id:enSection.id},422);
 await req(teacher,'PATCH',`/learning/students/${s.id}/homework-sections`,{homework_ids:[eh],section_id:frSection.id});

});
