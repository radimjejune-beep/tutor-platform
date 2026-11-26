const express=require('express');
const {z}=require('zod');
const {createHash}=require('crypto');
const {query,transaction}=require('../db');
const {requireRole,accessibleStudentIds,canAccessStudent}=require('../middleware/auth');
const {validateBody,asyncHandler}=require('../middleware/validate');
const catalog=require('../learning/grammar');
const {HOMEWORK_SECTION}=require('../learning/homework-sections');
const d=require('../learning/diagnostics');
const subjects=require('../learning/study-subjects');
const {contentOf}=require('../learning/grammar-content');
const router=express.Router();
router.use(express.json({limit:'2mb'}));
const tutor=requireRole('tutor'),student=requireRole('student');
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const id=n=>{n=Number(n);if(!Number.isSafeInteger(n)||n<=0)fail(400,'Некорректный номер');return n;};
const findTopic=n=>{const t=catalog.byId.get(n);if(!t)fail(404,'Тема не найдена');return t;};
const article=({questions,practice_questions,...t})=>({...t,content:contentOf(t),practice_count:(practice_questions||questions).length});
const validateAnswers=validateBody(z.object({answers:d.answers}).strict());

router.get('/grammar',asyncHandler(async(req,res)=>res.json(catalog.search(String(req.query.q||'').slice(0,200)).filter(t=>!req.query.subject||t.subject===req.query.subject))));
router.get('/grammar/:topic',asyncHandler(async(req,res)=>res.json(article(findTopic(req.params.topic)))));
router.get('/grammar/:topic/bank',tutor,asyncHandler(async(req,res)=>res.json(findTopic(req.params.topic).questions)));
router.get('/grammar/:topic/practice',asyncHandler(async(req,res)=>{
  const t=findTopic(req.params.topic);
  const parsed=z.object({size:z.enum(['3','6','12']).optional()}).strict().safeParse(req.query||{});
  if(!parsed.success)return res.status(422).json({error:'Выберите практику на 3, 6 или 12 вопросов'});
  const size=Number(parsed.data.size||3),pool=parsed.data.size?(t.practice_questions||t.questions):t.questions;
  res.json(d.publicQuestions(d.shuffle(pool).slice(0,size).map(q=>d.shuffledQuestion(q))));
}));
router.post('/grammar/:topic/practice',validateBody(z.object({
  question_ids:z.array(z.string().max(20)).min(1).max(12).refine(a=>new Set(a).size===a.length),answers:d.answers,
}).strict()),asyncHandler(async(req,res)=>{
  const t=findTopic(req.params.topic),qs=req.body.question_ids.map(id=>(t.practice_questions||t.questions).find(q=>q.id===id));
  if(qs.some(q=>!q))return res.status(400).json({error:'Вопрос не найден'});
  // Практика возвращает вопросы в исходном порядке вариантов. Клиент практики использует текст ответа
  // для выбора; диагностические снимки проверяются отдельно и никогда этим маршрутом не изменяются.
  const given={...req.body.answers};
  for(const q of qs)if(q.type==='choice'&&typeof given[q.id]==='string')given[q.id]=q.options.indexOf(given[q.id]);
  res.json({questions:qs,result:d.assess(qs,given)});
}));

