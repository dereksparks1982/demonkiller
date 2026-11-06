'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const W=require('../server/world.cjs');
const L=require('../server/living-world.cjs');
const T=require('../server/world-scheduler-m11.cjs');
const {createDKServer}=require('../server/dk-server.cjs');
const START=Date.UTC(2026,10,6);
test('M11 creates durable deterministic timer jobs and validates them',()=>{
 const w=W.makeWorld(START),jobs=Object.values(w.living.scheduler.jobs);
 assert.equal(jobs.length,5);
 assert.deepEqual(jobs.map(j=>j.kind),
   ['postal_dispatch','camp_rotation','shop_restock','guard_payroll','corpse_cleanup']);
 assert.deepEqual(jobs.map(j=>j.due_minute),[1,90,120,360,60]);
 assert.equal(T.ensure(w),false);
 assert.doesNotThrow(()=>W.validateWorld(w));
});
test('M10 world migrates scheduler without losing time, mail, NPCs or business money',()=>{
 let w=W.makeWorld(START);w.living.minute=137;
 const oldCoins=w.living.businesses.village_bank.coins;
 const npc=w.living.npcs.baker.name;
 delete w.living.scheduler;
 assert.equal(T.ensure(w),true);
 assert.deepEqual(Object.values(w.living.scheduler.jobs).map(x=>x.due_minute),
   [138,180,240,360,180]);
 assert.equal(w.living.businesses.village_bank.coins,oldCoins);
 assert.equal(w.living.npcs.baker.name,npc);
 assert.equal(T.ensure(w),false);
 assert.doesNotThrow(()=>W.validateWorld(w));
});
test('Postal deliveries still use the physical bank box and deliver exactly once',()=>{
 let w=W.makeWorld(START);
 w=L.advance(w,START+70*60000,80).world;
 const letters=w.living.mail.boxes['1'];
 assert.equal(letters.filter(x=>x.id==='letter_1').length,1);
 assert.equal(w.living.mail.outbound.length,0);
 assert.equal(w.living.scheduler.jobs.job_1.fires,70);
 assert.equal(T.runMinute(w,70,[]),0,'A processed minute never fires twice');
 const count=w.living.mail.boxes['1'].length;
 assert.equal(count,1);
 W.validateWorld(w);
});
test('Restock, camps and guard payroll fire on world minutes without duplicate events',()=>{
 const w=W.makeWorld(START),events=[];
 const bank=w.living.businesses.village_bank;
 const guard=w.living.npcs.guard_north;
 bank.stock=0;bank.coins=250;
 const old=guard.coins;
 for(let m=1;m<=360;m++){
   T.runMinute(w,m,events);
   w.living.minute=m;
 }
 assert.equal(bank.stock,25,'Bank restocked once at minute 120');
 assert.equal(bank.coins,216,'One restock cost 30, and two guards received 2 each');
 assert.equal(guard.coins,old+2);
 assert.equal(w.living.scheduler.jobs.job_3.fires,3);
 assert.equal(w.living.scheduler.jobs.job_4.fires,1);
 assert(events.some(e=>e.type==='business.delivery'));
 assert(events.some(e=>e.type==='npc.wages'));
 assert(events.some(e=>e.type==='camp.departed'));
 assert.equal(T.runMinute(w,360,events),0,'No duplicate wages after restart');
 assert.equal(guard.coins,old+2);
 W.validateWorld(w);
});
test('World pause freezes scheduled jobs; resume advances them without catch-up',()=>{
 let w=W.makeWorld(START);
 w=L.advance(w,START+60*60000,100).world;
 const fired=w.living.scheduler.jobs.job_1.fires;
 const stopped=W.setWorldRunning(w,false,START+60*60000);
 const frozen=L.advance(stopped,START+1000*60000,180).world;
 assert.equal(frozen.living.scheduler.jobs.job_1.fires,fired);
 assert.equal(frozen.living.minute,60);
 const running=W.setWorldRunning(frozen,true,START+1000*60000);
 const advanced=L.advance(running,START+1010*60000,180).world;
 assert.equal(advanced.living.minute,70);
 assert.equal(advanced.living.scheduler.jobs.job_1.fires,fired+10);
});
test('Scheduler refuses corrupted jobs and out-of-sequence minutes',()=>{
 const w=W.makeWorld(START);
 assert.throws(()=>T.runMinute(w,2,[]),/exact minutes/);
 w.living.scheduler.jobs.job_2.interval_minutes=13;
 assert.throws(()=>T.validate(w),/Invalid world scheduler job/);
});
test('HTTP endpoint exposes read-only jobs and reboot does not rerun paid wages',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dk-scheduler-m11-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const w=W.makeWorld(START);
 await fs.writeFile(path.join(dir,'world.json'),JSON.stringify(w));
 const app=await createDKServer({dataDir:dir,port:0,now:()=>START});
 t.after(()=>app.server.listening?app.close():Promise.resolve());
 const base='http://127.0.0.1:'+app.address.port;
 const res=await fetch(base+'/api/v1/schedule');
 assert.equal(res.status,200);
 const schedule=await res.json();
 assert.equal(schedule.jobs.length,5);
 assert.equal(schedule.jobs[0].kind,'postal_dispatch');
 assert.equal((await fetch(base+'/api/v1/schedule',{method:'POST',
   headers:{'Content-Type':'application/json'},body:'{}'})).status,405);
 await app.close();
 const another=await createDKServer({dataDir:dir,port:0,now:()=>START+86400000});
 try{
  assert.equal(another.world.living.minute,0);
  assert.equal(another.world.living.scheduler.jobs.job_1.fires,0);
 }finally{await another.close();}
});
