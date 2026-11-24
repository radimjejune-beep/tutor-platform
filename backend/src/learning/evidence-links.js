'use strict';
async function resolve(studentId,tid,ref,db){
 if(!ref)return null;
 let row;
 if(ref.kind==='homework')row=(await db.query(`SELECT h.id,a.id AS assignment_id,a.title,h.subject FROM homework h JOIN assignments a ON a.id=h.assignment_id JOIN students s ON s.id=h.student_id WHERE h.id=$1 AND h.student_id=$2 AND s.tutor_id=$3 AND a.tutor_id=$3 AND h.status='checked'`,[ref.id,studentId,tid])).rows[0];
 if(ref.kind==='writing')row=(await db.query("SELECT id,title,subject FROM writing_threads WHERE id=$1 AND student_id=$2 AND tutor_id=$3 AND state='accepted'",[ref.id,studentId,tid])).rows[0];
 if(ref.kind==='diagnostic')row=(await db.query(`SELECT r.id,t.title,r.subject FROM diagnostic_runs r JOIN diagnostic_tests t ON t.id=r.test_id WHERE r.id=$1 AND r.student_id=$2 AND t.tutor_id=$3 AND r.submitted_at IS NOT NULL`,[ref.id,studentId,tid])).rows[0];
 if(ref.kind==='workout')row=(await db.query(`SELECT w.id,w.subject,'Персональная разминка' title FROM personal_workouts w JOIN students s ON s.id=w.student_id WHERE w.id=$1 AND w.student_id=$2 AND s.tutor_id=$3 AND w.submitted_at IS NOT NULL`,[ref.id,studentId,tid])).rows[0];
 if(!row)return null;
 const route=ref.kind==='writing'?`/writing/${row.id}`:ref.kind==='diagnostic'?`/diagnostics/runs/${row.id}`:ref.kind==='workout'?`/workouts/${row.id}`:`/homework/${row.id}`;
 return {kind:ref.kind,id:row.id,title:row.title,subject:row.subject,student_link:route,tutor_link:ref.kind==='homework'?`/homework/${row.assignment_id}/review/${row.id}`:route};
}
async function options(studentId,tid,db,subject){
 const {rows}=await db.query(`SELECT 'homework' kind,h.id,a.title,h.reviewed_at at FROM homework h JOIN assignments a ON a.id=h.assignment_id WHERE h.student_id=$1 AND a.tutor_id=$2 AND h.status='checked' AND h.subject=$3
 UNION ALL SELECT 'writing',id,title,accepted_at FROM writing_threads WHERE student_id=$1 AND tutor_id=$2 AND state='accepted' AND subject=$3
 UNION ALL SELECT 'diagnostic',r.id,t.title,r.submitted_at FROM diagnostic_runs r JOIN diagnostic_tests t ON t.id=r.test_id WHERE r.student_id=$1 AND t.tutor_id=$2 AND r.submitted_at IS NOT NULL AND r.subject=$3
 UNION ALL SELECT 'workout',w.id,'Персональная разминка',w.submitted_at FROM personal_workouts w JOIN students s ON s.id=w.student_id WHERE w.student_id=$1 AND s.tutor_id=$2 AND w.submitted_at IS NOT NULL AND w.subject=$3
 ORDER BY at DESC NULLS LAST LIMIT 60`,[studentId,tid,subject]);return rows;
}
module.exports={resolve,options};
