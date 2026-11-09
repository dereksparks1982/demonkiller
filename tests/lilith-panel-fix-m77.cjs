'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const scene=require('../dk-lilith-cinematic-m40.js');
function fakeContext(){
 const calls=[];
 return {calls,save(){},restore(){},imageSmoothingEnabled:false,
  drawImage(...args){calls.push(args);}};
}
test('M77 all six gold and diseased frames use exactly one approved source panel',()=>{
 const sheet={naturalWidth:1774,naturalHeight:887,complete:true};
 for(let row=0;row<2;row++){
  for(let stage=0;stage<6;stage++){
   const ctx=fakeContext();
   assert.equal(scene.drawTree(ctx,sheet,row,stage,120,300),true);
   assert.equal(ctx.calls.length,1,'one sprite draw only, never two pieces');
   const draw=ctx.calls[0],source=scene.sourceRect(sheet,row,stage===0?0:5);
   assert.equal(draw[1],source.sx);assert.equal(draw[2],source.sy);
   assert.equal(draw[3],source.sw);assert.equal(draw[4],source.sh);
   assert.equal(draw[5]+draw[7]/2,120,'canopy centered on target');
   assert.equal(draw[6]+draw[8],300,'roots anchored on original ground');
  }
 }
});
test('M77 fully grown willow is the same artwork and final size',()=>{
 const ctx=fakeContext(),sheet={naturalWidth:1774,naturalHeight:887,complete:true};
 scene.drawTree(ctx,sheet,0,5,200,400);
 const call=ctx.calls[0],rect=scene.sourceRect(sheet,0,5);
 assert.deepEqual(call.slice(1,5),[rect.sx,rect.sy,rect.sw,rect.sh]);
 assert.deepEqual(call.slice(5),[117,239,166,161]);
});
