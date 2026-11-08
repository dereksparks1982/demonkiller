'use strict';
// DK Server M61: persistent guard watch, alarms and independent defensive attacks.
// Designed independently; no RunUO/GPL implementation is included.
const {chooseStep}=require('./npc-navigation-m6.cjs');
const {traversable}=require('./regions.cjs');
const MONSTER_AI=require('./monster-ai-m60.cjs');
const CREATURES=require('./creatures-m42.cjs');
const MAX_GUARDS=128, ALERT_RANGE=9, ASSIST_RANGE=14, ALARM_TTL=15;
const GUARDS=new Set(['guard','escort']);
const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
function isGuard(n){return n&&GUARDS.has(n.role);}
function record(n){return {npc_id:n.id,alert_target_id:null,alert_until_minute:-1,
 last_attack_minute:-1,attacks:0,kills:0,alarms:0};}
function ensure(world){
 if(!world.living)throw Error('Guard watch needs a persistent world');
 let changed=false;
 if(!world.living.guard_watch){
  world.living.guard_watch={schema:1,sentries:{},total_attacks:0,total_kills:0,
   total_alarms:0,last_tick_minute:-1};
  changed=true;
 }
 const s=world.living.guard_watch;
 for(const n of Object.values(world.living.npcs||{})){
  if(!isGuard(n)||s.sentries[n.id])continue;
  if(Object.keys(s.sentries).length>=MAX_GUARDS)throw Error('Guard watch capacity exceeded');
  s.sentries[n.id]=record(n);changed=true;
 }
 return changed;
}
function validate(world){
 const s=world.living?.guard_watch;if(!s)return true; // M60 save migration
 if(s.schema!==1||!s.sentries||Array.isArray(s.sentries)||
    Object.keys(s.sentries).length>MAX_GUARDS)
  throw Error('Invalid guard watch');
 const now=world.living.minute;
 for(const k of ['total_attacks','total_kills','total_alarms'])
  if(!Number.isSafeInteger(s[k])||s[k]<0)throw Error('Invalid guard watch counter');
 if(!Number.isSafeInteger(s.last_tick_minute)||s.last_tick_minute<-1||
    s.last_tick_minute>now)throw Error('Invalid guard watch tick');
 let attacks=0,kills=0,alarms=0;
 for(const [id,r] of Object.entries(s.sentries)){
  const n=world.living.npcs[id];
  if(!isGuard(n)||!r||r.npc_id!==id||
    (r.alert_target_id!==null&&(typeof r.alert_target_id!=='string'||
     !/^[a-z]+_[0-9]+$/.test(r.alert_target_id)))||
    !Number.isSafeInteger(r.alert_until_minute)||r.alert_until_minute<-1||
    r.alert_until_minute>now+ALARM_TTL+180||
    !Number.isSafeInteger(r.last_attack_minute)||r.last_attack_minute<-1||
    r.last_attack_minute>now||
    ['attacks','kills','alarms'].some(k=>!Number.isSafeInteger(r[k])||r[k]<0))
   throw Error('Invalid guard watch sentry');
  attacks+=r.attacks;kills+=r.kills;alarms+=r.alarms;
 }
 if(attacks>s.total_attacks||kills>s.total_kills||alarms>s.total_alarms)
  throw Error('Invalid guard watch totals');
 return true;
}
function emit(world,minute,type,text,details,out){
 const l=world.living,e={id:'event_'+(++l.event_sequence),minute,type,text,...details};
 l.events.push(e);if(l.events.length>512)l.events.shift();out.push(e);
}
function sighted(world,guard){
 const area=world.areas[guard.area_id],creatures=world.living.combat?.creatures||{};
 return Object.values(creatures).filter(c=>c.alive&&c.area_id===guard.area_id&&
  distance(c,guard)<=ALERT_RANGE&&MONSTER_AI.sight(area,guard,c))
  .sort((a,b)=>distance(a,guard)-distance(b,guard)||a.id.localeCompare(b.id))[0]||null;
}
function watch(world,guard,minute,events){
 const s=world.living.guard_watch,r=s.sentries[guard.id];
 const closest=sighted(world,guard);
 if(closest){
  if(r.alert_target_id!==closest.id){
   r.alarms++;s.total_alarms++;
   emit(world,minute,'guard.alarm',guard.name+' raised an alarm!',
    {npc_id:guard.id,creature_id:closest.id,area_id:guard.area_id},events);
  }
  r.alert_target_id=closest.id;
  r.alert_until_minute=minute+ALARM_TTL;
  return closest;
 }
 // Guards share a local alarm while the original witness remains in the area.
 const allies=Object.values(s.sentries).filter(o=>o.npc_id!==guard.id&&
  o.alert_target_id&&o.alert_until_minute>=minute)
  .map(o=>({sentry:o,npc:world.living.npcs[o.npc_id]}))
  .filter(o=>o.npc?.alive&&o.npc.area_id===guard.area_id&&
   distance(guard,o.npc)<=ASSIST_RANGE)
  .sort((a,b)=>distance(guard,a.npc)-distance(guard,b.npc)||
   a.npc.id.localeCompare(b.npc.id));
 for(const ally of allies){
  const threat=world.living.combat?.creatures?.[ally.sentry.alert_target_id];
  if(threat?.alive&&threat.area_id===guard.area_id&&distance(guard,threat)<=ASSIST_RANGE){
   r.alert_target_id=threat.id;r.alert_until_minute=minute+ALARM_TTL;return threat;
  }
 }
 r.alert_target_id=null;
 return null;
}
function clearTile(world,guard,x,y){
 const area=world.areas[guard.area_id];
 if(!traversable(area,x,y,'living'))return false;
 if(Object.values(world.living.npcs).some(n=>n.alive&&n.id!==guard.id&&
   n.area_id===guard.area_id&&n.x===x&&n.y===y))return false;
 if(Object.values(world.living.combat?.creatures||{}).some(c=>
   c.alive&&c.area_id===guard.area_id&&c.x===x&&c.y===y))return false;
 const p=world.characters?.['1'];
 if(p?.area_id===guard.area_id&&p.x===x&&p.y===y)return false;
 return true;
}
function tick(world,minute,events,kill){
 if(!Number.isSafeInteger(minute)||minute<0)throw Error('Invalid guard minute');
 if(minute%5!==0)return 0;
 if(typeof kill!=='function')throw Error('Guard combat needs server death handler');
 ensure(world);
 const s=world.living.guard_watch;
 if(minute<=s.last_tick_minute)return 0;
 let hits=0;
 // Deterministic action order prevents reload from changing who kills a monster.
 for(const guard of Object.values(world.living.npcs).filter(n=>n.alive&&isGuard(n))
   .sort((a,b)=>a.id.localeCompare(b.id))){
  const r=s.sentries[guard.id],target=watch(world,guard,minute,events);
  if(!target)continue;
  if(guard.health<=10){
   // Injured guards stop charging into monsters, allowing M21 recover logic.
   guard.status='wounded';continue;
  }
  if(distance(guard,target)>1){
   const step=chooseStep(world,guard,{area_id:guard.area_id,x:target.x,y:target.y});
   if(step?.area_id===guard.area_id&&clearTile(world,guard,step.x,step.y)){
    guard.x=step.x;guard.y=step.y;guard.status='defending';
   }
   continue;
  }
  if(r.last_attack_minute>=minute)continue;
  r.last_attack_minute=minute;r.attacks++;s.total_attacks++;hits++;
  // Small tier bonus for surviving guards, capped so the result is bounded.
  const damage=Math.min(8,4+Math.floor(r.attacks/40));
  target.health=Math.max(0,target.health-damage);
  emit(world,minute,'guard.strike',guard.name+' struck a '+CREATURES.config(target.kind).name+'.',
    {npc_id:guard.id,creature_id:target.id,area_id:guard.area_id,damage},events);
  if(target.health===0){
   r.kills++;s.total_kills++;r.alert_target_id=null;
   kill(world,target,minute,events,'guard');
   emit(world,minute,'guard.kill',guard.name+' defeated a hostile creature.',
     {npc_id:guard.id,creature_id:target.id,area_id:guard.area_id},events);
  }
 }
 s.last_tick_minute=minute;
 return hits;
}
function listing(world,area_id=null){
 const s=world.living.guard_watch;
 return {world_minute:world.living.minute,
  total_attacks:s?.total_attacks||0,total_kills:s?.total_kills||0,
  total_alarms:s?.total_alarms||0,
  sentries:Object.entries(s?.sentries||{}).filter(([id])=>
   !area_id||world.living.npcs[id]?.area_id===area_id)
    .map(([id,r])=>({
     npc_id:id,alive:world.living.npcs[id]?.alive||false,
     area_id:world.living.npcs[id]?.area_id||null,
     alarm_target_id:r.alert_target_id,alarms:r.alarms,
     attacks:r.attacks,kills:r.kills
    })).sort((a,b)=>a.npc_id.localeCompare(b.npc_id))};
}
module.exports={ALERT_RANGE,ASSIST_RANGE,ALARM_TTL,ensure,validate,sighted,
 watch,tick,listing};
