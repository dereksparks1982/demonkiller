'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const W=require('../server/world.cjs'),R=require('../server/entity-registry-m10.cjs');
const M=require('../server/item-interactions-m27.cjs');
const {createDKServer}=require('../server/dk-server.cjs');
const NOW=Date.UTC(2026,10,7,12);
function fixture(){
 const w=W.createCharacter(W.makeWorld(NOW),1,'ELIAS',NOW).world;
 const c=w.characters['1'];c.form='living';c.opening_state='resurrected';c.crystal_spent=true;
 c.crafting.hunger=30;c.crafting.health=65;
 for(const type of R.ITEM_TYPES)c.inventory[type]=0;
 c.inventory.bread=4;c.inventory.tools=2;c.inventory.bandages=3;
 R.reconcile(w);R.counts(w);W.validateWorld(w);
 return w;
}
function serial(w,type){return M.backpack(w).backpack.find(i=>i.type===type)?.serial;}
test('M27 snapshot exposes only the owner backpack and worn equipment',()=>{
 const w=fixture(),data=M.backpack(w);
 assert.equal(data.character,'ELIAS');assert.equal(data.used,9);
 assert.equal(data.backpack.find(i=>i.type==='bread').amount,4);
 assert.equal(data.equipment.hand,null);
 assert.equal(data.capacity,200);
 assert.equal(data.backpack.some(i=>i.parent==='npc_pack'),false);
});
test('M27 splits and combines individual serials without duplication or lost goods',()=>{
 const w=fixture(),initial=serial(w,'bread'),saved=JSON.stringify(w);
 const split=M.take(w,{action:'split_stack',serial:initial,quantity:2});
 assert.equal(JSON.stringify(w),saved,'input world stays immutable');
 assert.equal(split.event.type,'item.split');
 const partial=M.backpack(split.world).backpack.filter(i=>i.type==='bread');
 assert.equal(partial.length,2);
 assert.equal(partial.reduce((n,i)=>n+i.amount,0),4);
 const fresh=partial.find(i=>i.serial!==initial);
 const merged=M.take(split.world,{action:'combine_stacks',source_serial:fresh.serial,target_serial:initial});
 const output=M.backpack(merged.world).backpack.filter(i=>i.type==='bread');
 assert.deepEqual(output,[{serial:initial,type:'bread',amount:4}]);
 assert.ok(merged.world.entity_registry.next_serial>split.world.entity_registry.next_serial-1);
 assert.throws(()=>M.take(split.world,{action:'combine_stacks',source_serial:initial,target_serial:initial}),/incompatible/);
 R.counts(merged.world);W.validateWorld(merged.world);
});
test('M27 uses the exact clicked stack and preserves the other stack serial',()=>{
 const w=fixture(),first=serial(w,'bread');
 const split=M.take(w,{action:'split_stack',serial:first,quantity:1});
 const second=M.backpack(split.world).backpack.find(i=>i.type==='bread'&&i.serial!==first).serial;
 const consumed=M.take(split.world,{action:'use_item',serial:second});
 assert.equal(consumed.event.type,'player.consume');
 assert.equal(consumed.event.item_serial,second);
 assert.equal(consumed.world.entity_registry.items[second],undefined);
 assert.equal(consumed.world.entity_registry.items[first].amount,3);
 assert.equal(consumed.character.inventory.bread,3);
 assert.equal(consumed.character.crafting.hunger,45);
 R.counts(consumed.world);W.validateWorld(consumed.world);
});
test('M27 equips selected tool and preserves the stack in backpack',()=>{
 const w=fixture(),initial=serial(w,'tools');
 const equipped=M.take(w,{action:'use_item',serial:initial});
 assert.equal(equipped.event.type,'player.equip');
 assert.equal(equipped.character.crafting.hand,'tools');
 const gear=M.backpack(equipped.world).equipment.hand;
 assert.equal(gear.type,'tools');assert.equal(gear.amount,1);
 assert.equal(equipped.world.entity_registry.items[initial].amount,1);
 assert.notEqual(gear.serial,initial,'split equip creates separate worn serial');
 R.counts(equipped.world);W.validateWorld(equipped.world);
});
test('M27 rejects forged, missing, inaccessible, incompatible and overlarge actions',()=>{
 const w=fixture(),s=serial(w,'bread'),before=JSON.stringify(w);
 for(const input of [
  {action:'use_item',serial:'ent_999999'},
  {action:'use_item',serial:'ent_foo'},
  {action:'use_item',serial:s,extra:1},
  {action:'split_stack',serial:s,quantity:4},
  {action:'split_stack',serial:s,quantity:-2},
  {action:'combine_stacks',source_serial:s,target_serial:serial(w,'tools')}
 ])assert.throws(()=>M.take(w,input));
 assert.equal(JSON.stringify(w),before);
 const ghost=structuredClone(w);ghost.characters['1'].form='ghost';
 assert.throws(()=>M.take(ghost,{action:'use_item',serial:s}),/Ghosts/);
 const paused=structuredClone(w);paused.runtime.running=false;
 assert.throws(()=>M.take(paused,{action:'use_item',serial:s}),/paused/);
});
test('M27 HTTP inventory endpoint is isolated to the local game',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dk-m27-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const app=await createDKServer({dataDir:dir,port:0,now:()=>NOW});
 t.after(()=>app.server.listening?app.close():Promise.resolve());
 const base='http://127.0.0.1:'+app.address.port;
 assert.equal((await fetch(base+'/api/v1/inventory')).status,404);
 const created=await fetch(base+'/api/v1/characters',{method:'POST',
  headers:{'Content-Type':'application/json'},body:JSON.stringify({slot:1,name:'ELIAS'})});
 assert.equal(created.status,201);
 const inventory=await fetch(base+'/api/v1/inventory');
 assert.equal(inventory.status,200);
 const payload=await inventory.json();
 assert.equal(payload.character,'ELIAS');assert.ok(Array.isArray(payload.backpack));
 assert.equal(payload.form,'ghost');
 const invalid=await fetch(base+'/api/v1/gameplay',{method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({action:'use_item',serial:'ent_999999'})});
 assert.equal(invalid.status,409);
});
