'use strict';
// M61 guard watch: actual saved combat, no client-directed damage/teleport.
const test=require('node:test'),assert=require('node:assert/strict');
const W=require('../server/world.cjs'),R=require('../server/regions.cjs');
const COMBAT=require('../server/combat-m8.cjs');
const GUARDS=require('../server/guard-watch-m61.cjs');
const DISTRICTS=require('../server/region-policies-m16.cjs');
const ORIGIN=Date.UTC(2026,10,8);
const fresh=()=>W.makeWorld(ORIGIN);
test('M61 seeds guarded duties and validates an old world without replacement',()=>{
 const w=fresh(),bank=w.living.businesses.village_bank.coins;
 const key=Object.keys(w.living.guard_watch.sentries).sort();
 assert(key.includes('guard_north')&&key.includes('guard_south'));
 assert.equal(GUARDS.ensure(w),false);
 delete w.living.guard_watch;
 assert.equal(W.validateWorld(w),w);
 assert.equal(GUARDS.ensure(w),true);
 assert.equal(GUARDS.ensure(w),false);
 assert.equal(w.living.businesses.village_bank.coins,bank);
 assert.equal(W.validateWorld(w),w);
});
test('M61 independent patrol spots, strikes and saves a genuine hostile',()=>{
 const w=fresh(),guard=w.living.npcs.guard_north,events=[];
 // Do not change player world state. Place one wolf on a clear adjacent tile.
 COMBAT.spawn(w,R.VILLAGE,0,events,1,'wolf');
 const wolf=Object.values(w.living.combat.creatures)[0];
 guard.x=wolf.x;guard.y=wolf.y;
 w.living.minute=5;
 const hp=wolf.health;
 assert.equal(GUARDS.tick(w,5,events,COMBAT.dead),1);
 assert(wolf.health<hp);
 assert(events.some(e=>e.type==='guard.alarm'));
 assert(events.some(e=>e.type==='guard.strike'));
 assert.equal(w.living.guard_watch.total_attacks,1);
 DISTRICTS.syncNpcTransitions(w,5,events);
 assert.equal(W.validateWorld(w),w);
});
test('M61 per-minute guard attacks cannot be duplicated by replaying the tick',()=>{
 const w=fresh(),events=[];
 const guard=w.living.npcs.guard_north;
 COMBAT.spawn(w,R.VILLAGE,0,events,1,'wolf');
 const wolf=Object.values(w.living.combat.creatures)[0];
 guard.x=wolf.x;guard.y=wolf.y;w.living.minute=5;
 GUARDS.tick(w,5,events,COMBAT.dead);
 const health=wolf.health,count=w.living.guard_watch.total_attacks;
 assert.equal(GUARDS.tick(w,5,events,COMBAT.dead),0);
 assert.equal(wolf.health,health);
 assert.equal(w.living.guard_watch.total_attacks,count);
 DISTRICTS.syncNpcTransitions(w,5,events);
 assert.equal(W.validateWorld(w),w);
});
test('M61 guards can finish a monster, create a durable corpse and liberate territory',()=>{
 const w=fresh(),events=[];
 const guard=w.living.npcs.guard_north;
 w.living.territories[R.VILLAGE].control='monsters';
 COMBAT.spawn(w,R.VILLAGE,0,events,1,'imp');
 const imp=Object.values(w.living.combat.creatures)[0];
 guard.x=imp.x;guard.y=imp.y;imp.health=4;w.living.minute=5;
 GUARDS.tick(w,5,events,COMBAT.dead);
 assert.equal(w.living.combat.creatures[imp.id],undefined);
 assert.equal(w.living.territories[R.VILLAGE].control,'settlers');
 assert(events.some(e=>e.type==='guard.kill'));
 assert(events.some(e=>e.type==='monster.defeated'));
 assert(Object.values(w.living.mobile_assets?.corpses||{}).some(c=>c.creature_id===imp.id));
 DISTRICTS.syncNpcTransitions(w,5,events);
 assert.equal(W.validateWorld(w),w);
});
test('M61 injured guards stop attacking and do not create free medical supplies',()=>{
 const w=fresh(),events=[];
 const guard=w.living.npcs.guard_north;
 COMBAT.spawn(w,R.VILLAGE,0,events,1,'imp');
 const imp=Object.values(w.living.combat.creatures)[0];
 guard.x=imp.x;guard.y=imp.y;guard.health=8;w.living.minute=5;
 const hp=imp.health,bank=w.living.businesses.village_bank.coins;
 assert.equal(GUARDS.tick(w,5,events,COMBAT.dead),0);
 assert.equal(imp.health,hp);assert.equal(guard.health,8);
 assert.equal(w.living.businesses.village_bank.coins,bank);
 assert.equal(guard.status,'wounded');
});
test('M61 new successor guards get one durable watch record; invalid data is rejected',()=>{
 const w=fresh();
 w.living.npcs.resident_63={...w.living.npcs.guard_south,
  id:'resident_63',name:'Replacement Guard',x:64,y:118,alive:true};
 assert.equal(GUARDS.ensure(w),true);
 assert.equal(GUARDS.ensure(w),false);
 assert(w.living.guard_watch.sentries.resident_63);
 DISTRICTS.ensure(w);
 assert.equal(GUARDS.validate(w),true);
 w.living.guard_watch.sentries.resident_63.attacks=-1;
 assert.throws(()=>GUARDS.validate(w),/guard watch/i);
});
test('M61 passive guard diagnostics have no POST state modification action',()=>{
 const fs=require('node:fs');
 const server=fs.readFileSync(require('node:path').resolve(__dirname,'../server/dk-server.cjs'),'utf8');
 assert.match(server,/\/api\/v1\/guard-watch/);
 assert.match(server,/GUARDS[.]listing\(world/);
 const src=fs.readFileSync(require('node:path').resolve(__dirname,'../server/combat-m8.cjs'),'utf8');
 assert.match(src,/GUARDS[.]tick\(world,minute,events,dead\)/);
 assert.doesNotMatch(src,/for\(const guard of guards\)if\(guard\.alive/);
});
