const test=require('node:test'),assert=require('node:assert/strict');
test('Telegram UX: роли, привязка, дети и отключённые аккаунты',{skip:!process.env.TEST_TELEGRAM_DATABASE_URL},async t=>{
 process.env.DATABASE_URL=process.env.TEST_TELEGRAM_DATABASE_URL;process.env.TELEGRAM_BOT_TOKEN='fixture-no-live-token';process.env.LF_BOT_TOKEN='fixture-no-live-token';process.env.LF_PUBLIC_URL='https://shop.lessonfold.test';process.env.FRONTEND_ORIGINS='https://lessonfold.test';
 const http=require('http'),{query,pool}=require('../src/db');const calls=[];
 const server=http.createServer(async(req,res)=>{let b='';for await(const c of req)b+=c;const body=JSON.parse(b||'{}'),method=req.url.split('/').pop();calls.push({method,body});res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true,result:method==='getMe'?{username:'fixture_bot'}:method.includes('Description')?{description:'Fixture description',short_description:'Fixture description'}:true}));});
 server.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));process.env.TELEGRAM_API_URL=`http://127.0.0.1:${server.address().port}`;
 t.after(async()=>{await new Promise(r=>server.close(r));await pool.end();});
 await require('../src/services/migrate').migrate({log:()=>{}});await require('../src/services/schema').ensureAll();
 const tg=require('../src/services/telegram');await tg.start();
 let i=0;const user=async(role,owner)=>{const {rows:[u]}=await query("INSERT INTO users(role,login,password_hash,full_name,tutor_id) VALUES($1,$2,'x',$3,$4) RETURNING *",[role,'tg_'+Date.now()+'_'+i++,'Private '+role,owner||null]);return u;};
 const tutor=await user('tutor'),other=await user('tutor'),student=await user('student',tutor.id),second=await user('student',tutor.id),outsider=await user('student',other.id),parent=await user('parent',tutor.id);
 for(const [index,u] of [student,second,outsider].entries())u.sid=(await query('INSERT INTO students(user_id,tutor_id,full_name) VALUES($1,$2,$3) RETURNING id',[u.id,u.tutor_id,['Anna','Boris','SECRET_OUTSIDER'][index]])).rows[0].id;
 await query('INSERT INTO parent_students(parent_user_id,student_id) VALUES($1,$2),($1,$3)',[parent.id,student.sid,second.sid]);
 const chats=new Map([[tutor,71001],[student,71002],[parent,71003]]);for(const [u,chat] of chats)await query('INSERT INTO telegram_links(user_id,chat_id) VALUES($1,$2)',[u.id,chat]);
 const msg=(chat,text)=>({message:{chat:{id:chat,type:'private'},from:{id:chat},text}});
 const callback=(chat,data)=>({callback_query:{id:'fixture-callback',from:{id:chat},message:{chat:{id:chat,type:'private'},message_id:1},data}});
 const sent=chat=>calls.filter(c=>c.method==='sendMessage'&&c.body.chat_id===chat).map(c=>c.body);
 await t.test('меню преподавателя и ученика различаются и не требуют slash-команд',async()=>{
  await tg.handleUpdate(msg(71001,'/menu'));let last=sent(71001).at(-1),keys=JSON.stringify(last.reply_markup);assert.ok(keys.includes('Сегодня'));assert.ok(keys.includes('На проверку'));assert.ok(keys.includes('Магазин материалов'));
  await tg.handleUpdate(msg(71002,'/menu'));last=sent(71002).at(-1);keys=JSON.stringify(last.reply_markup);assert.ok(keys.includes('Домашка'));assert.ok(keys.includes('Вспомнить тему'));assert.ok(!keys.includes('Ученики'));
  await tg.handleUpdate(msg(71002,'Помощь'));assert.ok(sent(71002).at(-1).reply_markup.keyboard);
  await tg.handleUpdate(msg(71001,'Ученики'));keys=JSON.stringify(sent(71001).at(-1));assert.ok(keys.includes('Anna'));assert.ok(!keys.includes('SECRET_OUTSIDER'));
 });
 await t.test('родитель выбирает только своих детей, чужой callback не даёт данных',async()=>{
  await tg.handleUpdate(msg(71003,'Мои дети'));let last=JSON.stringify(sent(71003).at(-1));assert.ok(last.includes('Anna'));assert.ok(last.includes('Boris'));assert.ok(!last.includes('SECRET_OUTSIDER'));
  await tg.handleUpdate(callback(71003,`lf:child:${student.sid}`));last=JSON.stringify(sent(71003).at(-1));assert.ok(last.includes('Домашка и тесты'));
  await tg.handleUpdate(callback(71003,`lf:hw:${outsider.sid}`));last=sent(71003).at(-1).text;assert.match(last,/недоступны/);assert.ok(!last.includes('SECRET_OUTSIDER'));
 });
 await t.test('диагностики входят в домашку, а не скрываются за сообщением «всё сделано»',async()=>{
  const {rows:[d]}=await query("INSERT INTO diagnostic_tests(tutor_id,title,mode,request_key,request_hash) VALUES($1,'Monthly test','manual',$2,$3) RETURNING id",[tutor.id,require('crypto').randomUUID(),'0'.repeat(64)]);
  await query("INSERT INTO diagnostic_runs(test_id,student_id,questions) VALUES($1,$2,'[]')",[d.id,student.sid]);
  await tg.handleUpdate(msg(71002,'Домашка'));assert.match(sent(71002).at(-1).text,/Monthly test/);
  await tg.handleUpdate(callback(71003,`lf:hw:${second.sid}`));assert.ok(!sent(71003).at(-1).text.includes('Monthly test'));
 });
 await t.test('магазин и старые ссылки на покупку продолжают передаваться магазину',async()=>{
  assert.equal(await tg.handleUpdate(msg(71001,'Магазин материалов')),false);assert.equal(await tg.handleUpdate(msg(71001,'Мои покупки')),false);
  assert.equal(await tg.handleUpdate(msg(71002,'/start p_demo-lesson')),false);assert.equal(await tg.handleUpdate(callback(71003,'cat')),false);
  await tg.handleUpdate(msg(79999,'/start'));assert.match(sent(79999).at(-1).text,/Подключить Telegram/);
 });
 await t.test('одноразовую привязку нельзя погасить дважды; отключённый владелец закрывает учебные данные',async()=>{
  const link=await tg.createLinkCode(second.id),code=new URL(link).searchParams.get('start');
  await Promise.all([tg.handleUpdate(msg(72001,'/start '+code)),tg.handleUpdate(msg(72002,'/start '+code))]);
  assert.equal((await query('SELECT 1 FROM telegram_links WHERE user_id=$1',[second.id])).rows.length,1);assert.equal((await query('SELECT 1 FROM telegram_link_codes WHERE code=$1',[code])).rows.length,0);
  await query('UPDATE users SET is_active=false WHERE id=$1',[tutor.id]);const n=sent(71002).length;assert.equal(await tg.handleUpdate(msg(71002,'Домашка')),false);assert.equal(sent(71002).length,n);
  assert.ok(!calls.some(c=>c.method==='getUpdates'));
 });
});
