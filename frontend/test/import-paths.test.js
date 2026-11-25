import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkImports} from '../scripts/check-imports.mjs';

test('case-insensitive component/helper names require explicit extensions',async t=>{
  const root=await mkdtemp(join(tmpdir(),'lf-imports-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(join(root,'games'));
  for(const file of ['Listening.jsx','listening.js','Writing.jsx','writing.js'])await writeFile(join(root,'games',file),'export const fixture=true;');
  await writeFile(join(root,'Sheet.jsx'),"import {ListeningBlock} from './games/Listening';\nimport WritingStudio from './games/Writing';\n");
  assert.deepEqual((await checkImports(root)).map(issue=>issue.specifier),['./games/Listening','./games/Writing']);
  await writeFile(join(root,'Sheet.jsx'),"import {ListeningBlock} from './games/Listening.jsx';\nimport WritingStudio from './games/Writing.jsx';\nimport {gradeListening} from './games/listening.js';\n");
  assert.deepEqual(await checkImports(root),[]);
});

test('all frontend source imports are portable across case-sensitive and case-insensitive filesystems',async()=>{
  assert.deepEqual(await checkImports(fileURLToPath(new URL('../src/',import.meta.url))),[]);
});
