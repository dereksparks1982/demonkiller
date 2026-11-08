'use strict';
// M68: real, traversable world-grid foundation. No screenshot or fake map.
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../world-regions.js');
const T=require('../dk-world-terrain-m68.js');
const W=require('../server/world.cjs');
const GRID=require('../server/world-grid-m67.cjs');
const CELLS=require('../server/streaming-cells-m33.cjs');
const POLICIES=require('../server/region-policies-m16.cjs');
const START=Date.UTC(2026,10,8);
const fresh=()=>W.makeWorld(START);
const beginning=w=>{
 const created=W.createCharacter(w,1,'ELIAS',START).world;
 created.characters['1'].area_id=R.COURT;
 created.characters['1'].x=32;created.characters['1'].y=0;
 created.characters['1'].opening_state='complete';
 POLICIES.ensure(created);CELLS.ensure(created);
 return created;
};
test('M68 only temple retains its old playable architecture',()=>{
 const w=fresh();
 const old=w.areas[R.VILLAGE],grounds=w.areas[R.COURT],temple=w.areas[R.TEMPLE];
 assert.equal(old.objects.length,0,'Old village buildings removed');
 assert(!grounds.objects.some(o=>['house','bank','bakery','smithy','tavern','stall','well'].includes(o.type)));
 assert(grounds.objects.some(o=>o.id==='temple_exterior'));
 assert(grounds.objects.some(o=>o.id==='lilith_willow'));
 assert(temple.objects.some(o=>o.id==='sacrifice_altar'));
 assert(temple.objects.some(o=>o.id==='temple_north_door'));
 assert.equal(R.portal(w,R.COURT,32,0),null,'There is no longer a village gate');
 assert.equal(W.validateWorld(w),w);
});
test('M68 four 128x128 overhead regions are part of one fixed 4096x4096 world grid',()=>{
 const w=fresh();assert.equal(T.MASTER,4096);assert.equal(T.SIZE,128);
 assert.equal(T.SECTOR,16);assert.equal(T.TILE,32);
 assert.equal(T.IDS.length,4);
 for(const id of T.IDS){
  const a=w.areas[id],p=T.coords(id);
  assert.equal(a.area_id,id);
  assert.deepEqual(a.world_origin,{x:p.x,y:p.y});
  assert.equal(a.floor.length,128*128);
  assert.equal(a.floorArt.length,a.floor.length);
  assert.equal(R.checkRegion(a),a);
  assert.equal(a.floor[0],T.tile(p.x,p.y));
  assert.equal(CELLS.rootId(id),GRID.tile(p.x,p.y).cell.id);
 }
 assert.equal(W.validateWorld(w),w);
});
test('M68 biome coast, rivers, glaciers, forest and swamps all have physical tiles',()=>{
 const w=fresh(),all=new Set(T.IDS.flatMap(id=>w.areas[id].floor));
 for(const biome of ['sea','river','glacier','marsh','forest','path','cliff','bridge'])
  assert(all.has(biome),biome+' must exist as actual terrain, not a map icon');
 const ocean=w.areas[T.id(12,14)];
 assert.equal(R.traversable(ocean,0,0,'living'),false);
 assert.equal(T.traversableType('forest'),true);
 assert.equal(T.traversableType('cliff'),false);
});
test('M68 camps are at natural physical coordinates with full footprints',()=>{
 const w=fresh(),names=[];
 for(const camp of T.CAMPS){
  const target=T.IDS.find(id=>{
   const p=T.coords(id);
   return camp.x>=p.x&&camp.x<p.x+128&&camp.y>=p.y&&camp.y<p.y+128;
  });
  assert(target,'Camp must be in currently materialized world');
  const p=T.coords(target),a=w.areas[target],tent=a.objects.find(o=>o.id==='workcamp_'+camp.id);
  assert(tent&&tent.w===4&&tent.h===3);
  assert.equal(tent.x,camp.x-p.x-2);
  assert.equal(tent.y,camp.y-p.y-2);
  names.push(camp.name);
 }
 assert.equal(names.length,3);
 assert.equal(new Set(names).size,3);
});
test('M68 temple grounds join wilderness by cardinal tile-adjacent transitions',()=>{
 const w=fresh();
 assert.deepEqual(R.portal(w,R.COURT,32,-1),
  {area_id:T.id(12,15),x:64,y:127,facing:'north'});
 assert.deepEqual(R.portal(w,T.id(12,15),64,128),
  {area_id:R.COURT,x:32,y:0,facing:'south'});
 assert.equal(R.portal(w,R.COURT,31,-1),null,'No arbitrary edge teleport');
});
test('M68 adjacent wilderness sectors exchange exact boundaries, without diagonal travel',()=>{
 const w=fresh();for(const [area_id,x,y,expected,ex,ey] of [
  [T.id(12,14),128,52,T.id(13,14),0,52],
  [T.id(13,14),-1,52,T.id(12,14),127,52],
  [T.id(12,14),52,128,T.id(12,15),52,0],
  [T.id(13,15),50,-1,T.id(13,14),50,127]
 ]){
  const p=R.portal(w,area_id,x,y);
  assert.deepEqual([p?.area_id,p?.x,p?.y],[expected,ex,ey]);
 }
 assert.equal(R.portal(w,T.id(12,14),-1,40),null);
 assert.equal(R.portal(w,T.id(13,15),128,40),null);
});
test('M68 server-authoritative character can walk from temple grounds into real wilderness',()=>{
 const w=beginning(fresh()),step=W.applyCharacterAction(w,1,{action:'move',direction:'north'});
 const p=step.world.characters['1'];
 assert.deepEqual([p.area_id,p.x,p.y],[T.id(12,15),64,127]);
 assert.equal(W.validateWorld(step.world),step.world);
 const view=CELLS.streamingView(step.world,{slot:1});
 assert.equal(view.current_cell,CELLS.rootId(T.id(12,15)));
 assert(view.links.some(l=>l.to===CELLS.rootId(R.COURT)));
 const returned=W.applyCharacterAction(step.world,1,{action:'move',direction:'south'});
 assert.deepEqual([returned.character.area_id,returned.character.x,returned.character.y],
  [R.COURT,32,0]);
});
test('M68 browser renderer uses the same generated terrain, not an isometric illustration',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const html=fs.readFileSync(path.join(__dirname,'../outdoor.html'),'utf8');
 const js=fs.readFileSync(path.join(__dirname,'../outdoor.js'),'utf8');
 assert(html.indexOf('dk-world-terrain-m68.js')<html.indexOf('world-regions.js'));
 assert.match(js,/TERRAIN[.]draw\(ctx,f,/);
 assert.match(js,/TERRAIN[.]IDS/);
 assert.match(js,/area\.streamed/);
 assert.match(js,/type==='camp_tent'/);
 assert(!js.includes("player=saved&&[R.COURT,R.VILLAGE]"));
});
