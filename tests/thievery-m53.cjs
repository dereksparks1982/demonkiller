'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const W=require('../server/world.cjs'),G=require('../server/gameplay.cjs');
const R=require('../server/regions.cjs');
const E=require('../server/entity-registry-m10.cjs');
const T=require('../server/thievery-m53.cjs');
const LAW=require('../server/law-m15.cjs');
const {syncAll}=require('./helpers/sync-fixture.cjs');
const NOW=Date.UTC(2026,10,7,23);
function scene(){
 const w=W.createCharacter(W.makeWorld(NOW),1,'ELIAS',NOW).world;
 const c=w.characters['1'],n=w.living.npcs.guard_north;
 c.form='living';c.opening_state='resurrected';c.area_id=R.VILLAGE;
 c.x=n.x;c.y=n.y;syncAll(w);
 E.reconcile(w);
 return {w,c,n};
}
function observed(scene){
 let {w,n}=scene;
 const r=G.apply(w,{action:'snoop_npc',npc_id:n.id});
 assert.equal(r.event.type,'player.snoop');
 assert(r.event.items.length>0,'NPC must have a real provision in their backpack');
 return {w:r.world,n:r.world.living.npcs[n.id],item:r.event.items[0]};
}
function minuteFor(world,n,item,success){
 const c=world.characters['1'];
 for(let minute=0;minute<=10;minute++){
  const roll=(minute*31+n.id.length*17+
   Number(item.serial.slice(4))*7+c.x*11+c.y*13)%100;
  if((roll<45)===success)return minute;
 }
 throw Error('No suitable deterministic outcome in the observation window');
}
test('M53 thievery character records migrate with existing player saves',()=>{
 const {w,c}=scene();
 assert.equal(c.thievery.schema,1);
 const before=c.skillbook.skills.snooping.value;
 delete c.thievery;
 assert.equal(T.ensure(c),true);assert.equal(T.ensure(c),false);
 assert.equal(c.skillbook.skills.snooping.value,before);
 assert.equal(c.thievery.observed_npc,null);
 W.validateWorld(w);
});
test('Snooping reads existing NPC pack items and trains snooping without moving goods',()=>{
 const {w,n}=scene();
 const before=Object.values(w.entity_registry.items).reduce((sum,i)=>sum+i.amount,0);
 const r=G.apply(w,{action:'snoop_npc',npc_id:n.id});
 assert.equal(r.event.type,'player.snoop');
 assert(r.event.items.length>0);
 assert(r.event.items.every(i=>i.serial.startsWith('ent_')&&i.amount>=1));
 assert.equal(r.character.thievery.observed_npc,n.id);
 assert.equal(r.character.thievery.observed_serials[0],r.event.items[0].serial);
 assert(r.character.skillbook.skills.snooping.uses>0);
 assert.equal(Object.values(r.world.entity_registry.items).reduce((sum,i)=>sum+i.amount,0),before);
 E.counts(r.world);
 W.validateWorld(r.world);
});
test('Successful theft transfers one real NPC item into player pack without minting any',()=>{
 const o=observed(scene()),n=o.n,item=o.item;
 let w=o.w;w.living.minute=minuteFor(w,n,item,true);
 const p=w.characters['1'],before=p.inventory[item.type]||0;
 const priorItems=Object.values(w.entity_registry.items)
  .reduce((sum,i)=>sum+i.amount,0);
 const r=G.apply(w,{action:'pickpocket',npc_id:n.id,serial:item.serial});
 assert.equal(r.event.success,true);
 assert.equal(r.world.characters['1'].inventory[item.type],before+1);
 assert.equal(r.world.characters['1'].thievery.successes,1);
 assert.equal(r.world.characters['1'].thievery.observed_npc,null);
 assert(r.world.entity_registry.items[r.event.obtained_serial]);
 assert.equal(r.world.entity_registry.items[r.event.obtained_serial].parent,E.PACK);
 assert.equal(Object.values(r.world.entity_registry.items)
  .reduce((sum,i)=>sum+i.amount,0),priorItems);
 assert.throws(()=>G.apply(r.world,{action:'pickpocket',npc_id:n.id,
  serial:item.serial}),/Inspect/);
 E.counts(r.world);W.validateWorld(r.world);
});
test('Failed theft transfers nothing and creates a real witnessed law case and fine',()=>{
 const o=observed(scene()),n=o.n,item=o.item;
 let w=o.w;w.living.minute=minuteFor(w,n,item,false);
 const p=w.characters['1'],before=p.inventory[item.type]||0;
 const victim=w.entity_registry.items[item.serial].amount;
 const result=G.apply(w,{action:'pickpocket',npc_id:n.id,serial:item.serial});
 assert.equal(result.event.success,false);
 assert.equal(result.character.inventory[item.type]||0,before);
 assert.equal(result.world.entity_registry.items[item.serial].amount,victim);
 assert.equal(result.world.entity_registry.items[item.serial].parent,'npc_pack_'+n.id);
 assert.equal(result.world.living.law.player.fines,LAW.THEFT_FINE);
 assert(Object.values(result.world.living.law.cases).some(c=>
  c.kind==='pickpocket'&&c.reported&&c.npc_id===n.id));
 assert(result.events.some(e=>e.type==='law.crime.reported'));
 E.counts(result.world);W.validateWorld(result.world);
});
test('Spoofed or distant theft requests cannot claim world-owned items',()=>{
 const o=observed(scene()),n=o.n,item=o.item,w=o.w;
 assert.throws(()=>G.apply(w,{action:'pickpocket',npc_id:n.id,
  serial:item.serial,amount:100}),/Invalid/);
 assert.throws(()=>G.apply(w,{action:'pickpocket',npc_id:n.id,
  serial:'ent_99999999'}),/Inspect/);
 w.characters['1'].x=1;w.characters['1'].y=1;
 assert.throws(()=>G.apply(w,{action:'pickpocket',npc_id:n.id,
  serial:item.serial}),/closer/);
});
test('Only living characters may snoop or steal real NPC possessions',()=>{
 const {w,n}=scene();const c=w.characters['1'];
 c.form='ghost';c.opening_state='complete';
 assert.throws(()=>G.apply(w,{action:'snoop_npc',npc_id:n.id}),/living/);
});
