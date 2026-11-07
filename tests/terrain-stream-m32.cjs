'use strict';
const {syncAll}=require('./helpers/sync-fixture.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const W=require('../server/world.cjs'),R=require('../server/regions.cjs');
const STREAM=require('../sector-terrain-m32.js');
const SECTORS=require('../server/sector-interest-m31.cjs');
const {createDKServer}=require('../server/dk-server.cjs');
const NOW=Date.UTC(2026,10,8);
function world(){
 const w=W.createCharacter(W.makeWorld(NOW),1,'ELIAS',NOW).world;
 w.characters['1'].area_id=R.VILLAGE;
 w.characters['1'].x=15;w.characters['1'].y=31;
 syncAll(w);
 return w;
}
function client(world,additional={}){
 const manifest=SECTORS.terrainManifest(world,{area_id:R.VILLAGE});
 return STREAM.makeSession({manifest,
  loadChunk:async(region,sx,sy)=>SECTORS.terrainChunk(world,{area_id:region,sx,sy}),
  ...additional});
}
test('M32 manifest provides full object information, no entire terrain arrays',()=>{
 const w=world(),m=SECTORS.terrainManifest(w,{area_id:R.VILLAGE});
 assert.equal(m.width,128);assert.equal(m.height,128);
 assert.equal(m.sector_size,16);assert.equal(m.tile_size,32);
 assert.deepEqual(m.sectors_x,8);
 assert(!Object.hasOwn(m,'floor'));
 assert(!Object.hasOwn(m,'walls'));
 assert(m.objects.length>10);
 const a=STREAM.makeArea(m);
 assert.equal(a.streamed,true);assert.equal(a.floor.length,128*128);
 assert.equal(a.floor[0],null);
 assert.deepEqual(a.objects,m.objects);
 assert.throws(()=>SECTORS.terrainManifest(w,{area_id:R.COURT}),/outside the current region/);
});
test('M32 initial prefetch loads the whole viewport ring before gameplay',async()=>{
 const w=world(),s=client(w);
 const area=await s.prime(15,31);
 assert.equal(s.stats().loaded,6,'at the western edge the ring has six sectors');
 assert(s.has(0,16));
 assert(s.has(16,16));
 assert(s.has(16,32));
 assert.equal(s.has(32,32),false,'the first ring must not fetch two sectors ahead');
 const source=w.areas[R.VILLAGE];
 for(const layer of STREAM.LAYERS)for(let y=16;y<48;y++)for(let x=0;x<32;x++){
  assert.deepEqual(area[layer][y*128+x],source[layer][y*128+x]);
 }
 assert.equal(area.floor[90*128+90],null,'distant chunk not downloaded');
 assert(area.objects.some(o=>o.type==='house'),'static objects preserve original door behavior');
 s.close();
});
test('M32 bounded cache retains the focus neighborhood and evicts distant chunks',async()=>{
 const w=world(),s=client(w,{maxCached:9,maxParallel:2});
 await s.prime(25,25);
 assert.equal(s.stats().loaded,9);
 const old=0*128+0;
 assert(s.has(25,25));
 // The server only authorizes chunks near its authoritative player tile.
 w.characters['1'].x=80;w.characters['1'].y=80;
 s.setFocus(80,80);
 const result=await s.prefetch(s.around(80,80,2));
 assert.equal(result.failed,0);
 assert(s.stats().loaded<=9);
 assert(s.has(80,80));
 assert(s.has(96,80));
 assert.equal(s.has(0,0),false);
 assert.equal(s.area.floor[old],null,'evicted layer must release tile cells');
 s.close();
});
test('M32 concurrent prefetch work stays below the requested network cap',async()=>{
 const w=world();let active=0,peak=0,calls=0;
 const session=client(w,{maxParallel:2,loadChunk:async(area,sx,sy)=>{
  active++;peak=Math.max(peak,active);calls++;
  await new Promise(resolve=>setTimeout(resolve,1));
  try{return SECTORS.terrainChunk(w,{area_id:area,sx,sy});}
  finally{active--;}
 }});
 const a=session.prefetch(session.around(15,31,2));
 const b=session.prefetch(session.around(15,31,1));
 const [one,two]=await Promise.all([a,b]);
 assert.equal(one.failed+two.failed,0);
 assert(peak<=2);
 assert(calls<=12,'overlapping fetches should be deduplicated');
 session.close();
});
test('M32 rejects malformed or wrong-area chunk responses before touching geometry',async()=>{
 const w=world(),m=SECTORS.terrainManifest(w,{area_id:R.VILLAGE});
 const good=SECTORS.terrainChunk(w,{area_id:R.VILLAGE,sx:0,sy:1});
 const bad=structuredClone(good);bad.area_id=R.COURT;
 const a=STREAM.makeArea(m);
 assert.throws(()=>STREAM.writeChunk(a,bad),/Invalid terrain chunk identity/);
 assert.equal(a.floor[16*128],null);
 const broken=structuredClone(good);broken.layers.floor.pop();
 assert.throws(()=>STREAM.writeChunk(a,broken),/Incomplete streamed tile layer/);
 assert.equal(a.floor[16*128],null);
 STREAM.writeChunk(a,good);
 assert.equal(a.floor[16*128],w.areas[R.VILLAGE].floor[16*128]);
});
test('M32 initial terrain fetch errors reject cleanly so gameplay can load the full-map fallback',async()=>{
 const w=world();
 const s=client(w,{loadChunk:async()=>{throw Error('temporary network failure');}});
 await assert.rejects(s.prime(15,31),/temporary network failure/);
 assert.equal(s.stats().loaded,0);
 assert.equal(s.stats().last_failure,'temporary network failure');
 s.close();
 assert.equal(s.stats().closed,true);
});
test('M32 revisiting a sector creates no duplicates or changes to physical item ownership',async()=>{
 const w=world(),saved=JSON.stringify(w),s=client(w);
 await s.prime(15,31);
 s.setFocus(31,47);
 const next=await s.prefetch(s.around(31,47,1));
 assert.equal(next.failed,0);
 s.setFocus(15,31);
 await s.prefetch(s.around(15,31,1));
 assert.equal(s.stats().pending,0);
 assert.equal(JSON.stringify(w),saved,'client tile cache never mutates the saved server world');
 s.close();
});
test('M32 local server exposes bounded manifests and chunks, not arbitrary regions',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dk-stream-m32-'));
 t.after(async()=>{if(app.server.listening)await app.close();await fs.rm(dir,{recursive:true,force:true});});
 const w=world();
 await fs.writeFile(path.join(dir,'world.json'),JSON.stringify(w));
 const app=await createDKServer({dataDir:dir,port:0,now:()=>NOW});
 
 const base='http://127.0.0.1:'+app.address.port;
 const manifest=await fetch(base+'/api/v1/sectors/manifest?area='+encodeURIComponent(R.VILLAGE));
 assert.equal(manifest.status,200);
 const m=await manifest.json();
 assert(!Object.hasOwn(m,'floor'));assert.equal(m.width,128);
 const chunk=await fetch(base+'/api/v1/sectors/chunk?area='+encodeURIComponent(R.VILLAGE)+'&sx=1&sy=2');
 assert.equal(chunk.status,200);
 const c=await chunk.json();
 assert.equal(c.layers.floor.length,16);
 assert.equal((await fetch(base+'/api/v1/sectors/manifest?area='+encodeURIComponent(R.COURT))).status,422);
 assert.equal((await fetch(base+'/api/v1/sectors/chunk?area='+encodeURIComponent(R.VILLAGE)+'&sx=99&sy=99')).status,422);
 const served=await fetch(base+'/sector-terrain-m32.js');
 assert.equal(served.status,200);
 assert((await served.text()).includes('DKSectorTerrain'));
});
