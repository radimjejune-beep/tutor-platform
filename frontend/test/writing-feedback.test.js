import test from 'node:test';
import assert from 'node:assert/strict';
import {annotationSegments,changedRange} from '../src/pages/learning/writing-tools.js';
test('overlapping teacher comments preserve every character and mark the union of their ranges',()=>{
 const text='Je suis au café ☕.';
 const parts=annotationSegments(text,[{start:3,end:10},{start:8,end:15},{start:0,end:0}]);
 assert.equal(parts.map(p=>p.text).join(''),text);
 assert.equal(parts.filter(p=>p.marked).map(p=>p.text).join(''),text.slice(3,15));
 assert.equal(parts.some(p=>p.text===''),false);
});
test('version comparison distinguishes insertion, deletion and unchanged text without altering snapshots',()=>{
 assert.deepEqual(changedRange('Je parle.','Je parle français.'),{start:8,oldEnd:8,newEnd:17});
 assert.deepEqual(changedRange('She does works.','She works.'),{start:4,oldEnd:9,newEnd:4});
 assert.deepEqual(changedRange('No change','No change'),{start:9,oldEnd:9,newEnd:9});
});

test('version comparison highlights whole emoji instead of separating UTF-16 surrogate halves',()=>{assert.deepEqual(changedRange('Hi 😀!','Hi 😃!'),{start:3,oldEnd:5,newEnd:5});});
