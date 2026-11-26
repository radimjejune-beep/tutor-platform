// Shared ordering used by the daily workspace. Sorting never mutates API results.
export function prioritizeHomework(rows=[]) {
  const rank={assigned:0,submitted:1,checked:2};
  return [...rows].sort((a,b)=>(rank[a.status]??3)-(rank[b.status]??3)||(a.due_on||'9999').localeCompare(b.due_on||'9999')||String(b.created_at||'').localeCompare(String(a.created_at||''))||Number(b.id)-Number(a.id));
}
export function splitLessons(rows=[],now=Date.now()) {
  const valid=rows.filter(l=>Number.isFinite(Date.parse(l.starts_at)));
  return {
    upcoming:valid.filter(l=>Date.parse(l.starts_at)+(Number(l.duration_min)||60)*60000>now&&l.status==='scheduled').sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at)),
    history:valid.filter(l=>Date.parse(l.starts_at)+(Number(l.duration_min)||60)*60000<=now||l.status!=='scheduled').sort((a,b)=>Date.parse(b.starts_at)-Date.parse(a.starts_at)),
  };
}
export function reviewDestination(a) {
  const pending=(a.recipients||[]).find(r=>r.status==='submitted'&&(r.homework_id||r.id));
  return pending?`/homework/${a.id}/review/${pending.homework_id||pending.id}`:`/homework/${a.id}`;
}
export function normalizeTray(items) {
  const seen=new Set();return (Array.isArray(items)?items:[]).filter(i=>i&&['library','bank'].includes(i.source)&&Number.isSafeInteger(Number(i.id))&&Number(i.id)>0&&typeof i.title==='string').map(i=>({...i,id:Number(i.id),title:i.title.slice(0,200)})).filter(i=>{const key=i.source+':'+i.id;if(seen.has(key))return false;seen.add(key);return true;}).slice(0,40);
}
