'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const W=require('../server/world.cjs'),E=require('../server/entity-registry-m10.cjs');
const S=require('../server/world-scheduler-m11.cjs');
const X=require('../server/workshops-m20.cjs'),R=require('../server/regions.cjs');
const {createDKServer}=require('../server/dk-server.cjs');
const NOW=Date.UTC(2026,10,6);
function world(){
 const w=W.makeWorld(NOW);
 for(const s of Object.values(w.living.businesses))s.open=true;
 return w;
}
function add(w,id,goods){
 const shop=w.living.businesses[id];
 for(const [type,count] of Object.entries(goods))shop.other_stock[type]=count;
 E.reconcile(w);E.counts(w);W.validateWorld(w);
}
test('M20 has three validated fixed craft recipes and non-destructive M19 migration',()=>{
 const w=world(),before=w.living.businesses.village_smithy.coins;
 assert.equal(X.ensure(w),false);
 assert.deepEqual(Object.keys(X.RECIPES),
  ['village_smithy','village_bakery','village_tavern']);
 delete w.living.workshops;
 assert.equal(X.ensure(w),true);
 assert.equal(w.living.businesses.village_smithy.coins,before);
 assert.equal(X.ensure(w),false);
 assert.doesNotThrow(()=>W.validateWorld(w));
});
test('Smithy consumes actual ore and wood, pays worker, creates durable tools',()=>{
 const w=world(),shop=w.living.businesses.village_smithy;
 add(w,shop.id,{ore:2,wood:1});
 const originalGold=shop.coins,worker=w.living.npcs.blacksmith;
 const coins=worker.coins,events=[];
 const ore=Object.values(w.entity_registry.items)
  .find(i=>i.parent==='vendor_stock_'+shop.id&&i.type==='ore');
 assert(ore?.serial);
 const output=X.run(w,120,events);
 assert.equal(output,1);
 assert.equal(shop.stock,41);
 assert.equal(shop.other_stock.ore,0);
 assert.equal(shop.other_stock.wood,0);
 assert.equal(shop.coins,originalGold-2);
 assert.equal(worker.coins,coins+2);
 assert.equal(w.entity_registry.items[ore.serial],undefined);
 const made=Object.values(w.entity_registry.items)
  .find(i=>i.parent==='vendor_stock_'+shop.id&&i.created_minute===120&&i.type==='tools');
 assert.equal(made.amount,1);
 assert.equal(events[0].output_serial,made.serial);
 assert.equal(events[0].input_serials.length,2);
 assert.equal(w.living.workshops.shops[shop.id].made,1);
 E.counts(w);W.validateWorld(w);
});
test('Bakery and tavern turn physically bought produce into saleable food',()=>{
 const w=world(),events=[];
 add(w,'village_bakery',{produce:2});
 add(w,'village_tavern',{produce:2});
 const made=X.run(w,120,events);
 assert.equal(made,3);
 assert.equal(w.living.businesses.village_bakery.stock,42);
 assert.equal(w.living.businesses.village_tavern.stock,41);
 assert.equal(w.living.businesses.village_bakery.other_stock.produce,0);
 assert.equal(w.living.businesses.village_tavern.other_stock.produce,0);
 assert.equal(events.length,2);
 assert.equal(w.living.workshops.total_units,3);
 E.counts(w);W.validateWorld(w);
});
test('Cannot produce with missing ingredients, a dead worker or occupied district',()=>{
 const w=world(),events=[];
 assert.equal(X.run(w,120,events),0);
 assert.equal(events.length,0);
 add(w,'village_smithy',{ore:2,wood:1});
 w.living.npcs.blacksmith.alive=false;
 assert.equal(X.run(w,120,events),0);
 w.living.npcs.blacksmith.alive=true;
 w.living.territories[R.VILLAGE].control='monsters';
 assert.equal(X.run(w,120,events),0);
 assert.equal(w.living.businesses.village_smithy.other_stock.ore,2);
 E.counts(w);W.validateWorld(w);
});
test('World-minute scheduler produces once at due time and does not replay',()=>{
 const w=world(),events=[];
 add(w,'village_bakery',{produce:2});
 for(let minute=1;minute<=120;minute++){
  S.runMinute(w,minute,events);w.living.minute=minute;
 }
 assert.equal(w.living.workshops.production_runs,1);
 assert.equal(w.living.businesses.village_bakery.stock,42);
 assert.equal(S.runMinute(w,120,events),0);
 assert.equal(w.living.workshops.production_runs,1);
 assert(events.some(e=>e.type==='workshop.production'));
 E.counts(w);W.validateWorld(w);
});
test('Workshop save schema rejects forged production counters',()=>{
 const w=world();
 w.living.workshops.shops.village_smithy.made=-1;
 assert.throws(()=>X.validate(w),/Invalid workshop/);
});
test('HTTP workshop inspection is read-only and production state survives restart',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dk-m20-workshops-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const w=world(),events=[];add(w,'village_smithy',{ore:2,wood:1});
 X.run(w,120,events);
 await fs.writeFile(path.join(dir,'world.json'),JSON.stringify(w));
 const app=await createDKServer({dataDir:dir,port:0,now:()=>NOW});
 t.after(()=>app.server.listening?app.close():Promise.resolve());
 const base='http://127.0.0.1:'+app.address.port;
 const response=await fetch(base+'/api/v1/workshops');
 assert.equal(response.status,200);
 const report=await response.json();
 assert.equal(report.production_runs,1);
 assert.equal(report.shops.find(s=>s.id==='village_smithy').made,1);
 assert.equal((await fetch(base+'/api/v1/workshops',{method:'POST'})).status,405);
 await app.close();
 const restarted=await createDKServer({dataDir:dir,port:0,now:()=>NOW});
 try{
  assert.equal(restarted.world.living.workshops.production_runs,1);
  E.counts(restarted.world);W.validateWorld(restarted.world);
 }finally{await restarted.close();}
});
