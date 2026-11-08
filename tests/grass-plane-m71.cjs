'use strict';
// M71: blank-world contract. Grass at elevation zero is a semantic default,
// not an allocated 84,934,656-element array or a destructive save migration.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const GRID=require('../server/world-grid-m67.cjs');
const TERRAIN=require('../server/world-terrain-editor-m69.cjs');
const ATLAS=require('../server/world-atlas-m70.cjs');
const WORLD=require('../server/world.cjs');
const M68=require('../dk-world-terrain-m68.js');
const {createDKServer}=require('../server/dk-server.cjs');
const started=Date.UTC(2026,10,8);
const fresh=()=>WORLD.makeWorld(started);
const total=9216*9216;
const change=(w,action,fields)=>ATLAS.editCells(w,
 {action,expected_revision:w.revision,...fields});
const fine=(w,action,fields)=>TERRAIN.edit(w,
 {action,expected_revision:w.revision,...fields});

test('M71 entire world starts flat green, including every corner and legacy outdoor atlas coordinate',()=>{
 const world=fresh();
 assert.deepEqual(world.world_grid.terrain.defaults,{material:'grass',elevation:0});
 assert.equal(world.world_grid.terrain.schema,1);
 assert.deepEqual(world.world_grid.terrain.sectors,{});
 assert.deepEqual(world.world_grid.terrain.cells,{});
 const samples=[[0,0],[9215,0],[0,9215],[9215,9215],[4608,4608],
  [12*128+60,14*128+60],[13*128+60,15*128+60]];
 for(const [x,y] of samples){
  const tile=TERRAIN.readTile(world,x,y);
  assert.equal(tile.material,'grass',x+','+y);
  assert.equal(tile.elevation,0,x+','+y);
  assert.equal(tile.override,null);
 }
 assert.equal(WORLD.validateWorld(world),world);
});
test('M71 every sample at every atlas zoom level renders the inherited grass baseline',()=>{
 const world=fresh();
 for(const scale of ATLAS.SCALE_LEVELS){
  const sample=ATLAS.view(world,{x:0,y:0,scale,columns:72,rows:72});
  assert.equal(sample.tiles[0][0].material,'grass');
  assert.equal(sample.tiles[71][71].material,'grass');
  assert.equal(sample.tiles[0][0].elevation,0);
  assert.equal(sample.tiles[0][0].painted,false);
  assert.equal(sample.defaults.material,'grass');
 }
 const edge=ATLAS.view(world,{x:9215,y:9215,scale:1,columns:2,rows:2});
 assert.equal(edge.tiles[0][0].material,'grass');
 assert.equal(edge.tiles[0][1],null,'Outside map remains unaddressable');
});
test('M71 coverage uses the grass baseline rather than counting an empty world as blank',()=>{
 const result=ATLAS.coverage(fresh());
 assert.equal(result.world_tiles,total);
 assert.equal(result.unedited_tiles,total);
 assert.equal(result.authored_tiles,0);
 assert.equal(result.default_material,'grass');
 assert.equal(result.default_elevation,0);
 assert.equal(result.grass_tiles,total);
 assert.equal(result.materials.grass,total);
 assert.equal(result.water_tiles,0);
 assert.equal(result.water_percent,0);
});
test('M71 repaint ocean as grass restores implicit default without storing grass cells',()=>{
 const original=fresh();
 let r=change(original,'fill_cells',{x:0,y:0,width:2,height:2,material:'sea'});
 let water=r.world;
 assert.equal(ATLAS.coverage(water).water_tiles,4*128*128);
 assert.equal(ATLAS.coverage(water).grass_tiles,total-4*128*128);
 const removed=change(water,'fill_cells',{x:0,y:0,width:2,height:2,material:'grass'});
 assert.equal(removed.changed,4);
 assert.deepEqual(removed.world.world_grid.terrain.cells,{});
 assert.equal(ATLAS.coverage(removed.world).grass_tiles,total);
 assert.equal(ATLAS.coverage(removed.world).authored_tiles,0);
 assert.equal(TERRAIN.readTile(removed.world,127,127).material,'grass');
 assert.equal(TERRAIN.readTile(removed.world,128,128).material,'grass');
 const undone=change(removed.world,'restore_cells',{tiles:removed.undo_cells});
 assert.equal(ATLAS.coverage(undone.world).water_tiles,4*128*128);
 assert.equal(ATLAS.cellMaterial(undone.world,1,1),'sea');
 assert.deepEqual(original.world_grid.terrain.sectors,{});
});
test('M71 detailed terrain and signed elevation override green defaults correctly',()=>{
 let world=fresh();
 const water=change(world,'fill_cells',{x:35,y:36,width:1,height:1,material:'sea'});
 world=water.world;
 const x=35*128+127,y=36*128+127;
 world=fine(world,'paint_material',{x,y,width:2,height:2,material:'grass'}).world;
 assert.equal(TERRAIN.readTile(world,x,y).material,'grass');
 assert.equal(TERRAIN.readTile(world,x+1,y).material,'grass');
 assert.equal(TERRAIN.readTile(world,x-1,y).material,'sea');
 let cover=ATLAS.coverage(world);
 assert.equal(cover.water_tiles,128*128-1);
 assert.equal(cover.grass_tiles,total-(128*128-1));
 world=fine(world,'raise_elevation',{x,y,width:1,height:1}).world;
 assert.equal(TERRAIN.readTile(world,x,y).elevation,1);
 assert.equal(TERRAIN.readTile(world,x,y).material,'grass');
 const exported=TERRAIN.exportData(world);
 assert.deepEqual(exported.defaults,{material:'grass',elevation:0});
 assert.equal(exported.cells['35.36'],'sea');
 assert.equal(exported.sectors['287.295'].tiles['255'].elevation,1);
 assert.equal(WORLD.validateWorld(world),world);
});
test('M71 repaint grass with fine brush does not store redundant default tiles',()=>{
 let world=fresh();
 assert.throws(()=>fine(world,'paint_material',{x:5000,y:5000,width:1,height:1,material:'grass'}),
  /would not change/);
 world=fine(world,'raise_elevation',{x:5000,y:5000,width:1,height:1}).world;
 assert.equal(TERRAIN.readTile(world,5000,5000).elevation,1);
 const result=fine(world,'paint_material',{x:5000,y:5000,width:1,height:1,material:'river'});
 world=result.world;
 assert.equal(TERRAIN.readTile(world,5000,5000).material,'river');
 world=fine(world,'restore',{tiles:result.undo}).world;
 assert.equal(TERRAIN.readTile(world,5000,5000).material,'grass');
 assert.equal(TERRAIN.readTile(world,5000,5000).elevation,1);
 assert.equal(ATLAS.coverage(world).authored_tiles,1);
 assert.equal(ATLAS.coverage(world).water_tiles,0);
});
test('M71 old saves migrate without erasing painted cells or fine elevation',()=>{
 const original=fresh();
 const paint=change(original,'fill_cells',{x:50,y:51,width:1,height:1,material:'sea'});
 const w=fine(paint.world,'raise_elevation',{x:7000,y:7100,width:1,height:1}).world;
 const legacy=JSON.parse(JSON.stringify(w));
 delete legacy.world_grid.terrain.defaults;
 assert.equal(TERRAIN.validate(legacy),true);
 assert.equal(TERRAIN.ensure(legacy),true);
 assert.deepEqual(legacy.world_grid.terrain.defaults,{material:'grass',elevation:0});
 assert.equal(TERRAIN.ensure(legacy),false);
 assert.equal(ATLAS.cellMaterial(legacy,50,51),'sea');
 assert.equal(TERRAIN.readTile(legacy,7000,7100).elevation,1);
 assert.equal(TERRAIN.readTile(legacy,0,0).material,'grass');
 assert.equal(WORLD.validateWorld(legacy),legacy);
});
test('M71 defaults are strictly validated so corrupt saves cannot silently change world seed',()=>{
 const w=fresh();
 w.world_grid.terrain.defaults={material:'lava',elevation:0};
 assert.throws(()=>TERRAIN.validate(w),/Invalid terrain world defaults/);
 w.world_grid.terrain.defaults={material:'grass',elevation:2};
 assert.throws(()=>TERRAIN.ensure(w),/Invalid terrain world defaults/);
});
test('M71 browser clearly displays green baseline and retains crisp pixel rendering',()=>{
 const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
 const js=read('dk-world-atlas-m70.js'),css=read('dk-world-atlas-m70.css');
 assert.match(js,/Every tile starts as green GRASS at elevation 0/);
 assert.match(js,/ctx\.imageSmoothingEnabled=false/);
 assert.match(js,/grass:'#547a41'/);
 assert.match(css,/image-rendering:pixelated/);
 assert.match(read('index.html'),/dk-world-architect-m70[.]html/);
});
test('M71 loopback export and paint API report default plane across restart',async()=>{
 const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'dk-grass-m71-'));
 let instance;
 try{
  instance=await createDKServer({dataDir,port:0,tickMs:600000,now:()=>started});
  let base='http://127.0.0.1:'+instance.address.port;
  let exported=await fetch(base+'/api/v1/world/terrain/export').then(r=>r.json());
  assert.deepEqual(exported.defaults,{material:'grass',elevation:0});
  let view=await fetch(base+'/api/v1/world/terrain/atlas?x=0&y=0&scale=128&columns=2&rows=2')
   .then(r=>r.json());
  assert.equal(view.tiles[0][0].material,'grass');
  const original=instance.world.revision;
  const posted=await fetch(base+'/api/v1/architect/world-atlas',{
   method:'POST',headers:{'Content-Type':'application/json','X-DK-Architect':'world-atlas'},
   body:JSON.stringify({action:'fill_cells',expected_revision:original,x:0,y:0,
    width:1,height:1,material:'sea'})
  });
  assert.equal(posted.status,200);
  let r=await posted.json();assert.equal(r.changed,1);
  await instance.close();instance=null;
  instance=await createDKServer({dataDir,port:0,tickMs:600000,now:()=>started});
  base='http://127.0.0.1:'+instance.address.port;
  exported=await fetch(base+'/api/v1/world/terrain/export').then(r=>r.json());
  assert.deepEqual(exported.defaults,{material:'grass',elevation:0});
  assert.equal(exported.cells['0.0'],'sea');
  assert.equal(TERRAIN.readTile(instance.world,200,200).material,'grass');
  const clear=await fetch(base+'/api/v1/architect/world-atlas',{
   method:'POST',headers:{'Content-Type':'application/json','X-DK-Architect':'world-atlas'},
   body:JSON.stringify({action:'fill_cells',expected_revision:instance.world.revision,
    x:0,y:0,width:1,height:1,material:'grass'})
  });
  assert.equal(clear.status,200);
  assert.equal(ATLAS.cellMaterial(instance.world,0,0),null);
  const coverage=await fetch(base+'/api/v1/world/terrain/coverage').then(r=>r.json());
  assert.equal(coverage.grass_tiles,total);
  assert.equal(coverage.water_tiles,0);
 }finally{
  if(instance)await instance.close();
  fs.rmSync(dataDir,{recursive:true,force:true});
 }
});
