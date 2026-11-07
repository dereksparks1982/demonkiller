'use strict';
const {syncAll}=require('./helpers/sync-fixture.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const W=require('../server/world.cjs'),E=require('../server/entity-registry-m10.cjs');
const G=require('../server/gameplay.cjs');
const I=require('../server/item-interactions-m27.cjs');
const {createDKServer}=require('../server/dk-server.cjs');
const {VILLAGE,COURT}=require('../server/regions.cjs');
const NOW=Date.UTC(2026,10,7,18);
function fixture(){
 const w=W.createCharacter(W.makeWorld(NOW),1,'ELIAS',NOW).world,c=w.characters['1'];
 c.form='living';c.opening_state='resurrected';c.crystal_spent=true;
 c.area_id=VILLAGE;c.x=54;c.y=103;
 for(const type of E.ITEM_TYPES)c.inventory[type]=0;
 c.inventory.herbs=48;c.inventory.tools=2;c.inventory.torches=2;
 c.crafting.hunger=35;
 w.living.businesses.village_bank.open=true;
 syncAll(w);E.reconcile(w);E.counts(w);W.validateWorld(w);
 return w;
}
const found=(w,parent,type)=>Object.values(w.entity_registry.items)
 .find(i=>i.parent===parent&&i.type===type);
const command=(w,action,values)=>G.apply(w,{action,...values});
test('M28 moves a 48-item stack to vault, splits in place and merges without copying',()=>{
 const w=fixture(),serial=found(w,E.PACK,'herbs').serial,original=JSON.stringify(w);
 const deposited=command(w,'move_stack',{serial,destination:E.VAULT});
 assert.equal(JSON.stringify(w),original,'source world must not mutate');
 assert.equal(found(deposited.world,E.VAULT,'herbs').serial,serial);
 assert.equal(deposited.world.characters['1'].inventory.herbs,0);
 assert.equal(deposited.world.living.storage.vaults['1'].herbs,48);
 const snapshot=I.backpack(deposited.world);
 assert(snapshot.containers.some(c=>c.id===E.VAULT&&c.used>=48));
 const partial=command(deposited.world,'split_stack',{serial,quantity:20});
 const halves=partial.world&&Object.values(partial.world.entity_registry.items)
   .filter(i=>i.parent===E.VAULT&&i.type==='herbs');
 assert.equal(halves.length,2);
 assert.equal(halves.reduce((n,i)=>n+i.amount,0),48);
 const created=halves.find(i=>i.serial!==serial).serial;
 const combined=command(partial.world,'combine_stacks',{source_serial:created,target_serial:serial});
 assert.equal(found(combined.world,E.VAULT,'herbs').amount,48);
 assert.equal(combined.world.entity_registry.items[created],undefined);
 const withdrawn=command(combined.world,'move_stack',{serial,destination:E.PACK});
 assert.equal(found(withdrawn.world,E.PACK,'herbs').serial,serial);
 assert.equal(withdrawn.world.characters['1'].inventory.herbs,48);
 E.counts(withdrawn.world);W.validateWorld(withdrawn.world);
});
test('M28 direct equipment actions preserve the exact worn serial on return',()=>{
 const w=fixture(),tool=found(w,E.PACK,'tools');
 const worn=command(w,'equip_item',{serial:tool.serial}),hand=I.backpack(worn.world).equipment.hand;
 assert.equal(hand.type,'tools');assert.equal(hand.amount,1);
 assert.equal(worn.world.characters['1'].crafting.hand,'tools');
 assert.equal(worn.event.type,'item.equipped');
 assert.notEqual(tool.serial,hand.serial,'a partial stack gets a distinct worn serial');
 const removed=command(worn.world,'unequip_item',{serial:hand.serial});
 assert.equal(removed.world.entity_registry.items[hand.serial].parent,E.PACK);
 assert.equal(removed.world.characters['1'].crafting.hand,null);
 assert.equal(removed.event.type,'item.unequipped');
 const torch=found(removed.world,E.PACK,'torches');
 const lit=command(removed.world,'equip_item',{serial:torch.serial});
 const light=I.backpack(lit.world).equipment.light;
 assert(light?.serial);assert.equal(lit.world.characters['1'].crafting.light,'torches');
 assert(lit.world.characters['1'].crafting.torch_until_minute>lit.world.living.minute);
 const extinguished=command(lit.world,'unequip_item',{serial:light.serial});
 assert.equal(extinguished.world.characters['1'].crafting.light,null);
 assert.equal(extinguished.world.characters['1'].crafting.torch_until_minute,-1);
 E.counts(extinguished.world);W.validateWorld(extinguished.world);
});
test('M28 vault cannot be inspected, split or moved remotely; spoofing is rejected',()=>{
 const w=fixture(),serial=found(w,E.PACK,'herbs').serial;
 const stored=command(w,'move_stack',{serial,destination:E.VAULT}).world;
 const far=structuredClone(stored);far.characters['1'].x=8;far.characters['1'].y=8;
 const snapshot=I.backpack(far);
 assert(!snapshot.containers.some(c=>c.id===E.VAULT));
 assert.throws(()=>command(far,'split_stack',{serial,quantity:10}),/accessible/);
 assert.throws(()=>command(far,'move_stack',{serial,destination:E.PACK}),/accessible/);
 assert.throws(()=>command(far,'unequip_item',{serial}),/accessible/);
 const before=JSON.stringify(far);
 assert.throws(()=>command(far,'move_stack',{serial,destination:E.CHEST,quantity:500}),/Invalid item action/);
 assert.equal(JSON.stringify(far),before);
});
test('M28 house, village chest and ground transfers enforce actual access',()=>{
 const w=fixture(),serial=found(w,E.PACK,'herbs').serial;
 const chest=command(w,'move_stack',{serial,destination:E.CHEST});
 assert.equal(chest.world.entity_registry.items[serial].parent,E.CHEST);
 const far=structuredClone(chest.world);far.characters['1'].x=8;far.characters['1'].y=8;
 assert(!I.backpack(far).containers.some(c=>c.id===E.CHEST));
 assert.throws(()=>command(far,'move_stack',{serial,destination:E.PACK}),/accessible/);
 const retrieved=command(chest.world,'move_stack',{serial,destination:E.PACK});
 const yard=structuredClone(retrieved.world),char=yard.characters['1'];
 char.area_id=COURT;char.x=20;char.y=30;syncAll(yard);E.reconcile(yard);
 const dropped=command(yard,'move_stack',{serial,destination:'ground'});
 assert(dropped.world.entity_registry.items[serial].parent.startsWith('ground_'));
 assert.equal(dropped.world.characters['1'].inventory.herbs,0);
 E.counts(dropped.world);W.validateWorld(dropped.world);
 const house=structuredClone(retrieved.world);
 const deed=house.living.housing.records.courtyard_house_se;
 deed.owner={kind:'player',slot:1};
 house.characters['1'].area_id=deed.area_id;
 house.characters['1'].x=deed.door_x;
 house.characters['1'].y=deed.door_y;
 syncAll(house);E.reconcile(house);
 const storageId=deed.storage_id;
 assert(I.backpack(house).containers.some(c=>c.id===storageId));
 const transferred=command(house,'move_stack',{serial,destination:storageId});
 assert.equal(transferred.world.entity_registry.items[serial].parent,storageId);
 E.counts(transferred.world);W.validateWorld(transferred.world);
});
test('M28 full backpack denies equipment return and leaves the original world unchanged',()=>{
 const w=fixture(),item=found(w,E.PACK,'tools');
 const worn=command(w,'equip_item',{serial:item.serial}).world;
 const hand=I.backpack(worn).equipment.hand.serial;
 const full=structuredClone(worn);
 full.characters['1'].inventory.herbs=196;
 full.characters['1'].inventory.tools=2;
 full.characters['1'].inventory.torches=2;
 E.reconcile(full);E.counts(full);
 const before=JSON.stringify(full);
 assert.throws(()=>command(full,'unequip_item',{serial:hand}),/full/);
 assert.equal(JSON.stringify(full),before);
});
test('M28 server item ownership survives actual world.json reload',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dk-m28-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 await fs.writeFile(path.join(dir,'world.json'),JSON.stringify(fixture()));
 const app=await createDKServer({dataDir:dir,port:0,now:()=>NOW});
 t.after(async()=>{if(app.server.listening)await app.close();});
 const base='http://127.0.0.1:'+app.address.port;
 const first=await (await fetch(base+'/api/v1/inventory')).json();
 const serial=first.backpack.find(i=>i.type==='herbs').serial;
 const response=await fetch(base+'/api/v1/gameplay',{method:'POST',
  headers:{'content-type':'application/json'},
  body:JSON.stringify({action:'move_stack',serial,destination:E.VAULT})});
 assert.equal(response.status,200);
 const saved=JSON.parse(await fs.readFile(path.join(dir,'world.json'),'utf8'));
 assert.equal(saved.entity_registry.items[serial].parent,E.VAULT);
 assert.equal(saved.characters['1'].inventory.herbs,0);
 await app.close();
 const restored=await createDKServer({dataDir:dir,port:0,now:()=>NOW+8000});
 try{
  const snapshot=I.backpack(restored.world);
  assert.equal(snapshot.containers.find(c=>c.id===E.VAULT).items[0].serial,serial);
  E.counts(restored.world);W.validateWorld(restored.world);
 }finally{await restored.close();}
});

