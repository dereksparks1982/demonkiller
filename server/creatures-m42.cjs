'use strict';
// DK Server M42: independent creature archetypes. No RunUO code or imported art.
// Stable names, deterministic rules, cardinal movement and persistent corpses.
const KINDS=Object.freeze({
 imp:       Object.freeze({name:'Imp',health:18,damage:3,gold:3,loot:'ore',corpse:'demon',aggro:6,guardDamage:4}),
 wolf:      Object.freeze({name:'Wolf',health:24,damage:4,gold:0,loot:'herbs',corpse:'beast',aggro:5,guardDamage:4}),
 skeleton:  Object.freeze({name:'Skeleton',health:30,damage:4,gold:5,loot:'ore',corpse:'demon',aggro:7,guardDamage:4}),
 spider:    Object.freeze({name:'Giant Spider',health:22,damage:2,gold:1,loot:'herbs',corpse:'beast',aggro:5,guardDamage:4}),
 wraith:    Object.freeze({name:'Wraith',health:34,damage:5,gold:6,loot:'herbs',corpse:'demon',aggro:8,guardDamage:3}),
 bandit:    Object.freeze({name:'Bandit',health:38,damage:5,gold:9,loot:'wood',corpse:'human',aggro:7,guardDamage:4}),
 demon:     Object.freeze({name:'Lesser Demon',health:65,damage:8,gold:14,loot:'ore',corpse:'demon',aggro:9,guardDamage:3})
});
const KINDS_LIST=Object.freeze(Object.keys(KINDS));
const GROUPS=Object.freeze({
 courtyard:Object.freeze(['wolf','spider','wraith','skeleton']),
 village:Object.freeze(['bandit','skeleton','spider','demon'])
});
const MAX_ACTIVE=48;
function config(kind){
 const data=KINDS[kind];if(!data)throw Error('Unknown creature species');return data;
}
function select(area,minute,sequence){
 const pool=area.includes('courtyard')?GROUPS.courtyard:GROUPS.village;
 return pool[(Math.floor(minute/90)+sequence)%pool.length];
}
function damage(kind,targetType='player'){
 const base=config(kind).damage;
 return targetType==='guard'?Math.max(1,base-1):base;
}
function canSense(monster,target){
 if(!monster||!target||monster.area_id!==target.area_id)return false;
 return Math.abs(monster.x-target.x)+Math.abs(monster.y-target.y)<=config(monster.kind).aggro;
}
function spawnPoints(area){
 return area.includes('courtyard')?[[12,14],[48,14],[50,30],[14,31]]:
  [[19,22],[108,24],[24,77],[101,80],[19,123],[108,120]];
}
function listing(world,area_id=null){
 const creatures=Object.values(world.living?.combat?.creatures||{})
  .filter(c=>c.alive&&(!area_id||c.area_id===area_id));
 return {world_minute:world.living?.minute||0,templates:KINDS,
  active:creatures.length,by_kind:Object.fromEntries(KINDS_LIST.map(k=>[k,creatures.filter(c=>c.kind===k).length])),
  creatures:creatures.map(c=>({id:c.id,kind:c.kind,name:config(c.kind).name,
   health:c.health,max_health:config(c.kind).health,x:c.x,y:c.y,area_id:c.area_id}))};
}
module.exports={KINDS,KINDS_LIST,GROUPS,MAX_ACTIVE,config,select,damage,canSense,spawnPoints,listing};
