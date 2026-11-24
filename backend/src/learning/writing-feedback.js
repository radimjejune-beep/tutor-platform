'use strict';
const {query,transaction}=require('../db');
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const states=['awaiting_feedback','revision_requested','submitted','accepted'];
function validateAnnotation(text,body){
 const {start,end,quote}=body;
 if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<start||end>text.length||text.slice(start,end)!==quote)fail(422,'Выделенный фрагмент не совпадает с этой версией текста. Выделите его заново.');
 const boundary=n=>n>0&&n<text.length&&/[\uD800-\uDBFF]/.test(text[n-1])&&/[\uDC00-\uDFFF]/.test(text[n]);
 if(boundary(start)||boundary(end))fail(422,'Выделите символ целиком.');
}
async function source(body,tid,db){
 if(body.source_kind==='homework'){
  const {rows:[h]}=await db.query(`SELECT h.id,h.student_id,h.student_answer,h.status,h.subject,a.title FROM homework h JOIN assignments a ON a.id=h.assignment_id JOIN students s ON s.id=h.student_id WHERE h.id=$1 AND a.tutor_id=$2 AND s.tutor_id=$2`,[body.source_id,tid]);
  if(!h||!['submitted','checked'].includes(h.status)||!h.student_answer?.trim())fail(404,'Сданный текст не найден');
  return {student_id:h.student_id,homework_id:h.id,subject:h.subject,title:h.title,text:h.student_answer,block:-1};
 }
 const {rows:[r]}=await db.query(`SELECT r.student_id,r.homework_id,r.details,r.subject,i.title FROM game_results r JOIN library_items i ON i.id=r.item_id JOIN students s ON s.id=r.student_id WHERE r.id=$1 AND s.tutor_id=$2 AND i.tutor_id=$2`,[body.source_id,tid]);
 const a=r?.details?.find(d=>d.block===body.source_block&&d.manual&&!d.file_id&&typeof d.given==='string'&&d.given.trim());
 if(!a)fail(404,'Письменный ответ не найден');
 return {student_id:r.student_id,homework_id:r.homework_id,subject:r.subject,title:r.title,text:a.given,block:body.source_block};
}
async function create(tid,body){return transaction(async db=>{
 const s=await source(body,tid,db);
 if(s.text.length>12000)fail(422,'Для правок поддерживается текст до 12 000 знаков');
 const {rows:[t]}=await db.query(`INSERT INTO writing_threads(tutor_id,student_id,homework_id,source_kind,source_id,source_block,title,subject) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(source_kind,source_id,source_block) DO NOTHING RETURNING *`,[tid,s.student_id,s.homework_id,body.source_kind,body.source_id,s.block,s.title,s.subject]);
 if(t){await db.query('INSERT INTO writing_versions(thread_id,number,text,author_id) VALUES($1,1,$2,NULL)',[t.id,s.text]);return t;}
 return (await db.query('SELECT * FROM writing_threads WHERE source_kind=$1 AND source_id=$2 AND source_block=$3 AND tutor_id=$4',[body.source_kind,body.source_id,s.block,tid])).rows[0];
});}
async function load(id){return (await query('SELECT * FROM writing_threads WHERE id=$1',[id])).rows[0];}
async function view(t,role){
 const versions=(await query('SELECT number,text,created_at FROM writing_versions WHERE thread_id=$1 ORDER BY number',[t.id])).rows;
 const annotations=(await query('SELECT id,revision,start_offset AS start,end_offset AS end,quote,body,category,published_at FROM writing_annotations WHERE thread_id=$1 AND ($2 OR published_at IS NOT NULL) ORDER BY revision,id',[t.id,role==='tutor'])).rows;
 return {...t,versions,annotations};
}
async function lock(db,id,version){const {rows:[t]}=await db.query('SELECT * FROM writing_threads WHERE id=$1 FOR UPDATE',[id]);if(!t)fail(404,'Работа не найдена');if(t.version!==version)fail(409,'Работа изменилась в другой вкладке. Ваш текст сохранён в браузере; обновите данные.');return t;}
async function annotate(id,actor,body){return transaction(async db=>{
 const t=await lock(db,id,body.version);if(t.tutor_id!==actor.id)fail(404,'Работа не найдена');if(t.state==='accepted')fail(409,'Эта работа уже принята');
 if(body.revision!==t.current_revision)fail(409,'Комментировать можно текущую версию');
 const {rows:[v]}=await db.query('SELECT text FROM writing_versions WHERE thread_id=$1 AND number=$2',[id,t.current_revision]);validateAnnotation(v.text,body);
 await db.query('INSERT INTO writing_annotations(thread_id,revision,start_offset,end_offset,quote,body,category,author_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,t.current_revision,body.start,body.end,body.quote,body.body,body.category,actor.id]);
 await db.query('UPDATE writing_threads SET version=version+1,updated_at=NOW() WHERE id=$1',[id]);
});}
async function publish(id,actor,version){return transaction(async db=>{
 const t=await lock(db,id,version);if(t.tutor_id!==actor.id)fail(404,'Работа не найдена');if(t.state==='accepted')fail(409,'Работа уже принята');
 const {rows:[c]}=await db.query('SELECT count(*)::int n FROM writing_annotations WHERE thread_id=$1 AND revision=$2',[id,t.current_revision]);if(!c.n)fail(422,'Добавьте комментарий к фрагменту или общий комментарий');
 await db.query('UPDATE writing_annotations SET published_at=COALESCE(published_at,NOW()) WHERE thread_id=$1 AND revision=$2',[id,t.current_revision]);
 await db.query("UPDATE writing_threads SET state='revision_requested',version=version+1,updated_at=NOW() WHERE id=$1",[id]);
});}
async function revise(id,actor,body){return transaction(async db=>{
 const t=await lock(db,id,body.version);if(actor.role!=='student')fail(403,'Исправить текст может ученик');if(t.state!=='revision_requested')fail(409,'Сейчас работа не ожидает исправления');
 const {rows:[prev]}=await db.query('SELECT text FROM writing_versions WHERE thread_id=$1 AND number=$2',[id,t.current_revision]);if(body.text.trim()===prev.text.trim())fail(422,'Внесите правки перед повторной сдачей');
 await db.query('INSERT INTO writing_versions(thread_id,number,text,author_id) VALUES($1,$2,$3,$4)',[id,t.current_revision+1,body.text,actor.id]);
 await db.query("UPDATE writing_threads SET state='submitted',current_revision=current_revision+1,version=version+1,updated_at=NOW() WHERE id=$1",[id]);
});}
async function accept(id,actor,version){return transaction(async db=>{
 const t=await lock(db,id,version);if(t.tutor_id!==actor.id)fail(404,'Работа не найдена');if(t.state==='accepted')return;
 await db.query('UPDATE writing_annotations SET published_at=COALESCE(published_at,NOW()) WHERE thread_id=$1',[id]);
 await db.query("UPDATE writing_threads SET state='accepted',accepted_at=NOW(),version=version+1,updated_at=NOW() WHERE id=$1",[id]);
});}
async function list(studentId,homeworkId,subject){return (await query(`SELECT id,title,state,current_revision,homework_id,updated_at FROM writing_threads WHERE student_id=$1 AND ($2::int IS NULL OR homework_id=$2) AND ($3::varchar IS NULL OR subject=$3) ORDER BY updated_at DESC LIMIT 50`,[studentId,homeworkId||null,subject||null])).rows;}
module.exports={states,validateAnnotation,create,load,view,annotate,publish,revise,accept,list};
