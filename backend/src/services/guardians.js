'use strict';
const {query}=require('../db');
const KINDS=['offer','privacy','consent_parent'];
async function status(user,db={query}) {
 if(user.role==='tutor')return {can_use:true,mode:'tutor',children:[]};
 const {rows:docs}=await db.query('SELECT DISTINCT ON(kind) id,kind,version FROM legal_documents WHERE tutor_id=$1 AND kind=ANY($2::varchar[]) ORDER BY kind,version DESC,id DESC',[user.tid,KINDS]);
 let children=[];
 if(user.role==='student')children=(await db.query("SELECT id,full_name,category FROM students WHERE user_id=$1 AND tutor_id=$2 AND category<>'adult'",[user.id,user.tid])).rows;
 else children=(await db.query("SELECT s.id,s.full_name,s.category FROM students s JOIN parent_students ps ON ps.student_id=s.id WHERE ps.parent_user_id=$1 AND s.tutor_id=$2 AND s.category<>'adult' AND s.status<>'archived' ORDER BY s.full_name",[user.id,user.tid])).rows;
 if(!children.length)return {can_use:true,mode:user.role,children:[],docs};
 const {rows:accepted}=await db.query(`SELECT a.student_id,a.parent_user_id,array_agg(DISTINCT a.document_id) AS ids FROM guardian_acceptances a
 JOIN parent_students ps ON ps.student_id=a.student_id AND ps.parent_user_id=a.parent_user_id JOIN users u ON u.id=a.parent_user_id
 WHERE a.student_id=ANY($1::int[]) AND a.document_id=ANY($2::int[]) AND a.revoked_at IS NULL AND u.role='parent' AND u.is_active AND u.tutor_id=$3
 GROUP BY a.student_id,a.parent_user_id`,[children.map(s=>s.id),docs.map(d=>d.id),user.tid]);
 children=children.map(s=>({...s,confirmed:docs.length===3&&accepted.some(a=>a.student_id===s.id&&(user.role==='student'||a.parent_user_id===user.id)&&docs.every(d=>a.ids.includes(d.id)))}));
 return {can_use:children.every(s=>s.confirmed),mode:user.role,children,docs};
}
async function studentStatus(studentId,tutorId){
 const {rows:docs}=await query('SELECT DISTINCT ON(kind) id FROM legal_documents WHERE tutor_id=$1 AND kind=ANY($2::varchar[]) ORDER BY kind,version DESC,id DESC',[tutorId,KINDS]);
 if(docs.length!==3)return false;
 const {rows}=await query(`SELECT a.parent_user_id FROM guardian_acceptances a JOIN parent_students ps ON ps.parent_user_id=a.parent_user_id AND ps.student_id=a.student_id JOIN users u ON u.id=a.parent_user_id
 WHERE a.student_id=$1 AND a.document_id=ANY($2::int[]) AND a.revoked_at IS NULL AND u.tutor_id=$3 AND u.role='parent' AND u.is_active GROUP BY a.parent_user_id HAVING count(DISTINCT a.document_id)=3 LIMIT 1`,[studentId,docs.map(d=>d.id),tutorId]);
 return Boolean(rows.length);
}
async function assertAllowed(user){const s=await status(user);if(!s.can_use)throw Object.assign(Error(user.role==='student'?'Родителю необходимо подтвердить документы в своём аккаунте':'Подтвердите документы за детей в разделе «Семья и согласия»'),{status:403,code:'GUARDIAN_CONSENT_REQUIRED'});}
async function middleware(req,res,next){
 if(req.path==='/legal'||req.path.startsWith('/legal/'))return next();
 try{await assertAllowed(req.user);next();}catch(e){if(e.status===403)return res.status(403).json({error:e.message,code:e.code});next(e);}
}
module.exports={studentStatus,status,assertAllowed,middleware,KINDS};
