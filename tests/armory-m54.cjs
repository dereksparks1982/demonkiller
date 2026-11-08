'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const W=require('../server/world.cjs'),G=require('../server/gameplay.cjs');
const R=require('../server/regions.cjs'),E=require('../server/entity-registry-m10.cjs');
const A=require('../server/armory-m54.cjs'),COMBAT=require('../server/combat-m8.cjs');
const V=require('../server/vendors-m18.cjs');
const {syncPlayer}=require('./helpers/sync-fixture.cjs');
const {deleteCharacter}=require('../server/character-lifecycle-m26.cjs');
const NOW=Date.UTC(2026,10,7,21);
function fresh(){
 let w=W.createCharacter(W.makeWorld(NOW),1,'ELIAS',NOW).world;
 const p=w.characters['1'],pt=V.location(w,w.living.businesses.village_smithy);
 p.form='living';p.opening_state='resurrected';
 p.area_id=R.VILLAGE;p.x=pt.x;p.y=pt.y;
 p.inventory.ore=35;p.inventory.wood=35;p.inventory.herbs=10;
 syncPlayer(w);E.reconcile(w);return w;
}
function forge(w,recipe){
 return G.apply(w,{action:'forge_gear',recipe}).world;
}
function equip(w,type){
 const item=Object.values(w.entity_registry.items).find(i=>
  i.parent===E.PACK&&i.type===type&&i.amount===1);
 assert(item,'Must have a real, individual forged item');
 return G.apply(w,{action:'equip_gear',serial:item.serial}).world;
}
test('M54 creates armory equipment slots and migrates older characters',()=>{
 const w=fresh(),p=w.characters['1'],r=w.entity_registry;
 assert.equal(p.armory.schema,1);
 for(const id of Object.values(A.SLOTS))
  assert.equal(r.containers[id].kind,'armory_equip');
 delete p.armory;
 assert.equal(A.ensureCharacter(p),true);
 assert.equal(A.ensureCharacter(p),false);
 A.validate(w);E.counts(w);W.validateWorld(w);
});
test('M54 forging spends exact real ore/wood, creates a persistent item serial and skill practice',()=>{
 let w=fresh();const p=w.characters['1'],ore=p.inventory.ore,wood=p.inventory.wood;
 const prior=p.skillbook.skills.blacksmithing.uses;
 w=forge(w,'short_sword');
 assert.equal(w.characters['1'].inventory.ore,ore-3);
 assert.equal(w.characters['1'].inventory.wood,wood-1);
 assert.equal(w.characters['1'].inventory.short_sword,1);
 assert(w.characters['1'].skillbook.skills.blacksmithing.uses>prior);
 const item=Object.values(w.entity_registry.items).find(i=>i.type==='short_sword');
 assert(item);assert.equal(item.parent,E.PACK);
 E.counts(w);W.validateWorld(w);
});
test('M54 equipment serial remains stable and cannot be duplicated by repeated equip commands',()=>{
 let w=fresh();w=forge(w,'short_sword');
 const item=Object.values(w.entity_registry.items).find(i=>i.type==='short_sword');
 w=G.apply(w,{action:'equip_gear',serial:item.serial}).world;
 assert.equal(w.characters['1'].armory.slots.weapon,item.serial);
 assert.equal(w.entity_registry.items[item.serial].parent,A.SLOTS.weapon);
 assert.equal(w.characters['1'].inventory.short_sword,0);
 assert.throws(()=>G.apply(w,{action:'equip_gear',serial:item.serial}),/backpack/);
 E.counts(w);W.validateWorld(w);
});
test('M54 worn gear keeps the same identity and reduced durability after being unequipped',()=>{
 let w=fresh();w=forge(w,'mace');w=equip(w,'mace');
 const c=w.characters['1'],serial=c.armory.slots.weapon;
 A.wear(w,c,'weapon',33,[]);
 assert.equal(w.entity_registry.items[serial].durability,67);
 w=G.apply(w,{action:'unequip_gear',slot:'weapon'}).world;
 assert.equal(w.entity_registry.items[serial].parent,E.PACK);
 assert.equal(w.entity_registry.items[serial].durability,67);
 w=G.apply(w,{action:'equip_gear',serial}).world;
 assert.equal(w.characters['1'].armory.durability[serial],67);
 assert.equal(w.entity_registry.items[serial].parent,A.SLOTS.weapon);
 E.counts(w);W.validateWorld(w);
});
test('M54 bows require real arrows and cardinal open line of sight',()=>{
 let w=fresh();
 w=forge(w,'bow');w.living.minute=1;w=forge(w,'arrows');w=equip(w,'bow');
 COMBAT.spawn(w,R.COURT,2,[],1,'wolf');
 const mob=Object.values(w.living.combat.creatures).find(m=>m.kind==='wolf');
 assert(mob);
 const a=w.areas[R.COURT],possible=[[0,1],[0,-1],[1,0],[-1,0]];
 const path=possible.map(([dx,dy])=>({x:mob.x+dx*3,y:mob.y+dy*3,dx,dy}))
  .find(({x,y,dx,dy})=>[1,2,3].every(n=>
   R.traversable(a,mob.x+dx*n,mob.y+dy*n,'living')));
 assert(path,'The wilderness wolf needs a cardinal clear approach');
 const p=w.characters['1'];p.area_id=R.COURT;p.x=path.x;p.y=path.y;syncPlayer(w);
 const before=p.inventory.arrows;
 const attacked=COMBAT.apply(w,{action:'attack',target_id:mob.id},NOW+100000);
 assert.equal(attacked.character.inventory.arrows,before-1);
 assert.equal(attacked.event.type,'player.attack');
 assert.equal(attacked.event.ranged,true);
 const hp=attacked.world.entity_registry.items[attacked.character.armory.slots.weapon].durability;
 assert.equal(hp,99);
 E.counts(attacked.world);W.validateWorld(attacked.world);
});
test('M54 iron armor absorbs monster damage and loses durable condition',()=>{
 let w=fresh();w=forge(w,'iron_armor');w=equip(w,'iron_armor');
 const c=w.characters['1'],hp=10,serial=c.armory.slots.armor;
 assert.equal(A.defend(w,c,hp,[],'wolf_1'),8);
 assert.equal(w.entity_registry.items[serial].durability,99);
 assert.equal(w.characters['1'].armory.slots.armor,serial);
 E.counts(w);W.validateWorld(w);
});
test('M54 worn weapons break at zero durability, never creating duplicate pack goods',()=>{
 let w=fresh();w=forge(w,'spear');w=equip(w,'spear');
 const c=w.characters['1'],serial=c.armory.slots.weapon;
 A.wear(w,c,'weapon',100,[]);
 assert.equal(c.armory.slots.weapon,null);
 assert.equal(w.entity_registry.items[serial],undefined);
 assert.equal(c.inventory.spear,0);
 assert(w.living.events.some(e=>e.type==='equipment.broken'));
 E.counts(w);W.validateWorld(w);
});
test('M54 character retirement clears personal equipped items, not shop inventories',()=>{
 let w=fresh();w=forge(w,'buckler');w=equip(w,'buckler');
 const serial=w.characters['1'].armory.slots.offhand;
 const oldGoods=w.living.businesses.village_smithy.stock;
 w=deleteCharacter(w,1,'ELIAS').world;
 assert.equal(w.characters['1'],undefined);
 assert.equal(w.entity_registry.items[serial],undefined);
 assert.equal(w.living.businesses.village_smithy.stock,oldGoods);
 E.counts(w);W.validateWorld(w);
});
