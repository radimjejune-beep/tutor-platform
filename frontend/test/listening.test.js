import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyListening,listeningChoice,gradeListening} from '../src/games/listening.js';
import {gameSize} from '../src/games/logic.js';
test('image/text listening options use explicit indices and count each question',()=>{
 const block=emptyListening();assert.equal(gameSize({type:'sheet',blocks:[block]}),2);
 for(const value of [null,undefined,'',true,false,{},[],2,-1,0.5,' 0','0x0'])assert.equal(listeningChoice(value,2),null);
 assert.equal(listeningChoice(0,2),0);assert.equal(listeningChoice('1',2),1);
 assert.equal(gradeListening(block,[0,1]).filter(d=>d.ok).length,2);
 const copy=emptyListening();copy.options[0].text='Changed';assert.notEqual(block.options[0].text,copy.options[0].text);
});
