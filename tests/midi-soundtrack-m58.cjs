'use strict';
// M58: original title / overworld MIDIs and browser MIDI transport contracts.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const midi=require('../dk-midi-soundtrack.js');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const dir='assets/audio/music/';
function decode(filename){
 const raw=fs.readFileSync(path.join(root,dir,filename));
 assert.equal(raw.subarray(0,4).toString(),'MThd','Must be real Standard MIDI');
 return {raw,score:midi.parseMidi(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength))};
}
test('M58 approved overworld MIDI preserves exact source duration and real musical tracks',()=>{
 const {raw,score}=decode('demon-killer-overworld-theme-v1.mid');
 assert.equal(raw.length,9458);
 assert(Math.abs(score.length-67.368448)<.01);
 assert(score.notes.length>500);
 assert(score.notes.some(n=>n.program===80),'Original square-wave lead must remain');
 assert(score.notes.some(n=>n.channel===9),'Percussion track must remain');
 assert(score.notes.every(n=>n.duration>0&&n.at>=0));
});
test('M58 dark title theme is a distinct original 24-bar MIDI',()=>{
 const {raw,score}=decode('demon-killer-title-theme-v1.mid');
 assert.equal(raw.length,4580);
 assert(Math.abs(score.length-73.846176)<.01);
 assert(score.notes.length>200);
 assert(score.notes.some(n=>n.program===19),'Church-organ opening must remain');
 assert(score.notes.some(n=>n.program===52),'Ghostly choir must remain');
 assert(score.notes.some(n=>n.channel===9),'Ritual percussion must remain');
});
test('M58 title, outdoors, temple and user preference retain separate music boundaries',()=>{
 const menu=read('index.html'),outdoor=read('outdoor.js'),
  outdoorHTML=read('outdoor.html'),temple=read('test-center.html');
 assert(menu.includes('dk-midi-soundtrack.js?v=m58'));
 assert(menu.includes('demon-killer-title-theme-v1.mid'));
 assert(menu.includes('menuMusic?.stop()'));
 assert(menu.includes("menuMusic?.setVolume(level)"));
 assert(outdoorHTML.includes('dk-midi-soundtrack.js?v=m58'));
 assert(outdoor.includes('demon-killer-overworld-shadowlands-v2.mid'));
 assert(outdoor.includes('demon-killer-overworld-shadowlands-v2.mp3'));
 assert(outdoor.includes("prefs.musicEnabled===false"));
 assert(outdoor.includes('MUSIC?.stop()'));
 assert(temple.includes('temple-music.js'),'Temple sound must be unchanged');
 assert(!outdoor.includes('creepyloop-v2.ogg'));
});
test('M58 DK Server serves actual MIDI bytes and shared player code from allowlist',async()=>{
 const {serveGame}=require('../server/local-game.cjs');
 for(const filename of ['dk-midi-soundtrack.js',dir+'demon-killer-overworld-theme-v1.mid',
  dir+'demon-killer-title-theme-v1.mid']){
  let status=0,header={},body;
  const res={writeHead:(code,h)=>{status=code;header=h;},end:payload=>body=payload};
  assert.equal(await serveGame({method:'GET'},res,'/'+filename,root),true);
  assert.equal(status,200);
  assert(body.length>1000);
  if(filename.endsWith('.mid')){
   assert.match(header['Content-Type'],/audio\/midi/);
   assert.equal(body.subarray(0,4).toString(),'MThd');
  }else assert.match(header['Content-Type'],/javascript/);
 }
});