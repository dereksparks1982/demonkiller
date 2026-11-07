'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
function source(file){return fs.readFileSync(path.join(root,file),'utf8');}
test('M27 gameplay has no on-screen cult/character/backpack shortcut buttons',()=>{
 const temple=source('test-center.html'),outdoors=source('outdoor.html');
 for(const id of ['cultJournalToggle','templePaperButton','templeBagButton'])
  assert.doesNotMatch(temple,new RegExp('id="'+id+'"'));
 for(const id of ['openPaperDoll','openBackpack'])
  assert.doesNotMatch(outdoors,new RegExp('id="'+id+'"'));
});
test('M27 keyboard shortcuts remain bound in the temple and outdoors',()=>{
 assert.match(source('test-center.js'),/e\.key\.toLowerCase\(\)==='c'/);
 assert.match(source('temple-ui.js'),/key==='p'\|\|key==='i'/);
 assert.match(source('outdoor.html'),/key==='p'\|\|key==='i'/);
});
test('M27 live server serves both interface scripts without exposing server files',()=>{
 const local=source('server/local-game.cjs');
 for(const asset of ['temple-ui.js','temple-ui.css','outdoor-ui.js'])
  assert.match(local,new RegExp("'"+asset.replace(/[.]/g,'\\.')+"'"));
 assert.doesNotMatch(local,/ROOT_FILES[^;]*'dk-server\.cjs'/);
});
test('M27 browser game scripts remain syntactically valid',()=>{
 for(const file of ['test-center.js','temple-ui.js','outdoor.js','outdoor-ui.js','dk-menu-server.js']){
  assert.doesNotThrow(()=>new vm.Script(source(file),{filename:file}));
 }
});
