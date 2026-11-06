'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const os=require('node:os'),path=require('node:path'),fs=require('node:fs/promises');
const {createDKServer}=require('../server/dk-server.cjs');
const {DAY_MS,setWorldRunning,checkpointWorldTime,worldClock,makeWorld,validateWorld}=require('../server/world.cjs');
const POST=(base,route,control)=>fetch(base+route,{method:'POST',headers:{'X-DK-Control':control}});
const send=(base,slot,name)=>fetch(base+'/api/v1/characters',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slot,name})});
const temp=async(t)=>{const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dk-m4-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));return dir;};

test('world clock freezes on Stop and advances only after Start',()=>{
 const start=Date.UTC(2026,10,6);const world=makeWorld(start);
 const paused=setWorldRunning(world,false,start+1000);
 assert.equal(worldClock(paused,start+DAY_MS).elapsed_in_phase_seconds,1);
 assert.equal(worldClock(paused,start+DAY_MS).running,false);
 const resumed=setWorldRunning(paused,true,start+DAY_MS*3);
 assert.equal(worldClock(resumed,start+DAY_MS*3+DAY_MS).phase,'night');
 assert.equal(worldClock(resumed,start+DAY_MS*3+DAY_MS).running,true);
 const checkpoint=checkpointWorldTime(resumed,start+DAY_MS*3+DAY_MS);
 assert.equal(worldClock(checkpoint,start+DAY_MS*3+DAY_MS).elapsed_in_phase_seconds,1);
 assert.doesNotThrow(()=>validateWorld(checkpoint));
});

test('one character is authoritative: second and third slot never allowed',async t=>{
 const dir=await temp(t);const app=await createDKServer({dataDir:dir,port:0});
 t.after(()=>app.server.listening?app.close():undefined);
 const base='http://127.0.0.1:'+app.address.port;
 assert.equal((await send(base,2,'ALICE')).status,422);
 assert.equal((await send(base,3,'BOB')).status,422);
 assert.equal((await send(base,1,'FIRST')).status,201);
 assert.equal((await send(base,1,'SECOND')).status,409);
 assert.equal((await fetch(base+'/api/v1/characters/2')).status,404);
 assert.equal(Object.keys(app.world.characters).join(','),'1');
 await app.close();
});

test('Start/Stop persist world state; closing the browser does not stop time',async t=>{
 const dir=await temp(t);let tNow=Date.UTC(2026,10,6);
 const app=await createDKServer({dataDir:dir,port:0,now:()=>tNow,tickMs:250});
 t.after(()=>app.server.listening?app.close():undefined);
 const base='http://127.0.0.1:'+app.address.port;
 assert.equal((await send(base,1,'ALIVE')).status,201);
 assert.equal((await POST(base,'/api/v1/server/stop','start')).status,403);
 assert.equal((await POST(base,'/api/v1/server/stop','stop')).status,200);
 assert.equal((await (await fetch(base+'/api/v1/server/state')).json()).running,false);
 tNow+=DAY_MS*2;
 assert.equal((await (await fetch(base+'/api/v1/clock')).json()).phase,'day');
 assert.equal((await fetch(base+'/api/v1/characters/1/actions',{method:'POST',
   headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'finish_opening'})})).status,409);
 assert.equal((await POST(base,'/api/v1/server/start','start')).status,200);
 tNow+=DAY_MS;
 assert.equal((await (await fetch(base+'/api/v1/clock')).json()).phase,'night');
 assert.equal(app.server.listening,true);
 await app.close();
 const disk=JSON.parse(await fs.readFile(path.join(dir,'world.json'),'utf8'));
 assert.equal(disk.runtime.running,false);
 assert.equal(disk.runtime.elapsed_ms,DAY_MS);
 const next=await createDKServer({dataDir:dir,port:0,now:()=>tNow+DAY_MS*5});
 t.after(()=>next.server.listening?next.close():undefined);
 assert.equal(next.snapshot().clock.phase,'night');
 assert.equal(next.snapshot().clock.running,false);
 await next.close();
});

test('legacy M3 world can pause safely without losing the temple',()=>{
 const old=makeWorld(1000);delete old.runtime;
 assert.doesNotThrow(()=>validateWorld(old));
 const paused=setWorldRunning(old,false,9000);
 assert.equal(worldClock(paused,9000).elapsed_in_phase_seconds,8);
 assert.equal(paused.areas['dk.temple.sacrifice.001'].objects.length,9);
});
