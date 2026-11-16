const test=require('node:test'),assert=require('node:assert/strict');
const {MURPHY_BOOKS}=require('../src/bank/murphy-books');
const catalog=require('../src/learning/grammar');
const items=require('../src/bank/murphy');
const {gameSchema,grade,parseGaps}=require('../src/services/games');

test('Murphy: оба маршрута полны, юниты доступны в поиске и не ломают общие темы',()=>{
 assert.deepEqual(MURPHY_BOOKS.map(b=>b.units.length),[115,145]);
 for(const b of MURPHY_BOOKS)for(const [i,u] of b.units.entries()){
  assert.equal(u.code,String(i+1));assert.ok(/[а-я]/i.test(u.title));
  const t=catalog.byId.get(u.grammar_key);assert.equal(t.book_id,b.id);assert.equal(t.questions.length,6);
  assert.ok(catalog.search(`${b.title} unit ${u.code}`).some(x=>x.id===t.id));
  assert.equal(items.filter(x=>x.book===b.id&&x.unit===u.code).length,2);
 }
 assert.ok(catalog.search('юнит 20').every(t=>t.unit==='20'));
 assert.equal(catalog.matchTopic('Present Simple: questions'),'present-simple');
 assert.ok(catalog.search('мёрфи Essential юнит 115').some(t=>t.id==='mu-e4-115'));
});
test('Murphy: листы действительно проверяются на 6 баллов; каждый вариант текстового ответа принимается',()=>{
 assert.equal(items.length,520);assert.equal(new Set(items.map(t=>t.key)).size,520);
 for(const item of items){
  assert.ok(item.key.length<=80);assert.ok(item.title.length<=255);
  if(item.kind==='theory'){assert.ok(item.body.includes('Когда использовать'));assert.ok(item.body.includes('Самостоятельный материал Lessonfold'));continue;}
  const g=gameSchema.parse(item.game);assert.equal(g.blocks.length,6);
  const answers={b:Object.fromEntries(g.blocks.map((b,i)=>[i,b.t==='choice'?b.correct:parseGaps(b.text).gaps.map(a=>a[0])]))};
  const r=grade(g,answers);assert.equal(r.total,6,item.key);assert.equal(r.score,100,item.key);assert.equal(grade(g,{}).score,0);
  for(const [i,b] of g.blocks.entries())if(b.t==='gaps')for(const alt of parseGaps(b.text).gaps[0]){
   assert.equal(grade(g,{b:{...answers.b,[i]:[alt]}}).score,100,`${item.key}: ${alt}`);
  }
 }
});
test('Murphy: теория, повторное заполнение и копирование в библиотеку на PostgreSQL',{skip:!process.env.TEST_MURPHY_DATABASE_URL},async t=>{
 process.env.DATABASE_URL=process.env.TEST_MURPHY_DATABASE_URL;
 const {query,pool}=require('../src/db');t.after(()=>pool.end());
 await require('../src/services/migrate').migrate({log:()=>{}});await require('../src/services/schema').ensureAll();
 const bank=require('../src/services/bank');await bank.seed();
 const select=()=>query("SELECT id,seed_key,kind,body,game,hidden,uses,xmin::text AS revision FROM bank_items WHERE book=ANY($1::text[]) ORDER BY id",[MURPHY_BOOKS.map(b=>b.id)]);
 const before=(await select()).rows;assert.equal(before.length,520);
 await bank.seed();assert.deepEqual((await select()).rows,before);
 const theory=before.find(x=>x.kind==='theory'),game=before.find(x=>x.kind==='game');
 await query("UPDATE bank_items SET body='stale',title='old' WHERE id=$1",[theory.id]);
 await query('UPDATE bank_items SET hidden=true,uses=7 WHERE id=$1',[game.id]);
 await bank.seed();const now=(await select()).rows;
 assert.equal(now.find(x=>x.id===theory.id).body,theory.body);
 assert.equal(now.find(x=>x.id===game.id).hidden,true);assert.equal(now.find(x=>x.id===game.id).uses,7);
 const {loadRoutes,call,uniq}=require('./helpers');const route=loadRoutes('routes/bank.js').mod;
 const {rows:[u]}=await query("INSERT INTO users(role,login,password_hash,full_name,subject) VALUES('tutor',$1,'test','Test','Английский язык') RETURNING id,role,subject",[uniq('murphy')]);u.tid=u.id;
 assert.equal((await call(route,'GET','/books',{user:{...u,role:'student'}})).status,403);
 const books=await call(route,'GET','/books',{user:u,query:{}});assert.equal(books.status,200);assert.equal(books.body.find(b=>b.id===MURPHY_BOOKS[0].id).units.length,115);
 assert.equal((await call(route,'GET','/items/:id',{user:u,params:{id:game.id}})).status,404);
 await query('UPDATE bank_items SET hidden=false WHERE id=$1',[game.id]);
 for(const item of [theory,game]){
  const first=await call(route,'POST','/items/:id/take',{user:u,params:{id:item.id}});assert.equal(first.status,200);assert.equal(first.body.again,false);
  const again=await call(route,'POST','/items/:id/take',{user:u,params:{id:item.id}});assert.equal(again.body.again,true);assert.equal(again.body.library_id,first.body.library_id);
  const copy=(await query('SELECT kind,body,game FROM library_items WHERE id=$1 AND tutor_id=$2',[first.body.library_id,u.id])).rows[0];
  assert.equal(copy.kind,item.kind);assert.equal(copy.body,item.body);assert.deepEqual(copy.game,item.game);
 }
});
