const test=require('node:test');
const assert=require('node:assert/strict');
if(process.env.TEST_LEARNING_DATABASE_URL)process.env.DATABASE_URL=process.env.TEST_LEARNING_DATABASE_URL;
const catalog=require('../src/learning/grammar');
const d=require('../src/learning/diagnostics');
const {randomUUID}=require('crypto');
const solve=qs=>Object.fromEntries(qs.map(q=>[q.id,q.correct[0]]));

test('справочник: английская программа сохранена, французские темы обособлены и проверяются',()=>{
 assert.equal(catalog.topics.filter(t=>t.subject==='Английский язык').length,301);
 assert.equal(catalog.topics.filter(t=>t.subject==='Французский язык').length,6);
 assert.equal(new Set(catalog.topics.map(t=>t.id)).size,catalog.topics.length);
 for(const t of catalog.topics){assert.equal(t.questions.length,t.subject==='Французский язык'?8:6,t.id);d.questions.parse(t.questions);assert.equal(d.assess(t.questions,solve(t.questions)).score,100);}
 for(const q of ['объяснение Present Simple','презент симпл','я забыл Present Simple','что такое Present Simple'])assert.ok(catalog.search(q).some(t=>t.id==='present-simple'));
 assert.ok(catalog.search('прошедшее').some(t=>t.id==='past-simple'));
 assert.equal(catalog.matchTopic('Present Simple: questions'),'present-simple');assert.equal(catalog.matchTopic('какая-то новая тема'),null);
 assert.ok(catalog.search().every(t=>!Object.hasOwn(t,'questions')));
});
test('диагностика: баланс тем, перемешивание, строгие типы и ограничения',()=>{
 const qs=d.generate(['present-simple','articles'],3);assert.equal(qs.length,6);assert.equal(new Set(qs.map(q=>q.id)).size,6);assert.equal(qs.filter(q=>q.topic_id==='articles').length,3);
 assert.equal(d.assess(qs,solve(qs)).score,100);assert.equal(d.assess(qs,{}).score,0);
 const q={...catalog.byId.get('present-simple').questions[0],correct:[0]};
 for(const bad of [null,false,'',undefined,'0'])assert.equal(d.assess([q],{[q.id]:bad}).score,0);
 assert.ok(d.publicQuestions(qs).every(q=>!Object.hasOwn(q,'correct')&&!Object.hasOwn(q,'explanation')));
 assert.throws(()=>d.generate(catalog.topics.slice(0,10).map(t=>t.id),6),/50/);
 assert.equal(d.date.safeParse('2026-02-30').success,false);assert.equal(d.question.safeParse({...q,id:'__proto__'}).success,false);
});
test('вывод по теме учитывает число вопросов и пороги результата',()=>{
 const qs=catalog.byId.get('present-simple').questions.slice(0,3);
 assert.equal(d.assess(qs.slice(0,1),solve(qs)).topics[0].status,'insufficient');
 assert.equal(d.assess(qs,solve(qs.slice(0,1))).topics[0].status,'repeat');
 assert.equal(d.assess(qs,solve(qs.slice(0,2))).topics[0].status,'practice');
 assert.equal(d.assess(qs,solve(qs)).topics[0].status,'confident');
});

