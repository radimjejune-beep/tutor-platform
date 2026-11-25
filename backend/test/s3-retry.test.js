const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const s3 = require('../src/services/s3');

async function fixture(t) {
  const previous = Object.fromEntries(['S3_ENDPOINT','S3_BUCKET','S3_ACCESS_KEY','S3_SECRET_KEY','S3_REGION'].map(key => [key,process.env[key]]));
  let scenario = 'success', calls = [], objects = new Map();
  const server = http.createServer(async(req,res) => {
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const body=Buffer.concat(chunks);calls.push({method:req.method,key:req.url,body});
    const count=calls.length;
    if(scenario==='denied'){res.writeHead(403);res.end('<Error><Code>AccessDenied</Code><Message>PRIVATE_XML_DESCRIPTION</Message></Error>');return;}
    if(scenario==='always500'||scenario==='retry'&&count<3){res.writeHead(500,{'x-amz-request-id':'fixture-123'});res.end('<Error><Code>InternalError</Code><Message>PRIVATE_XML_DESCRIPTION</Message></Error>');return;}
    if(scenario==='lost-reply'&&count===1){objects.set(req.url,body);req.socket.destroy();return;}
    if(scenario==='truncated-read'&&count===1){res.writeHead(200,{'Content-Length':100});res.flushHeaders();res.write('partial');setImmediate(()=>res.destroy());return;}
    if(req.method==='PUT')objects.set(req.url,body);
    res.writeHead(200);res.end(req.method==='GET'?Buffer.from('complete-file'):undefined);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  process.env.S3_ENDPOINT=`http://127.0.0.1:${server.address().port}`;process.env.S3_BUCKET='fixture';process.env.S3_ACCESS_KEY='fixture-key';process.env.S3_SECRET_KEY='fixture-secret';
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));for(const [key,value]of Object.entries(previous))if(value===undefined)delete process.env[key];else process.env[key]=value;});
  return {set(value){scenario=value;calls=[];objects.clear();},get calls(){return calls;},get objects(){return objects;}};
}

test('S3 retries actual HTTP transfers without replaying the upload route',async t=>{
 const mock=await fixture(t),bytes=Buffer.from('Original binary file: '+ 'é\u0000'.repeat(10000));
 await t.test('two InternalError responses recover with the same object key and complete bytes',async()=>{
  mock.set('retry');await s3.putBuffer('files/retry',bytes,'application/pdf');assert.equal(mock.calls.length,3);assert.equal(new Set(mock.calls.map(x=>x.key)).size,1);assert.ok(mock.calls.every(x=>x.body.equals(bytes)));assert.equal(mock.objects.size,1);
 });
 await t.test('a disk stream is reopened from byte zero for each attempt',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'lf-s3-'));try{const file=path.join(directory,'backup.bin');await fs.writeFile(file,bytes);mock.set('retry');await s3.putFile('backups/retry',file);assert.equal(mock.calls.length,3);assert.ok(mock.calls.every(x=>x.body.equals(bytes)));}finally{await fs.rm(directory,{recursive:true,force:true});}
 });
 await t.test('an accepted PUT with a lost response retries the same key, not a new object',async()=>{
  mock.set('lost-reply');await s3.putBuffer('files/lost-reply',bytes);assert.equal(mock.calls.length,2);assert.equal(mock.objects.size,1);assert.ok([...mock.objects.values()][0].equals(bytes));
 });
 await t.test('403 is not retried and raw XML descriptions never become the error message',async()=>{
  mock.set('denied');await assert.rejects(s3.putBuffer('files/denied',bytes),error=>error instanceof s3.S3Error&&error.statusCode===403&&!error.retryable&&!error.message.includes('PRIVATE_XML_DESCRIPTION'));assert.equal(mock.calls.length,1);
 });
 await t.test('persistent 500 stops after three attempts and retains safe diagnostics',async()=>{
  mock.set('always500');await assert.rejects(s3.putBuffer('files/failed',bytes),error=>error instanceof s3.S3Error&&error.retryable&&error.attempts===3&&error.code==='InternalError'&&error.requestId==='fixture-123'&&!error.message.includes('<Error>'));assert.equal(mock.calls.length,3);
 });
 await t.test('an interrupted download is retried instead of returning partial bytes',async()=>{
  mock.set('truncated-read');assert.equal((await s3.getBuffer('files/read')).toString(),'complete-file');assert.equal(mock.calls.length,2);
 });
});

const database = process.env.TEST_DATABASE_URL;
test('file API stores one row after S3 recovery and returns a readable 503 after exhaustion',{skip:!database},async t=>{
 process.env.DATABASE_URL=database;process.env.JWT_SECRET='s3-upload-regression-fixture-secret-123456';process.env.LF_PUBLIC_URL='';process.env.LF_MAIL_ENABLED='false';process.env.BOT_TOKEN='';process.env.LF_BOT_TOKEN='';
 const {query,pool}=require('../src/db');t.after(()=>pool.end());
 await require('../src/services/migrate').migrate({log:()=>{}});await require('../src/services/schema').ensureAll();
 const {rows:[u]}=await query("INSERT INTO users(role,login,password_hash,full_name,is_admin) VALUES('tutor','s3_fixture','fixture','S3 fixture',true) RETURNING *");
 const {rows:[item]}=await query("INSERT INTO library_items(tutor_id,kind,title,subject) VALUES($1,'task','Upload fixture','Английский язык') RETURNING id",[u.id]);
 const token=require('../src/middleware/auth').signToken(u),mock=await fixture(t),app=require('../src/server');const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base=`http://127.0.0.1:${server.address().port}`,post=()=>fetch(base+'/api/files',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({library_item_id:item.id,filename:'sample.pdf',mime:'application/pdf',data:Buffer.from('%PDF fixture').toString('base64')})});
 mock.set('retry');let response=await post();assert.equal(response.status,201,await response.clone().text());let row=(await query('SELECT id,data,s3_key FROM files WHERE library_item_id=$1',[item.id])).rows;assert.equal(row.length,1);assert.equal(row[0].data,null);assert.ok(row[0].s3_key);assert.equal(new Set(mock.calls.map(x=>x.key)).size,1);
 mock.set('always500');response=await post();assert.equal(response.status,503);assert.equal(response.headers.get('retry-after'),'5');const error=await response.json();assert.equal(error.code,'STORAGE_UNAVAILABLE');assert.match(error.error,/хранилище временно недоступно/);assert.ok(!JSON.stringify(error).includes('<Error>'));assert.equal((await query('SELECT id FROM files WHERE library_item_id=$1',[item.id])).rows.length,1);
 // An S3 read failure must replace PDF response headers with JSON, not a corrupt PDF.
 response=await fetch(base+'/api/files/'+row[0].id,{headers:{Authorization:'Bearer '+token}});assert.equal(response.status,503);assert.match(response.headers.get('content-type'),/application\/json/);assert.equal(response.headers.get('content-disposition'),null);assert.equal((await response.json()).code,'STORAGE_UNAVAILABLE');
});
