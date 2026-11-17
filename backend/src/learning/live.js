'use strict';
const {query,transaction}=require('../db'),{canAccessStudent}=require('../middleware/auth'),{grade}=require('../services/games'),coaching=require('./coaching');
const {addWords,wordsFromMistakes}=require('../services/vocab');
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
async function scope(user,lessonId,db={query}){
 const {rows:[l]}=await db.query(`SELECT l.*,s.tutor_id,s.full_name AS student_name FROM lessons l JOIN students s ON s.id=l.student_id WHERE l.id=$1`,[lessonId]);
 if(!l||l.tutor_id!==user.tid||!await canAccessStudent(user,l.student_id))fail(404,'Занятие не найдено');
 const {rows:members}=await db.query(`SELECT x.id AS lesson_id,x.student_id,s.full_name AS name,s.user_id FROM lessons x JOIN students s ON s.id=x.student_id
 WHERE s.tutor_id=$2 AND (x.id=$1 OR($3::int IS NOT NULL AND x.group_id=$3 AND x.starts_at=$4)) ORDER BY x.id`,[l.id,user.tid,l.group_id,l.starts_at]);
 return {lesson:l,members,anchor:members[0].lesson_id};
}
function checkedGrade(game,answers){try{return grade(game,answers);}catch{fail(422,'Некорректный формат ответа для этого упражнения');}}
function boundedAnswers(a){
 let count=0;function check(v,depth){if(++count>6000||depth>7)return false;if(v===null||typeof v==='boolean')return true;if(typeof v==='number')return Number.isFinite(v);if(typeof v==='string')return v.length<=8000;if(typeof v!=='object')return false;const keys=Object.keys(v);return keys.length<=1000&&keys.every(k=>!['__proto__','constructor','prototype'].includes(k)&&k.length<=100&&check(v[k],depth+1));}
 return a&&typeof a==='object'&&!Array.isArray(a)&&check(a,0)&&JSON.stringify(a).length<=48000;
}
async function start(user,lessonId,itemId,requestKey){
 return transaction(async db=>{
  const sc=await scope(user,lessonId,db);
  if(sc.members.length>30)fail(422,'Для совместного упражнения выберите группу не больше 30 учеников');
  if(sc.lesson.status!=='scheduled')fail(409,'Совместное упражнение можно начать в запланированном занятии');
  await db.query('SELECT pg_advisory_xact_lock(727003,$1)',[sc.anchor]);
  const old=(await db.query('SELECT id FROM live_sessions WHERE lesson_id=$1 AND request_key=$2',[sc.anchor,requestKey])).rows[0];if(old)return old;
  const {rows:[item]}=await db.query(`SELECT i.* FROM library_items i WHERE i.id=$1 AND i.tutor_id=$2 AND i.kind='game'
   AND NOT EXISTS(SELECT 1 FROM unnest($3::int[]) AS lids(id) WHERE NOT EXISTS(SELECT 1 FROM lesson_items li WHERE li.lesson_id=lids.id AND li.item_id=i.id)) FOR SHARE`,[itemId,user.id,sc.members.map(m=>m.lesson_id)]);
  if(!item?.game)fail(404,'Добавьте интерактивное упражнение в материалы этого занятия');
  if(item.game.type==='sheet'&&item.game.blocks?.some(b=>b.t==='voice'))fail(422,'Лист с записью голоса пока доступен в обычном режиме. Для совместного решения выберите текстовое упражнение.');
  const parsed=require('../services/games').gameSchema.safeParse(item.game);if(!parsed.success)fail(422,'Обновите формат упражнения в редакторе перед совместным решением');
  const key=await coaching.libraryTopic(item.id,db);
  await db.query("UPDATE live_sessions SET status='ended',ended_at=NOW() WHERE lesson_id=$1 AND status='active'",[sc.anchor]);
  const {rows:[s]}=await db.query('INSERT INTO live_sessions(lesson_id,item_id,request_key,title,body,game,grammar_key) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',[sc.anchor,item.id,requestKey,item.title,item.body,JSON.stringify(item.game),key]);return s;
 });
}
async function end(user,lessonId,sessionId){return transaction(async db=>{const sc=await scope(user,lessonId,db);await db.query('SELECT pg_advisory_xact_lock(727003,$1)',[sc.anchor]);const r=await db.query("UPDATE live_sessions SET status='ended',ended_at=NOW() WHERE id=$1 AND lesson_id=$2 AND status='active' RETURNING id",[sessionId,sc.anchor]);return {ok:true,ended:Boolean(r.rowCount)};});}
async function state(user,lessonId){
 const sc=await scope(user,lessonId),{rows:[s]}=await query('SELECT * FROM live_sessions WHERE lesson_id=$1 ORDER BY id DESC LIMIT 1',[sc.anchor]);
 if(!s)return {lesson_id:lessonId,session:null,responses:[],members:user.role==='tutor'?sc.members:[]};
 const visible=user.role==='tutor'?sc.members:sc.members.filter(m=>m.lesson_id===sc.lesson.id),ids=visible.map(m=>m.student_id);
 const {rows}=await query('SELECT student_id,answers,revision,client_id,updated_at,seen_at,submitted_at,result,result_id FROM live_answers WHERE session_id=$1 AND student_id=ANY($2::int[])',[s.id,ids]);
 const responses=visible.map(m=>{const a=rows.find(a=>a.student_id===m.student_id)||{student_id:m.student_id,answers:{},revision:0,client_id:null,submitted_at:null,result:null};return {...a,name:m.name,lesson_id:m.lesson_id,...(user.role==='tutor'?{draft_details:checkedGrade(s.game,a.answers).details.map((d,n)=>({...d,prompt:d.prompt||(s.game.type==='sheet'?s.game.blocks[d.block]?.text?.replace(/\[[^\]]*\]/g,'___'):s.game.type==='gaps'?s.game.text.replace(/\[[^\]]*\]/g,'___'):s.game.type==='order'?`Предложение ${n+1}`:null)}))}:{} )};});
 return {lesson_id:lessonId,session:{id:s.id,item_id:s.item_id,title:s.title,body:s.body,game:s.game,status:sc.lesson.status==='scheduled'?s.status:'ended',created_at:s.created_at,grammar_key:s.grammar_key},responses,
 members:user.role==='tutor'?sc.members:[],own_student_id:sc.lesson.student_id};
}
async function touch(user,lessonId){if(user.role!=='student')return;const sc=await scope(user,lessonId);await query(`INSERT INTO live_answers(session_id,student_id) SELECT id,$2 FROM live_sessions WHERE lesson_id=$1 AND status='active'
 ON CONFLICT(session_id,student_id) DO UPDATE SET seen_at=NOW() WHERE live_answers.seen_at<NOW()-INTERVAL '15 seconds'`,[sc.anchor,sc.lesson.student_id]);}
