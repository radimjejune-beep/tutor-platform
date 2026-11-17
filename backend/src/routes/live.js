'use strict';
const express=require('express'),{z}=require('zod');
const {requireRole,authenticate}=require('../middleware/auth'),{validateBody,asyncHandler}=require('../middleware/validate');
const live=require('../learning/live'),hub=require('../learning/live-hub');
const router=express.Router(),tutor=requireRole('tutor'),student=requireRole('student');
const num=n=>{n=Number(n);if(!Number.isInteger(n)||n<1||n>2147483647)throw Object.assign(Error('Некорректный номер'),{status:400});return n;};
router.get('/lessons/:id',asyncHandler(async(req,res)=>res.json(await live.state(req.user,num(req.params.id)))));
router.post('/lessons/:id/start',tutor,validateBody(z.object({item_id:z.number().int().positive(),request_key:z.string().uuid()}).strict()),asyncHandler(async(req,res)=>res.json(await live.start(req.user,num(req.params.id),req.body.item_id,req.body.request_key))));
router.post('/lessons/:id/end',tutor,validateBody(z.object({session_id:z.number().int().positive()}).strict()),asyncHandler(async(req,res)=>res.json(await live.end(req.user,num(req.params.id),req.body.session_id))));
const answerSchema=z.object({answers:z.record(z.string(),z.unknown()),expected_revision:z.number().int().min(0).max(2147483646),client_id:z.string().uuid(),duration_sec:z.number().int().min(0).max(86400).optional()}).strict();
for(const action of ['draft','submit'])router.put(`/lessons/:id/sessions/:sessionId/${action}`,student,validateBody(answerSchema),asyncHandler(async(req,res)=>{
 try{res.json(await live.save(req.user,num(req.params.id),num(req.params.sessionId),req.body,action==='submit'));}catch(e){if(e.current)return res.status(409).json({error:e.message,current:e.current});throw e;}
}));
const streams=new Map();
async function currentUser(headers){
 let user,error,passed=false;const fake={headers};
 await authenticate(fake,{status(n){this.code=n;return this;},json(b){error=Object.assign(Error(b.error),{status:this.code});return this;}},e=>{error=e;passed=true;user=fake.user;});
 if(error)throw error;if(!passed||!user)throw Object.assign(Error('Войдите снова'),{status:401});if(user.must_change_password)throw Object.assign(Error('Смените временный пароль'),{status:403});await require('../services/guardians').assertAllowed(user);return user;
}
router.get('/lessons/:id/stream',asyncHandler(async(req,res)=>{
 const id=num(req.params.id),sc=await live.scope(req.user,id),uid=req.user.id;
 if((streams.get(uid)||0)>=4||[...streams.values()].reduce((a,b)=>a+b,0)>=300)return res.status(429).json({error:'Закройте лишние вкладки комнаты урока'});
 streams.set(uid,(streams.get(uid)||0)+1);let closed=false,timer,unsubscribe,previous='',busy=false,again=false;
 res.status(200).set({'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});res.flushHeaders();res.write(': connected\n\n');
 const cleanup=()=>{if(closed)return;closed=true;clearInterval(timer);unsubscribe?.();const n=(streams.get(uid)||1)-1;if(n)streams.set(uid,n);else streams.delete(uid);};
 res.on('close',cleanup);
 const refresh=async()=>{if(closed)return;if(busy){again=true;return;}busy=true;try{
   const user=await currentUser(req.headers);await live.touch(user,id);const next=await live.state(user,id),encoded=JSON.stringify(next);
   if(res.writableLength>2e6){cleanup();res.end();return;}
   if(!closed&&encoded!==previous){previous=encoded;res.write(`event: snapshot\ndata: ${encoded}\n\n`);}
  }catch(e){if(!closed){res.write(`event: access-error\ndata: ${JSON.stringify({error:e.status?e.message:'Связь с сервером прервана',status:e.status||503})}\n\n`);cleanup();res.end();}}
  finally{busy=false;if(again&&!closed){again=false;refresh();}}
 };
 unsubscribe=await hub.subscribe(sc.anchor,refresh);if(closed){unsubscribe();return;}
 await refresh();if(closed)return;
 timer=setInterval(()=>{if(!closed){res.write(': heartbeat\n\n');refresh();}},5000);timer.unref();
}));
module.exports=router;
