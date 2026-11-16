const express=require('express');
const {z}=require('zod');
const {createHash}=require('crypto');
const {query,transaction}=require('../db');
const {requireRole,accessibleStudentIds,canAccessStudent}=require('../middleware/auth');
const {validateBody,asyncHandler}=require('../middleware/validate');
const catalog=require('../learning/grammar');
const d=require('../learning/diagnostics');
const router=express.Router();
router.use(express.json({limit:'2mb'}));
const tutor=requireRole('tutor'),student=requireRole('student');
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const id=n=>{n=Number(n);if(!Number.isSafeInteger(n)||n<=0)fail(400,'Некорректный номер');return n;};
const findTopic=n=>{const t=catalog.byId.get(n);if(!t)fail(404,'Тема не найдена');return t;};
const article=({questions,...t})=>t;
const validateAnswers=validateBody(z.object({answers:d.answers}).strict());

router.get('/grammar',asyncHandler(async(req,res)=>res.json(catalog.search(String(req.query.q||'').slice(0,200)))));
router.get('/grammar/:topic',asyncHandler(async(req,res)=>res.json(article(findTopic(req.params.topic)))));
router.get('/grammar/:topic/bank',tutor,asyncHandler(async(req,res)=>res.json(findTopic(req.params.topic).questions)));
router.get('/grammar/:topic/practice',asyncHandler(async(req,res)=>{
  const t=findTopic(req.params.topic);
  res.json(d.publicQuestions(d.shuffle(t.questions).slice(0,3).map(q=>d.shuffledQuestion(q))));
}));
router.post('/grammar/:topic/practice',validateBody(z.object({
  question_ids:z.array(z.string().max(20)).min(1).max(6).refine(a=>new Set(a).size===a.length),answers:d.answers,
}).strict()),asyncHandler(async(req,res)=>{
  const t=findTopic(req.params.topic),qs=req.body.question_ids.map(id=>t.questions.find(q=>q.id===id));
  if(qs.some(q=>!q))return res.status(400).json({error:'Вопрос не найден'});
  // Практика возвращает вопросы в исходном порядке вариантов. Клиент практики использует текст ответа
  // для выбора; диагностические снимки проверяются отдельно и никогда этим маршрутом не изменяются.
  const given={...req.body.answers};
  for(const q of qs)if(q.type==='choice'&&typeof given[q.id]==='string')given[q.id]=q.options.indexOf(given[q.id]);
  res.json({questions:qs,result:d.assess(qs,given)});
}));

router.get('/sections',asyncHandler(async(req,res)=>{
  if(req.user.role==='tutor')return res.json((await query('SELECT id,title,grammar_key FROM study_sections WHERE tutor_id=$1 ORDER BY created_at,id',[req.user.id])).rows);
  let ids=await accessibleStudentIds(req.user);
  if(req.query.student_id){const n=id(req.query.student_id);if(!ids.includes(n))return res.status(404).json({error:'Ученик не найден'});ids=[n];}
  const {rows}=await query(`SELECT ss.id,ss.title,ss.grammar_key FROM study_sections ss WHERE
    EXISTS(SELECT 1 FROM assignments a JOIN homework h ON h.assignment_id=a.id WHERE a.section_id=ss.id AND h.student_id=ANY($1::int[])) OR
    EXISTS(SELECT 1 FROM diagnostic_tests t JOIN diagnostic_runs r ON r.test_id=t.id WHERE t.section_id=ss.id AND r.student_id=ANY($1::int[]))
    ORDER BY ss.created_at,ss.id`,[ids]);res.json(rows);
}));
const sectionSchema=z.object({title:z.string().trim().min(1).max(160),grammar_key:d.topicKey.nullable().optional()}).strict();
router.post('/sections',tutor,validateBody(sectionSchema),asyncHandler(async(req,res)=>{
  const {rows}=await query(`INSERT INTO study_sections(tutor_id,title,grammar_key) VALUES($1,$2,$3)
    ON CONFLICT(tutor_id,lower(title)) DO NOTHING RETURNING id,title,grammar_key`,[req.user.id,req.body.title,req.body.grammar_key||null]);
  if(!rows[0])return res.status(409).json({error:'Раздел с таким названием уже есть'});
  res.status(201).json(rows[0]);
}));
router.patch('/sections/:id',tutor,validateBody(sectionSchema),asyncHandler(async(req,res)=>{
  try{
    const {rows}=await query('UPDATE study_sections SET title=$1,grammar_key=$2 WHERE id=$3 AND tutor_id=$4 RETURNING id,title,grammar_key',[req.body.title,req.body.grammar_key||null,id(req.params.id),req.user.id]);
    if(!rows[0])return res.status(404).json({error:'Раздел не найден'});res.json(rows[0]);
  }catch(e){if(e.code==='23505')return res.status(409).json({error:'Раздел с таким названием уже есть'});throw e;}
}));
router.delete('/sections/:id',tutor,asyncHandler(async(req,res)=>{
  const {rows}=await query('DELETE FROM study_sections WHERE id=$1 AND tutor_id=$2 RETURNING id',[id(req.params.id),req.user.id]);
  if(!rows[0])return res.status(404).json({error:'Раздел не найден'});res.json({ok:true});
}));

