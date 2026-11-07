'use strict';
const {syncAll}=require('./helpers/sync-fixture.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const W=require('../server/world.cjs'),E=require('../server/entity-registry-m10.cjs');
const M=require('../server/mobile-assets-m12.cjs'),D=require('../server/corpse-decay-m29.cjs');
const C=require('../server/combat-m8.cjs'),G=require('../server/gameplay.cjs');
const S=require('../server/world-scheduler-m11.cjs');
const {createDKServer}=require('../server/dk-server.cjs');
const START=Date.UTC(2026,10,7);
function fixture(){
 const w=W.createCharacter(W.makeWorld(START),1,'ELIAS',START).world;
 const n=w.living.npcs.baker,c=w.characters['1'];
 Object.assign(c,{form:'living',opening_state:'resurrected',
  area_id:n.area_id,x:n.x,y:n.y});
 syncAll(w);E.reconcile(w);E.counts(w);W.validateWorld(w);
 return w;
}
function kill(w,id='baker'){
 const npc=w.living.npcs[id],events=[];npc.alive=false;
 const c=M.onDeath(w,npc,w.living.minute,events);
 E.reconcile(w);E.counts(w);W.validateWorld(w);
 return {c,events};
}
test('M29 stages are deterministic and depend on saved world minutes, species and shelter',()=>{
 const human=D.configure({kind:'npc',species:'human',area_id:W.VILLAGE,minute:50});
 const c={created_minute:50,...human};
 assert.deepEqual([50,229,230,770,2210,4370].map(t=>D.stageAt(c,t)),
  ['fresh','fresh','early','decaying','skeletal','scattered']);
 assert.equal(D.expired(c,10129),false);
 assert.equal(D.expired(c,10130),true);
 const sheltered=D.configure({area_id:W.AREA_ID,minute:0});
 const damp=D.configure({area_id:W.COURT,minute:0});
 assert.equal(sheltered.environment,'dry');
 assert.equal(damp.environment,'damp');
 assert(D.schedule(sheltered)[5]>D.schedule(c)[5]);
 assert(D.schedule(damp)[5]<D.schedule(c)[5]);
 const demon=D.configure({kind:'monster',species:'demon',area_id:W.VILLAGE,minute:0});
 assert(D.schedule(demon)[5]<D.schedule(c)[5]);
});
test('M29 NPC corpse survives looting while items and coin transfer only once',()=>{
 const w=fixture(),{c}=kill(w),originalSerial=E.inspect(w).revision;
 const first=G.apply(w,{action:'loot_corpse',corpse_id:c.id});
 const remains=first.world.living.mobile_assets.corpses[c.id];
 assert(remains,'body remains anchored after looting');
 assert.equal(remains.looted,true);
 assert.equal(remains.coins,0);assert.equal(remains.bag_id,null);
 assert.equal(remains.stage,'fresh');
 assert.equal(first.character.gold,25);
 assert.equal(first.world.entity_registry.refs['corpse:'+c.id].active,true);
 assert.throws(()=>G.apply(first.world,{action:'loot_corpse',corpse_id:c.id}),/Nothing remains/);
 assert.equal(w.living.mobile_assets.corpses[c.id].looted,false,'input world unchanged');
 E.counts(first.world);W.validateWorld(first.world);
});
test('M29 corpse stage events advance without removing unlooted bodies',()=>{
 const w=fixture(),{c}=kill(w),bag=c.bag_id,events=[];
 for(const minute of [180,720,2160]){
  w.living.minute=minute;M.expire(w,minute,events);
  assert(w.living.mobile_assets.corpses[c.id]);
 }
 assert.equal(w.living.mobile_assets.corpses[c.id].stage,'skeletal');
 assert(w.entity_registry.containers[bag],'possessions still accessible while skeletal');
 assert.deepEqual(events.filter(e=>e.type==='corpse.stage').map(e=>e.to),
  ['early','decaying','skeletal']);
 assert(M.read(w).corpses.some(b=>b.id===c.id&&b.stage==='skeletal'&&b.can_search));
 E.reconcile(w);E.counts(w);W.validateWorld(w);
});
test('M29 scattered bones persist without orphaning unclaimed items; final stage retires them',()=>{
 const w=fixture(),{c}=kill(w),bag=c.bag_id,events=[];
 w.living.minute=4320;M.expire(w,4320,events);
 assert.equal(w.living.mobile_assets.corpses[c.id].stage,'scattered');
 assert.equal(w.living.mobile_assets.corpses[c.id].bag_id,null);
 assert.equal(w.entity_registry.containers[bag],undefined);
 assert.equal(Object.values(w.entity_registry.items).some(i=>i.parent===bag),false);
 assert.equal(M.read(w).corpses.find(b=>b.id===c.id).can_search,false);
 E.reconcile(w);E.counts(w);W.validateWorld(w);
 w.living.minute=10080;M.expire(w,10080,events);
 assert.equal(w.living.mobile_assets.corpses[c.id],undefined);
 E.reconcile(w);E.counts(w);W.validateWorld(w);
 assert.equal(w.entity_registry.refs['corpse:'+c.id].active,false);
 assert(events.some(e=>e.type==='corpse.decayed'));
});
test('M29 important preserved remains stay after ordinary bodies vanish',()=>{
 const w=fixture(),{c}=kill(w),events=[];
 const body=w.living.mobile_assets.corpses[c.id];
 body.preserved=true;body.expires_minute=null;
 w.living.minute=100000;M.expire(w,w.living.minute,events);
 assert.equal(body.stage,'scattered');
 assert(w.living.mobile_assets.corpses[c.id]);
 assert(body.bag_id===null);
 E.reconcile(w);E.counts(w);W.validateWorld(w);
});
test('M29 migrates old M12 world saves without touching corpse, bag or world identity',()=>{
 const w=fixture(),{c}=kill(w);
 const serial=Object.values(w.entity_registry.items).find(i=>i.parent===c.bag_id).serial;
 const old={...c};for(const key of ['kind','species','environment','preserved','looted','stage','last_stage_minute'])
  delete c[key];
 c.expires_minute=c.created_minute+M.DECAY;
 assert.equal(W.validateWorld(w),w,'old world schema must load for migration');
 assert.equal(M.ensure(w),true);
 const upgraded=w.living.mobile_assets.corpses[old.id];
 assert.equal(upgraded.expires_minute,10080);
 assert.equal(upgraded.bag_id,old.bag_id);
 assert.equal(w.entity_registry.items[serial].parent,old.bag_id);
 assert.equal(M.ensure(w),false);
 E.reconcile(w);E.counts(w);W.validateWorld(w);
});
test('M29 killed imps leave a demon corpse without consuming monster loot',()=>{
 const w=fixture(),events=[],area=W.COURT;
 C.spawn(w,area,0,events,1);
 const monster=Object.values(w.living.combat.creatures)[0];
 assert(monster);
 const p=w.characters['1'];
 Object.assign(p,{area_id:monster.area_id,x:monster.x,y:monster.y});
 syncAll(w);
 monster.health=1;
 const before=Object.keys(w.living.mobile_assets.corpses).length;
 const result=C.apply(w,{action:'attack',target_id:monster.id},START);
 const newCorpse=Object.values(result.world.living.mobile_assets.corpses)
  .find(c=>c.creature_id===monster.id);
 assert(newCorpse);
 assert.equal(newCorpse.species,'demon');
 assert.equal(newCorpse.npc_id,null);
 assert.equal(newCorpse.bag_id,null);
 assert.equal(newCorpse.stage,'fresh');
 assert.equal(Object.keys(result.world.living.mobile_assets.corpses).length,before+1);
 assert(Object.values(result.world.living.combat.drops).some(d=>d.area_id===area));
 E.reconcile(result.world);E.counts(result.world);W.validateWorld(result.world);
});
test('M29 HTTP corpse inspection, looting and restart preserve the visible body',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dk-m29-corpse-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const w=fixture(),{c}=kill(w);
 await fs.writeFile(path.join(dir,'world.json'),JSON.stringify(w));
 const app=await createDKServer({dataDir:dir,port:0,now:()=>START});
 t.after(async()=>{if(app.server.listening)await app.close();});
 const base='http://127.0.0.1:'+app.address.port;
 const list=await fetch(base+'/api/v1/corpses');
 assert.equal(list.status,200);
 const entry=(await list.json()).corpses.find(b=>b.id===c.id);
 assert.equal(entry.stage,'fresh');
 assert.equal(entry.can_search,true);
 const response=await fetch(base+'/api/v1/gameplay',{method:'POST',
  headers:{'content-type':'application/json'},
  body:JSON.stringify({action:'loot_corpse',corpse_id:c.id})});
 assert.equal(response.status,200);
 const file=JSON.parse(await fs.readFile(path.join(dir,'world.json'),'utf8'));
 assert.equal(file.living.mobile_assets.corpses[c.id].looted,true);
 assert.equal(file.living.mobile_assets.corpses[c.id].stage,'fresh');
 await app.close();
 const resumed=await createDKServer({dataDir:dir,port:0,now:()=>START+10000});
 try{
  assert.equal(resumed.world.living.mobile_assets.corpses[c.id].looted,true);
  assert.equal(M.read(resumed.world).corpses.find(b=>b.id===c.id).can_search,false);
  E.counts(resumed.world);W.validateWorld(resumed.world);
 }finally{await resumed.close();}
});


