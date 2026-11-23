import test from 'node:test';
import assert from 'node:assert/strict';
import {parseInlineChoices,markInlineCorrect,gradeInlineChoices} from '../src/games/inline-choice.js';
import {grade, gameSize} from '../src/games/logic.js';
import {buildMistakePractice} from '../src/games/experience.js';

test('inline alternatives keep sentence context, multiple choices and an explicit answer key',()=>{
 const text='She [work|*works] here.\nI [*am|is] a teacher.';
 const p=parseInlineChoices(text);assert.deepEqual(p.errors,[]);assert.equal(p.choices[0].correct,1);assert.equal(p.choices[1].correct,0);
 assert.equal(markInlineCorrect(text,0,0),'She [*work|works] here.\nI [*am|is] a teacher.');
});
test('inline checking rejects missing, boolean and out-of-range selections',()=>{
 for(const a of[[],[null],[false],[''],[6],[-1]]) assert.equal(gradeInlineChoices('I [*am|is].',a)[0].ok,false);
 assert.equal(gradeInlineChoices('I [*am|is].',[0])[0].ok,true);
});
test('invalid and ambiguous keys cannot be published',()=>{
 for(const text of['No choices','[a]','[a|b]','[*a|*b]','[*a|a]','[*a|]','[*a|b','[a|b]]','[*a|b|c|d|e|f|g]']) assert.ok(parseInlineChoices(text).errors.length>0,text);
});
test('focused inline practice keeps completed context and retries only the incorrect slots',()=>{
 const g={type:'sheet',blocks:[{t:'inline',text:'She [work|*works] here. I [*am|is] a teacher.'}]};
 assert.equal(gameSize(g),2);
 const r=grade(g,{b:{0:[0,0]}});assert.equal(r.score,50);
 const p=buildMistakePractice(g,r);assert.equal(p.blocks[0].text,'She [work|*works] here. I am a teacher.');
 assert.equal(grade(p,{b:{0:[1]}}).score,100);assert.equal(r.score,50);
});
