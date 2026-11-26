const express=require('express'),{z}=require('zod'),{createHash}=require('crypto');
const {query,transaction}=require('../db'),{requireRole,accessibleStudentIds}=require('../middleware/auth'),{validateBody,asyncHandler}=require('../middleware/validate');
const catalog=require('../learning/grammar'),{contentOf}=require('../learning/grammar-content'),subjects=require('../learning/study-subjects'),storage=require('../services/storage');
const router=express.Router();router.use(express.json({limit:'256kb'}));
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const id=z.coerce.number().int().positive();const parse=(schema,v)=>{const r=schema.safeParse(v);if(!r.success)fail(422,r.error.issues[0]?.message||'Проверьте поля записи');return r.data;};
const cell=z.string().max(2000),blocks=z.array(z.discriminatedUnion('type',[
 z.object({type:z.literal('heading'),text:z.string().trim().min(1,'Заполните заголовок блока').max(300)}).strict(),
 z.object({type:z.literal('paragraph'),text:z.string().max(6000)}).strict(),
 z.object({type:z.literal('table'),headers:z.array(z.string().trim().min(1,'Заполните заголовок столбца').max(120)).min(1).max(6),rows:z.array(z.array(cell).min(1).max(6)).min(1).max(30)}).strict().refine(b=>b.rows.every(r=>r.length===b.headers.length),'В каждой строке должно быть столько ячеек, сколько заголовков'),
 z.object({type:z.literal('scheme'),items:z.array(z.string().trim().min(1,'Заполните каждый шаг схемы').max(1000)).min(1).max(12)}).strict(),
])).min(1).max(60).refine(v=>JSON.stringify(v).length<=80000,'Слишком большая запись');
const fields={title:z.string().trim().min(1,'Укажите название записи').max(200),content:blocks,published:z.boolean().default(false)};
const base=z.object({...fields,subject:z.string().trim().min(1).max(255),student_id:z.number().int().positive().nullable().default(null),source_topic_id:z.string().max(80).nullable().optional(),request_key:z.string().uuid()}).strict();
async function access(user,n,db={query},lock=false){
 const {rows:[page]}=await db.query(`SELECT p.*,s.full_name AS student_name FROM grammar_notebook_pages p LEFT JOIN students s ON s.id=p.student_id WHERE p.id=$1 ${lock?'FOR UPDATE OF p':''}`,[n]);
 if(!page)fail(404,'Запись не найдена');
 if(user.role==='tutor'){if(page.tutor_id!==user.id)fail(404,'Запись не найдена');}
 else if(!['student','parent'].includes(user.role)||!page.published||!page.student_id||!(await accessibleStudentIds(user)).includes(page.student_id))fail(404,'Запись не найдена');
 return page;
}
router.get('/',asyncHandler(async(req,res)=>{
 const q=parse(z.object({student_id:id.optional(),subject:z.string().max(255).optional(),templates:z.enum(['1']).optional(),q:z.string().max(200).default(''),page:z.coerce.number().int().min(1).max(10000).default(1)}).strict(),req.query);
 let ids=null;if(req.user.role!=='tutor'){if(!['student','parent'].includes(req.user.role))return res.status(403).json({error:'Тетрадь доступна ученикам и преподавателям'});ids=await accessibleStudentIds(req.user);if(q.templates)fail(403,'Шаблоны доступны преподавателю');if(q.student_id&&!ids.includes(q.student_id))fail(404,'Ученик не найден');}
 const {rows}=await query(`SELECT p.id,p.title,p.subject,p.student_id,p.source_topic_id,p.published,p.version,p.updated_at,s.full_name AS student_name,COUNT(*) OVER()::int AS total_count,
 (SELECT count(*)::int FROM files f WHERE f.grammar_page_id=p.id) AS file_count
 FROM grammar_notebook_pages p LEFT JOIN students s ON s.id=p.student_id
 WHERE ($1::int IS NOT NULL AND p.tutor_id=$1 OR $1::int IS NULL AND p.published AND p.student_id=ANY($2::int[]))
 AND ($3::int IS NULL OR p.student_id=$3) AND ($4::text IS NULL OR p.subject=$4)
 AND (NOT $5::boolean OR p.student_id IS NULL)
 AND ($6='' OR lower(p.title) LIKE '%'||lower($6)||'%') ORDER BY p.updated_at DESC,p.id DESC LIMIT 30 OFFSET $7`,[req.user.role==='tutor'?req.user.id:null,ids,q.student_id||null,q.subject||null,Boolean(q.templates),q.q,(q.page-1)*30]);
 let total=rows[0]?.total_count||0;
 if(!rows.length&&q.page>1){return res.status(422).json({error:'Страница пуста. Вернитесь к первой странице тетради.'});}
 res.json({items:rows.map(({total_count,...p})=>p),total,page:q.page,pages:Math.ceil(total/30)});
}));
router.get('/source/:topic',requireRole('tutor'),asyncHandler(async(req,res)=>{const t=catalog.byId.get(req.params.topic);if(!t)fail(404,'Тема не найдена');res.json({title:t.title,subject:t.subject,source_topic_id:t.id,content:contentOf(t)});}));
router.get('/:id',asyncHandler(async(req,res)=>{const p=await access(req.user,parse(id,req.params.id));const {rows:files}=await query('SELECT id,filename,mime,size_bytes,created_at FROM files WHERE grammar_page_id=$1 ORDER BY id',[p.id]);const {request_hash,request_key,...safe}=p;res.json({...safe,files});}));
router.post('/',requireRole('tutor'),validateBody(base),asyncHandler(async(req,res)=>{
 const b=req.body;if(!b.student_id&&b.published)fail(422,'Шаблон не публикуется ученику');
 if(b.source_topic_id&&catalog.byId.get(b.source_topic_id)?.subject!==b.subject)fail(422,'Выберите объяснение того же предмета');
 const hash=createHash('sha256').update(JSON.stringify(b)).digest('hex');
 const out=await transaction(async db=>{
  const old=(await db.query('SELECT id,request_hash FROM grammar_notebook_pages WHERE tutor_id=$1 AND request_key=$2',[req.user.id,b.request_key])).rows[0];
  if(old){if(old.request_hash!==hash)fail(409,'Этот запрос уже сохранил другую запись');return {id:old.id,again:true};}
  if(b.student_id){const own=(await db.query('SELECT id FROM students WHERE id=$1 AND tutor_id=$2 FOR KEY SHARE',[b.student_id,req.user.id])).rows[0];if(!own)fail(404,'Ученик не найден');await subjects.resolve(b.student_id,req.user.id,b.subject,db);}
  const {rows}=await db.query(`INSERT INTO grammar_notebook_pages(tutor_id,student_id,subject,title,content,source_topic_id,published,request_key,request_hash)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(tutor_id,request_key) WHERE request_key IS NOT NULL DO NOTHING RETURNING id`,[req.user.id,b.student_id,b.subject,b.title,JSON.stringify(b.content),b.source_topic_id||null,b.published,b.request_key,hash]);
  if(rows[0])return {...rows[0],again:false};
  const r=(await db.query('SELECT id,request_hash FROM grammar_notebook_pages WHERE tutor_id=$1 AND request_key=$2',[req.user.id,b.request_key])).rows[0];if(r.request_hash!==hash)fail(409,'Этот запрос уже сохранил другую запись');return {id:r.id,again:true};
 });res.status(out.again?200:201).json(out);
}));
router.patch('/:id',requireRole('tutor'),validateBody(z.object({...fields,version:z.number().int().positive()}).strict()),asyncHandler(async(req,res)=>{
 const n=parse(id,req.params.id),p=await access(req.user,n),b=req.body;if(!p.student_id&&b.published)fail(422,'Шаблон не публикуется ученику');
 const {rows}=await query('UPDATE grammar_notebook_pages SET title=$1,content=$2,published=$3,version=version+1,updated_at=NOW() WHERE id=$4 AND tutor_id=$5 AND version=$6 RETURNING id,version',[b.title,JSON.stringify(b.content),b.published,n,req.user.id,b.version]);if(!rows[0])fail(409,'Запись изменена в другой вкладке. Сохраните свой текст отдельно и обновите страницу.');res.json(rows[0]);
}));
router.post('/:id/copy',requireRole('tutor'),validateBody(z.object({student_id:z.number().int().positive().nullable(),subject:z.string().trim().min(1).max(255),request_key:z.string().uuid()}).strict()),asyncHandler(async(req,res)=>{
 const n=parse(id,req.params.id),b=req.body,hash=createHash('sha256').update(JSON.stringify({source:n,...b})).digest('hex');
 const out=await transaction(async db=>{
  const p=await access(req.user,n,db,true);if(b.subject!==p.subject)fail(422,'Копия сохраняет предмет исходной записи');
  const old=(await db.query('SELECT id,request_hash FROM grammar_notebook_pages WHERE tutor_id=$1 AND request_key=$2',[req.user.id,b.request_key])).rows[0];if(old){if(old.request_hash!==hash)fail(409,'Этот запрос уже сохранил другую запись');return {id:old.id,again:true};}
  if(b.student_id){const s=(await db.query('SELECT id FROM students WHERE id=$1 AND tutor_id=$2 FOR KEY SHARE',[b.student_id,req.user.id])).rows[0];if(!s)fail(404,'Ученик не найден');await subjects.resolve(b.student_id,req.user.id,b.subject,db);}
  const {rows:[copy]}=await db.query(`INSERT INTO grammar_notebook_pages(tutor_id,student_id,subject,title,content,source_topic_id,request_key,request_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(tutor_id,request_key) WHERE request_key IS NOT NULL DO NOTHING RETURNING id`,[req.user.id,b.student_id,b.subject,p.title,JSON.stringify(p.content),p.source_topic_id,b.request_key,hash]);
  if(!copy){const old=(await db.query('SELECT id,request_hash FROM grammar_notebook_pages WHERE tutor_id=$1 AND request_key=$2',[req.user.id,b.request_key])).rows[0];if(old.request_hash!==hash)fail(409,'Этот запрос уже сохранил другую запись');return {id:old.id,again:true};}
  await db.query(`INSERT INTO files(grammar_page_id,filename,mime,size_bytes,data,s3_key,uploaded_by) SELECT $1,filename,mime,size_bytes,data,s3_key,$2 FROM files WHERE grammar_page_id=$3`,[copy.id,req.user.id,n]);return {...copy,again:false};
 });res.status(out.again?200:201).json(out);
}));
router.delete('/:id',requireRole('tutor'),asyncHandler(async(req,res)=>{
 const n=parse(id,req.params.id),version=parse(z.coerce.number().int().positive(),req.query.version);const keys=await transaction(async db=>{const p=await access(req.user,n,db,true);if(p.version!==version)fail(409,'Запись изменена в другой вкладке. Обновите страницу перед удалением.');const {rows}=await db.query('SELECT s3_key FROM files WHERE grammar_page_id=$1',[n]);await db.query('DELETE FROM grammar_notebook_pages WHERE id=$1 AND tutor_id=$2',[n,req.user.id]);return rows.map(x=>x.s3_key);});await storage.release(keys);res.json({ok:true});
}));
module.exports=router;module.exports.contentSchema=blocks;
