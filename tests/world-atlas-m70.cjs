'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const GRID=require('../server/world-grid-m67.cjs');
const ATLAS=require('../server/world-atlas-m70.cjs');
const TERRAIN=require('../server/world-terrain-editor-m69.cjs');
const WORLD=require('../server/world.cjs');
const M68=require('../dk-world-terrain-m68.js');
const {createDKServer}=require('../server/dk-server.cjs');
const START=Date.UTC(2026,10,8);
const fresh=()=>WORLD.makeWorld(START);
function fill(w,x,y,width,height,material='sea'){
 return ATLAS.editCells(w,{action:'fill_cells',
  expected_revision:w.revision,x,y,width,height,material});
}
test('M70 full-world atlas is exactly 72 by 72 Streaming Cells and starts unpainted',()=>{
 const w=fresh();
 assert.equal(GRID.WIDTH,9216);
 assert.equal(GRID.HEIGHT,9216);
 assert.equal(GRID.WIDTH/GRID.CELL,72);
 assert.equal(ATLAS.MAX_CELLS_PER_EDIT,5184);
 assert.deepEqual(w.world_grid.terrain.cells,{});
 assert.equal(ATLAS.coverage(w).water_percent,0);
 const data=ATLAS.view(w,{x:0,y:0,scale:128,columns:72,rows:72});
 assert.equal(data.tiles.length,72);assert.equal(data.tiles[0].length,72);
 assert.equal(data.tiles[0][0].material,null);
 assert.equal(data.tiles[71][71].material,null);
 assert.equal(data.format,'dk.world.atlas.m70');
});
test('M70 fill one third of world ocean with 1728 compact cell records',()=>{
 const w=fresh();
 const result=fill(w,48,0,24,72);
 assert.equal(result.changed,1728);
 assert.equal(result.changed_tiles,1728*128*128);
 assert.equal(result.undo_cells.length,1728);
 assert.equal(Object.keys(result.world.world_grid.terrain.cells).length,1728);
 assert.equal(ATLAS.coverage(result.world).water_percent,33.3333);
 assert.equal(ATLAS.coverage(w).water_percent,0);
 assert.equal(TERRAIN.readTile(result.world,71*128+127,9215).material,'sea');
 assert.equal(TERRAIN.readTile(result.world,0,0).material,null);
 assert.equal(WORLD.validateWorld(result.world),result.world);
});
test('M70 paint and exact undo preserve the server world in cells and fine overrides',()=>{
 const base=fresh(),painted=fill(base,30,30,2,2,'forest');
 const original=painted.world;
 const fine=TERRAIN.edit(original,{action:'paint_material',expected_revision:original.revision,
  x:30*128+64,y:30*128+64,width:1,height:1,material:'river'});
 const w=fine.world;
 assert.equal(ATLAS.view(w,{x:30*128,y:30*128,scale:128,columns:2,rows:2})
  .tiles[0][0].material,'river');
 const restored=ATLAS.editCells(w,{action:'restore_cells',
  expected_revision:w.revision,tiles:painted.undo_cells});
 assert.equal(TERRAIN.readTile(restored.world,30*128+64,30*128+64).material,'river',
  'Fine terrain paint must survive cell undo');
 assert.equal(TERRAIN.readTile(restored.world,30*128+65,30*128+65).material,null);
 assert.equal(ATLAS.coverage(restored.world).water_tiles,1);
 assert.equal(WORLD.validateWorld(restored.world),restored.world);
});
test('M70 protects prototype fixtures while painting remaining unoccupied cells',()=>{
 const w=fresh(),result=fill(w,12,14,2,2);
 assert(result.skipped_cells.length>=1,'Preview camp fixtures remain protected');
 assert(result.changed>=1,'Safe cells in a broad brush still paint');
 const skipped=result.skipped_cells[0];
 assert.equal(ATLAS.cellMaterial(result.world,skipped.cx,skipped.cy),null);
 assert.equal(WORLD.validateWorld(result.world),result.world);
});
test('M70 atlas rejects forged records, stale revisions and out-of-bounds strokes',()=>{
 const w=fresh();
 assert.throws(()=>ATLAS.editCells(w,{
  action:'fill_cells',expected_revision:88,x:1,y:1,width:1,height:1,material:'sea'
 }),/Stale/);
 for(const q of [
  {x:72,y:0,width:1,height:1,material:'sea'},
  {x:0,y:0,width:73,height:72,material:'sea'},
  {x:0,y:0,width:1,height:1,material:'potato'},
  {x:0,y:0,width:1,height:1,material:'sea',extra:true}
 ])assert.throws(()=>ATLAS.editCells(w,{action:'fill_cells',
  expected_revision:w.revision,...q}),/Invalid/);
 assert.throws(()=>ATLAS.editCells(w,{action:'restore_cells',
  expected_revision:w.revision,tiles:[
   {cx:2,cy:2,material:null},{cx:2,cy:2,material:'sea'}
  ]}),/Duplicate/);
 assert.deepEqual(w.world_grid.terrain.cells,{});
});
test('M70 authored terrain and cell elevation export survive JSON restart',()=>{
 const w=fill(fresh(),70,71,2,1,'deepwater').world;
 const raised=TERRAIN.edit(w,{action:'raise_elevation',
  expected_revision:w.revision,x:9215,y:9215,width:1,height:1}).world;
 const loaded=JSON.parse(JSON.stringify(raised));
 assert.equal(TERRAIN.readTile(loaded,9215,9215).elevation,1);
 assert.equal(TERRAIN.readTile(loaded,9215,9215).material,'deepwater');
 assert.equal(TERRAIN.exportData(loaded).cells['71.71'],'deepwater');
 assert.equal(TERRAIN.exportData(loaded,71,71).cells['70.71'],undefined);
 assert.equal(ATLAS.coverage(loaded).water_tiles,2*128*128);
 assert.equal(WORLD.validateWorld(loaded),loaded);
});
test('M70 client is embedded in DK Architect and uses pixel rendering',()=>{
 const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
 const page=read('outdoor.html'),ui=read('dk-architect-ui-m39.js'),
  core=read('dk-architect-core-m39.js'),host=read('dk-architect-world-host-m39.js');
 const atlas=read('dk-world-atlas-m70.js'),css=read('dk-world-atlas-m70.css');
 assert.match(page,/dk-world-atlas-m70[.]js\?v=m70/);
 assert.match(ui,/WORLD PIXEL PAINTER/);
 assert.match(core,/world_atlas/);
 assert.match(host,/DKWorldAtlasM70[?][.]show/);
 assert.match(atlas,/ctx[.]imageSmoothingEnabled=false/);
 assert.match(atlas,/e[.]button===2/);
 assert.match(atlas,/canvas[.]setPointerCapture/);
 assert.match(css,/image-rendering:pixelated/);
 assert.match(atlas,/paintAtlasCells/);
 assert.match(read('server/local-game.cjs'),/dk-world-atlas-m70[.]js/);
});
test('M70 loopback world atlas safely writes and exports server-owned cells',async()=>{
 const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'dk-world-atlas-m70-'));
 let instance;
 try{
  instance=await createDKServer({dataDir,port:0,tickMs:600000,now:()=>START});
  const base='http://127.0.0.1:'+instance.address.port;
  const original=instance.world.revision;
  const post=(body,header='world-atlas')=>fetch(base+'/api/v1/architect/world-atlas',{
   method:'POST',headers:{'Content-Type':'application/json','X-DK-Architect':header},
   body:JSON.stringify(body)});
  const bad=await post({action:'fill_cells',expected_revision:original,
   x:70,y:70,width:1,height:1,material:'sea'},'forged');
  assert.equal(bad.status,403);
  const response=await post({action:'fill_cells',expected_revision:original,
   x:70,y:70,width:1,height:1,material:'sea'});
  assert.equal(response.status,200);
  const saved=await response.json();assert.equal(saved.changed,1);
  assert.equal(saved.changed_tiles,16384);
  const url=base+'/api/v1/world/terrain/atlas?x=8960&y=8960&scale=128&columns=2&rows=2';
  const atlas=await fetch(url).then(r=>r.json());
  assert.equal(atlas.tiles[0][0].material,'sea');
  const coverage=await fetch(base+'/api/v1/world/terrain/coverage').then(r=>r.json());
  assert.equal(coverage.water_tiles,16384);
  const exported=await fetch(base+'/api/v1/world/terrain/export').then(r=>r.json());
  assert.equal(exported.cells['70.70'],'sea');
  const stale=await post({action:'fill_cells',expected_revision:original,
   x:69,y:70,width:1,height:1,material:'sea'});
  assert.equal(stale.status,409);
  const stored=JSON.parse(fs.readFileSync(path.join(dataDir,'world.json'),'utf8'));
  assert.equal(stored.world_grid.terrain.cells['70.70'],'sea');
  const undone=await post({action:'restore_cells',expected_revision:saved.revision,
   tiles:saved.undo_cells});
  assert.equal(undone.status,200);
  assert.equal(ATLAS.cellMaterial(instance.world,70,70),null);
 }finally{
  if(instance)await instance.close();
  fs.rmSync(dataDir,{recursive:true,force:true});
 }
});
