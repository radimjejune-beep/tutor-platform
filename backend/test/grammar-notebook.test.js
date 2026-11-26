const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('crypto');
if(process.env.TEST_DATABASE_URL)process.env.DATABASE_URL=process.env.TEST_DATABASE_URL;
require('./helpers');
const {topics}=require('../src/learning/grammar'),{lessons}=require('../src/learning/grammar-lessons'),{practice}=require('../src/learning/grammar-practice'),{contentOf}=require('../src/learning/grammar-content'),{items,books}=require('../src/bank/lessonfold-grammar'),{gameSchema,grade,parseGaps}=require('../src/services/games'),d=require('../src/learning/diagnostics');
test('original grammar curriculum: 47 substantive bilingual lessons, 376 valid new questions and 141 working bank materials',()=>{
 assert.equal(Object.keys(lessons).length,47);assert.equal(Object.values(practice).flat().length,376);assert.equal(items.length,141);assert.deepEqual(books.map(b=>b.units.length),[41,6]);
 const {contentSchema}=require('../src/routes/grammar-notebook');
 for(const [id,l]of Object.entries(lessons)){assert.ok(JSON.stringify(l).length>=1800,id);assert.ok(l.meaning.length>=2&&l.patterns.length>=3&&l.examples.length>=3&&l.errors.length>=2);for(const e of l.examples)assert.ok(e.text&&e.translation&&e.note,id);contentSchema.parse(contentOf(topics.find(t=>t.id===id)));const qs=practice[id];assert.equal(qs.length,8);d.questions.parse(qs);assert.equal(d.assess(qs,Object.fromEntries(qs.map(q=>[q.id,q.correct[0]]))).score,100);}
 for(const item of items){assert.ok(item.key.length<=80&&item.title.length<=255);if(!item.game)continue;const g=gameSchema.parse(item.game),answers={b:Object.fromEntries(g.blocks.map((b,i)=>[i,b.t==='choice'?b.correct:parseGaps(b.text).gaps.map(x=>x[0])]))};assert.equal(grade(g,answers).score,100,item.key);assert.equal(grade(g,{}).score,0,item.key);}
 assert.ok(!JSON.stringify(require('../src/learning/grammar').search()).includes('practice_questions'));
});
test('grammar notebooks: access, drafts, safe structured content, images, independent copies and concurrency',{skip:!process.env.TEST_DATABASE_URL},async t=>{
 const {query,pool}=require('../src/db'),{loadRoutes,call,uniq}=require('./helpers');t.after(()=>pool.end());await require('../src/services/migrate').migrate({log:()=>{}});await require('../src/services/schema').ensureAll();
 const route=loadRoutes('routes/grammar-notebook.js').mod,files=loadRoutes('routes/files.js').mod,learning=loadRoutes('routes/learning.js').mod;
 const make=async(role,tid)=>(await query("INSERT INTO users(role,login,password_hash,full_name,tutor_id,subject) VALUES($1,$2,'fixture',$2,$3,'Английский язык') RETURNING id,role,subject",[role,uniq('grammar'),tid||null])).rows[0];
 const tutor=await make('tutor'),other=await make('tutor');tutor.tid=tutor.id;other.tid=other.id;
 const u1=await make('student',tutor.id),u2=await make('student',tutor.id),parent=await make('parent',tutor.id),stranger=await make('student',other.id);for(const u of [u1,u2,parent])u.tid=tutor.id;stranger.tid=other.id;
 const child=async(u,tid)=>(await query("INSERT INTO students(user_id,tutor_id,full_name,subject) VALUES($1,$2,$3,'Английский язык') RETURNING id",[u.id,tid,uniq('pupil')])).rows[0].id;
 const s1=await child(u1,tutor.id),s2=await child(u2,tutor.id),foreign=await child(stranger,other.id);await query('INSERT INTO parent_students(parent_user_id,student_id) VALUES($1,$2)',[parent.id,s1]);await require('../src/learning/study-subjects').add(s1,tutor.id,'Французский язык');
 const callAs=(method,path,user,opts={})=>call(route,method,path,{user,...opts});
 const absent=(method,path,user,opts={})=>assert.rejects(callAs(method,path,user,opts),e=>e.status===404);
 const body={title:'Только Анне: вопросы',subject:'Английский язык',student_id:s1,content:[{type:'heading',text:'Вопросы'},{type:'table',headers:['Форма','Пример'],rows:[['Do/Does','Does she work?']]},{type:'scheme',items:['Найди подлежащее','Выбери do/does']}],published:false,request_key:randomUUID()};let pid,fid;
 await t.test('only the teacher creates, repeated requests do not duplicate and another teacher cannot read',async()=>{
  assert.equal((await callAs('POST','/',u1,{body})).status,403);
  const a=await callAs('POST','/',tutor,{body}),b=await callAs('POST','/',tutor,{body});pid=a.body.id;assert.equal(a.status,201);assert.equal(b.status,200);assert.equal(pid,b.body.id);
  await absent('GET','/:id',other,{params:{id:pid}});await assert.rejects(callAs('POST','/',tutor,{body:{...body,request_key:randomUUID(),student_id:foreign}}),e=>e.status===404);
  assert.equal((await callAs('GET','/',other)).body.items.length,0);
 });
 await t.test('draft pages and their image bytes are hidden from pupils and parents',async()=>{
  await absent('GET','/:id',u1,{params:{id:pid}});await absent('GET','/:id',parent,{params:{id:pid}});assert.deepEqual((await callAs('GET','/',u1)).body.items,[]);
  const r=await call(files,'POST','/',{user:tutor,body:{grammar_page_id:pid,filename:'fixture-photo.png',mime:'image/png',data:Buffer.from('local fictional image').toString('base64')}});assert.equal(r.status,201);fid=r.body.id;
  for(const u of [u1,u2,parent,other])assert.equal((await call(files,'GET','/:id',{user:u,params:{id:fid}})).status,404);
 });
 await t.test('publishing reveals only the selected pupil and linked parent, including image bytes',async()=>{
  const r=await callAs('PATCH','/:id',tutor,{params:{id:pid},body:{title:body.title,content:body.content,published:true,version:1}});assert.equal(r.status,200);
  for(const u of [u1,parent]){assert.equal((await callAs('GET','/:id',u,{params:{id:pid}})).body.files[0].id,fid);assert.equal((await call(files,'GET','/:id',{user:u,params:{id:fid}})).status,200);}
  await absent('GET','/:id',u2,{params:{id:pid}});assert.equal((await call(files,'GET','/:id',{user:u2,params:{id:fid}})).status,404);assert.equal((await call(files,'DELETE','/:id',{user:u1,params:{id:fid}})).status,404);
 });
 await t.test('wrong subjects, malformed tables and version conflicts are rejected without losing content',async()=>{
  assert.equal((await callAs('POST','/',tutor,{body:{...body,request_key:randomUUID(),content:[{type:'table',headers:['A','B'],rows:[['one']]}]}})).status,400);
  await assert.rejects(callAs('POST','/',tutor,{body:{...body,request_key:randomUUID(),subject:'Немецкий язык'}}),e=>e.status===422);
  await assert.rejects(callAs('PATCH','/:id',tutor,{params:{id:pid},body:{title:'stale',content:body.content,published:false,version:1}}),e=>e.status===409);
  assert.equal((await callAs('GET','/:id',u1,{params:{id:pid}})).body.title,body.title);
  await absent('PATCH','/:id',other,{params:{id:pid},body:{title:'foreign',content:body.content,published:false,version:2}});
 });
 await t.test('reusable templates and other-pupil copies are independent, private and keep copied images',async()=>{
  const key=randomUUID(),req={student_id:null,subject:'Английский язык',request_key:key};const a=await callAs('POST','/:id/copy',tutor,{params:{id:pid},body:req}),b=await callAs('POST','/:id/copy',tutor,{params:{id:pid},body:req});assert.equal(a.body.id,b.body.id);
  const tpl=(await callAs('GET','/:id',tutor,{params:{id:a.body.id}})).body;assert.equal(tpl.student_id,null);assert.equal(tpl.published,false);assert.equal(tpl.files.length,1);await absent('GET','/:id',u1,{params:{id:tpl.id}});
  const c=await callAs('POST','/:id/copy',tutor,{params:{id:tpl.id},body:{student_id:s2,subject:'Английский язык',request_key:randomUUID()}});const p=(await callAs('GET','/:id',tutor,{params:{id:c.body.id}})).body;
  await callAs('PATCH','/:id',tutor,{params:{id:p.id},body:{title:'Второму ученику',content:[{type:'paragraph',text:'Независимое объяснение'}],published:true,version:1}});
  assert.equal((await callAs('GET','/:id',u1,{params:{id:pid}})).body.title,body.title);assert.equal((await callAs('GET','/:id',u2,{params:{id:p.id}})).body.title,'Второму ученику');await absent('GET','/:id',u1,{params:{id:p.id}});
  await callAs('DELETE','/:id',tutor,{params:{id:pid},query:{version:'2'}});assert.equal((await call(files,'GET','/:id',{user:u2,params:{id:p.files[0].id}})).status,200);
 });
 await t.test('ready sources are snapshots, extended practice hides keys before checking and accepts every canonical answer',async()=>{
  const src=await callAs('GET','/source/:topic',tutor,{params:{topic:'present-simple'}});assert.equal(src.status,200);assert.ok(src.body.content.some(b=>b.type==='table'));
  assert.equal((await callAs('GET','/source/:topic',u1,{params:{topic:'present-simple'}})).status,403);
  const qs=await call(learning,'GET','/grammar/:topic/practice',{user:u1,params:{topic:'present-simple'},query:{size:'12'}});assert.equal(qs.body.length,12);assert.ok(qs.body.every(q=>!q.correct&&!q.explanation));const pool=topics.find(t=>t.id==='present-simple').practice_questions;
  const answers=Object.fromEntries(qs.body.map(q=>{const p=pool.find(x=>x.id===q.id);return [q.id,p.type==='choice'?p.options[p.correct[0]]:p.correct[0]];}));
  const result=await call(learning,'POST','/grammar/:topic/practice',{user:u1,params:{topic:'present-simple'},body:{question_ids:qs.body.map(q=>q.id),answers}});assert.equal(result.body.result.score,100);assert.ok(result.body.questions.every(q=>q.explanation));
  const article=await call(learning,'GET','/grammar/:topic',{user:u1,params:{topic:'present-simple'}});assert.ok(article.body.content.length>=12);assert.equal(article.body.practice_questions,undefined);
 });
 await t.test('notebook pagination keeps every page reachable and applies pupil ownership before counting',async()=>{
  await query(`INSERT INTO grammar_notebook_pages(tutor_id,student_id,subject,title,content,published)
    SELECT $1,CASE WHEN n<=16 THEN $2::int ELSE $3::int END,'Английский язык','Пагинация '||n,'[{"type":"paragraph","text":"Original fixture"}]'::jsonb,true FROM generate_series(1,31) n`,[tutor.id,s1,s2]);
  const a=(await callAs('GET','/',tutor,{query:{q:'Пагинация',page:'1'}})).body,b=(await callAs('GET','/',tutor,{query:{q:'Пагинация',page:'2'}})).body;
  assert.equal(a.total,31);assert.equal(a.items.length,30);assert.equal(b.items.length,1);assert.equal(a.pages,2);assert.ok(!a.items.some(x=>x.id===b.items[0].id));
  assert.equal((await callAs('GET','/',u1,{query:{q:'Пагинация'}})).body.total,16);assert.equal((await callAs('GET','/',u2,{query:{q:'Пагинация'}})).body.total,15);assert.equal((await callAs('GET','/',parent,{query:{q:'Пагинация'}})).body.total,16);
 });

});
