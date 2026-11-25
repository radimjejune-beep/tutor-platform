'use strict';
// Internal team work only. Customer, payment and teaching access remain separate.
const db = require('./db');
const {randomUUID} = require('crypto');
const STATUSES = ['todo', 'doing', 'review', 'done'];
const CATEGORIES = ['lessons', 'platform', 'sales', 'support', 'other'];
const fail = (text, status = 422) => { throw Object.assign(new Error(text), {status}); };
const editable = (task, profile) => ['admin', 'manager'].includes(profile.role) || task.created_by === profile.login || task.assignee === profile.login;
const today = "(now() AT TIME ZONE 'Europe/Moscow')::date";

async function ensure() {
  await db.q(`CREATE TABLE IF NOT EXISTS team_tasks (
    id UUID PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo','doing','review','done')),
    category TEXT NOT NULL DEFAULT 'other' CHECK(category IN ('lessons','platform','sales','support','other')),
    priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('normal','high')),
    assignee TEXT REFERENCES admins(login) ON DELETE SET NULL, due_date DATE,
    checklist JSONB NOT NULL DEFAULT '[]', archived BOOLEAN NOT NULL DEFAULT false,
    created_by TEXT NOT NULL, updated_by TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), completed_at TIMESTAMPTZ
  );
  CREATE INDEX IF NOT EXISTS team_tasks_queue ON team_tasks(archived, status, due_date);
  CREATE INDEX IF NOT EXISTS team_tasks_assignee ON team_tasks(assignee, archived);
  CREATE TABLE IF NOT EXISTS team_task_events (
    id BIGSERIAL PRIMARY KEY, task_id UUID NOT NULL REFERENCES team_tasks(id) ON DELETE CASCADE,
    actor TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('created','updated','comment')),
    content JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS team_task_events_task ON team_task_events(task_id, id);`);
}

