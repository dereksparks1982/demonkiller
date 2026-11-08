'use strict';
// M64: crowd-safe cardinal movement, gate queues and durable traffic diagnostics.
const test=require('node:test'),assert=require('node:assert/strict');
const W=require('../server/world.cjs'),R=require('../server/regions.cjs');
const NAV=require('../server/npc-navigation-m6.cjs');
const TRAFFIC=require('../server/npc-traffic-m64.cjs');
const origin=Date.UTC(2026,10,8),fresh=()=>W.makeWorld(origin);
test('M64 older saved worlds gain traffic records without changing their NPCs or businesses',()=>{
 const w=fresh(),n={...w.living.npcs.baker},coins=w.living.businesses.village_bakery.coins;
 assert.equal(TRAFFIC.ensure(w),false);
 delete w.living.traffic;
 assert.equal(W.validateWorld(w),w);
 assert.equal(TRAFFIC.ensure(w),true);
 assert.equal(TRAFFIC.ensure(w),false);
 assert.deepEqual(w.living.npcs.baker,n);
 assert.equal(w.living.businesses.village_bakery.coins,coins);
 assert.equal(W.validateWorld(w),w);
});
test('M64 pathfinding avoids an occupied NPC tile and reroutes cardinally',()=>{
 const w=fresh(),area=w.areas[R.COURT];
 area.walls.fill(0);area.floor.fill('grass');area.objects=[];
 const a=w.living.npcs.courtyard_keeper,b=w.living.npcs.herbalist;
 a.area_id=R.COURT;a.x=10;a.y=10;
 b.area_id=R.COURT;b.x=11;b.y=10;
 const step=NAV.chooseStep(w,a,{area_id:R.COURT,x:15,y:10});
 assert(step);assert(!(step.x===11&&step.y===10));
 assert.equal(Math.abs(step.x-a.x)+Math.abs(step.y-a.y),1);
 assert.equal(NAV.occupiedTiles(w,R.COURT,a).has('11,10'),true);
});
test('M64 an NPC stops beside an occupied destination rather than standing inside it',()=>{
 const w=fresh(),area=w.areas[R.COURT];
 area.walls.fill(0);area.floor.fill('grass');area.objects=[];
 const a=w.living.npcs.courtyard_keeper,b=w.living.npcs.herbalist;
 a.area_id=R.COURT;a.x=10;a.y=10;
 b.area_id=R.COURT;b.x=11;b.y=10;
 assert.equal(NAV.chooseStep(w,a,{area_id:R.COURT,x:11,y:10}),null);
 assert.equal(TRAFFIC.satisfied(a,{area_id:R.COURT,x:11,y:10}),true);
});
test('M64 a blocked gate arrival waits and crosses only when the exit clears',()=>{
 const w=fresh(),a=w.living.npcs.courier,b=w.living.npcs.baker;
 a.area_id=R.VILLAGE;a.x=64;a.y=126;
 b.area_id=R.COURT;b.x=32;b.y=1;
 const dest={area_id:R.COURT,x:20,y:32};
 assert.equal(NAV.chooseStep(w,a,dest),null);
 b.x=25;b.y=10;
 assert.deepEqual(NAV.chooseStep(w,a,dest),{area_id:R.COURT,x:32,y:1});
});
test('M64 living player blocks crowds, but ghosts remain intangible',()=>{
 let w=fresh();w=W.createCharacter(w,1,'ELIAS',origin).world;
 const p=w.characters['1'];p.area_id=R.COURT;p.x=26;p.y=12;
 assert.equal(NAV.occupiedTiles(w,R.COURT).has('26,12'),false);
 p.form='living';p.opening_state='resurrected';
 assert.equal(NAV.occupiedTiles(w,R.COURT).has('26,12'),true);
});
test('M64 three blocked movement checks produce one saved congestion event, not many',()=>{
 const w=fresh(),n=w.living.npcs.baker,goal={area_id:R.COURT,x:20,y:20};
 const events=[];
 for(const minute of [5,10,15]){w.living.minute=minute;
  TRAFFIC.observe(w,n,goal,minute,false,events);}
 assert.equal(w.living.traffic.total_waits,3);
 assert.equal(w.living.traffic.total_jams,1);
 assert.equal(events.filter(e=>e.type==='npc.traffic.delayed').length,1);
 TRAFFIC.observe(w,n,goal,15,false,events);
 assert.equal(w.living.traffic.total_waits,3);
 const copy=JSON.parse(JSON.stringify(w));
 assert.equal(TRAFFIC.ensure(copy),false);
 assert.equal(W.validateWorld(copy),copy);
});
test('M64 actual NPC movement clears congestion and increments only genuine steps',()=>{
 const w=fresh(),n=w.living.npcs.baker,goal={area_id:R.COURT,x:20,y:20},events=[];
 w.living.minute=5;TRAFFIC.observe(w,n,goal,5,false,events);
 n.y++;w.living.minute=10;TRAFFIC.observe(w,n,goal,10,true,events);
 const t=w.living.traffic.records.baker;
 assert.equal(t.blocked_ticks,0);
 assert.equal(t.total_steps,1);
 assert.equal(w.living.traffic.total_steps,1);
 assert.equal(TRAFFIC.validate(w),true);
});
test('M64 new hired NPCs receive independent traffic records; invalid counter data fails',()=>{
 const w=fresh(),old=w.living.npcs.baker;
 w.living.npcs.resident_88={...old,id:'resident_88',name:'New Worker'};
 assert.equal(TRAFFIC.ensure(w),true);
 assert.equal(TRAFFIC.ensure(w),false);
 assert(w.living.traffic.records.resident_88);
 assert.equal(TRAFFIC.validate(w),true);
 w.living.traffic.records.resident_88.total_waits=-1;
 assert.throws(()=>TRAFFIC.validate(w),/Invalid persistent NPC traffic record/);
});
test('M64 server exposes read-only crowd diagnostics and uses real navigation',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const s=fs.readFileSync(path.join(__dirname,'../server/dk-server.cjs'),'utf8');
 const l=fs.readFileSync(path.join(__dirname,'../server/living-world.cjs'),'utf8');
 assert.match(s,/\/api\/v1\/traffic/);
 assert.match(s,/TRAFFIC[.]listing\(world/);
 assert.match(l,/TRAFFIC[.]observe\(world,n,desired,m,moved,generated\)/);
 assert(!fs.readFileSync(path.join(__dirname,'../outdoor.html'),'utf8')
  .includes('id="trafficButton"'));
});
