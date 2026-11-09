'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const C=require('../dk-lilith-cinematic-m40.js');
const root=path.join(__dirname,'..');
test('all twelve original willow frames are individual nonoverlapping source rectangles',()=>{
 const image={naturalWidth:1774,naturalHeight:887,complete:true};
 for(const row of [0,1]){
  let end=0;
  for(let n=0;n<6;n++){
   const r=C.sourceRect(image,row,n);
   assert(r.sx>=end&&r.sw>=100&&r.sh>=200);
   assert(r.sy>=0&&r.sy+r.sh<755);
   end=r.sx+r.sw;
  }
 }
 assert.deepEqual(C.sourceRect(image,0,5),{sx:1360,sy:58,sw:388,sh:272});
 assert.deepEqual(C.sourceRect(image,1,5),{sx:1360,sy:512,sw:388,sh:238});
});
test('drawing each pose selects the matching unique input rectangle exactly once',()=>{
 const img={naturalWidth:1774,naturalHeight:887,complete:true};
 for(const row of [0,1]){
  const positions=new Set();
  for(let n=0;n<6;n++){
   const calls=[];const ctx={save(){},restore(){},drawImage(...v){calls.push(v);}};
   assert.equal(C.drawTree(ctx,img,row,n,1000,1000),true);
   assert.equal(calls.length,1);
   const [,sx,sy,sw,sh,dx,dy,dw,dh]=calls[0];
   assert.deepEqual({sx,sy,sw,sh},C.sourceRect(img,row,n));
   positions.add(sx);
   assert.equal(dx+dw/2,1000);
   assert.equal(dy+dh,1000);
  }
  assert.equal(positions.size,6);
 }
});
test('the browser loads the corrected stage rectangles',()=>{
 const html=fs.readFileSync(path.join(root,'outdoor.html'),'utf8');
 assert.match(html,/dk-lilith-cinematic-m40\.js\?v=m77-calibrated-frames/);
 assert.match(fs.readFileSync(path.join(root,'outdoor.js'),'utf8'),/CINEMATIC\.drawTree\(/);
});
