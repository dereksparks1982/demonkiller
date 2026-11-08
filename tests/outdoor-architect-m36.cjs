'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const vm=require('node:vm'),syncFs=require('node:fs');
const W=require('../server/world.cjs'),R=require('../server/regions.cjs');
const ARCH=require('../server/outdoor-architect-m36.cjs');
const CELLS=require('../server/streaming-cells-m33.cjs');
const {createDKServer}=require('../server/dk-server.cjs');
const NOW=Date.UTC(2026,10,8,6);
const HOUSE='courtyard_house_sw';
const pick=(world,area,id)=>world.areas[area].objects.find(o=>o.id===id);
function sample(){return W.createCharacter(W.makeWorld(NOW),1,'ELIAS',NOW).world;}
function edit(world,area_id,action,fields={}){
 return ARCH.edit(world,{action,area_id,expected_revision:world.revision,...fields}).world;
}
test('M36 moves complete building tiles and preserves housing/storage identity',()=>{
 const original=sample(),before=JSON.stringify(original);
 const source=pick(original,R.COURT,HOUSE),oldDoor={...source.door};
 const cell=CELLS.objectCellId(R.COURT,HOUSE);
 const next=edit(original,R.COURT,'move_building',{object_id:HOUSE,x:6,y:37});
 const moved=pick(next,R.COURT,HOUSE),house=next.living.housing.records[HOUSE];
 assert.equal(JSON.stringify(original),before);
 assert.deepEqual([moved.x,moved.y],[6,37]);
 assert.deepEqual(moved.door,{x:oldDoor.x+1,y:oldDoor.y});
 assert.equal(next.areas[R.COURT].floor[37*64+6],'stone');
 assert.equal(next.areas[R.COURT].floor[37*64+5],'grass');
 assert.deepEqual([house.x,house.y,house.door_x,house.door_y],
  [6,37,moved.door.x,moved.door.y]);
 const store=next.entity_registry.containers[house.storage_id];
 assert.deepEqual([store.x,store.y],[moved.door.x,moved.door.y]);
 assert.equal(CELLS.catalogue(next).cells[cell].bounds.x,6);
 assert.equal(CELLS.catalogue(original).cells[cell].bounds.x,5);
 W.validateWorld(next);
});
test('M36 door can move to any valid wall then be erased without losing deed or goods',()=>{
 let w=sample(),o=pick(w,R.COURT,HOUSE);
 const old=o.door;
 w=edit(w,R.COURT,'set_door',{object_id:HOUSE,x:o.x,y:o.y+4});
 o=pick(w,R.COURT,HOUSE);
 assert.deepEqual(o.door,{x:5,y:41});
 assert.equal(w.areas[R.COURT].walls[old.y*64+old.x],1);
 assert.equal(w.areas[R.COURT].walls[41*64+5],0);
 assert.equal(w.living.housing.records[HOUSE].door_x,5);
 W.validateWorld(w);
 w=edit(w,R.COURT,'remove_door',{object_id:HOUSE});
 assert.equal(pick(w,R.COURT,HOUSE).door,null);
 assert.equal(w.areas[R.COURT].walls[41*64+5],1);
 assert.equal(w.living.housing.records[HOUSE].owner,null);
 assert.equal(w.living.housing.records[HOUSE].door_x,null);
 W.validateWorld(w);
 assert.equal(require('../server/housing-m17.cjs').listing(w).total_houses,10);
 w=edit(w,R.COURT,'set_door',{object_id:HOUSE,x:11,y:46});
 assert.deepEqual(pick(w,R.COURT,HOUSE).door,{x:11,y:46});
 W.validateWorld(w);
});
test('M36 shop relocation repositions its physical vendor container',()=>{
 const w=sample(),stock=w.entity_registry.containers.vendor_stock_village_bakery;
 assert(stock);
 const x=pick(w,R.VILLAGE,'village_bakery').x;
 const moved=edit(w,R.VILLAGE,'move_building',
  {object_id:'village_bakery',x:x+1,y:88});
 const shop=pick(moved,R.VILLAGE,'village_bakery');
 const container=moved.entity_registry.containers.vendor_stock_village_bakery;
 assert.equal(container.x,shop.door.x);
 assert.equal(container.y,shop.door.y+1);
 assert.equal(w.entity_registry.containers.vendor_stock_village_bakery.x,stock.x);
 W.validateWorld(moved);
});
test('M36 protects temple, story anchor, paths, other buildings and stale writes',()=>{
 const w=sample(),before=JSON.stringify(w);
 const command=(action,fields={})=>ARCH.edit(w,
  {action,area_id:R.COURT,expected_revision:w.revision,...fields});
 assert.throws(()=>command('move_building',{object_id:'temple_exterior',x:25,y:48}),/protected/);
 assert.throws(()=>command('move_building',{object_id:HOUSE,x:47,y:37}),/overlaps|Blocked/);
 assert.throws(()=>command('move_building',{object_id:HOUSE,x:26,y:38}),/path|garden|overlaps|wall/);
 assert.throws(()=>command('set_door',{object_id:HOUSE,x:5,y:37}),/corner/);
 assert.throws(()=>command('remove_door',{object_id:'lilith_willow'}),/protected/);
 assert.throws(()=>ARCH.edit(w,{action:'move_fixture',area_id:R.COURT,
  expected_revision:w.revision-1,object_id:'courtyard_well',x:48,y:28}),/Stale exterior revision/);
 assert.throws(()=>command('paint_rectangle',{x:0,y:0,w:20,h:20,floor:'dirt'}),/Invalid ground/);
 assert.equal(JSON.stringify(w),before);
});
test('M36 material brush preserves building walls, stone path unless deliberately edited',()=>{
 const w=sample(),a=w.areas[R.COURT];
 const road=a.floor[28*64+31],roof=a.floor[40*64+7];
 const changed=edit(w,R.COURT,'paint_rectangle',{x:17,y:37,w:4,h:2,floor:'dirt'});
 assert.equal(changed.areas[R.COURT].floor[37*64+17],'dirt');
 assert.equal(changed.areas[R.COURT].floor[28*64+31],road);
 assert.equal(changed.areas[R.COURT].floor[40*64+7],roof);
 W.validateWorld(changed);
});
test('M36 layout export is only map data and preserves IDs and dimensions',()=>{
 const w=sample(),out=ARCH.exportLayout(w,R.COURT);
 assert.equal(out.format,'dk.outdoor.layout.m36');
 assert.equal(out.world_revision,w.revision);
 assert.equal(out.map.width,64);
 assert.equal(out.map.tile_size,32);
 assert.equal(out.map.objects.find(o=>o.id==='lilith_willow').x,31);
 assert.equal('characters' in out,false);
 assert.equal('living' in out,false);
 assert.equal(ARCH.list(w,R.VILLAGE).buildings.length,10);
});
test('M36 browser includes usable bottom tools, controlled F8 and no gameplay buttons',()=>{
 const root=path.join(__dirname,'..');
 const html=syncFs.readFileSync(path.join(root,'dk-architect-outdoors-m36.html'),'utf8');
 const ui=syncFs.readFileSync(path.join(root,'dk-architect-outdoors-m36.js'),'utf8');
 const game=syncFs.readFileSync(path.join(root,'outdoor.js'),'utf8');
 const client=syncFs.readFileSync(path.join(root,'dk-menu-server.js'),'utf8');
 for(const id of ['select','move','door','erase','ground','inspect'])
  assert(html.includes('data-tool="'+id+'"'));
 assert(html.includes('id="export"'));
 assert(game.includes('DKOutdoorArchitectBridge')); // F8 is now captured by the on-screen construction controller.
 assert(client.includes("async editOutdoor("));
 assert(ui.includes("map.addEventListener('pointerdown'"));
 assert(ui.includes("map.addEventListener('pointermove'"));
 assert(ui.includes("map.addEventListener('pointerup'"));
 assert(ui.includes('URL.createObjectURL(blob)'));
 assert.doesNotThrow(()=>new vm.Script(ui,{filename:'dk-architect-outdoors-m36.js'}));
});
test('M36 exterior edits save atomically on server and survive restart',async t=>{
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'dk-architect-m36-'));
 t.after(()=>fs.rm(folder,{recursive:true,force:true}));
 let first=await createDKServer({dataDir:folder,port:0,now:()=>NOW});
 t.after(async()=>{if(first?.server?.listening)await first.close();});
 let base='http://127.0.0.1:'+first.address.port;
 const url='/api/v1/architect/outdoors/edit';
 const post=(data,withKey=true)=>fetch(base+url,{
  method:'POST',headers:{'Content-Type':'application/json',
   ...(withKey?{'X-DK-Architect':'outdoors'}:{})},body:JSON.stringify(data)
 });
 const exported=await fetch(base+'/api/v1/architect/outdoors/export?area_id='+encodeURIComponent(R.COURT));
 assert.equal(exported.status,200);
 const data=await exported.json();assert.equal(data.format,'dk.outdoor.layout.m36');
 const cmd={action:'move_fixture',area_id:R.COURT,
  expected_revision:data.world_revision,object_id:'courtyard_market',x:11,y:25};
 const unauthorized=await post(cmd,false);assert.equal(unauthorized.status,403);
 const saved=await post(cmd);assert.equal(saved.status,200);
 const stale=await post(cmd);assert.equal(stale.status,409);
 const area=await (await fetch(base+'/api/v1/areas/'+encodeURIComponent(R.COURT))).json();
 assert.equal(area.area.objects.find(o=>o.id==='courtyard_market').x,11);
 await first.close();first=null;
 const second=await createDKServer({dataDir:folder,port:0,now:()=>NOW});
 first=second;base='http://127.0.0.1:'+first.address.port;
 assert.equal(first.world.areas[R.COURT].objects.find(o=>o.id==='courtyard_market').x,11);
 W.validateWorld(first.world);
});
