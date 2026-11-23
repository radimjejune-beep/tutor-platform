const test=require('node:test'),assert=require('node:assert/strict');
const {gameSchema,grade}=require('../src/services/games');
const {pathToFileURL}=require('node:url');
const {join}=require('node:path');
test('inline choice validates with the real game schema and is graded on the server',async()=>{
 const g={type:'sheet',blocks:[{t:'inline',text:'She [work|*works] here. I [*am|is] a teacher.'}]};
 assert.equal(gameSchema.safeParse(g).success,true);
 for(const text of['[a|b]','[*a|*b]','[*a|a]','[*a|]'])assert.equal(gameSchema.safeParse({...g,blocks:[{t:'inline',text}]}).success,false);
 const frontend=await import(pathToFileURL(join(__dirname,'../../frontend/src/games/logic.js')).href);
 for(const a of[{b:{0:[1,0]}},{b:{0:[0,0]}},{b:{0:[false,7]}},{}])assert.deepEqual(grade(g,a),frontend.grade(g,a));
 assert.equal(grade(g,{b:{0:[0,0]}}).score,50);
});