test('обучение на PostgreSQL: доступ, назначения, отчёты и разделы',{skip:!process.env.TEST_LEARNING_DATABASE_URL},async t=>{
 process.env.DATABASE_URL=process.env.TEST_LEARNING_DATABASE_URL;
 const {loadRoutes,call,uniq}=require('./helpers');const {query,pool}=require('../src/db');t.after(()=>pool.end());
 await require('../src/services/migrate').migrate({log:()=>{}});await require('../src/services/schema').ensureAll();
 const route=loadRoutes('routes/learning.js').mod;
 const user=async(role,owner)=>{const {rows:[u]}=await query("INSERT INTO users(role,login,password_hash,full_name,tutor_id) VALUES($1,$2,'x',$2,$3) RETURNING id,role",[role,uniq('learn'),owner||null]);return {...u,tid:owner||u.id,subject:'Английский язык'};};
 const a=await user('tutor'),b=await user('tutor'),u1=await user('student',a.id),u2=await user('student',a.id),outsider=await user('student',b.id),parent=await user('parent',a.id),otherParent=await user('parent',b.id);
 const makeStudent=async(u,tid,name)=>(await query('INSERT INTO students(user_id,tutor_id,full_name) VALUES($1,$2,$3) RETURNING id',[u.id,tid,name])).rows[0].id;
 const s1=await makeStudent(u1,a.id,'Первый'),s2=await makeStudent(u2,a.id,'Второй'),foreign=await makeStudent(outsider,b.id,'Чужой');
 await query('INSERT INTO parent_students(parent_user_id,student_id) VALUES($1,$2),($3,$4)',[parent.id,s1,otherParent.id,foreign]);
 let sectionId,body,testId,r1,r2;
 await t.test('разделы приватны; чужой раздел нельзя назначить',async()=>{
  const made=await call(route,'POST','/sections',{user:a,body:{title:'Present Simple',grammar_key:'present-simple'}});assert.equal(made.status,201);sectionId=made.body.id;
  assert.equal((await call(route,'GET','/sections',{user:b})).body.length,0);
  assert.equal((await call(route,'GET','/sections',{user:parent,query:{student_id:s1}})).body.length,0);
  assert.equal((await call(route,'PATCH','/sections/:id',{user:b,params:{id:sectionId},body:{title:'Нельзя'}})).status,404);
  const reused=await call(route,'POST','/sections',{user:a,body:{title:'  present simple  '}});
  assert.equal(reused.status,200);assert.equal(reused.body.id,sectionId);assert.equal(reused.body.reused,true);assert.equal(reused.body.grammar_key,'present-simple');
  const ar=loadRoutes('routes/assignments.js').mod;
  assert.equal((await call(ar,'POST','/',{user:b,body:{title:'Чужой раздел',student_ids:[foreign],section_id:sectionId}})).status,400);
 });
 await t.test('сборка только по индивидуальным пройденным темам',async()=>{
  const progress=loadRoutes('routes/progress.js').mod;
  const p=await call(progress,'POST','/topics',{user:a,body:{student_id:s1,items:[{title:'Present Simple: questions'}]}});
  assert.equal(p.body[0].grammar_key,'present-simple');
  await call(progress,'PATCH','/topics/:id',{user:a,params:{id:p.body[0].id},body:{status:'done'}});
  await query("INSERT INTO progress_topics(student_id,title,status,grammar_key) VALUES($1,'Артикли','done','articles'),($2,'Будущее','planned','future-will')",[s2,s1]);
  await call(progress,'PATCH','/topics/:id',{user:a,params:{id:p.body[0].id},body:{grammar_key:null}});
  assert.deepEqual(await d.completed(s1),[]);
  await call(progress,'PATCH','/topics/:id',{user:a,params:{id:p.body[0].id},body:{grammar_key:'present-simple'}});
  const r=await call(route,'POST','/diagnostics/preview',{user:a,body:{student_ids:[s1,s2],mode:'covered',per_topic:3}});assert.equal(r.status,200);
  assert.ok(r.body.papers.find(p=>p.student_id===s1).questions.every(q=>q.topic_id==='present-simple'));
  assert.ok(r.body.papers.find(p=>p.student_id===s2).questions.every(q=>q.topic_id==='articles'));
  body={title:'Неделя 1',mode:'covered',section_id:sectionId,request_key:randomUUID(),papers:r.body.papers.map(p=>({student_id:p.student_id,questions:p.questions}))};
  assert.equal((await call(route,'POST','/diagnostics/preview',{user:b,body:{student_ids:[s1],mode:'covered'}})).status,404);
 });
 await t.test('атомарная и идемпотентная выдача, изоляция учеников',async()=>{
  const bad={...body,request_key:randomUUID(),papers:[...body.papers,{student_id:foreign,questions:body.papers[0].questions}]};
  await assert.rejects(call(route,'POST','/diagnostics',{user:a,body:bad}),e=>e.status===404);
  assert.equal((await query('SELECT count(*)::int AS n FROM diagnostic_tests')).rows[0].n,0);
  const rs=await Promise.all([call(route,'POST','/diagnostics',{user:a,body}),call(route,'POST','/diagnostics',{user:a,body})]);assert.equal(rs[0].body.id,rs[1].body.id);testId=rs[0].body.id;
  const {rows}=await query('SELECT * FROM diagnostic_runs ORDER BY student_id');r1=rows.find(r=>r.student_id===s1);r2=rows.find(r=>r.student_id===s2);assert.equal(rows.length,2);
  assert.equal((await query("SELECT count(*)::int AS n FROM notifications WHERE kind='diagnostic_new'")).rows[0].n,2);
  await assert.rejects(call(route,'POST','/diagnostics',{user:a,body:{...body,title:'Другая выдача'}}),e=>e.status===409);
  assert.equal((await call(route,'GET','/diagnostics/tests/:id',{user:b,params:{id:testId}})).status,404);
 });
 await t.test('до сдачи ключи скрыты; родитель не отвечает; чужая работа недоступна',async()=>{
  const run=await call(route,'GET','/diagnostics/runs/:id',{user:u1,params:{id:r1.id}});assert.ok(run.body.questions.every(q=>!Object.hasOwn(q,'correct')&&!Object.hasOwn(q,'explanation')));assert.equal(run.body.result,null);
  const pr=await call(route,'GET','/diagnostics/runs/:id',{user:parent,params:{id:r1.id}});assert.deepEqual(pr.body.questions,[]);assert.deepEqual(pr.body.answers,{});
  for(const actor of [u2,outsider,otherParent,b])await assert.rejects(call(route,'GET','/diagnostics/runs/:id',{user:actor,params:{id:r1.id}}),e=>e.status===404);
  assert.equal((await call(route,'POST','/diagnostics/runs/:id/submit',{user:parent,params:{id:r1.id},body:{answers:{}}})).status,403);
  assert.equal((await call(route,'PUT','/diagnostics/runs/:id/draft',{user:u1,params:{id:r1.id},body:{answers:solve(r1.questions)}})).status,200);
  assert.deepEqual((await call(route,'GET','/diagnostics/runs/:id',{user:parent,params:{id:r1.id}})).body.answers,{});
 });
 await t.test('конкурентная сдача: серверная оценка, неизменность результата и одно уведомление',async()=>{
  const answers=solve(r1.questions);
  await Promise.all([call(route,'POST','/diagnostics/runs/:id/submit',{user:u1,params:{id:r1.id},body:{answers}}),call(route,'POST','/diagnostics/runs/:id/submit',{user:u1,params:{id:r1.id},body:{answers}})]);
  const result=(await call(route,'GET','/diagnostics/runs/:id',{user:parent,params:{id:r1.id}})).body;assert.equal(result.result.score,100);assert.equal(result.result.topics[0].status,'confident');assert.ok(result.questions.every(q=>q.correct));
  await call(route,'POST','/diagnostics/runs/:id/submit',{user:u1,params:{id:r1.id},body:{answers:{}}});assert.equal((await query('SELECT result FROM diagnostic_runs WHERE id=$1',[r1.id])).rows[0].result.score,100);
  assert.equal((await call(route,'PUT','/diagnostics/runs/:id/draft',{user:u1,params:{id:r1.id},body:{answers:{}}})).status,409);
  const {rows}=await query("SELECT user_id FROM notifications WHERE kind='diagnostic_result'");assert.deepEqual(rows.map(r=>r.user_id).sort((x,y)=>x-y),[a.id,u1.id,parent.id].sort((x,y)=>x-y));
  assert.equal((await call(route,'GET','/diagnostics/runs/:id',{user:u2,params:{id:r2.id}})).body.result,null);
 });
 await t.test('практика не меняет результат диагностики',async()=>{
  const p=await call(route,'GET','/grammar/:topic/practice',{user:u1,params:{topic:'present-simple'}});assert.equal(p.body.length,3);assert.ok(p.body.every(q=>!q.correct));
  const qs=catalog.byId.get('present-simple').questions,given=Object.fromEntries(p.body.map(q=>{const orig=qs.find(x=>x.id===q.id);return [q.id,orig.type==='choice'?orig.options[orig.correct[0]]:orig.correct[0]];}));
  const c=await call(route,'POST','/grammar/:topic/practice',{user:u1,params:{topic:'present-simple'},body:{question_ids:p.body.map(q=>q.id),answers:given}});assert.equal(c.body.result.score,100);
  assert.equal((await call(route,'GET','/grammar/:topic/bank',{user:u1,params:{topic:'present-simple'}})).status,403);
  assert.equal((await query('SELECT result FROM diagnostic_runs WHERE id=$1',[r1.id])).rows[0].result.score,100);
 });
 await t.test('раздел связывает работы и проверки; перенос и удаление сохраняют данные',async()=>{
  const ar=loadRoutes('routes/assignments.js').mod,hr=loadRoutes('routes/homework.js').mod;
  const c=await call(ar,'POST','/',{user:a,body:{title:'Домашка по вопросам',student_ids:[s1],section_id:sectionId}});assert.equal(c.status,201);assert.equal(c.body.section_id,sectionId);
  const hw=await call(hr,'GET','/',{user:u1,query:{student_id:s1}});assert.equal(hw.body[0].section_title,'Present Simple');
  assert.ok((await call(route,'GET','/sections',{user:parent,query:{student_id:s1}})).body.some(s=>s.id===sectionId));
  const loose=(await call(route,'POST','/sections',{user:a,body:{title:'Другой модуль'}})).body;
  await call(ar,'PATCH','/:id',{user:a,params:{id:c.body.id},body:{section_id:loose.id}});assert.equal((await query('SELECT section_id FROM assignments WHERE id=$1',[c.body.id])).rows[0].section_id,loose.id);
  await call(route,'DELETE','/sections/:id',{user:a,params:{id:loose.id}});assert.equal((await query('SELECT section_id FROM assignments WHERE id=$1',[c.body.id])).rows[0].section_id,null);
  await call(route,'DELETE','/sections/:id',{user:a,params:{id:sectionId}});assert.equal((await query('SELECT section_id FROM diagnostic_tests WHERE id=$1',[testId])).rows[0].section_id,null);
  assert.equal((await query('SELECT result FROM diagnostic_runs WHERE id=$1',[r1.id])).rows[0].result.score,100);
 });
});
