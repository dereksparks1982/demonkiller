'use strict';
// M65: server-authoritative settlement campaigns and meaningful post-siege recovery.
// No RunUO source; derives state from saved territory, guard, refugee and business records.
const {COURT,VILLAGE}=require('./regions.cjs');
const AREAS=Object.freeze([COURT,VILLAGE]);
const PHASES=Object.freeze(['peace','occupied','rebuilding']);
const STABLE_MINUTES=90,INTERVAL=5;
const alive=n=>n?.alive===true;
function population(world,area){
 const all=Object.values(world.living.npcs||{}),r=world.living.refugees?.records||{};
 const civilians=all.filter(n=>n.home_area===area&&!['guard','escort','caravan'].includes(n.role));
 const survivors=civilians.filter(alive);
 const absent=survivors.filter(n=>n.area_id!==area||
  (r[n.id]&&r[n.id].status!=='home')).length;
 const displaced=survivors.filter(n=>['evacuating','sheltered','returning','stranded']
  .includes(r[n.id]?.status)).length;
 const shops=Object.values(world.living.businesses||{}).filter(s=>s.area_id===area);
 const open=shops.filter(s=>s.open).length;
 const soldiers=all.filter(n=>['guard','escort'].includes(n.role)&&n.home_area===area);
 const hostile=Object.values(world.living.combat?.creatures||{})
  .filter(m=>m.alive&&m.area_id===area).length;
 return {residents:civilians.length,living_residents:survivors.length,
  absent,displaced,dead:civilians.length-survivors.length,
  guard_count:soldiers.length,living_guards:soldiers.filter(alive).length,
  hostile,shops:shops.length,open_shops:open,
  guard_kills:world.living.guard_watch?.total_kills||0};
}
function entry(world,id){
 const occupied=world.living.territories[id]?.control==='monsters';
 return {area_id:id,phase:occupied?'occupied':'peace',
  phase_since_minute:world.living.minute,
  last_occupied_minute:occupied?world.living.minute:-1,
  last_liberated_minute:-1,last_recovered_minute:-1,
  occupations:occupied?1:0,liberations:0,recoveries:0,
  displaced_peak:0};
}
function ensure(world){
 if(!world?.living)throw Error('Settlement campaign requires living world');
 let changed=false;
 if(!world.living.settlement_campaigns){
  world.living.settlement_campaigns={schema:1,
   last_processed_minute:world.living.minute,regions:{}};
  changed=true;
 }
 const state=world.living.settlement_campaigns;
 for(const id of AREAS){
  if(!state.regions[id]){state.regions[id]=entry(world,id);changed=true;}
 }
 return changed;
}
function validate(world){
 const state=world.living?.settlement_campaigns;
 if(!state)return true; // before M65
 // Territory may flip during an explicit player combat action; the saved
 // campaign journal catches up at its next five-minute world tick.
 if(state.schema!==1||!state.regions||Array.isArray(state.regions)||
  Object.keys(state.regions).length!==AREAS.length||
  !Number.isSafeInteger(state.last_processed_minute)||
  state.last_processed_minute<0||
  state.last_processed_minute>world.living.minute)
  throw Error('Invalid settlement campaign ledger');
 for(const id of AREAS){
  const r=state.regions[id];
  if(!r||r.area_id!==id||!PHASES.includes(r.phase)||
   !Number.isSafeInteger(r.phase_since_minute)||
   r.phase_since_minute<0||r.phase_since_minute>world.living.minute||
   ['last_occupied_minute','last_liberated_minute','last_recovered_minute']
    .some(k=>!Number.isSafeInteger(r[k])||r[k]<-1||r[k]>world.living.minute)||
   ['occupations','liberations','recoveries','displaced_peak']
    .some(k=>!Number.isSafeInteger(r[k])||r[k]<0)||
   r.liberations>r.occupations||r.recoveries>r.liberations)
   throw Error('Invalid settlement campaign record');
 }
 return true;
}
function log(world,minute,type,id,stats,out){
 const l=world.living;
 const message=type==='settlement.siege_started'?'A settlement has fallen to hostile occupation.':
  type==='settlement.liberated'?'Defenders reclaimed the settlement.':
   'Residents and commerce have recovered after the occupation.';
 const e={id:'event_'+(++l.event_sequence),minute,type,text:message,area_id:id,
  displaced:stats.displaced,living_residents:stats.living_residents,
  open_shops:stats.open_shops,hostiles:stats.hostile};
 l.events.push(e);if(l.events.length>512)l.events.shift();out.push(e);
}
function tick(world,minute,out){
 if(!Number.isSafeInteger(minute)||minute<0||minute%INTERVAL!==0)
  throw Error('Invalid campaign tick');
 ensure(world);
 const state=world.living.settlement_campaigns;
 if(minute<=state.last_processed_minute)return 0;
 let transitions=0;
 for(const id of AREAS){
  const r=state.regions[id],stats=population(world,id);
  r.displaced_peak=Math.max(r.displaced_peak,stats.displaced);
  if(world.living.territories[id].control==='monsters'){
   if(r.phase!=='occupied'){
    r.phase='occupied';r.phase_since_minute=minute;
    r.last_occupied_minute=minute;r.occupations++;
    log(world,minute,'settlement.siege_started',id,stats,out);transitions++;
   }
   continue;
  }
  if(r.phase==='occupied'){
   r.phase='rebuilding';r.phase_since_minute=minute;
   r.last_liberated_minute=minute;r.liberations++;
   log(world,minute,'settlement.liberated',id,stats,out);transitions++;
  }
  if(r.phase==='rebuilding'&&
    minute-r.phase_since_minute>=STABLE_MINUTES&&
    stats.absent===0&&(stats.shops===0||stats.open_shops>0)){
   r.phase='peace';r.phase_since_minute=minute;
   r.last_recovered_minute=minute;r.recoveries++;
   log(world,minute,'settlement.recovered',id,stats,out);transitions++;
  }
 }
 state.last_processed_minute=minute;
 return transitions;
}
function listing(world){
 const state=world.living?.settlement_campaigns;
 return {world_minute:world.living.minute,revision:world.revision,
  regions:AREAS.map(area_id=>{
   const r=state?.regions?.[area_id]||entry(world,area_id);
   return {...r,population:population(world,area_id),
    recovering_until_minute:r.phase==='rebuilding'?
     r.phase_since_minute+STABLE_MINUTES:null};
  })};
}
module.exports={AREAS,STABLE_MINUTES,INTERVAL,PHASES,population,
 ensure,validate,tick,listing};
