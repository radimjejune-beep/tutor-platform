'use strict';
const {randomUUID}=require('crypto'),{query,transaction}=require('../db'),grammar=require('./grammar'),coach=require('./coaching'),{gameSchema}=require('../services/games');
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
function generated(topic,practice){
 const t=grammar.byId.get(topic),title=`${coach.label(t)}: ${practice?'практика':'повторение'}`;
 if(!practice)return {kind:'theory',title,body:[t.when,t.form,...t.examples.map(e=>'• '+e),'Обратите внимание: '+t.mistake].join('\n'),grammar_key:topic};
 const questions=coach.questionsFor(topic),blocks=questions.map(q=>q.type==='choice'?{t:'choice',q:q.prompt,options:q.options,correct:q.correct[0]}:{t:'gaps',text:q.prompt.includes('___')?q.prompt.replace('___',`[${q.correct.join('|')}]`):q.prompt+`\n[${q.correct.join('|')}]`});
 return {kind:'game',title,body:'Выполните задания и обсудите ответы.',game:gameSchema.parse({type:'sheet',blocks}),grammar_key:topic};
}
async function topicMaterial(tutorId,topic,practice,used){
 const t=grammar.byId.get(topic);
 const {rows:own}=await query(`SELECT i.id,i.title,i.kind FROM library_items i WHERE i.tutor_id=$1 AND i.grammar_key=$2 AND i.kind=$3 ORDER BY i.id=ANY($4::int[]),i.updated_at DESC LIMIT 1`,[tutorId,topic,practice?'game':'theory',used]);
 if(own[0])return {type:'library',id:own[0].id,title:own[0].title,kind:own[0].kind};
 if(t.book_id){const {rows:[bank]}=await query('SELECT id,title,kind FROM bank_items WHERE book=$1 AND unit=$2 AND kind=$3 AND NOT hidden ORDER BY author_id IS NOT NULL,id LIMIT 1',[t.book_id,t.unit,practice?'game':'theory']);if(bank)return {type:'bank',id:bank.id,title:bank.title,kind:bank.kind,topic_id:topic};}
 return {type:'generated',item:generated(topic,practice),title:coach.label(t),kind:practice?'game':'theory'};
}
async function prepare(tutorId,studentId,{duration,topic_ids=[]},subject='Английский язык'){
 const {rows:[s]}=await query('SELECT * FROM students WHERE id=$1 AND tutor_id=$2',[studentId,tutorId]);if(!s)fail(404,'Ученик не найден');
 await require('./study-subjects').resolve(studentId,tutorId,subject);
 if(topic_ids.some(id=>grammar.byId.get(id)?.subject!==subject))fail(422,'Выберите темы языка этого занятия');
 const profile=await coach.profile(studentId,{query},subject),chosen=topic_ids.length?[...new Set(topic_ids)]:profile.topics.filter(t=>['repeat','practice','due'].includes(t.status)).slice(0,2).map(t=>t.topic_id),topics=chosen.slice(0,2);
 const reasons=topics.map(key=>{const known=profile.topics.find(t=>t.topic_id===key);return {title:coach.label(grammar.byId.get(key)),reason:topic_ids.length?'Тема выбрана преподавателем':known.reason,source:known?.source||null};});
 const {rows:used}=await query('SELECT DISTINCT item_id FROM game_results WHERE student_id=$1 AND created_at>NOW()-INTERVAL \'30 days\' LIMIT 80',[studentId]);
 const usedIds=used.map(x=>x.item_id),stages=[];
 const add=(key,title,minutes,source,note='')=>stages.push({id:key,title,minutes,selected:true,note,source,material_id:null});
 const warm=Math.max(3,Math.round(duration*.1)),explain=Math.max(4,Math.round(duration*.2)),practice=Math.max(5,Math.round(duration*.3)),exit=Math.max(3,Math.round(duration*.1)),main=duration-warm-explain-practice-exit;
 const {rows:words}=await query('SELECT term,translation FROM vocab_items WHERE student_id=$1 AND subject=$2 AND due_on<=CURRENT_DATE ORDER BY due_on,box,id LIMIT 5',[studentId,subject]);
 add('warmup','Начало и повторение',warm,{type:'generated',item:{kind:'task',title:'Начало занятия',body:words.length?'Вспомните слова и составьте с ними примеры:\n'+words.map(w=>`${w.term} — ${w.translation||''}`).join('\n'):'Вспомните главное с прошлого занятия. Приведите два своих примера и задайте один вопрос.',grammar_key:null}},words.length?'Выбраны слова, которым подошёл срок повторения.':'Короткое повторение прошлого занятия.');
 if(topics[0]){
  add('explanation','Разобрать затруднение',explain,await topicMaterial(tutorId,topics[0],false,usedIds),reasons[0].reason);
  add('practice','Закрепить на заданиях',practice,await topicMaterial(tutorId,topics[0],true,usedIds),'Проверьте самостоятельный ответ и обсудите ход решения.');
 }else{
  reasons.push({title:'Недостаточно данных по грамматике',reason:'Используем программу ученика и ваши материалы. Вы можете выбрать темы вручную.',source:null});
  add('explanation','Обсудить трудности',explain,{type:'generated',item:{kind:'task',title:'Обсуждение вопросов',body:'Выберите одно затруднение из прошлой работы. Объясните его своими словами и проверьте понимание на примере.'}},'Достоверной оценки слабой грамматической темы пока нет.');
  add('practice','Самостоятельная практика',practice,{type:'generated',item:{kind:'task',title:'Практика с преподавателем',body:'Выполните выбранное преподавателем упражнение по текущей теме. Объясните, почему выбрали такой ответ.'}},'Замените этот блок подходящим материалом из библиотеки.');
 }
 let current=null;
 if(s.course_unit_id){const {rows:[unit]}=await query('SELECT u.*,c.title AS course_title FROM course_units u JOIN courses c ON c.id=u.course_id WHERE u.id=$1 AND c.tutor_id=$2',[s.course_unit_id,tutorId]);if(unit){
  const {rows:[item]}=await query('SELECT id,title,kind FROM library_items WHERE id=ANY($1::int[]) AND tutor_id=$2 ORDER BY id=ANY($3::int[]),array_position($1::int[],id) LIMIT 1',[unit.item_ids||[],tutorId,usedIds]);
  if(item){current={type:'library',id:item.id,title:item.title,kind:item.kind};reasons.push({title:`Программа: ${unit.course_title}`,reason:[unit.code,unit.title].filter(Boolean).join(' '),source:null});}
 }}
 if(!current&&topics[1])current=await topicMaterial(tutorId,topics[1],true,usedIds);
 if(!current){const excluded=stages.map(s=>s.source.type==='library'?s.source.id:null).filter(Boolean),{rows:[item]}=await query(`SELECT id,title,kind FROM library_items WHERE tutor_id=$1 AND NOT(id=ANY($2::int[])) AND kind IN('task','game','theory') ORDER BY id=ANY($3::int[]),favorite DESC,updated_at DESC LIMIT 1`,[tutorId,excluded,usedIds]);if(item)current={type:'library',id:item.id,title:item.title,kind:item.kind};}
 add('main','Работа по программе',Math.max(1,main),current||{type:'generated',item:{kind:'task',title:'Применение темы',body:'Выберите ситуацию по теме занятия. Используйте изученное в самостоятельном ответе или решении.'}},'Проверьте соответствие материала уровню и цели ученика.');
 add('exit','Проверить понимание и подвести итог',exit,{type:'generated',item:topics[0]?generated(topics[0],true):{kind:'task',title:'Итог занятия',body:'Объясните главное правило своими словами. Приведите новый пример. Что осталось непонятным?'}},'Короткая проверка в конце занятия; не заменяет отложенное повторение.');
 // Округление всегда оставляет точную длительность плана.
 stages[3].minutes+=duration-stages.reduce((n,s)=>n+s.minutes,0);
 const title=`Следующее занятие: ${s.full_name}`.slice(0,255),id=randomUUID();
 await query('INSERT INTO lesson_preparations(id,tutor_id,student_id,title,duration,stages,reasons,subject) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,tutorId,studentId,title,duration,JSON.stringify(stages),JSON.stringify(reasons),subject]);return get(id,tutorId);
}
async function get(id,tutorId){const {rows:[p]}=await query('SELECT * FROM lesson_preparations WHERE id=$1 AND tutor_id=$2',[id,tutorId]);if(!p)fail(404,'Черновик не найден');p.previews={};for(const s of p.stages){let item;if(s.source.type==='generated')item=s.source.item;else{const table=s.source.type==='bank'?'bank_items':'library_items';item=(await query(`SELECT kind,title,body,game FROM ${table} WHERE id=$1 AND ${s.source.type==='bank'?'NOT hidden':'tutor_id=$2'}`,s.source.type==='bank'?[s.source.id]:[s.source.id,tutorId])).rows[0];}if(item)p.previews[s.id]=item;}return p;}
async function options(studentId,tutorId,subject='Английский язык'){const {rows:lessons}=await query("SELECT l.id,l.starts_at,l.duration_min,l.topic FROM lessons l JOIN students s ON s.id=l.student_id WHERE l.student_id=$1 AND s.tutor_id=$2 AND l.subject=$3 AND l.status='scheduled' AND l.group_id IS NULL AND l.starts_at>NOW() ORDER BY l.starts_at LIMIT 30",[studentId,tutorId,subject]);const {rows:materials}=await query('SELECT id,title,kind FROM library_items WHERE tutor_id=$1 AND subject=$2 ORDER BY favorite DESC,updated_at DESC LIMIT 300',[tutorId,subject]);const {rows:drafts}=await query('SELECT id,title,duration,version,applied_at,applied_lesson_id,created_at FROM lesson_preparations WHERE student_id=$1 AND tutor_id=$2 AND subject=$3 ORDER BY created_at DESC LIMIT 20',[studentId,tutorId,subject]);return {lessons,materials,drafts};}
async function update(id,tutorId,{version,title,stages}){return transaction(async db=>{
 const {rows:[p]}=await db.query('SELECT * FROM lesson_preparations WHERE id=$1 AND tutor_id=$2 FOR UPDATE',[id,tutorId]);if(!p)fail(404,'Черновик не найден');if(p.applied_at)fail(409,'Этот план уже добавлен в занятие');if(p.version!==version)fail(409,'Черновик изменён в другой вкладке. Загрузите актуальную версию.');
 const byId=new Map(p.stages.map(s=>[s.id,s]));if(stages.length!==p.stages.length||new Set(stages.map(s=>s.id)).size!==stages.length||stages.some(s=>!byId.has(s.id)))fail(422,'Проверьте этапы плана');
 const ids=stages.map(s=>s.material_id).filter(Boolean);if(ids.length&&(await db.query('SELECT id FROM library_items WHERE id=ANY($1::int[]) AND tutor_id=$2 FOR SHARE',[ids,tutorId])).rows.length!==new Set(ids).size)fail(404,'Материал не найден');
 const next=stages.map(s=>{const old=byId.get(s.id),value={...old,...s};if(s.body!==undefined&&old.source.type==='generated')value.source={...old.source,item:{...old.source.item,body:s.body}};return value;}),duration=next.filter(s=>s.selected).reduce((n,s)=>n+s.minutes,0);if(duration<20||duration>120)fail(422,'Выберите этапы общей длительностью от 20 до 120 минут');
 return (await db.query('UPDATE lesson_preparations SET title=$3,stages=$4,duration=$5,version=version+1,updated_at=NOW() WHERE id=$1 AND tutor_id=$2 RETURNING *',[id,tutorId,title,JSON.stringify(next),duration])).rows[0];
 });}
async function takeBank(db,bankId,tutorId,topic,max){
 const {rows:[b]}=await db.query('SELECT * FROM bank_items WHERE id=$1 AND NOT hidden FOR UPDATE',[bankId]);if(!b)fail(409,'Материал банка скрыт или удалён. Создайте новый черновик.');
 await db.query('SELECT pg_advisory_xact_lock(727004,$1)',[tutorId]);
 const {rows:[taken]}=await db.query('SELECT i.id FROM bank_takes bt JOIN library_items i ON i.id=bt.library_id WHERE bt.item_id=$1 AND bt.tutor_id=$2 AND i.tutor_id=$2',[b.id,tutorId]);if(taken)return taken.id;
 if(max!=null){const {rows:[n]}=await db.query("SELECT COUNT(*)::int AS n FROM bank_takes WHERE tutor_id=$1 AND taken_at>=date_trunc('month',NOW())",[tutorId]);if(n.n>=max)fail(409,'Лимит материалов банка на вашем тарифе исчерпан. Замените материал в плане или продлите тариф.');}
 const {rows:[item]}=await db.query('INSERT INTO library_items(tutor_id,kind,subject,title,body,answer,game,grammar_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',[tutorId,b.kind,'Английский язык',b.title,b.body,b.answer,b.game?JSON.stringify(b.game):null,topic||null]);
 await db.query('INSERT INTO bank_takes(item_id,tutor_id,library_id) VALUES($1,$2,$3) ON CONFLICT(item_id,tutor_id) DO UPDATE SET library_id=EXCLUDED.library_id',[b.id,tutorId,item.id]);await db.query('UPDATE bank_items SET uses=uses+1 WHERE id=$1',[b.id]);return item.id;
}
async function apply(id,tutorId,{version,lesson_id}){const max=(await require('../services/plans').planOf(tutorId)).limits.bank_takes;return transaction(async db=>{
 const {rows:[p]}=await db.query('SELECT * FROM lesson_preparations WHERE id=$1 AND tutor_id=$2 FOR UPDATE',[id,tutorId]);if(!p)fail(404,'Черновик не найден');
 if(p.applied_at){if(p.applied_lesson_id!==lesson_id)fail(409,'План уже использован в другом занятии');return {ok:true,again:true,lesson_id,added:0};}
 if(p.version!==version)fail(409,'Сначала сохраните актуальную версию плана');
 await db.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[tutorId]);
 const bankIds=p.stages.filter(s=>s.selected&&!s.material_id&&s.source.type==='bank').map(s=>s.source.id);
 if(bankIds.length)await db.query('SELECT id FROM bank_items WHERE id=ANY($1::int[]) ORDER BY id FOR UPDATE',[bankIds]);
 const {rows:[lesson]}=await db.query(`SELECT l.* FROM lessons l JOIN students s ON s.id=l.student_id WHERE l.id=$1 AND l.student_id=$2 AND s.tutor_id=$3 AND l.status='scheduled' AND l.group_id IS NULL AND l.starts_at>NOW() FOR UPDATE OF l`,[lesson_id,p.student_id,tutorId]);if(!lesson)fail(404,'Выберите предстоящее индивидуальное занятие этого ученика');
 if(lesson.subject!==p.subject)fail(422,'Выберите занятие того же языка, что и план');
 if(lesson.duration_min<p.duration)fail(422,'План длиннее занятия. Сократите этапы или выберите другое занятие');
 let pos=Number((await db.query('SELECT COALESCE(MAX(position),-1) AS p FROM lesson_items WHERE lesson_id=$1',[lesson_id])).rows[0].p)+1,added=0;const materialIds=[];
 for(const stage of p.stages.filter(s=>s.selected)){
  let itemId=stage.material_id;
  if(!itemId&&stage.source.type==='library')itemId=stage.source.id;
  if(itemId){if(!(await db.query('SELECT id FROM library_items WHERE id=$1 AND tutor_id=$2 FOR SHARE',[itemId,tutorId])).rowCount)fail(409,'Один из материалов удалён. Обновите черновик.');}
  else if(stage.source.type==='bank')itemId=await takeBank(db,stage.source.id,tutorId,stage.source.topic_id,max);
  else{const i=stage.source.item,game=i.game?gameSchema.parse(i.game):null;itemId=(await db.query(`INSERT INTO library_items(tutor_id,kind,subject,title,body,game,grammar_key) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,[tutorId,i.kind,p.subject,i.title,i.body||null,game?JSON.stringify(game):null,i.grammar_key||null])).rows[0].id;}
  const inserted=await db.query('INSERT INTO lesson_items(lesson_id,item_id,position) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING item_id',[lesson_id,itemId,pos++]);added+=inserted.rowCount;materialIds.push(itemId);
 }
 const size=(await db.query('SELECT count(*)::int AS n FROM lesson_items WHERE lesson_id=$1',[lesson_id])).rows[0].n;if(size>60)fail(422,'В одном занятии можно разместить до 60 материалов. Уберите лишние материалы или выберите другое занятие.');
 const text='План занятия: '+p.title+'\n'+p.stages.filter(s=>s.selected).map(s=>`${s.minutes} мин — ${s.title}${s.note?'\n'+s.note:''}`).join('\n');
 await db.query("UPDATE lessons SET private_notes=concat_ws(E'\\n\\n',NULLIF(private_notes,''),$2::text) WHERE id=$1",[lesson_id,text]);
 await db.query('UPDATE lesson_preparations SET applied_lesson_id=$2,applied_at=NOW(),version=version+1,updated_at=NOW() WHERE id=$1',[p.id,lesson_id]);return {ok:true,again:false,lesson_id,added,material_ids:materialIds};
 });}
module.exports={prepare,get,options,update,apply,generated};
