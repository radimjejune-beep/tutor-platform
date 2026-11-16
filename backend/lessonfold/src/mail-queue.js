'use strict';
// Долговечная очередь сервисных писем. Несколько процессов используют SKIP LOCKED;
// письмо повторяется после сбоя. SMTP не обеспечивает строго однократную доставку.
const {randomUUID,createHash}=require('crypto');
const db=require('./db'),mail=require('./mail'),{config}=require('./config');
async function ensure(){
 await db.q(`CREATE TABLE IF NOT EXISTS order_mail_jobs(
  id TEXT PRIMARY KEY,order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('paid','release','resend','restore')),extra TEXT,recipient TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,next_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lease UUID,lease_until TIMESTAMPTZ,sent_at TIMESTAMPTZ,canceled_at TIMESTAMPTZ,last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
  CREATE INDEX IF NOT EXISTS order_mail_jobs_order_idx ON order_mail_jobs(order_id);
  CREATE INDEX IF NOT EXISTS order_mail_jobs_pending ON order_mail_jobs(next_at) WHERE sent_at IS NULL AND canceled_at IS NULL;`);
 // Восстановление писем об оплаченных покупках, которые раньше не удалось отправить.
 await db.q(`INSERT INTO order_mail_jobs(id,order_id,kind) SELECT 'paid:'||id,id,'paid' FROM orders
  WHERE status='paid' AND email<>'' AND emailed_at IS NULL ON CONFLICT DO NOTHING`);
}
async function enqueue(order,kind,extra){
 const id=kind==='paid'?`paid:${order.id}`:kind==='release'?`release:${order.id}:${extra}`:`resend:${randomUUID()}`;
 await db.q('INSERT INTO order_mail_jobs(id,order_id,kind,extra) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[id,order.id,kind,extra||null]);
 return id;
}
async function restore(email){
 const id=`restore:${createHash('sha256').update(email).digest('hex')}:${Math.floor(Date.now()/300000)}`;
 await db.q("INSERT INTO order_mail_jobs(id,kind,recipient) VALUES($1,'restore',$2) ON CONFLICT DO NOTHING",[id,email]);
 return id;
}
async function flush({orderId=null,jobId=null}={}){
 if(!config.mailEnabled)return {sent:0,failed:0};
 const lease=randomUUID();
 const {rows:jobs}=await db.q(`WITH picked AS(SELECT id FROM order_mail_jobs WHERE sent_at IS NULL AND canceled_at IS NULL
   AND attempts<12 AND next_at<=NOW() AND (lease_until IS NULL OR lease_until<NOW())
   AND ($1::text IS NULL OR order_id=$1) AND ($2::text IS NULL OR id=$2) ORDER BY next_at,id LIMIT 10 FOR UPDATE SKIP LOCKED)
  UPDATE order_mail_jobs j SET lease=$3,lease_until=NOW()+INTERVAL '2 minutes',attempts=j.attempts+1
  FROM picked WHERE j.id=picked.id RETURNING j.*`,[orderId,jobId,lease]);
 let sent=0,failed=0;
 for(const job of jobs){
  let order,to,message;
  try{
   if(job.kind==='restore'){
    const {rows}=await db.q("SELECT * FROM orders WHERE lower(email)=$1 AND status='paid' ORDER BY paid_at DESC LIMIT 50",[job.recipient]);
    if(rows.length){to=job.recipient;message=require('./orders').restoreLetter(rows);}
   }else{
    order=(await db.q('SELECT * FROM orders WHERE id=$1',[job.order_id])).rows[0];
    if(order?.status==='paid'&&order.email){to=order.email;message=require('./orders').letter(job.kind,order,job.extra);}
   }
   if(!message){await db.q('UPDATE order_mail_jobs SET canceled_at=NOW(),lease=NULL,lease_until=NULL WHERE id=$1 AND lease=$2',[job.id,lease]);continue;}
   const attachments=order?await require('./orders').attachmentsFor(order):[];
   if(attachments.length){message={...message,text:message.text+'\n\nК письму приложен PDF для преподавателя. Все файлы доступны по ссылке на заказ.',html:message.html+'<p>К письму приложен PDF для преподавателя. Все файлы доступны на странице заказа.</p>'};}
   const r=await mail.send({to,...message,attachments});if(!r.sent)throw Error(r.error||'Почтовый сервер не принял письмо');
   await db.q(`WITH done AS(UPDATE order_mail_jobs SET sent_at=NOW(),last_error=NULL,lease=NULL,lease_until=NULL WHERE id=$1 AND lease=$2 RETURNING order_id)
    UPDATE orders SET emailed_at=NOW(),mail_error=NULL WHERE id IN(SELECT order_id FROM done)`,[job.id,lease]);sent++;
  }catch(e){
   const error=String(e.message||e).slice(0,1000);failed++;
   await db.q(`WITH failed AS(UPDATE order_mail_jobs SET last_error=$3,lease=NULL,lease_until=NULL,
     next_at=NOW()+LEAST(21600,60*POWER(2,LEAST(attempts,8)))::double precision*INTERVAL '1 second'
     WHERE id=$1 AND lease=$2 RETURNING order_id)
    UPDATE orders SET mail_error=$3 WHERE id IN(SELECT order_id FROM failed)`,[job.id,lease,error]);
   console.error('Письмо заказа ожидает повторной отправки:',job.order_id||'restore',error);
  }
 }
 return {sent,failed};
}
module.exports={ensure,enqueue,restore,flush};
