'use strict';
// M75: strict construction sites, materials, labor, collision and HTTP persistence.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const WORLD=require('../server/world.cjs');
const ACTORS=require('../server/world-actors-m73.cjs');
const SITES=require('../server/atlas-construction-m75.cjs');
const TERRAIN=require('../server/world-terrain-editor-m69.cjs');
const ATLAS=require('../server/world-atlas-m70.cjs');
const {createDKServer}=require('../server/dk-server.cjs');
const NOW=Date.UTC(2026,10,8);
const fresh=()=>WORLD.makeWorld(NOW);
const actor=(w,cmd)=>ACTORS.perform(w,cmd).world;
const site=(w,cmd)=>SITES.perform(w,{...cmd,expected_revision:w.revision}).world;
function traveler(){
 let w=WORLD.createCharacter(fresh(),1,'BUILDER',NOW).world;
 return actor(w,{action:'enter',x:4608,y:4608});
}
function supplies(w){
 Object.assign(w.living.atlas_resources.packs.player,
  {stone:2,clay:1,timber:6,reeds:1});
 return w;
}
test('M75 empty green world has no sites or free building supplies',()=>{
 const w=fresh();
 assert.deepEqual(w.living.atlas_sites.records,{});
 assert.equal(SITES.validate(w),true);
 assert.deepEqual(w.living.atlas_resources.packs.player,{});
});
test('M75 requires a player nearby and a truly flat, unoccupied 2D footprint',()=>{
 let w=traveler();
 w=TERRAIN.edit(w,{action:'raise_elevation',expected_revision:w.revision,
  x:4609,y:4608,width:1,height:1}).world;
 assert.throws(()=>site(w,{action:'place',kind:'shed',x:4609,y:4608}),/level/);
 w=TERRAIN.edit(w,{action:'flatten_elevation',expected_revision:w.revision,
  x:4609,y:4608,width:1,height:1,target_elevation:0}).world;
 w=site(w,{action:'place',kind:'shed',x:4609,y:4608});
 assert.equal(w.living.atlas_sites.records.atlas_site_1.phase,0);
 assert.equal(SITES.blocks(w,4609,4608),false);
 assert.throws(()=>site(w,{action:'place',kind:'shed',x:4609,y:4608}),/overlaps/);
 assert.throws(()=>site(w,{action:'place',kind:'shed',x:9000,y:9000}),/next to/);
 assert.equal(WORLD.validateWorld(w),w);
});
test('M75 no free build: stock is debited from real backpack, consumed stage by stage',()=>{
 let w=supplies(traveler());
 w=site(w,{action:'place',kind:'shed',x:4609,y:4608});
 assert.throws(()=>site(w,{action:'labor',site_id:'atlas_site_1'}),/waiting/);
 for(const [item,quantity] of Object.entries({stone:2,clay:1,timber:6,reeds:1}))
  w=site(w,{action:'deliver',site_id:'atlas_site_1',item,quantity});
 assert.deepEqual(w.living.atlas_resources.packs.player,{});
 assert.deepEqual(w.living.atlas_sites.records.atlas_site_1.inventory,
  {stone:2,clay:1,timber:6,reeds:1});
 for(let i=0;i<3;i++)w=site(w,{action:'labor',site_id:'atlas_site_1'});
 assert.equal(w.living.atlas_sites.records.atlas_site_1.phase,1);
 assert.equal(SITES.blocks(w,4609,4608),true);
 assert.equal(w.living.atlas_sites.records.atlas_site_1.inventory.stone,undefined);
 assert.throws(()=>actor(w,{action:'step',direction:'east'}),/blocked/);
 for(let i=0;i<7;i++)w=site(w,{action:'labor',site_id:'atlas_site_1'});
 assert.equal(w.living.atlas_sites.records.atlas_site_1.phase,3);
 assert.deepEqual(w.living.atlas_sites.records.atlas_site_1.inventory,{});
 assert.throws(()=>site(w,{action:'cancel',site_id:'atlas_site_1'}),/demolition/);
 assert.equal(WORLD.validateWorld(w),w);
});
test('M75 assigned worker transfers only carried materials and constructs on server time',()=>{
 let w=traveler();
 w=actor(w,{action:'introduce_npc',name:'Mason',role:'worker',x:4607,y:4608});
 w=site(w,{action:'place',kind:'shed',x:4609,y:4608});
 w.living.atlas_resources.packs.npcs.atlas_npc_1={stone:2,clay:1};
 w.characters['1'].gold=20;
 w=site(w,{action:'assign',site_id:'atlas_site_1',npc_id:'atlas_npc_1'});
 w.living.minute=15;SITES.advance(w,15);
 assert.equal(w.living.atlas_sites.records.atlas_site_1.inventory.stone,1);
 assert.equal(w.living.atlas_resources.packs.npcs.atlas_npc_1.stone,1);
 for(let minute=30;minute<=150;minute+=15){
  w.living.minute=minute;SITES.advance(w,minute);
 }
 assert.equal(w.living.atlas_sites.records.atlas_site_1.phase,1);
 assert.equal(w.living.atlas_sites.records.atlas_site_1.progress,0);
 assert.deepEqual(w.living.atlas_resources.packs.npcs.atlas_npc_1,{});
 assert.equal(w.living.atlas_npcs.records.atlas_npc_1.coins,6);
 assert.equal(w.characters['1'].gold,14);
 assert.equal(WORLD.validateWorld(w),w);
 w=actor(w,{action:'remove_npc',npc_id:'atlas_npc_1'});
 assert.deepEqual(w.living.atlas_sites.records.atlas_site_1.workers,[]);
 assert.equal(WORLD.validateWorld(w),w);
});
test('M75 NPC work pauses without wages, but a player can still build manually',()=>{
 let w=traveler();
 w=actor(w,{action:'introduce_npc',name:'Mason',role:'worker',x:4607,y:4608});
 w=site(w,{action:'place',kind:'shed',x:4609,y:4608});
 w.living.atlas_resources.packs.npcs.atlas_npc_1={stone:2,clay:1};
 w=site(w,{action:'assign',site_id:'atlas_site_1',npc_id:'atlas_npc_1'});
 w.characters['1'].gold=0;
 w.living.minute=15;SITES.advance(w,15);
 assert.equal(w.living.atlas_sites.records.atlas_site_1.inventory.stone,undefined);
 assert.equal(w.living.atlas_npcs.records.atlas_npc_1.coins,0);
 assert.equal(WORLD.validateWorld(w),w);
});
test('M75 construction area cannot be sculpted or broadly repainted',()=>{
 let w=traveler();
 w=site(w,{action:'place',kind:'shed',x:4609,y:4608});
 assert.throws(()=>TERRAIN.edit(w,{action:'raise_elevation',
  expected_revision:w.revision,x:4609,y:4608,width:1,height:1}),/construction|protected/);
 assert.throws(()=>ATLAS.editCells(w,{action:'fill_cells',
  expected_revision:w.revision,x:36,y:36,width:1,height:1,material:'sea'}),/protected|changes/);
 assert.equal(WORLD.validateWorld(w),w);
});
test('M75 malformed/stale commands cannot produce buildings or materials',()=>{
 let w=traveler(),before=JSON.stringify(w);
 assert.throws(()=>SITES.perform(w,{action:'place',expected_revision:w.revision-1,
  kind:'shed',x:4609,y:4608}),/Stale/);
 assert.throws(()=>SITES.perform(w,{action:'place',expected_revision:w.revision,
  kind:'mansion',x:4609,y:4608}),/Invalid/);
 assert.equal(JSON.stringify(w),before);
});
test('M75 browser has building controls wired to real server actions',()=>{
 const source=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
 assert.match(source('dk-world-explore-m73.html'),/dkBuildPlace/);
 assert.match(source('dk-world-explore-m73.js'),/worldConstruction/);
 assert.match(source('dk-world-explore-m73.js'),/site\.phase/);
 assert.match(source('server/local-game.cjs'),/dk-world-explore-m73/);
});
test('M75 construction site saves to disk and survives a loopback server restart',async()=>{
 const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'dk-sites-m75-'));
 let instance;
 try{
  instance=await createDKServer({dataDir,port:0,tickMs:600000,now:()=>NOW});
  let base='http://127.0.0.1:'+instance.address.port;
  const post=(url,body,headers={})=>fetch(base+url,{method:'POST',
   headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
  let r=await post('/api/v1/world/actors',
   {action:'new_character',name:'BUILDER',x:4608,y:4608},
   {'X-DK-World-Character':'new_character'});
  assert.equal(r.status,200);
  let view=await r.json();
  const cmd={action:'place',expected_revision:view.world_revision,kind:'shed',x:4609,y:4608};
  r=await post('/api/v1/world/construction',cmd);
  assert.equal(r.status,403);
  r=await post('/api/v1/world/construction',cmd,{'X-DK-World-Work':'construction'});
  assert.equal(r.status,200);
  view=await r.json();
  assert.equal(view.sites.length,1);
  assert.equal(view.sites[0].stage,'foundation');
  assert.equal(instance.world.living.atlas_sites.records.atlas_site_1.x,4609);
  await instance.close();instance=null;
  instance=await createDKServer({dataDir,port:0,tickMs:600000,now:()=>NOW});
  base='http://127.0.0.1:'+instance.address.port;
  view=await fetch(base+'/api/v1/world/actors').then(r=>r.json());
  assert.equal(view.sites[0].id,'atlas_site_1');
  assert.equal(view.sites[0].stage,'foundation');
 }finally{
  if(instance)await instance.close();
  fs.rmSync(dataDir,{recursive:true,force:true});
 }
});
