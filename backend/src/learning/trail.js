'use strict';
const {query,transaction}=require('../db');
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
function trailPosition(steps){const n=Math.max(0,Math.floor(Number(steps)||0));return {steps:n,peak:Math.max(1,Math.ceil(n/20)),on_peak:n>0&&n%20===0,step:n?((n-1)%20)+1:0,completed_peaks:Math.floor(n/20)};}
async function overdue(studentId,subject,start,db={query}){return (await db.query(`SELECT h.id,a.id AS assignment_id,a.title,a.due_on FROM homework h JOIN assignments a ON a.id=h.assignment_id
 WHERE h.student_id=$1 AND h.subject=$3 AND h.status='assigned' AND NOT h.trail_exempt AND a.archived_at IS NULL AND h.created_at>=$2 AND a.due_on<(NOW() AT TIME ZONE 'Europe/Moscow')::date ORDER BY a.due_on,h.id LIMIT 50`,[studentId,start,subject])).rows;}
async function view(studentId,subject){
 const {rows:[p]}=await query('SELECT * FROM student_trails WHERE student_id=$1 AND subject=$2',[studentId,subject]);if(!p)return {active:false,subject};
 const totals=(await query('SELECT COALESCE(sum(steps) FILTER(WHERE credited_at IS NOT NULL),0)::int AS steps,COALESCE(sum(steps) FILTER(WHERE credited_at IS NULL),0)::int AS pending FROM trail_events WHERE student_id=$1 AND subject=$2',[studentId,subject])).rows[0];
 const tasks=await overdue(studentId,subject,p.started_at);
 const events=(await query('SELECT id,kind,title,source_id,steps,actor_id,earned_at,credited_at FROM trail_events WHERE student_id=$1 AND subject=$2 ORDER BY id DESC LIMIT 8',[studentId,subject])).rows;
 return {active:true,...p,...trailPosition(totals.steps),pending:totals.pending,blocked:p.paused||(p.gate_overdue&&tasks.length>0),overdue:tasks,events};
}
async function candidates(studentId,subject,start,db){
 return (await db.query(`SELECT 'homework:'||h.id source_key,'homework' kind,a.title,h.id source_id,h.reviewed_at earned_at FROM homework h JOIN assignments a ON a.id=h.assignment_id WHERE h.student_id=$1 AND h.subject=$3 AND h.status='checked' AND (h.score IS NULL OR h.score>=70) AND h.reviewed_at>=$2
 UNION ALL SELECT 'writing:'||id,'writing',title,id,accepted_at FROM writing_threads WHERE student_id=$1 AND subject=$3 AND accepted_at>=$2 AND state='accepted'
 UNION ALL SELECT 'workout:'||id,'workout','Персональная разминка',id,submitted_at FROM personal_workouts WHERE student_id=$1 AND subject=$3 AND submitted_at>=$2 AND (result->>'score')::numeric>=70
 UNION ALL SELECT 'topic:'||id,'topic',title,id,evidence_at FROM progress_topics WHERE student_id=$1 AND subject=$3 AND status='done' AND evidence_kind IS NOT NULL AND evidence_at>=$2 AND (
 (evidence_kind='homework' AND EXISTS(SELECT 1 FROM homework h WHERE h.id=progress_topics.evidence_id AND h.student_id=$1 AND h.subject=$3 AND h.status='checked')) OR
 (evidence_kind='writing' AND EXISTS(SELECT 1 FROM writing_threads w WHERE w.id=progress_topics.evidence_id AND w.student_id=$1 AND w.subject=$3 AND w.state='accepted')) OR
 (evidence_kind='diagnostic' AND EXISTS(SELECT 1 FROM diagnostic_runs d WHERE d.id=progress_topics.evidence_id AND d.student_id=$1 AND d.subject=$3 AND d.submitted_at IS NOT NULL)) OR
 (evidence_kind='workout' AND EXISTS(SELECT 1 FROM personal_workouts w WHERE w.id=progress_topics.evidence_id AND w.student_id=$1 AND w.subject=$3 AND w.submitted_at IS NOT NULL)))
 UNION ALL SELECT 'skill:'||p.id||':'||c.goal_key,'skill',c.goal_key,p.id,c.assessed_at FROM language_checks c JOIN language_profiles p ON p.id=c.profile_id WHERE p.student_id=$1 AND p.subject=$3 AND c.state='confirmed' AND c.assessed_at>=$2
 ORDER BY earned_at,source_key`,[studentId,start,subject])).rows;
}
async function sync(studentId,subject,start=false){
 await transaction(async db=>{
  await db.query('SELECT id FROM students WHERE id=$1 FOR UPDATE',[studentId]);
  if(start)await db.query('INSERT INTO student_trails(student_id,subject,auto_from) VALUES($1,$2,NOW()) ON CONFLICT DO NOTHING',[studentId,subject]);
  const {rows:[p]}=await db.query('SELECT * FROM student_trails WHERE student_id=$1 AND subject=$2 FOR UPDATE',[studentId,subject]);if(!p)return;
  const automatic=p.mode!=='manual',from=p.auto_from||p.started_at;
  const earned=automatic?await candidates(studentId,subject,from,db):[],keys=earned.map(e=>e.source_key);
  if(automatic)await db.query("DELETE FROM trail_events WHERE student_id=$1 AND subject=$3 AND kind<>'manual' AND earned_at>=$4 AND credited_at IS NULL AND NOT(source_key=ANY($2::varchar[]))",[studentId,keys,subject,from]);
  for(const e of earned)await db.query('INSERT INTO trail_events(student_id,source_key,kind,title,source_id,earned_at,subject) SELECT $1::int,$2::varchar,$3::varchar,$4::varchar,$5::int,$6::timestamptz,$7::varchar WHERE NOT EXISTS(SELECT 1 FROM trail_events WHERE student_id=$1 AND source_key=$2::varchar AND subject<>$7::varchar AND credited_at IS NOT NULL) ON CONFLICT(student_id,subject,source_key) DO NOTHING',[studentId,e.source_key,e.kind,String(e.kind==='skill'?(require('./language-catalog').byKey.get(e.title)?.title||e.title):e.title).slice(0,255),e.source_id,e.earned_at,subject]);
  const tasks=p.gate_overdue?await overdue(studentId,subject,p.started_at,db):[];
  if(!p.paused&&!tasks.length)await db.query("UPDATE trail_events SET credited_at=NOW() WHERE student_id=$1 AND subject=$2 AND credited_at IS NULL AND (kind='manual' OR $3)",[studentId,subject,automatic]);
 });return view(studentId,subject);
}
async function configure(studentId,subject,body){await transaction(async db=>{
 await db.query('SELECT id FROM students WHERE id=$1 FOR UPDATE',[studentId]);
 const {rows:[p]}=await db.query('SELECT * FROM student_trails WHERE student_id=$1 AND subject=$2 FOR UPDATE',[studentId,subject]);if(!p)fail(409,'Сначала начните маршрут');if(p.version!==body.version)fail(409,'Настройки изменились. Обновите маршрут.');
 const mode=body.mode||p.mode,obstacle=body.obstacle||p.obstacle;
 await db.query("UPDATE student_trails SET paused=$2,gate_overdue=$3,mode=$5::varchar,obstacle=$6::varchar,auto_from=CASE WHEN mode='manual' AND $5::varchar<>'manual' THEN NOW() ELSE auto_from END,version=version+1 WHERE student_id=$1 AND subject=$4",[studentId,body.paused,body.gate_overdue,subject,mode,obstacle]);
});return sync(studentId,subject);}
async function refresh(studentId,subject){if(!subject)return;try{await sync(studentId,subject);}catch(e){console.error('Маршрут: обновление отложено до следующего открытия:',e.message);}}
async function grant(studentId,subject,actor,body){
 await transaction(async db=>{
  await db.query('SELECT id FROM students WHERE id=$1 AND tutor_id=$2 FOR UPDATE',[studentId,actor.id]);
  const {rows:[p]}=await db.query('SELECT * FROM student_trails WHERE student_id=$1 AND subject=$2 FOR UPDATE',[studentId,subject]);if(!p)fail(409,'Сначала начните маршрут');
  const key='manual:'+body.request_key,title='Шаги преподавателя: '+body.reason;
  const {rows:[old]}=await db.query('SELECT steps,title FROM trail_events WHERE student_id=$1 AND subject=$2 AND source_key=$3',[studentId,subject,key]);
  if(old){if(old.steps!==body.steps||old.title!==title)fail(409,'Это начисление уже сохранено с другим содержанием');return;}
  if(p.version!==body.version)fail(409,'Маршрут изменился. Обновите его перед начислением');
  if(p.mode==='auto')fail(409,'Для ручного начисления выберите ручной или смешанный режим');
  await db.query("INSERT INTO trail_events(student_id,subject,source_key,kind,title,source_id,earned_at,credited_at,steps,actor_id) VALUES($1,$2,$3,'manual',$4,$5,NOW(),CASE WHEN $6 THEN NOW() ELSE NULL END,$7,$5)",[studentId,subject,key,title,actor.id,body.bypass_gate,body.steps]);
  await db.query('UPDATE student_trails SET version=version+1 WHERE student_id=$1 AND subject=$2',[studentId,subject]);
 });return sync(studentId,subject);
}
module.exports={grant,refresh,trailPosition,overdue,view,sync,configure};
