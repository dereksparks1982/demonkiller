'use strict';
// Only for test setup: align explicitly teleported fixtures with server-owned
// district IDs. Game runtime validation is intentionally never weakened.
const {regionAt}=require('../../server/region-policies-m16.cjs');
function syncPlayer(world){
 const c=world.characters?.['1'];
 if(c)c.region_id=regionAt(world,c.area_id,c.x,c.y).id;
 return world;
}
function syncNpcs(world){
 for(const n of Object.values(world.living?.npcs||{}))
  n.region_id=regionAt(world,n.area_id,n.x,n.y).id;
 return world;
}
function syncAll(world){syncPlayer(world);syncNpcs(world);return world;}
module.exports={syncPlayer,syncNpcs,syncAll};
