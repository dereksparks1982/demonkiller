'use strict';
const {syncAll}=require('./helpers/sync-fixture.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const W=require('../server/world.cjs'),S=require('../server/social-m6.cjs');
const {createDKServer}=require('../server/dk-server.cjs');
const {VILLAGE}=require('../server/regions.cjs');
const ORIGIN=Date.UTC(2026,10,6);
function fixture(){
 let world=W.makeWorld(ORIGIN);
 world=W.createCharacter(world,1,'DEREK',ORIGIN).world;
 const c=world.characters['1'];
 c.form='living';c.opening_state='resurrected';
 c.area_id=VILLAGE;c.x=87;c.y=101;
 const baker=world.living.npcs.baker;
 baker.x=87;baker.y=101;baker.area_id=VILLAGE;
 world.living.businesses.village_bakery.open=true;
 c.inventory.wood=4;
 syncAll(world);
 return world;
}
test('M6 social state loads in new worlds; validated backward-compatible upgrade',()=>{
 const world=W.makeWorld(ORIGIN);
 assert.equal(S.ensureSocial(world),false);
 assert.doesNotThrow(()=>W.validateWorld(world));
 delete world.living.social;
 assert.equal(S.ensureSocial(world),true);
 assert.equal(S.ensureSocial(world),false);
 assert.doesNotThrow(()=>W.validateWorld(world));
});

test('NPC conversation is physical; contacts and reputation persist with cooldown',()=>{
 let world=fixture();
 let result=S.apply(world,{action:'talk',npc_id:'baker'});
 assert.match(result.dialogue.line,/firewood/);
 assert.equal(result.reputation_delta,1);
 assert.equal(result.world.living.social.reputation.town,1);
 assert.equal(world.living.social.reputation.town,0,'Old world remains immutable');
 result=S.apply(result.world,{action:'talk',npc_id:'baker'});
 assert.equal(result.reputation_delta,0,'Repeat clicks must not farm reputation');
 assert.equal(result.world.living.social.contacts.baker.meetings,1);
 assert.doesNotThrow(()=>W.validateWorld(result.world));
 result.world.characters['1'].x=1;
 assert.throws(()=>S.apply(result.world,{action:'talk',npc_id:'baker'}),/closer/);
});

test('real merchant commission is accepted in person, goods and gold change atomically',()=>{
 let world=fixture();
 let first=S.apply(world,{action:'accept_contract',business_id:'village_bakery'});
 assert.equal(first.contract.item_type,'wood');
 assert.equal(first.contract.quantity,4);
 assert.equal(first.contract.reward,16);
 assert.throws(()=>S.apply(first.world,{action:'accept_contract',business_id:'village_bakery'}),/current commission/);
 const beforeGold=first.world.characters['1'].gold;
 const beforeStock=first.world.living.businesses.village_bakery.stock;
 const delivered=S.apply(first.world,{action:'complete_contract',contract_id:first.contract.id});
 assert.equal(delivered.character.inventory.wood,0);
 assert.equal(delivered.character.gold,beforeGold+16);
 assert.equal(delivered.world.living.businesses.village_bakery.stock,beforeStock+4);
 assert.equal(delivered.world.living.social.reputation.town,5);
 assert.equal(delivered.contract.status,'completed');
 assert.throws(()=>S.apply(delivered.world,{action:'complete_contract',contract_id:first.contract.id}),/not active/);
 assert.doesNotThrow(()=>W.validateWorld(delivered.world));
});

test('contract rejects remote player, fake rewards, empty goods, and ghost trading',()=>{
 let world=fixture();
 assert.throws(()=>S.apply(world,{action:'accept_contract',business_id:'village_bakery',reward:999}),/Invalid/);
 const accepted=S.apply(world,{action:'accept_contract',business_id:'village_bakery'}).world;
 accepted.characters['1'].inventory.wood=0;
 assert.throws(()=>S.apply(accepted,{action:'complete_contract',contract_id:'contract_1'}),/required goods/);
 accepted.characters['1'].form='ghost';accepted.characters['1'].opening_state='complete';
 assert.throws(()=>S.apply(accepted,{action:'talk',npc_id:'baker'}),/Ghosts/);
});

test('commissions expire on authoritative time; expired commissions cannot pay',()=>{
 const accepted=S.apply(fixture(),{action:'accept_contract',business_id:'village_bakery'}).world;
 accepted.living.minute=721;
 const events=[];
 S.tick(accepted,721,events);
 assert.equal(accepted.living.social.contracts.contract_1.status,'expired');
 assert.equal(events.length,1);
 assert.throws(()=>S.apply(accepted,{action:'complete_contract',contract_id:'contract_1'}),/not active/);
});

test('HTTP social read and write routes persist NPC conversations',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dk-social-m6-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 let world=fixture();world.runtime.running=true;
 await fs.writeFile(path.join(dir,'world.json'),JSON.stringify(world));
 const app=await createDKServer({dataDir:dir,port:0,now:()=>ORIGIN});
 t.after(()=>app.server.listening?app.close():Promise.resolve());
 const base='http://127.0.0.1:'+app.address.port;
 const get=await fetch(base+'/api/v1/social');
 assert.equal(get.status,200);
 assert(get.ok);
 const post=await fetch(base+'/api/v1/social',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'talk',npc_id:'baker'})});
 assert.equal(post.status,200);
 const data=await post.json();
 assert.equal(data.reputation_delta,1);
 const persisted=JSON.parse(await fs.readFile(path.join(dir,'world.json'),'utf8'));
 assert.equal(persisted.living.social.contacts.baker.meetings,1);
 await app.close();
});
