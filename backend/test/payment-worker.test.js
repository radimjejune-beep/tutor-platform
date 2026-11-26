const test=require('node:test'),assert=require('node:assert/strict');
const {startWorker}=require('../lessonfold/src/worker');
test('financial worker is independent, catches task failures, prevents overlap and stops cleanly',async()=>{
 let release,charges=0,mail=0,cleared=0;const errors=[],callbacks=[];
 const timers={setInterval(fn){callbacks.push(fn);return {unref(){}}},clearInterval(){cleared++;}};
 const bot=startWorker({name:'bot',timers,interval:900000,onError:e=>errors.push(e.message),tasks:[()=>new Promise(resolve=>{release=resolve;})]});
 const payment=startWorker({name:'payments',timers,interval:60000,onError:e=>errors.push(e.message),tasks:[async()=>{charges++;throw Error('one API call failed')},async()=>{mail++;}]});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(charges,1);assert.equal(mail,1);assert.equal(await bot.run(),false);
 await callbacks[1]();assert.equal(charges,2);assert.equal(mail,2);assert.equal(errors.length,2);
 bot.stop();payment.stop();release();await new Promise(resolve=>setImmediate(resolve));assert.equal(await payment.run(),false);assert.equal(cleared,2);
});
