'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const W=require('../server/world.cjs'),G=require('../server/gameplay.cjs');
const R=require('../server/regions.cjs'),E=require('../server/entity-registry-m10.cjs');
const V=require('../server/vendors-m18.cjs'),ARMORY=require('../server/armory-m54.cjs');
const ARMORER=require('../server/armorer-m55.cjs');
const {deleteCharacter}=require('../server/character-lifecycle-m26.cjs');
const {syncAll}=require('./helpers/sync-fixture.cjs');
const NOW=Date.UTC(2026,10,7,21);
function scene(){
 let w=W.createCharacter(W.makeWorld(NOW),1,'ELIAS',NOW).world;
 const c=w.characters['1'],shop=w.living.businesses.village_smithy;
 const at=V.location(w,shop),worker=w.living.npcs[shop.owner_id];
 c.form='living';c.opening_state='resurrected';c.gold=500;
 c.area_id=R.VILLAGE;c.x=at.x;c.y=at.y;
 c.inventory.ore=24;c.inventory.wood=24;
 worker.area_id=R.VILLAGE;worker.x=at.x;worker.y=at.y;worker.alive=true;
 shop.open=true;shop.other_stock.ore=3;
 w.living.territories[R.VILLAGE].control='settlers';
 syncAll(w);E.reconcile(w);
 return w;
}
function wornSword(world){
 let w=G.apply(world,{action:'forge_gear',recipe:'short_sword'}).world;
 const item=Object.values(w.entity_registry.items).find(i=>
  i.parent===E.PACK&&i.type==='short_sword');
 assert(item);
 w=G.apply(w,{action:'equip_gear',serial:item.serial}).world;
 ARMORY.wear(w,w.characters['1'],'weapon',40,[]);
 w=G.apply(w,{action:'unequip_gear',slot:'weapon'}).world;
 assert.equal(w.entity_registry.items[item.serial].durability,60);
 return {w,serial:item.serial};
}
function submit(world){
 const {w,serial}=wornSword(world);
 const next=G.apply(w,{action:'submit_repair',serial}).world;
 return {w:next,serial,order:Object.values(next.living.armorer.orders)[0]};
}
test('M55 new worlds contain durable repair custody and support old M54 save migration',()=>{
 const w=scene();
 assert.equal(w.living.armorer.schema,1);
 for(const id of [ARMORER.WORK,ARMORER.PICKUP])
  assert.equal(w.entity_registry.containers[id].kind,'work_order');
 delete w.living.armorer;
 delete w.entity_registry.containers[ARMORER.WORK];
 delete w.entity_registry.containers[ARMORER.PICKUP];
 assert.doesNotThrow(()=>W.validateWorld(w));
 assert.equal(ARMORER.ensure(w),true);
 assert.equal(ARMORER.ensure(w),false);
 E.counts(w);W.validateWorld(w);
});
test('M55 manual repair spends physical ore and tools-equipped labor, retains same serial',()=>{
 let {w,serial}=wornSword(scene());
 w.characters['1'].crafting.hand='tools';
 E.reconcile(w);
 const before=w.characters['1'].inventory.ore;
 const r=G.apply(w,{action:'repair_by_hand',serial});w=r.world;
 assert.equal(w.characters['1'].inventory.ore,before-1);
 assert.equal(w.entity_registry.items[serial].durability,100);
 assert.equal(w.entity_registry.items[serial].parent,E.PACK);
 assert.equal(w.living.armorer.manual_repairs,1);
 assert(w.characters['1'].skillbook.skills.blacksmithing.uses>0);
 assert.throws(()=>G.apply(w,{action:'repair_by_hand',serial}),/Wait|damaged/);
 E.counts(w);W.validateWorld(w);
});
test('M55 dropping off gear saves original serial and charges genuine customer gold',()=>{
 const original=scene(),initialGold=original.characters['1'].gold;
 const oldCoins=original.living.businesses.village_smithy.coins;
 const {w,serial,order}=submit(original);
 assert.equal(w.characters['1'].gold,initialGold-ARMORER.FEE);
 assert.equal(w.living.businesses.village_smithy.coins,oldCoins+ARMORER.FEE);
 assert.equal(w.entity_registry.items[serial].parent,ARMORER.WORK);
 assert.equal(w.characters['1'].inventory.short_sword,0);
 assert.equal(order.status,'working');
 assert.equal(order.due_minute,60);
 E.counts(w);W.validateWorld(w);
});
test('M55 smith waits for real time and materials, earns real wages and preserves sword identity',()=>{
 let {w,serial,order}=submit(scene());
 const shop=w.living.businesses.village_smithy,worker=w.living.npcs[shop.owner_id];
 const oldOre=shop.other_stock.ore,oldWorkerCoins=worker.coins;
 w.living.minute=55;
 ARMORER.tick(w,55,[]);
 assert.equal(order.status,'working');
 w.living.minute=60;
 const events=[];ARMORER.tick(w,60,events);
 assert.equal(order.status,'ready');
 assert.equal(w.entity_registry.items[serial].parent,ARMORER.PICKUP);
 assert.equal(w.entity_registry.items[serial].durability,100);
 assert.equal(shop.other_stock.ore,oldOre-1);
 assert.equal(worker.coins,oldWorkerCoins+ARMORER.WAGE);
 assert(events.some(e=>e.type==='smith.repair.ready'&&e.serial===serial));
 assert.equal(Object.values(w.entity_registry.items).filter(i=>i.type==='short_sword').length,1);
 w=G.apply(w,{action:'collect_repair',order_id:order.id}).world;
 assert.equal(w.entity_registry.items[serial].parent,E.PACK);
 assert.equal(w.characters['1'].inventory.short_sword,1);
 assert.equal(Object.keys(w.living.armorer.orders).length,0);
 assert.equal(w.living.armorer.completed,1);
 assert.throws(()=>G.apply(w,{action:'collect_repair',order_id:order.id}),/not ready/);
 E.counts(w);W.validateWorld(w);
});
test('M55 repairs stall if the smith lacks ore or the workshop is broken',()=>{
 const {w,order}=submit(scene()),shop=w.living.businesses.village_smithy;
 shop.other_stock.ore=0;E.reconcile(w);w.living.minute=60;
 ARMORER.tick(w,60,[]);
 assert.equal(order.status,'working');
 shop.other_stock.ore=1;E.reconcile(w);
 const machine=w.living.maintenance.shops.village_smithy;
 machine.wear=100;machine.broken=true;machine.failed_minute=60;machine.breakdowns++;
 ARMORER.tick(w,60,[]);
 assert.equal(order.status,'working');
 machine.wear=0;machine.broken=false;machine.repairs++;
 ARMORER.tick(w,60,[]);
 assert.equal(order.status,'ready');
 E.counts(w);W.validateWorld(w);
});
test('M55 player-owned smithy assistant OFF blocks unattended repair service',()=>{
 let {w,order}=submit(scene());
 w=G.apply(w,{action:'buy_business',business_id:'village_smithy'}).world;
 w=G.apply(w,{action:'set_assistant',business_id:'village_smithy',enabled:false}).world;
 w.living.minute=60;ARMORER.tick(w,60,[]);
 assert.equal(w.living.armorer.orders[order.id].status,'working');
 w=G.apply(w,{action:'set_assistant',business_id:'village_smithy',enabled:true}).world;
 ARMORER.tick(w,60,[]);
 assert.equal(w.living.armorer.orders[order.id].status,'ready');
 E.counts(w);W.validateWorld(w);
});
test('M55 salvage destroys physical gear and yields one recovered material, with no input material required',()=>{
 let {w,serial}=wornSword(scene());
 const ore=w.characters['1'].inventory.ore;
 w.characters['1'].inventory.ore=0;w.characters['1'].crafting.hand='tools';
 E.reconcile(w);
 w=G.apply(w,{action:'salvage_gear',serial}).world;
 assert.equal(w.characters['1'].inventory.ore,1);
 assert.equal(w.characters['1'].inventory.short_sword,0);
 assert.equal(w.entity_registry.items[serial],undefined);
 assert.equal(w.living.armorer.salvages,1);
 E.counts(w);W.validateWorld(w);
});
test('M55 character deletion removes their unclaimed repair goods, not the NPC smithy or stock',()=>{
 const {w,serial}=submit(scene());
 const shop=w.living.businesses.village_smithy;
 const oldStock=shop.stock,oldCoins=shop.coins;
 const retired=deleteCharacter(w,1,'ELIAS').world;
 assert.equal(retired.characters['1'],undefined);
 assert.equal(retired.entity_registry.items[serial],undefined);
 assert.equal(Object.keys(retired.living.armorer.orders).length,0);
 assert.equal(retired.living.businesses.village_smithy.stock,oldStock);
 assert.equal(retired.living.businesses.village_smithy.coins,oldCoins);
 assert(retired.living.npcs[shop.owner_id].alive);
 E.counts(retired);W.validateWorld(retired);
});