router.get('/sections',asyncHandler(async(req,res)=>{
  if(req.user.role==='tutor')return res.json((await query('SELECT id,title,grammar_key,subject FROM study_sections WHERE tutor_id=$1 AND ($2::text IS NULL OR subject=$2) ORDER BY created_at,id',[req.user.id,req.query.subject||null])).rows);
  let ids=await accessibleStudentIds(req.user);
  if(req.query.student_id){const n=id(req.query.student_id);if(!ids.includes(n))return res.status(404).json({error:'Ученик не найден'});ids=[n];}
  const {rows}=await query(`SELECT ss.id,ss.title,ss.grammar_key,ss.subject FROM study_sections ss WHERE ($2::text IS NULL OR ss.subject=$2) AND (
    EXISTS(SELECT 1 FROM assignments a JOIN homework h ON h.assignment_id=a.id WHERE (${HOMEWORK_SECTION})=ss.id AND h.student_id=ANY($1::int[])) OR
    EXISTS(SELECT 1 FROM diagnostic_tests t JOIN diagnostic_runs r ON r.test_id=t.id WHERE t.section_id=ss.id AND r.student_id=ANY($1::int[]))
     ) ORDER BY ss.created_at,ss.id`,[ids,req.query.subject||null]);res.json(rows);
}));
const sectionSchema=z.object({title:z.string().trim().min(1).max(160),grammar_key:d.topicKey.nullable().optional(),subject:z.string().trim().min(1).max(255).optional()}).strict();
router.post('/sections',tutor,validateBody(sectionSchema),asyncHandler(async(req,res)=>{
  const subject=req.body.subject||req.user.subject||'Английский язык';
  if(req.body.grammar_key&&catalog.byId.get(req.body.grammar_key)?.subject!==subject)fail(422,'Объяснение должно относиться к выбранному языку');
  const section=await transaction(async db=>{
    const {rows}=await db.query(`INSERT INTO study_sections(tutor_id,title,grammar_key,subject) VALUES($1,$2,$3,$4)
      ON CONFLICT(tutor_id,subject,lower(title)) DO NOTHING RETURNING id,title,grammar_key,subject`,[req.user.id,req.body.title,req.body.grammar_key||null,subject]);
    if(rows[0])return {created:true,value:rows[0]};
    // Раздел — общая тема преподавателя; работы каждого ученика размещаются отдельно.
    // Повторное использование не меняет название или объяснение уже созданной темы.
    const existing=await db.query(`SELECT id,title,grammar_key FROM study_sections
      WHERE tutor_id=$1 AND subject=$3 AND lower(title)=lower($2) FOR SHARE`,[req.user.id,req.body.title,subject]);
    if(!existing.rows[0])fail(409,'Раздел был удалён. Повторите создание.');
    return {created:false,value:{...existing.rows[0],reused:true}};
  });
  res.status(section.created?201:200).json(section.value);
}));
router.patch('/sections/:id',tutor,validateBody(sectionSchema),asyncHandler(async(req,res)=>{
  try{
    const {rows:[current]}=await query('SELECT subject FROM study_sections WHERE id=$1 AND tutor_id=$2',[id(req.params.id),req.user.id]);if(!current)return res.status(404).json({error:'Раздел не найден'});
    if(req.body.subject&&req.body.subject!==current.subject)fail(422,'Создайте отдельный раздел для другого предмета');
    if(req.body.grammar_key&&catalog.byId.get(req.body.grammar_key)?.subject!==current.subject)fail(422,'Объяснение должно относиться к языку раздела');
    const {rows}=await query('UPDATE study_sections SET title=$1,grammar_key=$2 WHERE id=$3 AND tutor_id=$4 RETURNING id,title,grammar_key',[req.body.title,req.body.grammar_key||null,id(req.params.id),req.user.id]);
    if(!rows[0])return res.status(404).json({error:'Раздел не найден'});res.json(rows[0]);
  }catch(e){if(e.code==='23505')return res.status(409).json({error:'Раздел с таким названием уже есть'});throw e;}
}));
router.delete('/sections/:id',tutor,asyncHandler(async(req,res)=>{
  const {rows}=await query('DELETE FROM study_sections WHERE id=$1 AND tutor_id=$2 RETURNING id',[id(req.params.id),req.user.id]);
  if(!rows[0])return res.status(404).json({error:'Раздел не найден'});res.json({ok:true});
}));

