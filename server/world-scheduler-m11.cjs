'use strict';
// DK Server M11: durable, deterministic world-minute event scheduler.
// Inspired by RunUO's server-side timer architecture, independently designed.
// No arbitrary function serialization, no browser timers, and no replay on restart.
const {COURT,VILLAGE}=require('./regions.cjs');
const {expire:expireCorpses}=require('./mobile-assets-m12.cjs');
const {merchandises,total:vendorTotal,CAPACITY:VENDOR_CAPACITY}=require('./vendors-m18.cjs');
const {run:workshopRun,RECIPES:WORKSHOP_RECIPES}=require('./workshops-m20.cjs');
const JOBS=Object.freeze({
  postal_dispatch:{every:1,priority:0},
  camp_rotation:{every:90,priority:1},
  shop_restock:{every:120,priority:1},
  guard_payroll:{every:360,priority:2},
  corpse_cleanup:{every:60,priority:2},
  workshop_batch:{every:120,priority:0}
});
const MAX_JOBS=2048,MAX_PER_MINUTE=128;
function future(minute,interval){
  return Math.floor(minute/interval)*interval+interval;
}
function make(minute=0){
  if(!Number.isSafeInteger(minute)||minute<0)throw Error('Invalid scheduler minute');
  const jobs={},entries=Object.entries(JOBS);
  for(let i=0;i<entries.length;i++){
    const [kind,def]=entries[i],id='job_'+(i+1);
    jobs[id]={id,kind,priority:def.priority,interval_minutes:def.every,
      due_minute:future(minute,def.every),fires:0,enabled:true};
  }
  return {schema:1,sequence:entries.length,last_processed_minute:minute,jobs};
}
function ensure(world){
  if(!world.living)throw Error('Scheduler requires living world');
  if(!world.living.scheduler){
    world.living.scheduler=make(world.living.minute);
    return true;
  }
  const s=world.living.scheduler;
  let changed=false;
  for(const [kind,def] of Object.entries(JOBS)){
    if(Object.values(s.jobs).some(job=>job.kind===kind))continue;
    const id='job_'+(++s.sequence);
    s.jobs[id]={id,kind,priority:def.priority,interval_minutes:def.every,
      due_minute:future(world.living.minute,def.every),fires:0,enabled:true};
    changed=true;
  }
  return changed;
}
function validate(world){
  const s=world.living?.scheduler;
  if(!s)return true; // M10/M9 load migration
  if(s.schema!==1||!Number.isSafeInteger(s.sequence)||s.sequence<0||
    !Number.isSafeInteger(s.last_processed_minute)||s.last_processed_minute<0||
    s.last_processed_minute>world.living.minute||
    !s.jobs||Array.isArray(s.jobs)||Object.keys(s.jobs).length>MAX_JOBS)
    throw Error('Invalid persistent scheduler');
  const ids=new Set();
  for(const [id,job] of Object.entries(s.jobs)){
    const def=JOBS[job?.kind];
    if(!def||id!==job.id||!/^job_[1-9][0-9]*$/.test(id)||ids.has(id)||
      !Number.isSafeInteger(job.due_minute)||job.due_minute<=s.last_processed_minute||
      !Number.isSafeInteger(job.fires)||job.fires<0||
      !Number.isInteger(job.interval_minutes)||job.interval_minutes!==def.every||
      job.priority!==def.priority||job.enabled!==true)
      throw Error('Invalid world scheduler job');
    ids.add(id);
  }
  for(const kind of ['postal_dispatch','camp_rotation','shop_restock','guard_payroll'])
    if(!Object.values(s.jobs).some(job=>job.kind===kind))
      throw Error('Required world scheduler job missing');
  return true;
}
function event(world,minute,type,text,details={}){
  const l=world.living;
  const e={id:'event_'+(++l.event_sequence),minute,type,text,...details};
  l.events.push(e);if(l.events.length>512)l.events.shift();
  return e;
}
function postal(world,minute,out){
  const l=world.living;
  const courier=l.npcs.courier;
  if(!courier?.alive||courier.area_id!==VILLAGE||
    Math.abs(courier.x-54)+Math.abs(courier.y-103)>3)return;
  for(let i=l.mail.outbound.length-1;i>=0;i--){
    const letter=l.mail.outbound[i];
    if(letter.eta_minute>minute)continue;
    l.mail.outbound.splice(i,1);
    (l.mail.boxes[String(letter.to_slot)]??=[]).push({...letter,delivered_minute:minute});
    out.push(event(world,minute,'mail.delivered',
      'A letter was delivered to a bank box.',
      {letter_id:letter.id,area_id:VILLAGE}));
  }
}
function camp(world,minute,out){
  const l=world.living,c=l.traveling_camps.camp_1;
  if(!c)return;
  if(c.present&&minute>=c.leaves_at){
    c.present=false;
    out.push(event(world,minute,'camp.departed','The traveling camp has departed.',
      {area_id:c.area_id}));
  }else if(!c.present&&minute-c.leaves_at>=180){
    c.present=true;c.area_id=c.area_id===COURT?VILLAGE:COURT;
    c.x=c.area_id===COURT?52:80;c.y=c.area_id===COURT?27:68;
    c.arrived_at=minute;c.leaves_at=minute+240;
    out.push(event(world,minute,'camp.arrived','A traveling camp has arrived.',
      {area_id:c.area_id}));
  }
}
function restock(world,minute,out){
  for(const shop of Object.values(world.living.businesses)){
    if(Object.hasOwn(WORKSHOP_RECIPES,shop.id))continue; // Makers require actual supplies.
    if(shop.stock>=12||shop.coins<30||
      (merchandises(shop)&&vendorTotal(shop)+25>VENDOR_CAPACITY))continue;
    shop.stock+=25;shop.coins-=30;shop.expenses+=30;
    out.push(event(world,minute,'business.delivery',
      'A supplier replenished '+shop.name+'.',
      {business_id:shop.id,area_id:shop.area_id,units:25}));
  }
}
function payroll(world,minute,out){
  // A real village business pays guards from earned money, not free coins.
  const bank=world.living.businesses.village_bank;
  if(!bank||bank.coins<2)return;
  for(const guard of Object.values(world.living.npcs)){
    if(!guard.alive||guard.role!=='guard'||guard.area_id!==VILLAGE)continue;
    if(bank.coins<2)break;
    bank.coins-=2;bank.expenses+=2;guard.coins+=2;
    out.push(event(world,minute,'npc.wages',guard.name+' received two coins for guarding the village.',
      {npc_id:guard.id,area_id:VILLAGE,payer:bank.id,amount:2}));
  }
}
const HANDLERS=Object.freeze({
  postal_dispatch:postal,camp_rotation:camp,shop_restock:restock,guard_payroll:payroll,
  corpse_cleanup:expireCorpses,workshop_batch:workshopRun
});
function runMinute(world,minute,out){
  ensure(world);
  const s=world.living.scheduler;
  if(!Number.isSafeInteger(minute)||minute<0)throw Error('Invalid world timer tick');
  if(minute<=s.last_processed_minute)return 0; // no double firing on restarts
  if(minute!==s.last_processed_minute+1)
    throw Error('World scheduler must advance in exact minutes');
  const ready=Object.values(s.jobs).filter(j=>j.enabled&&j.due_minute<=minute)
    .sort((a,b)=>a.due_minute-b.due_minute||a.priority-b.priority||
      Number(a.id.slice(4))-Number(b.id.slice(4)));
  if(ready.length>MAX_PER_MINUTE)
    throw Error('World scheduler execution budget exceeded');
  for(const job of ready){
    // A callback never runs twice for the same due-minute and job ID.
    const due=job.due_minute;
    if(due!==minute)throw Error('World timer skipped its due minute');
    HANDLERS[job.kind](world,minute,out);
    job.fires++;
    job.due_minute=minute+job.interval_minutes;
  }
  s.last_processed_minute=minute;
  return ready.length;
}
function listing(world){
  const s=world.living?.scheduler;
  return {world_minute:world.living?.minute||0,paused:!world.runtime?.running,
    jobs:Object.values(s?.jobs||{}).map(j=>({
      kind:j.kind,next_minute:j.due_minute,interval_minutes:j.interval_minutes,
      priority:j.priority,fires:j.fires
    })).sort((a,b)=>a.next_minute-b.next_minute||a.priority-b.priority)};
}
module.exports={JOBS,make,ensure,validate,runMinute,listing};
