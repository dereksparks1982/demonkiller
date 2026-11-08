'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('Paper dolls never contain destructive save controls in either region',()=>{
 for(const html of ['test-center.html','outdoor.html']){
  const s=source(html);
  assert(!s.includes('id="templeDeleteSave"'));
  assert(!s.includes('id="deleteInGameSave"'));
  assert(s.includes('dk-paperdoll-m40.css'));
  assert(s.includes('dk-paperdoll-m40.js'));
 }
 for(const p of ['temple-ui.js','outdoor-ui.js'])
  assert(!/deleteCharacter|DELETE SAVE|deleteInGameSave|templeDeleteSave/.test(source(p)));
});
test('Paper doll contains actual UO Classic command rail, not invented save deletion',()=>{
 const code=source('dk-paperdoll-m40.js');
 for(const name of ['HELP','OPTIONS','LOG OUT','JOURNAL','SKILLS',
   'GUILD','QUESTS','PEACE / WAR','STATUS','BACKPACK','PROFILE'])
   assert(code.includes("menu('"+name+"'"),name+' missing from classic-style menu');
 assert(code.includes("menu('GUILD',()=>{},")&&code.includes("menu('QUESTS',()=>{},"));
 assert(code.includes("menu('PEACE / WAR',()=>{},"));
 assert(code.includes('DemonKillerServer.skills()'));
 assert(code.includes('./index.html?view=options'));
 assert(code.includes("location.href='./index.html'"));
 assert(!code.includes('deleteCharacter('));
 assert.doesNotThrow(()=>new vm.Script(code));
});
test('Options contains all destructive Save Management controls',()=>{
 const html=source('index.html');
 for(const id of ['dkDeleteCharacter','dkResetWorld','dkStartFresh'])
  assert(html.includes('id="'+id+'"'));
 assert(html.includes("get('view')==='options'"));
 assert(html.includes('resetWorld('));
});
test('The static host serves the UO paper doll',()=>{
 const server=source('server/local-game.cjs');
 assert(server.includes("'dk-paperdoll-m40.js'"));
 assert(server.includes("'dk-paperdoll-m40.css'"));
});
