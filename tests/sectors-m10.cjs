'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const W=require('../server/world.cjs'),R=require('../server/regions.cjs');
const E=require('../server/entity-registry-m10.cjs'),S=require('../server/sectors-m10.cjs');
const NOW=Date.UTC(2026,10,6);
test('M10 sectors are 16x16 tiles, independent of each region size',()=>{
 const w=W.makeWorld(NOW),index=S.build(w);
 assert.equal(S.SECTOR_SIZE,16);
 const temple=index.areas.get(R.TEMPLE);
 const court=index.areas.get(R.COURT);
 const village=index.areas.get(R.VILLAGE);
 assert.equal(temple.sectors_x,1);
 assert.equal(court.sectors_x,4);
 assert.equal(village.sectors_y,8);
 assert.deepEqual(S.cell(15,15),{sx:0,sy:0});
 assert.deepEqual(S.cell(16,16),{sx:1,sy:1});
 assert.deepEqual(S.cell(127,0),{sx:7,sy:0});
});
test('Nearby query limits return values to the requested region and Manhattan distance',()=>{
 let w=W.createCharacter(W.makeWorld(NOW),1,'DEREK',NOW).world;
 w.characters['1'].area_id=R.VILLAGE;w.characters['1'].x=54;w.characters['1'].y=103;
 E.reconcile(w);
 const i=S.build(w),near=S.lookup(i,R.VILLAGE,54,103,8);
 assert(near.entities.some(o=>o.kind==='character'&&o.id==='player:1'));
 assert(near.entities.some(o=>o.kind==='chest'&&o.id===E.CHEST));
 assert(near.entities.some(o=>o.kind==='npc'&&o.id==='bank_clerk'));
 assert(near.entities.every(o=>o.area_id===R.VILLAGE));
 assert(near.entities.every(o=>Math.abs(o.x-54)+Math.abs(o.y-103)<=8));
 const temple=S.lookup(i,R.TEMPLE,8,7,8);
 assert(!temple.entities.some(o=>o.kind==='chest'),'Other regions must not leak into local queries');
});
test('Query across a sector boundary includes neighbors without duplicating them',()=>{
 const w=W.makeWorld(NOW);
 const idx=S.build(w),result=S.lookup(idx,R.COURT,16,16,16);
 assert.equal(new Set(result.entities.map(e=>e.kind+':'+e.id)).size,result.entities.length);
 assert(result.entities.length>0);
 assert(result.entities.every(e=>Math.abs(e.x-16)+Math.abs(e.y-16)<=16));
});
test('An index is rebuilt from new state, rather than persisting stale positions',()=>{
 const w=W.makeWorld(NOW),before=S.build(w);
 const npc=w.living.npcs.baker;
 const old=before.sectors.get(R.VILLAGE+'#'+Math.floor(npc.x/16)+','+Math.floor(npc.y/16));
 assert(old.some(e=>e.kind==='npc'&&e.id==='baker'));
 npc.x=17;npc.y=17;w.revision++;E.reconcile(w);
 const after=S.build(w);
 const moved=S.lookup(after,R.VILLAGE,17,17,1);
 assert(moved.entities.some(e=>e.id==='baker'));
 assert(!S.lookup(before,R.VILLAGE,17,17,1).entities.some(e=>e.id==='baker'));
 assert.equal(after.world_revision,w.revision);
});
test('Large regions are supported without forcing 16x16 room geometry',()=>{
 const w=W.makeWorld(NOW),area=w.areas[R.VILLAGE];
 // Sector math scales to arbitrary area dimensions without altering the map.
 area.width=256;area.height=256;
 const result=S.build(w);
 assert.equal(result.areas.get(R.VILLAGE).sectors_x,16);
 assert.equal(result.areas.get(R.VILLAGE).sectors_y,16);
});
test('Invalid radius, coordinates and missing regions are explicitly rejected',()=>{
 const i=S.build(W.makeWorld(NOW));
 assert.throws(()=>S.lookup(i,R.VILLAGE,54,103,33),/radius/);
 assert.throws(()=>S.lookup(i,R.VILLAGE,-1,103,8),/position/);
 assert.throws(()=>S.lookup(i,'unknown-region',0,0,8),/Unknown/);
 assert.throws(()=>S.cell(-1,0),/coordinates/);
});
