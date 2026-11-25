// Изолированный показ и доступ по отключаемой ссылке. Публичный ответ собирается
// из разрешённых полей; задания, ученики, платежи и заметки учителя сюда не входят.
const express=require('express');
const {randomBytes}=require('crypto');
const {query}=require('../db');
const {requireRole}=require('../middleware/auth');
const {asyncHandler}=require('../middleware/validate');
const deck=require('../services/deck');
const {bookById}=require('../bank/books');
const storage=require('../services/storage');
const router=express.Router(),publicRouter=express.Router();
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
function source(req){const kind=req.params.source,id=Number(req.params.id);if(!['library','bank'].includes(kind)||!Number.isSafeInteger(id)||id<=0)fail(404,'Материал не найден');return {kind,id};}
async function itemFor(kind,id,tutorId){
 const sql=kind==='library'?`SELECT id,kind,subject,title,body,links,game,html FROM library_items WHERE id=$1 AND tutor_id=$2`:
  `SELECT id,kind,title,body,game,book FROM bank_items WHERE id=$1 AND NOT hidden`;
 const {rows}=await query(sql,kind==='library'?[id,tutorId]:[id]);
 if(!rows[0])fail(404,'Материал не найден');
 const {book,...safe}=rows[0];
 const item=deck.forStudent(kind==='bank'?{...safe,subject:bookById(book)?.subject||'Английский язык'}:safe);
 const files=kind==='library'?(await query('SELECT id,filename,mime,size_bytes FROM files WHERE library_item_id=$1 ORDER BY id',[id])).rows:[];
 return {...item,files};
}
router.use(requireRole('tutor'));
router.get('/:source/:id',asyncHandler(async(req,res)=>{
 const {kind,id}=source(req);await itemFor(kind,id,req.user.id);
 const {rows}=await query('SELECT token FROM activity_links WHERE tutor_id=$1 AND source_kind=$2 AND source_id=$3 AND is_active',[req.user.id,kind,id]);
 res.json({token:rows[0]?.token||null});
}));
router.post('/:source/:id',asyncHandler(async(req,res)=>{
 const {kind,id}=source(req);await itemFor(kind,id,req.user.id);
 const {rows}=await query(`INSERT INTO activity_links(tutor_id,source_kind,source_id,token) VALUES($1,$2,$3,$4)
 ON CONFLICT(tutor_id,source_kind,source_id) DO UPDATE SET token=CASE WHEN activity_links.is_active THEN activity_links.token ELSE EXCLUDED.token END,is_active=true,updated_at=NOW() RETURNING token`,[req.user.id,kind,id,randomBytes(32).toString('hex')]);
 res.json({token:rows[0].token});
}));
router.delete('/:source/:id',asyncHandler(async(req,res)=>{
 const {kind,id}=source(req);
 await query('UPDATE activity_links SET is_active=false,updated_at=NOW() WHERE tutor_id=$1 AND source_kind=$2 AND source_id=$3',[req.user.id,kind,id]);res.json({ok:true});
}));
publicRouter.use((req,res,next)=>{res.set({'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer'});next();});
async function linked(req){
 const token=req.params.token;if(!/^[a-f0-9]{64}$/.test(token||''))fail(404,'Ссылка недоступна или отключена');
 const {rows}=await query(`SELECT l.source_kind,l.source_id,l.tutor_id FROM activity_links l JOIN users u ON u.id=l.tutor_id
 WHERE l.token=$1 AND l.is_active AND u.role='tutor' AND u.is_active`,[token]);
 if(!rows[0])fail(404,'Ссылка недоступна или отключена');
 const link=rows[0],item=await itemFor(link.source_kind,link.source_id,link.tutor_id);return {link,item};
}
publicRouter.get('/:token',asyncHandler(async(req,res)=>res.json((await linked(req)).item)));
publicRouter.get('/:token/files/:fileId',asyncHandler(async(req,res)=>{
 const {link,item}=await linked(req),fid=Number(req.params.fileId);
 if(link.source_kind!=='library'||!Number.isSafeInteger(fid)||!item.files.some(f=>f.id===fid))fail(404,'Файл не найден');
 const {rows:[file]}=await query('SELECT * FROM files WHERE id=$1 AND library_item_id=$2',[fid,link.source_id]);if(!file)fail(404,'Файл не найден');
 const inline=/^(image\/(png|jpeg|webp|gif)|audio\/(mpeg|mp4|ogg|wav|webm|x-m4a)|video\/(mp4|webm)|application\/pdf)$/.test(file.mime);
 res.set({'Content-Type':inline?file.mime:'application/octet-stream','Content-Disposition':`${inline?'inline':'attachment'}; filename*=UTF-8''${encodeURIComponent(file.filename)}`});
 res.send(await storage.read(file));
}));
module.exports={router,publicRouter};
