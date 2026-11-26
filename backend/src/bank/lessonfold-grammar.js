const {topics}=require('../learning/grammar'),{contentOf,plainContent}=require('../learning/grammar-content');
const core=topics.filter(t=>!t.book_id&&t.lesson);
const books=['Английский язык','Французский язык'].map((subject,i)=>({id:i?'lf-french-grammar':'lf-english-grammar',subject,grammar:true,title:i?'Lessonfold: французская грамматика с нуля':'Lessonfold: английская грамматика по темам',short:i?'Французская тетрадь':'Грамматика Lessonfold',level:i?'A1':'A1–B1',notice:'Авторские объяснения и практика Lessonfold. Можно взять за основу личной грамматической тетради ученика.',units:core.filter(t=>t.subject===subject).map((t,i)=>({code:String(i+1),title:t.title,topics:t.aliases.slice(0,3).join(', '),grammar_key:t.id}))}));
const sheet=qs=>({type:'sheet',blocks:qs.map(q=>q.type==='choice'?{t:'choice',q:q.prompt,options:q.options,correct:q.correct[0]}:{t:'gaps',text:q.prompt.replace('___',`[${q.correct.join('|')}]`)})});
const items=books.flatMap(b=>b.units.flatMap(u=>{const t=topics.find(t=>t.id===u.grammar_key),key=`lf-note-${t.id}`;return [
 {key:key+'-theory',book:b.id,unit:u.code,kind:'theory',title:t.title+': подробное объяснение',body:plainContent(contentOf(t))+'\n\nАвторский материал Lessonfold.'},
 {key:key+'-warmup',book:b.id,unit:u.code,title:t.title+': 1. Основа',game:sheet(t.questions)},
 {key:key+'-apply',book:b.id,unit:u.code,title:t.title+': 2. Закрепление',game:sheet(t.practice_questions.filter(q=>q.id.startsWith('p')))},
 ];}));
module.exports={books,items};
