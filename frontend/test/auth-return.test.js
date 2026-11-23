import test from 'node:test';
import assert from 'node:assert/strict';
import {safeReturn} from '../src/auth-return.js';
test('course authentication resumes an internal route; external destinations and login loops are rejected',()=>{
 assert.equal(safeReturn('/marketplace/courses/a1-course'),'/marketplace/courses/a1-course');
 for(const v of ['https://outside.example','//outside.example','/login','/learn-register','/register?return=x','javascript:alert(1)',null,'/\\outside.example'])assert.equal(safeReturn(v),'/');
});
