'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const W=require('../server/world.cjs'),R=require('../server/regions.cjs');
const CELLS=require('../server/streaming-cells-m33.cjs');
const DRAFT=require('../server/interior-drafts-m35.cjs');
const {deleteCharacter}=require('../server/character-lifecycle-m26.cjs');
const {createDKServer}=require('../server/dk-server.cjs');
const NOW=Date.UTC(2026,10,7,18);
const CELL=CELLS.objectCellId(R.COURT,'courtyard_house_nw');
function sample(){return W.createCharacter(W.makeWorld(NOW),1,'ELIAS',NOW).world;}
function created(world,width=9,height=11){
 return DRAFT.edit(world,{action:'create_draft',cell_id:CELL,
  expected_revision:0,width,height,title:'Northwest House'});
}
function edit(world,action,fields={}){
 const old=world.living.interior_drafts.records[CELL];
 return DRAFT.edit(world,{action,cell_id:CELL,
  expected_revision:old?.revision||0,...fields});
}
test('M35 legacy saves migrate without inventing enterable interiors',()=>{
 const w=sample(),before=structuredClone(w);
 assert.equal(DRAFT.ensure(w),false);
 assert.deepEqual(DRAFT.listing(w).entries.length,15);
 assert.equal(DRAFT.read(w,CELL).draft,null);
 assert.equal(CELLS.catalogue(w).cells[CELL].interior_ready,false);
 delete before.living.interior_drafts;
 assert.equal(W.validateWorld(before),before,'old worlds without drafts remain valid');
 assert.equal(DRAFT.ensure(before),true);
 assert.equal(DRAFT.ensure(before),false);
 assert.equal(Object.keys(before.living.interior_drafts.records).length,0);
 W.validateWorld(before);
});
test('M35 create variable-size draft independent of outside building footprint',()=>{
 const w=sample(),unchanged=JSON.stringify(w),a=created(w,9,11);
 assert.equal(JSON.stringify(w),unchanged,'edits never mutate their input snapshot');
 const draft=a.draft;
 assert.equal(draft.status,'draft');assert.equal(draft.revision,1);
 assert.deepEqual([draft.width,draft.height],[9,11]);
 assert.deepEqual(draft.entry,{x:4,y:10});
 assert.equal(draft.layers.floor.length,99);
 assert.equal(draft.layers.walls[0],1);
 assert.equal(draft.layers.walls[10*9+4],0,'entry is unblocked');
 assert.equal(DRAFT.listing(a.world).entries.find(c=>c.cell_id===CELL).draft_revision,1);
 const link=CELLS.catalogue(a.world).cells[CELL];
 assert.equal(link.interior_ready,false,'draft must not enable gameplay access');
 assert.equal(link.draft_revision,1);
 assert.equal(a.world.areas[R.COURT].objects.find(o=>o.id==='courtyard_house_nw').interior_ready,false);
 assert.equal(DRAFT.read(a.world,CELL).draft.title,'Northwest House');
 W.validateWorld(a.world);
});
test('M35 draft tile paint, rectangular room geometry and durable furniture placement',()=>{
 let w=created(sample()).world;
 const patches=[
  {layer:'floor',x:1,y:1,value:'dark'},
  {layer:'floor',x:2,y:1,value:'cracked'},
  {layer:'wallStyles',x:0,y:0,value:'cracked'},
  {layer:'wallRotations',x:0,y:0,value:1},
  {layer:'walls',x:2,y:3,value:1}
 ];
 w=edit(w,'paint_tiles',{patches}).world;
 let d=DRAFT.read(w,CELL).draft;
 assert.equal(d.layers.floor[1*9+1],'dark');
 assert.equal(d.layers.floor[1*9+2],'cracked');
 assert.equal(d.layers.walls[3*9+2],1);
 assert.equal(d.revision,2);
 const object={id:'altar_1',type:'altar',x:3,y:2,w:2,h:3,r:0};
 w=edit(w,'place_object',{object}).world;
 d=DRAFT.read(w,CELL).draft;
 assert.equal(d.objects.length,1);
 assert.deepEqual(d.objects[0],object);
 assert.equal(d.revision,3);
 w=edit(w,'rename_draft',{title:'House of Candles'}).world;
 assert.equal(DRAFT.read(w,CELL).draft.title,'House of Candles');
 w=edit(w,'remove_object',{object_id:'altar_1'}).world;
 assert.equal(DRAFT.read(w,CELL).draft.objects.length,0);
 assert.equal(DRAFT.read(w,CELL).draft.revision,5);
 W.validateWorld(w);
});
test('M35 rejects stale edits and invalid room geometry atomically',()=>{
 const original=sample(),before=JSON.stringify(original);
 const first=created(original),w=first.world;
 assert.equal(JSON.stringify(original),before);
 const draftBefore=JSON.stringify(w);
 assert.throws(()=>DRAFT.edit(w,{action:'paint_tiles',cell_id:CELL,
  expected_revision:0,patches:[{layer:'floor',x:0,y:0,value:'dark'}]}),
  /Stale interior draft revision/);
 assert.throws(()=>edit(w,'paint_tiles',{patches:[
  {layer:'floor',x:1,y:1,value:'stone'},
  {layer:'floor',x:100,y:99,value:'dark'}]}),/Invalid interior tile patch/);
 assert.throws(()=>edit(w,'paint_tiles',{patches:[{
  layer:'walls',x:4,y:10,value:1}]}),/entry cannot be sealed/);
 assert.throws(()=>edit(w,'paint_tiles',{patches:[
  {layer:'floor',x:1,y:1,value:'dark'},
  {layer:'floor',x:1,y:1,value:'stone'}]}),/Duplicate interior tile patch/);
 assert.throws(()=>edit(w,'place_object',{object:{
  id:'bad_id',type:'door',x:8,y:10,w:4,h:1,r:0}}),/Invalid interior object placement/);
 assert.throws(()=>edit(w,'place_object',{object:{
  id:'script_1',type:'script',x:0,y:0,w:1,h:1,r:0}}),/Invalid interior object placement/);
 assert.throws(()=>edit(w,'publish_draft'),/Unsupported interior draft action/);
 assert.throws(()=>created(w),/Stale interior draft revision/);
 assert.equal(JSON.stringify(w),draftBefore,'rejected changes never alter saved data');
 W.validateWorld(w);
});
test('M35 restricts drafts to actual building cells with bounded room sizes',()=>{
 const w=sample();
 const invalid=(cell_id,width,height)=>DRAFT.edit(w,{action:'create_draft',
  cell_id,expected_revision:0,width,height});
 assert.throws(()=>invalid(CELLS.rootId(R.VILLAGE),10,10),/Unknown building/);
 assert.throws(()=>invalid('dk.cell.village/building/made_up',10,10),/Unknown building/);
 assert.throws(()=>invalid(CELL,64,64),/Invalid interior dimensions/);
 assert.throws(()=>invalid(CELL,3,10),/Invalid interior dimensions/);
 const good=invalid(CELL,16,12);
 assert.equal(good.draft.width*good.draft.height,192);
 const forged=structuredClone(good.world);
 forged.living.interior_drafts.records[CELL].layers.floor[0]='../../etc';
 assert.throws(()=>W.validateWorld(forged),/Invalid interior tile layer/);
 const bogus=structuredClone(good.world);
 bogus.living.interior_drafts.records[CELL].status='published';
 assert.throws(()=>W.validateWorld(bogus),/Invalid saved interior blueprint/);
});
test('M35 drafted rooms survive deleting a player without deleting town buildings',()=>{
 const w=created(sample()).world;
 const before=JSON.stringify(w.areas);
 const retired=deleteCharacter(w,1,'ELIAS').world;
 assert.deepEqual(DRAFT.read(retired,CELL).draft, DRAFT.read(w,CELL).draft);
 assert.equal(JSON.stringify(retired.areas),before);
 assert.equal(Object.keys(retired.characters).length,0);
 W.validateWorld(retired);
});
test('M35 DK Architect HTTP creation, changes, paused editing and restart are durable',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dk-m35-'));
 const app=await createDKServer({dataDir:dir,port:0,now:()=>NOW});
 let reopened=null;
 t.after(async()=>{
  if(app.server.listening)await app.close();
  if(reopened?.server.listening)await reopened.close();
  await fs.rm(dir,{recursive:true,force:true});
 });
 const base='http://127.0.0.1:'+app.address.port;
 const post=(body,control=true)=>fetch(base+'/api/v1/architect/interiors/draft',{
  method:'POST',headers:{'content-type':'application/json',...(control?{'x-dk-architect':'draft'}:{})},
  body:JSON.stringify(body)});
 const list=await fetch(base+'/api/v1/architect/interiors');
 assert.equal(list.status,200);
 const listing=await list.json();
 assert.equal(listing.entries.length,15);
 const creation={action:'create_draft',cell_id:CELL,
  expected_revision:0,width:9,height:11,title:'Northwest House'};
 assert.equal((await post(creation,false)).status,403);
 const result=await post(creation);
 assert.equal(result.status,200);
 assert.equal((await result.json()).draft_revision,1);
 const read=await fetch(base+'/api/v1/architect/interiors/draft?cell_id='+encodeURIComponent(CELL));
 assert.equal(read.status,200);
 assert.equal((await read.json()).draft.layers.floor.length,99);
 assert.equal((await post(creation)).status,409);
 const patch={action:'paint_tiles',cell_id:CELL,expected_revision:1,
  patches:[{layer:'floor',x:3,y:2,value:'sigil'}]};
 assert.equal((await post(patch)).status,200);
 assert.equal((await post({...patch,expected_revision:1})).status,409);
 assert.equal((await post({...patch,expected_revision:2,
  patches:[{layer:'floor',x:99,y:99,value:'stone'}]})).status,422);
 assert.equal((await fetch(base+'/api/v1/architect/interiors/draft?cell_id=not-valid')).status,404);
 const staticUi=await fetch(base+'/dk-architect-interiors-m35.html');
 assert.equal(staticUi.status,200);
 assert((await staticUi.text()).includes('Interior Drafts'));
 const staticJs=await fetch(base+'/dk-architect-interiors-m35.js');
 assert.equal(staticJs.status,200);
 assert((await staticJs.text()).includes('DK Architect M35'));
 const privateCode=await fetch(base+'/server/interior-drafts-m35.cjs');
 assert.notEqual(privateCode.status,200);
 const paused=await fetch(base+'/api/v1/server/stop',{method:'POST',
  headers:{'x-dk-control':'stop'}});
 assert.equal(paused.status,200);
 assert.equal((await post({action:'rename_draft',cell_id:CELL,
  expected_revision:2,title:'Restored Room'})).status,200,
  'DK Architect can edit drafts while the world is paused');
 await app.close();
 const saved=JSON.parse(await fs.readFile(path.join(dir,'world.json'),'utf8'));
 const draft=saved.living.interior_drafts.records[CELL];
 assert.equal(draft.revision,3);
 assert.equal(draft.title,'Restored Room');
 assert.equal(draft.layers.floor[2*9+3],'sigil');
 assert.equal(saved.areas[R.COURT].objects.find(o=>o.id==='courtyard_house_nw').interior_ready,false);
 reopened=await createDKServer({dataDir:dir,port:0,now:()=>NOW+5000});
 assert.equal(DRAFT.read(reopened.world,CELL).draft.title,'Restored Room');
 assert.equal(DRAFT.read(reopened.world,CELL).draft.layers.floor[2*9+3],'sigil');
 W.validateWorld(reopened.world);
});
