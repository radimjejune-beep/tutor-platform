'use strict';
const {query,transaction}=require('../db'),grammar=require('./grammar'),d=require('./diagnostics');
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const byUnit=new Map(grammar.topics.filter(t=>t.book_id).map(t=>[`${t.book_id}:${t.unit}`,t.id]));
const label=t=>t.label||t.title;
async function libraryTopic(itemId,db={query}){
 const {rows:[i]}=await db.query(`SELECT i.grammar_key,b.book,b.unit FROM library_items i
 LEFT JOIN LATERAL(SELECT b.book,b.unit FROM bank_takes bt JOIN bank_items b ON b.id=bt.item_id WHERE bt.library_id=i.id AND bt.tutor_id=i.tutor_id LIMIT 1)b ON true WHERE i.id=$1`,[itemId]);
 return grammar.byId.has(i?.grammar_key)?i.grammar_key:byUnit.get(`${i?.book}:${i?.unit}`)||null;
}
async function evidence(studentId,db={query},subject='Английский язык'){
 const {rows:runs}=await db.query(`SELECT r.id,r.questions,r.result,r.submitted_at,t.title FROM diagnostic_runs r JOIN diagnostic_tests t ON t.id=r.test_id JOIN students s ON s.id=r.student_id
 WHERE r.student_id=$1 AND COALESCE(r.subject,'Английский язык')=$2 AND r.submitted_at>NOW()-INTERVAL '180 days' AND t.tutor_id=s.tutor_id ORDER BY r.submitted_at DESC,r.id DESC LIMIT 80`,[studentId,subject]);
 const out=[];
 for(const r of runs)for(const t of r.result?.topics||[]){if(grammar.byId.get(t.topic_id)?.subject!==subject)continue;out.push({key:`d:${r.id}:${t.topic_id}`,topic_id:t.topic_id,kind:'diagnostic',id:r.id,title:r.title,total:Number(t.total),correct:Number(t.correct),score:Number(t.score),at:r.submitted_at,link:`/diagnostics/runs/${r.id}`,prompts:r.questions.filter(q=>q.topic_id===t.topic_id).map(q=>q.prompt)});}
 const {rows:games}=await db.query(`SELECT r.id,r.item_id,r.total,r.correct,r.score,r.created_at,i.title,i.game,COALESCE(r.grammar_key,i.grammar_key) AS grammar_key,b.book,b.unit FROM game_results r JOIN library_items i ON i.id=r.item_id JOIN students s ON s.id=r.student_id
 LEFT JOIN LATERAL(SELECT b.book,b.unit FROM bank_takes bt JOIN bank_items b ON b.id=bt.item_id WHERE bt.library_id=i.id AND bt.tutor_id=i.tutor_id LIMIT 1)b ON true
 WHERE r.student_id=$1 AND COALESCE(r.subject,'Английский язык')=$2 AND i.tutor_id=s.tutor_id AND i.kind='game' AND r.total>0 AND r.created_at>NOW()-INTERVAL '180 days' ORDER BY r.created_at DESC,r.id DESC LIMIT 120`,[studentId,subject]);
 for(const r of games){if(r.game?.type==='quick'&&['flip','memory'].includes(r.game.template))continue;const key=grammar.byId.has(r.grammar_key)?r.grammar_key:byUnit.get(`${r.book}:${r.unit}`);if(key&&grammar.byId.get(key)?.subject===subject)out.push({key:`g:${r.id}`,topic_id:key,kind:'exercise',id:r.id,item_id:r.item_id,title:r.title,total:r.total,correct:r.correct,score:r.score,at:r.created_at,link:null,prompts:[]});}
 const {rows:reviews}=await db.query(`SELECT * FROM coaching_reviews WHERE student_id=$1 AND subject=$2 ORDER BY created_at DESC,id DESC LIMIT 200`,[studentId,subject]);
 for(const r of reviews)if(r.mode==='recheck'&&r.submitted_at&&grammar.byId.get(r.topic_key)?.subject===subject)out.push({key:`r:${r.id}`,topic_id:r.topic_key,kind:'recheck',id:r.id,title:'Повторная проверка',total:r.questions.length,correct:Object.values(r.result?.results||{}).filter(Boolean).length,score:r.result?.score,at:r.submitted_at,link:`/coach/reviews/${r.id}`,prompts:r.questions.map(q=>q.prompt)});
 out.sort((a,b)=>new Date(b.at)-new Date(a.at)||b.key.localeCompare(a.key));
 const latest=new Map();for(const e of out)if(!latest.has(e.topic_id))latest.set(e.topic_id,e);
 return {latest,reviews};
}
function sourceForUi(e){if(!e)return null;const {prompts,...rest}=e;return rest;}
async function profile(studentId,db={query},subject='Английский язык'){

 const {latest,reviews}=await evidence(studentId,db,subject),keys=new Set([...latest.keys(),...reviews.filter(r=>!r.submitted_at).map(r=>r.topic_key)]),topics=[];
 for(const key of keys){const t=grammar.byId.get(key);if(!t)continue;const source=latest.get(key),baseline=source?.key||`manual:${key}`;
 const cycle=reviews.filter(r=>r.topic_key===key&&r.baseline_key===baseline),practice=cycle.find(r=>r.mode==='practice'),recheck=cycle.find(r=>r.mode==='recheck');
 let status=!source?'no_data':source.total<3?'insufficient':source.score<60?'repeat':source.score<80?'practice':'confident';
 if(practice?.submitted_at&&recheck&&!recheck.submitted_at)status=new Date(recheck.available_at)>new Date()?'waiting':'due';
 const clean=r=>r?{id:r.id,mode:r.mode,available_at:r.available_at,submitted_at:r.submitted_at,score:r.result?.score??null}:null;
 topics.push({topic_id:key,title:label(t),level:t.level,status,source:sourceForUi(source),practice:clean(practice),recheck:clean(recheck),grammar_link:`/grammar/${key}`,
 reason:source?`${source.correct} из ${source.total} заданий в последней проверке${source.total<3?'; данных для вывода пока мало':''}`:'Тему выбрали для повторения; результата проверки пока нет'});
 }
 const priority={due:0,repeat:1,practice:2,waiting:3,insufficient:4,no_data:5,confident:6};topics.sort((a,b)=>priority[a.status]-priority[b.status]||(a.source?.score??0)-(b.source?.score??0));
 return {student_id:studentId,topics:topics.slice(0,30),strong:topics.filter(t=>t.status==='confident').length,weak:topics.filter(t=>['repeat','practice','due'].includes(t.status)).length,
 note:'Подсказки относятся к последним проверкам. Тренировка не заменяет повторную проверку; задания без указанной темы не используются для вывода о грамматике.'};
}
async function currentBaseline(studentId,topic,db){return (await evidence(studentId,db,grammar.byId.get(topic)?.subject||'Английский язык')).latest.get(topic)?.key||`manual:${topic}`;}
function questionsFor(topic,exclude=[]){const all=grammar.byId.get(topic).questions,unseen=all.filter(q=>!exclude.includes(q.prompt));return d.shuffle(unseen.length>=3?unseen:all).slice(0,3).map((q,i)=>d.shuffledQuestion(q,`q${i+1}`));}
async function start(studentId,topic,actor){
 if(!grammar.byId.has(topic))fail(422,'Выберите тему справочника');
 return transaction(async db=>{
  await db.query('SELECT id FROM students WHERE id=$1 FOR UPDATE',[studentId]);
  const subject=grammar.byId.get(topic).subject||'Английский язык';
  const {latest}=await evidence(studentId,db,subject),base=latest.get(topic),key=base?.key||`manual:${topic}`,qs=questionsFor(topic,base?.prompts||[]);
  const {rows:[made]}=await db.query(`INSERT INTO coaching_reviews(student_id,topic_key,baseline_key,mode,questions,subject) VALUES($1,$2,$3,'practice',$4,$5)
   ON CONFLICT(student_id,topic_key,baseline_key,mode) DO NOTHING RETURNING id`,[studentId,topic,key,JSON.stringify(qs),subject]);
  if(made&&actor.role==='tutor')await db.query(`INSERT INTO notifications(user_id,kind,title,body,link) SELECT user_id,'review_assigned',$2,$3,$4 FROM students WHERE id=$1 AND user_id IS NOT NULL`,[studentId,`Повторение: ${label(grammar.byId.get(topic))}`.slice(0,255),'Объяснение и три задания для повторения',`/coach/reviews/${made.id}`]);
  return made|| (await db.query("SELECT id FROM coaching_reviews WHERE student_id=$1 AND topic_key=$2 AND baseline_key=$3 AND mode='practice'",[studentId,topic,key])).rows[0];
 });
}
async function loadReview(reviewId){return (await query('SELECT * FROM coaching_reviews WHERE id=$1',[reviewId])).rows[0];}
async function viewReview(r,role){
 const topic=grammar.byId.get(r.topic_key),locked=new Date(r.available_at)>new Date(),stale=(!r.submitted_at&&(await currentBaseline(r.student_id,r.topic_key,{query}))!==r.baseline_key);
 return {id:r.id,student_id:r.student_id,topic_id:r.topic_key,title:label(topic),mode:r.mode,available_at:r.available_at,submitted_at:r.submitted_at,locked,stale,
 article:r.mode==='practice'?{when:topic.when,form:topic.form,examples:topic.examples,mistake:topic.mistake}:null,
 questions:r.submitted_at||role==='tutor'?r.questions:role==='student'&&!locked&&!stale?d.publicQuestions(r.questions):[],answers:r.submitted_at?r.answers:{},result:r.result};
}
async function submit(reviewId,studentId,answers){
 return transaction(async db=>{
  await db.query('SELECT id FROM students WHERE id=$1 FOR UPDATE',[studentId]);
  const {rows:[r]}=await db.query('SELECT * FROM coaching_reviews WHERE id=$1 AND student_id=$2 FOR UPDATE',[reviewId,studentId]);if(!r)fail(404,'Повторение не найдено');
  if(r.submitted_at)return {id:r.id,again:true,result:r.result};
  if(new Date(r.available_at)>new Date())fail(409,'Повторная проверка откроется в указанную дату');
  if(await currentBaseline(studentId,r.topic_key,db)!==r.baseline_key)fail(409,'Появилась более новая проверка. Откройте актуальное повторение в помощнике.');
  const result=d.assess(r.questions,answers),clean=Object.fromEntries(r.questions.filter(q=>Object.hasOwn(answers,q.id)).map(q=>[q.id,answers[q.id]]));
  await db.query('UPDATE coaching_reviews SET answers=$2,result=$3,submitted_at=NOW() WHERE id=$1',[r.id,JSON.stringify(clean),JSON.stringify(result)]);
  let next=null;
  if(r.mode==='practice'){
   const qs=questionsFor(r.topic_key,r.questions.map(q=>q.prompt));
   next=(await db.query(`INSERT INTO coaching_reviews(student_id,topic_key,baseline_key,mode,questions,available_at,subject)
    VALUES($1,$2,$3,'recheck',$4,NOW()+INTERVAL '7 days',$5) ON CONFLICT(student_id,topic_key,baseline_key,mode) DO UPDATE SET baseline_key=EXCLUDED.baseline_key RETURNING id,available_at`,[studentId,r.topic_key,r.baseline_key,JSON.stringify(qs),r.subject])).rows[0];
  }
  return {id:r.id,again:false,result,next};
 });
}
module.exports={libraryTopic,profile,evidence,start,loadReview,viewReview,submit,sourceForUi,questionsFor,label};
