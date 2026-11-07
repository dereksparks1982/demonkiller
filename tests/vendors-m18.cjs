'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const W=require('../server/world.cjs'),E=require('../server/entity-registry-m10.cjs');
const V=require('../server/vendors-m18.cjs'),G=require('../server/gameplay.cjs');
const D=require('../server/region-policies-m16.cjs'),R=require('../server/regions.cjs');
const T=require('../server/world-scheduler-m11.cjs');
const {createDKServer}=require('../server/dk-server.cjs');
const NOW=Date.UTC(2026,10,6);
function fixture(){
 const w=W.createCharacter(W.makeWorld(NOW),1,'ELIAS',NOW).world;
 const c=w.characters['1'];
 Object.assign(c,{form:'living',opening_state:'resurrected',
  area_id:R.VILLAGE,x:25,y:113,gold:300});
 c.region_id=D.regionAt(w,c.area_id,c.x,c.y).id;
 c.inventory.ore=5;w.living.businesses.village_smithy.open=true;
 E.reconcile(w);E.counts(w);W.validateWorld(w);
 return w;
}
function find(w,type,parent){
 return Object.values(w.entity_registry.items).find(i=>i.type===type&&i.parent===parent);
}
test('M18 maintains physical stock for all five goods vendors, not the Village Bank',()=>{
 const w=fixture();
 assert.equal(V.listing(w).count,5);
 assert.equal(Object.values(w.entity_registry.containers)
  .filter(c=>c.kind==='vendor_stock').length,5);
 assert.equal(find(w,'tools','vendor_stock_village_smithy').amount,40);
 assert.equal(find(w,'bread','vendor_stock_village_bakery').amount,40);
 assert.equal(w.entity_registry.containers.vendor_stock_village_bank,undefined);
 assert.equal(V.ensure(w),false);
 E.counts(w);W.validateWorld(w);
});
test('M17 save migration preserves vendor gold and stock without creating duplicates',()=>{
 const w=fixture(),stock=w.living.businesses.village_smithy.stock;
 const coins=w.living.businesses.village_smithy.coins;
 for(const shop of Object.values(w.living.businesses)){
  delete shop.other_stock;
  const id='vendor_stock_'+shop.id;
  for(const item of Object.values(w.entity_registry.items))
   if(item.parent===id)delete w.entity_registry.items[item.serial];
  delete w.entity_registry.containers[id];
 }
 assert.equal(V.ensure(w),true);
 E.reconcile(w);
 assert.equal(w.living.businesses.village_smithy.stock,stock);
 assert.equal(w.living.businesses.village_smithy.coins,coins);
 assert.equal(find(w,'tools','vendor_stock_village_smithy').amount,40);
 assert.equal(V.ensure(w),false);
 E.counts(w);W.validateWorld(w);
});
test('Selling ore to the smithy stores ore, not imaginary tools',()=>{
 const w=fixture(),ore=find(w,'ore',E.PACK),initialStock=w.living.businesses.village_smithy.stock;
 const traded=G.apply(w,{action:'sell',business_id:'village_smithy',item_type:'ore',quantity:2});
 assert.equal(traded.world.living.businesses.village_smithy.stock,initialStock);
 assert.equal(traded.world.living.businesses.village_smithy.other_stock.ore,2);
 E.reconcile(traded.world);E.counts(traded.world);
 const sold=find(traded.world,'ore','vendor_stock_village_smithy');
 assert.equal(sold.amount,2);
 assert.notEqual(sold.serial,ore.serial,'Splitting creates an independent sold stack');
 W.validateWorld(traded.world);
});
test('Buying stock splits an existing serial into a real player item',()=>{
 const w=fixture(),original=find(w,'tools','vendor_stock_village_smithy');
 const bought=G.apply(w,{action:'buy',business_id:'village_smithy',quantity:2});
 E.reconcile(bought.world);
 assert.equal(find(bought.world,'tools','vendor_stock_village_smithy').serial,original.serial);
 assert.equal(find(bought.world,'tools','vendor_stock_village_smithy').amount,38);
 const playerItem=find(bought.world,'tools',E.PACK);
 assert.equal(playerItem.amount,2);
 assert.notEqual(playerItem.serial,original.serial);
 E.counts(bought.world);W.validateWorld(bought.world);
});
test('Selling goods cannot overflow a merchant storeroom or forge quantity',()=>{
 const w=fixture(),shop=w.living.businesses.village_smithy;
 shop.other_stock.ore=459;E.reconcile(w);
 assert.equal(V.total(shop),499);
 assert.throws(()=>G.apply(w,{action:'sell',business_id:'village_smithy',
  item_type:'ore',quantity:2}),/storeroom is full/);
 assert.throws(()=>G.apply(w,{action:'sell',business_id:'village_smithy',
  item_type:'ore',quantity:3,extra:999}),/Invalid/);
 W.validateWorld(w);
});
test('Scheduled raw suppliers replenish markets, but not workshop goods without ingredients',()=>{
 const w=fixture(),shop=w.living.businesses.village_smithy,
   market=w.living.businesses.village_market,events=[];
 shop.stock=3;market.stock=3;E.reconcile(w);
 for(let m=1;m<=120;m++){T.runMinute(w,m,events);w.living.minute=m;}
 E.reconcile(w);
 assert.equal(shop.stock,3,'No magic delivery of fabricated smithy tools');
 assert.equal(market.stock,28,'The market still receives a genuine scheduled supplier');
 assert(events.some(e=>e.type==='business.delivery'&&e.business_id==='village_market'));
 assert(!events.some(e=>e.type==='business.delivery'&&e.business_id==='village_smithy'));
 E.counts(w);W.validateWorld(w);
});
test('HTTP vendor stock is read-only and trading persists across server restart',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dk-m18-vendors-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 await fs.writeFile(path.join(dir,'world.json'),JSON.stringify(fixture()));
 const app=await createDKServer({dataDir:dir,port:0,now:()=>NOW});
 t.after(()=>app.server.listening?app.close():Promise.resolve());
 const base='http://127.0.0.1:'+app.address.port;
 const vendors=await fetch(base+'/api/v1/vendors');
 assert.equal(vendors.status,200);
 assert((await vendors.json()).nearby.some(s=>s.id==='village_smithy'&&s.quantity===40));
 assert.equal((await fetch(base+'/api/v1/vendors',{method:'POST'})).status,405);
 const sold=await fetch(base+'/api/v1/gameplay',{method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({action:'sell',business_id:'village_smithy',item_type:'ore',quantity:2})});
 assert.equal(sold.status,200);
 const disk=JSON.parse(await fs.readFile(path.join(dir,'world.json'),'utf8'));
 assert.equal(disk.living.businesses.village_smithy.other_stock.ore,2);
 E.counts(disk);W.validateWorld(disk);
 await app.close();
 const again=await createDKServer({dataDir:dir,port:0,now:()=>NOW});
 try{assert.equal(again.world.living.businesses.village_smithy.other_stock.ore,2);}
 finally{await again.close();}
});
