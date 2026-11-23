import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMistakePractice, exerciseProgress, exerciseInstruction } from '../src/games/experience.js';
import { grade } from '../src/games/logic.js';

test('a focused retrieval practice keeps alternatives, removes timer and never mutates its source', () => {
 const game={type:'quick',template:'quiz',timer:60,items:[{q:'hello',a:'привет|здравствуй',wrong:['пока']},{q:'bye',a:'пока'}]};
 const result=grade(game,{r:{0:'пока',1:'пока'}}), before=JSON.stringify({game,result});
 const p=buildMistakePractice(game,result);
 assert.deepEqual(p,{type:'quick',template:'type',timer:0,items:[{q:'hello',a:'привет|здравствуй'}]});
 assert.equal(grade(p,{r:{0:'Здравствуй'}}).score,100);
 assert.equal(JSON.stringify({game,result}),before);
 assert.equal(result.score,50);
});
test('mistakes retain full sentence context in a gap exercise',()=>{
 const g={type:'gaps',mode:'bank',text:'She [works] here. [Does|does] he work here?',distractors:['Do']};
 const p=buildMistakePractice(g,grade(g,{gaps:['works','Do']}));
 assert.equal(p.text,'She works here. [Does|does] he work here?');
 assert.equal(exerciseProgress(p,{}).total,1);
 assert.equal(grade(p,{gaps:['does']}).score,100);
});
test('sentence and group subsets retain the correct original answers',()=>{
 const order={type:'order',sentences:['I like tea.','She likes coffee.']};
 assert.deepEqual(buildMistakePractice(order,grade(order,{sentences:[['I','like','tea.']]})).sentences,['She likes coffee.']);
 const g={type:'groups',groups:[{name:'food',items:['toast','soup']},{name:'drinks',items:['tea']}]};
 const p=buildMistakePractice(g,grade(g,{items:{'0-0':0,'0-1':1,'1-0':1}}));
 assert.deepEqual(p.groups,[{name:'food',items:['soup']},{name:'drinks',items:[]}]);
 assert.equal(grade(p,{items:{'0-0':0}}).score,100);
});
test('matching and anagram mistakes become unprompted retrieval',()=>{
 const m={type:'match',pairs:[{a:'hello',b:'привет'},{a:'bye',b:'пока'}]};
 assert.deepEqual(buildMistakePractice(m,grade(m,{pairs:{0:0}})).items,[{q:'bye',a:'пока'}]);
 const a={type:'quick',template:'anagram',items:[{q:'cat',a:'кот'}]};
 assert.deepEqual(buildMistakePractice(a,grade(a,{})).items,[{q:'кот',a:'cat'}]);
});
test('manual answers and dependent free-layout boards are not regraded as automatic practice',()=>{
 const g={type:'sheet',blocks:[{t:'choice',q:'?',options:['a','b'],correct:1},{t:'open',q:'Write'}]};
 const r=grade(g,{b:{0:0,1:'My answer'}});
 assert.equal(buildMistakePractice(g,r).blocks.length,1);
 assert.equal(buildMistakePractice({type:'sheet',blocks:[g.blocks[1]]},{details:[{block:0,ok:null,manual:true}]}),null);
 assert.equal(buildMistakePractice({type:'board',elements:[]},{details:[{el:'x',ok:false}]}),null);
 assert.equal(buildMistakePractice(g,{details:[{ok:true}]}),null);
});
test('progress counts answers, including honest false self-assessments, rather than correct grades',()=>{
 const g={type:'quick',template:'flip',items:[{},{}]};
 assert.deepEqual(exerciseProgress(g,{r:{0:false,1:true}}),{total:2,done:2,percent:100});
 assert.equal(exerciseProgress({...g,template:'memory'},{found:[0,0]}).done,1);
 assert.equal(exerciseProgress({type:'gaps',text:'[yes] [no]'},{gaps:[' ','no']}).done,1);
 assert.equal(exerciseProgress({type:'sheet',blocks:[]}),null);
 assert.match(exerciseInstruction({type:'quick',template:'type'}),/Enter/);
});

test('writing plans and self-check marks cannot improve an empty or incorrect grade',()=>{
 const g={type:'sheet',blocks:[{t:'write',q:'Write',min_words:10,caps:true,stop:true,checks:[]}]};
 const a={b:{0:'hi'},writing:{0:{plan:{ideas:'A long plan with many words and a correct sentence.'},review:{0:true,1:true,2:true,3:true}}}};
 assert.deepEqual(grade(g,a),grade(g,{b:{0:'hi'}}));
 assert.equal(grade(g,a).manual,1);
 assert.equal(grade(g,a).score,0);
});
