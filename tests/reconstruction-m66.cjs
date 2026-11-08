'use strict';
// M66 physical reconstruction: persisted damage, serialized materials,
// real workers, paid labor, strict recovery, repeated tick safety.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const W=require('../server/world.cjs');
const R=require('../server/regions.cjs');
const REBUILD=require('../server/reconstruction-m66.cjs');
const CAMP=require('../server/settlement-campaigns-m65.cjs');
const ENTITIES=require('../server/entity-registry-m10.cjs');
const VENDORS=require('../server/vendors-m18.cjs');
const BUSINESS=require('../server/player-business-m48.cjs');
const CLOCK=Date.UTC(2026,10,8);
const fresh=()=>W.makeWorld(CLOCK);
function prep(w,targetId='village_bakery'){
 const source=w.living.businesses.village_smithy;
 const target=w.living.businesses[targetId],worker=w.living.npcs[source.owner_id];
 const at=VENDORS.location(w,source);
 worker.area_id=source.area_id;worker.x=at.x;worker.y=at.y;
 source.open=true;source.stock=Math.max(source.stock,6);
 source.other_stock.wood=2;
 target.coins=100;
 w.living.reconstruction.sites[targetId].damage=25;
 ENTITIES.reconcile(w);ENTITIES.counts(w);
 return {source,target,worker};
}
const move=(w,n,shop)=>{const p=VENDORS.location(w,shop);n.area_id=shop.area_id;n.x=p.x;n.y=p.y;};
const tick=(w,min,events)=>{w.living.minute=min;return REBUILD.tick(w,min,events);};
test('M66 untouched regions are operational; old worlds migrate without rewriting stocks',()=>{
 const w=fresh(),stock=w.living.businesses.village_smithy.stock;
 assert.equal(REBUILD.ensure(w),false);
 assert.equal(REBUILD.regionComplete(w,R.VILLAGE),true);
 assert(REBUILD.operational(w,w.living.businesses.village_bakery));
 delete w.living.reconstruction;
 assert.equal(W.validateWorld(w),w,'M65 save must remain readable');
 assert.equal(REBUILD.ensure(w),true);
 assert.equal(REBUILD.ensure(w),false);
 assert.equal(w.living.businesses.village_smithy.stock,stock);
 assert.equal(W.validateWorld(w),w);
});
test('M66 territory fall creates durable physical damage and closes affected stores',()=>{
 const w=fresh(),events=[];
 w.living.minute=5;
 w.living.territories[R.VILLAGE].control='monsters';
 CAMP.tick(w,5,events);
 const damaged=REBUILD.listing(w).sites.filter(s=>s.damage>0&&s.area_id===R.VILLAGE);
 assert.equal(damaged.length,2);
 assert.equal(w.living.settlement_campaigns.regions[R.VILLAGE].phase,'occupied');
 assert(damaged.every(r=>w.living.businesses[r.id].open===false));
 assert(events.some(e=>e.type==='reconstruction.damaged'));
 assert.equal(REBUILD.regionComplete(w,R.VILLAGE),false);
 const snapshot=JSON.stringify(w.living.reconstruction);
 CAMP.tick(w,5,events);
 assert.equal(JSON.stringify(w.living.reconstruction),snapshot,'Replay cannot damage shops twice');
 assert.equal(W.validateWorld(w),w);
});
test('M66 real wood/tool serials leave smithy in a worker backpack and fund the vendor',()=>{
 const w=fresh(),{source,target,worker}=prep(w),events=[];
 const before=target.coins,smithGold=source.coins;
 tick(w,5,events);assert.equal(w.living.reconstruction.jobs[R.VILLAGE].phase,'to_supply');
 tick(w,10,events);
 const j=w.living.reconstruction.jobs[R.VILLAGE];
 assert.equal(j.phase,'to_site');assert(j.cargo.length>=2);
 assert.equal(j.cargo.reduce((n,i)=>n+i.amount,0),3);
 assert(j.cargo.every(i=>w.entity_registry.items[i.serial]?.parent==='npc_pack_'+worker.id));
 assert.equal(source.other_stock.wood,0);assert.equal(source.stock>=5,true);
 assert.equal(target.coins,before-16);assert.equal(source.coins,smithGold+16);
 assert.equal(ENTITIES.counts(w),true);
 assert.equal(REBUILD.validate(w),true);
 assert(events.some(e=>e.type==='reconstruction.loaded'));
});
test('M66 a genuine carpenter journey and 30-minute labor step repair the damaged building',()=>{
 const w=fresh(),{target,worker}=prep(w),events=[];
 tick(w,5,events);tick(w,10,events);
 move(w,worker,target);
 tick(w,15,events);
 assert.equal(w.living.reconstruction.jobs[R.VILLAGE].phase,'working');
 tick(w,40,events);
 assert.equal(w.living.reconstruction.sites[target.id].damage,25,'No instant repairs');
 const initialMoney=worker.coins;
 tick(w,45,events);
 assert.equal(w.living.reconstruction.sites[target.id].damage,0);
 assert.equal(w.living.reconstruction.jobs[R.VILLAGE],null);
 assert.equal(worker.coins,initialMoney+6);
 assert.equal(w.living.reconstruction.total_repaired,25);
 assert.equal(w.living.reconstruction.total_spent,22);
 assert.equal(ENTITIES.counts(w),true);
 assert(events.some(e=>e.type==='reconstruction.completed'));
 assert.equal(REBUILD.validate(w),true);
 assert.equal(W.validateWorld(w),w);
});
test('M66 shortages, closed suppliers and empty treasuries cannot yield free progress',()=>{
 const w=fresh(),{source,target,worker}=prep(w),events=[];
 source.other_stock.wood=0;ENTITIES.reconcile(w);
 tick(w,5,events);tick(w,10,events);
 assert.equal(w.living.reconstruction.jobs[R.VILLAGE].phase,'to_supply');
 assert.equal(target.coins,100);
 assert.equal(w.living.reconstruction.total_repaired,0);
 source.other_stock.wood=2;ENTITIES.reconcile(w);
 source.open=false;tick(w,15,events);
 assert.equal(w.living.reconstruction.jobs[R.VILLAGE].phase,'to_supply');
 source.open=true;target.coins=0;tick(w,20,events);
 assert.equal(w.living.reconstruction.jobs[R.VILLAGE].phase,'to_supply');
 assert.equal(REBUILD.validate(w),true);
});
test('M66 a dead construction worker loses custody without duplicating paid materials',()=>{
 const w=fresh(),{worker}=prep(w),events=[];
 tick(w,5,events);tick(w,10,events);
 const order=w.living.reconstruction.jobs[R.VILLAGE];
 const serials=order.cargo.map(i=>i.serial);
 worker.alive=false;
 tick(w,15,events);
 assert.equal(w.living.reconstruction.jobs[R.VILLAGE],null);
 assert(events.some(e=>e.type==='reconstruction.worker_lost'));
 for(const serial of serials)assert(w.entity_registry.items[serial],
  'Paid freight remains physically recorded in the dead worker pack');
 assert.equal(w.living.reconstruction.total_repaired,0);
 assert.equal(ENTITIES.counts(w),true);
 assert.equal(REBUILD.validate(w),true);
});
test('M66 occupation suspends building work without consuming worker freight',()=>{
 const w=fresh(),{target,worker}=prep(w),events=[];
 tick(w,5,events);tick(w,10,events);
 const serials=w.living.reconstruction.jobs[R.VILLAGE].cargo.map(i=>i.serial);
 w.living.territories[R.VILLAGE].control='monsters';
 move(w,worker,target);tick(w,15,events);tick(w,45,events);
 assert.equal(w.living.reconstruction.sites[target.id].damage,25);
 for(const serial of serials)assert(w.entity_registry.items[serial]);
 assert.equal(REBUILD.validate(w),true);
});
test('M66 player business manager disabled means no unauthorized automated repairs',()=>{
 const w=fresh(),{source,target}=prep(w),events=[];
 BUSINESS.ensure(w);
 w.living.player_business.shops[target.id]={id:target.id,owner_slot:1,
  acquired_minute:0,acquisition_cost:BUSINESS.COSTS[target.id],
  price_mode:'standard',assistant_enabled:false,production_enabled:true,
  owner_sales:0,assistant_sales:0,drawn:0,invested:0};
 tick(w,5,events);
 assert.equal(w.living.reconstruction.jobs[R.VILLAGE],null);
 w.living.player_business.shops[target.id].assistant_enabled=true;
 tick(w,10,events);
 assert.equal(w.living.reconstruction.jobs[R.VILLAGE].phase,'to_supply');
});
test('M66 a player-owned supplier must authorize assistant service and uses actual prices',()=>{
 const w=fresh(),{source,target}=prep(w),events=[];
 BUSINESS.ensure(w);
 w.living.player_business.shops[source.id]={id:source.id,owner_slot:1,
  acquired_minute:0,acquisition_cost:BUSINESS.COSTS[source.id],
  price_mode:'premium',assistant_enabled:false,production_enabled:true,
  owner_sales:0,assistant_sales:0,drawn:0,invested:0};
 tick(w,5,events);tick(w,10,events);
 assert.equal(w.living.reconstruction.jobs[R.VILLAGE].phase,'to_supply');
 assert.equal(target.coins,100);
 w.living.player_business.shops[source.id].assistant_enabled=true;
 tick(w,15,events);
 assert.equal(w.living.reconstruction.jobs[R.VILLAGE].phase,'to_site');
 assert.equal(target.coins,76,'Premium supplier charges 24 rather than 16');
 assert.equal(w.living.player_business.shops[source.id].assistant_sales,1);
 assert.equal(ENTITIES.counts(w),true);
});
test('M66 neither NPC nor manual production can bypass ruined workshop or mill walls',()=>{
 const work=fs.readFileSync(path.join(__dirname,'../server/workshops-m20.cjs'),'utf8');
 const mill=fs.readFileSync(path.join(__dirname,'../server/milling-m47.cjs'),'utf8');
 const living=fs.readFileSync(path.join(__dirname,'../server/living-world.cjs'),'utf8');
 assert.match(work,/!REBUILD[.]operational\(world,shop\)/);
 assert.match(work,/!REBUILD[.]operational\(world,previousShop\)/);
 assert.match(mill,/!REBUILD[.]operational\(world,shop\)/);
 assert.match(mill,/!REBUILD[.]operational\(world,world[.]living[.]businesses\[BUSINESS\]\)/);
 assert.match(living,/REBUILD[.]operational\(world,shop\)/);
});
test('M66 a real NPC harvester can finish fetching wood before construction takes priority',()=>{
 const w=fresh(),{worker}=prep(w);
 tick(w,5,[]);
 const j=w.living.reconstruction.jobs[R.VILLAGE];
 assert.equal(j.phase,'to_supply');
 w.living.npc_harvest.goals[worker.id]={npc_id:worker.id};
 assert.equal(REBUILD.destination(w,worker),null,
  'Harvester is not pinned at supplier before delivering wood');
 assert.equal(tick(w,10,[]),0,'A harvest job prevents premature materials checkout');
 delete w.living.npc_harvest.goals[worker.id];
 assert(REBUILD.destination(w,worker));
 assert.equal(tick(w,15,[]),1);
});
test('M66 a liberated city cannot claim recovery with unrepaired buildings',()=>{
 const w=fresh(),id=R.VILLAGE,out=[];
 w.living.territories[id].control='monsters';w.living.minute=5;CAMP.tick(w,5,out);
 w.living.territories[id].control='settlers';w.living.minute=10;CAMP.tick(w,10,out);
 const campaign=w.living.settlement_campaigns.regions[id];
 assert.equal(campaign.phase,'rebuilding');
 w.living.minute=120;
 for(const [nid,rec] of Object.entries(w.living.refugees.records))
  if(w.living.npcs[nid]?.home_area===id&&w.living.npcs[nid].alive)
   rec.status='home';
 w.living.businesses.village_bank.open=true;
 CAMP.tick(w,120,out);
 assert.equal(campaign.phase,'rebuilding');
 assert(!REBUILD.regionComplete(w,id));
 for(const s of Object.values(w.living.reconstruction.sites))if(s.area_id===id)s.damage=0;
 w.living.minute=125;CAMP.tick(w,125,out);
 assert.equal(campaign.phase,'peace');
 assert.equal(campaign.recoveries,1);
});
test('M66 corrupted site, missing work order, and double-replay are rejected or ignored',()=>{
 const w=fresh(),{target}=prep(w),events=[];
 tick(w,5,events);tick(w,10,events);
 const ledger=JSON.stringify(w.living.reconstruction);
 tick(w,10,events);
 assert.equal(JSON.stringify(w.living.reconstruction),ledger);
 w.living.reconstruction.sites[target.id].damage=101;
 assert.throws(()=>REBUILD.validate(w),/Invalid reconstruction site/);
});
test('M66 exposes a read-only status without adding browser game toolbar controls',()=>{
 const s=fs.readFileSync(path.join(__dirname,'../server/dk-server.cjs'),'utf8');
 const l=fs.readFileSync(path.join(__dirname,'../server/living-world.cjs'),'utf8');
 const c=fs.readFileSync(path.join(__dirname,'../server/settlement-campaigns-m65.cjs'),'utf8');
 assert.match(s,/\/api\/v1\/reconstruction/);
 assert.match(s,/REBUILD[.]listing\(world\)/);
 assert.match(l,/REBUILD[.]destination\(world,n\)/);
 assert.match(l,/REBUILD[.]tick\(world,m,generated\)/);
 assert.match(c,/REBUILD[.]regionComplete\(world,id\)/);
 assert(!fs.readFileSync(path.join(__dirname,'../outdoor.html'),'utf8')
   .includes('id="reconstructionButton"'));
});
