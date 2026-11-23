import test from 'node:test';
import assert from 'node:assert/strict';
import {assignmentForStudent,assignmentView,sortAssignments} from '../src/assignment-workspace.js';
import {workspaceFamily} from '../src/workspace-state.js';
test('a shared assignment has the correct individual status when filtering one student',()=>{
 const a={total:2,checked:1,submitted:1,students:['Anna','Bob'],due_on:'2099-01-01',recipients:[{student_id:1,student_name:'Anna',status:'checked'},{student_id:2,student_name:'Bob',status:'submitted'}]};
 const anna=assignmentForStudent(a,'1'),bob=assignmentForStudent(a,'2');assert.equal(assignmentView(anna,'history'),true);assert.equal(assignmentView(anna,'review'),false);assert.equal(assignmentView(bob,'review'),true);assert.deepEqual(bob.students,['Bob']);assert.equal(assignmentForStudent(a,'3'),null);
});
test('archive is separate from active work and history without deleting the assignment',()=>{const a={total:1,checked:1,submitted:0};assert.equal(assignmentView(a,'active'),false);assert.equal(assignmentView(a,'history'),true);const archived={...a,archived_at:'2026-11-23'};assert.equal(assignmentView(archived,'history'),false);assert.equal(assignmentView(archived,'archive'),true);assert.equal(assignmentView(archived,'all'),true);assert.ok(sortAssignments({submitted:1,due_on:'2099-01-01'},{submitted:0,due_on:'2020-01-01'})<0);});
test('only related list routes preserve workspace scroll; editors and unrelated sections stay normal',()=>{assert.equal(workspaceFamily('/bank/book-two/5?q=test'),'bank');assert.equal(workspaceFamily('/library/games'),'library');assert.equal(workspaceFamily('/library/42'),'');assert.equal(workspaceFamily('/library/new'),'');assert.equal(workspaceFamily('/homework?status=submitted'),'homework');assert.equal(workspaceFamily('/homework/42'),'');});
