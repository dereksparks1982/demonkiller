'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const W=require('../server/world.cjs'),G=require('../server/gameplay.cjs');
const R=require('../server/regions.cjs');
const E=require('../server/entity-registry-m10.cjs');
const V=require('../server/vendors-m18.cjs');
const TRADE=require('../server/npc-commerce-m19.cjs');
const BUSINESS=require('../server/player-business-m48.cjs');
const {deleteCharacter}=require('../server/character-lifecycle-m26.cjs');
const NOW=Date.UTC(2026,10,7,21);
function start(){
 let w=W.createCharacter(W.makeWorld(NOW),1,'ELIAS',NOW).world;
 const p=w.characters['1'],shop=w.living.businesses.village_bakery;
 const at=V.location(w,shop);
 p.form='living';p.opening_state='resurrected';p.gold=500;
 p.area_id=shop.area_id;p.x=at.x;p.y=at.y;
 p.region_id=require('../server/region-policies-m16.cjs')
  .regionAt(w,p.area_id,p.x,p.y).id;
 w=G.apply(w,{action:'buy_business',business_id:shop.id}).world;
 const npc=w.living.npcs.guard_north;
 npc.area_id=shop.area_id;npc.x=at.x;npc.y=at.y;npc.coins=20;
 w.living.businesses[shop.id].open=true;w.living.minute=5;
 w.living.npc_trade.goals[npc.id]={npc_id:npc.id,shop_id:shop.id,
  assigned_minute:5,expires_minute:305};
 E.reconcile(w);
 return {w,id:npc.id,shop_id:shop.id,at};
}
test('M51 migrates M50 trade ledgers before use without discarding any prior purchases',()=>{
 const w=start(),old=w.w.living.npc_trade;
 old.purchases=4;delete old.pending_sales;
 assert.doesNotThrow(()=>TRADE.validate(w.w));
 assert.equal(TRADE.ensure(w.w),true);
 assert.deepEqual(old.pending_sales,{});
 assert.equal(old.purchases,4);
 assert.equal(TRADE.ensure(w.w),false);
 W.validateWorld(w.w);
});
test('Owner-operated storefronts wait for a human sale; no auto transfer or free coins',()=>{
 const {w,id,shop_id}=start(),shop=w.living.businesses[shop_id];
 const buyer=w.living.npcs[id];
 const stock=shop.stock,buyerCoins=buyer.coins,treasury=shop.coins,events=[];
 TRADE.purchase(w,5,events);
 assert.equal(shop.stock,stock);assert.equal(buyer.coins,buyerCoins);
 assert.equal(shop.coins,treasury);
 const waiting=w.living.npc_trade.pending_sales[id];
 assert.equal(waiting.npc_id,id);
 assert.equal(waiting.expires_minute,35);
 assert.equal(w.living.npc_trade.goals[id].shop_id,shop_id);
 assert.equal(TRADE.listing(w).waiting_customers.length,1);
 assert(events.some(e=>e.type==='npc.trade.waiting'));
 assert(!events.some(e=>e.type==='business.trade'));
 W.validateWorld(w);
});
test('Serving transfers the correct serial and money exactly once, and records owner credit',()=>{
 const {w,id,shop_id}=start();
 TRADE.purchase(w,5,[]);
 const oldStock=w.living.businesses[shop_id].stock;
 const gold=w.living.npcs[id].coins;
 const paid=w.living.businesses[shop_id].coins;
 const r=G.apply(w,{action:'serve_customer',business_id:shop_id,npc_id:id});
 const next=r.world,trade=r.event;
 assert.equal(trade.type,'business.trade');
 assert.equal(trade.served_by,'player');
 assert.equal(next.living.npcs[id].coins,gold-2);
 assert.equal(next.living.businesses[shop_id].coins,paid+2);
 assert.equal(next.living.businesses[shop_id].stock,oldStock-1);
 assert.equal(next.living.npc_trade.pending_sales[id],undefined);
 assert.equal(next.living.npc_trade.goals[id],undefined);
 assert.equal(next.living.player_business.shops[shop_id].owner_sales,1);
 const item=next.entity_registry.items[trade.item_serial];
 assert(item);assert.equal(item.type,'bread');assert.equal(item.amount,1);
 assert.equal(item.parent,'npc_pack_'+id);
 assert.throws(()=>G.apply(next,{action:'serve_customer',business_id:shop_id,npc_id:id}),
  /not waiting/);
 assert.equal(w.living.npcs[id].coins,gold,'A failed replay may not affect the old world');
 E.counts(next);W.validateWorld(next);
});
test('Assistant checks out a queued NPC if the player walks away',()=>{
 const {w,id,shop_id}=start();
 TRADE.purchase(w,5,[]);
 w.characters['1'].x=20;w.characters['1'].y=20;
 w.characters['1'].region_id=require('../server/region-policies-m16.cjs')
  .regionAt(w,R.VILLAGE,20,20).id;
 const seller=w.living.npcs.baker,at=V.location(w,w.living.businesses[shop_id]);
 seller.x=at.x;seller.y=at.y;seller.area_id=R.VILLAGE;
 w.living.minute=10;
 const events=[];TRADE.purchase(w,10,events);
 assert.equal(w.living.npc_trade.pending_sales[id],undefined);
 assert.equal(w.living.npc_trade.goals[id],undefined);
 assert.equal(w.living.player_business.shops[shop_id].assistant_sales,1);
 assert(events.some(e=>e.type==='business.trade'&&e.served_by==='assistant'));
 E.counts(w);W.validateWorld(w);
});
test('Ignored customers leave after 30 world minutes rather than being sold goods automatically',()=>{
 const {w,id,shop_id}=start();
 TRADE.purchase(w,5,[]);
 const stock=w.living.businesses[shop_id].stock;
 const gold=w.living.npcs[id].coins;
 w.living.minute=35;const events=[];
 TRADE.purchase(w,35,events);
 assert.equal(w.living.npc_trade.pending_sales[id],undefined);
 assert.equal(w.living.npc_trade.goals[id],undefined);
 assert.equal(w.living.businesses[shop_id].stock,stock);
 assert.equal(w.living.npcs[id].coins,gold);
 assert(events.some(e=>e.type==='npc.trade.abandoned'));
 W.validateWorld(w);
});
test('Characters cannot forge customer service requests or inherit a retired owners pending buyers',()=>{
 const {w,id,shop_id}=start();
 TRADE.purchase(w,5,[]);
 assert.throws(()=>G.apply(w,{action:'serve_customer',business_id:shop_id,
  npc_id:id,price:999}),/Invalid/);
 const retired=deleteCharacter(w,1,'ELIAS').world;
 assert.equal(retired.characters['1'],undefined);
 assert.equal(Object.keys(retired.living.player_business.shops).length,0);
 assert.equal(Object.keys(retired.living.npc_trade.pending_sales).length,0);
 assert.equal(retired.living.npc_trade.goals[id].shop_id,shop_id);
 E.counts(retired);W.validateWorld(retired);
});
