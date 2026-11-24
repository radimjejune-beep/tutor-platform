'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),games=require('../src/services/games'),practice=require('../src/learning/subject-practice'),d=require('../src/learning/diagnostics');
test('a subject workout uses only authoritative automatically graded wrong answers and keeps sentence context',()=>{
 const game={type:'sheet',blocks:[{t:'choice',q:'2 + 2 = ?',options:['4','5'],correct:0},{t:'gaps',text:'Число [6] делится на [3].'},{t:'rewrite',q:'Упростите',src:'2x + 3x',a:'5x|5*x'},{t:'open',q:'Объясните решение'},{t:'write',q:'Рассуждение'}]};
 const qs=practice.questionsFrom(game,[{block:0,ok:false},{block:1,k:1,ok:false},{block:2,ok:false},{block:3,ok:null,manual:true},{block:4,ok:false}], 'item-1');
 assert.equal(qs.length,3);assert.equal(qs[1].prompt,'Число 6 делится на ___.');assert.deepEqual(qs[2].correct,['5x','5*x']);assert.equal(d.assess(qs,Object.fromEntries(qs.map(q=>[q.id,q.correct[0]]))).score,100);
 assert.equal(practice.questionsFrom(game,[{block:0,ok:true}], 'item-1').length,0);
});
test('inline alternatives from any subject preserve completed context in focused practice',()=>{
 const game={type:'sheet',blocks:[{t:'inline',text:'2 + 2 = [*4|5], 3 + 3 = [5|*6].'}]};
 const qs=practice.questionsFrom(game,[{block:0,k:1,ok:false}],'item-7');assert.equal(qs.length,1);assert.equal(qs[0].prompt,'2 + 2 = 4, 3 + 3 = ___.');assert.deepEqual(qs[0].correct,[1]);
});
