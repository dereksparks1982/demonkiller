'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const decoder=require('../dk-midi-soundtrack.js');
test('M79 original temple score is 108s, with the execution at 5s and 84s ambient loop',()=>{
 const raw=fs.readFileSync(path.join(root,'assets/audio/music/demon-killer-the-last-breath-v2.mid'));
 assert.equal(raw.subarray(0,4).toString(),'MThd');
 const score=decoder.parseMidi(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.length));
 assert.equal(score.length,108);
 assert.equal(score.notes.length,346);
 assert(score.notes.some(n=>Math.abs(n.at-5)<.01&&n.velocity>=110));
 assert(score.notes.some(n=>n.at>=24&&n.at<108));
});
test('M79 overworld has a different original 96s dark score',()=>{
 const raw=fs.readFileSync(path.join(root,'assets/audio/music/demon-killer-overworld-shadowlands-v2.mid'));
 const score=decoder.parseMidi(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.length));
 assert.equal(score.length,96);
 assert.equal(score.notes.length,300);
});
test('M79 temple music remains uninterrupted after the opening',()=>{
 const html=read('test-center.html'),scene=read('test-center.js'),music=read('temple-music.js');
 assert(html.indexOf('dk-midi-soundtrack.js')<html.indexOf('dk-rendered-soundtrack-m79.js'));
 assert(html.indexOf('dk-rendered-soundtrack-m79.js')<html.indexOf('temple-music.js'));
 assert.match(scene,/DKTempleMusic\?\.beginExecution\(\)/);
 assert.match(scene,/DKTempleMusic\?\.finishExecution\(\)/);
 assert.match(scene,/DKTempleMusic\?\.startAmbient\(\)/);
 assert.match(music,/demon-killer-the-last-breath-v2\.mp3/);
 assert.match(music,/demon-killer-the-last-breath-v2\.mid/);
 assert.match(music,/loopStart:24,loopEnd:108/);
 assert(!music.includes('lyon-organ-arrangement.mid'));
 assert(!music.includes('demon-killer-the-last-breath-v1.mid'));
 const fn=music.match(/function finishExecution\(\)\{([\s\S]*?)\n\}/)[1];
 assert(!fn.includes('.stop('),'Cutscene completion must not kill the music');
});
test('M79 loops do not replay the death blow; the original title score stays',()=>{
 const engine=read('dk-midi-soundtrack.js'),render=read('dk-rendered-soundtrack-m79.js');
 assert.match(engine,/loopFromSeconds=0,startAtSeconds=0/);
 assert.match(engine,/position=loopIndex;cycleStart\+=length-loopOffset/);
 assert.match(render,/source\.loopStart=from;source\.loopEnd=to/);
 assert.match(render,/loopFromSeconds:loopStart,startAtSeconds:startAt/);
 assert.match(read('index.html'),/demon-killer-title-theme-v1\.mid/);
});
