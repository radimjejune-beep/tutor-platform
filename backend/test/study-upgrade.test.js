'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
test('v2.2 upgrade preserves accounts, parent links, lesson summaries, answers, grades and dictionaries',{skip:!process.env.TEST_STUDY_UPGRADE_DATABASE_URL},async t=>{
 process.env.DATABASE_URL=process.env.TEST_STUDY_UPGRADE_DATABASE_URL;const {query,pool}=require('../src/db'),{migrate}=require('../src/services/migrate');t.after(()=>pool.end());
 assert.equal((await query("SELECT to_regclass('public.users') x")).rows[0].x,null,'requires a disposable empty database');
 const dir=path.resolve(__dirname,'../migrations'),original=fs.readdirSync;fs.readdirSync=function(target,...rest){const out=original.call(this,target,...rest);return path.resolve(String(target))===dir?out.filter(f=>!/^\d{3}_/.test(f)||Number(f.slice(0,3))<=30):out;};
 try{await migrate({log:()=>{}});}finally{fs.readdirSync=original;}
 await require('../src/services/schema').ensureAll();
 const make=async(role,tid)=>(await query("INSERT INTO users(role,login,password_hash,full_name,tutor_id,subject) VALUES($1,$2,'fixture','Upgrade person',$3,'Английский язык') RETURNING id",[role,'upgrade_'+role,tid||null])).rows[0].id;
 const teacher=await make('tutor'),pupil=await make('student',teacher),parent=await make('parent',teacher),subject='Французский язык';
 const sid=(await query("INSERT INTO students(user_id,tutor_id,full_name,subject) VALUES($1,$2,'Upgrade pupil',$3) RETURNING id",[pupil,teacher,subject])).rows[0].id;await query('INSERT INTO parent_students(parent_user_id,student_id) VALUES($1,$2)',[parent,sid]);
 const lesson=(await query("INSERT INTO lessons(student_id,starts_at,status,summary,private_notes) VALUES($1,NOW(),'done','Nous avons étudié le présent.','Teacher-only note') RETURNING id",[sid])).rows[0].id;
 const assignment=(await query("INSERT INTO assignments(tutor_id,title) VALUES($1,'French writing') RETURNING id",[teacher])).rows[0].id;
 const homework=(await query("INSERT INTO homework(assignment_id,student_id,lesson_id,status,student_answer,score) VALUES($1,$2,$3,'checked','Je parle français.',86) RETURNING id",[assignment,sid,lesson])).rows[0].id;
 const word=(await query("INSERT INTO vocab_items(student_id,term,translation,box) VALUES($1,'chat','кот',3) RETURNING id",[sid])).rows[0].id;
 const section=(await query("INSERT INTO study_sections(tutor_id,title,grammar_key) VALUES($1,'Présent','fr-etre') RETURNING id",[teacher])).rows[0].id;
 const applied=await migrate({log:()=>{}});assert.ok(applied[0].startsWith('031_'));assert.ok(applied.at(-1).startsWith('039_'));await require('../src/services/schema').ensureAll();assert.deepEqual(await migrate({log:()=>{}}),[]);
 const h=(await query('SELECT * FROM homework WHERE id=$1',[homework])).rows[0];assert.equal(h.student_answer,'Je parle français.');assert.equal(h.score,86);assert.equal(h.lesson_id,lesson);assert.equal(h.subject,subject);assert.equal(h.reviewed_at,null,'historic work is not newly rewarded');
 const l=(await query('SELECT * FROM lessons WHERE id=$1',[lesson])).rows[0];assert.equal(l.summary,'Nous avons étudié le présent.');assert.equal(l.private_notes,'Teacher-only note');assert.equal(l.subject,subject);
 assert.equal((await query('SELECT subject FROM assignments WHERE id=$1',[assignment])).rows[0].subject,subject);
 const v=(await query('SELECT * FROM vocab_items WHERE id=$1',[word])).rows[0];assert.equal(v.box,3);assert.equal(v.translation,'кот');assert.equal(v.subject,subject);
 assert.equal((await query('SELECT subject FROM study_sections WHERE id=$1',[section])).rows[0].subject,subject);assert.equal((await query('SELECT 1 FROM parent_students WHERE parent_user_id=$1 AND student_id=$2',[parent,sid])).rowCount,1);
 // Legacy implicit lesson creation and identical terms in two directions still work.
 assert.equal((await query('INSERT INTO lessons(student_id,starts_at) VALUES($1,NOW()) RETURNING subject',[sid])).rows[0].subject,subject);
 await query("INSERT INTO vocab_items(student_id,term,translation,subject) VALUES($1,'chat','разговор','Английский язык')",[sid]);assert.equal((await query("SELECT count(*)::int n FROM vocab_items WHERE student_id=$1 AND term='chat'",[sid])).rows[0].n,2);
});
