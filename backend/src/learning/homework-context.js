'use strict';
const {transaction}=require('../db'),subjects=require('./study-subjects'),{HOMEWORK_SECTION}=require('./homework-sections');
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
async function update(tid,id,body){return transaction(async db=>{
 const {rows:[h]}=await db.query(`SELECT h.*,(${HOMEWORK_SECTION}) AS effective_section FROM homework h JOIN assignments a ON a.id=h.assignment_id JOIN students s ON s.id=h.student_id WHERE h.id=$1 AND s.tutor_id=$2 AND a.tutor_id=$2 FOR UPDATE OF h`,[id,tid]);if(!h)fail(404,'Работа не найдена');
 const subject=await subjects.resolve(h.student_id,tid,body.subject,db),lessonId=body.lesson_id===undefined?h.lesson_id:body.lesson_id;
 if(lessonId){const {rows:[l]}=await db.query('SELECT l.student_id,l.subject FROM lessons l JOIN students s ON s.id=l.student_id WHERE l.id=$1 AND s.tutor_id=$2 FOR KEY SHARE OF l',[lessonId,tid]);if(!l||l.student_id!==h.student_id||l.subject!==subject)fail(422,'Выберите занятие этого ученика по тому же предмету или оставьте задание без привязки к уроку');}
 const {rows:[next]}=await db.query('UPDATE homework SET subject=$2,lesson_id=$3 WHERE id=$1 RETURNING id,student_id,subject,lesson_id',[id,subject,lessonId||null]);
 await db.query('UPDATE game_results SET subject=$2,lesson_id=$3 WHERE homework_id=$1',[id,subject,lessonId||null]);
 if(subject!==h.subject){
  await db.query('UPDATE writing_threads SET subject=$2 WHERE homework_id=$1',[id,subject]);
  await db.query('UPDATE homework SET section_overridden=TRUE,section_id=NULL WHERE id=$1',[id]);
 }
 return {...next,previous_subject:h.subject};
});}
module.exports={update};
