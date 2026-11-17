'use strict';
const express=require('express'),{z}=require('zod'),rateLimit=require('express-rate-limit');
const {query}=require('../db'),{requireRole,requireStudentAccess,canAccessStudent}=require('../middleware/auth'),{asyncHandler,validateBody}=require('../middleware/validate');
const d=require('../learning/diagnostics'),coach=require('../learning/coaching'),planner=require('../learning/lesson-planner');
const router=express.Router(),tutor=requireRole('tutor'),student=requireRole('student');
router.use('/students/:studentId',asyncHandler(async(req,res,next)=>{const own=await query('SELECT 1 FROM students WHERE id=$1 AND tutor_id=$2',[Number(req.params.studentId)||0,req.user.tid]);if(!own.rowCount)return res.status(404).json({error:'Ученик не найден'});next();}));
const num=v=>{v=Number(v);if(!Number.isInteger(v)||v<1||v>2147483647)throw Object.assign(Error('Некорректный номер'),{status:400});return v;};
const uuid=v=>{if(!z.string().uuid().safeParse(v).success)throw Object.assign(Error('Некорректный номер черновика'),{status:400});return v;};
router.get('/students/:studentId',requireStudentAccess(),asyncHandler(async(req,res)=>res.json(await coach.profile(req.studentId))));
router.post('/students/:studentId/reviews',requireRole('tutor','student'),requireStudentAccess(),validateBody(z.object({topic_id:d.topicKey}).strict()),asyncHandler(async(req,res)=>res.json(await coach.start(req.studentId,req.body.topic_id,req.user))));
router.get('/reviews/:id',asyncHandler(async(req,res)=>{
 const r=await coach.loadReview(num(req.params.id));if(!r||!await canAccessStudent(req.user,r.student_id)||!(await query('SELECT 1 FROM students WHERE id=$1 AND tutor_id=$2',[r.student_id,req.user.tid])).rowCount)return res.status(404).json({error:'Повторение не найдено'});res.json(await coach.viewReview(r,req.user.role));
}));
router.post('/reviews/:id/submit',student,validateBody(z.object({answers:d.answers}).strict()),asyncHandler(async(req,res)=>{
 const r=await coach.loadReview(num(req.params.id));if(!r||!await canAccessStudent(req.user,r.student_id)||!(await query('SELECT 1 FROM students WHERE id=$1 AND tutor_id=$2',[r.student_id,req.user.tid])).rowCount)return res.status(404).json({error:'Повторение не найдено'});res.json(await coach.submit(r.id,r.student_id,req.body.answers));
}));
router.get('/materials/:id/topic',tutor,asyncHandler(async(req,res)=>{
 const id=num(req.params.id),{rows:[i]}=await query('SELECT grammar_key FROM library_items WHERE id=$1 AND tutor_id=$2',[id,req.user.id]);if(!i)return res.status(404).json({error:'Материал не найден'});
 res.json({topic_id:i.grammar_key,effective_topic_id:await coach.libraryTopic(id)});
}));
router.put('/materials/:id/topic',tutor,validateBody(z.object({topic_id:d.topicKey.nullable()}).strict()),asyncHandler(async(req,res)=>{
 const {rows:[i]}=await query("UPDATE library_items SET grammar_key=$3,updated_at=NOW() WHERE id=$1 AND tutor_id=$2 AND kind='game' RETURNING id,grammar_key",[num(req.params.id),req.user.id,req.body.topic_id]);if(!i)return res.status(404).json({error:'Упражнение не найдено'});res.json(i);
}));
router.get('/students/:studentId/preparations',tutor,requireStudentAccess(),asyncHandler(async(req,res)=>res.json(await planner.options(req.studentId,req.user.id))));
const previewLimit=rateLimit({windowMs:3600000,limit:60,standardHeaders:true,legacyHeaders:false,keyGenerator:req=>'u'+req.user.id,message:{error:'Слишком много черновиков. Продолжите работу с уже созданными.'}});
router.post('/students/:studentId/preparations',tutor,requireStudentAccess(),previewLimit,validateBody(z.object({duration:z.number().int().min(20).max(120),topic_ids:z.array(d.topicKey).max(2).default([])}).strict()),asyncHandler(async(req,res)=>res.status(201).json(await planner.prepare(req.user.id,req.studentId,req.body))));
router.get('/preparations/:id',tutor,asyncHandler(async(req,res)=>res.json(await planner.get(uuid(req.params.id),req.user.id))));
const stage=z.object({id:z.string().min(1).max(30),title:z.string().trim().min(1).max(255),minutes:z.number().int().min(1).max(120),selected:z.boolean(),note:z.string().max(3000),material_id:z.number().int().positive().nullable(),body:z.string().max(12000).optional()}).strict();
router.patch('/preparations/:id',tutor,validateBody(z.object({version:z.number().int().positive(),title:z.string().trim().min(1).max(255),stages:z.array(stage).min(1).max(10)}).strict()),asyncHandler(async(req,res)=>{await planner.update(uuid(req.params.id),req.user.id,req.body);res.json(await planner.get(req.params.id,req.user.id));}));
router.post('/preparations/:id/apply',tutor,validateBody(z.object({version:z.number().int().positive(),lesson_id:z.number().int().positive()}).strict()),asyncHandler(async(req,res)=>res.json(await planner.apply(uuid(req.params.id),req.user.id,req.body))));
module.exports=router;
