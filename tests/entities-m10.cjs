'use strict';
const {syncAll}=require('./helpers/sync-fixture.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const W=require('../server/world.cjs'),G=require('../server/gameplay.cjs');
const E=require('../server/entity-registry-m10.cjs');
const R=require('../server/regions.cjs');
const {createDKServer}=require('../server/dk-server.cjs');
const NOW=Date.UTC(2026,10,6);
function fixture(){
 let w=W.createCharacter(W.makeWorld(NOW),1,'ELIAS',NOW).world;
 const c=w.characters['1'];
 c.form='living';c.opening_state='resurrected';
 c.area_id=R.VILLAGE;c.x=54;c.y=103;
 c.inventory.herbs=10;c.inventory.tools=1;
 w.living.businesses.village_bank.open=true;
 syncAll(w);E.reconcile(w);E.counts(w);W.validateWorld(w);
 return w;
}
function item(world,type,parent){
 return Object.values(world.entity_registry.items).find(i=>i.type===type&&i.parent===parent);
}
test('M10 has stable unique serials for the world fixtures, NPCs and one character',()=>{
 const w=fixture();
 const refs=Object.values(w.entity_registry.refs);
 const ids=Object.values(w.entity_registry.items).map(i=>i.serial).concat(refs.map(r=>r.serial));
 assert.equal(new Set(ids).size,ids.length);
 assert(w.entity_registry.refs['player:1'].active);
 assert(w.entity_registry.refs['npc:blacksmith'].active);
 assert(w.entity_registry.refs['fixture:'+R.VILLAGE+':village_bank']);
 assert.equal(E.reconcile(w),false,'Idempotent migration does not create replacement identities');
 E.counts(w);W.validateWorld(w);
});
test('M9 bank-item transfers retain the original ID for a whole stack',()=>{
 const w=fixture(),serial=item(w,'herbs',E.PACK).serial;
 const deposited=G.apply(w,{action:'bank_store',item_type:'herbs',quantity:10});
 E.reconcile(deposited.world);E.counts(deposited.world);
 assert.equal(item(deposited.world,'herbs',E.VAULT).serial,serial);
 assert.equal(deposited.world.characters['1'].inventory.herbs,0);
 assert.equal(w.entity_registry.items[serial].parent,E.PACK,'Old world snapshot unchanged');
 const withdrawn=G.apply(deposited.world,{action:'bank_take',item_type:'herbs',quantity:10});
 E.reconcile(withdrawn.world);E.counts(withdrawn.world);
 assert.equal(item(withdrawn.world,'herbs',E.PACK).serial,serial);
});
test('Splitting creates a new serial; moving the complete piece preserves it across chest/ground',()=>{
 const w=fixture(),original=item(w,'herbs',E.PACK).serial;
 const split=G.apply(w,{action:'move_item',serial:original,quantity:4,destination:E.CHEST});
 assert.equal(split.world.entity_registry.items[original].amount,6);
 assert.notEqual(split.item.serial,original);
 assert.equal(split.item.parent,E.CHEST);
 assert.equal(split.world.characters['1'].inventory.herbs,6);
 E.counts(split.world);W.validateWorld(split.world);
 const recovered=G.apply(split.world,{action:'move_item',
   serial:split.item.serial,quantity:4,destination:E.PACK});
 assert.equal(recovered.item.serial,split.item.serial,'Chest does not recreate the item');
 assert.equal(recovered.world.characters['1'].inventory.herbs,10);
 const outdoor=structuredClone(recovered.world);outdoor.characters['1'].area_id=R.COURT;
 outdoor.characters['1'].x=20;outdoor.characters['1'].y=30;syncAll(outdoor);
 E.reconcile(outdoor);
 const dropped=G.apply(outdoor,{action:'move_item',serial:recovered.item.serial,
   quantity:4,destination:'ground'});
 assert.equal(dropped.item.serial,recovered.item.serial);
 assert.equal(dropped.item.parent,'ground_1');
 assert.equal(dropped.world.living.storage.ground.ground_1.quantity,4);
 const picked=G.apply(dropped.world,{action:'move_item',
   serial:recovered.item.serial,quantity:4,destination:E.PACK});
 assert.equal(picked.item.serial,recovered.item.serial);
 assert.equal(picked.world.living.storage.ground.ground_1,undefined);
 E.counts(picked.world);W.validateWorld(picked.world);
});
test('Legacy M9 ground transfers keep the item identity where possible',()=>{
 const w=fixture(),old=item(w,'herbs',E.PACK).serial;
 w.characters['1'].area_id=R.COURT;w.characters['1'].x=20;w.characters['1'].y=30;syncAll(w);
 const dropped=G.apply(w,{action:'drop_item',item_type:'herbs',quantity:10});
 E.reconcile(dropped.world);
 assert.equal(item(dropped.world,'herbs','ground_1').serial,old);
 const picked=G.apply(dropped.world,{action:'pick_up',drop_id:'ground_1'});
 E.reconcile(picked.world);E.counts(picked.world);
 assert.equal(item(picked.world,'herbs',E.PACK).serial,old);
});
test('M9 worlds migrate without deleting their inventory or any NPC history',()=>{
 const w=fixture(),npc=w.living.npcs.baker.name,old=w.characters['1'].inventory.herbs;
 delete w.entity_registry;
 assert.equal(E.reconcile(w),true);
 assert.equal(w.characters['1'].inventory.herbs,old);
 assert.equal(w.living.npcs.baker.name,npc);
 assert.equal(E.reconcile(w),false);
 E.counts(w);W.validateWorld(w);
});
test('Chest and bank require physical presence; no remote or forged item movement',()=>{
 const w=fixture(),serial=item(w,'herbs',E.PACK).serial;
 assert.throws(()=>G.apply(w,{action:'move_item',serial,quantity:5,
    destination:E.CHEST,reward:10000}),/Invalid item transfer/);
 const far=structuredClone(w);far.characters['1'].x=5;far.characters['1'].y=5;
 assert.throws(()=>G.apply(far,{action:'move_item',serial,quantity:1,destination:E.CHEST}),
   /beside the village chest/);
 assert.throws(()=>G.apply(far,{action:'move_item',serial,quantity:1,destination:E.VAULT}),
   /Visit the Village Bank/);
 const ghost=structuredClone(w);ghost.characters['1'].form='ghost';ghost.characters['1'].opening_state='complete';
 assert.throws(()=>G.apply(ghost,{action:'move_item',serial,quantity:1,destination:E.CHEST}),
   /Ghosts/);
 assert.throws(()=>G.apply(w,{action:'move_item',serial,quantity:21,destination:E.CHEST}),
   /Invalid transfer quantity/);
});
test('Character equipment moves as the same item rather than becoming a new item',()=>{
 const w=fixture(),serial=item(w,'tools',E.PACK).serial;
 let result=G.apply(w,{action:'equip',item_type:'tools'});E.reconcile(result.world);
 assert.equal(item(result.world,'tools',E.HAND).serial,serial);
 result=G.apply(result.world,{action:'unequip',slot:'hand'});E.reconcile(result.world);
 assert.equal(item(result.world,'tools',E.PACK).serial,serial);
});
test('Corrupt duplicate serials and orphaned item references are rejected',()=>{
 const w=fixture(),old=item(w,'herbs',E.PACK);
 w.entity_registry.items.ent_999={...old,serial:'ent_999'};
 assert.throws(()=>E.validate(w),/counter has gone backwards|Invalid or reused|capacity/);
 delete w.entity_registry.items.ent_999;
 old.parent='ground_999';
 assert.throws(()=>E.validate(w),/Orphaned entity item/);
});
test('Server HTTP exposes own items, nearby sectors, and saves transfers across restart',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dk-m10-registry-'));
 const initial=fixture();
 await fs.writeFile(path.join(dir,'world.json'),JSON.stringify(initial));
 const app=await createDKServer({dataDir:dir,port:0,now:()=>NOW});
 t.after(async()=>{if(app.server.listening)await app.close();await fs.rm(dir,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+app.address.port;
 const itemsRes=await fetch(base+'/api/v1/entities/items');
 assert.equal(itemsRes.status,200);
 const owned=(await itemsRes.json()).items;
 const herb=owned.find(i=>i.parent===E.PACK&&i.type==='herbs');
 assert(herb?.serial);
 const around=await(await fetch(base+'/api/v1/nearby?radius=8')).json();
 assert.equal(around.area_id,R.VILLAGE);
 assert(around.entities.some(e=>e.kind==='chest'&&e.id===E.CHEST));
 assert.equal((await fetch(base+'/api/v1/nearby?radius=33')).status,422);
 const response=await fetch(base+'/api/v1/gameplay',{method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({action:'move_item',serial:herb.serial,
    quantity:10,destination:E.CHEST})});
 assert.equal(response.status,200);
 const saved=JSON.parse(await fs.readFile(path.join(dir,'world.json'),'utf8'));
 assert.equal(saved.entity_registry.items[herb.serial].parent,E.CHEST);
 assert.equal(saved.characters['1'].inventory.herbs,0);
 await app.close();
 const restarted=await createDKServer({dataDir:dir,port:0,now:()=>NOW+86400000});
 try{
  assert.equal(restarted.world.entity_registry.items[herb.serial].parent,E.CHEST);
  E.counts(restarted.world);
 }finally{await restarted.close();}
});
