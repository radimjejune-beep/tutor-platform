// Подписка преподавателя: ЮKassa и журнал собственных покупок.
const express=require('express');
const {asyncHandler:ah}=require('../middleware/validate');
const commerce=require('../../lessonfold/src/commerce');
const router=express.Router();
router.use((req,res,next)=>req.user.role==='tutor'?next():res.status(403).json({error:'Только для преподавателя'}));
router.get('/',ah(async(req,res)=>res.json(await commerce.status(req.user.id))));
router.post('/checkout',ah(async(req,res)=>res.json(await commerce.checkout(req.user,req.body||{},'subscription',{ip:req.ip}))));
router.post('/cancel-renewal',ah(async(req,res)=>res.json(await commerce.cancel(req.user.id))));
router.post('/orders/:id/sync',ah(async(req,res)=>{
 const o=await require('../../lessonfold/src/orders').byId(req.params.id);
 if(!o||o.platform_user_id!==req.user.id)return res.status(404).json({error:'Заказ не найден'});
 if(o.status==='pending'&&!o.yk_payment_id)return res.json(await commerce.beginPayment(o,!!o.payload?.renewal));
 const updated=await require('../../lessonfold/src/orders').sync(o);res.json(commerce.dto(updated));
}));
module.exports=router;
