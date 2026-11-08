'use strict';
// M65 cross-system settlement life cycle. Runs actual DK world objects and
// world-minute catch-up, not mocks of the game or browser-only state.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const W=require('../server/world.cjs');
const L=require('../server/living-world.cjs');
const R=require('../server/regions.cjs');
const CAMP=require('../server/settlement-campaigns-m65.cjs');
const REFUGEES=require('../server/refugees-m63.cjs');
const GUARDS=require('../server/guard-watch-m61.cjs');
const GARRISON=require('../server/garrison-m62.cjs');
const TRAFFIC=require('../server/npc-traffic-m64.cjs');
const V=require('../server/vendors-m18.cjs');
const clock=Date.UTC(2026,10,8,0,0,0);
const fresh=()=>W.makeWorld(clock);
const process=(w,m,limit=m)=>L.advance(w,clock+m*L.MINUTE,limit);
test('M65 new campaigns and old saves preserve the world and migrate just once',()=>{
 const w=fresh(),coins=w.living.businesses.village_bank.coins;
 assert.equal(CAMP.ensure(w),false);
 assert.equal(CAMP.listing(w).regions.length,2);
 delete w.living.settlement_campaigns;
 assert.equal(W.validateWorld(w),w);
 assert.equal(CAMP.ensure(w),true);
 assert.equal(CAMP.ensure(w),false);
 assert.equal(w.living.businesses.village_bank.coins,coins);
 assert.equal(W.validateWorld(w),w);
});
test('M65 catch-up advances world minute for every subsystem, with bounded replay',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../server/living-world.cjs'),'utf8');
 assert.match(source,/next[.]living[.]minute=m;\s*minuteTick\(next,m,events\)/);
 assert.doesNotMatch(source,/next[.]living[.]minute\s*\+=\s*count/);
 const w=fresh(),first=process(w,10);
 assert.equal(first.minutes,10);
 assert.equal(first.world.living.minute,10);
 assert.equal(W.validateWorld(first.world),first.world);
 const repeat=process(first.world,10);
 assert.equal(repeat.minutes,0);
 assert.equal(repeat.world,first.world);
});
test('M65 batched and segmented active world ticks reach the same living state',()=>{
 const seed=fresh();
 const all=process(seed,10).world;
 let broken=process(seed,5).world;
 broken=process(broken,10,5).world;
 assert.deepEqual(all.living,broken.living);
 assert.equal(W.validateWorld(all),all);
 assert.equal(W.validateWorld(broken),broken);
});
test('M65 a forced occupation mobilizes refugees, monsters and the campaign ledger',()=>{
 const w=fresh(),territory=w.living.territories[R.VILLAGE];
 territory.control='monsters';territory.threat=15;territory.last_raid=0;
 const batch=process(w,10),next=batch.world;
 assert.equal(batch.minutes,10);
 assert.equal(next.living.settlement_campaigns.regions[R.VILLAGE].phase,'occupied');
 assert.equal(next.living.settlement_campaigns.regions[R.VILLAGE].occupations,1);
 assert(next.living.refugees.total_evacuations>0);
 assert(batch.events.some(e=>e.type==='refugee.departed'));
 assert(batch.events.some(e=>e.type==='settlement.siege_started'));
 assert(batch.events.some(e=>e.type==='monster.spawn'));
 assert.equal(CAMP.listing(next).regions.length,2);
 assert.equal(W.validateWorld(next),next);
});
test('M65 a recovering town must be stable, restaffed and have returned survivors',()=>{
 const w=fresh(),out=[],id=R.VILLAGE,r=w.living.settlement_campaigns.regions[id];
 w.living.territories[id].control='monsters';w.living.minute=5;
 REFUGEES.plan(w,5,out);CAMP.tick(w,5,out);
 assert.equal(r.phase,'occupied');
 w.living.territories[id].control='settlers';
 w.living.minute=10;CAMP.tick(w,10,out);
 assert.equal(r.phase,'rebuilding');
 assert.equal(r.liberations,1);
 w.living.minute=100;CAMP.tick(w,100,out);
 assert.equal(r.phase,'rebuilding','Displaced residents block a fake recovery');
 for(const [nid,record] of Object.entries(w.living.refugees.records)){
  const n=w.living.npcs[nid];if(n.home_area!==id||!n.alive)continue;
  record.status='home';record.shelter_area_id=null;
  record.shelter_x=null;record.shelter_y=null;
 }
 w.living.businesses.village_market.open=true;
 w.living.minute=105;CAMP.tick(w,105,out);
 assert.equal(r.phase,'rebuilding','Damaged buildings also block recovery');
 // This M65 fixture simulates a fully funded/completed M66 repair.
 // M66's own tests verify real goods, wages, work time and travel.
 for(const site of Object.values(w.living.reconstruction.sites))
  if(site.area_id===id)site.damage=0;
 w.living.minute=110;CAMP.tick(w,110,out);
 assert.equal(r.phase,'peace');
 assert.equal(r.recoveries,1);
 assert(out.some(e=>e.type==='settlement.recovered'));
 assert.equal(CAMP.tick(w,105,out),0,'Idempotent campaign journal');
 assert.equal(CAMP.validate(w),true);
});
test('M65 player liberation between ticks remains savable before journal update',()=>{
 const w=fresh(),id=R.COURT;
 w.living.territories[id].control='monsters';w.living.minute=5;
 CAMP.tick(w,5,[]);
 assert.equal(w.living.settlement_campaigns.regions[id].phase,'occupied');
 w.living.territories[id].control='settlers';
 assert.equal(CAMP.validate(w),true,'The campaign must not block immediate combat saves');
 assert.equal(W.validateWorld(w),w);
 w.living.minute=10;const out=[];CAMP.tick(w,10,out);
 assert.equal(w.living.settlement_campaigns.regions[id].phase,'rebuilding');
 assert(out.some(e=>e.type==='settlement.liberated'));
});
test('M65 garrison care cannot purchase from an absent or deceased shopkeeper',()=>{
 const w=fresh(),id=R.VILLAGE,shop=w.living.businesses.village_tavern;
 const guard=w.living.npcs.guard_north,keeper=w.living.npcs[shop.owner_id];
 const door=V.location(w,shop);
 guard.area_id=id;guard.x=door.x;guard.y=door.y;
 guard.health=40;guard.coins=20;shop.open=true;
 assert(GARRISON.available(w,guard,GARRISON.REMEDIES[1]),
  'A staffed shop can sell treatment');
 keeper.area_id=R.COURT;
 assert.equal(GARRISON.available(w,guard,GARRISON.REMEDIES[1]),null,
  'A departed employee cannot sell medical stock');
 keeper.area_id=id;keeper.alive=false;
 assert.equal(GARRISON.available(w,guard,GARRISON.REMEDIES[1]),null);
});
test('M65 occupation stats reflect dead residents, displacement and a shuttered economy',()=>{
 const w=fresh(),id=R.VILLAGE;
 const before=CAMP.population(w,id);
 assert(before.living_residents>0);
 w.living.npcs.baker.alive=false;
 w.living.refugees.records.tavern_keeper.status='evacuating';
 w.living.refugees.records.tavern_keeper.shelter_area_id=R.COURT;
 w.living.refugees.records.tavern_keeper.shelter_x=20;
 w.living.refugees.records.tavern_keeper.shelter_y=32;
 const after=CAMP.population(w,id);
 assert.equal(after.dead,before.dead+1);
 assert.equal(after.displaced,before.displaced+1);
 assert.equal(after.absent,before.absent+1);
});
test('M65 diagnostics are read-only and reuse the main world-state authority',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../server/dk-server.cjs'),'utf8');
 assert.match(src,/\/api\/v1\/settlements\/campaigns/);
 assert.match(src,/CAMPAIGNS[.]listing\(world\)/);
 assert(!src.includes("url.pathname==='/api/v1/settlements/campaigns'&&method==='POST'"));
 assert.equal(CAMP.STABLE_MINUTES,REFUGEES.SAFETY_MINUTES);
});
