'use strict';
const {pool}=require('../db');
const listeners=new Map();
let connection=null,connecting=null,closing=null,retry=null,stopTimer=null;
const count=()=>[...listeners.values()].reduce((n,a)=>n+a.size,0);
function emit(key){for(const fn of listeners.get(Number(key))||[])fn();}
function schedule(){if(!retry&&count())retry=setTimeout(()=>{retry=null;connect().catch(()=>{});},2000).unref();}
function release(owned,bad=false){
 if(owned.released)return;owned.released=true;
 owned.client.removeListener('notification',owned.notify);
 owned.client.removeListener('error',owned.error);
 owned.client.release(bad);
}
async function connect(){
 if(closing)await closing;
 if(connection)return;if(connecting)return connecting;
 connecting=(async()=>{
  let owned;
  try{
   const client=await pool.connect();
   owned={client,released:false};
   owned.notify=m=>{if(m.channel==='lessonfold_live'&&/^\d{1,10}$/.test(m.payload||''))emit(m.payload);};
   owned.error=()=>{if(connection===owned)connection=null;release(owned,true);schedule();};
   client.on('error',owned.error);client.on('notification',owned.notify);
   await client.query('LISTEN lessonfold_live');connection=owned;
   for(const key of listeners.keys())emit(key);
  }catch(e){if(owned)release(owned,true);schedule();throw e;}
 })().finally(()=>{connecting=null;});
 return connecting;
}
async function subscribe(key,fn){
 clearTimeout(stopTimer);
 if(!listeners.has(key))listeners.set(key,new Set());listeners.get(key).add(fn);
 await connect().catch(()=>{});
 let used=false;
 return()=>{
  if(used)return;used=true;listeners.get(key)?.delete(fn);
  if(!listeners.get(key)?.size)listeners.delete(key);
  if(!count())stopTimer=setTimeout(()=>close().catch(()=>{}),1000).unref();
 };
}
async function close(){
 if(closing)return closing;
 closing=(async()=>{
  clearTimeout(retry);clearTimeout(stopTimer);retry=null;
  await connecting?.catch(()=>{});
  const owned=connection;connection=null;
  if(owned){try{await owned.client.query('UNLISTEN lessonfold_live');release(owned);}catch{release(owned,true);}}
 })().finally(()=>{closing=null;if(count())connect().catch(()=>{});});
 return closing;
}
module.exports={subscribe,close};
