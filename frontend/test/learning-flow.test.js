import test from 'node:test';
import assert from 'node:assert/strict';
import {prioritizeHomework,splitLessons,reviewDestination,normalizeTray} from '../src/learning-flow.js';
test('pupil next task prioritizes unsubmitted work and earliest deadline without changing API order',()=>{
 const rows=[{id:1,status:'checked',due_on:'2020-01-01'},{id:2,status:'submitted'},{id:3,status:'assigned'},{id:4,status:'assigned',due_on:'2026-11-26'},{id:5,status:'assigned',due_on:'2026-11-25'}],snapshot=structuredClone(rows);
 assert.deepEqual(prioritizeHomework(rows).map(x=>x.id),[5,4,3,2,1]);assert.deepEqual(rows,snapshot);
});
test('ongoing lesson remains next; old unmarked lessons belong to the chronological history',()=>{
 const now=Date.parse('2026-11-25T12:30:00Z');
 const r=splitLessons([{id:1,status:'scheduled',starts_at:'2026-11-24T12:00:00Z'},{id:2,status:'scheduled',starts_at:'2026-11-25T12:00:00Z',duration_min:60},{id:3,status:'scheduled',starts_at:'2026-11-26T12:00:00Z'},{id:4,status:'done',starts_at:'2026-11-25T10:00:00Z'},{id:5,status:'scheduled',starts_at:'invalid'}],now);
 assert.deepEqual(r.upcoming.map(x=>x.id),[2,3]);assert.deepEqual(r.history.map(x=>x.id),[4,1]);
});
test('review action opens an actual pending individual submission in a shared assignment',()=>{
 assert.equal(reviewDestination({id:7,recipients:[{homework_id:21,status:'checked'},{homework_id:22,status:'submitted'}]}),'/homework/7/review/22');assert.equal(reviewDestination({id:7,recipients:[]}),'/homework/7');
});
test('material selection retains source namespaces, stable order and bounded valid identifiers',()=>{
 const rows=[{source:'bank',id:1,title:'Bank'},{source:'library',id:1,title:'Library'},{source:'bank',id:1,title:'Duplicate'},{source:'foreign',id:5,title:'Bad'},{source:'bank',id:-1,title:'Bad'}];assert.deepEqual(normalizeTray(rows).map(x=>x.title),['Bank','Library']);assert.equal(normalizeTray(Array.from({length:50},(_,i)=>({source:'bank',id:i+1,title:'x'}))).length,40);assert.deepEqual(normalizeTray(null),[]);
});
