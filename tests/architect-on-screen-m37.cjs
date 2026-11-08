'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const R=require('../world-regions.js');
test('M38 replaces the M37 two-editor arrangement in both playable screens',()=>{
 const temple=read('test-center.html'),outside=read('outdoor.html');
 assert(temple.includes('id="editMode"'));
 assert(outside.includes('id="editMode"'));
 for(const s of [temple,outside]){
  assert.match(s,/dk-architect-menu-m38\.css/);
  assert.match(s,/dk-architect-menu-m38\.js/);
 }
 assert.match(temple,/dk-architect-temple-m38\.js/);
 assert.match(outside,/dk-architect-game-m38\.js/);
 assert.doesNotMatch(temple,/dk-architect-temple-m37\.js/);
 assert.doesNotMatch(outside,/dk-architect-game-m37\.js/);
 assert.doesNotMatch(outside,/<iframe/);
});
test('M38 shared PA category bar and context flyout are the actual editor menus',()=>{
 const ui=read('dk-architect-menu-m38.js');
 const css=read('dk-architect-menu-m38.css');
 for(const key of ['foundations','materials','rooms','objects','staff',
  'utilities','deployment','logistics','intelligence','emergencies','clone','planning'])
  assert(ui.includes("'"+key+"'"),'Missing Prison Architect category: '+key);
 assert(ui.includes('class="dk-pa-flyout"'));
 assert(ui.includes('class="dk-pa-bottom"'));
 assert.match(css,/\.dk-pa-flyout\{position:absolute;bottom:69px/);
 assert.match(css,/\.dk-pa-tool-grid\{display:grid/);
 assert.match(ui,/button\.disabled=!yes/);
 assert.doesNotThrow(()=>new vm.Script(ui));
});
test('M38 temple menu keeps original DK Architect tools and sprites, F8 works',()=>{
 const adapter=read('dk-architect-temple-m38.js');
 assert.match(adapter,/window\.DKArchitectMenus\.create/);
 assert.match(adapter,/palette=\$\('uoPaletteViewport'\)/);
 assert.match(adapter,/button\.addEventListener\('click',\(\)=>refresh\(true\)\)/);
 assert.match(adapter,/e\.key!=='F8'/);
 assert.match(adapter,/e\.stopImmediatePropagation\(\)/);
 assert.match(adapter,/place_door:'tool:door'/);
 assert.doesNotThrow(()=>new vm.Script(adapter));
});
test('M38 outdoor editor edits the real viewport rather than a new map',()=>{
 const adapter=read('dk-architect-game-m38.js'),game=read('outdoor.js');
 assert.match(adapter,/const game=\$\('world'\)/);
 assert.match(adapter,/game\.parentElement\.insertBefore\(wrap,game\)/);
 assert.match(adapter,/bridge\.snapshot\(\)/);
 assert.match(adapter,/bridge\.pan\(/);
 assert.match(adapter,/bridge\.zoom\(/);
 assert.match(adapter,/GEOMETRY|Geo\.test/);
 assert.match(adapter,/async function submit\(/);
 assert.match(adapter,/api\.editOutdoor\(/);
 assert.match(adapter,/window\.DKOutdoorArchitect=Object\.freeze/);
 assert.match(game,/window\.DKOutdoorArchitectBridge=Object\.freeze/);
 assert.match(game,/architectCamera/);
 assert.doesNotMatch(adapter,/<iframe|\.src='\.\/dk-architect-outdoors-m36\.html/);
 assert.doesNotThrow(()=>new vm.Script(adapter));
});
test('M38 public browser draft still preserves exports separately from characters',async()=>{
 const src=read('dk-architect-preview-m37.js'),shared=read('dk-architect-exterior-m38.js');
 const storage=new Map();
 const context={window:{DemonKillerRegions:R},
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
  JSON,Set,Object,Number,Error,Math};
 vm.runInNewContext(shared,context);
 vm.runInNewContext(src,context);
 const api=context.window.DemonKillerServer;
 const before=await api.area(R.COURT);
 const first=await api.previewOutdoor('move_building',R.COURT,
  {object_id:'courtyard_house_sw',x:6,y:37});
 assert.equal(first.ok,true,first.error);
 await api.editOutdoor('move_building',R.COURT,before.revision,
  {object_id:'courtyard_house_sw',x:6,y:37});
 const after=await api.area(R.COURT);
 assert.equal(after.area.objects.find(o=>o.id==='courtyard_house_sw').x,6);
 assert.equal(after.revision,1);
 const exportData=await api.exportOutdoor(R.COURT);
 assert.equal(exportData.preview_draft,true);
 assert.equal(exportData.map.tile_size,32);
 assert(!('characters' in exportData)&&!('living' in exportData));
 assert(!src.includes('dkSoftworks.demonkiller.characters.v1'));
});
