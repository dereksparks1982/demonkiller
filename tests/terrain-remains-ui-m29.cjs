'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('M29 outdoor terrain remains render before people, without modifying player collision',()=>{
 const src=read('outdoor.js');
 const a=src.indexOf(' drawTerrainMarks();');
 const b=src.indexOf(' drawCorpses();',a);
 const c=src.indexOf(' drawNpcs();',b);
 assert(a>0&&b>a&&c>b,'Ground trace, corpse and NPC draw order must be maintained');
 assert.match(src,/const stage=body\.stage\|\|'fresh'/);
 for(const stage of ['fresh','early','decaying','skeletal','scattered'])
  assert(src.includes(stage),'missing visual stage '+stage);
 assert.match(src,/body\.kind==='monster'/);
 assert.match(src,/drawTerrainMarks/);
 assert.doesNotThrow(()=>new vm.Script(src,{filename:'outdoor.js'}));
});
test('M29 server exposes only saved world remains and terrain marks',()=>{
 const server=read('server/dk-server.cjs');
 assert.match(server,/mobile_assets:\{corpses:l\.mobile_assets\?\.corpses\|\|\{\},/);
 assert.match(server,/terrain_marks:l\.mobile_assets\?\.terrain_marks\|\|\{\}/);
 assert.match(server,/build: 'local-m36'/);
 const scheduler=read('server/world-scheduler-m11.cjs');
 assert.match(scheduler,/corpse_cleanup:expireCorpses/);
});
test('M29 keeps gameplay shortcuts keyboard-only',()=>{
 const temple=read('test-center.html'),outdoor=read('outdoor.html');
 for(const id of ['templePaperButton','templeBagButton','cultJournalToggle'])
  assert(!temple.includes('id="'+id+'"'));
 for(const id of ['openPaperDoll','openBackpack'])
  assert(!outdoor.includes('id="'+id+'"'));
 assert.match(temple,/temple-ui\.js/);
 assert.match(outdoor,/outdoor\.js\?v=/);
});