router.get('/covered/:studentId',tutor,asyncHandler(async(req,res)=>{
  const sid=id(req.params.studentId);if(!await canAccessStudent(req.user,sid))return res.status(404).json({error:'Ученик не найден'});
  res.json({topic_ids:await d.completed(sid)});
}));
const previewSchema=z.object({student_ids:z.array(z.number().int().positive()).min(1).max(30),
  mode:z.enum(['topics','covered']),topic_ids:z.array(d.topicKey).max(41).default([]),
  per_topic:z.number().int().min(3).max(6).default(3),max_topics:z.number().int().min(1).max(12).default(8),
}).strict();
router.post('/diagnostics/preview',tutor,validateBody(previewSchema),asyncHandler(async(req,res)=>{
  const b=req.body,ids=[...new Set(b.student_ids)];
  const {rows}=await query('SELECT id,full_name FROM students WHERE id=ANY($1::int[]) AND tutor_id=$2 ORDER BY full_name',[ids,req.user.id]);
  if(rows.length!==ids.length)return res.status(404).json({error:'Некоторые ученики не найдены'});
  const papers=[];
  for(const s of rows){
    const all=b.mode==='covered'?await d.completed(s.id):[...new Set(b.topic_ids)];
    const selected=b.mode==='covered'?all.slice(0,Math.min(b.max_topics,Math.floor(50/b.per_topic))):all;
    if(!selected.length)return res.status(400).json({error:`${s.full_name}: нет выбранных пройденных тем. Отметьте темы в программе или выберите их вручную.`});
    papers.push({student_id:s.id,student_name:s.full_name,topic_ids:selected,omitted:all.length-selected.length,questions:d.generate(selected,b.per_topic)});
  }
  res.json({papers});
}));
const createSchema=z.object({title:z.string().trim().min(1).max(200),instructions:z.string().max(4000).default(''),due_on:d.date.nullable().default(null),
 section_id:z.number().int().positive().nullable().default(null),mode:z.enum(['manual','topics','covered']),request_key:z.string().uuid(),
 papers:z.array(z.object({student_id:z.number().int().positive(),questions:d.questions}).strict()).min(1).max(30)
 .refine(a=>new Set(a.map(p=>p.student_id)).size===a.length,'Ученик повторяется'),
}).strict();
router.post('/diagnostics',tutor,validateBody(createSchema),asyncHandler(async(req,res)=>{
  const b=req.body,hash=createHash('sha256').update(JSON.stringify(b)).digest('hex');
  const out=await transaction(async db=>{
    const {rows:old}=await db.query('SELECT id,request_hash FROM diagnostic_tests WHERE tutor_id=$1 AND request_key=$2',[req.user.id,b.request_key]);
    if(old[0]){if(old[0].request_hash!==hash)fail(409,'Эта выдача уже сохранена с другим содержанием. Откройте её или создайте новый тест.');return {id:old[0].id,again:true};}
    const ids=b.papers.map(p=>p.student_id);
    const {rows:owned}=await db.query('SELECT id FROM students WHERE id=ANY($1::int[]) AND tutor_id=$2 FOR KEY SHARE',[ids,req.user.id]);
    if(owned.length!==ids.length)fail(404,'Некоторые ученики не найдены');
    if(!await d.ownSection(db,b.section_id,req.user.id))fail(404,'Раздел не найден');
    for(const paper of b.papers)if(b.mode==='covered'){
      const covered=await d.completed(paper.student_id,db);
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
      const {rows:[run]}=await db.query('INSERT INTO diagnostic_runs(test_id,student_id,questions) VALUES($1,$2,$3) RETURNING id',[testId,paper.student_id,JSON.stringify(paper.questions)]);
      await db.query(`INSERT INTO notifications(user_id,kind,title,body,link)
        SELECT u.id,'diagnostic_new',$2,$3,$4 FROM students s JOIN users u ON u.id=s.user_id WHERE s.id=$1 AND u.is_active`,
        [paper.student_id,`Новый тест: ${b.title}`,b.due_on?`Срок: ${b.due_on}`:'Срок не ограничен',`/diagnostics/runs/${run.id}`]);
    }
    return {id:testId,again:false};
  });res.status(out.again?200:201).json(out);
}));
router.get('/diagnostics',asyncHandler(async(req,res)=>{
  if(req.user.role==='tutor'){
    const {rows}=await query(`SELECT t.id,t.title,t.due_on,t.section_id,t.created_at,ss.title AS section_title,count(r.id)::int AS total,
      count(r.id) FILTER(WHERE r.submitted_at IS NOT NULL)::int AS submitted
      FROM diagnostic_tests t LEFT JOIN study_sections ss ON ss.id=t.section_id LEFT JOIN diagnostic_runs r ON r.test_id=t.id
      WHERE t.tutor_id=$1 GROUP BY t.id,ss.title ORDER BY t.created_at DESC,t.id DESC`,[req.user.id]);return res.json(rows);
  }
  let ids=await accessibleStudentIds(req.user);
  if(req.query.student_id){const sid=id(req.query.student_id);if(!ids.includes(sid))return res.status(404).json({error:'Ученик не найден'});ids=[sid];}
  const {rows}=await query(`SELECT r.id,r.test_id,r.student_id,r.submitted_at,r.result,t.title,t.due_on,t.section_id,ss.title AS section_title,
    jsonb_array_length(r.questions) AS question_count FROM diagnostic_runs r JOIN diagnostic_tests t ON t.id=r.test_id
    LEFT JOIN study_sections ss ON ss.id=t.section_id WHERE r.student_id=ANY($1::int[]) ORDER BY r.created_at DESC,r.id DESC`,[ids]);res.json(rows);
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
