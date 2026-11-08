'use strict';
// M59 durable region spawners: strict replay, migration and population invariants.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const W=require('../server/world.cjs'),R=require('../server/regions.cjs');
const S=require('../server/spawners-m59.cjs');
const C=require('../server/combat-m8.cjs');
const root=path.resolve(__dirname,'..');
const world=()=>W.makeWorld(Date.parse('2026-11-07T00:00:00Z'));
const positions=(w,id)=>Object.values(w.living.combat.creatures)
 .filter(c=>c.alive&&c.area_id===id);
function tick(w,m,events=[]){
 w.living.minute=m;C.tick(w,m,events);
 return events;
}
test('M59 new worlds own validated spawn controllers without browser-controlled timers',()=>{
 const w=world();
 assert.equal(S.validate(w),true);
 assert.equal(Object.keys(w.living.spawners.zones).length,4);
 assert.equal(S.ensure(w),false);
 const before=JSON.stringify(w.living.spawners);
 assert.equal(S.ensure(w),false);
 assert.equal(JSON.stringify(w.living.spawners),before);
 assert.equal(S.listing(w).zones.length,4);
 assert.equal(W.validateWorld(w),w);
});
test('M59 older saves migrate without replacing creatures, characters, events or shop accounts',()=>{
 const w=world(),npc=w.living.npcs.baker,oldCoins=w.living.businesses.village_bakery.coins;
 C.spawn(w,R.COURT,0,[],1,'wolf');
 const id=positions(w,R.COURT)[0].id;delete w.living.spawners;
 assert.equal(W.validateWorld(w),w,'old snapshot must remain readable');
 assert.equal(S.ensure(w),true);
 assert.equal(S.ensure(w),false);
 assert(w.living.combat.creatures[id]);
 assert.equal(w.living.npcs.baker,npc);
 assert.equal(w.living.businesses.village_bakery.coins,oldCoins);
 assert.equal(W.validateWorld(w),w);
});
test('M59 first monster occupation populates immediately once and never stacks entities',()=>{
 const w=world(),events=[];
 w.living.territories[R.COURT].control='monsters';
 tick(w,1,events);
 assert.equal(positions(w,R.COURT).length,3);
 const initial=positions(w,R.COURT);
 assert.equal(new Set(initial.map(c=>c.x+':'+c.y)).size,3);
 for(const c of initial){
  assert(R.traversable(w.areas[R.COURT],c.x,c.y,'living'));
  assert(!Object.values(w.living.npcs).some(n=>n.alive&&
   n.area_id===c.area_id&&n.x===c.x&&n.y===c.y));
 }
 const seq=w.living.combat.sequence;
 tick(w,1,events);
 assert.equal(w.living.combat.sequence,seq,'replaying minute is a no-op');
 assert.equal(events.filter(e=>e.type==='monster.spawn').length,3);
 assert.equal(W.validateWorld(w),w);
});
test('M59 reinforcements are capped, species rotate and due minutes survive save/reload',()=>{
 const w=world();
 w.living.territories[R.VILLAGE].control='monsters';
 tick(w,1);
 assert.equal(positions(w,R.VILLAGE).length,5);
 tick(w,90);
 assert.equal(positions(w,R.VILLAGE).length,7);
 assert(positions(w,R.VILLAGE).some(c=>c.kind!=='imp'));
 const snapshot=structuredClone(w),count=positions(snapshot,R.VILLAGE).length;
 assert.equal(S.ensure(snapshot),false);
 tick(snapshot,90);
 assert.equal(positions(snapshot,R.VILLAGE).length,count);
 tick(snapshot,180);
 assert.equal(positions(snapshot,R.VILLAGE).length,8);
 tick(snapshot,270);
 assert.equal(positions(snapshot,R.VILLAGE).length,8);
 assert.equal(W.validateWorld(snapshot),snapshot);
});
test('M59 settled wilderness uses actual territory threat and bounded populations',()=>{
 const w=world(),events=[];
 w.living.territories[R.COURT].threat=1;
 tick(w,120,events);
 assert.equal(positions(w,R.COURT).length,0);
 w.living.territories[R.COURT].threat=3;
 tick(w,240,events);
 assert.equal(positions(w,R.COURT).length,1);
 assert.equal(positions(w,R.COURT)[0].kind,'wolf');
 tick(w,360,events);
 assert.equal(positions(w,R.COURT).length,2);
 tick(w,480,events);
 assert.equal(positions(w,R.COURT).length,2);
 assert.equal(W.validateWorld(w),w);
});
test('M59 defeating the occupying population liberates land and starts a saved grace period',()=>{
 const w=world(),events=[];
 w.living.territories[R.COURT].control='monsters';
 tick(w,1,events);
 for(const c of [...positions(w,R.COURT)])C.dead(w,c,1,events,'player');
 assert.equal(w.living.territories[R.COURT].control,'settlers');
 const z=w.living.spawners.zones.courtyard_siege;
 assert.equal(z.suppressed_until_minute,1+S.LIBERATION_GRACE);
 w.living.territories[R.COURT].control='monsters';
 tick(w,2,events);
 assert.equal(positions(w,R.COURT).length,0,'no immediate fake replacement raid');
 const loaded=structuredClone(w);
 tick(loaded,120,events);
 assert.equal(positions(loaded,R.COURT).length,0);
 tick(loaded,121,events);
 assert.equal(positions(loaded,R.COURT).length,3);
 assert.equal(W.validateWorld(loaded),loaded);
});
test('M59 malformed saved spawners are rejected, without silent reset',()=>{
 const defects=[
  z=>{z.courtyard_siege.spawns=-1;},
  z=>{z.courtyard_siege.last_spawn_minute=999;},
  z=>{z.courtyard_siege.next_due_minute=-3;},
  z=>{z.courtyard_siege.interval_minutes=1;},
  z=>{delete z.village_wild;},
  z=>{z.extra={};}
 ];
 for(const defect of defects){
  const w=world();defect(w.living.spawners.zones);
  assert.throws(()=>W.validateWorld(w),/spawn/i);
 }
});
test('M59 read-only server inspection is integrated; no new gameplay button',()=>{
 const src=fs.readFileSync(path.join(root,'server/dk-server.cjs'),'utf8');
 assert.match(src,/url[.]pathname==='\/api\/v1\/spawners'/);
 assert.match(src,/SPAWNERS[.]listing\(world\)/);
 const out=fs.readFileSync(path.join(root,'outdoor.html'),'utf8');
 assert(!out.includes('spawnMonsterButton'));
});
