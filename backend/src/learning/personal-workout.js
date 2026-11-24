'use strict';
const {query,transaction}=require('../db'),coach=require('./coaching'),grammar=require('./grammar'),d=require('./diagnostics');
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
async function options(studentId,db={query},subject='Английский язык'){
 const p=await coach.profile(studentId,db,subject);
 const own=await require('./subject-practice').candidates(studentId,db,subject);
 const recent=(await db.query("SELECT result,submitted_at FROM personal_workouts WHERE student_id=$1 AND subject=$2 AND submitted_at>NOW()-INTERVAL '2 days'",[studentId,subject])).rows;
 const rested=new Set(recent.flatMap(r=>(r.result?.topics||[]).filter(t=>t.score>=70).map(t=>t.topic_id)));
 return [...p.topics,...own.filter(t=>!p.topics.some(x=>x.source?.kind==='exercise'&&x.source.id===t.source.id))].filter(t=>t.source&&t.source.total>=3&&['repeat','practice','due'].includes(t.status)&&!rested.has(t.topic_id)).slice(0,3);
}
async function today(studentId,subject='Английский язык'){const {rows:[r]}=await query("SELECT id,submitted_at,result,jsonb_array_length(questions) AS count,topics FROM personal_workouts WHERE student_id=$1 AND subject=$2 AND day=(NOW() AT TIME ZONE 'Europe/Moscow')::date",[studentId,subject]);return r||null;}
async function start(studentId,subject='Английский язык'){return transaction(async db=>{
 await db.query('SELECT id FROM students WHERE id=$1 FOR UPDATE',[studentId]);
 const {rows:[existing]}=await db.query("SELECT id FROM personal_workouts WHERE student_id=$1 AND subject=$2 AND day=(NOW() AT TIME ZONE 'Europe/Moscow')::date",[studentId,subject]);if(existing)return existing;
 const topics=await options(studentId,db,subject);if(!topics.length)fail(422,'По последним проверкам пока нет тем для такой разминки. Пройдите диагностику или упражнение с указанной темой.');
 const per=topics.length===1?6:3;
 const qs=topics.flatMap(t=>d.shuffle(t.questions||grammar.byId.get(t.topic_id).questions).slice(0,per)).map((q,i)=>d.shuffledQuestion(q,`w${i+1}`));
 const snapshot=topics.map(t=>({id:t.topic_id,title:t.title,reason:t.reason,source:t.source}));
 const {rows:[r]}=await db.query("INSERT INTO personal_workouts(student_id,day,topics,questions,subject) VALUES($1,(NOW() AT TIME ZONE 'Europe/Moscow')::date,$2,$3,$4) RETURNING id",[studentId,JSON.stringify(snapshot),JSON.stringify(qs),subject]);return r;
});}
async function load(id){return (await query('SELECT * FROM personal_workouts WHERE id=$1',[id])).rows[0];}
function view(r,role){return {...r,questions:r.submitted_at||role==='tutor'?r.questions:d.publicQuestions(r.questions),answers:r.submitted_at?r.answers:null};}
async function submit(id,answers){return transaction(async db=>{
 const {rows:[r]}=await db.query('SELECT * FROM personal_workouts WHERE id=$1 FOR UPDATE',[id]);if(!r)fail(404,'Разминка не найдена');if(r.submitted_at)return r;
 const result=d.assess(r.questions,answers);for(const t of result.topics)t.title=r.topics.find(x=>x.id===t.topic_id)?.title||t.title;
 const clean=Object.fromEntries(r.questions.filter(q=>Object.hasOwn(answers,q.id)).map(q=>[q.id,answers[q.id]]));
 return (await db.query('UPDATE personal_workouts SET answers=$2,result=$3,submitted_at=NOW() WHERE id=$1 RETURNING *',[id,JSON.stringify(clean),JSON.stringify(result)])).rows[0];
});}
module.exports={options,today,start,load,view,submit};
