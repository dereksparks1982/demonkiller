'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const W=require('../server/world.cjs'),R=require('../server/regions.cjs');
const G=require('../server/gameplay.cjs'),E=require('../server/entity-registry-m10.cjs');
const MOBILE=require('../server/mobile-assets-m12.cjs');
const HUNT=require('../server/hunting-m56.cjs'),V=require('../server/vendors-m18.cjs');
const WORKSHOPS=require('../server/workshops-m20.cjs');
const {syncAll}=require('./helpers/sync-fixture.cjs');
const NOW=Date.UTC(2026,10,7,21);
function scene(kind='wolf'){
 let w=W.createCharacter(W.makeWorld(NOW),1,'ELIAS',NOW).world;
 const c=w.characters['1'],shop=w.living.businesses.village_tavern;
 const at=V.location(w,shop);
 c.form='living';c.opening_state='resurrected';c.area_id=R.VILLAGE;c.x=at.x;c.y=at.y;
 c.crafting.hand='tools';c.inventory.bandages=2;c.inventory.wood=4;
 c.fieldcraft.camp_until_minute=30;
 shop.open=true;
 const creature={id:kind+'_901',kind,area_id:R.VILLAGE,x:at.x+1,y:at.y};
 const events=[];MOBILE.onCreatureDeath(w,creature,0,events);
 const body=Object.values(w.living.mobile_assets.corpses).at(-1);
 assert(body,'A real terrain corpse must be registered');
 syncAll(w);E.reconcile(w);
 return {w,id:body.id,body};
}
test('M56 new worlds retain an authoritative harvest ledger, old saves migrate',()=>{
 const {w,id}=scene();
 assert.equal(w.living.hunting.schema,1);
 assert.equal(w.living.mobile_assets.corpses[id].harvest.skinned,false);
 delete w.living.hunting;delete w.living.mobile_assets.corpses[id].harvest;
 assert.doesNotThrow(()=>W.validateWorld(w),'Old save must validate before startup migration');
 assert.equal(HUNT.ensure(w),true);
 assert.equal(HUNT.ensure(w),false);
 assert.equal(w.living.mobile_assets.corpses[id].harvest.butchered,false);
 W.validateWorld(w);E.counts(w);
});
test('M56 skinning a slain wolf yields physical hides, preserves corpse and trains skill',()=>{
 let {w,id}=scene();
 const original=w.entity_registry.next_serial;
 w=G.apply(w,{action:'skin_carcass',corpse_id:id}).world;
 assert.equal(w.characters['1'].inventory.hides,2);
 assert.equal(w.living.mobile_assets.corpses[id].harvest.skinned,true);
 assert.equal(w.living.mobile_assets.corpses[id].disturbed,true);
 assert(w.entity_registry.next_serial>original);
 assert(w.characters['1'].skillbook.skills.animal_lore.uses>=1);
 w.living.minute=1;
 assert.throws(()=>G.apply(w,{action:'skin_carcass',corpse_id:id}),/already harvested/);
 E.counts(w);W.validateWorld(w);
});
test('M56 butcher once and cook real meat at a camp, consuming wood and gaining Cooking',()=>{
 let {w,id}=scene();const before=w.characters['1'].inventory.wood;
 w=G.apply(w,{action:'butcher_carcass',corpse_id:id}).world;
 assert.equal(w.characters['1'].inventory.raw_meat,2);
 w.living.minute=1;
 w=G.apply(w,{action:'cook_meat'}).world;
 assert.equal(w.characters['1'].inventory.raw_meat,1);
 assert.equal(w.characters['1'].inventory.wood,before-1);
 assert.equal(w.characters['1'].inventory.meals,1);
 assert.equal(w.living.hunting.butcheries,1);
 assert.equal(w.living.hunting.meals_cooked,1);
 assert.throws(()=>G.apply(w,{action:'cook_meat'}),/Wait another world minute/);
 E.counts(w);W.validateWorld(w);
});
test('M56 spider silk and venom need actual spider remains, with a clean bandage',()=>{
 let {w,id}=scene('spider');
 w=G.apply(w,{action:'skin_carcass',corpse_id:id}).world;
 assert.equal(w.characters['1'].inventory.spider_silk,2);
 w.living.minute=1;
 w=G.apply(w,{action:'extract_venom',corpse_id:id}).world;
 assert.equal(w.characters['1'].inventory.venom,1);
 assert.equal(w.characters['1'].inventory.bandages,1);
 assert.equal(w.living.mobile_assets.corpses[id].harvest.venom_taken,true);
 w.living.minute=2;
 assert.throws(()=>G.apply(w,{action:'butcher_carcass',corpse_id:id}),/no usable meat/);
 assert.throws(()=>G.apply(w,{action:'extract_venom',corpse_id:id}),/already harvested/);
 E.counts(w);W.validateWorld(w);
});
test('M56 rotten carcasses and ghosts cannot produce physical resources',()=>{
 let {w,id}=scene();
 w.living.minute=2000;
 assert.throws(()=>G.apply(w,{action:'butcher_carcass',corpse_id:id}),/decayed beyond/);
 w.living.minute=0;w.characters['1'].form='ghost';
 w.characters['1'].opening_state='complete';
 assert.throws(()=>G.apply(w,{action:'skin_carcass',corpse_id:id}),/living/);
});
test('M56 village tavern buys actual raw meat and funds the hunter with real shop gold',()=>{
 let {w,id}=scene();
 w=G.apply(w,{action:'butcher_carcass',corpse_id:id}).world;
 const shop=w.living.businesses.village_tavern;
 const coins=shop.coins,gold=w.characters['1'].gold,stock=shop.other_stock.raw_meat||0;
 w.living.minute=1;
 w=G.apply(w,{action:'sell',business_id:'village_tavern',
  item_type:'raw_meat',quantity:1}).world;
 assert.equal(w.living.businesses.village_tavern.other_stock.raw_meat,stock+1);
 assert.equal(w.living.businesses.village_tavern.coins,coins-3);
 assert.equal(w.characters['1'].gold,gold+3);
 assert.equal(w.characters['1'].inventory.raw_meat,1);
 E.reconcile(w);E.counts(w);W.validateWorld(w);
});
test('M56 physically supplied NPC tavern prioritizes meat recipe but retains produce fallback',()=>{
 let {w,id}=scene();
 w=G.apply(w,{action:'butcher_carcass',corpse_id:id}).world;
 w.living.minute=1;
 w=G.apply(w,{action:'sell',business_id:'village_tavern',
  item_type:'raw_meat',quantity:1}).world;
 const shop=w.living.businesses.village_tavern;
 const worker=w.living.npcs[shop.owner_id],p=V.location(w,shop);
 worker.area_id=R.VILLAGE;worker.x=p.x;worker.y=p.y;
 shop.other_stock.produce=1;
 shop.open=true;w.living.territories[R.VILLAGE].control='settlers';
 syncAll(w);E.reconcile(w);
 assert.equal(WORKSHOPS.recipeFor('village_tavern',shop).ingredients.raw_meat,1);
 const stock=shop.stock,events=[];w.living.minute=5;
 WORKSHOPS.run(w,5,events);
 assert.equal(shop.other_stock.raw_meat,0);
 assert.equal(shop.stock,stock+1);
 assert(events.some(e=>e.type==='workshop.production'&&
  e.business_id==='village_tavern'&&e.ingredients.raw_meat===1));
 assert.equal(WORKSHOPS.recipeFor('village_tavern',shop).ingredients.produce,2);
 E.counts(w);W.validateWorld(w);
});
test('M56 retiring a character leaves harvested world corpse flags and decay intact',()=>{
 let {w,id}=scene();w=G.apply(w,{action:'skin_carcass',corpse_id:id}).world;
 const retired=require('../server/character-lifecycle-m26.cjs')
  .deleteCharacter(w,1,'ELIAS').world;
 assert.equal(retired.characters['1'],undefined);
 assert.equal(retired.living.mobile_assets.corpses[id].harvest.skinned,true);
 assert.equal(retired.living.mobile_assets.corpses[id].species,'beast');
 E.counts(retired);W.validateWorld(retired);
});
