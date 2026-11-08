'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const W=require('../server/world.cjs'),R=require('../server/regions.cjs');
const GEO=require('../dk-architect-exterior-m38.js');
const ARCH=require('../server/outdoor-architect-m36.cjs');
const NOW=Date.UTC(2026,10,8,3);
const HOUSE='courtyard_house_sw';
const sample=()=>W.createCharacter(W.makeWorld(NOW),1,'TEST',NOW).world;
const edit=(world,action,fields,area_id=R.COURT)=>
 ARCH.edit(world,{action,area_id,expected_revision:world.revision,...fields}).world;
const pick=(w,id,area_id=R.COURT)=>w.areas[area_id].objects.find(o=>o.id===id);
test('M38 whole-building move is real: all footprint layers move and ownership survives',()=>{
 const w=sample(),before=JSON.stringify(w),orig=pick(w,HOUSE);
 const x=orig.x,y=orig.y,oldDoor={...orig.door};
 const next=edit(w,'move_building',{object_id:HOUSE,x:x+1,y});
 const moved=pick(next,HOUSE);
 assert.equal(JSON.stringify(w),before,'world changes only on cloned transaction');
 assert.deepEqual([moved.x,moved.y],[x+1,y]);
 assert.deepEqual(moved.door,{x:oldDoor.x+1,y:oldDoor.y});
 assert.equal(next.areas[R.COURT].floor[y*64+x],'grass');
 assert.equal(next.areas[R.COURT].floor[y*64+x+1],'stone');
 assert.equal(next.living.housing.records[HOUSE].door_x,moved.door.x);
 assert.equal(next.living.housing.records[HOUSE].x,moved.x);
 W.validateWorld(next);
});
test('M38 moving a building a second time restores original garden instead of deleting terrain',()=>{
 const w=sample(),a=w.areas[R.COURT],i=37*64+17;
 a.floor[i]='garden';
 const once=edit(w,'move_building',{object_id:HOUSE,x:6,y:37});
 assert.equal(once.areas[R.COURT].floor[i],'stone','new building edge covers garden');
 const twice=edit(once,'move_building',{object_id:HOUSE,x:7,y:37});
 assert.equal(twice.areas[R.COURT].floor[37*64+6],'grass');
 assert.equal(twice.areas[R.COURT].floor[i],'stone','garden may be covered by the next footprint');
 const thrice=edit(twice,'move_building',{object_id:HOUSE,x:5,y:37});
 assert.equal(thrice.areas[R.COURT].floor[i],'garden','the garden is restored after leaving the tile');
 W.validateWorld(thrice);
});
test('M38 paths, willow, temple, gates and other buildings remain protected',()=>{
 const w=sample(),a=w.areas[R.COURT];
 const source=JSON.stringify(w),o=pick(w,HOUSE);
 assert.throws(()=>GEO.test(a,o.id,25,22),/path|Blocked|protected|wall/);
 assert.throws(()=>GEO.test(a,o.id,24,48),/Blocked|path|wall/);
 assert.throws(()=>GEO.test(a,'temple_exterior',25,48),/whole house or shop/);
 assert.throws(()=>GEO.test(a,o.id,47,37),/Blocked/);
 assert.equal(JSON.stringify(w),source);
});
test('M38 wall construction is functional outdoors and never tramples a pathway',()=>{
 let w=sample();
 const x=18,y=37,id=y*64+x;
 assert.equal(w.areas[R.COURT].walls[id],0);
 w=edit(w,'paint_wall',{x,y});
 assert.equal(w.areas[R.COURT].walls[id],1);
 W.validateWorld(w);
 w=edit(w,'erase_wall',{x,y});
 assert.equal(w.areas[R.COURT].walls[id],0);
 W.validateWorld(w);
 w=edit(w,'wall_line',{x:18,y:37,w:3,h:1});
 for(let xx=18;xx<21;xx++)assert.equal(w.areas[R.COURT].walls[y*64+xx],1);
 assert.throws(()=>edit(w,'paint_wall',{x:32,y:30}),/path|protected/);
 assert.throws(()=>edit(w,'wall_line',{x:20,y:37,w:3,h:3}),/straight wall/);
 assert.throws(()=>edit(w,'paint_wall',{x:31,y:26}),/protected object|path|already/);
 W.validateWorld(w);
});
test('M38 room outlines use walls, preserve interior tiles and reject impassable objects',()=>{
 let w=sample();
 const before=w.areas[R.COURT].floor[40*64+21];
 w=edit(w,'room_outline',{x:20,y:39,w:4,h:4});
 const area=w.areas[R.COURT];
 for(let yy=39;yy<43;yy++)for(let xx=20;xx<24;xx++)
  assert.equal(area.walls[yy*64+xx],(xx===20||xx===23||yy===39||yy===42)?1:0);
 assert.equal(area.floor[40*64+21],before);
 assert.throws(()=>edit(w,'room_outline',{x:4,y:37,w:5,h:5}),/protected object/);
 W.validateWorld(w);
});
