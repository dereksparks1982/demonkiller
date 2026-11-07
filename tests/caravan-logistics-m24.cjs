'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const W=require('../server/world.cjs'),C=require('../server/caravan-logistics-m24.cjs');
const E=require('../server/entity-registry-m10.cjs'),M=require('../server/mobile-assets-m12.cjs');
const V=require('../server/vendors-m18.cjs'),D=require('../server/region-policies-m16.cjs');
const R=require('../server/regions.cjs');
const {createDKServer}=require('../server/dk-server.cjs');
const NOW=Date.UTC(2026,10,6);
function fixture(){
 const w=W.makeWorld(NOW),l=w.living;
 const source=l.businesses[C.SOURCE],spot=V.location(w,source);
 source.open=true;
 const n=l.npcs[C.MERCHANT],escort=l.npcs[C.ESCORT];
 for(const a of [n,escort]){a.area_id=R.VILLAGE;a.x=spot.x;a.y=spot.y;}
 D.syncNpcTransitions(w,60,[]);
 w.living.minute=60;
 return w;
}
function buy(world){
 const events=[];
 C.plan(world,60,events);
 assert(world.living.caravans.active,'A merchant trip must be accepted');
 C.validate(world);
 C.process(world,65,events);
 const cargo=world.living.caravans.active;
 assert.equal(cargo.phase,'to_destination');
 C.validate(world);E.counts(world);
 return {events,cargo};
}
test('M24 adds an idempotent single-player logistics registry',()=>{
 const w=fixture();
 assert.equal(C.ensure(w),false);
 delete w.living.caravans;
 assert.equal(C.ensure(w),true);
 assert.equal(C.ensure(w),false);
 assert.equal(w.living.businesses[C.SOURCE].stock,40);
 W.validateWorld(w);
});
test('The trader buys real produce, carries one saved serial, and sells it in another region',()=>{
 const w=fixture(),l=w.living,n=l.npcs[C.MERCHANT],esc=l.npcs[C.ESCORT],
  village=l.businesses[C.SOURCE],courtyard=l.businesses[C.DEST];
 const beforeSource=village.stock,beforeCash=n.coins;
 const totalBefore=Object.values(w.entity_registry.items).reduce((v,i)=>v+i.amount,0);
 const {cargo,events}=buy(w);
 const serial=cargo.cargo_serial;
 assert.equal(village.stock,beforeSource-C.QTY);
 assert.equal(n.coins,beforeCash-C.BUY_PRICE);
 assert.equal(w.entity_registry.items[serial].parent,'npc_pack_'+C.MERCHANT);
 assert.equal(w.entity_registry.items[serial].amount,C.QTY);
 const shopDoor=V.location(w,courtyard);
 for(const a of [n,esc]){a.area_id=R.COURT;a.x=shopDoor.x;a.y=shopDoor.y;}
 courtyard.open=true;D.syncNpcTransitions(w,70,events);
 C.process(w,70,events);
 assert.equal(w.living.caravans.active,null);
 assert.equal(w.entity_registry.items[serial].parent,'vendor_stock_'+C.DEST);
 assert.equal(courtyard.other_stock.produce,C.QTY);
 assert.equal(n.coins,beforeCash+C.SALE_PRICE-C.BUY_PRICE);
 assert.equal(w.living.caravans.profit,C.SALE_PRICE-C.BUY_PRICE);
 assert.equal(Object.values(w.entity_registry.items).reduce((v,i)=>v+i.amount,0),totalBefore);
 assert(events.some(e=>e.type==='caravan.delivered'&&e.item_serial===serial));
 E.counts(w);W.validateWorld(w);
});
test('Unstaffed shops, monster territory, and scarce coins prevent imaginary trades',()=>{
 const w=fixture(),events=[];
 w.living.territories[R.VILLAGE].control='monsters';
 C.plan(w,60,events);
 assert.equal(w.living.caravans.active,null);
 w.living.territories[R.VILLAGE].control='settlers';
 w.living.npcs[C.MERCHANT].coins=0;
 C.plan(w,60,events);assert.equal(w.living.caravans.active,null);
 w.living.npcs[C.MERCHANT].coins=20;
 C.plan(w,60,events);
 assert(w.living.caravans.active);
 w.living.businesses[C.SOURCE].open=false;
 const stock=w.living.businesses[C.SOURCE].stock;
 C.process(w,65,events);
 assert.equal(w.living.businesses[C.SOURCE].stock,stock);
 assert.equal(w.living.caravans.active.phase,'to_source');
 W.validateWorld(w);
});
test('Danger suspends a loaded caravan without consuming the merchandise',()=>{
 const w=fixture();const {cargo}=buy(w),events=[];
 const serial=cargo.cargo_serial;
 w.living.npc_ai.brains[C.ESCORT].mode='defend';
 C.process(w,70,events);
 assert.equal(w.living.caravans.active.cargo_serial,serial);
 assert.equal(w.entity_registry.items[serial].parent,'npc_pack_'+C.MERCHANT);
 assert.equal(w.living.caravans.delivered,0);
 W.validateWorld(w);
});
test('A dead escort cancels the trip; merchant cargo remains a real item',()=>{
 const w=fixture(),{cargo}=buy(w),events=[];
 w.living.npcs[C.ESCORT].alive=false;
 C.process(w,70,events);
 assert.equal(w.living.caravans.active,null);
 assert.equal(w.living.caravans.abandoned,1);
 assert.equal(w.entity_registry.items[cargo.cargo_serial].parent,'npc_pack_'+C.MERCHANT);
 assert(events.some(e=>e.type==='caravan.interrupted'));
 E.counts(w);
});
test('Merchant death leaves carried stock in the original backpack and corpse',()=>{
 const w=fixture(),{cargo}=buy(w),events=[];
 const n=w.living.npcs[C.MERCHANT];n.alive=false;n.health=0;
 const corpse=M.onDeath(w,n,65,events);
 assert(corpse);
 C.process(w,70,events);
 assert.equal(w.living.caravans.active,null);
 assert.equal(w.entity_registry.items[cargo.cargo_serial].parent,'npc_pack_'+C.MERCHANT);
 assert.equal(corpse.bag_id,'npc_pack_'+C.MERCHANT);
 E.counts(w);W.validateWorld(w);
});
test('Forgery and malformed cargo records are rejected',()=>{
 const w=fixture();buy(w);
 w.living.caravans.active.quantity=999;
 assert.throws(()=>C.validate(w),/Invalid active caravan/);
});
test('HTTP caravan status is read-only and hides distant merchant location',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dk-caravan-m24-'));
 const app=await createDKServer({dataDir:dir,port:0,now:()=>NOW});
 t.after(async()=>{if(app.server.listening)await app.close();await fs.rm(dir,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+app.address.port;
 const response=await fetch(base+'/api/v1/caravans');
 assert.equal(response.status,200);
 const info=await response.json();
 assert.equal(info.nearby_caravan,null);assert.equal(info.purchased,0);
 assert.equal((await fetch(base+'/api/v1/caravans',{method:'POST',
  headers:{'Content-Type':'application/json'},body:'{}'})).status,405);
 await app.close();
});
