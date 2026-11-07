'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const W=require('../server/world.cjs'),R=require('../server/regions.cjs');
const M=require('../server/sector-interest-m31.cjs');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const NOW=Date.UTC(2026,10,7);
test('M31 detailed NPC sensing remains local while background threat checks use a slower server cadence',()=>{
 const world=W.createCharacter(W.makeWorld(NOW),1,'ELIAS',NOW).world;
 const npc=world.living.npcs.baker;
 const c=world.characters['1'];
 assert.equal(c.area_id,R.TEMPLE);
 assert.equal(M.tierFor(world,npc.area_id,npc.x,npc.y),'background');
 assert.equal(M.npcSenseDue(world,npc,5),false);
 assert.equal(M.npcSenseDue(world,npc,10),false);
 assert.equal(M.npcSenseDue(world,npc,15),true);
 c.area_id=npc.area_id;c.x=npc.x;c.y=npc.y;
 assert.equal(M.tierFor(world,npc.area_id,npc.x,npc.y),'active');
 assert.equal(M.npcSenseDue(world,npc,5),true);
 c.x=Math.min(npc.x+16,127);c.y=npc.y;
 assert.equal(M.tierFor(world,npc.area_id,npc.x,npc.y),'neighbor');
 assert.equal(M.npcSenseDue(world,npc,5),true);
 delete world.characters['1'];
 assert.equal(M.npcSenseDue(world,npc,5),true,'world without a player keeps the original cadence');
});
test('M31 ordinary NPC walking and world processing remain unchanged',()=>{
 const src=read('server/living-world.cjs');
 assert.match(src,/if\(npcSenseDue\(world,n,m\)\)NPCAI\.sense/);
 assert.match(src,/if\(m%5===0\)\{\s*if\(npcStep\(n,world,desired\)\)/);
 assert.match(src,/NPCCOMMERCE\.consume\(world,n,m,generated\)/);
 assert.match(src,/combatTick\(world,m,generated\)/);
 assert.match(src,/runScheduled\(world,m,generated\)/);
 assert.match(src,/CARAVAN\.process\(world,m,generated\)/);
});
test('M31 browser consumes sector deltas with fallback and keeps all movement controls',()=>{
 const src=read('outdoor.js'),html=read('outdoor.html'),api=read('dk-menu-server.js');
 assert.match(src,/function nearbyDisplay\(kind,fallback\)/);
 assert.match(src,/async function refreshSectorInterest\(\)/);
 assert.match(src,/sectorView=null;sectorCursor=null/);
 assert.match(src,/setInterval\(refreshSectorInterest,1750\)/);
 for(const kind of ['npc','monster','corpse','grave','scavenger'])
  assert(src.includes("nearbyDisplay('"+kind+"'"));
 assert.match(api,/async sectorInterest\(cursor=null,radius=24\)/);
 assert.match(api,/async sectorChunk\(area,sx,sy\)/);
 assert.match(html,/outdoor\.js\?v=/);
 assert.match(src,/canvas\.addEventListener\('mousedown',e=>\{if\(e\.button===2\)/);
 assert.match(src,/advanceVisual\(dt\)/);
 assert.match(src,/key==='p'|e\.key\.toLowerCase\(\)==='b'/);
 assert.doesNotThrow(()=>new vm.Script(src,{filename:'outdoor.js'}));
 for(const id of ['openPaperDoll','openBackpack','serverSectorsButton'])
  assert(!html.includes('id="'+id+'"'));
});
