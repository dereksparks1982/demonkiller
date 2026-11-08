'use strict';
// DK Server living world. The server advances NPCs even when no browser is open.
// All randomness uses a saved seed; no client timer or reload-triggered events.
const {COURT,VILLAGE,traversable,portal}=require('./regions.cjs');
const {regenerate}=require('./gameplay.cjs');
const {tick:socialTick}=require('./social-m6.cjs');
const {chooseStep}=require('./npc-navigation-m6.cjs');
const {tick:craftTick}=require('./crafting-m7.cjs');
const {tick:combatTick,dead:monsterDeath}=require('./combat-m8.cjs');
const SPAWNERS=require('./spawners-m59.cjs');
const GUARDS=require('./guard-watch-m61.cjs');
const GARRISON=require('./garrison-m62.cjs');
const REFUGEES=require('./refugees-m63.cjs');
const TRAFFIC=require('./npc-traffic-m64.cjs');
const CAMPAIGNS=require('./settlement-campaigns-m65.cjs');
const REBUILD=require('./reconstruction-m66.cjs');
const COMPANIONS=require('./companions-m46.cjs');
const MILLING=require('./milling-m47.cjs');
const BUSINESS=require('./player-business-m48.cjs');
const MAINTENANCE=require('./business-maintenance-m50.cjs');
const ARMORER=require('./armorer-m55.cjs');
const MAGIC=require('./spells-m44.cjs');
const {tick:storageTick}=require('./storage-m9.cjs');
const {reconcile:reconcileEntities}=require('./entity-registry-m10.cjs');
const {ensure:ensureScheduler,runMinute:runScheduled}=require('./world-scheduler-m11.cjs');
const {npcSenseDue}=require('./sector-interest-m31.cjs');
const {ensure:ensureMobileAssets,onDeath:recordMobileDeath}=require('./mobile-assets-m12.cjs');
const {ensure:ensureLaw,tick:lawTick}=require('./law-m15.cjs');
const {ensure:ensureDistricts,syncNpcTransitions}=require('./region-policies-m16.cjs');
const NPCCOMMERCE=require('./npc-commerce-m19.cjs');
const NPCAI=require('./mobile-ai-m21.cjs');
const NPCHARVEST=require('./npc-harvest-m22.cjs');
const CARAVAN=require('./caravan-logistics-m24.cjs');
const {location:shopLocation}=require('./vendors-m18.cjs');
const MINUTE=60_000,DAY=720,MAX_EVENTS=512;
const HOME=Object.freeze({
 bank_clerk:[VILLAGE,54,103],baker:[VILLAGE,87,101],
 blacksmith:[VILLAGE,25,114],market_vendor:[VILLAGE,70,69],
 guard_north:[VILLAGE,64,66],guard_south:[VILLAGE,64,122],
 courtyard_keeper:[COURT,20,30],courier:[VILLAGE,57,104],
 caravan_trader:[VILLAGE,64,120],caravan_guard:[VILLAGE,65,121],
 tavern_keeper:[VILLAGE,107,114],herbalist:[COURT,12,28]
});
const NPCS=[
 ['bank_clerk','Bank Clerk','bank'],['baker','Baker','bakery'],
 ['blacksmith','Blacksmith','smithy'],['market_vendor','Market Vendor','market'],
 ['guard_north','North Guard','guard'],['guard_south','South Guard','guard'],
 ['courtyard_keeper','Courtyard Keeper','caretaker'],['courier','Postal Courier','courier'],
 ['caravan_trader','Wandering Merchant','caravan'],
 ['caravan_guard','Caravan Guard','escort'],
 ['tavern_keeper','Innkeeper','tavern'],['herbalist','Traveling Herbalist','herbalist']
];
const SHOPS=[
 ['village_bank','Village Bank','bank',VILLAGE],
 ['village_bakery','Village Bakery','bread',VILLAGE],
 ['village_smithy','Village Smithy','tools',VILLAGE],
 ['village_market','Village Market','produce',VILLAGE],
 ['village_tavern','Village Tavern','meals',VILLAGE],
 ['courtyard_market','Courtyard Market','herbs',COURT]
];
function seed(){
 const npcs={};
 for(const [id,name,role] of NPCS){
  const [area_id,x,y]=HOME[id];
  npcs[id]={id,name,role,area_id,x,y,home_area:area_id,
   home_x:x,home_y:y+2,alive:true,health:100,hunger:0,energy:100,
   status:'idle',last_change:0,age_years:22+(id.length*7%35),coins:20};
 }
 const businesses={};
 for(const [id,name,product,area_id] of SHOPS)
  businesses[id]={id,name,product,area_id,owner_id:id==='village_bank'?'bank_clerk':
    id==='village_bakery'?'baker':id==='village_smithy'?'blacksmith':
    id==='village_market'?'market_vendor':id==='village_tavern'?'tavern_keeper':'herbalist',
    open:false,stock:40,coins:200,sales:0,expenses:0,last_sale_minute:0};
 return {schema:1,minute:0,seed:0x5eed600d,event_sequence:0,events:[],
  npcs,businesses,territories:{
    [COURT]:{id:COURT,control:'settlers',threat:0,security:6,last_raid:0},
    [VILLAGE]:{id:VILLAGE,control:'settlers',threat:0,security:9,last_raid:0}
  },traveling_camps:{camp_1:{id:'camp_1',area_id:COURT,x:52,y:27,
    present:true,arrived_at:0,leaves_at:210}},
  mail:{sequence:1,outbound:[{id:'letter_1',from:'Village Bank',
   to_slot:1,subject:'A bank box has been reserved',
   body:'Your correspondence is held at the Village Bank until you collect it.',
   written_minute:0,eta_minute:65}],boxes:{'1':[]},collected:[]}};
}
function ensureLivingWorld(world){
 if(world.living)return false;
 world.living=seed();return true;
}
function rng(living){
 living.seed=(Math.imul(living.seed,1664525)+1013904223)>>>0;
 return living.seed/4294967296;
}
function event(living,minute,type,text,details={}){
 const e={id:'event_'+(++living.event_sequence),minute,type,text,...details};
 living.events.push(e);if(living.events.length>MAX_EVENTS)living.events.shift();
 return e;
}
function npcDestination(n,minute,world){
 const t=minute%DAY,day=t<360;
 if(n.role==='guard'){
  const p=world.characters?.['1'],w=world.living.law?.player;
  if(p?.form==='living'&&p.area_id===VILLAGE&&w?.fines>0&&
     w.wanted_until_minute>=minute&&w.detained_until_minute<minute)
   return {area_id:VILLAGE,x:p.x,y:p.y};
 }
 const caravan=CARAVAN.destination(world,n);
 if(caravan)return caravan;
 const harvesting=NPCHARVEST.destination(world,n);
 if(harvesting)return harvesting;
 const shopperDestination=NPCCOMMERCE.destination(world,n);
 if(shopperDestination)return shopperDestination;
 if(n.role==='caravan'||n.role==='escort'){
  const away=(Math.floor(minute/240)%2===0);
  return away?{area_id:COURT,x:n.role==='caravan'?46:45,y:27}:
   {area_id:VILLAGE,x:n.role==='caravan'?70:69,y:68};
 }
 if(n.role==='courier')return {area_id:VILLAGE,x:54,y:103};
 if(n.role==='guard')return {area_id:n.home_area,x:n.home_x,y:day?65:120};
 if(!day)return {area_id:n.home_area,x:n.home_x,y:n.home_y};
 if(n.role==='herbalist')return {area_id:COURT,x:12,y:28};
 return {area_id:n.home_area,x:n.home_x,y:n.home_y-2};
}
function npcStep(n,world,dest){
 const step=chooseStep(world,n,dest);
 if(!step)return false;
 n.area_id=step.area_id;n.x=step.x;n.y=step.y;
 return true;
}
function changeStatus(n,desired,minute,living,allEvents){
 if(n.status===desired)return;
 n.status=desired;n.last_change=minute;
 // Persist meaningful changes without flooding the timeline every step.
 allEvents.push(event(living,minute,'npc.schedule',n.name+' is now '+desired,
   {npc_id:n.id,area_id:n.area_id}));
}
function minuteTick(world,m,generated){
 const living=world.living,t=m%DAY,day=t<360;
 if(living.minute!==m)throw Error('World clock drift during catch-up');
 regenerate(world,m,generated);
 MAGIC.tick(world,m);
 socialTick(world,m,generated);
 craftTick(world,m,generated);
 NPCHARVEST.plan(world,m,generated);
 CARAVAN.plan(world,m,generated);
 REFUGEES.plan(world,m,generated);
 for(const n of Object.values(living.npcs)){
  if(!n.alive)continue;
  if(npcSenseDue(world,n,m))NPCAI.sense(world,n,m,generated);
  const state=world.living.npc_ai?.brains[n.id]?.mode||'work';
  const desired=REFUGEES.destination(world,n)||REBUILD.destination(world,n)||
    GARRISON.destination(world,n)||
    NPCAI.destination(world,n)||
    npcDestination(n,m,world);
  const status=state==='flee'?'fleeing':state==='defend'?'defending':
   state==='recover'?'recovering':n.area_id!==desired.area_id?'traveling':
   n.x===desired.x&&n.y===desired.y?(day?'working':'resting'):'walking';
  if(m%5===0){
   const moved=npcStep(n,world,desired);
   if(moved)
    generated.push(event(living,m,'npc.move',
      n.name+' moved in '+n.area_id+'.',
      {npc_id:n.id,area_id:n.area_id,x:n.x,y:n.y}));
   TRAFFIC.observe(world,n,desired,m,moved,generated);
   changeStatus(n,status,m,living,generated);
  }
  if(m%30===0){
   n.hunger=Math.min(100,n.hunger+1);
   n.energy=Math.max(0,Math.min(100,n.energy+(day?-1:3)));
   NPCCOMMERCE.consume(world,n,m,generated);
   if(n.hunger===100)n.health=Math.max(0,n.health-1);
   generated.push(event(living,m,'npc.needs',
      n.name+' needs were updated.',{npc_id:n.id,health:n.health,
      hunger:n.hunger,energy:n.energy,area_id:n.area_id}));
   if(n.health===0){
    n.alive=false;generated.push(event(living,m,'npc.death',n.name+' died.',
      {npc_id:n.id,area_id:n.area_id}));
    recordMobileDeath(world,n,m,generated);
   }
  }
 }
 NPCHARVEST.process(world,m,generated);
 MILLING.run(world,m,generated);
 CARAVAN.process(world,m,generated);
 if(m%15===0){
  for(const shop of Object.values(living.businesses)){
   const occupied=living.territories[shop.area_id]?.control!=='settlers';
   const employee=living.npcs[shop.owner_id],at=shopLocation(world,shop);
   const owned=BUSINESS.owned(world,shop);
   const staffed=owned?Boolean(BUSINESS.presence(world,shop)):
    employee?.alive&&employee.area_id===shop.area_id&&
     Math.abs(employee.x-at.x)+Math.abs(employee.y-at.y)<=6;
   const open=day&&!occupied&&staffed&&REBUILD.operational(world,shop)&&
     (owned||living.npc_ai?.brains[shop.owner_id]?.mode!=='flee');
   if(shop.open!==open){
    shop.open=!!open;
    generated.push(event(living,m,'business.hours',
     shop.name+(open?' opened.':' closed.'),{business_id:shop.id,area_id:shop.area_id}));
   }

  }
 }
 NPCCOMMERCE.plan(world,m,generated);
 NPCCOMMERCE.purchase(world,m,generated);
 GARRISON.tick(world,m,generated);
 if(m%60===0){
  for(const terr of Object.values(living.territories)){
   const roll=rng(living);
   terr.threat=Math.max(0,Math.min(20,terr.threat+(roll<.62?1:-1)));
   if(terr.control==='settlers'&&terr.threat>=10){
    terr.control='monsters';terr.last_raid=m;
    MAINTENANCE.damageArea(world,terr.id,m,generated);
    generated.push(event(living,m,'territory.fallen',
      terr.id+' has been overrun by monsters.',
      {area_id:terr.id,control:'monsters'}));
   }else if(terr.control==='monsters'&&m-terr.last_raid>240&&roll>.85){
    // Settlers can counterattack without the player, though slowly.
    terr.control='settlers';terr.threat=4;terr.last_raid=m;
    generated.push(event(living,m,'territory.liberated',
      'Settlers drove monsters from '+terr.id+'.',
      {area_id:terr.id,control:'settlers'}));
   }
  }
 }
 combatTick(world,m,generated);
 MAINTENANCE.tick(world,m,generated);
 if(m%REBUILD.INTERVAL===0)REBUILD.tick(world,m,generated);
 ARMORER.tick(world,m,generated);
 COMPANIONS.tick(world,m,generated,monsterDeath);
 lawTick(world,m,generated);
 storageTick(world,m,generated);
 runScheduled(world,m,generated);
 syncNpcTransitions(world,m,generated);
 if(m%CAMPAIGNS.INTERVAL===0)CAMPAIGNS.tick(world,m,generated);
}
function validateLiving(l){
 if(!l||l.schema!==1||!Number.isSafeInteger(l.minute)||l.minute<0||
   !Number.isSafeInteger(l.event_sequence)||!Number.isInteger(l.seed)||
   !Array.isArray(l.events)||l.events.length>MAX_EVENTS||
   !l.npcs||!l.businesses||!l.territories||!l.mail||!l.traveling_camps)
   throw Error('Invalid living world save');
 for(const n of Object.values(l.npcs)){
  if(!n||typeof n.id!=='string'||!Number.isInteger(n.x)||!Number.isInteger(n.y)||
     ![COURT,VILLAGE].includes(n.area_id)||typeof n.alive!=='boolean')
    throw Error('Invalid NPC state');
 }
 return l;
}
function advance(world,now=Date.now(),limit=180){
 if(!world.runtime?.running||!world.living)return {world,events:[],minutes:0};
 const elapsed=world.runtime.elapsed_ms+
  Math.max(0,now-Date.parse(world.runtime.resumed_at_utc));
 const target=Math.floor(elapsed/MINUTE);
 const count=Math.max(0,Math.min(limit,target-world.living.minute));
 if(!count)return {world,events:[],minutes:0};
 const next=structuredClone(world),events=[];
 ensureScheduler(next);
 SPAWNERS.ensure(next);
 GUARDS.ensure(next);
 GARRISON.ensure(next);
 REFUGEES.ensure(next);
 TRAFFIC.ensure(next);
 CAMPAIGNS.ensure(next);
 REBUILD.ensure(next);
 ensureMobileAssets(next);
 ensureLaw(next);
 ensureDistricts(next);
 NPCCOMMERCE.ensure(next);
 NPCAI.ensure(next);
 NPCHARVEST.ensure(next);
 // Every system sees the same authoritative minute, including during
 // catch-up batches. Freeze the endpoint before updating living.minute.
 const endMinute=next.living.minute+count;
 for(let m=next.living.minute+1;m<=endMinute;m++){
  next.living.minute=m;
  minuteTick(next,m,events);
 }
 reconcileEntities(next);
 next.revision++;
 validateLiving(next.living);
 return {world:next,events,minutes:count};
}
function recordPlayer(world,command,character,minute){
 if(!world.living)return null;
 const action=typeof command==='string'?command:command.action;
 const x=character.x,y=character.y,area_id=character.area_id;
 return event(world.living,minute,'player.'+action,
  'The character performed '+action+'.',{slot:1,area_id,x,y,
  form:character.form,direction:command.direction||null});
}
function recordWorld(world,type,minute){
 if(!world.living)return null;
 return event(world.living,minute,'server.'+type,
  'World '+type+'.',{running:world.runtime?.running});
}
function collectLetter(world,id){
 const character=world.characters['1'];
 if(character&&character.form!=='living')
   throw Error('Ghosts cannot collect physical correspondence');
 if(!character||character.area_id!==VILLAGE||
    Math.abs(character.x-54)+Math.abs(character.y-103)>3)
   throw Error('Visit the Village Bank to collect your correspondence');
 const next=structuredClone(world),box=next.living.mail.boxes['1'];
 const index=box.findIndex(l=>l.id===id);
 if(index<0)throw Error('Letter is not in your bank box');
 const letter=box.splice(index,1)[0];
 next.living.mail.collected.push({...letter,collected_minute:next.living.minute});
 next.revision++;
 const e=event(next.living,next.living.minute,'mail.collected',
   'The character collected correspondence at the bank.',
   {letter_id:id,area_id:VILLAGE});
 return {world:next,letter,event:e};
}
module.exports={MINUTE,DAY,seed,ensureLivingWorld,validateLiving,advance,collectLetter,recordPlayer,recordWorld};
