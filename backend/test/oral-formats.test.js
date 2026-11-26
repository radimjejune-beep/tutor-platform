const test=require('node:test'),assert=require('node:assert/strict');require('./helpers');
if(process.env.TEST_DATABASE_URL)process.env.DATABASE_URL=process.env.TEST_DATABASE_URL;
const {gameSchema,grade}=require('../src/services/games'),{items}=require('../src/bank/family-practice');
const tf={type:'quick',template:'truefalse',timer:0,items:[{q:'A grandmother is a parent’s mother.',a:'true'},{q:'A cousin is your parent.',a:'false'}]};
test('statements require explicit keys and strict boolean answers, including an honest false selection',()=>{
 gameSchema.parse(tf);assert.equal(grade(tf,{r:{0:true,1:false}}).score,100);assert.equal(grade(tf,{r:{0:false,1:true}}).score,0);for(const value of ['true','false',0,1,{},null])assert.equal(grade(tf,{r:{0:value,1:value}}).score,0);
 assert.equal(gameSchema.safeParse({...tf,items:[{q:'Bad key',a:'yes'}]}).success,false);assert.equal(gameSchema.safeParse({...tf,items:[{q:'No key',a:''}]}).success,false);
});
test('family lab has a consistent reference tree, eight real quiz questions and accepted riddle alternatives',()=>{
 assert.equal(items.length,5);for(const item of items)if(item.game)gameSchema.parse(item.game);
 const quiz=items.find(x=>x.game?.template==='quiz').game;assert.equal(quiz.items.length,8);assert.ok(quiz.items.every(q=>q.wrong.length===2));assert.equal(grade(quiz,{r:Object.fromEntries(quiz.items.map((x,i)=>[i,x.a]))}).score,100);
 const riddles=items.find(x=>x.game?.template==='type').game;for(const [i,x]of riddles.items.entries())for(const a of x.a.split('|'))assert.ok(grade(riddles,{r:{[i]:a}}).details[i].ok,`${i}/${a}`);
 const statements=items.find(x=>x.game?.template==='truefalse').game;assert.equal(grade(statements,{r:Object.fromEntries(statements.items.map((x,i)=>[i,x.a==='true']))}).score,100);
 assert.ok(quiz.context.includes('Amanda + George')&&quiz.context.includes('Lizzie + Leo'));
});
test('wheel requires questions but no answer key, records discussion manually and never invents a percent',()=>{
 const wheel=items.find(x=>x.game?.template==='wheel').game;assert.equal(wheel.items.length,12);gameSchema.parse(wheel);const result=grade(wheel,{r:{0:{done:true,text:'An oral answer'},1:{done:false},99:{done:true}},score:100,total:100});assert.equal(result.total,0);assert.equal(result.score,0);assert.equal(result.manual,1);assert.equal(result.details.length,1);assert.equal(result.details[0].ok,null);assert.equal(grade(wheel,{}).manual,0);
 assert.equal(gameSchema.safeParse({...wheel,items:Array.from({length:25},(_,i)=>({q:String(i),a:''}))}).success,false);
});
test('oral practice persists without lowering a pupil average or awarding fake automatic points',{skip:!process.env.TEST_DATABASE_URL},async t=>{
 const {query,pool}=require('../src/db'),{loadRoutes,call,uniq}=require('./helpers');t.after(()=>pool.end());await require('../src/services/migrate').migrate({log:()=>{}});await require('../src/services/schema').ensureAll();
 const owner=(await query("INSERT INTO users(role,login,password_hash,full_name,subject) VALUES('tutor',$1,'fixture','Oral fixture','Английский язык') RETURNING id",[uniq('oral')])).rows[0];
 const u=(await query("INSERT INTO users(role,login,password_hash,full_name,tutor_id,subject) VALUES('student',$1,'fixture','Oral pupil',$2,'Английский язык') RETURNING id,role",[uniq('oral-pupil'),owner.id])).rows[0];u.tid=owner.id;
 const child=(await query("INSERT INTO students(user_id,tutor_id,full_name,subject) VALUES($1,$2,'Oral pupil','Английский язык') RETURNING id",[u.id,owner.id])).rows[0];
 const material=async(game)=>(await query("INSERT INTO library_items(tutor_id,kind,title,subject,game) VALUES($1,'game','Original oral fixture','Английский язык',$2) RETURNING id",[owner.id,JSON.stringify(gameSchema.parse(game))])).rows[0].id;
 const wheel=await material(items.find(x=>x.game?.template==='wheel').game),auto=await material(tf),a=(await query("INSERT INTO assignments(tutor_id,title,library_item_ids,subject) VALUES($1,'Oral fixture',$2,'Английский язык') RETURNING id",[owner.id,[wheel,auto]])).rows[0];
 const hw=(await query("INSERT INTO homework(assignment_id,student_id,status,subject) VALUES($1,$2,'assigned','Английский язык') RETURNING id",[a.id,child.id])).rows[0];const games=loadRoutes('routes/games.js').mod,progress=loadRoutes('routes/progress.js').mod;
 const submit=(itemId,answers)=>call(games,'POST','/:itemId/results',{user:u,params:{itemId},body:{student_id:child.id,homework_id:hw.id,answers}});
 assert.equal((await submit(wheel,{})).status,400);assert.equal((await submit(wheel,{r:{0:{done:true,text:'I have got a sister.'}}})).status,201);
 let report=await call(progress,'GET','/students/:studentId',{user:u,params:{studentId:child.id},query:{subject:'Английский язык'}});assert.equal(report.body.games.avg_score,null);
 assert.equal((await submit(auto,{r:{0:true,1:false}})).status,201);report=await call(progress,'GET','/students/:studentId',{user:u,params:{studentId:child.id},query:{subject:'Английский язык'}});assert.equal(report.body.games.avg_score,100);assert.equal(report.body.games.attempts,2);
});
