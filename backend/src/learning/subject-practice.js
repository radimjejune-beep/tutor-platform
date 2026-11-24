'use strict';
// Other subjects use the teacher's own answer keys. Manual writing/voice grades
// and self-assessment checklists never become automatically checked questions.
const quiz=require('../services/quiz'),games=require('../services/games'),inline=require('../services/inline-choice');
function questionsFrom(game,details=[],topicId){
 const out=[],add=q=>{const value={id:'s'+(out.length+1),type:q.type||'text',prompt:q.prompt,options:q.options||[],correct:q.correct,points:1};if(quiz.questionsSchema.element.safeParse(value).success)out.push({...value,topic_id:topicId,explanation:''});};
 if(game?.type!=='sheet')return out;
 for(const a of details.filter(x=>x.ok===false&&!x.manual)){
  const b=game.blocks?.[a.block];if(!b)continue;
  if(b.t==='choice')add({type:'choice',prompt:b.q,options:b.options,correct:[b.correct]});
  if(b.t==='rewrite')add({prompt:[b.q,b.src].filter(Boolean).join('\n'),correct:b.a.split('|').map(s=>s.trim()).filter(Boolean)});
  if(b.t==='gaps'){
   const p=games.parseGaps(b.text);if(!p.gaps[a.k])continue;
   const prompt=p.parts.map((part,i)=>part+(i<p.gaps.length?(i===a.k?'___':p.gaps[i][0]):'')).join('');add({prompt,correct:p.gaps[a.k]});
  }
  if(b.t==='inline'){
   const p=inline.parseInlineChoices(b.text);if(p.errors.length||!p.choices[a.k])continue;const c=p.choices[a.k];
   const prompt=p.parts.map((part,i)=>part+(i<p.choices.length?(i===a.k?'___':p.choices[i].options[p.choices[i].correct]):'')).join('');add({type:'choice',prompt,options:c.options,correct:[c.correct]});
  }
 }
 const unique=new Map(out.map(q=>[JSON.stringify([q.prompt,q.correct]),q]));return [...unique.values()];
}
async function candidates(studentId,db,subject){
 const {rows}=await db.query(`SELECT * FROM (SELECT DISTINCT ON(r.item_id) r.id,r.item_id,r.score,r.total,r.correct,r.details,r.created_at,r.homework_id,i.title,i.game FROM game_results r JOIN library_items i ON i.id=r.item_id JOIN students s ON s.id=r.student_id WHERE r.student_id=$1 AND r.subject=$2 AND i.subject=$2 AND i.tutor_id=s.tutor_id AND r.created_at>NOW()-INTERVAL '180 days' ORDER BY r.item_id,r.created_at DESC,r.id DESC) latest WHERE score<80 AND total>=3 ORDER BY created_at DESC LIMIT 30`,[studentId,subject]);
 return rows.map(r=>({topic_id:'item-'+r.item_id,title:r.title,reason:`В последнем выполнении: ${r.correct} из ${r.total}. Повторяем задания с ошибками из этой работы.`,status:'practice',source:{kind:'exercise',id:r.id,total:r.total,score:r.score,at:r.created_at,title:r.title,link:r.homework_id?'/homework/'+r.homework_id:null},questions:questionsFrom(r.game,r.details,'item-'+r.item_id)})).filter(t=>t.questions.length);
}
module.exports={questionsFrom,candidates};