// Меняется только размещение работ конкретного ученика: ответы и проверка сохраняются.
router.patch('/students/:studentId/homework-sections',tutor,validateBody(z.object({
  homework_ids:z.array(z.number().int().positive()).min(1).max(200).refine(a=>new Set(a).size===a.length,'Работы не должны повторяться'),
  section_id:z.number().int().positive().nullable(),
}).strict()),asyncHandler(async(req,res)=>{
  const sid=id(req.params.studentId),{homework_ids:ids,section_id:section}=req.body;
  const result=await transaction(async db=>{
    const own=await db.query('SELECT id FROM students WHERE id=$1 AND tutor_id=$2 FOR KEY SHARE',[sid,req.user.id]);
    if(!own.rows[0])fail(404,'Ученик не найден');
    let sectionSubject;
    if(section){
      const found=await db.query('SELECT id,subject FROM study_sections WHERE id=$1 AND tutor_id=$2 FOR KEY SHARE',[section,req.user.id]);
      if(!found.rows[0])fail(404,'Раздел не найден');sectionSubject=found.rows[0].subject;
    }
    const owned=await db.query(`SELECT h.id,h.subject FROM homework h JOIN assignments a ON a.id=h.assignment_id
      WHERE h.student_id=$1 AND h.id=ANY($2::int[]) AND a.tutor_id=$3 ORDER BY h.id FOR UPDATE OF h`,[sid,ids,req.user.id]);
    if(owned.rows.length!==ids.length)fail(404,'Некоторые работы не найдены у этого ученика');
    if(sectionSubject&&owned.rows.some(h=>h.subject!==sectionSubject))fail(422,'Раздел должен относиться к тому же предмету, что и задания');
    await db.query('UPDATE homework SET section_id=$1,section_overridden=true WHERE id=ANY($2::int[])',[section,ids]);
    return {updated:ids.length,section_id:section};
  });res.json(result);
}));

