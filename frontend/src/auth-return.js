export function safeReturn(value){return typeof value==='string'&&/^\/(?!\/)[a-zA-Z0-9/_?=&%.:-]*$/.test(value)&&!['/login','/register','/learn-register','/reset'].includes(value.split('?')[0])?value:'/';}
export function returnFromLocation(){const q=(window.location.hash.split('?')[1]||'');return safeReturn(new URLSearchParams(q).get('return'));}
