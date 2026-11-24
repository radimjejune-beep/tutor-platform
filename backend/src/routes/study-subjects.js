const router=require('express').Router(),{z}=require('zod');
const {requireRole,requireStudentAccess}=require('../middleware/auth'),{asyncHandler,validateBody}=require('../middleware/validate'),subjects=require('../learning/study-subjects');
router.get('/students/:studentId/subjects',requireStudentAccess(),asyncHandler(async(req,res)=>res.json(await subjects.list(req.studentId,req.user.tid))));
router.post('/students/:studentId/subjects',requireRole('tutor'),requireStudentAccess(),validateBody(z.object({subject:z.string().trim().min(1).max(100)}).strict()),asyncHandler(async(req,res)=>res.json(await subjects.add(req.studentId,req.user.id,req.body.subject))));
module.exports=router;