router.get('/covered/:studentId',tutor,asyncHandler(async(req,res)=>{
  const sid=id(req.params.studentId);if(!await canAccessStudent(req.user,sid))return res.status(404).json({error:'Ученик не найден'});
  res.json({topic_ids:await d.completed(sid,undefined,req.query.subject||null)});
}));
const previewSchema=z.object({student_ids:z.array(z.number().int().positive()).min(1).max(30),
  subject:z.string().trim().min(1).max(255).default('Английский язык'),
  mode:z.enum(['topics','covered']),topic_ids:z.array(d.topicKey).max(100).default([]),
  per_topic:z.number().int().min(3).max(6).default(3),max_topics:z.number().int().min(1).max(12).default(8),
}).strict();
router.post('/diagnostics/preview',tutor,validateBody(previewSchema),asyncHandler(async(req,res)=>{
  const b=req.body,ids=[...new Set(b.student_ids)];
  const {rows}=await query('SELECT id,full_name FROM students WHERE id=ANY($1::int[]) AND tutor_id=$2 ORDER BY full_name',[ids,req.user.id]);
  if(rows.length!==ids.length)return res.status(404).json({error:'Некоторые ученики не найдены'});
  const papers=[];
  for(const s of rows){
    await subjects.resolve(s.id,req.user.id,b.subject);
    const all=b.mode==='covered'?await d.completed(s.id,undefined,b.subject):[...new Set(b.topic_ids)];
    if(all.some(id=>catalog.byId.get(id)?.subject!==b.subject))fail(422,'Все темы теста должны относиться к выбранному языку');
    const selected=b.mode==='covered'?all.slice(0,Math.min(b.max_topics,Math.floor(50/b.per_topic))):all;
    if(!selected.length)return res.status(400).json({error:`${s.full_name}: нет выбранных пройденных тем. Отметьте темы в программе или выберите их вручную.`});
    papers.push({student_id:s.id,student_name:s.full_name,topic_ids:selected,omitted:all.length-selected.length,questions:d.generate(selected,b.per_topic)});
  }
  res.json({papers});
}));
const createSchema=z.object({title:z.string().trim().min(1).max(200),instructions:z.string().max(4000).default(''),due_on:d.date.nullable().default(null),
 subject:z.string().trim().min(1).max(255).optional(),
 section_id:z.number().int().positive().nullable().default(null),mode:z.enum(['manual','topics','covered']),request_key:z.string().uuid(),
 papers:z.array(z.object({student_id:z.number().int().positive(),questions:d.questions}).strict()).min(1).max(30)
 .refine(a=>new Set(a.map(p=>p.student_id)).size===a.length,'Ученик повторяется'),
}).strict();
router.post('/diagnostics',tutor,validateBody(createSchema),asyncHandler(async(req,res)=>{
  const b=req.body,hash=createHash('sha256').update(JSON.stringify(b)).digest('hex');
  const subject=b.subject||catalog.byId.get(b.papers[0].questions[0].topic_id)?.subject||'Английский язык';
  if(b.papers.some(p=>p.questions.some(q=>catalog.byId.get(q.topic_id)?.subject!==subject)))fail(422,'В одном тесте должны быть темы одного языка');
  const out=await transaction(async db=>{
    const {rows:old}=await db.query('SELECT id,request_hash FROM diagnostic_tests WHERE tutor_id=$1 AND request_key=$2',[req.user.id,b.request_key]);
    if(old[0]){if(old[0].request_hash!==hash)fail(409,'Эта выдача уже сохранена с другим содержанием. Откройте её или создайте новый тест.');return {id:old[0].id,again:true};}
    const ids=b.papers.map(p=>p.student_id);
    const {rows:owned}=await db.query('SELECT id FROM students WHERE id=ANY($1::int[]) AND tutor_id=$2 FOR KEY SHARE',[ids,req.user.id]);
    if(owned.length!==ids.length)fail(404,'Некоторые ученики не найдены');
    for(const sid of ids)await subjects.resolve(sid,req.user.id,subject,db);
    if(!await d.ownSection(db,b.section_id,req.user.id,subject))fail(404,'Раздел не найден');
    for(const paper of b.papers)if(b.mode==='covered'){
      const covered=await d.completed(paper.student_id,db,subject);
      if(paper.questions.some(q=>!covered.includes(q.topic_id)))fail(400,'В тест по пройденному попала тема, не отмеченная как завершённая в программе ученика');
    }
    const {rows}=await db.query(`INSERT INTO diagnostic_tests(tutor_id,title,instructions,due_on,section_id,mode,request_key,request_hash)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(tutor_id,request_key) DO NOTHING RETURNING id`,[req.user.id,b.title,b.instructions,b.due_on,b.section_id,b.mode,b.request_key,hash]);
    if(!rows[0]){
      const {rows:[old]}=await db.query('SELECT id,request_hash FROM diagnostic_tests WHERE tutor_id=$1 AND request_key=$2',[req.user.id,b.request_key]);
      if(old.request_hash!==hash)fail(409,'Эта выдача уже сохранена с другим содержанием');return {id:old.id,again:true};
    }
    const testId=rows[0].id;
    for(const paper of b.papers){
      const {rows:[run]}=await db.query('INSERT INTO diagnostic_runs(test_id,student_id,questions,subject) VALUES($1,$2,$3,$4) RETURNING id',[testId,paper.student_id,JSON.stringify(paper.questions),subject]);
      await db.query(`INSERT INTO notifications(user_id,kind,title,body,link)
        SELECT u.id,'diagnostic_new',$2,$3,$4 FROM students s JOIN users u ON u.id=s.user_id WHERE s.id=$1 AND u.is_active`,
        [paper.student_id,`Новый тест: ${b.title}`,b.due_on?`Срок: ${b.due_on}`:'Срок не ограничен',`/diagnostics/runs/${run.id}`]);
    }
    return {id:testId,again:false};
  });res.status(out.again?200:201).json(out);
}));
router.get('/diagnostics',asyncHandler(async(req,res)=>{
  if(req.user.role==='tutor'){
    const {rows}=await query(`SELECT t.id,t.title,t.due_on,t.section_id,t.created_at,min(r.subject) AS subject,ss.title AS section_title,count(r.id)::int AS total,
      count(r.id) FILTER(WHERE r.submitted_at IS NOT NULL)::int AS submitted
      FROM diagnostic_tests t LEFT JOIN study_sections ss ON ss.id=t.section_id LEFT JOIN diagnostic_runs r ON r.test_id=t.id
      WHERE t.tutor_id=$1 AND ($2::text IS NULL OR r.subject=$2) GROUP BY t.id,ss.title ORDER BY t.created_at DESC,t.id DESC`,[req.user.id,req.query.subject||null]);return res.json(rows);
  }
  let ids=await accessibleStudentIds(req.user);
  if(req.query.student_id){const sid=id(req.query.student_id);if(!ids.includes(sid))return res.status(404).json({error:'Ученик не найден'});ids=[sid];}
  const {rows}=await query(`SELECT r.id,r.test_id,r.student_id,r.subject,r.submitted_at,r.result,t.title,t.due_on,t.section_id,ss.title AS section_title,
    jsonb_array_length(r.questions) AS question_count FROM diagnostic_runs r JOIN diagnostic_tests t ON t.id=r.test_id
    LEFT JOIN study_sections ss ON ss.id=t.section_id WHERE r.student_id=ANY($1::int[]) AND ($2::text IS NULL OR r.subject=$2) ORDER BY r.created_at DESC,r.id DESC`,[ids,req.query.subject||null]);res.json(rows);
}));
router.get('/diagnostics/tests/:id',tutor,asyncHandler(async(req,res)=>{
  const {rows:[test]}=await query('SELECT * FROM diagnostic_tests WHERE id=$1 AND tutor_id=$2',[id(req.params.id),req.user.id]);
  if(!test)return res.status(404).json({error:'Тест не найден'});
  const {rows:runs}=await query(`SELECT r.id,r.student_id,r.submitted_at,r.result,jsonb_array_length(r.questions) AS question_count,s.full_name AS student_name
    FROM diagnostic_runs r JOIN students s ON s.id=r.student_id WHERE r.test_id=$1 ORDER BY s.full_name`,[test.id]);
  res.json({...test,runs});
}));
async function loadRun(user,n,db={query},lock=false){
  const {rows:[r]}=await db.query(`SELECT r.*,t.tutor_id,t.title,t.instructions,t.due_on,t.section_id,s.full_name AS student_name
    FROM diagnostic_runs r JOIN diagnostic_tests t ON t.id=r.test_id JOIN students s ON s.id=r.student_id
    WHERE r.id=$1 ${lock?'FOR UPDATE OF r':''}`,[n]);
  if(!r||!await canAccessStudent(user,r.student_id)||user.role==='tutor'&&r.tutor_id!==user.id)fail(404,'Работа не найдена');return r;
}
router.get('/diagnostics/runs/:id',asyncHandler(async(req,res)=>{
  const r=await loadRun(req.user,id(req.params.id));
  const reveal=req.user.role==='tutor'||Boolean(r.submitted_at);
  const {questions,answers,result,...meta}=r;
  res.json({...meta,questions:reveal?questions:req.user.role==='student'?d.publicQuestions(questions):[],
    answers:reveal||req.user.role==='student'?answers:{},result:r.submitted_at?result:null});
}));
router.put('/diagnostics/runs/:id/draft',student,validateAnswers,asyncHandler(async(req,res)=>{
  const r=await loadRun(req.user,id(req.params.id));
  const {rows}=await query('UPDATE diagnostic_runs SET answers=$1,draft_at=NOW() WHERE id=$2 AND submitted_at IS NULL RETURNING draft_at',[JSON.stringify(req.body.answers),r.id]);
  if(!rows[0])return res.status(409).json({error:'Работа уже сдана'});res.json(rows[0]);
}));
router.post('/diagnostics/runs/:id/submit',student,validateAnswers,asyncHandler(async(req,res)=>{
  const result=await transaction(async db=>{
    const r=await loadRun(req.user,id(req.params.id),db,true);
    if(r.submitted_at)return {id:r.id,again:true};
    const result=d.assess(r.questions,req.body.answers);
    const answers=Object.fromEntries(r.questions.filter(q=>Object.hasOwn(req.body.answers,q.id)).map(q=>[q.id,req.body.answers[q.id]]));
    await db.query('UPDATE diagnostic_runs SET answers=$1,result=$2,submitted_at=NOW(),draft_at=NULL WHERE id=$3',[JSON.stringify(answers),JSON.stringify(result),r.id]);
    const weak=result.topics.filter(t=>['repeat','practice'].includes(t.status));
    const body=`${r.student_name}: ${result.earned} из ${result.total}, ${result.score}%. `+(weak.length?'Повторить: '+weak.map(t=>`${t.title} (${t.correct}/${t.total})`).join('; '):'Разбор по темам доступен в работе.');
    await db.query(`INSERT INTO notifications(user_id,kind,title,body,link)
      SELECT u.id,'diagnostic_result',$2,$3,$4 FROM users u WHERE u.is_active AND (u.id=$5 OR
        u.id=(SELECT user_id FROM students WHERE id=$1) OR u.id IN(SELECT parent_user_id FROM parent_students WHERE student_id=$1))`,
      [r.student_id,`Результат теста: ${r.title}`.slice(0,255),body.slice(0,2000),`/diagnostics/runs/${r.id}`,r.tutor_id]);
    return {id:r.id,again:false};
  });res.json(result);
}));
module.exports=router;
