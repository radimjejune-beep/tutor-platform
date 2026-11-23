import test from 'node:test';
import assert from 'node:assert/strict';
import {writingMetrics,insertWritingStarter} from '../src/games/writing.js';
test('writing volume measures the submitted text and makes both limits visible',()=>{
 const m=writingMetrics('One two three.\n\nFour five.',{min_words:6,max_words:8});
 assert.equal(m.count,5);assert.equal(m.paragraphs,2);assert.equal(m.target,'6–8 слов');assert.equal(m.remaining,1);
 assert.equal(writingMetrics('one two three',{max_words:2}).excess,1);
 assert.equal(writingMetrics('',{}).paragraphs,0);
});
test('teacher starters insert at the cursor or replace a selection without deleting the rest',()=>{
 assert.deepEqual(insertWritingStarter('Hello world',6,11,'Alex,'),{text:'Hello Alex, ',caret:12});
 assert.equal(insertWritingStarter('First\n\nLast',7,7,'Next,').text,'First\n\nNext, Last');
 assert.equal(insertWritingStarter('',0,0,'Hi Alex,' ).text,'Hi Alex, ');
});
