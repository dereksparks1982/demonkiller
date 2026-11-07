'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('M30 renders graves and active scavengers in the persistent ground layer',()=>{
 const js=src('outdoor.js');
 const order=['drawTerrainMarks();','drawBurials();','drawCorpses();','drawScavengers();','drawNpcs();'];
 let position=-1;
 for(const needle of order){
  const start=js.indexOf(' '+needle,position+1);
  assert(start>position,'Render order missing '+needle);position=start;
 }
 assert.match(js,/living\?\.burials/);
 assert.match(js,/living\?\.scavengers/);
 assert.match(js,/grave\.stage==='overgrown'/);
 assert.match(js,/animal\.kind==='raven'/);
 assert.doesNotThrow(()=>new vm.Script(js,{filename:'outdoor.js'}));
});
test('M30 adds B burial without another gameplay button or changes to walk controls',()=>{
 const game=src('outdoor.js'),html=src('outdoor.html');
 assert.match(game,/e\.key\.toLowerCase\(\)==='b'/);
 assert.match(game,/takeAction\('bury_corpse',\{corpse_id:corpse\.id\}\)/);
 assert.match(game,/window\.confirm\('Bury '/);
 assert.match(game,/if\(dir\)\{e\.preventDefault\(\);step\(dir\);\}/);
 for(const id of ['openPaperDoll','openBackpack','buryButton','scavengerButton'])
  assert(!html.includes('id="'+id+'"'));
 assert.match(html,/outdoor\.js\?v=/);
});
test('M30 server advertises graves and scavenger mobiles with nearby sector queries',()=>{
 const server=src('server/dk-server.cjs'),sector=src('server/sectors-m10.cjs');
 assert.match(server,/burials:l\.burials\?\.records\|\|\{\}/);
 assert.match(server,/scavengers:l\.scavengers\?\.visitors\|\|\{\}/);
 assert.match(server,/build: 'local-m31'/);
 assert.match(sector,/kind:'grave'/);
 assert.match(sector,/kind:'scavenger'/);
 const reference=src('server/entity-registry-m10.cjs');
 assert.match(reference,/scavenger:/);
 assert.match(reference,/grave:/);
});
