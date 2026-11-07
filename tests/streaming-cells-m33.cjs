'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const W=require('../server/world.cjs'),R=require('../server/regions.cjs');
const CELLS=require('../server/streaming-cells-m33.cjs');
const SECTORS=require('../server/sectors-m10.cjs');
const INTEREST=require('../server/sector-interest-m31.cjs');
const REGIONS=require('../server/region-policies-m16.cjs');
const {deleteCharacter}=require('../server/character-lifecycle-m26.cjs');
const {createDKServer}=require('../server/dk-server.cjs');
const NOW=Date.UTC(2026,10,7,18);
function sample(){
 return W.createCharacter(W.makeWorld(NOW),1,'ELIAS',NOW).world;
}
test('M33 builds variable-size region roots with independently sized building cells',()=>{
 const w=W.makeWorld(NOW),graph=CELLS.catalogue(w);
 assert.equal(graph.cells[CELLS.rootId(R.TEMPLE)].bounds.width,16);
 assert.equal(graph.cells[CELLS.rootId(R.COURT)].bounds.width,64);
 assert.equal(graph.cells[CELLS.rootId(R.VILLAGE)].bounds.width,128);
 const templeOut=graph.cells[CELLS.objectCellId(R.COURT,'temple_exterior')];
 assert.deepEqual(templeOut.bounds,{x:24,y:48,width:16,height:16});
 assert.equal(templeOut.interior_ready,false);
 assert.equal(templeOut.parent,CELLS.rootId(R.COURT));
 const bank=graph.cells[CELLS.objectCellId(R.VILLAGE,'village_bank')];
 assert.deepEqual(bank.bounds,{x:44,y:89,width:20,height:14});
 assert.equal(bank.interior_ready,false);
 assert.equal(graph.cells[CELLS.rootId(R.TEMPLE)].children.length,0);
 assert(graph.cells[CELLS.rootId(R.VILLAGE)].children.length>=10);
});
test('M33 links existing playable temple, courtyard, and village portals without inventing house interiors',()=>{
 const w=W.makeWorld(NOW),graph=CELLS.catalogue(w);
 const links=graph.links.map(e=>[e.from,e.to,e.object_id]);
 assert(links.some(([from,to,id])=>from===CELLS.rootId(R.TEMPLE)&&
   to===CELLS.rootId(R.COURT)&&id==='temple_north_door'));
 assert(links.some(([from,to,id])=>from===CELLS.rootId(R.COURT)&&
   to===CELLS.rootId(R.TEMPLE)&&id==='courtyard_temple_door'));
 assert(links.some(([from,to])=>from===CELLS.rootId(R.COURT)&&
   to===CELLS.rootId(R.VILLAGE)));
 assert(links.some(([from,to])=>from===CELLS.rootId(R.VILLAGE)&&
   to===CELLS.rootId(R.COURT)));
 assert(!links.some(([,to])=>to.includes('building/')),'unfinished building interiors cannot become portals');
 const before=graph.links.find(x=>x.object_id==='temple_north_door');
 assert.equal(before.open,false);
 w.areas[R.TEMPLE].objects.find(o=>o.id==='temple_north_door').open=true;
 assert.equal(CELLS.catalogue(w).links.find(x=>x.object_id==='temple_north_door').open,true);
});
test('M33 saves one visit on character creation and never counts ordinary sector walking as a new cell',()=>{
 const w=sample(),id=CELLS.rootId(R.TEMPLE);
 assert.equal(w.living.streaming_cells.current,id);
 assert.equal(w.living.streaming_cells.records[id].visits,1);
 const initial=JSON.stringify(w.living.streaming_cells);
 const result=W.applyCharacterAction(w,1,{action:'finish_opening'});
 assert.deepEqual(result.world.living.streaming_cells,w.living.streaming_cells);
 assert.equal(JSON.stringify(w.living.streaming_cells),initial);
 W.validateWorld(result.world);
});
test('M33 portal crossings save both cell transitions, including repeat entries in the same minute',()=>{
 const w=sample();
 const c=w.characters['1'];Object.assign(c,{form:'living',opening_state:'resurrected',x:8,y:1,facing:'north'});
 w.areas[R.TEMPLE].objects.find(o=>o.id==='temple_north_door').open=true;
 w.areas[R.COURT].objects.find(o=>o.id==='courtyard_temple_door').open=true;
 W.validateWorld(w);
 const first=W.applyCharacterAction(w,1,{action:'move',direction:'north'});
 assert.equal(first.character.area_id,R.COURT);
 assert.equal(first.world.living.streaming_cells.records[CELLS.rootId(R.COURT)].visits,1);
 assert.deepEqual(first.events.filter(e=>e.type.startsWith('cell.')).map(e=>e.type),
   ['cell.exit','cell.enter']);
 const back=W.applyCharacterAction(first.world,1,{action:'move',direction:'south'});
 assert.equal(back.character.area_id,R.TEMPLE);
 const again=W.applyCharacterAction(back.world,1,{action:'move',direction:'north'});
 assert.equal(again.character.area_id,R.COURT);
 assert.equal(again.world.living.streaming_cells.records[CELLS.rootId(R.COURT)].visits,2);
 assert.equal(again.world.living.streaming_cells.records[CELLS.rootId(R.TEMPLE)].visits,2);
 assert.equal(again.world.living.streaming_cells.current,CELLS.rootId(R.COURT));
 assert.equal(w.living.streaming_cells.records[CELLS.rootId(R.COURT)],undefined);
 W.validateWorld(again.world);
});
test('M33 streaming views expose only current root, nearby building shells, and local connections',()=>{
 const w=sample();const c=w.characters['1'];
 Object.assign(c,{form:'living',opening_state:'resurrected',
  area_id:R.VILLAGE,x:54,y:103});
 c.region_id=REGIONS.regionAt(w,c.area_id,c.x,c.y).id;
 CELLS.ensure(w);
 const v=CELLS.streamingView(w);
 assert.equal(v.current_cell,CELLS.rootId(R.VILLAGE));
 assert.equal(v.root.bounds.width,128);
 assert(v.children.some(x=>x.object_id==='village_bank'&&x.lod==='active'));
 assert(!v.children.some(x=>x.object_id==='village_house_1'));
 assert(v.links.every(x=>x.from===CELLS.rootId(R.VILLAGE)));
 assert(v.links.every(x=>!x.to.includes('building/')));
 assert.equal(v.sector_size,16);
 assert.throws(()=>CELLS.streamingView(w,{radius:100}),/Invalid streaming cell view/);
 W.validateWorld(w);
});
test('M33 older saves migrate and reject forged record ids or impossible visit clocks',()=>{
 const w=sample();delete w.living.streaming_cells;
 assert.equal(W.validateWorld(w),w,'older world schema must remain loadable');
 assert.equal(CELLS.ensure(w),true);
 assert.equal(CELLS.ensure(w),false);
 const old=structuredClone(w),state=w.living.streaming_cells,id=state.current;
 state.records['dk.cell.forged']={visits:1,first_minute:0,last_minute:0};
 assert.throws(()=>W.validateWorld(w),/streaming cell/);
 delete state.records['dk.cell.forged'];
 state.records[id].last_minute=1000;
 assert.throws(()=>W.validateWorld(w),/streaming cell/);
 assert.equal(W.validateWorld(old),old);
});
test('M33 character deletion resets only character visit history, not any world doors or building geometry',()=>{
 const w=sample();const area=JSON.stringify(w.areas);
 const removed=deleteCharacter(w,1,'ELIAS').world;
 assert.deepEqual(removed.living.streaming_cells,{schema:1,records:{},current:null});
 assert.equal(JSON.stringify(removed.areas),area);
 W.validateWorld(removed);
 const next=W.createCharacter(removed,1,'NEW',NOW+2000).world;
 assert.equal(next.living.streaming_cells.records[CELLS.rootId(R.TEMPLE)].visits,1);
 W.validateWorld(next);
});
test('M33 read-only streaming-cell API reflects saved player location and is retained on restart',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dk-m33-'));
 t.after(async()=>{if(app.server.listening)await app.close();await fs.rm(dir,{recursive:true,force:true});});
 const w=sample();await fs.writeFile(path.join(dir,'world.json'),JSON.stringify(w));
 const app=await createDKServer({dataDir:dir,port:0,now:()=>NOW});
 
 const base='http://127.0.0.1:'+app.address.port;
 const r=await fetch(base+'/api/v1/streaming-cells');
 assert.equal(r.status,200);
 const view=await r.json();
 assert.equal(view.current_cell,CELLS.rootId(R.TEMPLE));
 assert.equal(view.root.bounds.width,16);
 assert.equal(view.visited.visits,1);
 assert.equal((await fetch(base+'/api/v1/streaming-cells?radius=99')).status,422);
 assert.equal((await fetch(base+'/api/v1/streaming-cells',{method:'POST',
  headers:{'content-type':'application/json'},body:'{}'})).status,405);
 await app.close();
 const again=await createDKServer({dataDir:dir,port:0,now:()=>NOW+5000});
 try{
  assert.equal(again.world.living.streaming_cells.current,CELLS.rootId(R.TEMPLE));
  assert.equal(again.world.living.streaming_cells.records[CELLS.rootId(R.TEMPLE)].visits,1);
  W.validateWorld(again.world);
 }finally{await again.close();}
});

