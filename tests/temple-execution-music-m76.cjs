'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('original execution MIDI is parseable, 50 seconds and scores the death blow',()=>{
  const buf=fs.readFileSync(path.join(root,'assets/audio/music/demon-killer-the-last-breath-v1.mid'));
  assert.equal(buf.subarray(0,4).toString(),'MThd');
  const data=buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength);
  const {parseMidi}=require('../dk-midi-soundtrack.js');
  const result=parseMidi(data);
  assert.equal(result.notes.length,218);
  assert.ok(Math.abs(result.length-50)<0.01);
  assert.ok(result.notes.some(n=>Math.abs(n.at-5)<0.01&&n.velocity>=110));
  assert.ok(result.notes.some(n=>n.at>20&&n.at<40));
});
test('temple scene starts and finishes the cue, with the MIDI engine loaded first',()=>{
  const html=read('test-center.html'),scene=read('test-center.js'),player=read('temple-music.js');
  assert.ok(html.indexOf('dk-midi-soundtrack.js')<html.indexOf('temple-music.js'));
  assert.match(scene,/window\.DKTempleMusic\?\.beginExecution\(\)/);
  assert.match(scene,/window\.DKTempleMusic\?\.finishExecution\(\)/);
  assert.match(player,/demon-killer-the-last-breath-v1\.mid/);
  assert.match(player,/loop:false/);
  assert.match(player,/if\(!await prepare\(\)\|\|!enabled\|\|executionMode\)return/);
});
test('non-looping score is opt-in: menu and overworld remain looping by default',()=>{
  const synth=read('dk-midi-soundtrack.js');
  assert.match(synth,/loop=true/);
  assert.match(synth,/if\(!loop\)\{finished=true/);
  assert.match(synth,/if\(!loop&&finished\)return false/);
  assert.match(read('index.html'),/demon-killer-title-theme-v1\.mid/);
});
