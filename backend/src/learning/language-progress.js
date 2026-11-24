'use strict';
const {query,transaction}=require('../db');
const catalog=require('./language-catalog');
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const freshDays=90;
async function context(studentId,tid,db={query},subject){
 const {rows:[s]}=await db.query("SELECT s.id,COALESCE(s.subject,u.subject,'Английский язык') subject FROM students s JOIN users u ON u.id=s.tutor_id WHERE s.id=$1 AND s.tutor_id=$2",[studentId,tid]);
 if(!s)fail(404,'Ученик не найден');
 const active=await require('./study-subjects').resolve(studentId,tid,subject,db);
 return {...s,subject:active,enabled:catalog.isLanguage(active)};
}
function summarize(target,checks,now=new Date()){
 const items=catalog.goals.filter(g=>g.level===target).map(g=>{
  const c=checks.find(c=>c.goal_key===g.key),stale=c?.state==='confirmed'&&(c.reference?.unavailable||now-new Date(c.assessed_at)>freshDays*86400000);
  return {...g,state:c?.state||'unassessed',evidence:c?.evidence||'',assessed_at:c?.assessed_at||null,reference:c?.reference||null,stale:!!stale};
 });
 const confirmed=items.filter(g=>g.state==='confirmed'&&!g.stale).length;
 return {items,total:items.length,confirmed,remaining:items.length-confirmed,percent:Math.round(confirmed/items.length*100),ready:confirmed===items.length,
  skills:Object.entries(catalog.skills).map(([key,title])=>({key,title,total:3,confirmed:items.filter(g=>g.skill===key&&g.state==='confirmed'&&!g.stale).length}))};
}
async function view(studentId,tid,subject){
 const ctx=await context(studentId,tid,{query},subject);if(!ctx.enabled)return {enabled:false};
 const p=(await query('SELECT * FROM language_profiles WHERE student_id=$1 AND subject=$2',[studentId,ctx.subject])).rows[0];
 if(!p)return {enabled:true,subject:ctx.subject,profile:null,levels:catalog.levels};
 const checks=(await query('SELECT * FROM language_checks WHERE profile_id=$1',[p.id])).rows;
 for(const c of checks)if(c.evidence_kind){const ref=await require('./evidence-links').resolve(studentId,tid,{kind:c.evidence_kind,id:c.evidence_id},{query});c.reference=ref&&ref.subject===ctx.subject?ref:{unavailable:true};}
 const history=(await query('SELECT id,event,details,created_at FROM language_history WHERE profile_id=$1 ORDER BY id DESC LIMIT 12',[p.id])).rows;
 const signals=['Английский язык','Французский язык'].includes(ctx.subject)?(await require('./coaching').profile(studentId,{query},ctx.subject)).topics.filter(t=>t.source&&t.source.total>=3).slice(0,3).map(t=>({topic_id:t.topic_id,title:t.title,score:t.source.score,total:t.source.total,correct:t.source.correct,at:t.source.at})):[];
 return {enabled:true,subject:ctx.subject,levels:catalog.levels,profile:p,route:summarize(p.target_level,checks),history,fresh_days:freshDays,signals};
}
async function audit(db,p,actor,event,details){await db.query('INSERT INTO language_history(profile_id,actor_id,event,details) VALUES($1,$2,$3,$4)',[p.id,actor,event,JSON.stringify(details)]);}
async function locked(db,studentId,tid,version,subject){
 await db.query('SELECT id FROM students WHERE id=$1 AND tutor_id=$2 FOR UPDATE',[studentId,tid]);
 const ctx=await context(studentId,tid,db,subject);if(!ctx.enabled)fail(422,'Маршрут CEFR доступен для иностранных языков');
 if(ctx.subject!==subject)fail(409,'Предмет ученика изменился. Обновите страницу перед оценкой.');
 const p=(await db.query('SELECT * FROM language_profiles WHERE student_id=$1 AND subject=$2 FOR UPDATE',[studentId,ctx.subject])).rows[0];
 if((p?.version||0)!==version)fail(409,'Прогресс уже изменился. Обновите страницу и повторите действие.');
 return {ctx,p};
}
async function configure(studentId,tid,body){
 return transaction(async db=>{
  const {ctx,p}=await locked(db,studentId,tid,body.version,body.subject);
  const current=catalog.levels.indexOf(body.current_level),target=catalog.levels.indexOf(body.target_level);
  if(target<=current&&!(body.current_level==='C2'&&body.target_level==='C2'))fail(422,'Целевой уровень должен быть выше текущего');
  const vals=[studentId,ctx.subject,body.current_level,body.target_level,body.basis];
  const {rows:[next]}=await db.query(`INSERT INTO language_profiles(student_id,subject,current_level,target_level,basis,level_confirmed_at)
   VALUES($1,$2,$3::varchar,$4,$5,CASE WHEN $3::varchar IS NULL THEN NULL ELSE NOW() END)
   ON CONFLICT(student_id,subject) DO UPDATE SET current_level=EXCLUDED.current_level,target_level=EXCLUDED.target_level,basis=EXCLUDED.basis,
   level_confirmed_at=CASE WHEN language_profiles.current_level IS NOT DISTINCT FROM EXCLUDED.current_level THEN language_profiles.level_confirmed_at ELSE EXCLUDED.level_confirmed_at END,
   version=language_profiles.version+1,updated_at=NOW() RETURNING *`,vals);
  await audit(db,next,tid,'configure',{current_level:next.current_level,target_level:next.target_level,basis:next.basis,previous_level:p?.current_level||null});
  return next.id;
 });
}
async function assess(studentId,tid,key,body){
 return transaction(async db=>{
  const {p}=await locked(db,studentId,tid,body.version,body.subject);if(!p)fail(409,'Сначала настройте маршрут');
  const g=catalog.byKey.get(key);if(!g||g.level!==p.target_level)fail(422,'Цель не относится к выбранному уровню');
  if(body.state==='confirmed'&&!body.evidence.trim())fail(422,'Укажите, на какой работе или наблюдении основана оценка');
  const reference=body.evidence_ref?await require('./evidence-links').resolve(studentId,tid,body.evidence_ref,db):null;
  if(body.evidence_ref&&(!reference||reference.subject!==p.subject))fail(422,'Работа не принадлежит этому ученику или ещё не проверена');
  await db.query(`INSERT INTO language_checks(profile_id,goal_key,state,evidence,assessed_by,evidence_kind,evidence_id) VALUES($1,$2,$3,$4,$5,$6,$7)
   ON CONFLICT(profile_id,goal_key) DO UPDATE SET state=EXCLUDED.state,evidence=EXCLUDED.evidence,assessed_by=EXCLUDED.assessed_by,assessed_at=NOW(),evidence_kind=EXCLUDED.evidence_kind,evidence_id=EXCLUDED.evidence_id`,[p.id,key,body.state,body.evidence,tid,reference?.kind||null,reference?.id||null]);
  await db.query('UPDATE language_profiles SET version=version+1,updated_at=NOW() WHERE id=$1',[p.id]);
  await audit(db,p,tid,'assessment',{goal_key:key,title:g.title,state:body.state,evidence:body.evidence,reference});
 });
}
async function confirm(studentId,tid,body){
 return transaction(async db=>{
  const {p}=await locked(db,studentId,tid,body.version,body.subject);if(!p)fail(409,'Сначала настройте маршрут');
  if(p.current_level===p.target_level)fail(409,'Этот уровень уже подтверждён');
  const checks=(await db.query('SELECT * FROM language_checks WHERE profile_id=$1',[p.id])).rows;
  for(const c of checks)if(c.evidence_kind){const ref=await require('./evidence-links').resolve(studentId,tid,{kind:c.evidence_kind,id:c.evidence_id},db);if(!ref||ref.subject!==p.subject)c.reference={unavailable:true};}
  if(!summarize(p.target_level,checks).ready)fail(409,'Для итогового подтверждения оцените все цели; устаревшие наблюдения нужно перепроверить');
  const next=catalog.levels[Math.min(catalog.levels.indexOf(p.target_level)+1,catalog.levels.length-1)];
  await db.query('UPDATE language_profiles SET current_level=target_level,target_level=$2,basis=$3,level_confirmed_at=NOW(),version=version+1,updated_at=NOW() WHERE id=$1',[p.id,next,body.basis]);
  await audit(db,p,tid,'level_confirmed',{current_level:p.target_level,target_level:next,basis:body.basis});
 });
}
module.exports={view,configure,assess,confirm,summarize,context};
