'use strict';
const {syncAll}=require('./helpers/sync-fixture.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const W=require('../server/world.cjs'),G=require('../server/gameplay.cjs');
const LAW=require('../server/law-m15.cjs');
const MOBILE=require('../server/mobile-assets-m12.cjs');
const R=require('../server/regions.cjs');
const L=require('../server/living-world.cjs');
const {createDKServer}=require('../server/dk-server.cjs');
const TIME=Date.UTC(2026,10,6);
function fixture(witness=true){
 const w=W.createCharacter(W.makeWorld(TIME),1,'ELIAS',TIME).world;
 const victim=w.living.npcs.baker,player=w.characters['1'];
 Object.assign(player,{area_id:R.VILLAGE,x:victim.x,y:victim.y,
   form:'living',opening_state:'resurrected'});
 if(witness){const guard=w.living.npcs.guard_north;
   guard.x=victim.x;guard.y=victim.y;guard.area_id=R.VILLAGE;}
 victim.alive=false;
 const corpse=MOBILE.onDeath(w,victim,0,[]);
 syncAll(w);
 return {w,corpse};
}
test('M15 migrates old world state and validates guarded-region justice records',()=>{
 const {w}=fixture(false),bank=w.living.businesses.village_bank.coins;
 assert.equal(LAW.ensure(w),false);
 delete w.living.law;
 assert.equal(LAW.ensure(w),true);
 assert.equal(LAW.ensure(w),false);
 assert.equal(w.living.businesses.village_bank.coins,bank);
 assert.doesNotThrow(()=>W.validateWorld(w));
});
test('Nearby living witnesses report corpse theft and the village remembers it',()=>{
 const {w,corpse}=fixture();
 const result=G.apply(w,{action:'loot_corpse',corpse_id:corpse.id});
 assert.equal(result.world.living.law.player.fines,12);
 assert.equal(result.world.living.law.player.heat,20);
 assert.equal(result.world.living.social.reputation.town,-5);
 assert.equal(result.world.living.law.cases.case_1.reported,true);
 assert.deepEqual(result.world.living.law.cases.case_1.witnesses,['guard_north']);
 assert.deepEqual(result.events.map(e=>e.type),
   ['corpse.looted','law.crime.reported']);
 assert.equal(w.living.law.player.fines,0,'Old state is not mutated');
 assert.doesNotThrow(()=>W.validateWorld(result.world));
});
test('No witness means no magical accusation, no fine and no automatic warrant',()=>{
 const {w,corpse}=fixture(false);
 const result=G.apply(w,{action:'loot_corpse',corpse_id:corpse.id});
 assert.equal(result.world.living.law.player.fines,0);
 assert.equal(result.world.living.law.cases.case_1.reported,false);
 assert.equal(result.world.living.law.player.wanted_until_minute,-1);
 assert.equal(result.events.at(-1).type,'law.crime.unwitnessed');
 assert.equal(result.world.living.social.reputation.town,0);
});
test('A fallen monster-held settlement is no longer enforcing ordinary village law',()=>{
 const {w,corpse}=fixture(true);
 w.living.territories[R.VILLAGE].control='monsters';
 const result=G.apply(w,{action:'loot_corpse',corpse_id:corpse.id});
 assert.equal(result.world.living.law.player.fines,0);
 assert.equal(Object.keys(result.world.living.law.cases).length,0);
 assert.equal(result.events.length,1);
});
test('Guards take actual outstanding fines, transferring money to the bank once',()=>{
 const {w,corpse}=fixture(true);
 const stolen=G.apply(w,{action:'loot_corpse',corpse_id:corpse.id}).world;
 const initialBank=stolen.living.businesses.village_bank.coins;
 const initialGold=stolen.characters['1'].gold;
 assert.equal(initialGold,25);
 stolen.living.minute=5;
 const events=[];
 LAW.tick(stolen,5,events);
 assert.equal(stolen.characters['1'].gold,initialGold-12);
 assert.equal(stolen.living.businesses.village_bank.coins,initialBank+12);
 assert.equal(stolen.living.law.player.fines,0);
 assert.equal(stolen.living.law.player.citations,1);
 assert.equal(events[0].type,'law.guard.intervention');
 LAW.tick(stolen,10,events);
 assert.equal(stolen.living.law.player.citations,1);
 W.validateWorld(stolen);
});
test('Unpaid fines cause a bounded detention, not permanent character deletion',()=>{
 const {w,corpse}=fixture(true);
 const stolen=G.apply(w,{action:'loot_corpse',corpse_id:corpse.id}).world;
 stolen.characters['1'].gold=0;
 const e=[];LAW.tick(stolen,5,e);
 assert.equal(stolen.living.law.player.fines,12);
 assert.equal(stolen.living.law.player.detained_until_minute,65);
 assert.equal(stolen.living.law.player.citations,1);
 assert.equal(stolen.characters['1'].form,'living');
 LAW.tick(stolen,10,e);
 assert.equal(stolen.living.law.player.citations,1);
});
test('Fines are paid only at an open bank with real gold, with no minting',()=>{
 const {w,corpse}=fixture(true);
 const stolen=G.apply(w,{action:'loot_corpse',corpse_id:corpse.id}).world;
 const player=stolen.characters['1'],bank=stolen.living.businesses.village_bank;
 const gold=player.gold,money=bank.coins;
 Object.assign(player,{x:54,y:103});syncAll(stolen);bank.open=true;
 const paid=G.apply(stolen,{action:'pay_fine',amount:12});
 assert.equal(paid.character.gold,gold-12);
 assert.equal(paid.world.living.businesses.village_bank.coins,money+12);
 assert.equal(paid.world.living.law.player.fines,0);
 assert.equal(paid.world.living.law.player.wanted_until_minute,-1);
 assert.equal(paid.event.type,'law.fine.paid');
 assert.throws(()=>G.apply(paid.world,{action:'pay_fine',amount:1}),/No outstanding/);
 assert.doesNotThrow(()=>W.validateWorld(paid.world));
});
test('Remote, fake, paused and ghost fines are rejected by server authority',()=>{
 const {w,corpse}=fixture(true);
 const stolen=G.apply(w,{action:'loot_corpse',corpse_id:corpse.id}).world;
 assert.throws(()=>G.apply(stolen,{action:'pay_fine',amount:12,reward:1000}),/Invalid/);
 assert.throws(()=>G.apply(stolen,{action:'pay_fine',amount:12}),/Visit/);
 const ghost=structuredClone(stolen);ghost.characters['1'].form='ghost';
 ghost.characters['1'].opening_state='complete';
 assert.throws(()=>G.apply(ghost,{action:'pay_fine',amount:1}),/Ghosts/);
 const paused=structuredClone(stolen);paused.runtime.running=false;
 assert.throws(()=>G.apply(paused,{action:'pay_fine',amount:1}),/paused/);
});
test('Read-only law status and fine payment survive server restart',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dk-m15-law-'));
 t.after(async()=>{if(app.server.listening)await app.close();await fs.rm(dir,{recursive:true,force:true});});
 const {w,corpse}=fixture(true);
 const stolen=G.apply(w,{action:'loot_corpse',corpse_id:corpse.id}).world;
 Object.assign(stolen.characters['1'],{x:54,y:103});
 syncAll(stolen);
 stolen.living.businesses.village_bank.open=true;
 await fs.writeFile(path.join(dir,'world.json'),JSON.stringify(stolen));
 const app=await createDKServer({dataDir:dir,port:0,now:()=>TIME});

 const base='http://127.0.0.1:'+app.address.port;
 const status=await fetch(base+'/api/v1/law');
 assert.equal(status.status,200);
 assert.equal((await status.json()).player.fines,12);
 const response=await fetch(base+'/api/v1/gameplay',{method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({action:'pay_fine',amount:12})});
 assert.equal(response.status,200);
 const disk=JSON.parse(await fs.readFile(path.join(dir,'world.json'),'utf8'));
 assert.equal(disk.living.law.player.fines,0);
 assert.equal((await fetch(base+'/api/v1/law',{method:'POST',
  headers:{'Content-Type':'application/json'},body:'{}'})).status,405);
 await app.close();
});
