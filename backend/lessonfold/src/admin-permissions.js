const CAP={
 admin:['all'],
 manager:['workspace','reports','catalog_read','orders_read','orders_write','mail_read','mail_write','subscriptions_read'],
 editor:['workspace','catalog_read','catalog_write'],
 finance:['workspace','reports','orders_read','subscriptions_read','catalog_read'],
};
function permissions(role){return CAP[role]||[];}
function allows(role,route,method){
 const caps=permissions(role);if(caps.includes('all'))return true;
 if(['/me','/logout','/password'].includes(route))return true;
 let needed;
 if(route.startsWith('/workspace/'))needed='workspace';
 else if(route.startsWith('/catalog'))needed=method==='GET'?'catalog_read':'catalog_write';
 else if(route.startsWith('/files'))needed='catalog_write';
 else if(route==='/sales/summary'||route==='/stats'||route.startsWith('/authors'))needed='reports';
 else if(route.startsWith('/sales/subscriptions'))needed=method==='GET'?'subscriptions_read':'subscriptions_write';
 else if(route.startsWith('/sales/mail'))needed=method==='GET'?'mail_read':'mail_write';
 else if(route==='/sales/buyers'||route==='/orders')needed='orders_read';
 else if(route.startsWith('/orders'))needed=route.endsWith('/refund')?'refund':'orders_write';
 else if(route==='/ready')needed='orders_read';
 else return false;
 return caps.includes(needed);
}
module.exports={permissions,allows};
