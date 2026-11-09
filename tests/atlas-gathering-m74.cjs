'use strict';
// M74 authoritative resource harvesting, autonomous NPC work and save validation.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const WORLD=require('../server/world.cjs');
const ACTORS=require('../server/world-actors-m73.cjs');
const GATHER=require('../server/atlas-gathering-m74.cjs');
const TERRAIN=require('../server/world-terrain-editor-m69.cjs');
const {createDKServer}=require('../server/dk-server.cjs');
const NOW=Date.UTC(2026,10,8);
const fresh=()=>WORLD.makeWorld(NOW);
const apply=(w,command)=>ACTORS.perform(w,command).world;
const paint=(w,x,y,material)=>TERRAIN.edit(w,{action:'paint_material',
 expected_revision:w.revision,x,y,width:1,height:1,material}).world;
test('M74 starts with zero harvestable grass resources and an empty pack',()=>{
 let w=fresh();
 assert.deepEqual(w.living.atlas_resources.packs.player,{});
 assert.deepEqual(w.living.atlas_resources.nodes,{});
 w=WORLD.createCharacter(w,1,'TEST',NOW).world;
 w=apply(w,{action:'enter',x:4608,y:4608});
 assert.throws(()=>apply(w,{action:'gather',x:4608,y:4608}),/No harvestable/);
 assert.deepEqual(GATHER.inventory(w,'player'),{});
 assert.equal(WORLD.validateWorld(w),w);
});
test('M74 gathering requires actual land and physical adjacency; patches regrow',()=>{
 let w=WORLD.createCharacter(fresh(),1,'TEST',NOW).world;
 w=apply(w,{action:'enter',x:4608,y:4608});
 w=paint(w,4609,4608,'forest');
 assert.throws(()=>apply(w,{action:'gather',x:4611,y:4608}),/adjacent/);
 w=apply(w,{action:'gather',x:4609,y:4608});
 assert.equal(GATHER.inventory(w,'player').timber,1);
 assert.throws(()=>apply(w,{action:'gather',x:4609,y:4608}),/recovering/);
 w.living.minute=360;
 w=apply(w,{action:'gather',x:4609,y:4608});
 assert.equal(GATHER.inventory(w,'player').timber,2);
 assert.equal(WORLD.validateWorld(w),w);
});
test('M74 foragers and stationed workers gather different painted supplies',()=>{
 let w=fresh();
 w=apply(w,{action:'introduce_npc',name:'Woodsman',role:'forager',x:4650,y:4650});
 w=apply(w,{action:'introduce_npc',name:'Mason',role:'worker',x:4660,y:4660});
 w=paint(w,4650,4650,'forest');
 w=paint(w,4660,4660,'highland');
 w.living.minute=60;ACTORS.advance(w,60);
 assert.equal(GATHER.inventory(w,'atlas_npc_1').timber,1);
 assert.equal(GATHER.inventory(w,'atlas_npc_2').stone,1);
 assert.equal(w.living.atlas_npcs.records.atlas_npc_2.x,4660);
 w.living.minute=120;ACTORS.advance(w,120);
 assert.equal(GATHER.inventory(w,'atlas_npc_2').stone,1);
 assert.equal(WORLD.validateWorld(w),w);
 w=apply(w,{action:'remove_npc',npc_id:'atlas_npc_2'});
 assert.equal(w.living.atlas_resources.packs.npcs.atlas_npc_2,undefined);
 assert.equal(WORLD.validateWorld(w),w);
});
test('M74 corrupt inventory counts, orphan worker pack and out-of-bounds patches are rejected',()=>{
 const w=fresh();
 w.living.atlas_resources.packs.player.timber=1000;
 assert.throws(()=>WORLD.validateWorld(w),/Invalid/);
 delete w.living.atlas_resources.packs.player.timber;
 w.living.atlas_resources.packs.npcs.atlas_npc_1={stone:1};
 assert.throws(()=>WORLD.validateWorld(w),/Orphan/);
 delete w.living.atlas_resources.packs.npcs.atlas_npc_1;
 w.living.atlas_resources.nodes['9999,9']={material:'forest',ready_at:12};
 assert.throws(()=>WORLD.validateWorld(w),/Invalid/);
});
test('M74 HTTP work commands are header restricted, default grass remains empty',async()=>{
 const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'dk-gather-m74-'));
 let server;
 try{
  server=await createDKServer({dataDir,port:0,tickMs:600000,now:()=>NOW});
  const base='http://127.0.0.1:'+server.address.port;
  const post=(body,headers={})=>fetch(base+'/api/v1/world/actors',{method:'POST',
   headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
  let r=await post({action:'new_character',name:'TEST',x:4608,y:4608},
   {'X-DK-World-Character':'new_character'});
  assert.equal(r.status,200);
  r=await post({action:'gather',x:4608,y:4608});
  assert.equal(r.status,403);
  r=await post({action:'gather',x:4608,y:4608},
   {'X-DK-World-Work':'gather'});
  assert.equal(r.status,422,'fresh grass has no material to gather');
  const view=await fetch(base+'/api/v1/world/actors').then(x=>x.json());
  assert.deepEqual(view.supplies,{});
  assert.deepEqual(server.world.living.atlas_resources.packs.player,{});
 }finally{
  if(server)await server.close();
  fs.rmSync(dataDir,{recursive:true,force:true});
 }
});
