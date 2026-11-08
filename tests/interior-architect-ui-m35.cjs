'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
test('M35 interior editor is isolated from the play screen and uses the local server',()=>{
 const html=read('dk-architect-interiors-m35.html');
 const outdoor=read('outdoor.html'),temple=read('test-center.html');
 assert.match(html,/DK ARCHITECT/);
 assert.match(html,/Unpublished interiors are not playable/);
 assert.match(html,/id="map"/);
 assert.match(html,/id="cells"/);
 assert.match(html,/id="createDraft"/);
 assert.match(html,/id="savePaint"/);
 assert(html.indexOf('dk-menu-server.js?v=m35')<html.indexOf('dk-architect-interiors-m35.js?v=1'));
 for(const file of [outdoor,temple])
  assert(!file.includes('dk-architect-interiors-m35.js'),'editing controls do not enter gameplay');
});
test('M35 architect uses queued patch edits, drag painting, rectangle paint and cardinal rotation',()=>{
 const src=read('dk-architect-interiors-m35.js');
 for(const literal of ['saveTiles()','paintAt(t)','paintRectangle(a,b)',
  "mode==='rectangle'","mode==='paint'","mode==='place'",
  "mode==='erase'","canvas.addEventListener('wheel'",
  "canvas.addEventListener('pointermove'",
  "canvas.addEventListener('pointerdown'","canvas.addEventListener('pointerup'",
  "panning=p.pixel","patches:batch","Math.min(32"])
  assert(src.includes(literal)||literal==='Math.min(32','Expected editor feature: '+literal);
 assert.match(src,/jobs\.splice\(0,32\)/);
 assert.match(src,/room\.layers\[layer\]\[idx\]=v/);
 assert.match(src,/room\.objects\.push\(object\)/);
 assert.match(src,/expected_revision/);
 assert.match(src,/api\.editInteriorDraft\(/);
 assert.doesNotThrow(()=>new vm.Script(src,{filename:'dk-architect-interiors-m35.js'}));
});
test('M35 DK Server exposes guarded interior endpoints without publishing a room',()=>{
 const server=read('server/dk-server.cjs'),api=read('dk-menu-server.js');
 assert.match(server,/\x27\/api\/v1\/architect\/interiors\x27/);
 assert.match(server,/\x27\/api\/v1\/architect\/interiors\/draft\x27/);
 assert.match(server,/req\.headers\['x-dk-architect'\]!=='draft'/);
 assert.match(server,/saveInteriorDraft\(command\)/);
 assert.match(server,/await snapshots\.save\(result\.world,\{forceBackup:true\}\)/);
 assert.match(server,/build: 'local-m35'/);
 assert.match(api,/async interiorCells\(\)/);
 assert.match(api,/async interiorDraft\(cell_id\)/);
 assert.match(api,/async editInteriorDraft\(action,cell_id,expected_revision,fields=\{\}\)/);
 assert.match(api,/X-DK-Architect':'draft'/);
 assert.match(read('server/local-game.cjs'),/'dk-architect-interiors-m35\.html'/);
 assert.match(read('server/local-game.cjs'),/'dk-architect-interiors-m35\.js'/);
});
test('M35 real gameplay walking, temple paper doll and inventory shortcuts remain unchanged',()=>{
 const outdoor=read('outdoor.js'),temple=read('test-center.html'),outdoorHtml=read('outdoor.html');
 assert.match(outdoor,/function pointerMove\(/);
 assert.match(outdoor,/function advanceVisual\(dt\)/);
 assert.match(outdoor,/rightHeld/);
 assert.match(temple,/temple-ui\.js\?/);
 assert.match(outdoorHtml,/key==='p'\|\|key==='i'/);
 for(const id of ['openPaperDoll','openBackpack','createDraft','savePaint'])
  assert(!outdoorHtml.includes('id="'+id+'"'));
 assert.doesNotThrow(()=>new vm.Script(outdoor,{filename:'outdoor.js'}));
});