test('M29 final decay creates a world-saved stain which eventually fades',()=>{
 const w=fixture(),{c}=kill(w),events=[];
 w.living.minute=10080;M.expire(w,10080,events);
 assert(!w.living.mobile_assets.corpses[c.id]);
 const mark=Object.values(w.living.mobile_assets.terrain_marks)[0];
 assert(mark);
 assert.equal(mark.kind,'stain');
 assert.equal(mark.area_id,c.area_id);
 assert.equal(mark.x,c.x);
 assert.equal(mark.y,c.y);
 assert.equal(mark.expires_minute,10080+M.MARK_LIFETIME);
 E.reconcile(w);E.counts(w);W.validateWorld(w);
 w.living.minute=mark.expires_minute-1;M.expire(w,w.living.minute,events);
 assert(w.living.mobile_assets.terrain_marks[mark.id]);
 w.living.minute=mark.expires_minute;M.expire(w,w.living.minute,events);
 assert(!w.living.mobile_assets.terrain_marks[mark.id]);
 E.reconcile(w);E.counts(w);W.validateWorld(w);
});
test('M29 monster remains leave a distinct ash trace',()=>{
 const w=fixture(),events=[];
 const creature={id:'imp_999',area_id:W.COURT,x:12,y:16};
 const body=M.onCreatureDeath(w,creature,0,events);
 E.reconcile(w);W.validateWorld(w);
 w.living.minute=body.expires_minute;
 M.expire(w,w.living.minute,events);
 assert(!w.living.mobile_assets.corpses[body.id]);
 const mark=Object.values(w.living.mobile_assets.terrain_marks)[0];
 assert.equal(mark.kind,'ash');
 E.reconcile(w);E.counts(w);W.validateWorld(w);
});
