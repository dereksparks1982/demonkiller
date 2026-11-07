'use strict';
// DK Server M21: deterministic, persistent NPC threat-response state.
// Inspired by RunUO BaseAI action modes, independently authored.
const {traversable}=require('./regions.cjs');
const MAX_BRAINS=128,ALARM_RANGE=7,RETURN_AFTER=30;
const GUARD_ROLES=new Set(['guard','escort']);
function defaults(n,minute){
 return {npc_id:n.id,mode:n.alive?'work':'dead',threat_id:null,
   changed_minute:minute,last_seen_minute:-1,calm_after_minute:-1};
}
function ensure(world){
 if(!world.living)throw Error('NPC AI requires a living world');
 let changed=false;
 if(!world.living.npc_ai){world.living.npc_ai={schema:1,brains:{}};changed=true;}
 const brains=world.living.npc_ai.brains;
 for(const n of Object.values(world.living.npcs||{}))
  if(!brains[n.id]){brains[n.id]=defaults(n,world.living.minute);changed=true;}
 return changed;
}
function distance(a,b){return Math.abs(a.x-b.x)+Math.abs(a.y-b.y);}
function closestThreat(world,n){
 return Object.values(world.living.combat?.creatures||{})
  .filter(m=>m.alive&&m.area_id===n.area_id&&distance(m,n)<=ALARM_RANGE)
  .sort((a,b)=>distance(a,n)-distance(b,n)||a.id.localeCompare(b.id))[0]||null;
}
function record(world,minute,n,brain,mode,threat,events){
 if(brain.mode===mode&&brain.threat_id===(threat?.id||null))return;
 const prev=brain.mode;
 brain.mode=mode;brain.threat_id=threat?.id||null;brain.changed_minute=minute;
 const l=world.living;
 const e={id:'event_'+(++l.event_sequence),minute,type:'npc.ai.'+mode,
  text:n.name+' changed behavior from '+prev+' to '+mode+'.',
  npc_id:n.id,area_id:n.area_id,threat_id:brain.threat_id};
 l.events.push(e);if(l.events.length>512)l.events.shift();events.push(e);
}
function sense(world,n,minute,events){
 ensure(world);
 const brain=world.living.npc_ai.brains[n.id];
 if(!n.alive){if(brain.mode!=='dead')record(world,minute,n,brain,'dead',null,events);return brain;}
 const threat=closestThreat(world,n);
 if(threat){
  brain.last_seen_minute=minute;brain.calm_after_minute=minute+RETURN_AFTER;
  record(world,minute,n,brain,GUARD_ROLES.has(n.role)?'defend':'flee',threat,events);
 }else if(['flee','defend'].includes(brain.mode)){
  record(world,minute,n,brain,'recover',null,events);
 }else if(brain.mode==='recover'&&minute>=brain.calm_after_minute)
  record(world,minute,n,brain,'work',null,events);
 return brain;
}
// Bounded BFS (max 8 walking tiles) searches safe reachable ground.
// Deterministic direction order means the same save produces the same escape.
function escapeDestination(world,n,threat){
 const area=world.areas[n.area_id];if(!area)return null;
 const dirs=[[0,-1],[1,0],[0,1],[-1,0]],queue=[{x:n.x,y:n.y,steps:0}];
 const seen=new Set([n.x+','+n.y]);let best=queue[0],bestScore=distance(n,threat)*16;
 for(let i=0;i<queue.length&&i<256;i++){
  const cur=queue[i],dist=Math.abs(cur.x-threat.x)+Math.abs(cur.y-threat.y);
  // Prefer distance from danger, but avoid fleeing all the way across a map.
  const score=dist*16-cur.steps;
  if(score>bestScore){best=cur;bestScore=score;}
  if(cur.steps>=8)continue;
  for(const [dx,dy] of dirs){
   const x=cur.x+dx,y=cur.y+dy,k=x+','+y;
   if(seen.has(k)||x<0||y<0||x>=area.width||y>=area.height)continue;
   if(!traversable(area,x,y,'living'))continue;
   seen.add(k);queue.push({x,y,steps:cur.steps+1});
  }
 }
 if(best.x===n.x&&best.y===n.y)return null;
 return {area_id:n.area_id,x:best.x,y:best.y};
}
function destination(world,n){
 const brain=world.living.npc_ai?.brains[n.id];if(!brain)return null;
 if(!['flee','defend'].includes(brain.mode))return null;
 const threat=world.living.combat?.creatures?.[brain.threat_id];
 if(!threat?.alive||threat.area_id!==n.area_id)return null;
 if(brain.mode==='defend')return {area_id:n.area_id,x:threat.x,y:threat.y};
 return escapeDestination(world,n,threat);
}
function validate(world){
 const state=world.living?.npc_ai;
 if(!state)return true; // old saves are migrated at startup
 if(state.schema!==1||!state.brains||Array.isArray(state.brains)||
  Object.keys(state.brains).length>MAX_BRAINS)throw Error('Invalid NPC behavior registry');
 const limit=world.living.minute;
 for(const [id,b] of Object.entries(state.brains)){
  if(!world.living.npcs[id]||!b||b.npc_id!==id||
   !['work','flee','defend','recover','dead'].includes(b.mode)||
   (b.threat_id!==null&&typeof b.threat_id!=='string')||
   !Number.isSafeInteger(b.changed_minute)||b.changed_minute<0||
   b.changed_minute>limit||
   !Number.isSafeInteger(b.last_seen_minute)||b.last_seen_minute<-1||
   b.last_seen_minute>limit||
   !Number.isSafeInteger(b.calm_after_minute)||b.calm_after_minute<-1||
   b.calm_after_minute>limit+RETURN_AFTER)
   throw Error('Invalid NPC behavior state');
 }
 return true;
}
function listing(world){
 const p=world.characters?.['1'],brains=world.living.npc_ai?.brains||{};
 return {minute:world.living.minute,revision:world.revision,
  nearby:p?Object.values(world.living.npcs).filter(n=>n.area_id===p.area_id&&
   distance(n,p)<=10).map(n=>({npc_id:n.id,name:n.name,alive:n.alive,
    mode:brains[n.id]?.mode||'work',threat_id:brains[n.id]?.threat_id||null})):[]};
}
module.exports={ALARM_RANGE,RETURN_AFTER,ensure,validate,sense,destination,
 escapeDestination,listing,closestThreat};