test('M28 concurrent stale transfers cannot duplicate a world item',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dk-m28-race-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 await fs.writeFile(path.join(dir,'world.json'),JSON.stringify(fixture()));
 const app=await createDKServer({dataDir:dir,port:0,now:()=>NOW});
 t.after(()=>app.server.listening?app.close():Promise.resolve());
 const base='http://127.0.0.1:'+app.address.port;
 const snapshot=await (await fetch(base+'/api/v1/inventory')).json();
 const serial=snapshot.backpack.find(i=>i.type==='herbs').serial;
 const post=()=>fetch(base+'/api/v1/gameplay',{method:'POST',
  headers:{'content-type':'application/json'},
  body:JSON.stringify({action:'move_stack',serial,destination:E.VAULT})});
 const results=await Promise.all([post(),post()]);
 assert.deepEqual(results.map(x=>x.status).sort(),[200,409]);
 const saved=JSON.parse(await fs.readFile(path.join(dir,'world.json'),'utf8'));
 assert.equal(saved.entity_registry.items[serial].amount,48);
 assert.equal(saved.entity_registry.items[serial].parent,E.VAULT);
 assert.equal(saved.characters['1'].inventory.herbs,0);
 assert.equal(saved.living.storage.vaults['1'].herbs,48);
 E.counts(saved);W.validateWorld(saved);
});
