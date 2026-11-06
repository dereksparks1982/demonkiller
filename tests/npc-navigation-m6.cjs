'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {chooseStep}=require('../server/npc-navigation-m6.cjs');
const {makeWorld}=require('../server/world.cjs');
const {COURT,VILLAGE}=require('../server/regions.cjs');
test('NPC pathfinding goes around a wall without diagonals or teleporting',()=>{
 const w=makeWorld(0),area=w.areas[COURT];
 area.walls.fill(0);area.floor.fill('grass');area.objects=[];
 const x=6,y=6;
 for(let k=5;k<=7;k++)area.walls[6*area.width+k]=0;
 area.walls[6*area.width+7]=1;
 const npc={area_id:COURT,x,y};
 let arrived=false,steps=0;
 for(;steps<50;steps++){
  const step=chooseStep(w,npc,{area_id:COURT,x:9,y:6});
  assert(step,'The NPC must find a path around the wall');
  assert.equal(Math.abs(step.x-npc.x)+Math.abs(step.y-npc.y),1,
    'Every movement is one cardinal tile');
  assert.equal(area.walls[step.y*area.width+step.x],0);
  Object.assign(npc,step);
  if(npc.x===9&&npc.y===6){arrived=true;break;}
 }
 assert.equal(arrived,true);
 assert(steps>3,'A wall requires a detour');
});
test('NPCs enter the connected region via its real portal',()=>{
 const w=makeWorld(0);
 const npc={area_id:VILLAGE,x:64,y:126};
 const step=chooseStep(w,npc,{area_id:COURT,x:46,y:27});
 assert.deepEqual(step,{area_id:COURT,x:32,y:1});
});
test('An NPC cannot walk into a fully sealed room',()=>{
 const w=makeWorld(0),a=w.areas[COURT];
 a.walls.fill(0);a.floor.fill('grass');a.objects=[];
 const npc={area_id:COURT,x:10,y:10};
 for(let yy=9;yy<=11;yy++)for(let xx=9;xx<=11;xx++)
  a.walls[yy*a.width+xx]=xx===10&&yy===10?0:1;
 const step=chooseStep(w,npc,{area_id:COURT,x:20,y:20});
 assert.equal(step,null,'Sealed origin must not teleport through walls');
});
