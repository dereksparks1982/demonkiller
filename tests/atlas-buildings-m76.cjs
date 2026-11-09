'use strict';
// M76 building interiors and title: no free resources, persistent site linkage.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const WORLD=require('../server/world.cjs');
const ACTORS=require('../server/world-actors-m73.cjs');
const SITES=require('../server/atlas-construction-m75.cjs');
const HOUSES=require('../server/atlas-buildings-m76.cjs');
const LIFECYCLE=require('../server/character-lifecycle-m26.cjs');
const {createDKServer}=require('../server/dk-server.cjs');
const NOW=Date.UTC(2026,10,8);
function setup(){
 let w=WORLD.createCharacter(WORLD.makeWorld(NOW),1,'BUILDER',NOW).world;
 return ACTORS.perform(w,{action:'enter',x:4608,y:4608}).world;
}
const build=(w,c)=>SITES.perform(w,{...c,expected_revision:w.revision}).world;
const use=(w,c)=>HOUSES.perform(w,{...c,expected_revision:w.revision}).world;
const actor=(w,c)=>ACTORS.perform(w,c).world;
function complete(){
 let w=setup();
 Object.assign(w.living.atlas_resources.packs.player,
  {stone:5,clay:1,timber:13,reeds:3});
 w=build(w,{action:'place',kind:'shed',x:4609,y:4608});
 for(const [item,quantity] of Object.entries({stone:2,clay:1,timber:6,reeds:1}))
  w=build(w,{action:'deliver',site_id:'atlas_site_1',item,quantity});
 for(let n=0;n<10;n++)w=build(w,{action:'labor',site_id:'atlas_site_1'});
 return w;
}
test('M76 clean flat world never spawns free housing, materials or a caretaker',()=>{
 const w=WORLD.makeWorld(NOW);
 assert.deepEqual(w.living.atlas_buildings.records,{});
 assert.deepEqual(w.living.atlas_resources.packs.player,{});
 assert.equal(HOUSES.validate(w),true);
});
test('M76 completing physical M75 work creates one persistent, titled, solid building',()=>{
 const w=complete(),b=w.living.atlas_buildings.records.atlas_site_1;
 assert.ok(b);
 assert.equal(w.living.atlas_sites.records.atlas_site_1.phase,3);
 assert.equal(b.owner_serial,w.entity_registry.refs['player:1'].serial);
 assert.equal(b.door.x,4608);
 assert.equal(b.door.y,4608);
 assert.equal(b.workbench,false);
 assert.equal(SITES.blocks(w,4609,4608),true);
 assert.equal(HOUSES.validate(w),true);
 assert.equal(WORLD.validateWorld(w),w);
});
test('M76 doorway, true indoor grid, saved footstep and wall collision',()=>{
 let w=complete();
 let sight=ACTORS.view(w);
 assert.equal(sight.buildings[0].door.x,4608);
 w=use(w,{action:'enter',building_id:'atlas_site_1'});
 assert.equal(w.characters['1'].atlas_interior.id,'atlas_site_1');
 assert.equal(ACTORS.view(w).interior.width,2);
 const outdoor={...w.characters['1'].atlas_position};
 assert.throws(()=>actor(w,{action:'gather',x:4609,y:4608}),/Exit the building/);
 assert.throws(()=>actor(w,{action:'enter',x:4612,y:4612}),/Exit the building/);
 w=actor(w,{action:'step',direction:'east'});
 assert.deepEqual(w.characters['1'].atlas_position,outdoor);
 assert.deepEqual([w.characters['1'].atlas_interior.x,
  w.characters['1'].atlas_interior.y],[1,0]);
 assert.throws(()=>actor(w,{action:'step',direction:'east'}),/Interior wall/);
 assert.throws(()=>use(w,{action:'exit'}),/Return to the doorway/);
 w=actor(w,{action:'step',direction:'west'});
 w=use(w,{action:'exit'});
 assert.equal(w.characters['1'].atlas_interior,undefined);
 assert.deepEqual(w.characters['1'].atlas_position,outdoor);
 assert.equal(WORLD.validateWorld(w),w);
});
test('M76 storage transfers and bench crafting conserve resources and enforce capacity',()=>{
 let w=complete();
 w=use(w,{action:'enter',building_id:'atlas_site_1'});
 assert.throws(()=>use(w,{action:'withdraw',item:'stone',quantity:1}),/Not enough/);
 w=use(w,{action:'deposit',item:'timber',quantity:2});
 assert.equal(w.living.atlas_buildings.records.atlas_site_1.storage.timber,2);
 w=use(w,{action:'withdraw',item:'timber',quantity:1});
 assert.equal(w.living.atlas_buildings.records.atlas_site_1.storage.timber,1);
 assert.throws(()=>use(w,{action:'craft',recipe:'plank'}),/Install a workbench/);
 w=use(w,{action:'install_bench'});
 assert.equal(w.living.atlas_buildings.records.atlas_site_1.workbench,true);
 assert.throws(()=>use(w,{action:'install_bench'}),/already installed/);
 w=use(w,{action:'craft',recipe:'plank'});
 assert.equal(w.living.atlas_resources.packs.player.plank,1);
 w=use(w,{action:'craft',recipe:'cord'});
 assert.equal(w.living.atlas_resources.packs.player.cord,1);
 assert.equal(HOUSES.validate(w),true);
 assert.equal(WORLD.validateWorld(w),w);
});
test('M76 paid caretaker stocks real materials hourly and stops without player gold',()=>{
 let w=complete();
 w=actor(w,{action:'introduce_npc',role:'worker',name:'Mason',x:4608,y:4609});
 w.living.atlas_resources.packs.npcs.atlas_npc_1={stone:3};
 w=use(w,{action:'assign_caretaker',building_id:'atlas_site_1',npc_id:'atlas_npc_1'});
 w.characters['1'].gold=2;
 const out=[];
 w.living.minute=60;assert.equal(HOUSES.advance(w,60,out),1);
 assert.equal(w.living.atlas_buildings.records.atlas_site_1.storage.stone,1);
 assert.equal(w.living.atlas_npcs.records.atlas_npc_1.coins,1);
 w.living.minute=120;assert.equal(HOUSES.advance(w,120,out),1);
 assert.equal(w.characters['1'].gold,0);
 w.living.minute=180;assert.equal(HOUSES.advance(w,180,out),0);
 assert.equal(w.living.atlas_resources.packs.npcs.atlas_npc_1.stone,1);
 assert.equal(out.length,2);
 assert.equal(WORLD.validateWorld(w),w);
 w=actor(w,{action:'remove_npc',npc_id:'atlas_npc_1'});
 assert.equal(w.living.atlas_buildings.records.atlas_site_1.caretaker_id,null);
 assert.equal(WORLD.validateWorld(w),w);
});
test('M76 ownership locks survive character retirement without leaking to successor',()=>{
 let w=complete();
 w=use(w,{action:'lock',building_id:'atlas_site_1'});
 assert.equal(w.living.atlas_buildings.records.atlas_site_1.locked,true);
 const old=w.entity_registry.refs['player:1'].serial;
 w=LIFECYCLE.deleteCharacter(w,1,'BUILDER').world;
 assert.equal(w.living.atlas_buildings.records.atlas_site_1.owner_serial,null);
 assert.equal(w.living.atlas_buildings.records.atlas_site_1.locked,false);
 assert.deepEqual(w.living.atlas_resources.packs.player,{});
 assert.notEqual(w.entity_registry.refs['player:1']?.serial,old);
 assert.equal(WORLD.validateWorld(w),w);
});
test('M76 strict commands reject spoofed claims, invalid quantities and stale revisions',()=>{
 let w=complete();
 const before=JSON.stringify(w);
 assert.throws(()=>use(w,{action:'deposit',item:'timber',quantity:99}),/Enter the building|Invalid/);
 assert.throws(()=>HOUSES.perform(w,{action:'enter',building_id:'atlas_site_1',
   expected_revision:w.revision-1}),/Stale/);
 assert.throws(()=>use(w,{action:'claim',building_id:'atlas_site_1'}),/already has an owner/);
 assert.equal(JSON.stringify(w),before);
});
test('M76 connected page and server have all building controls and guarded route',()=>{
 const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
 assert.match(read('dk-world-explore-m73.html'),/dkHouseBench/);
 assert.match(read('dk-world-explore-m73.js'),/drawInterior/);
 assert.match(read('dk-menu-server.js'),/worldBuilding/);
 assert.match(read('server/dk-server.cjs'),/api\/v1\/world\/buildings/);
});
test('M76 loopback route requires exact work header and returns empty building registry',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dk-m76-houses-'));
 let srv;
 try{
  srv=await createDKServer({dataDir:dir,port:0,tickMs:600000,now:()=>NOW});
  const base='http://127.0.0.1:'+srv.address.port;
  const r=await fetch(base+'/api/v1/world/buildings').then(x=>x.json());
  assert.deepEqual(r.buildings,[]);
  const payload=JSON.stringify({action:'exit',expected_revision:r.world_revision});
  const bad=await fetch(base+'/api/v1/world/buildings',{method:'POST',
   headers:{'Content-Type':'application/json'},body:payload});
  assert.equal(bad.status,403);
  await srv.close();srv=null;
  srv=await createDKServer({dataDir:dir,port:0,tickMs:600000,now:()=>NOW});
  const again=await fetch('http://127.0.0.1:'+srv.address.port+
   '/api/v1/world/buildings').then(x=>x.json());
  assert.deepEqual(again.buildings,[]);
 }finally{
  if(srv)await srv.close();
  fs.rmSync(dir,{recursive:true,force:true});
 }
});
