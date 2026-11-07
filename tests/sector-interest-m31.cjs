'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const W=require('../server/world.cjs'),R=require('../server/regions.cjs');
const E=require('../server/entity-registry-m10.cjs'),S=require('../server/sectors-m10.cjs');
const M=require('../server/sector-interest-m31.cjs');
const {createDKServer}=require('../server/dk-server.cjs');
const NOW=Date.UTC(2026,10,7,18);
function sample(){
 const w=W.createCharacter(W.makeWorld(NOW),1,'ELIAS',NOW).world;
 const c=w.characters['1'];c.area_id=R.VILLAGE;c.x=15;c.y=31;
 E.reconcile(w);E.counts(w);W.validateWorld(w);
 return w;
}
test('M31 variable-size areas use the established 16 by 16 sector grid',()=>{
 const w=sample();
 assert.equal(M.SIZE,16);
 const temple=M.sectorBounds(w.areas[R.TEMPLE],0,0);
 assert.deepEqual(temple,{x:0,y:0,width:16,height:16});
 const village=M.sectorBounds(w.areas[R.VILLAGE],7,7);
 assert.deepEqual(village,{x:112,y:112,width:16,height:16});
 const edge=M.sectorBounds({width:35,height:33},2,2);
 assert.deepEqual(edge,{x:32,y:32,width:3,height:1});
 assert.throws(()=>M.sectorBounds(w.areas[R.VILLAGE],8,0),/Invalid sector/);
});
test('M31 player-derived interest prefetches across both adjacent sector lines',()=>{
 const w=sample();
 const state=M.nearbySectors(w,1,24);
 assert.deepEqual(state.sector,{sx:0,sy:1});
 const ids=state.sectors.map(s=>s.key);
 assert(ids.includes(R.VILLAGE+'#0,1'));
 assert(ids.includes(R.VILLAGE+'#1,1'));
 assert(ids.includes(R.VILLAGE+'#2,1'));
 assert(ids.includes(R.VILLAGE+'#0,0'));
 assert(ids.includes(R.VILLAGE+'#0,3'));
 assert.equal(state.sectors.find(x=>x.key===R.VILLAGE+'#0,1').tier,'active');
 assert.equal(state.sectors.find(x=>x.key===R.VILLAGE+'#1,1').tier,'neighbor');
 assert.equal(state.sectors.find(x=>x.key===R.VILLAGE+'#2,1').tier,'prefetch');
 for(const entry of state.sectors){
  assert(entry.x>=0&&entry.y>=0);
  assert(entry.width<=16&&entry.height<=16);
 }
 assert.equal(M.tierFor(w,R.VILLAGE,16,31),'neighbor');
 assert.equal(M.tierFor(w,R.COURT,16,31),'background');
});
test('M31 first observation is full, repeated observation is compact, and moving entities update',()=>{
 const w=sample();
 const ticker={t:1000};const manager=M.createInterestTracker({now:()=>ticker.t});
 const first=manager.poll(w,S.build(w),{radius:24});
 assert.equal(first.reset,true);
 assert(first.cursor);
 assert(first.upsert.length>0);
 assert.equal(first.removed.length,0);
 assert(first.upsert.every(e=>e.area_id===R.VILLAGE));
 assert(first.upsert.some(e=>e.kind==='character'&&e.alive===undefined));
 assert(first.upsert.every(e=>!Object.hasOwn(e,'inventory')));
 const second=manager.poll(w,S.build(w),{radius:24,cursor:first.cursor});
 assert.equal(second.reset,false);
 assert.equal(second.upsert.length,0);
 assert.equal(second.removed.length,0);
 w.characters['1'].x=16;w.revision++;E.reconcile(w);
 const third=manager.poll(w,S.build(w),{radius:24,cursor:second.cursor});
 assert.equal(third.reset,false,'crossing a sector is not entering a different map');
 assert(third.upsert.some(e=>e.kind==='character'&&e.x===16));
 assert.deepEqual(third.sector,{sx:1,sy:1});
 assert.equal(third.area_id,R.VILLAGE);
});
test('M31 old entities leave interest on movement but not world memory',()=>{
 const w=sample(),manager=M.createInterestTracker();
 const first=manager.poll(w,S.build(w),{radius:8});
 const p=w.characters['1'];p.x=111;p.y=109;w.revision++;E.reconcile(w);
 const next=manager.poll(w,S.build(w),{radius:8,cursor:first.cursor});
 assert.equal(next.reset,false);
 assert(next.removed.length>0);
 assert(next.upsert.some(x=>x.kind==='character'&&x.x===111));
 assert(w.living.npcs.baker,'distant NPC still exists on the persistent server');
});
test('M31 map transitions reset the stream; stale or reused cursors trigger a fresh snapshot',()=>{
 const w=sample(),manager=M.createInterestTracker();
 const first=manager.poll(w,S.build(w),{radius:24});
 const repeated=manager.poll(w,S.build(w),{cursor:first.cursor,radius:24});
 const reused=manager.poll(w,S.build(w),{cursor:first.cursor,radius:24});
 assert.equal(repeated.reset,false);
 assert.equal(reused.reset,true);
 const c=w.characters['1'];c.area_id=R.COURT;c.x=32;c.y=27;w.revision++;E.reconcile(w);
 const change=manager.poll(w,S.build(w),{cursor:repeated.cursor,radius:24});
 assert.equal(change.reset,true);
 assert.equal(change.area_id,R.COURT);
 assert(change.upsert.every(e=>e.area_id===R.COURT));
 assert(change.sectors.every(e=>e.key.startsWith(R.COURT+'#')));
});
test('M31 interest sessions expire and have hard memory limits',()=>{
 const w=sample(),t={ms:0},m=M.createInterestTracker({now:()=>t.ms,maxSessions:2});
 let a=m.poll(w,S.build(w)),b=m.poll(w,S.build(w));
 assert.equal(m.activeSessions(),2);
 const c=m.poll(w,S.build(w));
 assert.equal(m.activeSessions(),2);
 assert.equal(m.poll(w,S.build(w),{cursor:a.cursor}).reset,true);
 t.ms+=M.EXPIRE_MS+1;
 assert.equal(m.poll(w,S.build(w),{cursor:c.cursor}).reset,true);
 assert.equal(m.activeSessions()<=2,true);
 assert.throws(()=>m.poll(w,S.build(w),{cursor:'abc'}),/Invalid sector cursor/);
 assert.throws(()=>m.poll(w,S.build(w),{radius:100}),/Invalid sector interest radius/);
});
test('M31 tiles stream as 16x16 bounded, authenticated-by-location chunks',()=>{
 const w=sample();
 const chunk=M.terrainChunk(w,{area_id:R.VILLAGE,sx:1,sy:2});
 assert.equal(chunk.sector_size,16);
 assert.equal(chunk.bounds.x,16);assert.equal(chunk.bounds.y,32);
 for(const [name,rows] of Object.entries(chunk.layers)){
  assert.equal(rows.length,16,name);
  assert(rows.every(row=>row.length===16),name);
  for(let y=0;y<16;y++)for(let x=0;x<16;x++)
   assert.deepEqual(rows[y][x],w.areas[R.VILLAGE][name][(y+32)*128+(x+16)]);
 }
 assert(chunk.objects.every(o=>typeof o.id==='string'&&typeof o.type==='string'));
 assert.throws(()=>M.terrainChunk(w,{area_id:R.COURT,sx:1,sy:2}),/outside the current region/);
 assert.throws(()=>M.terrainChunk(w,{area_id:R.VILLAGE,sx:7,sy:7}),/too far/);
});
test('M31 read-only sector endpoints obey the player location, validate input and refresh after movement',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dk-m31-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 await fs.writeFile(path.join(dir,'world.json'),JSON.stringify(sample()));
 const app=await createDKServer({dataDir:dir,port:0,now:()=>NOW});
 t.after(async()=>{if(app.server.listening)await app.close();});
 const base='http://127.0.0.1:'+app.address.port;
 let data=await fetch(base+'/api/v1/sectors/interest');
 assert.equal(data.status,200);
 const first=await data.json();
 assert.equal(first.reset,true);
 assert.equal(first.sector.sx,0);
 assert(first.upsert.some(e=>e.kind==='character'));
 data=await fetch(base+'/api/v1/sectors/interest?radius=24&cursor='+first.cursor);
 assert.equal(data.status,200);
 const second=await data.json();
 assert.equal(second.reset,false);
 assert.equal(second.upsert.length,0);
 const tile=await fetch(base+'/api/v1/sectors/chunk?area='+encodeURIComponent(R.VILLAGE)+'&sx=1&sy=2');
 assert.equal(tile.status,200);
 const parsed=await tile.json();
 assert.equal(parsed.layers.floor.length,16);
 assert.equal((await fetch(base+'/api/v1/sectors/interest?radius=99')).status,422);
 assert.equal((await fetch(base+'/api/v1/sectors/interest?cursor=wrong')).status,422);
 assert.equal((await fetch(base+'/api/v1/sectors/chunk?area='+encodeURIComponent(R.COURT)+'&sx=0&sy=0')).status,422);
 assert.equal((await fetch(base+'/api/v1/sectors/chunk?area='+encodeURIComponent(R.VILLAGE)+'&sx=99&sy=1')).status,422);
 assert.equal((await fetch(base+'/api/v1/sectors/interest',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status,404);
});
