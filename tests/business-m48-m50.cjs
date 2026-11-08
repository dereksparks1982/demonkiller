'use strict';
// Regression for M48–M50. GitHub Actions stays manual-only; Node can run locally.
const test=require('node:test'),assert=require('node:assert/strict');
const W=require('../server/world.cjs'),G=require('../server/gameplay.cjs');
const R=require('../server/regions.cjs'),E=require('../server/entity-registry-m10.cjs');
const BUSINESS=require('../server/player-business-m48.cjs');
const COMMERCE=require('../server/npc-commerce-m19.cjs');
const WORKSHOPS=require('../server/workshops-m20.cjs');
const MAINTENANCE=require('../server/business-maintenance-m50.cjs');
const LIFECYCLE=require('../server/character-lifecycle-m26.cjs');
const START=Date.UTC(2026,10,7,21);
function setup(){
 let w=W.createCharacter(W.makeWorld(START),1,'ELIAS',START).world;
 const c=w.characters['1'];
 c.form='living';c.opening_state='resurrected';c.gold=700;
 const b=w.living.businesses.village_bakery,at=require('../server/vendors-m18.cjs').location(w,b);
 c.area_id=R.VILLAGE;c.x=at.x;c.y=at.y;
 c.region_id=require('../server/region-policies-m16.cjs').regionAt(w,c.area_id,c.x,c.y).id;
 E.reconcile(w);return w;
}
function buy(w,id='village_bakery'){
 const b=w.living.businesses[id],at=require('../server/vendors-m18.cjs').location(w,b);
 const c=w.characters['1'];c.area_id=b.area_id;c.x=at.x;c.y=at.y;
 c.region_id=require('../server/region-policies-m16.cjs').regionAt(w,c.area_id,c.x,c.y).id;
 return G.apply(w,{action:'buy_business',business_id:id}).world;
}
test('M48 owner buys a physical shop from an NPC with conserved coins and a real assistant',()=>{
 const old=setup(),seller=old.living.npcs.baker;
 const coins=seller.coins,shopGold=old.living.businesses.village_bakery.coins;
 const playerGold=old.characters['1'].gold;
 const w=buy(old),owned=w.living.player_business.shops.village_bakery;
 assert(owned);assert.equal(owned.assistant_enabled,true);
 assert.equal(w.characters['1'].gold,playerGold-BUSINESS.COSTS.village_bakery);
 assert.equal(w.living.npcs.baker.coins,coins+BUSINESS.COSTS.village_bakery);
 assert.equal(w.living.businesses.village_bakery.coins,shopGold);
 assert.equal(w.living.businesses.village_bakery.owner_id,'baker');
 assert.equal(BUSINESS.presence(w,w.living.businesses.village_bakery),'player');
 assert.throws(()=>G.apply(w,{action:'buy_business',business_id:'village_bakery'}),/already owned/);
 assert.throws(()=>G.apply(w,{action:'draw_business',business_id:'village_bakery',amount:9999}),/amount/);
 W.validateWorld(w);E.counts(w);
});
test('M48 real NPC buyer pays selected prices and owner/assistant service reflects presence',()=>{
 let w=buy(setup()),shop=w.living.businesses.village_bakery;
 w=G.apply(w,{action:'set_business_price',business_id:shop.id,price_mode:'premium'}).world;
 const b=w.living.businesses.village_bakery,at=require('../server/vendors-m18.cjs').location(w,b);
 b.open=true;w.living.minute=5;
 const seller=w.living.npcs.baker;seller.x=at.x;seller.y=at.y;seller.area_id=b.area_id;
 for(const [id,when,playerServes] of [['guard_north',10,true],['guard_south',20,false]]){
  const buyer=w.living.npcs[id],price=3;
  buyer.area_id=b.area_id;buyer.x=at.x;buyer.y=at.y;buyer.coins=20;
  w.living.minute=when;
  w.living.npc_trade.goals[id]={npc_id:id,shop_id:b.id,assigned_minute:when,
   expires_minute:when+300};
  if(!playerServes){w.characters['1'].x=20;w.characters['1'].y=20;}
  const beforeBuyer=buyer.coins,beforeShop=b.coins,events=[];
  COMMERCE.purchase(w,when,events);
  assert.equal(buyer.coins,beforeBuyer-price);
  assert.equal(b.coins,beforeShop+price);
  assert(events.some(e=>e.type==='business.trade'&&e.served_by===(playerServes?'player':'assistant')));
  assert(events.some(e=>e.type==='business.player.sale'));
 }
 assert.equal(w.living.player_business.shops.village_bakery.owner_sales,1);
 assert.equal(w.living.player_business.shops.village_bakery.assistant_sales,1);
 W.validateWorld(w);E.counts(w);
});
test('M48 physical inventory, separate treasuries, and no free goods or gold',()=>{
 let w=buy(setup()),c=w.characters['1'],shop=w.living.businesses.village_bakery;
 c.inventory.flour=4;E.reconcile(w);
 w=G.apply(w,{action:'stock_business',business_id:shop.id,item_type:'flour',quantity:3}).world;
 assert.equal(w.characters['1'].inventory.flour,1);
 assert.equal(w.living.businesses.village_bakery.other_stock.flour,3);
 const paid=w.characters['1'].gold,shopCoins=w.living.businesses.village_bakery.coins;
 w=G.apply(w,{action:'invest_business',business_id:shop.id,amount:10}).world;
 assert.equal(w.characters['1'].gold,paid-10);
 assert.equal(w.living.businesses.village_bakery.coins,shopCoins+10);
 w=G.apply(w,{action:'draw_business',business_id:shop.id,amount:10}).world;
 assert.equal(w.characters['1'].gold,paid);
 w=G.apply(w,{action:'take_business_stock',business_id:shop.id,item_type:'flour',quantity:2}).world;
 assert.equal(w.characters['1'].inventory.flour,3);
 assert.equal(w.living.businesses.village_bakery.other_stock.flour,1);
 E.counts(w);W.validateWorld(w);
});
test('M49 manually produces bakery goods, trains cooking, and obeys station/work-minute rules',()=>{
 let w=buy(setup()),shop=w.living.businesses.village_bakery;
 shop.other_stock.flour=4;E.reconcile(w);
 const n=shop.stock,before=w.characters['1'].skillbook.skills.cooking.value;
 w=G.apply(w,{action:'run_workshop',business_id:shop.id}).world;
 assert.equal(w.living.businesses.village_bakery.stock,n+2);
 assert.equal(w.living.businesses.village_bakery.other_stock.flour,2);
 assert(w.characters['1'].skillbook.skills.cooking.value>before);
 assert.equal(w.living.workshops.shops.village_bakery.player_runs,1);
 assert.throws(()=>G.apply(w,{action:'run_workshop',business_id:shop.id}),/another world minute/);
 assert.equal(w.living.maintenance.shops.village_bakery.wear,16);
 E.counts(w);W.validateWorld(w);
});
test('M50 seven real production batches break machinery; one spare tool repairs it',()=>{
 let w=buy(setup()),shop=w.living.businesses.village_bakery;
 shop.other_stock.flour=14;E.reconcile(w);
 for(let minute=0;minute<7;minute++){
  w.living.minute=minute;
  w=G.apply(w,{action:'run_workshop',business_id:shop.id}).world;
 }
 assert.equal(w.living.maintenance.shops.village_bakery.wear,100);
 assert.equal(w.living.maintenance.shops.village_bakery.broken,true);
 w.living.minute=8;
 assert.throws(()=>G.apply(w,{action:'run_workshop',business_id:shop.id}),/broken/);
 w.characters['1'].inventory.tools=1;E.reconcile(w);
 w=G.apply(w,{action:'repair_workshop',business_id:shop.id}).world;
 assert.equal(w.characters['1'].inventory.tools,0);
 assert.equal(w.living.maintenance.shops.village_bakery.broken,false);
 assert.equal(w.living.maintenance.shops.village_bakery.repairs,1);
 assert.equal(w.living.maintenance.shops.village_bakery.wear,0);
 E.counts(w);W.validateWorld(w);
});
test('M50 hiring repairer reserves money and pays actual worker after 60 world minutes',()=>{
 let w=buy(setup()),shop=w.living.businesses.village_bakery;
 const m=w.living.maintenance.shops.village_bakery;
 m.wear=100;m.broken=true;m.failed_minute=3;m.breakdowns++;
 w.living.minute=5;
 const treasury=shop.coins,worker=w.living.npcs.baker,before=worker.coins;
 w=G.apply(w,{action:'hire_repair',business_id:shop.id}).world;
 assert.equal(w.living.businesses.village_bakery.coins,treasury-20);
 assert.equal(w.living.maintenance.shops.village_bakery.pending.due,65);
 const events=[];
 MAINTENANCE.tick(w,60,events);
 assert.equal(w.living.maintenance.shops.village_bakery.broken,true);
 MAINTENANCE.tick(w,65,events);
 assert.equal(w.living.maintenance.shops.village_bakery.broken,false);
 assert.equal(w.living.npcs.baker.coins,before+20);
 assert(events.some(e=>e.type==='workshop.repaired'));
 w.living.minute=65;W.validateWorld(w);E.counts(w);
});
test('M48 retiring a character preserves world stock, NPC wages and marketplace history',()=>{
 let w=buy(setup()),b=w.living.businesses.village_bakery;
 const coins=b.coins,serials=Object.keys(w.entity_registry.items).length;
 const retired=LIFECYCLE.deleteCharacter(w,1,'ELIAS').world;
 assert.equal(retired.characters['1'],undefined);
 assert.equal(Object.keys(retired.living.player_business.shops).length,0);
 assert.equal(retired.living.businesses.village_bakery.coins,coins);
 assert(retired.living.npcs.baker.alive);
 assert(Object.keys(retired.entity_registry.items).length>=serials-20);
 assert(retired.living.player_business.transactions.some(e=>e.action==='acquired'));
 W.validateWorld(retired);E.counts(retired);
});
test('M50 unowned shops can hire their own living workers to repair damaged equipment',()=>{
 const w=setup(),shop=w.living.businesses.village_bakery,m=w.living.maintenance.shops.village_bakery;
 m.wear=100;m.broken=true;m.failed_minute=0;m.breakdowns++;
 const baker=w.living.npcs.baker,p=require('../server/vendors-m18.cjs').location(w,shop);
 baker.area_id=shop.area_id;baker.x=p.x;baker.y=p.y;
 const saved=shop.coins,workerCoins=baker.coins;
 const events=[];MAINTENANCE.tick(w,120,events);
 assert.equal(m.broken,false);
 assert.equal(shop.coins,saved-20);
 assert.equal(baker.coins,workerCoins+20);
 assert(events.some(e=>e.type==='workshop.repaired'));
 W.validateWorld(w);
});
