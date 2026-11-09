'use strict';
// M73 regression contracts: genuine slot-one player, independent server NPCs,
// revisions, protected ground, explicit reset and a plain 2D pixel UI.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const WORLD=require('../server/world.cjs');
const ACTORS=require('../server/world-actors-m73.cjs');
const TERRAIN=require('../server/world-terrain-editor-m69.cjs');
const ATLAS=require('../server/world-atlas-m70.cjs');
const GRID=require('../server/world-grid-m67.cjs');
const {createDKServer}=require('../server/dk-server.cjs');
const NOW=Date.UTC(2026,10,8),fresh=()=>WORLD.makeWorld(NOW);
const run=(w,command)=>ACTORS.perform(w,command).world;
const place=(w,x,y)=>run(w,{action:'enter',x,y});
test('M73 world starts with zero atlas NPCs and no automatically created towns',()=>{
 const w=fresh(),view=ACTORS.view(w);
 assert.equal(view.started,false);assert.equal(view.has_character,false);
 assert.equal(w.living.atlas_npcs.schema,1);
 assert.deepEqual(w.living.atlas_npcs.records,{});
 assert.equal(TERRAIN.readTile(w,4608,4608).material,'grass');
 assert.equal(WORLD.validateWorld(w),w);
});
test('M73 the real saved character enters atlas without losing inventory or skill records',()=>{
 let w=WORLD.createCharacter(fresh(),1,'TRAVELER',NOW).world;
 const old=w.characters['1'];
 const oldInventory=JSON.stringify(old.inventory),oldSkills=JSON.stringify(old.skills);
 const oldArea=old.area_id;
 w.world_grid.walker={x:9000,y:9000,facing:'south',steps:6};
 w=place(w,127,5000);
 assert.equal(w.world_grid.walker,undefined,'M72 surveyor retired when real character enters');
 assert.equal(w.characters['1'].name,'TRAVELER');
 assert.equal(w.characters['1'].slot,1);
 assert.equal(w.characters['1'].area_id,oldArea);
 assert.equal(JSON.stringify(w.characters['1'].inventory),oldInventory);
 assert.equal(JSON.stringify(w.characters['1'].skills),oldSkills);
 assert.equal(ACTORS.view(w).actor.x,127);
 w=run(w,{action:'step',direction:'east'});
 assert.equal(ACTORS.view(w).actor.cell_id,'dk.cell.world.1.39');
 assert.equal(w.characters['1'].atlas_position.x,128);
 assert.equal(w.characters['1'].atlas_position.steps,1);
 assert.equal(WORLD.validateWorld(w),w);
});
test('M73 independent NPCs are introduced only on instruction and have server-clock patrol',()=>{
 let w=WORLD.createCharacter(fresh(),1,'HUMAN',NOW).world;
 w=place(w,1500,3000);
 w=run(w,{action:'introduce_npc',name:'Guard Thomas',role:'guard',x:1503,y:3000});
 w=run(w,{action:'introduce_npc',name:'Laborer',role:'worker',x:1504,y:3000});
 assert.equal(Object.keys(w.living.atlas_npcs.records).length,2);
 assert.equal(ACTORS.view(w).npcs.length,2);
 const guard=w.living.atlas_npcs.records.atlas_npc_1;
 const worker=w.living.atlas_npcs.records.atlas_npc_2;
 assert.equal(guard.x,1503);assert.equal(worker.x,1504);
 w.living.minute=4;
 ACTORS.advance(w,4);
 assert.equal(guard.x,1503,'Cloned worlds do not share NPC objects');
 assert.equal(w.living.atlas_npcs.records.atlas_npc_1.x,1503,
  'Guard cannot walk into occupied worker');
 w.living.minute=8;ACTORS.advance(w,8);
 assert.equal(w.living.atlas_npcs.records.atlas_npc_2.x,1504);
 assert.equal(ACTORS.validate(w),true);
 w=run(w,{action:'remove_npc',npc_id:'atlas_npc_2'});
 assert.equal(ACTORS.view(w).npcs.length,1);
 assert.equal(WORLD.validateWorld(w),w);
});
test('M73 atlas NPCs can move independently when their patrol path is clear',()=>{
 let w=fresh();
 w=run(w,{action:'introduce_npc',name:'Northern Scout',role:'scout',x:1500,y:3000});
 const initial=w.living.atlas_npcs.records.atlas_npc_1.x;
 w.living.minute=4;ACTORS.advance(w,4);
 assert.equal(w.living.atlas_npcs.records.atlas_npc_1.x,initial+1);
 w.living.minute=8;ACTORS.advance(w,8);
 assert.equal(w.living.atlas_npcs.records.atlas_npc_1.x,initial+2);
 assert.equal(WORLD.validateWorld(w),w);
});
test('M73 actor collision prevents walking into NPCs and painting beneath them',()=>{
 let w=WORLD.createCharacter(fresh(),1,'TEST',NOW).world;
 w=place(w,2000,4000);
 w=run(w,{action:'introduce_npc',name:'Nora',role:'guard',x:2001,y:4000});
 assert.throws(()=>run(w,{action:'step',direction:'east'}),/occupied|blocked/);
 assert.throws(()=>run(w,{action:'introduce_npc',name:'Nora Again',
  role:'worker',x:2001,y:4000}),/occupied/);
 assert.throws(()=>TERRAIN.edit(w,{action:'paint_material',
  expected_revision:w.revision,x:2000,y:4000,width:1,height:1,material:'sea'}),/obstruct/);
 assert.throws(()=>TERRAIN.edit(w,{action:'paint_material',
  expected_revision:w.revision,x:2001,y:4000,width:1,height:1,material:'sea'}),/obstruct/);
 const edited=ATLAS.editCells(w,{action:'fill_cells',expected_revision:w.revision,
  x:15,y:31,width:2,height:1,material:'sea'});
 assert.equal(edited.skipped_cells.length,1);
 assert.equal(edited.changed,1);
 assert.equal(TERRAIN.readTile(edited.world,2000,4000).material,'grass');
});
test('M73 rejects forged actor operations and preserves world on failed edits',()=>{
 let w=fresh();
 let before=JSON.stringify(w);
 assert.throws(()=>run(w,{action:'introduce_npc',name:'forged<script>',
  role:'guard',x:9,y:10}),/Invalid/);
 assert.throws(()=>run(w,{action:'step',direction:'northeast'}),/Cardinal/);
 assert.throws(()=>run(w,{action:'enter',x:9216,y:0}),/Create a saved character|Invalid/);
 assert.equal(JSON.stringify(w),before);
 assert.throws(()=>run(w,{action:'remove_npc',npc_id:'atlas_npc_4'}),/Unknown/);
 assert.equal(JSON.stringify(w),before);
});
test('M73 validates actor registry and player global coordinates strictly',()=>{
 let w=WORLD.createCharacter(fresh(),1,'TEST',NOW).world;
 w=place(w,9000,9000);
 w.characters['1'].atlas_position.x=-1;
 assert.throws(()=>WORLD.validateWorld(w),/Invalid/);
 w.characters['1'].atlas_position.x=9000;
 w.living.atlas_npcs.records.atlas_npc_1={role:'guard',x:9999};
 assert.throws(()=>ACTORS.validate(w),/Invalid/);
});
test('M73 connected UI uses existing art and explicit NPC placement, not auto-generated cities',()=>{
 const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
 const js=read('dk-world-explore-m73.js'),html=read('dk-world-explore-m73.html');
 assert.match(js,/assets\/art\/characters/);
 assert.match(js,/ctx.imageSmoothingEnabled=false/);
 assert.match(js,/worldActorCreate/);
 assert.match(js,/worldActorStep/);
 assert.match(js,/worldActorNPC/);
 assert.match(js,/pointerdown/);
 assert.match(html,/NPC WORLD WORKERS/);
 assert.match(read('dk-world-atlas-m70.js'),/dk-world-explore-m73[.]html/);
 assert.match(read('index.html'),/dkServerDevReset/);
 assert.match(read('server/local-game.cjs'),/dk-world-explore-m73[.]js/);
});
test('M73 connected HTTP character/NPC edits persist across restart and reset explicitly',async()=>{
 const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'dk-actors-m73-'));
 let instance;
 try{
  instance=await createDKServer({dataDir,port:0,tickMs:600000,now:()=>NOW});
  let base='http://127.0.0.1:'+instance.address.port;
  const get=()=>fetch(base+'/api/v1/world/actors').then(r=>r.json());
  const send=(body,header={})=>fetch(base+'/api/v1/world/actors',{
   method:'POST',headers:{'Content-Type':'application/json',...header},
   body:JSON.stringify(body)});
  assert.equal((await get()).has_character,false);
  let response=await send({action:'new_character',name:'DEREK',x:127,y:5000});
  assert.equal(response.status,403);
  response=await send({action:'new_character',name:'DEREK',x:127,y:5000},
   {'X-DK-World-Character':'new_character'});
  assert.equal(response.status,200);
  let view=await response.json();
  assert.equal(view.actor.name,'DEREK');
  assert.equal(view.actor.form,'living');
  assert.equal(view.actor.x,127);
  const originalCharacter=await fetch(base+'/api/v1/characters/1').then(r=>r.json());
  assert(originalCharacter.character.inventory);
  assert(originalCharacter.character.skills);
  response=await send({action:'step',direction:'east'},
   {'X-DK-World-Move':'step'});
  assert.equal(response.status,200);
  view=await response.json();assert.equal(view.actor.x,128);
  response=await send({action:'introduce_npc',name:'Wanderer',
   role:'scout',x:130,y:5000},{'X-DK-Architect':'atlas-npcs'});
  assert.equal(response.status,200);
  view=await response.json();
  assert.equal(view.npcs.length,1);
  const stored=JSON.parse(fs.readFileSync(path.join(dataDir,'world.json'),'utf8'));
  assert.equal(stored.characters['1'].atlas_position.x,128);
  assert.equal(stored.living.atlas_npcs.records.atlas_npc_1.role,'scout');
  await instance.close();instance=null;
  instance=await createDKServer({dataDir,port:0,tickMs:600000,now:()=>NOW});
  base='http://127.0.0.1:'+instance.address.port;
  view=await get();
  assert.equal(view.actor.x,128);
  assert.equal(view.npcs[0].name,'Wanderer');
  response=await fetch(base+'/api/v1/save/reset-world',{
   method:'POST',headers:{'Content-Type':'application/json','X-DK-Control':'reset-world'},
   body:JSON.stringify({confirm:'RESET WORLD',expected_revision:instance.world.revision})});
  assert.equal(response.status,200);
  view=await get();assert.equal(view.started,false);
  assert.equal(view.has_character,false);
  assert.equal(instance.world.characters['1'],undefined);
  assert.deepEqual(instance.world.living.atlas_npcs.records,{});
  assert.equal(TERRAIN.readTile(instance.world,4608,4608).material,'grass');
 }finally{
  if(instance)await instance.close();
  fs.rmSync(dataDir,{recursive:true,force:true});
 }
});
