'use strict';
/* M37 regression expectations updated when the owner replaced its split
 * editors with the one shared M39 controller. Keep verifying the older
 * promises against the CURRENT active implementation. */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const R=require('../world-regions.js');
test('M37 promise: Architect button/F8 still open construction mode in BOTH scenes',()=>{
 const temple=read('test-center.html'),outdoors=read('outdoor.html');
 const th=read('dk-architect-temple-host-m39.js');
 const oh=read('dk-architect-world-host-m39.js');
 assert.match(temple,/id="editMode"/);assert.match(outdoors,/id="editMode"/);
 assert.match(temple,/dk-architect-temple-host-m39\.js/);
 assert.match(outdoors,/dk-architect-world-host-m39\.js/);
 assert.match(th,/e\.key!=='F8'/);assert.match(oh,/e\.key==='F8'/);
 assert.match(th,/button\.addEventListener\('click',\(\)=>sync\(true\)\)/);
 assert.match(oh,/button\.addEventListener\('click',\(\)=>open\?close\(\):openEditor\(\)\)/);
 assert.doesNotMatch(outdoors,/<iframe/);
 assert.match(oh,/const game=\$\('world'\)/);
});
test('M37 promise: real bottom category menus and real tool selection in both areas',()=>{
 const ui=read('dk-architect-ui-m39.js'),core=read('dk-architect-core-m39.js');
 const menuCss=read('dk-architect-ui-m39.css');
 for(const id of ['foundations','materials','rooms','objects','staff',
  'utilities','deployment','logistics','intelligence','emergencies','clone','planning'])
  assert(ui.includes("'"+id+"'"),'Missing construction category '+id);
 assert.match(ui,/id="dkPaFlyout"/);
 assert.match(ui,/id="dkPaCategories"/);
 assert.match(ui,/id="dkPaAssetCards"/);
 assert.match(ui,/await model\.chooseTool\(tool\)/);
 assert.match(core,/host\.execute\(/);
 assert.match(menuCss,/\.dk-pa-flyout\{position:absolute;bottom:69px/);
});
test('M37 promise: temple uses original pixel art palette and drag tools',()=>{
 const host=read('dk-architect-temple-host-m39.js');
 const temple=read('test-center.js');
 assert.match(temple,/window\.DKArchitectCatalog\.objects/);
 assert.match(host,/const core=Core\.create\(/);
 assert.match(host,/window\.DKTempleArchitectBridge\?\.preview/);
 assert.match(host,/window\.DKTempleArchitectBridge\?\.move/);
 assert.match(host,/room\.addEventListener\('pointerdown'/);
 assert.match(host,/room\.addEventListener\('pointerup'/);
 assert.match(temple,/window\.DKTempleArchitectBridge=Object\.freeze/);
 assert.match(temple,/architectMovePreview/);
});
test('M37 promise: outdoor editing works in public preview, no imaginary server',async()=>{
 const storage=new Map(),window={DemonKillerRegions:R};
 const sandbox=vm.createContext({window,localStorage:{
  getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)
 }});
 for(const script of ['dk-architect-catalog-m39.js','dk-architect-exterior-m38.js',
  'dk-architect-preview-m37.js'])vm.runInContext(read(script),sandbox);
 const api=window.DemonKillerServer;
 assert(api);
 const old=await api.area(R.COURT),house=old.area.objects.find(o=>o.id==='courtyard_house_sw');
 const result=await api.editOutdoor('move_building',R.COURT,old.revision,
  {object_id:house.id,x:house.x+1,y:house.y});
 assert.equal(result.revision,old.revision+1);
 const updated=await api.area(R.COURT);
 assert.equal(updated.area.objects.find(o=>o.id===house.id).x,house.x+1);
 assert.equal((await api.exportOutdoor(R.COURT)).preview_draft,true);
 assert.equal(storage.size,1);
});
test('M37 promise: new scripts parse and local host serves the active files',()=>{
 const host=read('server/local-game.cjs');
 for(const filename of ['dk-architect-ui-m39.js','dk-architect-ui-m39.css',
  'dk-architect-core-m39.js','dk-architect-catalog-m39.js',
  'dk-architect-temple-host-m39.js','dk-architect-world-host-m39.js']){
  assert(host.includes("'"+filename+"'"));
 }
 for(const filename of ['dk-architect-temple-host-m39.js','dk-architect-world-host-m39.js',
  'dk-architect-ui-m39.js','dk-architect-core-m39.js','dk-architect-catalog-m39.js'])
  assert.doesNotThrow(()=>new vm.Script(read(filename),{filename}));
});
