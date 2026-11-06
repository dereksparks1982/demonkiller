'use strict';
// DK Server living world. The server advances NPCs even when no browser is open.
// All randomness uses a saved seed; no client timer or reload-triggered events.
const {COURT,VILLAGE,traversable,portal}=require('./regions.cjs');
const {regenerate}=require('./gameplay.cjs');
const {tick:socialTick}=require('./social-m6.cjs');
const {chooseStep}=require('./npc-navigation-m6.cjs');
const {tick:craftTick}=require('./crafting-m7.cjs');
const {tick:combatTick}=require('./combat-m8.cjs');
const {tick:storageTick}=require('./storage-m9.cjs');
const {reconcile:reconcileEntities}=require('./entity-registry-m10.cjs');
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
function npcDestination(n,minute){
 const t=minute%DAY,day=t<360;
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
 regenerate(world,m,generated);
 socialTick(world,m,generated);
 craftTick(world,m,generated);
 for(const n of Object.values(living.npcs)){
  if(!n.alive)continue;
  const desired=npcDestination(n,m);
  const status=n.area_id!==desired.area_id?'traveling':
   n.x===desired.x&&n.y===desired.y?(day?'working':'resting'):'walking';
  if(m%5===0){
   if(npcStep(n,world,desired))
    generated.push(event(living,m,'npc.move',
      n.name+' moved in '+n.area_id+'.',
      {npc_id:n.id,area_id:n.area_id,x:n.x,y:n.y}));
   changeStatus(n,status,m,living,generated);
  }
  if(m%30===0){
   n.hunger=Math.min(100,n.hunger+1);
   n.energy=Math.max(0,Math.min(100,n.energy+(day?-1:3)));
   if(n.hunger>=70&&n.coins>=1){n.hunger-=24;n.coins--; }
   if(n.hunger===100)n.health=Math.max(0,n.health-1);
   generated.push(event(living,m,'npc.needs',
      n.name+' needs were updated.',{npc_id:n.id,health:n.health,
      hunger:n.hunger,energy:n.energy,area_id:n.area_id}));
   if(n.health===0){
    n.alive=false;generated.push(event(living,m,'npc.death',n.name+' died.',
      {npc_id:n.id,area_id:n.area_id}));
   }
  }
 }
 if(m%15===0){
  for(const shop of Object.values(living.businesses)){
   const occupied=living.territories[shop.area_id]?.control!=='settlers';
   const open=day&&!occupied&&living.npcs[shop.owner_id]?.alive;
   if(shop.open!==open){
    shop.open=!!open;
    generated.push(event(living,m,'business.hours',
     shop.name+(open?' opened.':' closed.'),{business_id:shop.id,area_id:shop.area_id}));
   }
   if(!open||shop.stock<=0)continue;
   const sold=1+Math.floor(rng(living)*4),actual=Math.min(sold,shop.stock);
   shop.stock-=actual;shop.sales+=actual;
   const price=shop.product==='tools'?8:shop.product==='meals'?4:2;
   shop.coins+=actual*price;
   shop.expenses+=1;shop.coins-=1;
   generated.push(event(living,m,'business.trade',
    shop.name+' sold '+actual+' '+shop.product+'.',
    {business_id:shop.id,area_id:shop.area_id,units:actual,revenue:actual*price}));
  }
 }
 if(m%60===0){
  for(const terr of Object.values(living.territories)){
   const roll=rng(living);
   terr.threat=Math.max(0,Math.min(20,terr.threat+(roll<.62?1:-1)));
   if(terr.control==='settlers'&&terr.threat>=10){
    terr.control='monsters';terr.last_raid=m;
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
 storageTick(world,m,generated);
 if(m%90===0){
  const camp=living.traveling_camps.camp_1;
  if(camp.present&&m>=camp.leaves_at){
   camp.present=false;
   generated.push(event(living,m,'camp.departed','The traveling camp has departed.',
     {area_id:camp.area_id}));
  }else if(!camp.present&&m-camp.leaves_at>=180){
   camp.present=true;camp.area_id=camp.area_id===COURT?VILLAGE:COURT;
   camp.x=camp.area_id===COURT?52:80;camp.y=camp.area_id===COURT?27:68;
   camp.arrived_at=m;camp.leaves_at=m+240;
   generated.push(event(living,m,'camp.arrived','A traveling camp has arrived.',
     {area_id:camp.area_id}));
  }
 }
 if(m%120===0){
  for(const shop of Object.values(living.businesses)){
   if(shop.stock<12&&shop.coins>=30){
    shop.stock+=25;shop.coins-=30;shop.expenses+=30;
    generated.push(event(living,m,'business.delivery',
      'A supplier replenished '+shop.name+'.',
      {business_id:shop.id,area_id:shop.area_id,units:25}));
   }
  }
 }
 for(let i=living.mail.outbound.length-1;i>=0;i--){
  const item=living.mail.outbound[i];
  if(item.eta_minute>m)continue;
  // Postal delivery is an in-world timed event, not a courier teleporting
  // to the player's current location.
  const courier=living.npcs.courier;
  if(!courier.alive||courier.area_id!==VILLAGE||
      Math.abs(courier.x-54)+Math.abs(courier.y-103)>3)continue;
  living.mail.outbound.splice(i,1);
  (living.mail.boxes[String(item.to_slot)]??=[]).push({...item,delivered_minute:m});
  generated.push(event(living,m,'mail.delivered',
    'A letter was delivered to a bank box.',{letter_id:item.id,area_id:VILLAGE}));
 }
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
 for(let m=next.living.minute+1;m<=next.living.minute+count;m++)
  minuteTick(next,m,events);
 next.living.minute+=count;
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
