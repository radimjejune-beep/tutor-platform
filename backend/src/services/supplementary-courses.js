'use strict';
const {query,transaction}=require('../db'),content=require('../bank/elementary-vocabulary');
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const stages={learn:'1. Узнать и вспомнить',practice:'2. Контекст и слух',check:'3. Проверить и применить',all:'Все этапы'};
async function template(tid,subject){
 if(subject!=='Английский язык')return [];
 const installed=(await query('SELECT course_id FROM course_template_installs WHERE tutor_id=$1 AND template_key=$2',[tid,content.id])).rows[0];
 return [{id:content.id,title:content.title,units:content.units.length,words:content.units.reduce((n,u)=>n+u.words.length,0),materials:content.bank.length,installed_course_id:installed?.course_id||null,
  description:'60 тем, 600 словарных позиций (592 разных слова и выражения; часть повторяется для закрепления). По 10 материалов на тему и 12 смешанных проверок. Авторский дополнительный курс к темам English Vocabulary in Use Elementary, 3rd edition. Не копия и не полная замена учебника.'}];
}
async function install(tid,subject){
 if(subject!=='Английский язык')fail(422,'Этот курс предназначен для английского языка');
 const plans=require('./plans'),max=(await plans.planOf(tid)).limits.bank_takes;
 return transaction(async db=>{
  await db.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[tid]);
  const old=(await db.query('SELECT course_id FROM course_template_installs WHERE tutor_id=$1 AND template_key=$2',[tid,content.id])).rows[0];if(old)return {course_id:old.course_id,again:true};
  const expected=content.bank.map(x=>x.key),rows=(await db.query(`SELECT b.*,t.library_id,i.id AS own_id FROM bank_items b
   LEFT JOIN bank_takes t ON t.item_id=b.id AND t.tutor_id=$2 LEFT JOIN library_items i ON i.id=t.library_id AND i.tutor_id=$2
   WHERE b.seed_key=ANY($1::text[]) AND NOT b.hidden ORDER BY b.id`,[expected,tid])).rows;
  if(rows.length!==expected.length)fail(409,'Часть курса пока недоступна в банке. Дождитесь обновления банка или обратитесь в поддержку.');
  const needed=rows.filter(r=>!r.own_id).length;
  if(max!==null&&needed>0){const n=(await db.query("SELECT COUNT(*)::int n FROM bank_takes WHERE tutor_id=$1 AND taken_at>=date_trunc('month',NOW())",[tid])).rows[0].n;if(n+needed>max)fail(403,`Курс добавляет ${needed} материалов из банка. На тарифе доступно ${max} в месяц. Можно брать отдельные упражнения из банка или подключить тариф без этого ограничения.`);}
  const course=(await db.query('INSERT INTO courses(tutor_id,title,subject,level,description) VALUES($1,$2,$3,$4,$5) RETURNING id',[tid,content.title,'Английский язык','A1–A2','Авторская дополнительная практика Lessonfold: 60 тем, 600 слов и выражений, три этапа на тему. Совместимо по темам с English Vocabulary in Use Elementary, 3rd edition; не материалы Cambridge. Отдельное подключение к ученику не меняет его основной учебник.'])).rows[0];
  const root=(await db.query('INSERT INTO library_folders(tutor_id,title,book) VALUES($1,$2,$3) RETURNING id',[tid,content.title,content.id])).rows[0].id,folders=new Map(),ids=new Map();
  for(const u of content.units)folders.set(u.code,(await db.query('INSERT INTO library_folders(tutor_id,parent_id,title,book,unit) VALUES($1,$2,$3,$4,$5) RETURNING id',[tid,root,`${u.code}. ${u.title}`,content.id,u.code])).rows[0].id);
  for(const r of rows){
   let id=r.own_id;
   if(!id){
    id=(await db.query('INSERT INTO library_items(tutor_id,subject,kind,title,body,game,tags,folder_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',[tid,'Английский язык',r.kind,r.title,r.body,r.game?JSON.stringify(r.game):null,['Словарная практика A1–A2',`Тема ${r.unit}`,'банк'],folders.get(r.unit)])).rows[0].id;
    await db.query('INSERT INTO bank_takes(item_id,tutor_id,library_id) VALUES($1,$2,$3) ON CONFLICT(item_id,tutor_id) DO UPDATE SET library_id=EXCLUDED.library_id,taken_at=NOW()',[r.id,tid,id]);
    await db.query('UPDATE bank_items SET uses=uses+1 WHERE id=$1',[r.id]);
   }
   ids.set(r.seed_key,id);
  }
  for(const u of content.units){
   const packs=Object.fromEntries(Object.entries(content.packs.get(u.code)).map(([k,keys])=>[k,keys.map(k=>ids.get(k))]));
   await db.query(`INSERT INTO course_units(course_id,position,code,title,goals,item_ids,homework_item_ids,vocab,practice_packs) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[course.id,Number(u.code),u.code,u.title,'Узнать слова → использовать в контексте → вспомнить без подсказок и применить в собственной речи. Три этапа можно выдавать в разные дни. Собственные ответы проверяет преподаватель.',packs.all,packs.all,JSON.stringify(u.words.map(({term,translation,example})=>({term,translation,example}))),JSON.stringify(packs)]);
  }
  await db.query('INSERT INTO course_template_installs(tutor_id,template_key,course_id) VALUES($1,$2,$3)',[tid,content.id,course.id]);
  return {course_id:course.id,again:false};
 });
}
async function list(studentId,tid,isTutor,subject=null){
 const own=(await query('SELECT 1 FROM students WHERE id=$1 AND tutor_id=$2',[studentId,tid])).rowCount;if(!own)fail(404,'Ученик не найден');
 const enrollments=(await query(`SELECT e.id,e.active,c.id course_id,c.title,c.level,c.subject FROM supplementary_enrollments e JOIN courses c ON c.id=e.course_id WHERE e.student_id=$1 AND c.tutor_id=$2 AND ($3 OR e.active) AND ($4::text IS NULL OR c.subject=$4) ORDER BY e.id`,[studentId,tid,isTutor,subject])).rows;
 for(const e of enrollments){
  const units=(await query('SELECT id,code,title,vocab,practice_packs,cardinality(homework_item_ids) material_count FROM course_units WHERE course_id=$1 ORDER BY position,id',[e.course_id])).rows;
  const assigned=(await query(`SELECT a.unit_id,a.stage,h.id homework_id,a.assignment_id,h.status,h.score,CASE WHEN $4 OR h.status='checked' THEN h.quiz_score ELSE NULL END quiz_score,a.created_at FROM supplementary_assignments a JOIN assignments x ON x.id=a.assignment_id JOIN homework h ON h.assignment_id=x.id AND h.student_id=$2 WHERE a.enrollment_id=$1 AND x.tutor_id=$3 ORDER BY a.id DESC`,[e.id,studentId,tid,isTutor])).rows;
  e.totals={given:assigned.length,submitted:assigned.filter(a=>['submitted','checked'].includes(a.status)).length};
  e.units=units.map(u=>({id:u.id,code:u.code,title:u.title,words:u.vocab.length,materials:u.material_count,stages:u.practice_packs?Object.keys(stages):['all'],stage_counts:u.practice_packs?Object.fromEntries(Object.entries(u.practice_packs).map(([k,ids])=>[k,ids.length])):{all:u.material_count},assignments:assigned.filter(a=>a.unit_id===u.id).slice(0,12)}));
 }
 return {enrollments,stages};
}
async function enroll(studentId,tid,courseId,active){
 return transaction(async db=>{
  if(!(await db.query('SELECT 1 FROM students WHERE id=$1 AND tutor_id=$2 FOR UPDATE',[studentId,tid])).rowCount)fail(404,'Ученик не найден');
  const {rows:[course]}=await db.query('SELECT subject FROM courses WHERE id=$1 AND tutor_id=$2',[courseId,tid]);if(!course)fail(404,'Курс не найден');
  if(active){const dirs=await require('../learning/study-subjects').list(studentId,tid,db);await db.query('INSERT INTO student_subjects(student_id,subject) VALUES($1,$2),($1,$3) ON CONFLICT DO NOTHING',[studentId,dirs.primary,course.subject]);}
  return (await db.query('INSERT INTO supplementary_enrollments(student_id,course_id,active) VALUES($1,$2,$3) ON CONFLICT(student_id,course_id) DO UPDATE SET active=EXCLUDED.active RETURNING id',[studentId,courseId,active])).rows[0];
 });
}
async function assign(studentId,tid,body){
 return transaction(async db=>{
  if(!(await db.query('SELECT 1 FROM students WHERE id=$1 AND tutor_id=$2 FOR UPDATE',[studentId,tid])).rowCount)fail(404,'Ученик не найден');
  const {rows:[e]}=await db.query('SELECT e.*,c.subject FROM supplementary_enrollments e JOIN courses c ON c.id=e.course_id WHERE e.student_id=$1 AND e.course_id=$2 AND c.tutor_id=$3 FOR UPDATE OF e',[studentId,body.course_id,tid]);
  if(!e||!e.active)fail(409,'Сначала подключите дополнительный курс ученику');
  const old=(await db.query(`SELECT a.assignment_id,h.id homework_id,a.unit_id,a.stage,x.due_on FROM supplementary_assignments a JOIN assignments x ON x.id=a.assignment_id JOIN homework h ON h.assignment_id=a.assignment_id AND h.student_id=$3 WHERE a.enrollment_id=$1 AND a.request_key=$2`,[e.id,body.request_key,studentId])).rows[0];
  if(old){if(old.unit_id!==body.unit_id||old.stage!==body.stage||(old.due_on||null)!==(body.due_on||null))fail(409,'Этот запрос уже использован для другого задания. Откройте форму заново.');return {assignment_id:old.assignment_id,homework_id:old.homework_id,again:true};}
  const u=(await db.query('SELECT * FROM course_units WHERE id=$1 AND course_id=$2',[body.unit_id,e.course_id])).rows[0];if(!u)fail(404,'Тема не найдена');
  const allowed=u.homework_item_ids.length?u.homework_item_ids:u.item_ids;
  const ids=body.stage==='all'?allowed:u.practice_packs?.[body.stage];
  if(!ids?.length||ids.length>60||ids.some(id=>!allowed.includes(id)))fail(409,'Состав этапа изменён в редакторе курса. Проверьте материалы или выберите все этапы.');
  const found=(await db.query('SELECT id FROM library_items WHERE id=ANY($1::int[]) AND tutor_id=$2',[ids,tid])).rows;
  if(new Set(ids).size!==ids.length||found.length!==ids.length)fail(409,'Некоторые материалы удалены или недоступны. Обновите состав курса.');
  const title=`${u.code||''}. ${u.title} · ${stages[body.stage]}`.slice(0,255);
  const aid=(await db.query(`INSERT INTO assignments(tutor_id,title,description,due_on,library_item_ids,vocab_practice,subject) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,[tid,title,'Дополнительная словарная практика. Выполните выбранный этап; открытые ответы проверит преподаватель. Повторяйте слова в своём словаре.',body.due_on||null,ids,u.vocab.length?JSON.stringify({count:Math.min(12,u.vocab.length)}):null,e.subject])).rows[0].id;
  const hid=(await db.query('INSERT INTO homework(assignment_id,student_id,subject) VALUES($1,$2,$3) RETURNING id',[aid,studentId,e.subject])).rows[0].id;
  let added=0;
  for(const w of u.vocab)added+=(await db.query(`INSERT INTO vocab_items(student_id,term,translation,example,source,unit_id,subject) VALUES($1,$2,$3,$4,'unit',$5,$6) ON CONFLICT(student_id,subject,lower(term)) DO NOTHING`,[studentId,w.term,w.translation||null,w.example||null,u.id,e.subject])).rowCount;
  await db.query('INSERT INTO supplementary_assignments(enrollment_id,unit_id,stage,assignment_id,request_key) VALUES($1,$2,$3,$4,$5)',[e.id,u.id,body.stage,aid,body.request_key]);
  await db.query(`INSERT INTO notifications(user_id,kind,title,body,link) SELECT user_id,'homework',$2,'Преподаватель назначил дополнительную практику',$3 FROM students WHERE id=$1 AND user_id IS NOT NULL`,[studentId,title,`/homework/${hid}`]);
  return {assignment_id:aid,homework_id:hid,vocab_added:added,again:false};
 });
}
module.exports={template,install,list,enroll,assign,stages};
