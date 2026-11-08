'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const GRID=require('../server/world-grid-m67.cjs');
const W=require('../server/world.cjs');
function sample(){return {areas:{'legacy.temple':{id:1}},characters:{'1':{id:1}},revision:7};}

test('M67 replacement-world grid is empty, code-only and independent of old maps',()=>{
 const w=sample(),legacyArea=w.areas['legacy.temple'];
 assert.equal(GRID.ensure(w),true);
 assert.equal(GRID.ensure(w),false);
 assert.equal(w.areas['legacy.temple'],legacyArea);
 assert.equal(w.revision,7);
 assert.deepEqual(w.world_grid.buildings,{});
 assert.equal(JSON.stringify(w.world_grid).includes('temple'),false);
 assert.equal(JSON.stringify(w.world_grid).includes('village'),false);
 const status=GRID.overview(w);
 assert.deepEqual(status.world_tiles,{width:4096,height:4096});
 assert.equal(status.tile_size,32);
 assert.deepEqual(status.sectors,{size:16,columns:256,rows:256});
 assert.deepEqual(status.streaming_cells,{size:128,columns:32,rows:32});
 assert.equal(status.legacy_scenes_imported,false);
 assert.equal(status.planned_buildings,0);
});

test('M67 cell and sector addressing agrees across boundaries and corners',()=>{
 const a=GRID.tile(127,15),b=GRID.tile(128,16);
 assert.equal(a.cell.id,'dk.cell.world.0.0');
 assert.equal(a.sector.id,'dk.sector.world.7.0');
 assert.equal(b.cell.id,'dk.cell.world.1.0');
 assert.equal(b.sector.id,'dk.sector.world.8.1');
 assert.equal(b.cell.local_x,0);
 assert.deepEqual(GRID.cellBounds(31,31),{x:3968,y:3968,width:128,height:128});
 assert.deepEqual(GRID.sectorBounds(255,255),{x:4080,y:4080,width:16,height:16});
 assert.equal(GRID.tile(4095,4095).cell.id,'dk.cell.world.31.31');
 for(const pair of [[-1,0],[4096,0],[0,4096],[0,1.5],[NaN,0]])
  assert.throws(()=>GRID.tile(...pair),/Invalid/);
});

test('M67 cardinal steps cross cells without teleporting or diagonals',()=>{
 assert.deepEqual([GRID.step(127,25,'east').x,GRID.step(127,25,'east').y],[128,25]);
 assert.equal(GRID.step(0,25,'west'),null);
 assert.equal(GRID.step(4095,4095,'south'),null);
 assert.throws(()=>GRID.step(20,20,'northeast'),/Cardinal/);
 assert.deepEqual(GRID.neighborCells(0,0),{
  north:null,east:'dk.cell.world.1.0',south:'dk.cell.world.0.1',west:null});
});

test('M67 planned buildings may span sector and cell edges, but may not overlap',()=>{
 const w=sample();GRID.ensure(w);
 const b=GRID.planBuilding(w,{id:'my_workshop',kind:'workshop',owner_id:'player:1',
  x:120,y:120,width:24,height:24});
 assert.equal(b.state,'draft');assert.equal(b.cells.length,4);
 assert.equal(GRID.overview(w).planned_buildings,1);
 assert.throws(()=>GRID.planBuilding(w,{id:'colliding',kind:'house',x:130,y:130,
  width:4,height:4}),/overlap/);
 assert.equal(Object.keys(w.world_grid.buildings).length,1,'invalid draft rolls back');
 GRID.planBuilding(w,{id:'next_shop',kind:'shop',x:144,y:120,width:12,height:12});
 assert.equal(GRID.validate(w),true);
 GRID.cancelDraft(w,'my_workshop');
 assert.equal(GRID.overview(w).planned_buildings,1);
});

test('M67 rejects corrupted topology and leaves pre-M67 saves migratable',()=>{
 const w=sample();
 assert.equal(GRID.validate(w),true);
 GRID.ensure(w);
 w.world_grid.cell_size=64;
 assert.throws(()=>GRID.validate(w),/Invalid/);
 w.world_grid.cell_size=128;
 w.world_grid.buildings.bad={id:'bad',kind:'house',owner_id:null,state:'draft',
  x:4095,y:0,width:2,height:2};
 assert.throws(()=>GRID.validate(w),/Invalid/);
});

test('M67 initializes a fresh server world without importing any old scene into new grid',()=>{
 const w=W.makeWorld(Date.UTC(2026,10,8));
 assert.equal(GRID.validate(w),true);
 assert.equal(GRID.overview(w).planned_buildings,0);
 assert.equal(w.world_grid.width,4096);
 assert.deepEqual(w.world_grid.buildings,{});
 assert.equal(W.validateWorld(w),w);
});