function clean(body, previous = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Некорректная задача');
  const b = {...previous, ...body};
  if (typeof b.title !== 'string' || !b.title.trim() || b.title.trim().length > 160) fail('Название: от 1 до 160 символов');
  if (typeof b.description !== 'string' || b.description.length > 12000) fail('Описание: не более 12 000 символов');
  if (!STATUSES.includes(b.status) || !CATEGORIES.includes(b.category) || !['normal', 'high'].includes(b.priority)) fail('Проверьте статус, направление и приоритет');
  if (b.assignee !== null && (typeof b.assignee !== 'string' || b.assignee.length > 254)) fail('Выберите сотрудника');
  if (b.due_date !== null && (typeof b.due_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.due_date) || b.due_date < '1900-01-01' || !Number.isFinite(Date.parse(b.due_date)) || new Date(b.due_date).toISOString().slice(0,10) !== b.due_date)) fail('Некорректный срок');
  if (typeof b.archived !== 'boolean') fail('Некорректное состояние архива');
  if (!Array.isArray(b.checklist) || b.checklist.length > 30) fail('В чек-листе может быть не более 30 пунктов');
  const checklist = b.checklist.map(item => {
    if (!item || typeof item.text !== 'string' || !item.text.trim() || item.text.length > 300 || typeof item.done !== 'boolean') fail('Проверьте пункты чек-листа');
    return {text: item.text.trim(), done: item.done};
  });
  return {title:b.title.trim(), description:b.description, status:b.status, category:b.category, priority:b.priority, assignee:b.assignee, due_date:b.due_date, checklist, archived:b.archived};
}
const fields = ['title','description','status','category','priority','assignee','due_date','checklist','archived'];
const idOf = id => { if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id))) fail('Задача не найдена',404); return id; };
const projection = "t.*, to_char(t.due_date,'YYYY-MM-DD') AS due_date";
async function members() {
  return (await db.q('SELECT login,display_name FROM admins ORDER BY COALESCE(display_name,login),login')).rows;
}
async function list(params, profile) {
  const conditions=['t.archived=$1'], args=[params.get('archived') === 'true'];
  const add = (sql, value) => { args.push(value); conditions.push(sql.replace('?', '$'+args.length)); };
  if (params.get('scope') === 'mine') add('t.assignee=?', profile.login);
  if (params.get('scope') === 'overdue') conditions.push(`t.due_date < ${today} AND t.status <> 'done'`);
  if (CATEGORIES.includes(params.get('category'))) add('t.category=?', params.get('category'));
  if (STATUSES.includes(params.get('status'))) add('t.status=?', params.get('status'));
  const q = (params.get('q') || '').trim().slice(0,160);
  if(q) add("strpos(lower(t.title || ' ' || t.description),lower(?)) > 0", q);
  const where=conditions.join(' AND '), offset=Math.min(100000,Math.max(0,parseInt(params.get('offset'),10)||0));
  const stats=(await db.q(`SELECT count(*)::int AS total,
    count(*) FILTER(WHERE status='done')::int AS done,
    count(*) FILTER(WHERE status='doing')::int AS doing,
    count(*) FILTER(WHERE due_date < ${today} AND status <> 'done')::int AS overdue
    FROM team_tasks t WHERE ${where}`,args)).rows[0];
  const tasks=(await db.q(`SELECT ${projection} FROM team_tasks t WHERE ${where}
    ORDER BY CASE WHEN status='done' THEN 1 ELSE 0 END, CASE WHEN priority='high' THEN 0 ELSE 1 END,
    t.due_date ASC NULLS LAST, t.created_at DESC, t.id LIMIT 100 OFFSET $${args.length+1}`,[...args,offset])).rows;
  return {tasks:tasks.map(t=>({...t,can_edit:editable(t,profile)})),stats,has_more:offset+tasks.length<stats.total};
}
async function get(id,profile) {
  const task=(await db.q(`SELECT ${projection} FROM team_tasks t WHERE id=$1`,[idOf(id)])).rows[0];
  if(!task)fail('Задача не найдена',404);
  const events=(await db.q('SELECT id,actor,kind,content,created_at FROM team_task_events WHERE task_id=$1 ORDER BY id DESC LIMIT 100',[id])).rows.reverse();
  return {task:{...task,can_edit:editable(task,profile)},events};
}
async function save(id,body,profile) {
  return db.transaction(async c=>{
    let old;
    if(id) {
      old=(await c.query(`SELECT ${projection} FROM team_tasks t WHERE id=$1 FOR UPDATE`,[idOf(id)])).rows[0];
      if(!old)fail('Задача не найдена',404);
      if(!editable(old,profile))fail('Изменять задачу может автор, ответственный или руководитель',403);
      if(!Number.isSafeInteger(body?.version) || body.version!==old.version)fail('Коллега уже изменил задачу. Обновите её перед сохранением; ваши правки остались в форме.',409);
    }
    const value=clean(body,old||{description:'',status:'todo',category:'other',priority:'normal',assignee:null,due_date:null,checklist:[],archived:false});
    if(value.assignee && !(await c.query('SELECT 1 FROM admins WHERE login=$1 FOR KEY SHARE',[value.assignee])).rowCount)fail('Сотрудник больше не состоит в команде');
    const changes=fields.filter(k=>JSON.stringify(old?.[k])!==JSON.stringify(value[k]));
    if(old&&!changes.length)return {task:{...old,can_edit:true}};
    const values=fields.map(k=>k==='checklist'?JSON.stringify(value[k]):value[k]);
    id=id||randomUUID();
    let task;
    if(old) task=(await c.query(`UPDATE team_tasks SET ${fields.map((k,i)=>k+'=$'+(i+2)).join(',')},
      updated_by=$11, updated_at=now(), version=version+1, completed_at=CASE WHEN $4='done' THEN COALESCE(completed_at,now()) ELSE NULL END
      WHERE id=$1 RETURNING *,to_char(due_date,'YYYY-MM-DD') AS due_date`,[id,...values,profile.login])).rows[0];
    else task=(await c.query(`INSERT INTO team_tasks(id,${fields.join(',')},created_by,updated_by,completed_at)
      VALUES($1,${fields.map((_,i)=>'$'+(i+2)).join(',')},$11,$11,CASE WHEN $4='done' THEN now() ELSE NULL END)
      RETURNING *,to_char(due_date,'YYYY-MM-DD') AS due_date`,[id,...values,profile.login])).rows[0];
    await c.query('INSERT INTO team_task_events(task_id,actor,kind,content) VALUES($1,$2,$3,$4)',[id,profile.login,old?'updated':'created',JSON.stringify({fields:changes})]);
    return {task:{...task,can_edit:true}};
  });
}
async function comment(id,body,profile) {
  idOf(id);
  const text=typeof body?.text==='string'?body.text.trim():'';
  if(!text || text.length>4000)fail('Комментарий: от 1 до 4 000 символов');
  return db.transaction(async c=>{
    const task=(await c.query('SELECT archived FROM team_tasks WHERE id=$1 FOR SHARE',[id])).rows[0];
    if(!task)fail('Задача не найдена',404);
    if(task.archived)fail('Сначала верните задачу из архива',409);
    const event=(await c.query("INSERT INTO team_task_events(task_id,actor,kind,content) VALUES($1,$2,'comment',$3) RETURNING id,actor,kind,content,created_at",[id,profile.login,JSON.stringify({text})])).rows[0];
    return {event};
  });
}
module.exports={ensure,members,list,get,save,comment};
