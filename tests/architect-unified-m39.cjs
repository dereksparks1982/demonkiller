'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const R=require('../world-regions.js'),G=require('../dk-architect-exterior-m38.js');
const ARCH=require('../server/outdoor-architect-m36.cjs');
const W=require('../server/world.cjs');
const NOW=Date.UTC(2026,10,8,5);
test('M39 uses one actual controller and original asset catalogue across temple and outdoors',()=>{
 const temple=read('test-center.html'),outside=read('outdoor.html'),main=read('test-center.js');
 for(const page of [temple,outside]){
  for(const script of ['dk-architect-catalog-m39.js','dk-architect-core-m39.js',
   'dk-architect-ui-m39.js','dk-architect-ui-m39.css'])
   assert(page.includes(script),script+' missing from both game scenes');
 }
 assert(temple.includes('dk-architect-temple-host-m39.js'));
 assert(outside.includes('dk-architect-world-host-m39.js'));
 assert(!temple.includes('dk-architect-temple-m38.js'));
 assert(!outside.includes('dk-architect-game-m38.js'));
 assert(!outside.includes('<iframe'));
 assert(main.includes('const CATALOG=window.DKArchitectCatalog.objects'));
 assert(main.includes('const ARCHITECT_SPRITES=window.DKArchitectCatalog.sprites'));
 assert(main.includes('const GROUPS=window.DKArchitectCatalog.groups'));
 assert(main.includes('b.dataset.assetId=key'));
 for(const src of ['dk-architect-catalog-m39.js','dk-architect-core-m39.js',
  'dk-architect-ui-m39.js','dk-architect-temple-host-m39.js',
  'dk-architect-world-host-m39.js','outdoor.js','test-center.js'])
  assert.doesNotThrow(()=>new vm.Script(read(src),{filename:src}));
});
test('M39 Prison Architect menus are functional category flyouts with shared searchable assets',()=>{
 const model=read('dk-architect-core-m39.js'),ui=read('dk-architect-ui-m39.js');
 for(const category of ['foundations','materials','rooms','objects','staff','utilities',
  'deployment','logistics','intelligence','emergencies','clone','planning'])
  assert(ui.includes("'"+category+"'"));
 assert(ui.includes('class="dk-pa-bottom"'));
 assert(ui.includes('class="dk-pa-flyout"'));
 assert(ui.includes('class="dk-pa-assets"'));
 assert(ui.includes('id="dkPaSearch"'));
 assert(ui.includes('await model.chooseTool(tool)'));
 assert(ui.includes('await model.chooseAsset(asset)'));
 assert(model.includes('host.execute('));
 assert(model.includes('function rotate('));
});
test('M39 entire building movement, physical objects, and solid collisions are real',()=>{
 let world=W.createCharacter(W.makeWorld(NOW),1,'EDITOR',NOW).world;
 const original=world.areas[R.COURT].objects.find(o=>o.id==='courtyard_house_sw');
 const oldX=original.x,oldDoor=original.door.x;
 world=ARCH.edit(world,{action:'move_building',area_id:R.COURT,
  expected_revision:world.revision,object_id:original.id,x:oldX+1,y:37}).world;
 const house=world.areas[R.COURT].objects.find(o=>o.id===original.id);
 assert.equal(house.x,oldX+1);assert.equal(house.door.x,oldDoor+1);
 assert.equal(world.living.housing.records[house.id].x,oldX+1);
 W.validateWorld(world);
 const prop={id:'architect_prop_test001',assetType:'pew',assetId:null,
  spriteId:null,r:0,x:20,y:8};
 world=ARCH.edit(world,{action:'place_prop',area_id:R.COURT,
  expected_revision:world.revision,...prop}).world;
 const placed=world.areas[R.COURT].objects.find(o=>o.id===prop.id);
 assert(placed);assert.equal(placed.w,2);
 assert(!R.traversable(world.areas[R.COURT],20,8,'living'));
 assert(R.traversable(world.areas[R.COURT],20,8,'ghost'));
 world=ARCH.edit(world,{action:'rotate_prop',area_id:R.COURT,
  expected_revision:world.revision,object_id:prop.id,r:1}).world;
 assert.equal(world.areas[R.COURT].objects.find(o=>o.id===prop.id).h,2);
 world=ARCH.edit(world,{action:'move_prop',area_id:R.COURT,
  expected_revision:world.revision,object_id:prop.id,x:22,y:8}).world;
 world=ARCH.edit(world,{action:'remove_prop',area_id:R.COURT,
  expected_revision:world.revision,object_id:prop.id}).world;
 assert(!world.areas[R.COURT].objects.some(o=>o.id===prop.id));
 W.validateWorld(world);
});
test('M39 wall strokes, floor tiles, spawn, and tile undo use one checked transaction',()=>{
 let world=W.createCharacter(W.makeWorld(NOW),1,'EDITOR',NOW).world;
 const sample=(w,x,y)=>Object.assign({x,y},
  Object.fromEntries(G.FIELDS.map(k=>[k,w.areas[R.COURT][k][y*64+x]])));
 const before=sample(world,18,37),points=[{x:18,y:37},{x:19,y:37}];
 world=ARCH.edit(world,{action:'wall_batch',area_id:R.COURT,
  expected_revision:world.revision,tiles:points,erase:false,
  wallPack:'ox72',wallAsset:null,rotation:1}).world;
 assert.equal(world.areas[R.COURT].wallPacks[37*64+18],'ox72');
 assert.equal(world.areas[R.COURT].walls[37*64+19],1);
 const back=[before,sample(W.makeWorld(NOW),19,37)];
 world=ARCH.edit(world,{action:'restore_tiles',area_id:R.COURT,
  expected_revision:world.revision,tiles:back}).world;
 assert.equal(world.areas[R.COURT].walls[37*64+18],0);
 world=ARCH.edit(world,{action:'paint_ground',area_id:R.COURT,
  expected_revision:world.revision,x:18,y:37,floor:'dark'}).world;
 assert.equal(world.areas[R.COURT].floor[37*64+18],'dark');
 world=ARCH.edit(world,{action:'set_spawn',area_id:R.COURT,
  expected_revision:world.revision,x:20,y:22}).world;
 assert.deepEqual(world.areas[R.COURT].spawn,{x:20,y:22});
 assert.throws(()=>ARCH.edit(world,{action:'wall_batch',area_id:R.COURT,
  expected_revision:world.revision,tiles:[{x:31,y:26}],erase:false}),/protected|wall|path/i);
 W.validateWorld(world);
});
test('M39 local browser drafts do not mutate character saves or require a server',async()=>{
 const source=['dk-architect-catalog-m39.js','dk-architect-exterior-m38.js',
  'dk-architect-preview-m37.js'].map(read);
 const storage=new Map(),context={window:{DemonKillerRegions:R},
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
  JSON,Set,Object,Number,Error,Math};
 const sandbox=vm.createContext(context);
 for(const code of source)vm.runInContext(code,sandbox);
 const api=context.window.DemonKillerServer;
 const original=await api.area(R.VILLAGE);
 assert.equal(original.revision,0);
 const item={id:'architect_prop_browser001',assetType:'scenery',
  assetId:null,spriteId:'human',x:20,y:39,r:0};
 await api.editOutdoor('place_prop',R.VILLAGE,0,item);
 const changed=await api.area(R.VILLAGE);
 assert.equal(changed.revision,1);
 assert(changed.area.objects.some(o=>o.id===item.id));
 const exported=await api.exportOutdoor(R.VILLAGE);
 assert(exported.preview_draft);assert.equal(exported.map.area_id,R.VILLAGE);
 assert(!('characters' in exported)&&!('living' in exported));
 await assert.rejects(()=>api.editOutdoor('remove_prop',R.VILLAGE,0,
  {object_id:item.id}),/Stale exterior revision/);
 assert.equal(storage.size,1,'Only one map-draft key is persisted');
});
test('M39 conserves GitHub Actions: CI manual only, Pages deployment remains available',()=>{
 const workflow=read('.github/workflows/server-tests.yml');
 assert.match(workflow,/workflow_dispatch:/);
 assert.doesNotMatch(workflow,/^\s+push:/m);
 assert.match(read('README.md'),/manual-only/);
});
