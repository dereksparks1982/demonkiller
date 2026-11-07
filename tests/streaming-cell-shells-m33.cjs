'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const SHELL=require('../streaming-cell-shells-m33.js');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
test('M33 shells preserve live object identity while recycling previously drawn structures',()=>{
 const area={area_id:'dk.village.001',objects:[
  {id:'bank',type:'bank',x:12,y:10,w:20,h:14,open:false},
  {id:'distant',type:'house',x:99,y:99,w:16,h:12}]};
 const pool=SHELL.create({maxShells:16});
 const first=pool.visible(area,{x:20,y:15},20);
 assert.equal(first.length,1);assert.equal(first[0],area.objects[0]);
 area.objects[0].open=true;
 const second=pool.visible(area,{x:20,y:15},20);
 assert.equal(second[0].open,true);
 assert.equal(second[0],first[0]);
 assert.equal(pool.stats().allocations,1);
 assert.equal(pool.stats().reuses,1);
 assert.equal(pool.stats().loaded,1);
});
test('M33 shell views use current cell identity without inventing enterable rooms',()=>{
 const area={area_id:'dk.courtyard.lilith.001',objects:[
  {id:'temple_exterior',type:'temple_exterior',x:24,y:48,w:16,h:16},
  {id:'well',type:'well',x:32,y:44}]};
 const pool=SHELL.create();
 pool.visible(area,{x:26,y:45},20);
 pool.setCellView({area_id:area.area_id,current_cell:'dk.cell.courtyard',
  root:{id:'dk.cell.courtyard'},children:[{
   object_id:'temple_exterior',
   id:'dk.cell.courtyard/building/temple_exterior',interior_ready:false}]});
 const shown=pool.visible(area,{x:26,y:45},20);
 assert.equal(shown.length,2);
 assert.equal(pool.stats().cell_id,'dk.cell.courtyard');
 assert.equal(shown[0],area.objects[0]);
});
test('M33 reusable shell pool never retains more than the configured number of objects',()=>{
 const pool=SHELL.create({maxShells:16});
 const objects=Array.from({length:30},(_,i)=>({
  id:'obj_'+i,type:'candle',x:i,y:3}));
 const a={area_id:'dk.village.001',objects};
 const shown=pool.visible(a,{x:0,y:0},25);
 assert(shown.length>16);
 assert(pool.stats().loaded<=16);
 assert(pool.stats().evictions>0);
 const b={area_id:'dk.courtyard.lilith.001',objects:[{id:'tree',type:'willow',x:2,y:2}]};
 pool.visible(b,{x:0,y:0},20);
 assert.equal(pool.stats().loaded,1);
 assert.equal(pool.stats().area_id,b.area_id);
 pool.reset();assert.equal(pool.stats().loaded,0);
});
test('M33 browser loads cell-shell layer before outdoor rendering and retains walking controls',()=>{
 const html=read('outdoor.html'),js=read('outdoor.js');
 assert(html.indexOf('streaming-cell-shells-m33.js')>0);
 assert(html.indexOf('streaming-cell-shells-m33.js')<html.indexOf('outdoor.js?v='));
 assert.match(js,/cellShells\.visible\(area,camera,VIEW\)/);
 assert.match(js,/async function refreshCellView\(\)/);
 assert.match(js,/window\.DKStreamingCellShells/);
 assert.match(read('server/local-game.cjs'),/'streaming-cell-shells-m33\.js'/);
 assert.match(read('dk-menu-server.js'),/async streamingCells\(radius=24\)/);
 assert.match(js,/advanceVisual\(dt\)/);
 assert.match(js,/pointerMove\(dt\)/);
 assert.match(js,/rightHeld/);
 assert.match(html,/key==='p'\|\|key==='i'/);
 for(const id of ['openPaperDoll','openBackpack','cellDebugButton'])
  assert(!html.includes('id="'+id+'"'));
 assert.doesNotThrow(()=>new vm.Script(read('streaming-cell-shells-m33.js')));
 assert.doesNotThrow(()=>new vm.Script(js));
});
