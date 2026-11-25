import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('public reset redeems an email token; teacher reset keeps the account endpoint', async()=>{
 const source=await readFile(new URL('../src/api.js',import.meta.url),'utf8');
 const requests=[];
 const context=vm.createContext({URLSearchParams,AbortController,setTimeout,clearTimeout,
  fetch:async(url,init)=>{requests.push({url,method:init.method,body:JSON.parse(init.body)});return {ok:true,status:200,json:async()=>({ok:true})};},
  resolveApiBase:()=> 'https://api.example.test'});
 // Execute the real client module with build-time imports supplied by the harness.
 vm.runInContext(source.replace(/^import .*;$/m,'').replaceAll('import.meta.env.VITE_API_URL',"''").replaceAll('export ', '')+'\nglobalThis.client=api;',context);
 await context.client.completePasswordReset('email-reset-token','new-password');
 await context.client.resetPassword(42,'teacher-password');
 assert.deepEqual(JSON.parse(JSON.stringify(requests)),[
  {url:'https://api.example.test/api/auth/reset',method:'POST',body:{token:'email-reset-token',password:'new-password'}},
  {url:'https://api.example.test/api/accounts/42/reset-password',method:'POST',body:{password:'teacher-password'}}
 ]);
});
