'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const W=require('../server/world.cjs'),R=require('../server/regions.cjs');
const {syncAll}=require('./helpers/sync-fixture.cjs');
const CONTENT=require('../server/cell-contents-m34.cjs');
const CELLS=require('../server/streaming-cells-m33.cjs');
const {createDKServer}=require('../server/dk-server.cjs');
const NOW=Date.UTC(2026,10,7);
function sample(){
 const w=W.createCharacter(W.makeWorld(NOW),1,'ELIAS',NOW).world;
 return w;
}
function place(w,area,x,y){
 const p=w.characters['1'];
 p.area_id=area;p.x=x;p.y=y;
 syncAll(w);return w;
}
test('M34 temple contents are server-derived, bounded, with no duplicate world authority',()=>{
 const w=sample(),before=JSON.stringify(w);
 const result=CONTENT.records(w);
 assert.equal(result.root_cell,CELLS.rootId(R.TEMPLE));
 assert.equal(result.cells.length,1);
 assert(result.entities.size>5);
 assert([...result.entities.values()].every(o=>o.area_id===R.TEMPLE));
 assert([...result.entities.values()].every(o=>!Object.hasOwn(o,'inventory')));
 assert.equal(result.entities.has('character:player:1'),false);
 assert.equal(result.entities.has('fixture:sacrifice_altar'),true);
 assert.equal(JSON.stringify(w),before,'read-only content collection never changes a save');
 W.validateWorld(w);
});
test('M34 building child cells contain their live exteriors but no imaginary interiors',()=>{
 const w=place(sample(),R.VILLAGE,54,103),out=CONTENT.records(w);
 const bank=out.cells.find(c=>c.object_id==='village_bank');
 assert(bank);assert.equal(bank.lod,'active');
 assert.equal(bank.interior_ready,false);
 const fixture=out.entities.get('fixture:village_bank');
 assert(fixture);assert.equal(fixture.cell_id,bank.id);
 assert.equal(fixture.type,'bank');
 assert.deepEqual([bank.bounds.width,bank.bounds.height],[20,14]);
 assert(!out.cells.some(c=>c.id.includes('interior')));
 assert(!out.entities.has('fixture:temple_north_door'));
 W.validateWorld(w);
});
test('M34 a nearby NPC is present only while alive and retains original mobile serial',()=>{
 const w=sample(),n=w.living.npcs.baker;
 place(w,n.area_id,n.x,n.y);
 const before=CONTENT.records(w),npc=before.entities.get('npc:baker');
 assert(npc);assert.equal(npc.alive,true);
 assert.equal(npc.cell_id,CELLS.rootId(n.area_id));
 assert.equal(npc.serial,w.entity_registry.refs['npc:baker'].serial);
 n.alive=false;w.revision++;
 const later=CONTENT.records(w);
 assert(!later.entities.has('npc:baker'));
 assert(w.living.npcs.baker,'the NPC remains in the persistent world record');
});
test('M34 first poll is full; subsequent updates are precise and do not resend unchanged fixtures',()=>{
 const w=place(sample(),R.VILLAGE,54,103);
 const t={ms:0},tracker=CONTENT.createTracker({now:()=>t.ms});
 const a=tracker.poll(w);
 assert.equal(a.reset,true);assert(a.cell_upsert.length>1);
 assert(a.upsert.some(x=>x.id==='village_bank'));
 const b=tracker.poll(w,{cursor:a.cursor});
 assert.equal(b.reset,false);assert.equal(b.upsert.length,0);
 assert.equal(b.removed.length,0);assert.equal(b.cell_upsert.length,0);
 const bank=w.areas[R.VILLAGE].objects.find(x=>x.id==='village_bank');
 bank.locked=true;w.revision++;
 const c=tracker.poll(w,{cursor:b.cursor});
 assert.equal(c.reset,false);
 assert.deepEqual(c.upsert.map(e=>e.id),['village_bank']);
 assert.equal(c.upsert[0].locked,true);
 const again=tracker.poll(w,{cursor:c.cursor});
 assert.equal(again.upsert.length,0);
 W.validateWorld(w);
});
test('M34 moving away unloads old entities but never erases world fixtures',()=>{
 const w=place(sample(),R.VILLAGE,54,103),tracker=CONTENT.createTracker();
 const before=tracker.poll(w,{radius:8});
 assert(before.upsert.some(e=>e.id==='village_bank'));
 const count=w.areas[R.VILLAGE].objects.length;
 place(w,R.VILLAGE,115,110);w.revision++;
 const after=tracker.poll(w,{radius:8,cursor:before.cursor});
 assert.equal(after.reset,false);
 assert(after.removed.includes('fixture:village_bank'));
 assert(after.cell_removed.some(x=>x.includes('building/village_bank')));
 assert.equal(w.areas[R.VILLAGE].objects.length,count);
 assert(w.areas[R.VILLAGE].objects.some(x=>x.id==='village_bank'));
});
test('M34 cell transitions and cursor expiration produce safe full snapshots',()=>{
 const w=sample(),t={ms:0},tracker=CONTENT.createTracker({now:()=>t.ms,maxSessions:2});
 const first=tracker.poll(w);
 const next=tracker.poll(w,{cursor:first.cursor});
 assert.equal(next.reset,false);
 place(w,R.COURT,32,28);w.revision++;
 const changed=tracker.poll(w,{cursor:next.cursor});
 assert.equal(changed.reset,true);
 assert.equal(changed.area_id,R.COURT);
 assert(changed.upsert.every(e=>e.area_id===R.COURT));
 assert.equal(tracker.poll(w,{cursor:next.cursor}).reset,true,'used cursors may not replay old deltas');
 t.ms=CONTENT.SESSION_MS+1;
 assert.equal(tracker.poll(w,{cursor:changed.cursor}).reset,true);
 assert.throws(()=>tracker.poll(w,{cursor:'invalid'}),/Invalid streaming contents cursor/);
 assert.throws(()=>tracker.poll(w,{radius:99}),/Invalid streaming contents radius/);
 assert(tracker.sessionCount()<=2);
});
test('M34 HTTP content stream persists real doors and world state across restart',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dk-m34-'));
 const w=sample();
 await fs.writeFile(path.join(dir,'world.json'),JSON.stringify(w));
 const app=await createDKServer({dataDir:dir,port:0,now:()=>NOW});
 t.after(async()=>{
  if(app.server.listening)await app.close();
  await fs.rm(dir,{recursive:true,force:true});
 });
 const base='http://127.0.0.1:'+app.address.port;
 const first=await fetch(base+'/api/v1/streaming-cells/contents');
 assert.equal(first.status,200);
 const initial=await first.json();
 assert(initial.upsert.some(e=>e.kind==='fixture'&&e.id==='temple_north_door'));
 assert.equal(initial.root_cell,CELLS.rootId(R.TEMPLE));
 const next=await fetch(base+'/api/v1/streaming-cells/contents?cursor='+initial.cursor);
 assert.equal(next.status,200);
 assert.equal((await next.json()).upsert.length,0);
 assert.equal((await fetch(base+'/api/v1/streaming-cells/contents?radius=100')).status,422);
 assert.equal((await fetch(base+'/api/v1/streaming-cells/contents?cursor=garbage')).status,422);
 assert.equal((await fetch(base+'/api/v1/streaming-cells/contents',{method:'POST',
  headers:{'content-type':'application/json'},body:'{}'})).status,405);
 const originalDoor=app.world.areas[R.TEMPLE].objects.find(x=>x.id==='temple_north_door').open;
 await app.close();
 const returned=await createDKServer({dataDir:dir,port:0,now:()=>NOW+3000});
 try{
  assert.equal(returned.world.areas[R.TEMPLE].objects.find(x=>x.id==='temple_north_door').open,originalDoor);
  assert.equal(returned.world.living.streaming_cells.current,CELLS.rootId(R.TEMPLE));
  W.validateWorld(returned.world);
 }finally{await returned.close();}
});