async function save(user,lessonId,sessionId,{answers,expected_revision,client_id,duration_sec},submit=false){
 if(!boundedAnswers(answers))fail(422,'Ответ слишком большой или имеет неверный формат');
 return transaction(async db=>{
  const sc=await scope(user,lessonId,db);
  // Общая блокировка с завершением/сменой упражнения; после остановки старый ответ не допишется.
  await db.query('SELECT pg_advisory_xact_lock(727003,$1)',[sc.anchor]);
  const {rows:[s]}=await db.query('SELECT * FROM live_sessions WHERE id=$1 AND lesson_id=$2 FOR SHARE',[sessionId,sc.anchor]);if(!s)fail(404,'Упражнение не найдено');
  await db.query('INSERT INTO live_answers(session_id,student_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[s.id,sc.lesson.student_id]);
  const {rows:[a]}=await db.query('SELECT * FROM live_answers WHERE session_id=$1 AND student_id=$2 FOR UPDATE',[s.id,sc.lesson.student_id]);
  if(a.submitted_at){if(submit)return {response:a,result:a.result,again:true};fail(409,'Ответ уже сдан');}
  if(s.status!=='active'||sc.lesson.status!=='scheduled')fail(409,'Преподаватель завершил упражнение');
  if(a.revision!==expected_revision)throw Object.assign(Error('Ответ изменён в другой вкладке. Загрузите сохранённую версию.'),{status:409,current:a});
  const result=checkedGrade(s.game,answers);let resultId=null;
  const voiceIds=[...new Set((result.details||[]).map(d=>d.file_id).filter(Boolean))];
  if(voiceIds.length){const {rows:[f]}=await db.query("SELECT COUNT(*)::int AS n FROM files WHERE id=ANY($1::int[]) AND uploaded_by=$2 AND mime LIKE 'audio/%'",[voiceIds,user.id]);if(f.n!==voiceIds.length)fail(422,'Аудиофайл не относится к этому ответу');}
  if(submit){
   if(!result.total&&!result.manual)fail(422,'В упражнении нет заданий для проверки');
   const {rows:[item]}=await db.query('SELECT id FROM library_items WHERE id=$1 AND tutor_id=$2 FOR SHARE',[s.item_id,user.tid]);if(!item)fail(409,'Материал удалён преподавателем');
   resultId=(await db.query(`INSERT INTO game_results(item_id,student_id,user_id,lesson_id,correct,total,score,details,duration_sec,grammar_key)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,[s.item_id,sc.lesson.student_id,user.id,sc.lesson.id,result.correct,result.total,result.score,JSON.stringify(result.details),duration_sec||0,s.grammar_key])).rows[0].id;
   await addWords(db,sc.lesson.student_id,wordsFromMistakes(s.game,result.details),'mistake');
   if(result.correct>0)await db.query(`INSERT INTO student_activity(student_id,day,points) VALUES($1,CURRENT_DATE,$2) ON CONFLICT(student_id,day) DO UPDATE SET points=student_activity.points+EXCLUDED.points`,[sc.lesson.student_id,result.correct]);
  }
  const {rows:[saved]}=await db.query(`UPDATE live_answers SET answers=$3,revision=revision+1,client_id=$4,updated_at=NOW(),seen_at=NOW(),submitted_at=CASE WHEN $5 THEN NOW() ELSE NULL END,result=$6,result_id=$7
   WHERE session_id=$1 AND student_id=$2 RETURNING *`,[s.id,sc.lesson.student_id,JSON.stringify(answers),client_id,submit,submit?JSON.stringify(result):null,resultId]);
  return {response:saved,...(submit?{result,again:false}:{})};
 });
}
module.exports={scope,start,end,state,touch,save,boundedAnswers};
