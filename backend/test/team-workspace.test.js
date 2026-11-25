const test=require('node:test'), assert=require('node:assert/strict');
test('staff workspace persists tasks, protects roles, concurrent edits and history',{skip:!process.env.TEST_SALES_DATABASE_URL},async t=>{
  process.env.LF_DATABASE_URL=process.env.TEST_SALES_DATABASE_URL;
  process.env.LF_DB_SCHEMA='workspace_fixture';process.env.LF_PUBLIC_URL='http://127.0.0.1';
  process.env.LF_BOT_TOKEN='';process.env.BOT_TOKEN='';
  const db=require('../lessonfold/src/db'),store=require('../lessonfold/src/store');
  await db.migrate();await store.migrate();await store.migrate();
  for(const [login,role] of [['owner','admin'],['manager','manager'],['editor_one','editor'],['editor_two','editor'],['viewer','finance']])await store.createAdmin(login,'local-fixture-password',login,role);
  const server=require('node:http').createServer(require('../lessonfold/src/web').createHandler({}));
  server.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  t.after(async()=>{await new Promise(r=>server.close(r));await db.close();});
  const base='http://127.0.0.1:'+server.address().port+'/admin/api',sessions={};
  for(const name of ['owner','manager','editor_one','editor_two','viewer']){
    const r=await fetch(base+'/login',{method:'POST',headers:{'x-lf-admin':'1'},body:JSON.stringify({login:name,password:'local-fixture-password'})});assert.equal(r.status,200);sessions[name]=r.headers.get('set-cookie').split(';')[0];
  }
  const req=async(who,path,method='GET',body,status=200)=>{
    const r=await fetch(base+path,{method,headers:{Cookie:sessions[who]||'','x-lf-admin':'1','content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    const d=await r.json();assert.equal(r.status,status,JSON.stringify({path,d}));return d;
  };
  let task;
  await t.test('sessions and CSRF protect the workspace; directory exposes no credentials',async()=>{
    await req('', '/workspace/tasks','GET',undefined,401);
    const r=await fetch(base+'/workspace/tasks',{method:'POST',headers:{Cookie:sessions.owner},body:'{}'});assert.equal(r.status,403);
    const members=(await req('editor_one','/workspace/members')).members;assert.equal(members.length,5);assert.deepEqual(Object.keys(members[0]).sort(),['display_name','login']);
    await req('editor_one','/admins','GET',undefined,403);await req('viewer','/settings','GET',undefined,403);
  });
  await t.test('create, assign, checklist, due dates and filters survive a new request',async()=>{
    task=(await req('editor_one','/workspace/tasks','POST',{title:'Подготовить урок',category:'lessons',assignee:'editor_two',priority:'high',due_date:'2020-01-01',checklist:[{text:'Записать аудио',done:false}]},201)).task;
    assert.equal(task.version,1);assert.equal(task.due_date,'2020-01-01');
    let r=await req('editor_two','/workspace/tasks?scope=mine');assert.equal(r.tasks[0].id,task.id);assert.equal(r.stats.overdue,1);assert.equal(r.tasks[0].can_edit,true);
    r=await req('editor_one','/workspace/tasks?scope=mine');assert.equal(r.stats.total,0);
    assert.equal((await req('owner','/workspace/tasks?category=sales')).stats.total,0);
    assert.equal((await req('owner','/workspace/tasks?q='+encodeURIComponent('урок'))).tasks.length,1);
    assert.equal((await req('owner','/workspace/tasks?q='+encodeURIComponent("%' OR 1=1 --"))).tasks.length,0);
    assert.equal((await req('viewer','/workspace/tasks/'+task.id)).task.can_edit,false);
  });
  await t.test('only responsible staff, creator and leaders edit; stale writes cannot overwrite colleagues',async()=>{
    await req('viewer','/workspace/tasks/'+task.id,'PATCH',{version:task.version,title:'Forbidden'},403);
    const changes=await Promise.all(['editor_two','owner'].map(async who=>{
      const r=await fetch(base+'/workspace/tasks/'+task.id,{method:'PATCH',headers:{Cookie:sessions[who],'x-lf-admin':'1'},body:JSON.stringify({version:1,status:'doing',title:who+' edit'})});return {who,status:r.status,data:await r.json()};
    }));
    assert.deepEqual(changes.map(r=>r.status).sort(),[200,409]);
    const winner=changes.find(r=>r.status===200);task=winner.data.task;assert.equal(task.version,2);
    await req('editor_one','/workspace/tasks/'+task.id,'PATCH',{version:1,title:'Stale'},409);
    const events=(await req('owner','/workspace/tasks/'+task.id)).events;assert.equal(events.length,2);assert.equal(events[1].actor,winner.who);
    // Deterministic assignee update guarantees this employee has an audit entry.
    task=(await req('editor_two','/workspace/tasks/'+task.id,'PATCH',{version:task.version,status:'review'})).task;
  });
  await t.test('invalid employee, dates, lists, ids and missing version do not change the task',async()=>{
    for(const patch of [{assignee:'missing'},{due_date:'2026-02-30'},{checklist:[{text:'x',done:'true'}]},{title:' '},{status:'surprise'},{archived:'false'}])await req('owner','/workspace/tasks/'+task.id,'PATCH',{version:task.version,...patch},422);
    await req('owner','/workspace/tasks/'+task.id,'PATCH',{status:'done'},409);
    await req('owner','/workspace/tasks/not-an-id','GET',undefined,404);
    assert.equal((await req('owner','/workspace/tasks/'+task.id)).task.version,task.version);
  });
  await t.test('discussion records author, and archiving is reversible without deleting history',async()=>{
    const text='<img src=x onerror=alert(1)> A result';
    await req('viewer','/workspace/tasks/'+task.id+'/comments','POST',{text},201);
    await req('owner','/workspace/tasks/'+task.id+'/comments','POST',{text:' '},422);
    let r=await req('owner','/workspace/tasks/'+task.id);assert.equal(r.events.at(-1).content.text,text);assert.equal(r.events.at(-1).actor,'viewer');
    task=(await req('owner','/workspace/tasks/'+task.id,'PATCH',{version:task.version,status:'done',checklist:[{text:'Записать аудио',done:true}],archived:true})).task;
    assert.ok(task.completed_at);assert.equal((await req('owner','/workspace/tasks')).stats.total,0);assert.equal((await req('owner','/workspace/tasks?archived=true')).stats.total,1);
    await req('viewer','/workspace/tasks/'+task.id+'/comments','POST',{text:'Archived'},409);
    task=(await req('manager','/workspace/tasks/'+task.id,'PATCH',{version:task.version,archived:false,status:'review'})).task;
    assert.equal(task.completed_at,null);assert.equal((await req('owner','/workspace/tasks/'+task.id)).events.filter(e=>e.kind==='comment').length,1);
  });
  await t.test('removing an employee clears assignment and sessions but retains authorship and history',async()=>{
    await store.deleteAdmin('editor_two');
    const r=await req('owner','/workspace/tasks/'+task.id);assert.equal(r.task.assignee,null);assert.ok(r.events.some(e=>e.actor==='editor_two'));
    await req('editor_two','/workspace/tasks','GET',undefined,401);
  });
  await t.test('bounded pagination returns every task once in stable order',async()=>{
    await db.q(`INSERT INTO team_tasks(id,title,created_by,updated_by) SELECT md5(i::text)::uuid,'Fixture '||i,'owner','owner' FROM generate_series(1,105) i`);
    const a=await req('owner','/workspace/tasks'),b=await req('owner','/workspace/tasks?offset=100');
    assert.equal(a.tasks.length,100);assert.equal(a.has_more,true);assert.equal(a.stats.total,106);assert.equal(b.tasks.length,6);assert.equal(b.has_more,false);assert.equal(new Set([...a.tasks,...b.tasks].map(t=>t.id)).size,106);
  });
});
