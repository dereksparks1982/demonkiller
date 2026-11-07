'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const W=require('../server/world.cjs'),L=require('../server/living-world.cjs');
const E=require('../server/entity-registry-m10.cjs'),N=require('../server/npc-commerce-m19.cjs');
const {createDKServer}=require('../server/dk-server.cjs');
const START=Date.UTC(2026,10,6),MINUTE=60_000;
function worldAt(minute=90){
 const w=W.makeWorld(START);
 return L.advance(w,START+minute*MINUTE,minute+5);
}
test('M19 world initializes an independent bounded NPC customer state',()=>{
 const w=W.makeWorld(START);
 assert.equal(N.ensure(w),false);
 assert.equal(w.living.npc_trade.purchases,0);
 assert.deepEqual(N.listing(w).active_shoppers,[]);
 E.counts(w);W.validateWorld(w);
});
test('A real villager reaches a nearby market and buys physical goods',()=>{
 const w=W.makeWorld(START),a=worldAt(90),p=a.world.living.npc_trade;
 const tx=a.events.filter(e=>e.type==='business.trade');
 assert(tx.length>=1,'At least one real NPC purchase happens by world minute 90');
 assert(p.purchases>=1);
 const customer=a.world.living.npcs[tx[0].npc_id];
 assert(customer.alive);
 assert.equal(tx[0].revenue,2);
 assert.equal(customer.coins,w.living.npcs[customer.id].coins-2);
 const item=a.world.entity_registry.items[tx[0].item_serial];
 assert(item,'Purchased item has a saved unique item identity');
 assert.equal(item.parent,'npc_pack_'+customer.id);
 assert.equal(item.type,'produce');
 assert.equal(item.amount,1);
 assert.equal(a.world.living.businesses.village_market.stock,
  w.living.businesses.village_market.stock-1);
 E.counts(a.world);W.validateWorld(a.world);
});
test('NPCs must physically travel and cannot receive distant teleporting deliveries',()=>{
 const w=W.makeWorld(START),events=[];
 w.living.businesses.village_market.open=true;
 for(let m=1;m<=15;m++){
  N.plan(w,m,events);w.living.minute=m;
 }
 const goals=Object.values(w.living.npc_trade.goals);
 assert(goals.length>=1);
 const guard=w.living.npcs.guard_north;
 const goal=w.living.npc_trade.goals.guard_north;
 assert(goal);
 const pos={x:guard.x,y:guard.y};
 N.purchase(w,20,events);
 assert.equal(w.living.npc_trade.purchases,0);
 assert.deepEqual({x:guard.x,y:guard.y},pos);
 assert.equal(w.living.businesses.village_market.stock,40);
});
test('NPCs consume food physically held in their own pack without spending extra coins',()=>{
 const a=worldAt(90),w=a.world;
 const guard=w.living.npcs.guard_north,coins=guard.coins;
 const food=Object.values(w.entity_registry.items)
  .find(i=>i.parent==='npc_pack_guard_north'&&i.type==='produce');
 assert(food);
 guard.hunger=11;
 const events=[];
 assert.equal(N.consume(w,guard,300,events),true);
 assert.equal(guard.hunger,0);
 assert.equal(guard.coins,coins);
 assert.equal(w.entity_registry.items[food.serial],undefined);
 assert.equal(events[0].type,'npc.food.eaten');
 E.reconcile(w);E.counts(w);W.validateWorld(w);
});
test('No free meals or unexplained coins when an NPC lacks actual food',()=>{
 const w=W.makeWorld(START),npc=w.living.npcs.guard_south,coins=npc.coins;
 npc.hunger=79;
 assert.equal(N.consume(w,npc,300,[]),false);
 assert.equal(npc.hunger,79);
 assert.equal(npc.coins,coins);
});
test('Paused world neither moves customers nor purchases goods',()=>{
 const a=worldAt(90),w=W.setWorldRunning(a.world,false,START+90*MINUTE);
 const purchases=w.living.npc_trade.purchases;
 const frozen=L.advance(w,START+5000*MINUTE,180);
 assert.equal(frozen.minutes,0);
 assert.equal(frozen.world.living.npc_trade.purchases,purchases);
 W.validateWorld(frozen.world);
});
test('Corrupt customer targets and transaction histories are rejected',()=>{
 const w=W.makeWorld(START);
 w.living.npc_trade.goals.guard_north={npc_id:'guard_north',
  shop_id:'unknown_shop',assigned_minute:15,expires_minute:315};
 assert.throws(()=>N.validate(w),/Invalid NPC customer/);
});
test('NPC purchases and owned items persist through a server restart',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dk-m19-commerce-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const a=worldAt(90),w=a.world;
 await fs.writeFile(path.join(dir,'world.json'),JSON.stringify(w));
 const app=await createDKServer({dataDir:dir,port:0,now:()=>START+90*MINUTE});
 t.after(()=>app.server.listening?app.close():Promise.resolve());
 const base='http://127.0.0.1:'+app.address.port;
 const res=await fetch(base+'/api/v1/npc-commerce');
 assert.equal(res.status,200);
 assert((await res.json()).recorded_purchases>=1);
 assert.equal((await fetch(base+'/api/v1/npc-commerce',{method:'POST'})).status,405);
 await app.close();
 const saved=JSON.parse(await fs.readFile(path.join(dir,'world.json'),'utf8'));
 assert(saved.living.npc_trade.purchases>=1);
 assert(Object.values(saved.entity_registry.items).some(i=>
  i.parent==='npc_pack_guard_north'&&i.type==='produce'));
 const again=await createDKServer({dataDir:dir,port:0,now:()=>START+90*MINUTE});
 try{assert(again.world.living.npc_trade.purchases>=1);}
 finally{await again.close();}
});
