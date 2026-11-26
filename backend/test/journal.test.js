'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
test('private teacher diary, dated lessons and preparation plans',{skip:!process.env.TEST_DATABASE_URL},async t=>{
 process.env.DATABASE_URL=process.env.TEST_DATABASE_URL;process.env.JWT_SECRET='journal-fixture-secret-at-least-32-characters';process.env.LF_PUBLIC_URL='';process.env.LF_MAIL_ENABLED='false';process.env.LF_BOT_TOKEN='';process.env.BOT_TOKEN='';
 const {query,pool}=require('../src/db');await require('../src/services/migrate').migrate({log:()=>{}});await require('../src/services/schema').ensureAll();
 const person=async(role,tid)=>{const {rows}=await query('INSERT INTO users(role,login,password_hash,full_name,tutor_id) VALUES($1,$2,\'fixture\',$3,$4) RETURNING *',[role,'journal_'+randomUUID().slice(0,16),role+' fixture',tid||null]);return rows[0];};
 const owner=await person('tutor'),other=await person('tutor'),studentUser=await person('student',owner.id),parent=await person('parent',owner.id),learner=await person('learner');
 const child=(await query("INSERT INTO students(tutor_id,user_id,full_name,category,subject) VALUES($1,$2,'Own pupil','adult','Английский язык') RETURNING *",[owner.id,studentUser.id])).rows[0];
 await query('INSERT INTO parent_students(parent_user_id,student_id) VALUES($1,$2)',[parent.id,child.id]);await require('../src/learning/study-subjects').add(child.id,owner.id,'Французский язык');
 const child2=(await query("INSERT INTO students(tutor_id,full_name,category) VALUES($1,'Group pupil','adult') RETURNING *",[owner.id])).rows[0];
 const auth=require('../src/middleware/auth'),server=require('../src/server').listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base='http://127.0.0.1:'+server.address().port+'/api';
 const req=async(user,path,method='GET',body)=>{const r=await fetch(base+path,{method,headers:{Authorization:'Bearer '+auth.signToken(user),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json()};};
 t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await pool.end();});
 let entry;
 await t.test('only the owner can list, edit, move or delete private entries',async()=>{
  let r=await req(owner,'/journal','POST',{date:'2026-11-26',kind:'task',body:'Private teacher reminder'});assert.equal(r.status,201,JSON.stringify(r.body));entry=r.body;
  assert.equal((await req(owner,'/journal?date=2026-11-26')).body.entries.length,1);assert.deepEqual((await req(other,'/journal?date=2026-11-26')).body.entries,[]);
  assert.equal((await req(other,'/journal/'+entry.id,'PATCH',{body:'wrong owner',version:entry.version})).status,404);assert.equal((await req(other,'/journal/'+entry.id+'?version=1','DELETE')).status,404);
  for(const role of [studentUser,parent,learner])for(const [path,method,body]of [['/journal?date=2026-11-26','GET'],['/journal','POST',{date:'2026-11-26',kind:'note',body:'no'}],['/journal/'+entry.id,'PATCH',{body:'no',version:1}]])assert.equal((await req(role,path,method,body)).status,403);
 });
 await t.test('changes persist, stale writes are rejected, and moving preserves the entry',async()=>{
  let r=await req(owner,'/journal/'+entry.id,'PATCH',{done:true,version:entry.version});assert.equal(r.status,200);entry=r.body;assert.equal(entry.done,true);
  assert.equal((await req(owner,'/journal/'+entry.id,'PATCH',{body:'stale write',version:1})).status,409);assert.equal((await req(owner,'/journal/'+entry.id+'?version=1','DELETE')).status,409);
  r=await req(owner,'/journal/'+entry.id,'PATCH',{date:'2026-11-27',version:entry.version});assert.equal(r.status,200);entry=r.body;assert.equal(entry.id,r.body.id);assert.deepEqual((await req(owner,'/journal?date=2026-11-26')).body.entries,[]);assert.equal((await req(owner,'/journal?date=2026-11-27')).body.entries[0].body,'Private teacher reminder');
 });
 await t.test('invalid days, timezones, empty text and malformed ids produce validation errors',async()=>{
  for(const day of ['2026-02-30','2025-02-29','1900-01-01','2026-13-01'])assert.equal((await req(owner,'/journal?date='+day)).status,422);
  assert.equal((await req(owner,'/journal?timezone=Not/A_Timezone')).status,422);assert.equal((await req(owner,'/dashboard?date=2026-02-30')).status,422);assert.equal((await req(owner,'/journal','POST',{date:'2026-11-26',kind:'note',body:'   '})).status,400);assert.equal((await req(owner,'/journal/nope?version=1','DELETE')).status,422);
 });
 await t.test('selected teaching day uses the requested timezone including a 23-hour DST day',async()=>{
  const made=[];for(const at of ['2026-03-08T04:59:59Z','2026-03-08T05:00:00Z','2026-03-09T03:59:59Z','2026-03-09T04:00:00Z'])made.push((await query("INSERT INTO lessons(student_id,starts_at,duration_min,status,subject) VALUES($1,$2,60,'scheduled','Английский язык') RETURNING id",[child.id,at])).rows[0].id);
  const r=await req(owner,'/dashboard?date=2026-03-08&timezone=America%2FNew_York');assert.equal(r.status,200,JSON.stringify(r.body));assert.deepEqual(r.body.today.map(x=>x.id),made.slice(1,3));assert.equal(r.body.date,'2026-03-08');
 });
 await t.test('a diary lesson only shows previous work, homework and vocabulary in its own subject',async()=>{
  const past=async(subject,starts,summary)=>(await query("INSERT INTO lessons(student_id,starts_at,duration_min,status,subject,summary) VALUES($1,$2,60,'done',$3,$4) RETURNING id",[child.id,starts,subject,summary])).rows[0].id;
  const english=await past('Английский язык','2026-11-20T09:00:00Z','English past lesson'),french=await past('Французский язык','2026-11-24T09:00:00Z','French past lesson');
  for(const subject of ['Английский язык','Французский язык']){
   await query("INSERT INTO lessons(student_id,starts_at,duration_min,status,subject) VALUES($1,'2026-11-26T10:00:00Z',60,'scheduled',$2)",[child.id,subject]);
   const a=(await query('INSERT INTO assignments(tutor_id,title,subject) VALUES($1,$2,$2) RETURNING id',[owner.id,subject])).rows[0];await query("INSERT INTO homework(student_id,assignment_id,status) VALUES($1,$2,'assigned')",[child.id,a.id]);
   await query("INSERT INTO vocab_items(student_id,subject,term,translation) VALUES($1,$2,$3,'translation')",[child.id,subject,subject==='Английский язык'?'English word':'mot français']);
  }
  const r=await req(owner,'/dashboard?date=2026-11-26&timezone=UTC');assert.equal(r.status,200,JSON.stringify(r.body));const en=r.body.today.find(x=>x.subject==='Английский язык'),fr=r.body.today.find(x=>x.subject==='Французский язык');assert.equal(en.previous.id,english);assert.equal(fr.previous.id,french);assert.ok(en.homework.every(h=>h.title==='Английский язык'));assert.ok(fr.homework.every(h=>h.title==='Французский язык'));assert.equal(en.vocab.total,1);assert.equal(fr.vocab.total,1);
 });
 await t.test('private plans can be set on lesson creation without exposing them to pupils',async()=>{
  const r=await req(owner,'/lessons','POST',{student_id:child.id,subject:'Французский язык',starts_at:'2027-02-05T10:00:00Z',duration_min:60,private_notes:'Private French preparation'});assert.equal(r.status,201,JSON.stringify(r.body));assert.equal(r.body[0].private_notes,'Private French preparation');
  const publicRows=await req(studentUser,'/lessons?from=2027-02-05T00:00:00Z&to=2027-02-06T00:00:00Z');assert.equal(publicRows.status,200);assert.equal(publicRows.body[0].private_notes,undefined);
 });
 await t.test('group plan creation and updates apply atomically to all session members',async()=>{
  const group=(await query("INSERT INTO groups(tutor_id,name) VALUES($1,'Journal group') RETURNING id",[owner.id])).rows[0],foreign=(await query("INSERT INTO groups(tutor_id,name) VALUES($1,'Other group') RETURNING id",[other.id])).rows[0];
  await query('INSERT INTO group_members(group_id,student_id) VALUES($1,$2),($1,$3)',[group.id,child.id,child2.id]);
  let r=await req(owner,'/groups/'+group.id+'/lessons','POST',{starts_at:'2027-02-06T10:00:00Z',duration_min:60,private_notes:'Initial shared plan'});assert.equal(r.status,201,JSON.stringify(r.body));
  r=await req(owner,'/groups/'+group.id+'/lessons/plan','PATCH',{starts_at:'2027-02-06T10:00:00Z',private_notes:'Updated shared plan'});assert.equal(r.status,200);assert.equal(r.body.updated,2);assert.equal((await query("SELECT COUNT(*)::int AS n FROM lessons WHERE group_id=$1 AND private_notes='Updated shared plan'",[group.id])).rows[0].n,2);
  assert.equal((await req(other,'/groups/'+group.id+'/lessons/plan','PATCH',{starts_at:'2027-02-06T10:00:00Z',private_notes:'Foreign edit'})).status,404);assert.equal((await req(owner,'/groups/'+foreign.id+'/lessons/plan','PATCH',{starts_at:'2027-02-06T10:00:00Z',private_notes:'Foreign edit'})).status,404);
 });
 await t.test('the owner can delete a note with the current version',async()=>{assert.equal((await req(owner,'/journal/'+entry.id+'?version='+entry.version,'DELETE')).status,200);assert.deepEqual((await req(owner,'/journal?date=2026-11-27')).body.entries,[]);});
});
