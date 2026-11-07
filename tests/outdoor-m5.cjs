'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const R=require('../world-regions.js');
const serverRegions=require('../server/regions.cjs');

test('browser and DK Server share exactly one region template module',()=>{
 assert.equal(serverRegions,R);
 const court=R.courtyard(),village=R.village();
 assert.deepEqual([court.width,court.height],[64,64]);
 assert.deepEqual([village.width,village.height],[128,128]);
 assert.equal(court.objects.find(o=>o.id==='temple_exterior').w,16);
 assert.equal(court.objects.find(o=>o.id==='temple_exterior').h,16);
 assert.equal(R.traversable(court,32,47),true);
 assert.equal(R.traversable(court,33,53),false,'Temple roof is solid');
 assert.equal(R.traversable(court,63,63),false,'Boundary wall blocks movement');
 assert.equal(R.traversable(village,64,126),true);
});
test('architect wall renderer uses each region width, not fixed 16',()=>{
 const art=read('dk-dungeon-art.js');
 assert.match(art,/scene\.width\|\|16/);
 assert.match(art,/y\*width\+x/);
 assert.match(art,/ty<height/);
});
test('outdoor webpage uses the approved Architect wall art and camera',()=>{
 const html=read('outdoor.html'),js=read('outdoor.js'),css=read('outdoor.css');
 assert.match(html,/world-regions\.js/);
 assert.match(html,/dk-dungeon-art\.js/);
 assert.match(html,/assets\/art\/dkarchitect\/imported\/catalog\.js/);
 for(const control of ['world','gatherButton','buyButton','sellButton',
   'depositButton','withdrawButton','bankPanel','letters','clockStatus'])
  assert(html.includes('id="'+control+'"'),'Missing outdoor control: '+control);
 assert.match(js,/const TILE=32,VIEW=20/);
 assert.match(js,/D\?\.drawWall\(ctx,area,x,y/);
 assert.match(js,/camera\.x=Math\.max/);
 assert.match(css,/image-rendering:pixelated/);
 assert.match(js,/lilithPhase='playing'/);
 assert.match(js,/player\.form==='ghost'/);
 assert.match(js,/function willow\(/);
 assert(!/Godot|Unity|Phaser/i.test(js),'Game client must remain engine-free');
});
test('temple door is double-click to toggle, walking into open door changes region',()=>{
 const js=read('test-center.js');
 assert.match(js,/if\(!doubleClick\)\{/);
 assert.match(js,/function leaveTemple\(\)/);
 assert.match(js,/location\.href='\.\/outdoor\.html\?walk=continuous1'/);
 assert.match(js,/character\.area_id!==AREA/);
 assert.match(js,/gate\?\.open/);
 const html=read('test-center.html');
 assert.match(html,/Double-click|double-click/);
 assert(!html.includes('courtyard is not yet built'));
});