test('M33 existing sector stream points into the parent Streaming Cell hierarchy',()=>{
 const w=sample();
 const index=SECTORS.build(w);
 const fixtures=[...index.sectors.values()].flat().filter(o=>o.kind==='fixture');
 const courtTemple=fixtures.find(o=>o.id==='temple_exterior');
 const villageBank=fixtures.find(o=>o.id==='village_bank');
 assert.equal(courtTemple.cell_id,CELLS.objectCellId(R.COURT,'temple_exterior'));
 assert.equal(villageBank.cell_id,CELLS.objectCellId(R.VILLAGE,'village_bank'));
 const inTemple=INTEREST.nearbySectors(w);
 assert.equal(inTemple.streaming_cell_id,CELLS.rootId(R.TEMPLE));
 w.characters['1'].area_id=R.VILLAGE;w.characters['1'].x=64;w.characters['1'].y=126;
 const manifest=INTEREST.terrainManifest(w,{area_id:R.VILLAGE});
 assert.equal(manifest.streaming_cell_id,CELLS.rootId(R.VILLAGE));
 const chunk=INTEREST.terrainChunk(w,{area_id:R.VILLAGE,sx:4,sy:7});
 assert.equal(chunk.streaming_cell_id,CELLS.rootId(R.VILLAGE));
});
