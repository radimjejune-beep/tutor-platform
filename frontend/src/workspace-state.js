// Per-account workspace preferences and scroll; no data is sent to third-party services.
const positions=new Map(),pending=new Map(),handled=new WeakSet();let account='anon';
export function setWorkspaceUser(id){const next=id?String(id):'anon';if(next!==account){account=next;positions.clear();pending.clear();}}
export function readWorkspace(name,fallback){try{return {...fallback,...JSON.parse(sessionStorage.getItem(`lf-workspace:${account}:${name}`)||'{}')};}catch{return fallback;}}
export function saveWorkspace(name,value){try{sessionStorage.setItem(`lf-workspace:${account}:${name}`,JSON.stringify(value));}catch{}}
export function workspaceFamily(route){const p=String(route||'/').split('?')[0];if(/^\/bank(?:\/|$)/.test(p))return 'bank';if(/^\/library(?:\/(?:all|tasks|games|lessons|theory|books))?$/.test(p))return 'library';if(p==='/homework')return 'homework';return '';}
export function prepareWorkspaceScroll(event){
 if(handled.has(event))return;handled.add(event);
 const from=event.oldURL?(new URL(event.oldURL).hash.slice(1)||'/'):'/',to=event.newURL?(new URL(event.newURL).hash.slice(1)||'/'):(window.location.hash.slice(1)||'/'),a=workspaceFamily(from),b=workspaceFamily(to),y=window.scrollY;
 if(a)positions.set(from,y);
 if(a&&a===b){pending.set(to,y);return;}
 if(b&&positions.has(to))pending.set(to,positions.get(to));
 window.scrollTo(0,0);
}
export function finishWorkspaceScroll(){const route=window.location.hash.slice(1)||'/',y=pending.get(route);if(y===undefined)return;pending.delete(route);requestAnimationFrame(()=>window.scrollTo({top:y,left:0,behavior:'instant'}));}
