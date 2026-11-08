'use strict';
// M69 regression contracts: sparse terrain, server authority and editor wiring.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const GRID=require('../server/world-grid-m67.cjs');
const TERRAIN=require('../server/world-terrain-editor-m69.cjs');
const M68=require('../dk-world-terrain-m68.js');
const WORLD=require('../server/world.cjs');
const {createDKServer}=require('../server/dk-server.cjs');
const created=Date.UTC(2026,10,8);
const newWorld=()=>WORLD.makeWorld(created);

test('M69 approved world dimensions align with every Streaming Cell and sector',()=>{
 assert.equal(GRID.WIDTH,9216);
 assert.equal(GRID.HEIGHT,9216);
 assert.equal(GRID.WIDTH/GRID.CELL,72);
 assert.equal(GRID.HEIGHT/GRID.SECTOR,576);
 assert.equal(GRID.tile(9215,9215).cell.id,'dk.cell.world.71.71');
 assert.equal(M68.MASTER,9216);
 assert.equal(GRID.validate(newWorld()),true);
});

test('M69 new terrain ledger is empty and old worlds receive it without new scenery',()=>{
 const world=newWorld();
 assert.equal(TERRAIN.validate(world),true);
 assert.deepEqual(world.world_grid.terrain.sectors,{});
 assert.equal(TERRAIN.ensure(world),false);
 const migrated={world_grid:{width:9216,height:9216},areas:{},characters:{}};
 assert.equal(TERRAIN.ensure(migrated),true);
 assert.equal(TERRAIN.ensure(migrated),false);
 assert.deepEqual(TERRAIN.exportData(world).sectors,{});
});

test('M69 paint across two 128-tile regions changes authoritative terrain and collision',()=>{
 const world=newWorld();
 const x=12*128+127,y=15*128+70;
 const baseLeft=M68.tile(x,y),baseRight=M68.tile(x+1,y);
 const edited=TERRAIN.edit(world,{action:'paint_material',expected_revision:world.revision,
  x,y,width:2,height:1,material:'sea'});
 assert.equal(edited.changed,2);
 assert.equal(TERRAIN.readTile(edited.world,x,y).material,'sea');
 assert.equal(TERRAIN.readTile(edited.world,x+1,y).material,'sea');
 for(const px of [x,x+1]){
  const id=M68.id(Math.floor(px/128),Math.floor(y/128)),area=edited.world.areas[id];
  const localX=px%128,localY=y%128;
  assert.equal(area.floor[localY*128+localX],'sea');
  assert.equal(require('../server/regions.cjs').traversable(area,localX,localY,'living'),false);
 }
 assert.equal(world.areas[M68.id(12,15)].floor[(y%128)*128+127],baseLeft);
 assert.equal(world.areas[M68.id(13,15)].floor[(y%128)*128],baseRight);
 assert.equal(WORLD.validateWorld(edited.world),edited.world);
 const restored=TERRAIN.edit(edited.world,{action:'restore',
  expected_revision:edited.revision,tiles:edited.undo});
 assert.equal(TERRAIN.readTile(restored.world,x,y).material,'grass');
 assert.equal(TERRAIN.readTile(restored.world,x+1,y).material,'grass');
 assert.equal(restored.world.areas[M68.id(12,15)].floor[(y%128)*128+127],baseLeft);
 assert.equal(restored.world.areas[M68.id(13,15)].floor[(y%128)*128],baseRight);
 assert.equal(TERRAIN.validate(restored.world),true);
});

test('M69 elevation raise, lower, flatten and smooth persist and restore',()=>{
 let world=newWorld(),x=2900,y=4100;
 const act=(action,more={})=>{
  const change=TERRAIN.edit(world,{action,expected_revision:world.revision,
   x,y,width:1,height:1,...more});world=change.world;return change;
 };
 act('raise_elevation');assert.equal(TERRAIN.readTile(world,x,y).elevation,1);
 act('lower_elevation');assert.equal(TERRAIN.readTile(world,x,y).elevation,0);
 act('flatten_elevation',{target_elevation:12});
 assert.equal(TERRAIN.readTile(world,x,y).elevation,12);
 const last=act('smooth_elevation');
 assert(TERRAIN.readTile(world,x,y).elevation<12);
 const reverted=TERRAIN.edit(world,{action:'restore',
  expected_revision:world.revision,tiles:last.undo});
 world=reverted.world;
 assert.equal(TERRAIN.readTile(world,x,y).elevation,12);
 assert.equal(WORLD.validateWorld(world),world);
});

