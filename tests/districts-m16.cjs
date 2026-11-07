'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const W=require('../server/world.cjs'),R=require('../server/regions.cjs');
const P=require('../server/region-policies-m16.cjs');
const LAW=require('../server/law-m15.cjs');
const {createDKServer}=require('../server/dk-server.cjs');
const NOW=Date.UTC(2026,10,6);
test('M16 districts overlap by priority without changing map dimensions',()=>{
 const w=W.makeWorld(NOW);
 assert.equal(P.regionAt(w,R.TEMPLE,8,7).name,'Forsaken Temple');
 assert.equal(P.regionAt(w,R.COURT,32,27).name,"Lilith's Willow");
 assert.equal(P.regionAt(w,R.COURT,32,48).name,'Temple Grounds');
 assert.equal(P.regionAt(w,R.VILLAGE,54,103).name,'Bank Quarter');
 assert.equal(P.regionAt(w,R.VILLAGE,70,68).name,'Market Square');
 assert.equal(P.regionAt(w,R.VILLAGE,25,114).name,'Smiths Quarter');
 assert.equal(P.regionAt(w,R.VILLAGE,125,125).name,'Village Residential');
 assert.equal(P.regionAt(w,R.VILLAGE,54,103).guarded,true);
 assert.equal(w.areas[R.COURT].width,64);
 assert.equal(w.areas[R.VILLAGE].width,128);
});
test('Occupied towns lose legal protection but never lose their district identity',()=>{
 const w=W.makeWorld(NOW);
 const b=P.regionAt(w,R.VILLAGE,54,103);
 w.living.territories[R.VILLAGE].control='monsters';
 const after=P.regionAt(w,R.VILLAGE,54,103);
 assert.equal(after.id,b.id);
 assert.equal(after.guarded,false);
 assert.equal(LAW.guarded(w,R.VILLAGE,54,103),false);
 assert.equal(LAW.guarded(w,R.COURT,32,27),false);
 assert.equal(after.occupied,true);
});
test('M15 world migration retains character, NPC, crime and item history',()=>{
 let w=W.createCharacter(W.makeWorld(NOW),1,'ELIAS',NOW).world;
 const old=w.characters['1'].name,bank=w.living.businesses.village_bank.coins;
 const npc=w.living.npcs.baker.name;
 delete w.living.region_history;
 delete w.characters['1'].region_id;
 for(const n of Object.values(w.living.npcs))delete n.region_id;
 assert.equal(P.ensure(w),true);
 assert.equal(P.ensure(w),false);
 assert.equal(w.characters['1'].name,old);
 assert.equal(w.living.npcs.baker.name,npc);
 assert.equal(w.living.businesses.village_bank.coins,bank);
 assert.equal(w.living.region_history.records['dk.region.temple.sanctuary'].player_visits,1);
 W.validateWorld(w);
});
test('Player crossing a district boundary generates distinct exit/enter events',()=>{
 let w=W.createCharacter(W.makeWorld(NOW),1,'ELIAS',NOW).world;
 const c=w.characters['1'];
 Object.assign(c,{form:'living',opening_state:'resurrected',
  area_id:R.VILLAGE,x:42,y:100});
 c.region_id=P.regionAt(w,c.area_id,c.x,c.y).id;
 const previous=c.region_id;
 const a=W.applyCharacterAction(w,1,{action:'move',direction:'east'});
 assert.equal(a.character.region_id,'dk.region.village.bank');
 assert.notEqual(a.character.region_id,previous);
 assert.equal(a.events.length,2);
 assert.deepEqual(a.events.map(x=>x.type),
   ['player.region.exit','player.region.enter']);
 assert.equal(a.world.living.region_history.records[a.character.region_id].player_visits,1);
 W.validateWorld(a.world);
 const b=W.applyCharacterAction(a.world,1,{action:'move',direction:'west'});
 assert.equal(b.character.region_id,previous);
 assert.equal(b.events.length,2);
 W.validateWorld(b.world);
});
test('NPC crossing a district records its visit without changing its entity serial',()=>{
 const w=W.makeWorld(NOW),npc=w.living.npcs.baker;
 const original=w.entity_registry.refs['npc:baker'].serial;
 npc.x=70;npc.y=68;
 const events=[];P.syncNpcTransitions(w,5,events);
 assert.equal(npc.region_id,'dk.region.village.market');
 assert.equal(events.length,1);
 assert.equal(events[0].type,'npc.region.enter');
 assert.equal(w.entity_registry.refs['npc:baker'].serial,original);
 assert.equal(w.living.region_history.records[npc.region_id].npc_visits,1);
 P.syncNpcTransitions(w,6,events);
 assert.equal(events.length,1,'No duplicate transition without movement');
 W.validateWorld(w);
});
test('Region status cannot be forged or pointed to another tile',()=>{
 const w=W.createCharacter(W.makeWorld(NOW),1,'ELIAS',NOW).world;
 w.characters['1'].region_id='dk.region.village.bank';
 assert.throws(()=>W.validateWorld(w),/disagrees/);
 assert.throws(()=>P.regionAt(w,R.VILLAGE,999,999),/Invalid region position/);
});
test('Read-only current district API follows saved character movement',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dk-m16-districts-'));
 const app=await createDKServer({dataDir:dir,port:0,now:()=>NOW});
 t.after(async()=>{if(app.server.listening)await app.close();
  await fs.rm(dir,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+app.address.port;
 assert.equal((await fetch(base+'/api/v1/region/current')).status,404);
 const created=await fetch(base+'/api/v1/characters',{method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({slot:1,name:'ELIAS'})});
 assert.equal(created.status,201);
 const current=await(await fetch(base+'/api/v1/region/current')).json();
 assert.equal(current.region.id,'dk.region.temple.sanctuary');
 assert.equal(current.record.player_visits,1);
 assert.equal((await fetch(base+'/api/v1/region/current',{method:'POST'})).status,405);
 await app.close();
});
