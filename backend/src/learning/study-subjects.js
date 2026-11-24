'use strict';
const {query}=require('../db');
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
async function list(studentId,tid,db={query}){
 const {rows:[s]}=await db.query("SELECT s.id,COALESCE(NULLIF(s.subject,''),NULLIF(u.subject,''),'Английский язык') subject FROM students s JOIN users u ON u.id=s.tutor_id WHERE s.id=$1 AND s.tutor_id=$2",[studentId,tid]);
 if(!s)fail(404,'Ученик не найден');
 const {rows}=await db.query('SELECT subject,course_id,course_unit_id FROM student_subjects WHERE student_id=$1 ORDER BY created_at,subject',[studentId]);
 return {directions:rows,primary:s.subject,subjects:[...new Set([s.subject,...rows.map(r=>r.subject)])]};
}
async function resolve(studentId,tid,subject,db={query}){
 const d=await list(studentId,tid,db);if(!subject)return d.primary;
 const found=d.subjects.find(s=>s.toLocaleLowerCase('ru')===String(subject).trim().toLocaleLowerCase('ru'));
 if(!found)fail(422,'Направление ещё не добавлено этому ученику');return found;
}
async function add(studentId,tid,subject){const existing=await list(studentId,tid);await query('INSERT INTO student_subjects(student_id,subject) VALUES($1,$2),($1,$3) ON CONFLICT DO NOTHING',[studentId,existing.primary,subject]);return list(studentId,tid);}
module.exports={list,resolve,add};
