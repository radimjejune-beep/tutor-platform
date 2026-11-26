// Оригинальные пояснения и задания Lessonfold. Издательские упражнения и ключи не используются.
const {MURPHY_BOOKS}=require('./murphy-books');
const {byId}=require('../learning/grammar');
const {contentOf,plainContent}=require('../learning/grammar-content');
module.exports=MURPHY_BOOKS.flatMap(book=>book.units.flatMap(unit=>{
 const t=byId.get(unit.grammar_key),key=`lf-${book.id}-${unit.code}`;
 const reference=`Самостоятельный материал Lessonfold. Ориентир: Raymond Murphy, ${book.title}, Unit ${unit.code}. ${book.notice}`;
 const body=[t.title,'Когда использовать',t.when,plainContent(contentOf(t)),reference].join('\n\n');
 const blocks=t.questions.map(q=>{
   if(q.type==='choice')return {t:'choice',q:q.prompt,options:q.options,correct:q.correct[0]};
   if((q.prompt.match(/___/g)||[]).length!==1)throw new Error(`Expected one gap: ${t.id}/${q.id}`);
   return {t:'gaps',text:q.prompt.replace('___',`[${q.correct.join('|')}]`)};
 });
 return [{key:`${key}-theory`,book:book.id,unit:unit.code,kind:'theory',title:`${unit.title}: объяснение`,body},
  {key:`${key}-practice`,book:book.id,unit:unit.code,kind:'game',title:`${unit.title}: практика`,game:{type:'sheet',blocks}}];
}));
