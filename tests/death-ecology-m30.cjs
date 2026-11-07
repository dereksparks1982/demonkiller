'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const W=require('../server/world.cjs');
const E=require('../server/entity-registry-m10.cjs');
const M=require('../server/mobile-assets-m12.cjs');
const D=require('../server/corpse-decay-m29.cjs');
const S=require('../server/scavengers-m30.cjs');
const G=require('../server/burials-m30.cjs');
const SCH=require('../server/world-scheduler-m11.cjs');
const PLAY=require('../server/gameplay.cjs');
const {createDKServer}=require('../server/dk-server.cjs');
const NOW=Date.UTC(2026,10,7);
function fixture(){
 const w=W.createCharacter(W.makeWorld(NOW),1,'ELIAS',NOW).world;
 const npc=w.living.npcs.baker,c=w.characters['1'];
 Object.assign(c,{area_id:npc.area_id,x:npc.x,y:npc.y,
   form:'living',opening_state:'resurrected',crystal_spent:true});
 c.inventory.tools=1;E.reconcile(w);E.counts(w);W.validateWorld(w);
 return w;
}
function dead(w,id='baker'){
 const n=w.living.npcs[id],events=[];n.alive=false;n.health=0;
 const body=M.onDeath(w,n,w.living.minute,events);
 E.reconcile(w);E.counts(w);W.validateWorld(w);
 return body;
}
function runEcology(world,minutes,out=[]){
 for(const minute of minutes){
  world.living.minute=minute;
  S.run(world,minute,out);
 }
 return out;
}
test('M30 new worlds and M29 saves migrate the independent grave and scavenger stores',()=>{
 const w=W.makeWorld(NOW),old=structuredClone(w);
 assert.equal(S.ensure(w),false);assert.equal(G.ensure(w),false);
 assert.equal(w.living.scavengers.schema,1);assert.equal(w.living.burials.schema,1);
 delete old.living.scavengers;delete old.living.burials;
 assert.equal(W.validateWorld(old),old,'load legacy file before migration');
 assert.equal(S.ensure(old),true);assert.equal(G.ensure(old),true);
 assert.equal(S.ensure(old),false);assert.equal(G.ensure(old),false);
 E.counts(old);W.validateWorld(old);
});
test('M30 exposed human remains attract individually saved ravens and later rats',()=>{
 const w=fixture(),body=dead(w),events=[];
 assert.equal(Object.keys(w.living.scavengers.visitors).length,0);
 runEcology(w,[15,30,45,60,75,90,105,120,135,150,165],events);
 assert.equal(Object.keys(w.living.scavengers.visitors).length,0);
 runEcology(w,[180],events);
 const first=Object.values(w.living.scavengers.visitors)[0];
 assert(first);assert.equal(first.kind,'raven');
 assert.equal(first.corpse_id,body.id);assert.equal(first.area_id,body.area_id);
 runEcology(w,[195,210,225,240,255,270],events);
 assert.equal(w.living.mobile_assets.corpses[body.id].scavenger_visits,1);
 assert.equal(w.living.mobile_assets.corpses[body.id].disturbed,true);
 assert.equal(Object.keys(w.living.scavengers.visitors).length,0);
 runEcology(w,[720],events);
 const second=Object.values(w.living.scavengers.visitors)[0];
 assert.equal(second.kind,'rat');
 runEcology(w,[735,750,765,780,795,810],events);
 assert.equal(w.living.mobile_assets.corpses[body.id].scavenger_visits,2);
 assert.equal(w.living.scavengers.total_visits,2);
 runEcology(w,[825,840,855],events);
 assert.equal(Object.keys(w.living.scavengers.visitors).length,0);
 assert.equal(events.filter(e=>e.type==='corpse.scavenged').length,2);
 S.validate(w);E.counts(w);W.validateWorld(w);
});
test('M30 demon corpses attract beetles, not human carrion birds',()=>{
 const w=fixture(),body=M.onCreatureDeath(w,{id:'imp_3',area_id:W.COURT,x:20,y:20},0,[]);
 E.reconcile(w);
 runEcology(w,[90],[]);
 const visitor=Object.values(w.living.scavengers.visitors)[0];
 assert(visitor);assert.equal(visitor.kind,'beetle');
 assert.equal(visitor.corpse_id,body.id);
 E.counts(w);W.validateWorld(w);
});
test('M30 burial converts a corpse into a permanent terrain grave and retires its physical items',()=>{
 const w=fixture(),body=dead(w),bag=body.bag_id;
 const serial=Object.values(w.entity_registry.items).find(i=>i.parent===bag).serial;
 const previous=JSON.stringify(w),oldEnergy=w.characters['1'].crafting.energy;
 const result=G.bury(w,{action:'bury_corpse',corpse_id:body.id}),next=result.world;
 assert.equal(JSON.stringify(w),previous,'burial transition cannot mutate the input snapshot');
 assert.equal(next.living.mobile_assets.corpses[body.id],undefined);
 assert.equal(next.entity_registry.items[serial],undefined);
 assert.equal(next.entity_registry.containers[bag],undefined);
 assert.equal(next.living.mobile_assets.npcs.baker.bag_id,null);
 assert.equal(next.characters['1'].gold,w.characters['1'].gold);
 assert.equal(next.characters['1'].crafting.energy,oldEnergy-6);
 assert.equal(result.event.type,'corpse.buried');
 assert.equal(result.grave.stage,'fresh');assert.equal(result.grave.corpse_id,body.id);
 assert.equal(next.world_id,w.world_id);
 assert.equal(next.living.npcs.blacksmith.alive,w.living.npcs.blacksmith.alive);
 assert.throws(()=>G.bury(next,{action:'bury_corpse',corpse_id:body.id}),/Move beside/);
 E.counts(next);W.validateWorld(next);
});
test('M30 graves settle and overgrow through scheduled world minutes; names survive',()=>{
 const w=fixture(),body=dead(w),buried=G.bury(w,{action:'bury_corpse',corpse_id:body.id}).world;
 const grave=Object.values(buried.living.burials.records)[0],events=[];
 G.run(buried,1440,events);assert.equal(grave.stage,'settled');
 G.run(buried,10080,events);assert.equal(grave.stage,'overgrown');
 G.run(buried,500000,events);assert.equal(grave.stage,'overgrown');
 assert.equal(grave.name,'Baker');
 assert.equal(events.filter(e=>e.type==='grave.changed').length,2);
 E.counts(buried);W.validateWorld(buried);
});
test('M30 burial command refuses remote, tool-less, ghost and preserved bodies',()=>{
 const w=fixture(),body=dead(w),before=JSON.stringify(w);
 assert.throws(()=>G.bury(w,{action:'bury_corpse',corpse_id:body.id,items:5}),/Invalid/);
 const far=structuredClone(w);far.characters['1'].x=1;far.characters['1'].y=1;
 assert.throws(()=>G.bury(far,{action:'bury_corpse',corpse_id:body.id}),/Move beside/);
 const noTool=structuredClone(w);noTool.characters['1'].inventory.tools=0;E.reconcile(noTool);
 assert.throws(()=>G.bury(noTool,{action:'bury_corpse',corpse_id:body.id}),/Tools/);
 const ghost=structuredClone(w);ghost.characters['1'].form='ghost';
 assert.throws(()=>G.bury(ghost,{action:'bury_corpse',corpse_id:body.id}),/Ghosts/);
 const protectedWorld=structuredClone(w);
 protectedWorld.living.mobile_assets.corpses[body.id].preserved=true;
 protectedWorld.living.mobile_assets.corpses[body.id].expires_minute=null;
 assert.throws(()=>G.bury(protectedWorld,{action:'bury_corpse',corpse_id:body.id}),/cannot be disturbed/);
 assert.equal(JSON.stringify(w),before);
});
test('M30 scheduler adds two durable jobs to old worlds without duplicate firing',()=>{
 const w=W.makeWorld(NOW),original=Object.values(w.living.scheduler.jobs).length;
 assert.equal(original,9);
 const jobs=Object.values(w.living.scheduler.jobs);
 assert(jobs.some(j=>j.kind==='scavenger_activity'&&j.interval_minutes===15));
 assert(jobs.some(j=>j.kind==='grave_aging'&&j.interval_minutes===120));
 assert.equal(SCH.ensure(w),false);
 const old=structuredClone(w);
 delete old.living.scheduler.jobs.job_8;
 delete old.living.scheduler.jobs.job_9;
 old.living.scheduler.sequence=7;
 assert.equal(SCH.ensure(old),true);
 assert.equal(SCH.ensure(old),false);
 assert.equal(Object.values(old.living.scheduler.jobs).length,9);
 SCH.validate(old);W.validateWorld(old);
});
test('M30 HTTP burial persists across restart with no phantom corpse or lost world',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dk-m30-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const w=fixture(),body=dead(w);
 await fs.writeFile(path.join(dir,'world.json'),JSON.stringify(w));
 const app=await createDKServer({dataDir:dir,port:0,now:()=>NOW});
 t.after(async()=>{if(app.server.listening)await app.close();});
 const url='http://127.0.0.1:'+app.address.port;
 const buried=await fetch(url+'/api/v1/gameplay',{method:'POST',
  headers:{'content-type':'application/json'},
  body:JSON.stringify({action:'bury_corpse',corpse_id:body.id})});
 assert.equal(buried.status,200);
 const summary=await (await fetch(url+'/api/v1/living')).json();
 assert.equal(summary.mobile_assets.corpses[body.id],undefined);
 const grave=Object.values(summary.burials)[0];
 assert(grave);assert.equal(grave.name,'Baker');
 const saved=JSON.parse(await fs.readFile(path.join(dir,'world.json'),'utf8'));
 assert(saved.living.burials.records[grave.id]);
 assert.equal(saved.living.mobile_assets.corpses[body.id],undefined);
 await app.close();
 const resumed=await createDKServer({dataDir:dir,port:0,now:()=>NOW+1000});
 try{
  assert(resumed.world.living.burials.records[grave.id]);
  assert.equal(resumed.world.characters['1'].gold,w.characters['1'].gold);
  E.counts(resumed.world);W.validateWorld(resumed.world);
 }finally{await resumed.close();}
});
