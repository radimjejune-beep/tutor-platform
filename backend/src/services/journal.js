'use strict';
const {z}=require('zod');
const date=z.string().regex(/^20\d{2}-\d{2}-\d{2}$/,'Выберите дату между 2000 и 2099 годом').refine(value=>{const d=new Date(value+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;},'Такой даты нет в календаре');
const timezone=z.string().max(100).refine(value=>{try{new Intl.DateTimeFormat('ru',{timeZone:value});return true;}catch{return false;}},'Неизвестный часовой пояс');
function currentDay(tz){const p=new Intl.DateTimeFormat('en-US',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const v=key=>p.find(x=>x.type===key).value;return v('year')+'-'+v('month')+'-'+v('day');}
function parse(schema,value){const result=schema.safeParse(value);if(!result.success)throw Object.assign(Error(result.error.issues[0]?.message||'Проверьте данные'),{status:422});return result.data;}
function dayQuery(raw={}){const tz=parse(timezone,raw.timezone||process.env.APP_TIMEZONE||'Europe/Moscow');return {date:parse(date,raw.date||currentDay(tz)),timezone:tz};}
module.exports={date,timezone,currentDay,dayQuery,parse};
