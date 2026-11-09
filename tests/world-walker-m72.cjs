'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const WALK=require('../server/world-walker-m72.cjs');
const WORLD=require('../server/world.cjs');
const GRID=require('../server/world-grid-m67.cjs');
const TERRAIN=require('../server/world-terrain-editor-m69.cjs');
const ATLAS=require('../server/world-atlas-m70.cjs');
const {createDKServer}=require('../server/dk-server.cjs');
const NOW=Date.UTC(2026,10,8),fresh=()=>WORLD.makeWorld(NOW);
function place(w,x,y){return WALK.perform(w,{action:'place',x,y}).world;}
function step(w,d){return WALK.perform(w,{action:'step',direction:d}).world;}
test('M72 a new replacement world has no fictitious character or pre-spawned walker',()=>{
 const w=fresh(),view=WALK.worldView(w);
 assert.equal(view.started,false);
 assert.equal(view.default_material,'grass');
 assert.equal(w.world_grid.walker,undefined);
 assert.equal(WORLD.validateWorld(w),w);
});
test('M72 real saved surveyor walks across a 128-tile Streaming Cell seam',()=>{
 let w=place(fresh(),127,5000);
 assert.equal(WALK.worldView(w).actor.cell_id,'dk.cell.world.0.39');
 w=step(w,'east');
 const v=WALK.worldView(w);
 assert.deepEqual([v.actor.x,v.actor.y,v.actor.facing,v.actor.steps],
  [128,5000,'east',1]);
 assert.equal(v.actor.cell_id,'dk.cell.world.1.39');
 assert.equal(v.tiles[12][12][0],'grass');
 assert.equal(v.tiles[12][12][1],0);
 assert.equal(WORLD.validateWorld(w),w);
});
test('M72 walking refuses water, cliffs, rocks and steep elevation jumps',()=>{
 let w=place(fresh(),4608,4608);
 w=TERRAIN.edit(w,{action:'paint_material',expected_revision:w.revision,
  x:4609,y:4608,width:1,height:1,material:'sea'}).world;
 assert.throws(()=>step(w,'east'),/impassable/);
 // Fine grass pierces the ocean fill and becomes walkable.
 w=TERRAIN.edit(w,{action:'paint_material',expected_revision:w.revision,
  x:4609,y:4608,width:1,height:1,material:'grass'}).world;
 w=step(w,'east');
 assert.equal(WALK.worldView(w).actor.x,4609);
 w=TERRAIN.edit(w,{action:'flatten_elevation',expected_revision:w.revision,
  x:4610,y:4608,width:1,height:1,target_elevation:3}).world;
 assert.throws(()=>step(w,'east'),/Slope too steep/);
 w=TERRAIN.edit(w,{action:'flatten_elevation',expected_revision:w.revision,
  x:4610,y:4608,width:1,height:1,target_elevation:1}).world;
 w=step(w,'east');
 assert.equal(WALK.worldView(w).actor.x,4610);
});
test('M72 crossing the world edge never wraps or teleports',()=>{
 let w=place(fresh(),0,100);
 assert.throws(()=>step(w,'west'),/boundary/);
 w=place(w,9215,9215);
 assert.throws(()=>step(w,'east'),/boundary/);
 assert.throws(()=>step(w,'south'),/boundary/);
 assert.equal(WALK.worldView(w).actor.x,9215);
});
test('M72 terrain brushes cannot drown an occupied walking surveyor',()=>{
 let w=place(fresh(),3000,4100);
 assert.throws(()=>TERRAIN.edit(w,{action:'paint_material',expected_revision:w.revision,
  x:3000,y:4100,width:1,height:1,material:'sea'}),/obstruct/);
 const cell=ATLAS.editCells(w,{action:'fill_cells',expected_revision:w.revision,
  x:23,y:32,width:2,height:1,material:'sea'});
 assert.equal(cell.skipped_cells.length,1);
 assert.equal(cell.changed,1);
 assert.equal(TERRAIN.readTile(cell.world,3000,4100).material,'grass');
});
test('M72 a building blueprint is not yet a solid structure',()=>{
 let w=fresh();
 GRID.planBuilding(w,{id:'future_farm',kind:'house',
  x:181,y:200,width:2,height:2});
 w=place(w,180,200);
 w=step(w,'east');
 assert.equal(w.world_grid.walker.x,181);
 assert.equal(WORLD.validateWorld(w),w);
});
test('M72 rejects diagonal movement and invalid persisted walker state',()=>{
 let w=place(fresh(),4000,4000);
 assert.throws(()=>WALK.perform(w,{action:'step',direction:'northeast'}),/Cardinal/);
 assert.throws(()=>WALK.perform(w,{action:'place',x:5,y:5,secret:true}),/Invalid/);
 assert.throws(()=>WALK.perform(w,{action:'fly',x:5,y:5}),/Unknown/);
 w.world_grid.walker.x=9216;
 assert.throws(()=>WORLD.validateWorld(w),/Invalid/);
});
test('M72 viewport is bounded to 25×25 physical tiles with true heights',()=>{
 let w=place(fresh(),20,20);
 w=TERRAIN.edit(w,{action:'raise_elevation',expected_revision:w.revision,
  x:19,y:20,width:1,height:1}).world;
 const v=WALK.worldView(w);
 assert.equal(v.tiles.length,25);
 assert.equal(v.tiles[0].length,25);
 assert.deepEqual(v.tiles[12][11],['grass',1]);
 assert.equal(v.tiles[12][12][0],'grass');
 assert.throws(()=>WALK.worldView(w,{radius:100}),/Invalid/);
 const edge=WALK.worldView(place(w,0,0));
 assert.equal(edge.tiles[0][0],null);
});
test('M72 browser uses original sprites and integrated world authoring entry',()=>{
 const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
 const js=read('dk-world-explore-m72.js');
 const html=read('dk-world-explore-m72.html');
 assert.match(js,/assets\/art\/characters\/human\/human_/);
 assert.match(js,/ctx.imageSmoothingEnabled=false/);
 assert.match(js,/pointerdown/);
 assert.match(js,/button===2/);
 assert.match(js,/ArrowUp/);
 assert.match(js,/walkWorldStep/);
 assert.match(html,/dkWalkCanvas/);
 assert.match(read('dk-world-atlas-m70.js'),/data-walk/);
 assert.match(read('index.html'),/dk-world-explore-m72[.]html/);
 assert.match(read('server/local-game.cjs'),/dk-world-explore-m72[.]js/);
});
test('M72 authoritative world-walking endpoint persists and rejects forged placement',async()=>{
 const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'dk-walk-m72-'));
 let instance=null;
 try{
  instance=await createDKServer({dataDir,port:0,tickMs:600000,now:()=>NOW});
  let base='http://127.0.0.1:'+instance.address.port;
  const get=()=>fetch(base+'/api/v1/world/walk').then(r=>r.json());
  assert.equal((await get()).started,false);
  const send=(body,extra={})=>fetch(base+'/api/v1/world/walk',{
   method:'POST',headers:{'Content-Type':'application/json',...extra},
   body:JSON.stringify(body)
  });
  let response=await send({action:'place',x:128,y:512});
  assert.equal(response.status,403);
  response=await send({action:'place',x:127,y:512},
   {'X-DK-World-Editor':'place'});
  assert.equal(response.status,200);
  let result=await response.json();
  assert.equal(result.actor.x,127);
  response=await send({action:'step',direction:'east'},
   {'X-DK-World-Walk':'step'});
  assert.equal(response.status,200);
  result=await response.json();
  assert.equal(result.actor.x,128);
  assert.equal(result.actor.cell_id,'dk.cell.world.1.4');
  const storage=JSON.parse(fs.readFileSync(path.join(dataDir,'world.json'),'utf8'));
  assert.equal(storage.world_grid.walker.x,128);
  await instance.close();instance=null;
  instance=await createDKServer({dataDir,port:0,tickMs:600000,now:()=>NOW});
  base='http://127.0.0.1:'+instance.address.port;
  const restarted=await get();
  assert.equal(restarted.actor.x,128);
  assert.equal(restarted.actor.steps,1);
  assert.equal(restarted.tiles[12][12][0],'grass');
 }finally{
  if(instance)await instance.close();
  fs.rmSync(dataDir,{force:true,recursive:true});
 }
});
