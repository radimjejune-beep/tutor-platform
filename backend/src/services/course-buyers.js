'use strict';
const {query}=require('../db');
// Existing adult students may buy for themselves; child accounts cannot grant this flag.
async function canPurchase(user,db={query}){
 if(['tutor','learner','parent'].includes(user.role))return true;
 if(user.role!=='student')return false;
 return Boolean((await db.query("SELECT 1 FROM public.students WHERE user_id=$1 AND category='adult' AND status<>'archived'",[user.id])).rowCount);
}
module.exports={canPurchase};