test('M69 world paints reject stale revisions, oversized or forged edits, and foundations',()=>{
 const world=newWorld(),x=3000,y=4000;
 assert.throws(()=>TERRAIN.edit(world,{action:'paint_material',expected_revision:12,
  x,y,width:1,height:1,material:'sea'}),/Stale/);
 assert.throws(()=>TERRAIN.edit(world,{action:'paint_material',
  expected_revision:world.revision,x,y,width:33,height:33,material:'sea'}),/Invalid/);
 assert.throws(()=>TERRAIN.edit(world,{action:'paint_material',
  expected_revision:world.revision,x,y,width:1,height:1,material:'magenta'}),/Invalid/);
 GRID.planBuilding(world,{id:'my_home',kind:'house',x,y,width:2,height:2});
 assert.throws(()=>TERRAIN.edit(world,{action:'paint_material',
  expected_revision:world.revision,x,y,width:1,height:1,material:'sea'}),/obstruct/);
 assert.deepEqual(world.world_grid.terrain.sectors,{});
});

test('M69 sector reads and full/cell world export preserve exact heights and material',()=>{
 const world=newWorld(),x=127,y=129;
 const result=TERRAIN.edit(world,{action:'paint_material',
  expected_revision:world.revision,x,y,width:2,height:1,material:'marsh'});
 const edit=TERRAIN.edit(result.world,{action:'raise_elevation',
  expected_revision:result.revision,x:x+1,y,width:1,height:1});
 const sector=TERRAIN.sector(edit.world,8,8);
 assert.equal(sector.tiles.length,16);
 assert.equal(sector.tiles[1][0].elevation,1);
 assert.equal(sector.tiles[1][0].material,'marsh');
 const all=TERRAIN.exportData(edit.world);
 const cell=TERRAIN.exportData(edit.world,1,1);
 assert.equal(all.dimensions.width,9216);
 assert.equal(cell.scope.cell_x,1);
 assert(Object.keys(all.sectors).length>=1);
 assert(Object.keys(cell.sectors).length>=1);
 assert.equal(TERRAIN.validate(edit.world),true);
});

test('M69 browser and loopback server include terrain editor and safe pan controls',()=>{
 const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
 const html=read('outdoor.html'),editor=read('dk-architect-world-host-m39.js');
 const client=read('dk-menu-server.js'),server=read('server/dk-server.cjs');
 assert.match(html,/dk-architect-world-host-m39\.js\?v=m(?:69|70)/);
 assert.match(editor,/setPointerCapture/);
 assert.match(editor,/lostpointercapture/);
 assert.match(editor,/e\.button===2/);
 assert.match(editor,/paintWorldTerrain/);
 assert.match(editor,/submitTerrain/);
 assert.match(editor,/exportWorldTerrain/);
 assert.match(client,/X-DK-Architect':'world-terrain/);
 assert.match(server,/saveWorldTerrain\(command\)/);
 assert.match(server,/api\/v1\/world\/terrain\/export/);
 assert.match(read('server/local-game.cjs'),/dk-world-terrain-m68\.js/);
});

test('M69 loopback API durably saves a terrain stroke and exposes export',async()=>{
 const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'dk-terrain-m69-'));
 let instance;
 try{
  instance=await createDKServer({dataDir,port:0,tickMs:600000,now:()=>created});
  const base='http://127.0.0.1:'+instance.address.port;
  const revision=instance.world.revision;
  const response=await fetch(base+'/api/v1/architect/world-terrain',{
   method:'POST',headers:{'Content-Type':'application/json','X-DK-Architect':'world-terrain'},
   body:JSON.stringify({action:'paint_material',expected_revision:revision,
    x:2900,y:4100,width:1,height:1,material:'river'})
  });
  assert.equal(response.status,200);
  const saved=await response.json();assert.equal(saved.changed,1);
  assert.equal(TERRAIN.readTile(instance.world,2900,4100).material,'river');
  const exported=await fetch(base+'/api/v1/world/terrain/export').then(r=>r.json());
  assert.equal(exported.dimensions.width,9216);
  const sector=await fetch(base+'/api/v1/world/terrain/sector?sx=181&sy=256')
   .then(r=>r.json());
  assert.equal(sector.tiles[4][4].material,'river');
  const forged=await fetch(base+'/api/v1/architect/world-terrain',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({action:'paint_material',expected_revision:saved.revision,
    x:1,y:1,width:1,height:1,material:'sea'})
  });assert.equal(forged.status,403);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dataDir,'world.json'),'utf8'))
   .world_grid.terrain.sectors['181.256'].tiles['68'].material,'river');
 }finally{
  if(instance)await instance.close();
  fs.rmSync(dataDir,{recursive:true,force:true});
 }
});
