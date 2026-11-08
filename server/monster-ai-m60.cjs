'use strict';
// M60 world-authoritative monster instincts. Creature memory is serialized
// with the monster, not a browser session. Independent of RunUO GPL sources.
const CREATURES=require('./creatures-m42.cjs');
const {traversable}=require('./regions.cjs');
const MODES=new Set(['patrol','pursue','search','retreat','return']);
const SEARCH_FOR=15,RETREAT_FOR=25,LEASH=16,PATROL_RADIUS=5;
const TIMID=Object.freeze({wolf:.32,spider:.30,bandit:.27,imp:.20});
const DIRS=Object.freeze([[0,-1],[1,0],[0,1],[-1,0]]);
const dist=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
function make(m,minute=0){
 return {schema:1,mode:'patrol',home_x:m.x,home_y:m.y,
  target_id:null,last_known_x:null,last_known_y:null,
  last_seen_minute:-1,changed_minute:minute,
  retreat_until_minute:-1};
}
function ensure(m,minute=0){
 if(m.ai)return false;
 m.ai=make(m,minute);return true;
}
function valid(world){
 // Combat.tick receives the NEXT simulated minute before living.minute is
 // incremented by the batch scheduler. Permit one bounded batch ahead.
 const limit=world.living.minute+180;
 for(const m of Object.values(world.living.combat?.creatures||{})){
  if(m.ai===undefined)continue; // old snapshots migrate when loading
  const b=m.ai,a=world.areas[m.area_id];
  if(!b||b.schema!==1||!MODES.has(b.mode)||
   !Number.isInteger(b.home_x)||b.home_x<0||b.home_x>=a.width||
   !Number.isInteger(b.home_y)||b.home_y<0||b.home_y>=a.height||
   (b.target_id!==null&&(typeof b.target_id!=='string'||b.target_id.length>85))||
   ((b.last_known_x===null)!==(b.last_known_y===null))||
   (b.last_known_x!==null&&(!Number.isInteger(b.last_known_x)||
    !Number.isInteger(b.last_known_y)||b.last_known_x<0||
     b.last_known_x>=a.width||b.last_known_y<0||b.last_known_y>=a.height))||
   !Number.isSafeInteger(b.last_seen_minute)||b.last_seen_minute<-1||b.last_seen_minute>limit||
   !Number.isSafeInteger(b.changed_minute)||b.changed_minute<0||b.changed_minute>limit||
   !Number.isSafeInteger(b.retreat_until_minute)||b.retreat_until_minute<-1||
   b.retreat_until_minute>limit+RETREAT_FOR)
   throw Error('Invalid persistent monster intelligence');
 }
 return true;
}
function sight(area,from,to){
 // Line of sight through map geometry; targets themselves need not be standable.
 let x=from.x,y=from.y,dx=Math.abs(to.x-x),dy=Math.abs(to.y-y);
 const sx=x<to.x?1:-1,sy=y<to.y?1:-1;
 let err=dx-dy;
 while(x!==to.x||y!==to.y){
  const e=2*err;
  if(e>-dy){err-=dy;x+=sx;}
  if(e<dx){err+=dx;y+=sy;}
  if(x===to.x&&y===to.y)break;
  if(!traversable(area,x,y,'living'))return false;
 }
 return true;
}
function threat(world,m,minute){
 const l=world.living,a=world.areas[m.area_id];
 const options=[],max=CREATURES.config(m.kind).aggro;
 const add=(id,target,priority,type)=>{
  if(!target||target.area_id!==m.area_id||!target.alive&&type!=='player')return;
  const d=dist(m,target);
  if(d>max||!sight(a,m,target))return;
  const memory=m.ai.target_id===id?2:0;
  options.push({id,target,type,d,score:priority*100+d-memory});
 };
 const p=world.characters?.['1'];
 if(p?.form==='living'&&!p.crafting?.incapacitated&&
   !(p.fieldcraft?.hidden_until_minute>minute))
  add('player',p,0,'player');
 for(const n of Object.values(l.npcs||{}))if(n.alive)
  add('npc:'+n.id,n,n.role==='guard'||n.role==='escort'?1:3,'npc');
 for(const pet of Object.values(l.companions?.pets||{}))if(pet.alive)
  add('pet:'+pet.id,pet,2,'pet');
 options.sort((a,b)=>a.score-b.score||a.id.localeCompare(b.id));
 return options[0]||null;
}
function record(world,m,mode,targetId,minute,events){
 const b=m.ai;
 if(b.mode===mode&&b.target_id===targetId)return;
 b.mode=mode;b.target_id=targetId;b.changed_minute=minute;
 const l=world.living,e={id:'event_'+(++l.event_sequence),minute,
  type:'monster.ai.'+mode,text:CREATURES.config(m.kind).name+' is '+mode+'.',
  area_id:m.area_id,creature_id:m.id,target_id:targetId};
 l.events.push(e);if(l.events.length>512)l.events.shift();
 events.push(e);
}
function decide(world,m,minute,events){
 ensure(m,Math.min(minute,world.living.minute));
 const b=m.ai;
 if(m.health<=Math.floor(CREATURES.config(m.kind).health*(TIMID[m.kind]||0))&&
   b.retreat_until_minute<minute)b.retreat_until_minute=minute+RETREAT_FOR;
 const seen=threat(world,m,minute);
 const home={area_id:m.area_id,x:b.home_x,y:b.home_y};
 const leash=dist(m,home)>=LEASH;
 if(seen){
  b.last_seen_minute=minute;b.last_known_x=seen.target.x;
  b.last_known_y=seen.target.y;
 }
 if(b.retreat_until_minute>=minute&&seen){
  record(world,m,'retreat',seen.id,minute,events);
  return {mode:'retreat',target:null,threat:seen.target,goal:null};
 }
 if(seen&&!leash&&dist(seen.target,home)<=LEASH){
  record(world,m,'pursue',seen.id,minute,events);
  return {mode:'pursue',target:seen.target,targetType:seen.type,
   goal:{area_id:m.area_id,x:seen.target.x,y:seen.target.y}};
 }
 if(!seen&&b.last_seen_minute>=0&&minute-b.last_seen_minute<=SEARCH_FOR&&
  b.last_known_x!==null&&!leash){
  record(world,m,'search',b.target_id,minute,events);
  return {mode:'search',target:null,goal:{area_id:m.area_id,
   x:b.last_known_x,y:b.last_known_y}};
 }
 if(dist(m,home)>PATROL_RADIUS){
  record(world,m,'return',null,minute,events);
  return {mode:'return',target:null,goal:home};
 }
 record(world,m,'patrol',null,minute,events);
 return {mode:'patrol',target:null,goal:null};
}
function occupied(world,m,x,y){
 if(!traversable(world.areas[m.area_id],x,y,'living'))return true;
 const l=world.living;
 if(Object.values(l.combat?.creatures||{}).some(c=>
  c.alive&&c.id!==m.id&&c.area_id===m.area_id&&c.x===x&&c.y===y))return true;
 if(Object.values(l.npcs||{}).some(c=>
  c.alive&&c.area_id===m.area_id&&c.x===x&&c.y===y))return true;
 if(Object.values(l.companions?.pets||{}).some(c=>
  c.alive&&c.area_id===m.area_id&&c.x===x&&c.y===y))return true;
 const p=world.characters?.['1'];
 return !!(p?.area_id===m.area_id&&p.x===x&&p.y===y);
}
function retreatStep(world,m,threat){
 let best=null,bestScore=dist(m,threat)*16;
 for(const [dx,dy] of DIRS){
  const x=m.x+dx,y=m.y+dy;
  if(occupied(world,m,x,y)||
   Math.abs(x-m.ai.home_x)+Math.abs(y-m.ai.home_y)>LEASH)continue;
  const score=(Math.abs(x-threat.x)+Math.abs(y-threat.y))*16-
   (Math.abs(x-m.ai.home_x)+Math.abs(y-m.ai.home_y))*.05;
  if(score>bestScore){bestScore=score;best={area_id:m.area_id,x,y};}
 }
 return best;
}
function patrolStep(world,m,minute){
 if(minute%15!==0)return null;
 const bias=(Math.floor(minute/15)+m.id.length+m.ai.home_x)%4;
 for(let i=0;i<4;i++){
  const [dx,dy]=DIRS[(bias+i)%4],x=m.x+dx,y=m.y+dy;
  if(Math.abs(x-m.ai.home_x)+Math.abs(y-m.ai.home_y)>PATROL_RADIUS||
   occupied(world,m,x,y))continue;
  return {area_id:m.area_id,x,y};
 }
 return null;
}
function listing(world,area_id=null){
 const mobs=Object.values(world.living.combat?.creatures||{})
  .filter(m=>m.alive&&(!area_id||m.area_id===area_id));
 return {minute:world.living.minute,creatures:mobs.map(m=>({
  id:m.id,kind:m.kind,area_id:m.area_id,mode:m.ai?.mode||'patrol',
  last_seen_minute:m.ai?.last_seen_minute??-1,
  target_id:m.ai?.target_id??null,home:{x:m.ai?.home_x??m.x,y:m.ai?.home_y??m.y}
 }))};
}
module.exports={SEARCH_FOR,RETREAT_FOR,LEASH,PATROL_RADIUS,
 make,ensure,valid,sight,threat,decide,occupied,retreatStep,patrolStep,listing};
