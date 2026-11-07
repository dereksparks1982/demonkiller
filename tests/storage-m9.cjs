'use strict';
const {syncAll}=require('./helpers/sync-fixture.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const W=require('../server/world.cjs'),G=require('../server/gameplay.cjs');
const Storage=require('../server/storage-m9.cjs'),R=require('../server/regions.cjs');
const {createDKServer}=require('../server/dk-server.cjs');
const ORIGIN=Date.UTC(2026,10,6);
function fixture(){
 let w=W.createCharacter(W.makeWorld(ORIGIN),1,'ELIAS',ORIGIN).world;
 const c=w.characters['1'];c.area_id=R.VILLAGE;c.x=54;c.y=103;
 c.form='living';c.opening_state='resurrected';c.inventory.herbs=10;
 w.living.businesses.village_bank.open=true;syncAll(w);return w;
}
test('M9 validates, migrates, and preserves item storage alongside other world data',()=>{
 const world=fixture();
 assert.equal(Storage.ensure(world),false);
 assert.doesNotThrow(()=>W.validateWorld(world));
 delete world.living.storage;
 assert.equal(Storage.ensure(world),true);
 assert.equal(Storage.ensure(world),false);
 assert.doesNotThrow(()=>W.validateWorld(world));
});
test('bank stores and withdraws actual physical goods without increasing total quantity',()=>{
 let w=fixture(),result=G.apply(w,{action:'bank_store',item_type:'herbs',quantity:5});
 assert.equal(result.character.inventory.herbs,5);
 assert.equal(result.world.living.storage.vaults['1'].herbs,5);
 assert.equal(w.characters['1'].inventory.herbs,10);
 result=G.apply(result.world,{action:'bank_take',item_type:'herbs',quantity:3});
 assert.equal(result.character.inventory.herbs,8);
 assert.equal(result.world.living.storage.vaults['1'].herbs,2);
 assert.throws(()=>G.apply(result.world,{action:'bank_take',item_type:'herbs',quantity:3}),/enough/);
 assert.doesNotThrow(()=>W.validateWorld(result.world));
});
test('bank refuses remote transactions, forged quantities, closed hours and ghost storage',()=>{
 let w=fixture();
 assert.throws(()=>G.apply(w,{action:'bank_store',item_type:'herbs',quantity:5,gold:100}),/Invalid/);
 assert.throws(()=>G.apply(w,{action:'bank_store',item_type:'herbs',quantity:21}),/Invalid/);
 w.characters['1'].x=10;
 assert.throws(()=>G.apply(w,{action:'bank_store',item_type:'herbs',quantity:1}),/Visit/);
 w.characters['1'].x=54;
 w.living.businesses.village_bank.open=false;
 assert.throws(()=>G.apply(w,{action:'bank_store',item_type:'herbs',quantity:1}),/closed/);
 w.living.businesses.village_bank.open=true;
 w.characters['1'].form='ghost';w.characters['1'].opening_state='complete';
 assert.throws(()=>G.apply(w,{action:'bank_store',item_type:'herbs',quantity:1}),/Ghosts/);
});
test('dropped goods remain in the outdoor world and are collectible once',()=>{
 let w=fixture(),c=w.characters['1'];
 c.area_id=R.COURT;c.x=20;c.y=30;
 const drop=G.apply(w,{action:'drop_item',item_type:'herbs',quantity:4});
 assert.equal(drop.character.inventory.herbs,6);
 const pile=Object.values(drop.world.living.storage.ground)[0];
 assert.equal(pile.item,'herbs');assert.equal(pile.quantity,4);
 assert.equal(pile.expires_minute,360);
 assert.doesNotThrow(()=>W.validateWorld(drop.world));
 const taken=G.apply(drop.world,{action:'pick_up',drop_id:pile.id});
 assert.equal(taken.character.inventory.herbs,10);
 assert.equal(Object.keys(taken.world.living.storage.ground).length,0);
 assert.throws(()=>G.apply(taken.world,{action:'pick_up',drop_id:pile.id}),/Move beside/);
});
test('ground goods decay by simulated world minute, not real time',()=>{
 const w=fixture(),c=w.characters['1'];c.area_id=R.COURT;c.x=20;c.y=30;
 const dropped=G.apply(w,{action:'drop_item',item_type:'herbs',quantity:2}).world;
 const events=[];
 Storage.tick(dropped,359,events);
 assert.equal(Object.keys(dropped.living.storage.ground).length,1);
 Storage.tick(dropped,360,events);
 assert.equal(Object.keys(dropped.living.storage.ground).length,0);
 assert.equal(events[0].type,'storage.decayed');
});
test('bank-item HTTP transaction and bank-box item read survive a persistent save',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dk-m9-storage-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 await fs.writeFile(path.join(dir,'world.json'),JSON.stringify(fixture()));
 const app=await createDKServer({dataDir:dir,port:0,now:()=>ORIGIN});
 t.after(()=>app.server.listening?app.close():Promise.resolve());
 const base='http://127.0.0.1:'+app.address.port;
 const action=await fetch(base+'/api/v1/gameplay',{method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({action:'bank_store',item_type:'herbs',quantity:4})});
 assert.equal(action.status,200);
 const box=await(await fetch(base+'/api/v1/bank/box')).json();
 assert.equal(box.items.herbs,4);
 const disk=JSON.parse(await fs.readFile(path.join(dir,'world.json'),'utf8'));
 assert.equal(disk.characters['1'].inventory.herbs,6);
 assert.equal(disk.living.storage.vaults['1'].herbs,4);
 await app.close();
});
