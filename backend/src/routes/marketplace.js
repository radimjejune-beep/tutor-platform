// Собственная витрина Lessonfold. Текущий учебный /courses и существующие записи не меняются.
const express=require('express'),{z}=require('zod');
const {query,transaction}=require('../db');
const {asyncHandler:ah,validateBody:vb}=require('../middleware/validate');
const {accessibleStudentIds}=require('../middleware/auth');
const quiz=require('../services/quiz');
const commerce=require('../../lessonfold/src/commerce');
const fail=(s,status=422)=>Object.assign(Error(s),{status});
const fields=`id,title,slug,description,thumbnail_url,category,level,price_type,price_amount,currency,total_lessons,estimated_hours,rating,reviews_count,content_version,audience,outcomes`;
const publicRouter=express.Router(),router=express.Router();
function outline(c){const modules=Array.isArray(c.modules)?c.modules:[];return {...Object.fromEntries(fields.split(',').map(k=>[k,c[k]])),seller:'Lessonfold',modules:modules.map(m=>({title:m.title,units:Array.isArray(m.units)?m.units.map(u=>({title:u.title,type:u.type,preview:u.preview===true&&['text','video'].includes(u.type),pass_score:u.type==='quiz'?(u.pass_score??70):undefined})):[]}))};}
publicRouter.get('/courses',ah(async(req,res)=>{
 const search=String(req.query.search||'').trim().slice(0,100),category=String(req.query.category||'').slice(0,50);
 const rows=(await query(`SELECT ${fields} FROM marketplace_courses WHERE status='published' AND ($1='' OR title ILIKE '%'||$1||'%' OR description ILIKE '%'||$1||'%') AND ($2='' OR category=$2) ORDER BY is_featured DESC,published_at DESC,id DESC LIMIT 100`,[search,category])).rows;
 res.json({courses:rows});
}));
publicRouter.get('/courses/:slug',ah(async(req,res)=>{
 const c=(await query("SELECT * FROM marketplace_courses WHERE slug=$1 AND status='published'",[req.params.slug])).rows[0];
 if(!c)return res.status(404).json({error:'Курс не найден'});res.json(outline(c));
}));
publicRouter.get('/courses/:slug/preview/:mi/:ui',ah(async(req,res)=>{
 const c=(await query("SELECT modules FROM marketplace_courses WHERE slug=$1 AND status='published'",[req.params.slug])).rows[0];
 const mi=Number(req.params.mi),ui=Number(req.params.ui),u=Number.isInteger(mi)&&mi>=0&&Number.isInteger(ui)&&ui>=0?c?.modules?.[mi]?.units?.[ui]:null;
 if(!u||u.preview!==true||!['text','video'].includes(u.type))throw fail('Пробное занятие недоступно',404);
 res.json({title:u.title,type:u.type,...(u.type==='text'?{content:u.content}:{url:u.url})});
}));
router.use(express.json({limit:'2mb'}));
router.param('id',(req,res,next,value)=>/^\d{1,10}$/.test(value)&&Number(value)>0&&Number(value)<=2147483647?next():res.status(404).json({error:'Запись не найдена'}));
const author=(req,res,next)=>req.user.role==='tutor'?next():res.status(403).json({error:'Только для преподавателя'});
const courseSchema=z.object({title:z.string().trim().min(2).max(200),description:z.string().max(20000).default(''),category:z.string().max(50).default('english'),level:z.string().max(30).default('beginner'),price_type:z.enum(['free','paid']),price_amount:z.number().int().min(0).max(100000000),audience:z.enum(['both','self','tutor']).optional(),outcomes:z.array(z.string().trim().min(1).max(500)).max(12).optional(),estimated_hours:z.number().int().min(1).max(2000).nullable().optional(),modules:z.array(z.object({title:z.string().min(1).max(200),units:z.array(z.record(z.string(),z.unknown())).max(100)})).max(100)});
function checkModules(modules){
 let count=0;for(const m of modules){for(const u of m.units){
  if(u.preview!==undefined&&typeof u.preview!=='boolean')throw fail('Проверьте настройки пробного занятия');
  if(u.pass_score!==undefined&&(!Number.isInteger(u.pass_score)||u.pass_score<1||u.pass_score>100))throw fail('Порог теста должен быть от 1 до 100%');
  if(u.model_answer!==undefined&&(typeof u.model_answer!=='string'||u.model_answer.length>10000))throw fail('Слишком длинный пример ответа');
  if(++count>1000||!String(u.title||'').trim()||String(u.title).length>200)throw fail('Проверьте названия занятий (до 1000 занятий на курс)');
  if(['text','assignment'].includes(u.type)){if(typeof u.content!=='string'||!u.content.trim()||u.content.length>30000)throw fail('Добавьте текст занятия');}
  else if(u.type==='video'){let url;try{url=new URL(u.url);}catch{throw fail('Укажите ссылку на видео');}if(url.protocol!=='https:')throw fail('Для видео нужна HTTPS-ссылка');}
  else if(u.type==='quiz'){const p=quiz.questionsSchema.safeParse(u.questions);if(!p.success||!p.data.length)throw fail('Проверьте вопросы теста');u.questions=p.data;}
  else throw fail('Публикация поддерживает текст, видео, тест и письменное задание. Существующий черновик сохранён.');
 }}return count;
}
router.get('/author',author,ah(async(req,res)=>{
 res.json((await query(`SELECT id,title,slug,status,currency,price_type,price_amount,content_version FROM marketplace_courses WHERE author_id=$1 OR $2 ORDER BY updated_at DESC`,[req.user.id,!!req.user.is_admin])).rows);
}));
router.get('/author/:id',author,ah(async(req,res)=>{
 const c=(await query('SELECT * FROM marketplace_courses WHERE id=$1 AND (author_id=$2 OR $3)',[req.params.id,req.user.id,!!req.user.is_admin])).rows[0];if(!c)throw fail('Курс не найден',404);res.json(c);
}));
router.post('/author',author,ah(async(req,res)=>{
 if(!req.user.is_admin)throw fail('Новые курсы в витрине создаёт команда Lessonfold',403);
 const c=(await query("INSERT INTO marketplace_courses(author_id,title,slug,currency,commission_rate) VALUES($1,'Новый курс',$2,'RUB',0) RETURNING id",[req.user.id,'course-'+require('crypto').randomUUID()])).rows[0];res.status(201).json(c);
}));
router.put('/author/:id',author,vb(courseSchema),ah(async(req,res)=>{
 const b=req.body;if(b.price_type==='paid'&&(b.price_amount<=0||b.price_amount%100))throw fail('Укажите целую стоимость в рублях');
 const c=(await query(`UPDATE marketplace_courses SET title=$1,description=$2,category=$3,level=$4,price_type=$5,price_amount=$6,currency='RUB',modules=$7,content_version=content_version+1,status='draft',updated_at=NOW(),audience=COALESCE($11,audience),outcomes=COALESCE($12::jsonb,outcomes),estimated_hours=CASE WHEN $14 THEN $13 ELSE estimated_hours END WHERE id=$8 AND (author_id=$9 OR $10) RETURNING id`,[b.title,b.description,b.category,b.level,b.price_type,b.price_type==='free'?0:b.price_amount,JSON.stringify(b.modules),req.params.id,req.user.id,!!req.user.is_admin,b.audience??null,b.outcomes===undefined?null:JSON.stringify(b.outcomes),b.estimated_hours??null,Object.hasOwn(b,'estimated_hours')])).rows[0];
 if(!c)throw fail('Курс не найден',404);res.json(c);
}));
router.post('/author/:id/publish',author,ah(async(req,res)=>{
 if(!req.user.is_admin)throw fail('Курс публикует администратор Lessonfold',403);
 await transaction(async c=>{
  const course=(await c.query('SELECT * FROM marketplace_courses WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0];if(!course)throw fail('Курс не найден',404);
  if(course.currency!=='RUB'||!['free','paid'].includes(course.price_type)||course.price_type==='paid'&&(!course.price_amount||course.price_amount%100))throw fail('Проверьте цену в рублях');
  if(req.body?.rights_confirmed!==true)throw fail('Подтвердите право продавать все материалы курса');
  const modules=courseSchema.shape.modules.safeParse(course.modules);if(!modules.success)throw fail('Проверьте структуру курса');const count=checkModules(modules.data);if(!count)throw fail('В курсе нет занятий');
  await c.query("UPDATE marketplace_courses SET status='published',total_lessons=$2,rights_confirmed_at=NOW(),rights_confirmed_by=$3,modules=$4,published_at=COALESCE(published_at,NOW()),updated_at=NOW() WHERE id=$1",[course.id,count,req.user.id,JSON.stringify(modules.data)]);
 });res.json({ok:true});
}));
function unitDone(unit,attempt){
 if(!attempt)return false;
 if(unit.type==='quiz')return Number.isFinite(attempt.result?.score)&&attempt.result.score>=(unit.pass_score??70);
 return !attempt.result?.pending_review;
}
function courseProgress(modules,attempts){
 let total=0,completed=0;for(const [mi,m]of modules.entries())for(const [ui,u]of (m.units||[]).entries()){
 total++;if(unitDone(u,attempts.find(a=>a.module_index===mi&&a.unit_index===ui)))completed++;
 }return {total,completed,percent:total?Math.round(completed/total*100):0};
}
router.get('/mine',ah(async(req,res)=>{
 const ids=req.user.role==='tutor'?[]:await accessibleStudentIds(req.user);
 const rows=(await query(`SELECT e.id AS enrollment_id,e.student_id,e.user_id,e.last_module,e.last_unit,e.last_opened_at,p.content_snapshot->>'audience' AS audience,s.full_name AS student_name,p.id AS purchase_id,p.course_id,COALESCE(p.content_snapshot->>'title',c.title) AS title,c.slug,
 COALESCE(p.content_snapshot->'modules',c.modules) AS modules,p.verified_at
 FROM marketplace_enrollments e JOIN course_purchases p ON p.id=e.purchase_id JOIN marketplace_courses c ON c.id=p.course_id LEFT JOIN students s ON s.id=e.student_id
 WHERE p.is_active AND p.verified_at IS NOT NULL AND (p.expires_at IS NULL OR p.expires_at>NOW()) AND (e.user_id=$1 OR e.student_id=ANY($2::int[]) OR ($3 AND p.buyer_id=$1)) ORDER BY COALESCE(e.last_opened_at,e.created_at) DESC`,[req.user.id,ids,req.user.role==='tutor'])).rows;
 const attempts=rows.length?(await query('SELECT enrollment_id,module_index,unit_index,result FROM marketplace_attempts WHERE enrollment_id=ANY($1::int[])',[rows.map(e=>e.enrollment_id)])).rows:[];
 res.json(rows.map(({modules,...e})=>({...e,...courseProgress(Array.isArray(modules)?modules:[],attempts.filter(a=>a.enrollment_id===e.enrollment_id))})));
}));
const buyer=ah(async(req,res,next)=>{if(!await require('../services/course-buyers').canPurchase(req.user))throw fail('Курс может приобрести совершеннолетний пользователь или родитель. Ребёнку курс назначает преподаватель или родитель.',403);next();});
router.post('/courses/:id/enroll',buyer,ah(async(req,res)=>{
 const result=await transaction(async c=>{
  await c.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[req.user.id]);
  const course=(await c.query("SELECT * FROM marketplace_courses WHERE id=$1 AND status='published' AND price_type='free'",[req.params.id])).rows[0];if(!course)throw fail('Курс недоступен',404);
  if(req.user.role!=='tutor'&&course.audience==='tutor')throw fail('Курс предназначен для преподавателей',403);
  let p=(await c.query('SELECT * FROM course_purchases WHERE buyer_id=$1 AND course_id=$2 AND is_active',[req.user.id,course.id])).rows[0];
  if(!p)p=(await c.query(`INSERT INTO course_purchases(course_id,buyer_id,buyer_type,payment_method,amount_paid,currency,verified_at,content_snapshot) VALUES($1,$2,$4,'free',0,'RUB',NOW(),$3) RETURNING *`,[course.id,req.user.id,JSON.stringify({id:course.id,title:course.title,modules:course.modules,version:course.content_version,audience:course.audience}),req.user.role==='tutor'?'tutor':'student'])).rows[0];
  if(!p.verified_at)throw fail('Старая покупка требует сверки с администратором',409);
  const e=(await c.query('INSERT INTO marketplace_enrollments(purchase_id,user_id) VALUES($1,$2) ON CONFLICT(purchase_id,user_id) DO UPDATE SET user_id=EXCLUDED.user_id RETURNING id',[p.id,req.user.id])).rows[0];return e;
 });res.json(result);
}));
router.post('/courses/:id/checkout',buyer,ah(async(req,res)=>res.json(await commerce.checkout(req.user,{...req.body,course_id:Number(req.params.id)},'course',{ip:req.ip}))));
router.post('/purchases/:id/assign',ah(async(req,res)=>{
 if(!['tutor','parent'].includes(req.user.role))throw fail('Назначение доступно преподавателю или родителю',403);
 const student=Number(req.body?.student_id);if(!Number.isInteger(student)||!(await accessibleStudentIds(req.user)).includes(student))throw fail('Ученик не найден',404);
 const e=await transaction(async c=>{
  const p=(await c.query('SELECT * FROM course_purchases WHERE id=$1 AND buyer_id=$2 AND is_active AND verified_at IS NOT NULL AND (expires_at IS NULL OR expires_at>NOW()) FOR UPDATE',[req.params.id,req.user.id])).rows[0];if(!p)throw fail('Покупка не найдена',404);
  if(req.user.role==='tutor'&&p.content_snapshot?.audience==='self')throw fail('Этот курс предназначен для личного самостоятельного обучения',403);
  if(req.user.role==='parent'){
   const child=(await c.query('SELECT * FROM students WHERE id=$1',[student])).rows[0];
   if(child.category!=='adult'&&!await require('../services/guardians').studentStatus(child.id,child.tutor_id))throw fail('Сначала подтвердите документы ребёнка в разделе семьи',403);
   const prior=(await c.query('SELECT student_id FROM marketplace_enrollments WHERE purchase_id=$1 AND student_id IS NOT NULL',[p.id])).rows[0];
   if(prior&&prior.student_id!==student)throw fail('Эта личная покупка уже назначена другому ребёнку',409);
  }
  return (await c.query('INSERT INTO marketplace_enrollments(purchase_id,student_id) VALUES($1,$2) ON CONFLICT(purchase_id,student_id) DO UPDATE SET student_id=EXCLUDED.student_id RETURNING id',[p.id,student])).rows[0];
 });res.json(e);
}));
async function enrollment(user,id){
 const e=(await query(`SELECT e.*,p.buyer_id,p.buyer_type,p.content_snapshot,p.is_active,p.verified_at,p.expires_at FROM marketplace_enrollments e JOIN course_purchases p ON p.id=e.purchase_id WHERE e.id=$1`,[id])).rows[0];
 if(!e||!e.is_active||!e.verified_at||e.expires_at&&new Date(e.expires_at)<=new Date())throw fail('Курс недоступен',404);
 const owns=user.role==='tutor'&&e.buyer_id===user.id,ids=owns?[]:await accessibleStudentIds(user);
 if(!owns && !(e.user_id===user.id || ids.includes(e.student_id)))throw fail('Курс недоступен',404);
 return {...e,teacher:owns,read_only:(user.role==='parent'&&e.user_id!==user.id)||(owns&&!!e.student_id)};
}
const canWrite=e=>{if(e.read_only)throw fail('Задание выполняет ученик',403);};
function unitAt(e,body){const mi=Number(body?.module_index),ui=Number(body?.unit_index),u=Number.isInteger(mi)&&Number.isInteger(ui)&&mi>=0&&ui>=0?e.content_snapshot?.modules?.[mi]?.units?.[ui]:null;if(!u)throw fail('Занятие не найдено',404);return {mi,ui,u};}
router.get('/enrollments/:id',ah(async(req,res)=>{
 const e=await enrollment(req.user,req.params.id),modules=e.content_snapshot?.modules||[];
 const attempts=(await query('SELECT module_index,unit_index,answers,result,response,submitted_at,reviewed_at,comment FROM marketplace_attempts WHERE enrollment_id=$1',[e.id])).rows;
 const drafts=e.read_only?[]:(await query('SELECT module_index,unit_index,answers,response,updated_at FROM marketplace_drafts WHERE enrollment_id=$1',[e.id])).rows;
 const safe=modules.map(m=>({...m,units:m.units.map(u=>u.type==='quiz'?{...u,questions:quiz.hideAnswers(u.questions)}:u)}));
 res.json({id:e.id,title:e.content_snapshot?.title,student_id:e.student_id,teacher:e.teacher,read_only:e.read_only,requires_review:!!e.student_id&&e.buyer_type==='tutor',last_module:e.last_module,last_unit:e.last_unit,modules:safe,attempts,drafts,progress:courseProgress(modules,attempts)});
}));
router.put('/enrollments/:id/position',vb(z.object({module_index:z.number().int().min(0),unit_index:z.number().int().min(0)}).strict()),ah(async(req,res)=>{
 const e=await enrollment(req.user,req.params.id);canWrite(e);const {mi,ui}=unitAt(e,req.body);
 await query('UPDATE marketplace_enrollments SET last_module=$2,last_unit=$3,last_opened_at=NOW() WHERE id=$1',[e.id,mi,ui]);res.json({ok:true});
}));
const draftSchema=z.object({module_index:z.number().int().min(0),unit_index:z.number().int().min(0),answers:z.record(z.string().max(100),z.union([z.string().max(300),z.number().int().min(0).max(7)])).default({}),response:z.string().max(30000).default('')}).strict();
router.put('/enrollments/:id/draft',vb(draftSchema),ah(async(req,res)=>{
 const e=await enrollment(req.user,req.params.id);canWrite(e);const {mi,ui}=unitAt(e,req.body);
 await transaction(async c=>{
 await c.query(`INSERT INTO marketplace_drafts(enrollment_id,module_index,unit_index,answers,response) VALUES($1,$2,$3,$4,$5) ON CONFLICT(enrollment_id,module_index,unit_index) DO UPDATE SET answers=$4,response=$5,updated_at=NOW()`,[e.id,mi,ui,JSON.stringify(req.body.answers),req.body.response]);
 await c.query('UPDATE marketplace_enrollments SET last_module=$2,last_unit=$3,last_opened_at=NOW() WHERE id=$1',[e.id,mi,ui]);
 });res.json({ok:true});
}));
router.post('/enrollments/:id/attempt',vb(draftSchema.strip()),ah(async(req,res)=>{
 const e=await enrollment(req.user,req.params.id);canWrite(e);const {mi,ui,u}=unitAt(e,req.body);
 const answers=req.body.answers,response=req.body.response.trim();
 if(u.type==='assignment'&&!response)throw fail('Добавьте ответ');
 if(u.type==='quiz'&&u.questions.some(q=>answers[q.id]===undefined||String(answers[q.id]).trim()===''))throw fail('Ответьте на все вопросы перед проверкой');
 const result=u.type==='quiz'?{...quiz.grade(u.questions,answers),pass_score:u.pass_score??70}:{completed:true,pending_review:u.type==='assignment'&&!!e.student_id&&e.buyer_type==='tutor'};
 if(u.type==='quiz')result.completed=result.score>=result.pass_score;
 await transaction(async c=>{
 await c.query(`INSERT INTO marketplace_attempts(enrollment_id,module_index,unit_index,answers,result,response) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(enrollment_id,module_index,unit_index) DO UPDATE SET answers=$4,result=$5,response=$6,submitted_at=NOW(),reviewed_at=NULL,comment=NULL`,[e.id,mi,ui,JSON.stringify(answers),JSON.stringify(result),response]);
 await c.query('DELETE FROM marketplace_drafts WHERE enrollment_id=$1 AND module_index=$2 AND unit_index=$3',[e.id,mi,ui]);
 await c.query('UPDATE marketplace_enrollments SET last_module=$2,last_unit=$3,last_opened_at=NOW() WHERE id=$1',[e.id,mi,ui]);
 });res.json(result);
}));
router.post('/enrollments/:id/review',author,ah(async(req,res)=>{
 const e=await enrollment(req.user,req.params.id);if(!e.teacher||!e.student_id)throw fail('Недостаточно прав',403);
 const comment=String(req.body?.comment||'').trim().slice(0,5000);if(!comment)throw fail('Добавьте комментарий');
 const a=await query(`UPDATE marketplace_attempts SET comment=$4,reviewed_at=NOW(),result=COALESCE(result,'{}'::jsonb)||'{"pending_review":false}'::jsonb WHERE enrollment_id=$1 AND module_index=$2 AND unit_index=$3 RETURNING id`,[e.id,Number(req.body.module_index),Number(req.body.unit_index),comment]);if(!a.rowCount)throw fail('Ответ не найден',404);res.json({ok:true});
}));
module.exports={router,publicRouter,outline,checkModules,courseProgress,unitDone};
