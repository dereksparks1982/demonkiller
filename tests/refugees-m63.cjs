'use strict';
// M63: refuge journeys are saved, cardinal, timed and never teleports.
const test=require('node:test'),assert=require('node:assert/strict');
const W=require('../server/world.cjs'),R=require('../server/regions.cjs');
const REF=require('../server/refugees-m63.cjs');
const DISTRICTS=require('../server/region-policies-m16.cjs');
const origin=Date.UTC(2026,10,8);
const fresh=()=>W.makeWorld(origin);
function tick(w,minute,events=[]){w.living.minute=minute;REF.plan(w,minute,events);return events;}
function occupant(w,id){return w.living.refugees.records[id];}
test('M63 old worlds migrate civilian refuge state without losing players, money or NPC positions',()=>{
 const w=fresh(),coin=w.living.businesses.village_bakery.coins,
  location={...w.living.npcs.baker};
 assert(occupant(w,'baker'));
 assert.equal(occupant(w,'guard_north'),undefined,'Fighters defend rather than evacuate');
 delete w.living.refugees;
 assert.equal(W.validateWorld(w),w);
 assert.equal(REF.ensure(w),true);
 assert.equal(REF.ensure(w),false);
 assert.deepEqual(w.living.npcs.baker,location);
 assert.equal(w.living.businesses.village_bakery.coins,coin);
 assert.equal(W.validateWorld(w),w);
});
test('M63 overrun village citizens plan refuge via a real map portal, not teleportation',()=>{
 const w=fresh(),events=[],n=w.living.npcs.baker;
 w.living.territories[R.VILLAGE].control='monsters';
 const before={area_id:n.area_id,x:n.x,y:n.y};
 tick(w,5,events);
 const r=occupant(w,'baker'),d=REF.destination(w,n);
 assert.equal(r.status,'evacuating');
 assert.equal(d.area_id,R.COURT);
 assert.deepEqual({area_id:n.area_id,x:n.x,y:n.y},before,
  'Planning a refuge never moves an NPC by itself');
 assert(R.traversable(w.areas[d.area_id],d.x,d.y,'living'));
 assert(events.some(e=>e.type==='refugee.departed'&&e.npc_id==='baker'));
 assert.equal(W.validateWorld(w),w);
});
test('M63 refugee camps allocate distinct legal tiles for all fleeing residents',()=>{
 const w=fresh();w.living.territories[R.VILLAGE].control='monsters';
 tick(w,5);
 const camps=Object.values(w.living.refugees.records).filter(r=>
  r.status==='evacuating'&&r.shelter_area_id===R.COURT);
 assert(camps.length>2,'Several survivors flee from the occupied village');
 const keys=camps.map(r=>r.shelter_x+','+r.shelter_y);
 assert.equal(new Set(keys).size,keys.length);
 for(const r of camps)
  assert(R.traversable(w.areas[R.COURT],r.shelter_x,r.shelter_y,'living'));
 assert.equal(REF.validate(w),true);
});
test('M63 arrival is tracked once and survivors return only after 90 safe minutes',()=>{
 const w=fresh(),events=[],n=w.living.npcs.baker;
 w.living.territories[R.VILLAGE].control='monsters';
 tick(w,5,events);
 const dest=REF.destination(w,n);
 n.area_id=dest.area_id;n.x=dest.x;n.y=dest.y;
 DISTRICTS.syncNpcTransitions(w,10,events);
 tick(w,10,events);
 assert.equal(occupant(w,'baker').status,'sheltered');
 const start=JSON.stringify(occupant(w,'baker'));
 REF.plan(w,10,events);
 assert.equal(JSON.stringify(occupant(w,'baker')),start);
 w.living.territories[R.VILLAGE].control='settlers';
 tick(w,15,events);
 tick(w,100,events);
 assert.equal(occupant(w,'baker').status,'sheltered','Danger just passed; return waits');
 tick(w,105,events);
 assert.equal(occupant(w,'baker').status,'returning');
 const goal=REF.destination(w,n);
 assert.equal(goal.area_id,R.VILLAGE);
 assert.equal(goal.x,n.home_x);
 n.area_id=goal.area_id;n.x=goal.x;n.y=goal.y;
 DISTRICTS.syncNpcTransitions(w,110,events);
 tick(w,110,events);
 assert.equal(occupant(w,'baker').status,'home');
 assert.equal(w.living.refugees.total_homecomings,1);
 assert(events.some(e=>e.type==='refugee.home'&&e.npc_id==='baker'));
 assert.equal(W.validateWorld(w),w);
});
test('M63 two fallen regions strand residents rather than teleport them to a fake safe area',()=>{
 const w=fresh(),n=w.living.npcs.baker,events=[];
 w.living.territories[R.VILLAGE].control='monsters';
 w.living.territories[R.COURT].control='monsters';
 tick(w,5,events);
 const r=occupant(w,'baker');
 assert.equal(r.status,'stranded');
 assert.equal(r.shelter_area_id,null);
 assert.deepEqual(REF.destination(w,n),{area_id:n.area_id,x:n.x,y:n.y});
 assert.equal(w.living.refugees.total_evacuations,0);
 assert.equal(W.validateWorld(w),w);
});
test('M63 a refugee killed on the road stays dead and is counted once',()=>{
 const w=fresh(),events=[],n=w.living.npcs.baker;
 w.living.territories[R.VILLAGE].control='monsters';
 tick(w,5,events);
 n.alive=false;tick(w,10,events);
 assert.equal(occupant(w,'baker').status,'lost');
 assert.equal(w.living.refugees.total_lost,1);
 tick(w,15,events);
 assert.equal(w.living.refugees.total_lost,1);
 assert.equal(REF.destination(w,n),null);
 assert.equal(REF.validate(w),true);
});
test('M63 a replaced resident gets a fresh refuge record; save corruption is not silently reset',()=>{
 const w=fresh(),old=w.living.npcs.baker;
 w.living.npcs.resident_91={...old,id:'resident_91',name:'New Miller',
  x:old.x,y:old.y,alive:true};
 assert.equal(REF.ensure(w),true);
 assert.equal(REF.ensure(w),false);
 assert(occupant(w,'resident_91'));
 assert.equal(REF.validate(w),true);
 occupant(w,'resident_91').status='teleported';
 assert.throws(()=>REF.validate(w),/Invalid saved refugee record/);
});
test('M63 world scheduler integrates evacuation before NPC movement and exposes read-only records',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const server=fs.readFileSync(path.join(__dirname,'../server/dk-server.cjs'),'utf8');
 const living=fs.readFileSync(path.join(__dirname,'../server/living-world.cjs'),'utf8');
 assert.match(server,/\/api\/v1\/refugees/);
 assert.match(server,/REFUGEES[.]listing\(world/);
 assert.match(living,/REFUGEES[.]plan\(world,m,generated\)/);
 assert.match(living,/REFUGEES[.]destination\(world,n\)/);
 assert(!fs.readFileSync(path.join(__dirname,'../outdoor.html'),'utf8')
  .includes('id="refugeeButton"'));
});
