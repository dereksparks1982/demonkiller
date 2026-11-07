'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
test('M32 outdoor loads chunk cache before the renderer and retains keyboard-only gameplay',()=>{
 const html=read('outdoor.html');
 const client=html.indexOf('sector-terrain-m32.js');
 const game=html.indexOf('outdoor.js?v=');
 assert(client!==-1&&game>client);
 for(const id of ['openPaperDoll','openBackpack','showChunks','serverSectorsButton'])
  assert(!html.includes('id="'+id+'"'));
 const original=read('outdoor.js');
 assert.match(original,/canvas\.addEventListener\('mousedown',e=>\{if\(e\.button===2\)/);
 assert.match(original,/function pointerMove\(/);
 assert.match(original,/function advanceVisual\(dt\)/);
 assert.match(original,/e\.key\.toLowerCase\(\)==='b'/);
 assert.match(html,/key==='p'\|\|key==='i'/);
});
test('M32 streaming path downloads manifest and chunks without fetching full map first',()=>{
 const code=read('outdoor.js');
 assert.match(code,/if\(SERVER&&window\.DKSectorTerrain\)/);
 assert.match(code,/const manifest=await SERVER\.sectorManifest\(id\)/);
 assert.match(code,/candidate\.prime\(player\.x,player\.y\)/);
 assert.match(code,/loadChunk:\(region,sx,sy\)=>SERVER\.sectorChunk\(region,sx,sy\)/);
 assert.match(code,/nextArea=\(await SERVER\.area\(id\)\)\.area/);
 assert.match(code,/terrainSession\.close\(\)/);
 assert.match(code,/if\(area\.streamed&&f===null\)/);
 assert.match(code,/prefetchTerrain\(\)/);
 assert.match(code,/setInterval\(refreshSectorInterest,1750\)/);
 assert.match(code,/async function recoverFullTerrain\(session\)/);
 assert.match(code,/if\(\+\+terrainFailures>=3\)void recoverFullTerrain\(session\)/);
 const recovering=code.slice(code.indexOf('async function recoverFullTerrain('),
  code.indexOf('function checkTerrainFetch('));
 assert(!recovering.includes('resetVisual()'),'fallback must not interrupt walking animation');
 assert(!recovering.includes('location.href'),'fallback must not reload the scene');
});
test('M32 local-server allowlist includes the exact streamed module but not source code',()=>{
 const src=read('server/local-game.cjs');
 assert.match(src,/'sector-terrain-m32\.js'/);
 assert(!src.includes("'server/sector-interest-m31.cjs'"));
 assert(!src.includes("'server/dk-server.cjs'"));
});
test('M32 all changed browser scripts retain valid JavaScript syntax',()=>{
 for(const file of ['sector-terrain-m32.js','dk-menu-server.js','outdoor.js',
  'outdoor-ui.js','temple-ui.js','test-center.js']){
  assert.doesNotThrow(()=>new vm.Script(read(file),{filename:file}));
 }
 const html=read('outdoor.html');
 const inline=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map(m=>m[1]).filter(x=>x.trim());
 for(const snippet of inline)assert.doesNotThrow(()=>new vm.Script(snippet));
});
