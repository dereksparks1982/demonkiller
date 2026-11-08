'use strict';
// M64: saved crowd/traffic observations for NPC routes and congested gates.
// NPCs never receive a teleport or new location from this module.
const MAX=128,NOTIFY_AFTER=3,NOTIFY_REPEAT=12;
function init(n){
 return {npc_id:n.id,area_id:n.area_id,x:n.x,y:n.y,
  last_checked_minute:-1,last_moved_minute:-1,blocked_ticks:0,
  total_steps:0,total_waits:0,total_jams:0};
}
function ensure(world){
 if(!world.living)throw Error('Traffic needs persistent NPC state');
 let changed=false;
 if(!world.living.traffic){
  world.living.traffic={schema:1,records:{},total_steps:0,
   total_waits:0,total_jams:0};
  changed=true;
 }
 const t=world.living.traffic;
 for(const n of Object.values(world.living.npcs)){
  if(t.records[n.id])continue;
  if(Object.keys(t.records).length>=MAX)throw Error('Traffic register exhausted');
  t.records[n.id]=init(n);changed=true;
 }
 return changed;
}
function validate(world){
 const t=world.living?.traffic;if(!t)return true; // M63 migration
 if(t.schema!==1||!t.records||Array.isArray(t.records)||
   Object.keys(t.records).length>MAX)throw Error('Invalid NPC traffic ledger');
 const sums={total_steps:0,total_waits:0,total_jams:0};
 for(const [id,r] of Object.entries(t.records)){
  const n=world.living.npcs[id],area=world.areas[r?.area_id];
  if(!n||!r||r.npc_id!==id||!area||
    !Number.isInteger(r.x)||r.x<0||r.x>=area.width||
    !Number.isInteger(r.y)||r.y<0||r.y>=area.height||
    !Number.isSafeInteger(r.last_checked_minute)||
    r.last_checked_minute<-1||r.last_checked_minute>world.living.minute||
    !Number.isSafeInteger(r.last_moved_minute)||
    r.last_moved_minute<-1||r.last_moved_minute>world.living.minute||
    !Number.isSafeInteger(r.blocked_ticks)||r.blocked_ticks<0||
    ['total_steps','total_waits','total_jams'].some(k=>
     !Number.isSafeInteger(r[k])||r[k]<0))
   throw Error('Invalid persistent NPC traffic record');
  for(const k of Object.keys(sums))sums[k]+=r[k];
 }
 for(const [k,n] of Object.entries(sums))
  if(!Number.isSafeInteger(t[k])||t[k]<n)
   throw Error('Invalid traffic total counter');
 return true;
}
function satisfied(n,dest){
 return !dest||n.area_id===dest.area_id&&
  Math.abs(n.x-dest.x)+Math.abs(n.y-dest.y)<=1;
}
function event(world,n,minute,r,dest,out){
 const l=world.living,e={id:'event_'+(++l.event_sequence),minute,
  type:'npc.traffic.delayed',text:n.name+' is waiting for a clear route.',
  npc_id:n.id,area_id:n.area_id,x:n.x,y:n.y,
  destination:dest?{area_id:dest.area_id,x:dest.x,y:dest.y}:null,
  blocked_ticks:r.blocked_ticks};
 l.events.push(e);if(l.events.length>512)l.events.shift();out.push(e);
}
function observe(world,n,dest,minute,moved,out){
 if(!Number.isSafeInteger(minute)||minute<0||minute%5!==0||
    typeof moved!=='boolean')throw Error('Invalid traffic observation');
 ensure(world);
 const t=world.living.traffic,r=t.records[n.id];
 if(!r)throw Error('Unknown NPC traffic record');
 if(minute<=r.last_checked_minute)return false; // saved exact-once
 r.last_checked_minute=minute;
 r.area_id=n.area_id;r.x=n.x;r.y=n.y;
 if(moved){
  r.last_moved_minute=minute;r.blocked_ticks=0;
  r.total_steps++;t.total_steps++;
 }else if(!satisfied(n,dest)&&n.alive){
  r.blocked_ticks++;r.total_waits++;t.total_waits++;
  if(r.blocked_ticks===NOTIFY_AFTER||r.blocked_ticks%NOTIFY_REPEAT===0){
   r.total_jams++;t.total_jams++;
   event(world,n,minute,r,dest,out);
  }
 }else r.blocked_ticks=0;
 return true;
}
function listing(world,area_id=null){
 const t=world.living.traffic;
 return {world_minute:world.living.minute,
  total_steps:t?.total_steps||0,total_waits:t?.total_waits||0,
  total_jams:t?.total_jams||0,
  mobiles:Object.values(t?.records||{}).filter(r=>
   !area_id||world.living.npcs[r.npc_id]?.area_id===area_id)
   .map(r=>({npc_id:r.npc_id,area_id:r.area_id,x:r.x,y:r.y,
    waiting:r.blocked_ticks,steps:r.total_steps,delays:r.total_jams,
    last_move_minute:r.last_moved_minute}))
   .sort((a,b)=>a.npc_id.localeCompare(b.npc_id))};
}
module.exports={MAX,ensure,validate,satisfied,observe,listing};
