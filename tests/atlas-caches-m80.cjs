'use strict';
// M80: real persistent, non-decaying, lootable caches on the unified atlas.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const WORLD=require('../server/world.cjs');
const ACTORS=require('../server/world-actors-m73.cjs');
const CACHES=require('../server/atlas-caches-m80.cjs');
const GATHER=require('../server/atlas-gathering-m74.cjs');
const TERRAIN=require('../server/world-terrain-editor-m69.cjs');
const ATLAS=require('../server/world-atlas-m70.cjs');
const LIFECYCLE=require('../server/character-lifecycle-m26.cjs');
const {createDKServer}=require('../server/dk-server.cjs');
const NOW=Date.UTC(2026,10,9);
function setup(){
 let w=WORLD.createCharacter(WORLD.makeWorld(NOW),1,'TEST',NOW).world;
 w.characters['1'].form='living';
 w.characters['1'].opening_state='resurrected';
 w.characters['1'].crystal_spent=true;
 w=ACTORS.perform(w,{action:'enter',x:4608,y:4608}).world;
 return w;
}
const act=(w,cmd)=>CACHES.perform(w,{expected_revision:w.revision,...cmd}).world;
test('M80 untouched world has zero hidden caches, zero unearned stock',()=>{
 const w=WORLD.makeWorld(NOW);
 assert.equal(CACHES.validate(w),true);
 assert.deepEqual(w.living.atlas_caches.records,{});
 assert.deepEqual(w.living.atlas_resources.packs.player,{});
 assert.equal(WORLD.validateWorld(w),w);
});
test('M80 placing, storing, retrieving and tracking hidden caches conserve supplies',()=>{
 let w=setup();
 w.living.atlas_resources.packs.player.timber=12;
 w=act(w,{action:'create',x:4609,y:4608});
 const c=w.living.atlas_caches.records.atlas_cache_1;
 assert.deepEqual(c.stock,{});
 assert.equal(c.created_minute,0);
 assert.equal(CACHES.listing(w).mine[0].x,4609);
 w=act(w,{action:'deposit',cache_id:c.id,item:'timber',quantity:9});
 assert.equal(w.living.atlas_resources.packs.player.timber,3);
 assert.equal(w.living.atlas_caches.records[c.id].stock.timber,9);
 assert.throws(()=>act(w,{action:'withdraw',cache_id:c.id,item:'stone',quantity:1}),/Not enough/);
 w=act(w,{action:'withdraw',cache_id:c.id,item:'timber',quantity:4});
 assert.equal(w.living.atlas_resources.packs.player.timber,7);
 assert.equal(w.living.atlas_caches.records[c.id].stock.timber,5);
 w.living.minute+=500000;
 assert.equal(w.living.atlas_caches.records[c.id].stock.timber,5,'Cache never decays');
 assert.equal(WORLD.validateWorld(w),w);
});
test('M80 abandoned cache persists through retirement, new character must discover then may loot',()=>{
 let w=setup();
 w.living.atlas_resources.packs.player.herbs=5;
 w=act(w,{action:'create',x:4609,y:4608});
 w=act(w,{action:'deposit',cache_id:'atlas_cache_1',item:'herbs',quantity:5});
 const beforeSerial=w.living.atlas_caches.records.atlas_cache_1.owner_serial;
 w=LIFECYCLE.deleteCharacter(w,1,'TEST').world;
 assert.equal(w.living.atlas_caches.records.atlas_cache_1.owner_serial,null);
 assert.equal(w.living.atlas_caches.records.atlas_cache_1.stock.herbs,5);
 w=WORLD.createCharacter(w,1,'SECOND',NOW+100).world;
 w.characters['1'].form='living';w.characters['1'].opening_state='resurrected';
 w.characters['1'].crystal_spent=true;
 w=ACTORS.perform(w,{action:'enter',x:4608,y:4608}).world;
 assert.notEqual(w.entity_registry.refs['player:1'].serial,beforeSerial);
 assert.equal(CACHES.listing(w).nearby.length,0);
 assert.throws(()=>act(w,{action:'withdraw',cache_id:'atlas_cache_1',
  item:'herbs',quantity:1}),/not been discovered/);
 w=act(w,{action:'discover',x:4609,y:4608});
 assert.equal(CACHES.listing(w).nearby.length,1);
 w=act(w,{action:'withdraw',cache_id:'atlas_cache_1',item:'herbs',quantity:5});
 assert.equal(w.living.atlas_resources.packs.player.herbs,5);
 assert.deepEqual(w.living.atlas_caches.records.atlas_cache_1.stock,{});
 assert.equal(WORLD.validateWorld(w),w);
});
test('M80 refuses phantom goods, cheating, wrong terrain and overcapacity',()=>{
 let w=setup();
 assert.throws(()=>act(w,{action:'create',x:4700,y:4700}),/out of reach/);
 w=act(w,{action:'create',x:4609,y:4608});
 assert.throws(()=>act(w,{action:'create',x:4609,y:4608}),/already here/);
 assert.throws(()=>act(w,{action:'deposit',cache_id:'atlas_cache_1',item:'gold',quantity:1}),/Invalid/);
 assert.throws(()=>act(w,{action:'deposit',cache_id:'atlas_cache_1',item:'stone',quantity:1}),/Not enough/);
 assert.throws(()=>act(w,{action:'deposit',cache_id:'atlas_cache_1',item:'stone',quantity:0}),/Invalid/);
 assert.throws(()=>CACHES.perform(w,{action:'deposit',cache_id:'atlas_cache_1',
  item:'stone',quantity:1,expected_revision:w.revision-1}),/Stale/);
 w.living.atlas_caches.records.atlas_cache_1.stock.plank=500;
 assert.throws(()=>WORLD.validateWorld(w),/Invalid atlas cache/);
});
test('M80 fine/broad sea brushes cannot swallow permanent caches',()=>{
 let w=setup();
 w=act(w,{action:'create',x:4609,y:4608});
 assert.throws(()=>TERRAIN.edit(w,{action:'paint_material',expected_revision:w.revision,
  x:4609,y:4608,width:1,height:1,material:'sea'}),/obstruct/);
 assert.throws(()=>ATLAS.editCells(w,{action:'fill_cells',expected_revision:w.revision,
  x:36,y:36,width:1,height:1,material:'sea'}),/protected/);
});
test('M80 connected HTTP cache work requires header and saves through DK Server',async()=>{
 const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'dk-cache-m80-'));
 let server;
 try{
  server=await createDKServer({dataDir,port:0,tickMs:600000,now:()=>NOW});
  const base='http://127.0.0.1:'+server.address.port;
  const post=async(url,body,h={})=>fetch(base+url,{method:'POST',
   headers:{'Content-Type':'application/json',...h},body:JSON.stringify(body)});
  let response=await post('/api/v1/world/actors',
   {action:'new_character',name:'TEST',x:4608,y:4608},
   {'X-DK-World-Character':'new_character'});
  assert.equal(response.status,200);
  const data=await response.json();
  const command={action:'create',expected_revision:data.world_revision,x:4609,y:4608};
  response=await post('/api/v1/world/caches',command);
  assert.equal(response.status,403);
  response=await post('/api/v1/world/caches',command,{'X-DK-World-Work':'cache'});
  assert.equal(response.status,200);
  const saved=await response.json();
  assert.equal(saved.caches.nearby[0].id,'atlas_cache_1');
  assert.equal(saved.caches.mine[0].x,4609);
  assert.equal(server.world.living.atlas_caches.records.atlas_cache_1.x,4609);
 }finally{
  if(server)await server.close();
  fs.rmSync(dataDir,{recursive:true,force:true});
 }
});
