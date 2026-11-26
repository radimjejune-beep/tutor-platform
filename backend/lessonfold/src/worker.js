'use strict';
// Each worker has its own interval and cannot overlap itself. Failed tasks do not starve later tasks.
function startWorker({name,tasks,interval,onError=(e)=>console.error(name+' failed',e.message),timers={setInterval,clearInterval}}){
 let running=false,stopped=false;
 const run=async()=>{if(running||stopped)return false;running=true;try{for(const task of tasks){if(stopped)break;try{await task();}catch(e){onError(e);}}return true;}finally{running=false;}};
 const timer=timers.setInterval(run,interval);timer.unref?.();
 run();
 return {run,stop(){stopped=true;timers.clearInterval(timer);}};
}
module.exports={startWorker};
