'use strict';
// M15: independent guarded-region and witness-based crime simulation.
// RunUO-inspired region/notoriety concepts; no GPL implementation copied.
const {VILLAGE}=require('./regions.cjs');
const {regionAt}=require('./region-policies-m16.cjs');
const {chooseStep}=require('./npc-navigation-m6.cjs');
const MAX_CASES=500,THEFT_FINE=12,WITNESS_RANGE=8;
function initial(){
 return {schema:1,player:{fines:0,heat:0,wanted_until_minute:-1,
  detained_until_minute:-1,last_crime_minute:-1,last_guard_action_minute:-1,
  citations:0},sequence:0,cases:{}};
}
function ensure(world){
 if(!world.living)throw Error('Law requires a living world');
 if(world.living.law)return false;
 world.living.law=initial();return true;
}
function validate(world){
 const law=world.living?.law;
 if(!law)return true; // Backward-compatible M14 world before migration.
 const p=law.player;
 if(law.schema!==1||!p||!law.cases||Array.isArray(law.cases)||
    Object.keys(law.cases).length>MAX_CASES||
    !Number.isSafeInteger(law.sequence)||law.sequence<0)
  throw Error('Invalid world law state');
 for(const key of ['fines','heat','citations']){
  if(!Number.isSafeInteger(p[key])||p[key]<0||p[key]>1e7)
   throw Error('Invalid criminal status');
 }
 if(p.heat>100)throw Error('Invalid criminal heat');
 for(const key of ['wanted_until_minute','detained_until_minute',
   'last_crime_minute','last_guard_action_minute']){
  if(!Number.isSafeInteger(p[key])||p[key]<-1)
   throw Error('Invalid criminal timeline');
 }
 for(const [id,c] of Object.entries(law.cases)){
  if(!/^case_[1-9][0-9]*$/.test(id)||!c||c.id!==id||
    !['corpse_theft','pickpocket'].includes(c.kind)||c.area_id!==VILLAGE||
    !Number.isSafeInteger(c.minute)||c.minute<0||
    !Number.isSafeInteger(c.fine)||c.fine<0||c.fine>THEFT_FINE||
    typeof c.reported!=='boolean'||!Array.isArray(c.witnesses)||
    c.witnesses.some(n=>typeof n!=='string'||!world.living.npcs[n]))
    throw Error('Invalid law case');
 }
 return true;
}
function log(world,minute,type,text,extra={}){
 const l=world.living;
 const e={id:'event_'+(++l.event_sequence),minute,type,text,...extra};
 l.events.push(e);if(l.events.length>512)l.events.shift();
 return e;
}
function guarded(world,area_id,x,y){
 if(area_id!==VILLAGE)return false;
 if(Number.isInteger(x)&&Number.isInteger(y))
   return regionAt(world,area_id,x,y).guarded;
 return world.living.territories[VILLAGE]?.control==='settlers';
}
function witnesses(world,area_id,x,y,victim){
 return Object.values(world.living.npcs).filter(n=>n.alive&&n.id!==victim&&
  n.area_id===area_id&&Math.abs(n.x-x)+Math.abs(n.y-y)<=WITNESS_RANGE)
  .map(n=>n.id).sort();
}
function reportCorpseLoot(world,corpse,minute,out){
 ensure(world);
 if(!guarded(world,corpse.area_id,corpse.x,corpse.y))return null;
 const player=world.characters?.['1'];
 if(!player)throw Error('No player for law report');
 const seen=witnesses(world,corpse.area_id,corpse.x,corpse.y,corpse.npc_id);
 const law=world.living.law,id='case_'+(++law.sequence);
 const crime={id,kind:'corpse_theft',npc_id:corpse.npc_id,
   area_id:VILLAGE,minute,fine:seen.length?THEFT_FINE:0,
   reported:seen.length>0,witnesses:seen};
 law.cases[id]=crime;
 if(Object.keys(law.cases).length>MAX_CASES){
  const oldest=Object.keys(law.cases).sort((a,b)=>Number(a.slice(5))-Number(b.slice(5)))[0];
  delete law.cases[oldest];
 }
 const e=log(world,minute,seen.length?'law.crime.reported':'law.crime.unwitnessed',
  seen.length?'A resident reported theft from the dead.':
    'The player took belongings from a villager without being observed.',
  {case_id:id,area_id:VILLAGE,report_count:seen.length,npc_id:corpse.npc_id});
 out.push(e);
 if(seen.length){
  const p=law.player;p.fines=Math.min(1e7,p.fines+THEFT_FINE);
  p.heat=Math.min(100,p.heat+20);
  p.wanted_until_minute=Math.max(p.wanted_until_minute,minute+180);
  p.last_crime_minute=minute;
  const reputation=world.living.social?.reputation;
  if(reputation)reputation.town=Math.max(-1000,reputation.town-5);
 }
 validate(world);return crime;
}
function reportPickpocket(world,npc,minute,out,{failed=false}={}){
 ensure(world);
 if(!guarded(world,npc.area_id,npc.x,npc.y))return null;
 const seen=witnesses(world,npc.area_id,npc.x,npc.y,npc.id);
 if(failed&&!seen.includes(npc.id))seen.push(npc.id);
 seen.sort();
 const l=world.living,law=l.law,id='case_'+(++law.sequence);
 const crime={id,kind:'pickpocket',npc_id:npc.id,area_id:VILLAGE,
  minute,fine:seen.length?THEFT_FINE:0,reported:seen.length>0,
  witnesses:seen};
 law.cases[id]=crime;
 if(Object.keys(law.cases).length>MAX_CASES){
  const oldest=Object.keys(law.cases)
   .sort((a,b)=>Number(a.slice(5))-Number(b.slice(5)))[0];
  delete law.cases[oldest];
 }
 const e=log(world,minute,seen.length?'law.crime.reported':'law.crime.unwitnessed',
  seen.length?'A witness reported attempted theft from '+npc.name+'.':
   'A pickpocket went unreported in the village.',
  {kind:'pickpocket',case_id:id,npc_id:npc.id,area_id:VILLAGE,
   report_count:seen.length});
 out.push(e);
 if(seen.length){
  const p=law.player;p.fines=Math.min(1e7,p.fines+THEFT_FINE);
  p.heat=Math.min(100,p.heat+20);
  p.wanted_until_minute=Math.max(p.wanted_until_minute,minute+180);
  p.last_crime_minute=minute;
  if(l.social?.reputation)
   l.social.reputation.town=Math.max(-1000,l.social.reputation.town-5);
 }
 validate(world);return crime;
}
function tick(world,minute,events){
 const l=world.living,law=l.law,c=world.characters?.['1'];
 if(!law||!c||minute%5!==0)return;
 const p=law.player;
 if(!guarded(world,c.area_id,c.x,c.y)||c.form!=='living'||p.fines<=0||
   p.wanted_until_minute<minute||p.detained_until_minute>=minute)return;
 const guards=Object.values(l.npcs).filter(n=>n.alive&&n.role==='guard'&&
   n.area_id===c.area_id&&Math.abs(n.x-c.x)+Math.abs(n.y-c.y)<=32)
  .sort((a,b)=>(Math.abs(a.x-c.x)+Math.abs(a.y-c.y))-
     (Math.abs(b.x-c.x)+Math.abs(b.y-c.y))||a.id.localeCompare(b.id));
 if(!guards.length)return;
 const guard=guards[0],dist=()=>Math.abs(guard.x-c.x)+Math.abs(guard.y-c.y);
 if(dist()>1){
  const step=chooseStep(world,guard,{area_id:c.area_id,x:c.x,y:c.y});
  if(step&&step.area_id===c.area_id){guard.x=step.x;guard.y=step.y;}
  guard.status='pursuing';
  return;
 }
 if(p.last_guard_action_minute>=0&&minute-p.last_guard_action_minute<60)return;
 p.last_guard_action_minute=minute;p.citations++;
 const payment=Math.min(p.fines,c.gold);
 const bank=l.businesses.village_bank;
 if(payment>0&&bank){
  c.gold-=payment;bank.coins+=payment;p.fines-=payment;
 }
 if(p.fines>0){
  p.detained_until_minute=minute+60;
  c.crafting.energy=Math.max(0,c.crafting.energy-10);
 }else{
  p.heat=0;p.wanted_until_minute=-1;
 }
 events.push(log(world,minute,'law.guard.intervention',
  p.fines?'A village guard detained the wanted character.':
    'A village guard collected a lawful fine.',
  {area_id:VILLAGE,guard_id:guard.id,amount:payment,remaining_fine:p.fines}));
 validate(world);
}
function payFine(world,command){
 if(!command||typeof command!=='object'||Array.isArray(command)||
  Object.keys(command).sort().join(',')!=='action,amount'||
  command.action!=='pay_fine'||!Number.isSafeInteger(command.amount)||
  command.amount<1||command.amount>1000)
  throw Error('Invalid fine payment');
 if(!world.runtime?.running)throw Error('World is paused');
 const next=structuredClone(world),c=next.characters?.['1'];
 if(!c)throw Error('No character exists');
 if(c.form!=='living')throw Error('Ghosts cannot pay a fine');
 if(!guarded(next,c.area_id,c.x,c.y)||Math.abs(c.x-54)+Math.abs(c.y-103)>3)
  throw Error('Visit the open Village Bank to pay a fine');
 const bank=next.living.businesses.village_bank;
 if(!bank?.open)throw Error('The bank is closed');
 ensure(next);
 const p=next.living.law.player,amount=command.amount;
 if(!p.fines)throw Error('No outstanding fine exists');
 if(amount>p.fines||amount>c.gold)throw Error('Insufficient gold or excess fine payment');
 c.gold-=amount;bank.coins+=amount;p.fines-=amount;
 if(!p.fines){p.heat=0;p.wanted_until_minute=-1;p.detained_until_minute=-1;}
 const minute=next.living.minute;
 const e=log(next,minute,'law.fine.paid',
  'A fine was paid into the village treasury.',
  {amount,remaining_fine:p.fines,area_id:VILLAGE});
 c.revision++;next.revision++;
 validate(next);
 return {world:next,character:c,event:e};
}
function listing(world){
 const l=world.living,law=l.law||initial(),c=world.characters?.['1'];
 return {guarded_area:VILLAGE,area_guarded:c?guarded(world,c.area_id,c.x,c.y):false,
   minute:l.minute,player:{...law.player},
   recent_cases:Object.values(law.cases).sort((a,b)=>b.minute-a.minute).slice(0,10)
     .map(x=>({id:x.id,kind:x.kind,minute:x.minute,
       reported:x.reported,number_of_witnesses:x.witnesses.length,fine:x.fine})),
   revision:world.revision};
}
module.exports={THEFT_FINE,WITNESS_RANGE,ensure,validate,guarded,witnesses,
 reportCorpseLoot,reportPickpocket,tick,payFine,listing};
