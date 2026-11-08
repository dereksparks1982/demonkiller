'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const R=require('../world-regions.js');
test('M37 temple Architect button opens a bottom construction dock, not old floating builder',()=>{
 const html=read('test-center.html'),dock=read('dk-architect-temple-m37.js'),
  css=read('dk-architect-dock-m37.css');
 assert.match(html,/id="editMode"/);
 assert.match(html,/dk-architect-temple-m37\.js/);
 assert.match(html,/dk-architect-dock-m37\.css/);
 assert.match(dock,/edit\.addEventListener\('click',\(\)=>sync\(true\)\)/);
 assert.match(dock,/walk\.addEventListener\('click',\(\)=>sync\(false\)\)/);
 assert.match(dock,/event\.key!=='F8'/);
 assert.match(dock,/event\.preventDefault\(\);event\.stopImmediatePropagation\(\)/);
 assert.match(dock,/originalViewport=\$\('uoPaletteViewport'\)/);
 assert.match(dock,/palette\.append\(originalViewport\)/);
 for(const group of ['foundations','materials','rooms','objects','staff',
  'utilities','deployment','logistics','intelligence','emergencies','clone','planning'])
  assert(dock.includes("id:'"+group+"'"),'Missing tab '+group);
 assert.match(css,/body\.dk-architect-v37 #architectWindow\{display:none!important\}/);
 assert.match(css,/#dkArchitectDock\{position:fixed;z-index:80;bottom:0/);
 assert.doesNotThrow(()=>new vm.Script(dock));
});
test('M37 outdoor Architect is opened in the live game, and F8 works without server',()=>{
 const html=read('outdoor.html'),game=read('dk-architect-game-m37.js'),
  world=read('outdoor.js'),host=read('server/local-game.cjs');
 assert.match(html,/id="editMode"/);
 assert.match(html,/id="dkOutdoorArchitect"/);
 assert.match(html,/id="dkOutdoorArchitectFrame"/);
 assert.match(html,/dk-architect-game-m37\.js/);
 assert.match(game,/button\.addEventListener\('click',toggle\)/);
 assert.match(game,/if\(e\.key!=='F8'/);
 assert.match(game,/frame\.src='\.\/dk-architect-outdoors-m36\.html\?'/);
 assert.match(game,/window\.dispatchEvent\(new Event\('dk-architect-resume'\)\)/);
 assert.match(world,/dk-architect-resume/);
 assert.match(world,/DKOutdoorArchitect\?\.isOpen\(\)/);
 assert.doesNotMatch(world,/World editing needs the local DK Server/);
 for(const f of ['dk-architect-game-m37.js','dk-architect-temple-m37.js',
  'dk-architect-preview-m37.js','dk-architect-dock-m37.css'])
  assert(host.includes("'"+f+"'"),'Local server cannot serve '+f);
 assert.doesNotThrow(()=>new vm.Script(game));
});
test('M37 outdoor build bar shows categorized buttons and functional tool submenus',()=>{
 const html=read('dk-architect-outdoors-m36.html'),
  js=read('dk-architect-outdoors-m36.js');
 for(const group of ['foundations','materials','rooms','objects','staff',
  'utilities','deployment','logistics','intelligence','emergencies','clone','planning'])
  assert(html.includes('data-group="'+group+'"'),'Missing bottom category '+group);
 for(const mode of ['select','move','door','erase','ground','inspect'])
  assert(html.includes('data-tool="'+mode+'"'),'Missing subtool '+mode);
 assert.match(js,/function groupSet\(name\)/);
 assert.match(js,/document\.querySelectorAll\('\[data-group\]'\)/);
 assert.match(js,/window\.parent\.postMessage\(\{dkArchitect:'close'\}/);
 assert.match(html,/dk-architect-preview-m37\.js/);
 assert.doesNotThrow(()=>new vm.Script(js));
});
test('M37 static preview edits map-only browser drafts and exports without server writes',async()=>{
 const src=read('dk-architect-preview-m37.js');
 const storage=new Map();
 const context={window:{DemonKillerRegions:R},
  localStorage:{
   getItem:key=>storage.get(key)||null,
   setItem:(key,val)=>storage.set(key,val)
  },
  JSON,Set,Object,Number,Error,Math};
 vm.runInNewContext(src,context,{filename:'dk-architect-preview-m37.js'});
 const api=context.window.DemonKillerServer;
 assert(context.window.DKArchitectPreviewActive);
 const prev=await api.area(R.COURT);
 const oldHouse=prev.area.objects.find(o=>o.id==='courtyard_house_sw');
 assert(oldHouse);
 const first=await api.editOutdoor('move_building',R.COURT,prev.revision,
  {object_id:oldHouse.id,x:oldHouse.x+1,y:oldHouse.y});
 assert.equal(first.revision,1);
 const saved=await api.area(R.COURT),moved=saved.area.objects.find(o=>o.id===oldHouse.id);
 assert.equal(moved.x,oldHouse.x+1);
 assert.equal(moved.door.x,oldHouse.door.x+1);
 const exportJSON=await api.exportOutdoor(R.COURT);
 assert.equal(exportJSON.format,'dk.outdoor.layout.m36');
 assert.equal(exportJSON.preview_draft,true);
 assert.equal(exportJSON.map.objects.find(o=>o.id===oldHouse.id).x,oldHouse.x+1);
 assert(!('living' in exportJSON));
 await assert.rejects(()=>api.editOutdoor('move_building',R.COURT,0,
  {object_id:oldHouse.id,x:oldHouse.x+2,y:oldHouse.y}),/Stale exterior revision/);
 assert.equal((await api.area(R.COURT)).revision,1);
});
test('M37 game preview actually reloads edited layout while keeping character saves separate',()=>{
 const world=read('outdoor.js'),preview=read('dk-architect-preview-m37.js');
 assert(world.includes("const key='dkSoftworks.demonkiller.architect.outdoorDraft.m37.'+id"));
 assert(preview.includes("const KEY='dkSoftworks.demonkiller.architect.outdoorDraft.m37.'"));
 assert(world.includes('return R.checkRegion(record.area)'));
 assert.match(preview,/localStorage\.setItem\(KEY\+id/);
 assert(!preview.includes('dkSoftworks.demonkiller.characters.v1'));
});
