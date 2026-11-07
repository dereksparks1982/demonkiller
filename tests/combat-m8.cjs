'use strict';
const {syncAll}=require('./helpers/sync-fixture.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const W=require('../server/world.cjs'),G=require('../server/gameplay.cjs');
const Combat=require('../server/combat-m8.cjs'),R=require('../server/regions.cjs');
const {createDKServer}=require('../server/dk-server.cjs');
const ORIGIN=Date.UTC(2026,10,6);
function fixture(){
 let world=W.makeWorld(ORIGIN);
 world=W.createCharacter(world,1,'ELIAS',ORIGIN).world;
 const c=world.characters['1'];
 c.area_id=R.COURT;c.x=30;c.y=30;c.form='living';c.opening_state='resurrected';
 syncAll(world);
 return world;
}
function monsterFixture(count=1){
 const world=fixture(),events=[];
 world.living.territories[R.COURT].control='monsters';
 Combat.spawn(world,R.COURT,1,events,count);
 const creature=Object.values(world.living.combat.creatures)[0];
 assert(creature,'An imp was spawned');
 const c=world.characters['1'];c.x=creature.x;c.y=creature.y;
 return {world,creature,events};
}
test('M8 combat state validates and upgrades older world saves',()=>{
 const world=fixture();
 assert.equal(Combat.ensure(world),false);
 assert.doesNotThrow(()=>W.validateWorld(world));
 delete world.living.combat;
 assert.equal(Combat.ensure(world),true);
 assert.doesNotThrow(()=>W.validateWorld(world));
});
test('monster occupations produce distinct persistent imps on legal tiles',()=>{
 const world=fixture(),events=[];
 world.living.territories[R.COURT].control='monsters';
 Combat.tick(world,1,events);
 const imps=Object.values(world.living.combat.creatures);
 assert.equal(imps.length,3);
 assert.equal(new Set(imps.map(i=>i.id)).size,3);
 assert(imps.every(i=>i.area_id===R.COURT&&i.health===18));
 assert.doesNotThrow(()=>W.validateWorld(world));
});
test('melee attacks are physical, server-timed and cannot double-claim a kill',()=>{
 let {world,creature}=monsterFixture();
 world.characters['1'].crafting.hand='tools';
 let a=G.apply(world,{action:'attack',target_id:creature.id},1000);
 assert.equal(a.world.living.combat.creatures[creature.id].health,10);
 assert.equal(a.character.skills.combat,1);
 assert.equal(world.living.combat.creatures[creature.id].health,18,
  'The previous world remains immutable');
 assert.throws(()=>G.apply(a.world,{action:'attack',target_id:creature.id},1100),/wait/);
 a=G.apply(a.world,{action:'attack',target_id:creature.id},2100);
 assert.equal(a.world.living.combat.creatures[creature.id].health,2);
 a=G.apply(a.world,{action:'attack',target_id:creature.id},3200);
 assert.equal(a.world.living.combat.creatures[creature.id],undefined);
 assert.equal(a.world.living.territories[R.COURT].control,'settlers',
  'Killing the last occupying monster liberates the courtyard');
 assert.equal(Object.keys(a.world.living.combat.drops).length,1);
 assert(a.events.some(e=>e.type==='territory.liberated'));
 assert.throws(()=>G.apply(a.world,{action:'attack',target_id:creature.id},5000),/living monster/);
 assert.doesNotThrow(()=>W.validateWorld(a.world));
});
test('loot is a saved world item, transfers once and disappears when collected',()=>{
 let {world,creature}=monsterFixture();
 world.characters['1'].crafting.hand='tools';
 for(const t of [1000,2000,3000])
  world=G.apply(world,{action:'attack',target_id:creature.id},t).world;
 const drop=Object.values(world.living.combat.drops)[0];
 const before=world.characters['1'].gold;
 const found=G.apply(world,{action:'loot',drop_id:drop.id});
 assert.equal(found.character.gold,before+drop.gold);
 assert.equal(found.world.living.combat.drops[drop.id],undefined);
 assert.equal(found.character.inventory[drop.item],1);
 assert.throws(()=>G.apply(found.world,{action:'loot',drop_id:drop.id}),/ground loot/);
});
test('ghosts cannot fight, clients cannot forge rewards and distance is enforced',()=>{
 const {world,creature}=monsterFixture();
 assert.throws(()=>G.apply(world,{action:'attack',target_id:creature.id,damage:999}),/Invalid/);
 world.characters['1'].x=1;world.characters['1'].y=1;
 assert.throws(()=>G.apply(world,{action:'attack',target_id:creature.id}),/Move beside/);
 world.characters['1'].form='ghost';world.characters['1'].opening_state='complete';
 assert.throws(()=>G.apply(world,{action:'attack',target_id:creature.id}),/Ghosts/);
});
test('guards defend against monsters without player input',()=>{
 const world=fixture(),events=[];
 world.living.territories[R.VILLAGE].control='monsters';
 Combat.spawn(world,R.VILLAGE,1,events,1);
 const imp=Object.values(world.living.combat.creatures)[0];
 const guard=world.living.npcs.guard_north;
 imp.x=guard.x;imp.y=guard.y;
 Combat.tick(world,5,events);
 assert(guard.health<100,'Monster injured the guard');
 assert(imp.health<18,'Guard struck back');
 assert(events.some(e=>e.type==='monster.attack'));
});
test('HTTP attack route saves damage and event history atomically',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dk-combat-m8-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const {world,creature}=monsterFixture();
 await fs.writeFile(path.join(dir,'world.json'),JSON.stringify(world));
 const app=await createDKServer({dataDir:dir,port:0,now:()=>ORIGIN});
 t.after(()=>app.server.listening?app.close():Promise.resolve());
 const base='http://127.0.0.1:'+app.address.port;
 const post=()=>fetch(base+'/api/v1/gameplay',{method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({action:'attack',target_id:creature.id})});
 const response=await post();
 assert.equal(response.status,200);
 const payload=await response.json();
 assert.equal(payload.character.skills.combat,1);
 assert.equal((await post()).status,409,'Attack spam is throttled by server');
 const disk=JSON.parse(await fs.readFile(path.join(dir,'world.json'),'utf8'));
 assert.equal(disk.living.combat.creatures[creature.id].health,13);
 const events=(await fs.readFile(path.join(dir,'world-events.ndjson'),'utf8')).trim().split('\n');
 assert(events.some(line=>JSON.parse(line).type==='player.attack'));
 await app.close();
});
