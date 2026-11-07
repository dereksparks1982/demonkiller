'use strict';
const {syncAll}=require('./helpers/sync-fixture.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const W=require('../server/world.cjs'),E=require('../server/entity-registry-m10.cjs');
const M=require('../server/mobile-assets-m12.cjs'),G=require('../server/gameplay.cjs');
const S=require('../server/world-scheduler-m11.cjs');
const {createDKServer}=require('../server/dk-server.cjs');
const START=Date.UTC(2026,10,6);
function fixture(){
 const base=W.makeWorld(START);
 const w=W.createCharacter(base,1,'ELIAS',START).world;
 const npc=w.living.npcs.baker,c=w.characters['1'];
 Object.assign(c,{form:'living',opening_state:'resurrected',
   area_id:npc.area_id,x:npc.x,y:npc.y});
 syncAll(w);
 return w;
}
function kill(world,npcId='baker',minute=0){
 const npc=world.living.npcs[npcId],events=[];
 npc.alive=false;
 const corpse=M.onDeath(world,npc,minute,events);
 E.reconcile(world);
 return {corpse,events};
}
test('M12 gives every living NPC a persistent backpack with independent serials',()=>{
 const w=fixture(),n=Object.values(w.living.npcs);
 assert.equal(Object.keys(w.living.mobile_assets.npcs).length,n.length);
 assert.equal(Object.values(w.entity_registry.containers)
   .filter(c=>c.kind==='npc_pack').length,n.filter(x=>x.alive).length);
 assert.equal(M.ensure(w),false);
 E.counts(w);W.validateWorld(w);
});
test('M11 worlds migrate NPC assets and corpse timers without touching existing goods',()=>{
 const w=fixture();
 const amount=w.characters['1'].inventory.herbs;
 const bags=Object.values(w.entity_registry.containers).filter(c=>c.kind==='npc_pack').map(c=>c.id);
 for(const item of Object.values(w.entity_registry.items))
   if(bags.includes(item.parent))delete w.entity_registry.items[item.serial];
 for(const id of bags)delete w.entity_registry.containers[id];
 delete w.living.mobile_assets;
 delete w.living.scheduler.jobs.job_5;w.living.scheduler.sequence=4;
 assert.equal(M.ensure(w),true);
 assert.equal(S.ensure(w),true);
 assert.equal(w.characters['1'].inventory.herbs,amount);
 assert.equal(M.ensure(w),false);
 assert.equal(S.ensure(w),false);
 E.reconcile(w);E.counts(w);W.validateWorld(w);
 assert.equal(w.living.scheduler.jobs.job_5.kind,'corpse_cleanup');
});
test('NPC deaths create corpses holding their own coins, objects and history',()=>{
 const w=fixture(),old=w.living.npcs.baker.coins;
 const bag=w.living.mobile_assets.npcs.baker.bag_id;
 const item=Object.values(w.entity_registry.items).find(i=>i.parent===bag);
 const {corpse,events}=kill(w);
 assert.equal(corpse.coins,old);
 assert.equal(w.living.npcs.baker.coins,0);
 assert.equal(w.entity_registry.items[item.serial].parent,bag);
 assert.equal(events[0].type,'npc.corpse');
 assert(M.read(w).corpses.some(c=>c.id===corpse.id));
 E.counts(w);W.validateWorld(w);
});
test('A nearby living character can loot exactly once, preserving item identity',()=>{
 const w=fixture(),id=Object.values(w.entity_registry.items).find(i=>
   i.parent===w.living.mobile_assets.npcs.baker.bag_id).serial;
 const {corpse}=kill(w);
 const before=w.characters['1'].gold;
 const result=G.apply(w,{action:'loot_corpse',corpse_id:corpse.id});
 assert.equal(result.character.gold,before+corpse.coins);
 assert.equal(result.world.entity_registry.items[id].parent,E.PACK);
 const remains=result.world.living.mobile_assets.corpses[corpse.id];
 assert(remains,'looting does not remove the body');
 assert.equal(remains.looted,true);
 assert.equal(remains.coins,0);
 assert.equal(remains.bag_id,null);
 assert.throws(()=>G.apply(result.world,{action:'loot_corpse',corpse_id:corpse.id}),/Nothing remains/);
 E.counts(result.world);W.validateWorld(result.world);
});
test('Ghosts, distant players and forged loot commands cannot recover NPC wealth',()=>{
 const w=fixture(),{corpse}=kill(w);
 assert.throws(()=>G.apply(w,{action:'loot_corpse',corpse_id:corpse.id,reward:9000}),/Invalid/);
 const away=structuredClone(w);away.characters['1'].x=1;away.characters['1'].y=1;
 assert.throws(()=>G.apply(away,{action:'loot_corpse',corpse_id:corpse.id}),/Move beside/);
 const ghost=structuredClone(w);ghost.characters['1'].form='ghost';ghost.characters['1'].opening_state='complete';
 assert.throws(()=>G.apply(ghost,{action:'loot_corpse',corpse_id:corpse.id}),/Ghosts/);
});
test('M29 scheduler retains stages and finally returns unclaimed NPC possessions to earth',()=>{
 const w=fixture(),{corpse}=kill(w),events=[];
 const bag=corpse.bag_id;
 for(let m=1;m<=180;m++){
   S.runMinute(w,m,events);w.living.minute=m;
 }
 assert.equal(w.living.mobile_assets.corpses[corpse.id].stage,'early');
 assert(events.some(e=>e.type==='corpse.stage'&&e.to==='early'));
 const decay=require('../server/mobile-assets-m12.cjs');
 decay.expire(w,720,events);
 assert.equal(w.living.mobile_assets.corpses[corpse.id].stage,'decaying');
 decay.expire(w,2160,events);
 assert.equal(w.living.mobile_assets.corpses[corpse.id].stage,'skeletal');
 decay.expire(w,4320,events);
 assert.equal(w.entity_registry.containers[bag],undefined);
 assert.equal(w.living.mobile_assets.corpses[corpse.id].stage,'scattered');
 decay.expire(w,10080,events);
 assert.equal(w.living.mobile_assets.corpses[corpse.id],undefined);
 assert(events.some(e=>e.type==='corpse.decayed'));
 E.reconcile(w);E.counts(w);W.validateWorld(w);
});
test('HTTP corpse inspection and looting persist into the single world file',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dk-m12-mobile-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const w=fixture(),{corpse}=kill(w);
 await fs.writeFile(path.join(dir,'world.json'),JSON.stringify(w));
 const app=await createDKServer({dataDir:dir,port:0,now:()=>START});
 t.after(()=>app.server.listening?app.close():Promise.resolve());
 const base='http://127.0.0.1:'+app.address.port;
 const list=await fetch(base+'/api/v1/corpses');
 assert.equal(list.status,200);
 assert((await list.json()).corpses.some(c=>c.id===corpse.id));
 const result=await fetch(base+'/api/v1/gameplay',{method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({action:'loot_corpse',corpse_id:corpse.id})});
 assert.equal(result.status,200);
 const disk=JSON.parse(await fs.readFile(path.join(dir,'world.json'),'utf8'));
 assert.equal(disk.living.mobile_assets.corpses[corpse.id].looted,true);
 assert.equal(disk.characters['1'].gold,25);
 await app.close();
});
