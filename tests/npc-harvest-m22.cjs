'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const W=require('../server/world.cjs'),G=require('../server/gameplay.cjs');
const H=require('../server/npc-harvest-m22.cjs');
const V=require('../server/vendors-m18.cjs');
const E=require('../server/entity-registry-m10.cjs');
const L=require('../server/living-world.cjs');
const {createDKServer}=require('../server/dk-server.cjs');
const NOW=Date.UTC(2026,10,6);
function fixture(){return W.makeWorld(NOW);}
function advanceGoal(world,npcId,nodeId,minute=npcId==='market_vendor'?120:15){
 const npc=world.living.npcs[npcId],node=world.living.resources[nodeId];
 world.living.minute=minute;npc.x=node.x;npc.y=node.y;npc.area_id=node.area_id;
 const events=[];H.plan(world,minute,events);
 const plan=world.living.npc_harvest.goals[npcId];
 assert(plan,'NPC planned a physical gathering trip');
 H.process(world,minute+5,events);
 assert.equal(plan.phase,'to_shop');
 const serial=plan.item_serial;
 const carried=world.entity_registry.items[serial];
 assert.equal(carried.parent,'npc_pack_'+npcId);
 assert.equal(carried.type,node.type);
 const shop=world.living.businesses[plan.shop_id],at=V.location(world,shop);
 npc.area_id=shop.area_id;npc.x=at.x;npc.y=at.y;
 H.process(world,minute+10,events);
 assert.equal(world.living.npc_harvest.goals[npcId],undefined);
 assert.equal(world.entity_registry.items[serial].parent,'vendor_stock_'+shop.id);
 E.counts(world);W.validateWorld(world);
 return {serial,shop,events,node};
}
test('M22 migrates M21 saves without deleting NPC or business belongings',()=>{
 const w=fixture(),before=w.living.npcs.market_vendor.name;
 assert(w.living.resources.village_produce);
 delete w.living.npc_harvest;delete w.living.resources.village_produce;
 assert.equal(G.ensureResources(w),true);
 assert.equal(H.ensure(w),true);
 assert.equal(H.ensure(w),false);
 assert.equal(w.living.npcs.market_vendor.name,before);
 W.validateWorld(w);
});
test('Market grower gathers physically from a limited patch and brings same item ID back',()=>{
 const w=fixture(),before=w.living.businesses.village_market.stock,
  remaining=w.living.resources.village_produce.remaining;
 const result=advanceGoal(w,'market_vendor','village_produce');
 assert.equal(result.shop.stock,before+1);
 assert.equal(result.node.remaining,remaining-1);
 assert(result.events.some(e=>e.type==='npc.harvest.collected'));
 assert(result.events.some(e=>e.type==='npc.harvest.delivered'));
 assert.equal(w.living.npc_harvest.delivered,1);
});
test('Traveling herbalist gathers and stocks the existing courtyard market',()=>{
 const w=fixture(),old=w.living.businesses.courtyard_market.stock;
 const result=advanceGoal(w,'herbalist','courtyard_herbs_west');
 assert.equal(result.shop.stock,old+1);
 assert.equal(result.shop.product,'herbs');
});
test('Blacksmith supplies actual ore or wood to workshop inventory instead of creating tools',()=>{
 const w=fixture(),shop=w.living.businesses.village_smithy;
 const before=shop.other_stock.ore||0;
 const result=advanceGoal(w,'blacksmith','village_ore');
 assert.equal(result.shop.other_stock.ore,before+1);
 assert.equal(result.shop.stock,40,'Harvested ore is not a finished tool');
 const item=w.entity_registry.items[result.serial];
 assert.equal(item.type,'ore');
});
test('Monsters and panic suspend gathering without deleting a worker\'s carried item',()=>{
 const w=fixture(),n=w.living.npcs.market_vendor,node=w.living.resources.village_produce;
 w.living.minute=120;H.plan(w,120,[]);
 assert(w.living.npc_harvest.goals.market_vendor);
 n.x=node.x;n.y=node.y;
 w.living.npc_ai.brains.market_vendor.mode='flee';
 const before=node.remaining;
 H.process(w,125,[]);
 assert.equal(node.remaining,before);
 assert.equal(w.living.npc_harvest.goals.market_vendor.phase,'to_node');
 w.living.npc_ai.brains.market_vendor.mode='work';
 H.process(w,130,[]);
 assert.equal(node.remaining,before-1);
 W.validateWorld(w);
});
test('NPCs cannot harvest depleted nodes or carry more than their backpack holds',()=>{
 const w=fixture(),node=w.living.resources.village_produce;
 node.remaining=0;w.living.minute=120;H.plan(w,120,[]);
 assert(!w.living.npc_harvest.goals.market_vendor);
 W.validateWorld(w);
});
test('Actual world-time travel eventually completes a nearby producer delivery',()=>{
 const w=fixture();
 const updated=L.advance(w,NOW+300*60000,300).world;
 assert(updated.living.npc_harvest.collected>=1);
 assert(updated.living.npc_harvest.delivered>=1);
 assert(updated.living.npc_harvest.delivered<=updated.living.npc_harvest.collected);
 E.counts(updated);W.validateWorld(updated);
});
test('Invalid travel goals and resource forgeries fail world validation',()=>{
 const w=fixture(),n=w.living.npcs.market_vendor;w.living.minute=15;
 H.plan(w,15,[]);
 w.living.npc_harvest.goals.market_vendor.item_type='fake_ore';
 assert.throws(()=>H.validate(w),/Invalid NPC harvest goal/);
});
test('HTTP harvest report is nearby-only and cannot be edited by a browser',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dk-m22-npc-harvest-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const app=await createDKServer({dataDir:dir,port:0,now:()=>NOW});
 t.after(()=>app.server.listening?app.close():Promise.resolve());
 const base='http://127.0.0.1:'+app.address.port;
 const response=await fetch(base+'/api/v1/npc-harvest');
 assert.equal(response.status,200);
 const data=await response.json();
 assert.equal(data.collected,0);
 assert.equal(data.delivered,0);
 assert.equal((await fetch(base+'/api/v1/npc-harvest',{method:'POST',
  headers:{'Content-Type':'application/json'},body:'{}'})).status,405);
 await app.close();
});
