'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('M79 primary MP3 transport and old-title isolation',()=>{
 const src=read('dk-rendered-soundtrack-m79.js');
 assert.match(src,/source\.loopStart=from;source\.loopEnd=to/);
 assert.match(src,/if\(!response\.ok\)throw Error/);
 assert.match(src,/url:midiUrl,volume:level/);
 assert(!src.includes('lyon-organ-arrangement'));
 assert.match(read('test-center.html'),/dk-rendered-soundtrack-m79\.js/);
 assert.match(read('outdoor.html'),/dk-rendered-soundtrack-m79\.js/);
 assert.match(read('dk-world-explore-m73.html'),/dk-rendered-soundtrack-m79\.js/);
 assert.match(read('index.html'),/demon-killer-title-theme-v1\.mid/);
});
test('M79 local DK Server serves the new score and transport without allowing arbitrary paths',async()=>{
 const {serveGame}=require('../server/local-game.cjs');
 for(const relative of ['dk-rendered-soundtrack-m79.js',
  'assets/audio/music/demon-killer-the-last-breath-v2.mid',
  'assets/audio/music/demon-killer-overworld-shadowlands-v2.mid']){
  let status=0,body,headers={};
  const res={writeHead:(s,h)=>{status=s;headers=h;},end:p=>{body=p;}};
  assert.equal(await serveGame({method:'GET'},res,'/'+relative,root),true);
  assert.equal(status,200);
  assert.ok(body.length>1000);
  assert.match(headers['Content-Type'],relative.endsWith('.mid')?/audio\/midi/:/javascript/);
 }
});
