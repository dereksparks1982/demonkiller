'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const W=require('../server/world.cjs'),T=require('../server/world-scheduler-m11.cjs');
const M=require('../server/mobile-assets-m12.cjs'),S=require('../server/npc-succession-m23.cjs');
const H=require('../server/npc-harvest-m22.cjs'),E=require('../server/entity-registry-m10.cjs');
const D=require('../server/region-policies-m16.cjs');
const R=require('../server/regions.cjs'),V=require('../server/vendors-m18.cjs');
const {createDKServer}=require('../server/dk-server.cjs');
const NOW=Date.UTC(2026,10,6);
function fixture(){return W.makeWorld(NOW);}
function kill(world,npcId,minute=0){
 const npc=world.living.npcs[npcId],events=[];
 assert(npc.alive);
 npc.alive=false;npc.health=0;
 const corpse=M.onDeath(world,npc,minute,events);
 assert(corpse);
 E.reconcile(world);
 return {corpse,events};
}
test('M23 starts with ten occupied roles and migrates M22 saves without changes',()=>{
 const world=fixture();
 assert.equal(Object.keys(world.living.succession.posts).length,10);
 const coins=world.living.businesses.village_smithy.coins;
 delete world.living.succession;
 assert.equal(S.ensure(world),true);
 assert.equal(S.ensure(world),false);
 assert.equal(world.living.businesses.village_smithy.coins,coins);
 assert.equal(world.living.succession.posts.blacksmith.holder_id,'blacksmith');
 W.validateWorld(world);
});
test('New blacksmith has a new ID and backpack, and funding is transferred, not minted',()=>{
 const w=fixture(),before=w.living.businesses.village_smithy.coins;
 const originalSerial=Object.values(w.entity_registry.items)
   .find(i=>i.parent==='npc_pack_blacksmith').serial;
 const {corpse}=kill(w,'blacksmith');
 w.living.minute=119;S.run(w,119,[]);
 assert.equal(w.living.succession.hired,0,'Hiring must respect the vacancy delay');
 w.living.minute=120;const events=[];S.run(w,120,events);
 const shop=w.living.businesses.village_smithy,n=w.living.npcs[shop.owner_id];
 assert(n?.alive);
 assert.notEqual(n.id,'blacksmith');
 assert.equal(n.role,'smithy');
 assert.equal(n.coins,S.WAGE);
 assert.equal(shop.coins,before-S.WAGE);
 assert.equal(shop.expenses,S.WAGE);
 assert.equal(shop.open,false,'The shop cannot open until its replacement arrives');
 assert(w.living.mobile_assets.npcs[n.id]?.bag_id);
 assert(w.living.npc_ai.brains[n.id]);
 assert.equal(w.living.npcs.blacksmith.alive,false,'The predecessor stays dead');
 assert(w.living.mobile_assets.corpses[corpse.id]);
 assert.equal(w.entity_registry.items[originalSerial].parent,'npc_pack_blacksmith',
   'Old possessions stay with the original corpse');
 assert(events.some(e=>e.type==='npc.post.filled'));
 E.counts(w);W.validateWorld(w);
});
test('Recruitment does not replay at later timer intervals or after a save restart',()=>{
 const w=fixture();kill(w,'baker');
 const events=[];w.living.minute=120;S.run(w,120,events);
 const newId=w.living.businesses.village_bakery.owner_id;
 const paid=w.living.businesses.village_bakery.coins;
 S.run(w,240,events);
 assert.equal(w.living.succession.hired,1);
 assert.equal(w.living.businesses.village_bakery.coins,paid);
 assert.equal(w.living.businesses.village_bakery.owner_id,newId);
 const reloaded=structuredClone(w);
 S.ensure(reloaded);W.validateWorld(reloaded);
 assert.equal(reloaded.living.succession.posts.baker.holder_id,newId);
});
test('Occupied towns and insolvent businesses cannot summon replacements',()=>{
 const w=fixture();kill(w,'guard_north');
 w.living.minute=120;
 const bank=w.living.businesses.village_bank;
 bank.coins=0;S.run(w,120,[]);
 assert.equal(w.living.succession.hired,0);
 bank.coins=100;w.living.territories[R.VILLAGE].control='monsters';
 S.run(w,240,[]);
 assert.equal(w.living.succession.hired,0);
 w.living.territories[R.VILLAGE].control='settlers';
 S.run(w,360,[]);
 assert.equal(w.living.succession.hired,1);
 const guard=w.living.npcs[w.living.succession.posts.guard_north.holder_id];
 assert.equal(guard.role,'guard');
 assert.equal(bank.coins,100-S.WAGE);
 W.validateWorld(w);
});
test('A replacement market keeper physically harvests and delivers goods',()=>{
 const w=fixture();kill(w,'market_vendor');
 w.living.minute=120;S.run(w,120,[]);
 const newId=w.living.businesses.village_market.owner_id;
 assert.notEqual(newId,'market_vendor');
 w.living.minute=135;const events=[];H.plan(w,135,events);
 const goal=w.living.npc_harvest.goals[newId];
 assert(goal?.node_id==='village_produce');
 H.validate(w); // A pending successor goal must itself survive a save.
 const n=w.living.npcs[newId],node=w.living.resources[goal.node_id];
 n.area_id=node.area_id;n.x=node.x;n.y=node.y;
 H.process(w,140,events);
 H.validate(w); // Carried cargo is valid while the delivery is unfinished.
 assert.equal(goal.phase,'to_shop');
 const serial=goal.item_serial;
 assert.equal(w.entity_registry.items[serial].parent,'npc_pack_'+newId);
 const shop=w.living.businesses.village_market,point=V.location(w,shop);
 n.area_id=shop.area_id;n.x=point.x;n.y=point.y;
 const oldStock=shop.stock;
 H.process(w,145,events);
 D.syncNpcTransitions(w,145,events);
 assert.equal(shop.stock,oldStock+1);
 assert.equal(w.entity_registry.items[serial].parent,'vendor_stock_'+shop.id);
 E.reconcile(w);E.counts(w);W.validateWorld(w);
});
test('Vacancies are scheduled, durable, and existing courier mail follows the new courier',()=>{
 const w=fixture();kill(w,'courier');
 const events=[];for(let m=1;m<=120;m++){
  T.runMinute(w,m,events);w.living.minute=m;
 }
 const newId=w.living.succession.posts.courier.holder_id;
 assert.notEqual(newId,'courier');
 const n=w.living.npcs[newId];assert(n.alive);
 assert.equal(w.living.scheduler.jobs.job_7.fires,1);
 assert(events.some(e=>e.type==='npc.post.filled'));
 // Postal delivery uses the current courier, not the original deceased NPC.
 n.area_id=R.VILLAGE;n.x=54;n.y=103;
 const letter={id:'letter_successor',from:'Test',to_slot:1,subject:'Hello',
  body:'New courier',written_minute:0,eta_minute:120};
 w.living.mail.outbound.push(letter);
 T.runMinute(w,121,events);w.living.minute=121;
 D.syncNpcTransitions(w,121,events);
 assert(w.living.mail.boxes['1'].some(x=>x.id==='letter_successor'));
 E.reconcile(w);W.validateWorld(w);
});
test('Only nearby appointments are disclosed, and forged post identities are rejected',()=>{
 const w=fixture();
 assert.deepEqual(S.listing(w).nearby,[]);
 w.characters['1']={area_id:R.VILLAGE,x:54,y:103};
 assert(S.listing(w).nearby.every(p=>!['herbalist','courtyard_keeper'].includes(p.post_id)));
 w.living.succession.posts.baker.holder_id='fake_person';
 assert.throws(()=>S.validate(w),/Invalid settlement post/);
});
test('HTTP succession route is read-only and does not create NPCs when queried',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dk-succession-m23-'));
 const app=await createDKServer({dataDir:dir,port:0,now:()=>NOW});
 t.after(async()=>{if(app.server.listening)await app.close();await fs.rm(dir,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+app.address.port;
 const response=await fetch(base+'/api/v1/npc-succession');
 assert.equal(response.status,200);
 const payload=await response.json();
 assert.equal(payload.hired,0);assert.deepEqual(payload.nearby,[]);
 assert.equal((await fetch(base+'/api/v1/npc-succession',{method:'POST',
  headers:{'Content-Type':'application/json'},body:'{}'})).status,405);
 await app.close();
});
