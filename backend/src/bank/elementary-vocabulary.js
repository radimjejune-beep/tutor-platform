'use strict';
const fs=require('fs'),path=require('path');
const id='lf-elementary-vocabulary',title='Lessonfold · Словарная практика A1–A2';
const units=[];
for(const raw of fs.readFileSync(path.join(__dirname,'elementary-vocabulary-data.txt'),'utf8').split('\n')){
 const line=raw.trim();if(!line)continue;
 if(line.startsWith('# ')){const [code,title]=line.slice(2).split('|');units.push({code,title,words:[]});continue;}
 const [term,translation,marked]=line.split('|');
 if(!term||!translation||!marked?.includes('{'+term+'}'))throw Error('Invalid original vocabulary row');
 units.at(-1).words.push({term,translation,marked,example:marked.replace(/[{}]/g,'')});
}
const bank=[],packs=new Map();
const key=(u,name)=>`lfev-${u.code}-${name}`;
const safe=s=>s.replace(/[[\]|]/g,'');
const recall=w=>`(${w.translation}) ${w.marked.replace('{'+w.term+'}','['+safe(w.term)+']')}`;
for(const u of units){
 const w=u.words,keys={};
 const add=(name,label,game,kind='game',body=null)=>{const k=key(u,name);keys[name]=k;bank.push({key:k,book:id,unit:u.code,title:`${u.code}. ${u.title} · ${label}`,kind,game,body});};
 add('guide','слова и план практики',null,'theory',`Авторская практика Lessonfold. Тема для дополнительных занятий рядом с English Vocabulary in Use Elementary, 3rd edition; не материалы Cambridge.\n\n${w.map(x=>`${x.term} — ${x.translation}\n${x.example}`).join('\n\n')}\n\nПорядок: 1) значение и узнавание; 2) контекст и слух; 3) вспоминание и собственная речь. Между этапами сделайте паузу. Повторите слова в словаре в срок, который показывает платформа. Сдача упражнений сама по себе не означает освоение уровня CEFR.`);
 for(let p=0;p<2;p++)add('match'+p,`узнай значение ${p+1}/2`,{type:'match',pairs:w.slice(p*5,p*5+5).map(x=>({a:x.term,b:x.translation}))});
 add('type','вспомни 10 слов',{type:'gaps',mode:'type',distractors:[],text:'Вспомните слова именно из набора этой темы.\n'+w.map(x=>`${x.translation}: [${safe(x.term)}]`).join('\n')});
 add('context','10 слов в контексте',{type:'gaps',mode:'bank',distractors:[],text:w.map(recall).join('\n')});
 add('choice','выбери точное слово',{type:'sheet',blocks:w.map((x,i)=>{
  const options=[x.term,...[1,3,6].map(n=>w[(i+n)%10].term)],correct=i%4;
  [options[0],options[correct]]=[options[correct],options[0]];
  return {t:'choice',q:`${x.translation} · ${x.marked.replace('{'+x.term+'}','_____')}`,options,correct};
 })});
 add('order','собери 5 фраз',{type:'order',sentences:w.filter((_,i)=>i%2===0).map(x=>x.example)});
 add('listen','диктант: 5 выражений',{type:'sheet',blocks:[{t:'text',text:'Послушайте и запишите слово или выражение. Озвучку выполняет браузер, это не аудио Cambridge. Если голос английского языка недоступен, преподаватель может прочитать слова.'},...w.filter((_,i)=>i%2===1).map(x=>({t:'dictation',text:x.term}))]});
 add('recall','самопроверка без банка слов',{type:'gaps',mode:'type',distractors:[],text:'Используйте слова этой темы. Сначала попробуйте без словаря.\n'+[...w.slice(5),...w.slice(0,5)].map(recall).join('\n')});
 add('transfer','свои примеры и мини-диалог',{type:'sheet',blocks:[
  {t:'text',text:`Слова-подсказки: ${w.map(x=>x.term).join(', ')}. Открытые ответы проверяет преподаватель; автоматическая сдача не означает, что речь правильная.`},
  {t:'open',q:`Придумайте реалистичную ситуацию по теме «${u.title}». Напишите 5–7 предложений или реплик, используя не меньше 5 разных выражений из списка. Можно писать о вымышленных героях.`},
  {t:'open',q:`Выберите два выражения из темы, которые было труднее всего запомнить. Для каждого напишите новый пример и вопрос собеседнику. На уроке задайте эти вопросы и уточните ответы.`}
 ]});
 const learn=['guide','match0','match1','type'].map(k=>keys[k]),practice=['context','choice','order','listen'].map(k=>keys[k]),check=['recall','transfer'].map(k=>keys[k]);
 if(Number(u.code)%5===0){
  const chunk=units.slice(Number(u.code)-5,Number(u.code)),selected=chunk.flatMap(t=>t.words.filter((_,i)=>i%2===0));
  add('review',`смешанная проверка тем ${Number(u.code)-4}–${u.code}`,{type:'gaps',mode:'type',distractors:[],text:'Вспомните выражения из последних пяти тем. Русский смысл уточняет, какое слово требуется.\n'+selected.map(recall).join('\n')});check.push(keys.review);
 }
 packs.set(u.code,{learn,practice,check,all:[...learn,...practice,...check]});
}
const book={id,subject:'Английский язык',title:'Словарная практика Lessonfold · к темам English Vocabulary in Use Elementary, 3rd edition',short:'Словарная практика A1–A2',level:'A1–A2',rich_vocab:true,units:units.map(u=>({code:u.code,title:u.title,topics:u.words.map(w=>w.term).join(', ')}))};
module.exports={id,title,units,bank,packs,book};
