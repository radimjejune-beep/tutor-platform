export function assignmentForStudent(a,student='all'){
 if(student==='all')return a;
 const recipients=(a.recipients||[]).filter(r=>String(r.student_id)===String(student));if(!recipients.length)return null;
 return {...a,total:recipients.length,submitted:recipients.filter(r=>r.status==='submitted').length,checked:recipients.filter(r=>r.status==='checked').length,overdue:recipients.filter(r=>r.status==='assigned'&&a.due_on&&a.due_on.slice(0,10)<new Date().toLocaleDateString('en-CA')).length,students:recipients.map(r=>r.student_name),homework_sections:recipients.map(r=>({id:r.section_id,title:(a.homework_sections||[]).find(s=>s.id===r.section_id)?.title})),recipients};
}
export function assignmentView(a,view){if(view==='archive')return !!a.archived_at;if(view==='all')return true;if(a.archived_at)return false;if(view==='review')return a.submitted>0;if(view==='history')return a.total>0&&a.checked>=a.total;return !a.total||a.checked<a.total;}
export function sortAssignments(a,b){return Number(b.submitted>0)-Number(a.submitted>0)||(a.due_on||'9999').localeCompare(b.due_on||'9999')||String(b.created_at).localeCompare(String(a.created_at));}
