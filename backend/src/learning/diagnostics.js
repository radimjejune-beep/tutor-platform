const { randomInt } = require('crypto');
const { z } = require('zod');
const catalog = require('./grammar');
const quiz = require('../services/quiz');
const { query } = require('../db');
const topicKey = z.string().refine(id => catalog.byId.has(id), 'Выберите тему из справочника');
const question = quiz.questionsSchema.element.extend({
  topic_id: topicKey,
  explanation:z.string().trim().max(2000).default(''),
}).superRefine((q,ctx)=>{
  if(!/^[a-zA-Z0-9_-]{1,20}$/.test(q.id)||['__proto__','constructor','prototype'].includes(q.id))ctx.addIssue({code:'custom',message:'Некорректный номер вопроса'});
  if(q.type==='choice' && new Set(q.options.map(quiz.normalize)).size!==q.options.length)
    ctx.addIssue({code:'custom',message:'Варианты ответа должны различаться'});
});
const questions = z.array(question).min(1).max(50).refine(q=>new Set(q.map(x=>x.id)).size===q.length,'Повторяются номера вопросов');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>{
  const d=new Date(s+'T00:00:00Z'); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10)===s;
},'Некорректная дата');
const answers = z.record(z.string().max(20),z.union([z.string().max(1000),z.number().int().min(0).max(7)])).refine(a=>Object.keys(a).length<=50,'Слишком много ответов');
function shuffle(a) {
  const b=[...a];for(let i=b.length-1;i>0;i--){const j=randomInt(i+1);[b[i],b[j]]=[b[j],b[i]];}return b;
}
function shuffledQuestion(q,id=q.id) {
  if(q.type!=='choice')return {...q,id};
  const order=shuffle(q.options.map((_,i)=>i));
  return {...q,id,options:order.map(i=>q.options[i]),correct:[order.indexOf(q.correct[0])]};
}
function generate(ids, perTopic) {
  if(ids.length*perTopic>50)throw Object.assign(new Error('В тесте не больше 50 вопросов. Уменьшите число тем или вопросов.'),{status:400});
  return shuffle(ids.flatMap(id=>shuffle(catalog.byId.get(id).questions).slice(0,perTopic)))
    .map((q,i)=>shuffledQuestion(q,`q${i+1}`));
}
function publicQuestions(qs) { return qs.map(({correct,explanation,...q})=>q); }
function assess(qs, given={}) {
  // Строгий тип: boolean, null и пустой ответ не могут превратиться в вариант 0.
  const clean={};
  for(const q of qs){const a=given[q.id];if(q.type==='choice' ? Number.isInteger(a)&&a>=0&&a<q.options.length : typeof a==='string')clean[q.id]=a;}
  const result=quiz.grade(qs,clean), groups=new Map();
  for(const q of qs){
    if(!groups.has(q.topic_id))groups.set(q.topic_id,{topic_id:q.topic_id,title:catalog.byId.get(q.topic_id)?.label||catalog.byId.get(q.topic_id)?.title||q.topic_id,total:0,correct:0,earned:0,points:0});
    const t=groups.get(q.topic_id);t.total++;t.points+=q.points;if(result.results[q.id]){t.correct++;t.earned+=q.points;}
  }
  return {...result,topics:[...groups.values()].map(t=>({...t,score:Math.round(t.earned/t.points*100),
    status:t.total<3?'insufficient':t.earned/t.points<.6?'repeat':t.earned/t.points<.8?'practice':'confident'}))};
}
async function completed(studentId, db={query}, subject=null) {
  const {rows}=await db.query("SELECT title, grammar_key FROM progress_topics WHERE student_id=$1 AND status='done' AND skill='grammar' AND ($2::text IS NULL OR subject=$2) ORDER BY completed_on DESC NULLS LAST,id DESC",[studentId,subject]);
  return [...new Set(rows.map(r=>r.grammar_key).filter(id=>catalog.byId.has(id)))];
}
async function ownSection(db,id,tutorId,subject=null) {
  if(!id)return true;
  return Boolean((await db.query('SELECT id FROM study_sections WHERE id=$1 AND tutor_id=$2 AND ($3::text IS NULL OR subject=$3)',[id,tutorId,subject])).rows[0]);
}
module.exports={topicKey,question,questions,date,answers,shuffle,shuffledQuestion,generate,publicQuestions,assess,completed,ownSection};
