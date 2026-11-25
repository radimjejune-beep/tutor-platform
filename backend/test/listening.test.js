const test=require('node:test'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),{join}=require('node:path');
const {gameSchema,grade}=require('../src/services/games');
const {gradeListening}=require('../src/services/listening');
const block={t:'listening',instruction:'Listen and choose.',audio:17,options:[{text:'In the park',image:21},{text:'At the café',image:22}],questions:[{q:'Where is Mia?',correct:0},{q:'Where is Leo?',correct:1}]};
test('listening schema accepts reusable audio/images and validates every answer key',()=>{
 assert.equal(gameSchema.safeParse({type:'sheet',blocks:[block]}).success,true);
 for(const value of [{...block,options:block.options.slice(0,1)},{...block,questions:[]},{...block,questions:[{q:'Missing option',correct:2}]},{...block,questions:[{q:'Bad key',correct:false}]},{...block,options:[{text:'',image:1},block.options[1]]}])assert.equal(gameSchema.safeParse({type:'sheet',blocks:[value]}).success,false);
});
test('each listening question is graded separately; malformed answers never select A',async()=>{
 const frontend=await import(pathToFileURL(join(__dirname,'../../frontend/src/games/logic.js')).href);
 const game={type:'sheet',blocks:[block]};
 for(const answers of [{b:{0:[0,1]}},{b:{0:[1,0]}},{b:{0:[false,null]}},{b:{0:['',true]}},{b:{0:[-1,99]}},{b:{0:['0','1']}},{}])assert.deepEqual(grade(game,answers),frontend.grade(game,answers));
 assert.equal(grade(game,{b:{0:[0,1]}}).score,100);assert.equal(grade(game,{b:{0:[0,0]}}).score,50);assert.equal(grade(game,{b:{0:[false,null]}}).correct,0);assert.equal(gradeListening(block,[0,1])[1].expected,'B · At the café');
});
test('focused retry keeps the recording and pictures but only repeats missed questions',async()=>{
 const {buildMistakePractice}=await import(pathToFileURL(join(__dirname,'../../frontend/src/games/experience.js')).href);
 const original={type:'sheet',blocks:[block]},snapshot=JSON.stringify(original),result=grade(original,{b:{0:[0,0]}}),practice=buildMistakePractice(original,result);
 assert.equal(practice.blocks[0].audio,17);assert.deepEqual(practice.blocks[0].options,block.options);assert.deepEqual(practice.blocks[0].questions,[block.questions[1]]);assert.equal(JSON.stringify(original),snapshot);
});
