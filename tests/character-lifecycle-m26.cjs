'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const W=require('../server/world.cjs'),E=require('../server/entity-registry-m10.cjs');
const {deleteCharacter}=require('../server/character-lifecycle-m26.cjs');
const {createDKServer}=require('../server/dk-server.cjs');
const NOW=Date.UTC(2026,10,7);
function fixture(){
 const world=W.createCharacter(W.makeWorld(NOW),1,'ELIAS',NOW).world;
 const c=world.characters['1'],l=world.living,r=world.entity_registry;
 c.inventory.herbs=4;c.crafting.hand='tools';c.gold=100;c.bank_gold=70;
 l.storage.vaults['1'].ore=5;
 l.social.reputation.town=35;
 l.law.player.fines=12;
 const house=l.housing.records.courtyard_house_se;
 house.owner={kind:'player',slot:1};house.public=false;house.locked=true;
 for(const parent of [E.CHEST,house.storage_id]){
  const serial='ent_'+r.next_serial++;
  r.items[serial]={serial,kind:'item',type:'wood',amount:2,parent,created_minute:l.minute};
 }
 E.reconcile(world);E.counts(world);W.validateWorld(world);
 return world;
}
test('M26 removes only one character and its possessions, without resetting the world',()=>{
 const original=fixture(),before=structuredClone(original);
 const oldSerial=original.entity_registry.refs['player:1'].serial;
 const result=deleteCharacter(original,1,'ELIAS'),w=result.world,l=w.living;
 assert.deepEqual(original,before,'delete is a pure world transition until committed');
 assert.equal(w.characters['1'],undefined);
 assert.equal(w.world_id,original.world_id);
 assert.equal(w.clock_anchor_utc,original.clock_anchor_utc);
 assert.equal(w.living.minute,original.living.minute);
 assert.deepEqual(w.living.npcs,original.living.npcs);
 assert.deepEqual(w.living.businesses,original.living.businesses);
 assert.deepEqual(w.living.territories,original.living.territories);
 assert.equal(w.revision,original.revision+1);
 assert.equal(w.entity_registry.refs['player:1'],undefined);
 const deadParents=new Set([E.PACK,E.VAULT,E.HAND,E.LIGHT,E.CHEST,
  'home_storage_courtyard_house_se']);
 assert.equal(Object.values(w.entity_registry.items).some(item=>deadParents.has(item.parent)),false);
 assert.equal(w.living.storage.vaults['1'].ore,0);
 assert.equal(l.social.reputation.town,0);
 assert.deepEqual(l.social.contacts,{});
 assert.deepEqual(l.social.contracts,{});
 assert.equal(l.law.player.fines,0);
 assert.equal(l.mail.boxes['1'].length,0);
 assert.equal(l.mail.outbound.filter(letter=>letter.to_slot===1).length,0);
 assert.equal(l.housing.records.courtyard_house_se.owner,null);
 assert.equal(l.housing.records.courtyard_house_se.public,true);
 assert.equal(result.event.character_serial,oldSerial);
 assert.equal(result.event.type,'player.deleted');
 E.counts(w);W.validateWorld(w);
 const replacement=W.createCharacter(w,1,'BRIDGET',NOW+12345).world;
 assert.equal(replacement.characters['1'].name,'BRIDGET');
 assert.notEqual(replacement.entity_registry.refs['player:1'].serial,oldSerial);
 assert.equal(replacement.characters['1'].gold,5);
 assert.equal(replacement.characters['1'].inventory.herbs,0);
 assert.equal(replacement.living.npcs.baker.name,original.living.npcs.baker.name);
 assert.equal(replacement.living.housing.records.courtyard_house_se.owner,null);
 E.counts(replacement);W.validateWorld(replacement);
});
test('M26 refuses wrong name, missing slot and invalid commands without mutation',()=>{
 const world=fixture(),before=JSON.stringify(world);
 assert.throws(()=>deleteCharacter(world,0,'ELIAS'),/Invalid character slot/);
 assert.throws(()=>deleteCharacter(world,1,'OTHER'),/name confirmation does not match/);
 assert.equal(JSON.stringify(world),before);
 const next=deleteCharacter(world,1,'ELIAS').world;
 assert.throws(()=>deleteCharacter(next,1,'ELIAS'),/Empty character slot/);
});
async function request(base,method,payload,control){
 const headers={'content-type':'application/json'};
 if(control)headers['x-dk-control']=control;
 return fetch(base+'/api/v1/characters/1',{method,headers,body:JSON.stringify(payload)});
}
test('M26 HTTP DELETE requires explicit control, preserves persisted world and permits a fresh character',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dk-server-m26-'));
 t.after(async()=>{if(app.server.listening)await app.close();await fs.rm(dir,{recursive:true,force:true});});
 const app=await createDKServer({dataDir:dir,port:0,now:()=>NOW});
 
 const base='http://127.0.0.1:'+app.address.port;
 let created=await fetch(base+'/api/v1/characters',{method:'POST',
  headers:{'content-type':'application/json'},body:JSON.stringify({slot:1,name:'ELIAS'})});
 assert.equal(created.status,201);
 const first=(await created.json()).character;
 assert.equal((await request(base,'DELETE',{name:'ELIAS',confirm:'DELETE'})).status,403);
 assert.equal((await request(base,'DELETE',{name:'OTHER',confirm:'DELETE'},'delete-character')).status,409);
 assert.equal((await request(base,'DELETE',{name:'ELIAS',confirm:'NO'},'delete-character')).status,422);
 assert.equal((await fetch(base+'/api/v1/characters/1')).status,200);
 const deleted=await request(base,'DELETE',{name:'ELIAS',confirm:'DELETE'},'delete-character');
 assert.equal(deleted.status,200);
 assert.equal((await deleted.json()).deleted,true);
 assert.equal((await fetch(base+'/api/v1/characters/1')).status,404);
 const saved=JSON.parse(await fs.readFile(path.join(dir,'world.json'),'utf8'));
 assert.equal(saved.characters['1'],undefined);
 assert.equal(saved.world_id,'dk.world.001');
 assert.ok(saved.living.npcs.baker);
 W.validateWorld(saved);
 const status=await (await fetch(base+'/api/v1/save/status')).json();
 assert.ok(status.backup_count>=1);
 created=await fetch(base+'/api/v1/characters',{method:'POST',
  headers:{'content-type':'application/json'},body:JSON.stringify({slot:1,name:'NEWLIFE'})});
 assert.equal(created.status,201);
 assert.notEqual((await created.json()).character.created_at_utc,undefined);
 assert.equal((await request(base,'DELETE',{name:first.name,confirm:'DELETE'},'delete-character')).status,409);
});
