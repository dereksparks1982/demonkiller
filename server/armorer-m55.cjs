'use strict';
// M55: physical player repairs, salvage and NPC smith repair contracts.
// Original DK Softworks implementation, no copied RunUO code.
const E=require('./entity-registry-m10.cjs'),A=require('./armory-m54.cjs');
const S=require('./skills-m14.cjs'),V=require('./vendors-m18.cjs');
const {VILLAGE}=require('./regions.cjs');
const FEE=12,WAGE=3,DURATION=60,LIMIT=16;
const WORK='armorer_work_1',PICKUP='armorer_pickup_1',SHOP='village_smithy';
const MATERIAL=Object.freeze({short_sword:'ore',mace:'ore',spear:'ore',
 bow:'wood',buckler:'ore',iron_armor:'ore'});
function ensure(world){
 if(!world.living||!world.entity_registry)throw Error('Armorer requires world and physical goods');
 let changed=false;
 const shop=world.living.businesses[SHOP],point=shop&&V.location(world,shop);
 if(!shop||!point)throw Error('The village smithy does not exist');
 for(const [id,role]of [[WORK,'work'],[PICKUP,'pickup']])
  if(!world.entity_registry.containers[id]){
   world.entity_registry.containers[id]={id,kind:'work_order',owner:SHOP,
    role,area_id:VILLAGE,x:point.x,y:point.y,capacity:LIMIT};
   changed=true;
  }
 if(!world.living.armorer){
  world.living.armorer={schema:1,sequence:0,orders:{},
   completed:0,manual_repairs:0,salvages:0,last_manual_minute:-1};
  changed=true;
 }
 return changed;
}
function validate(world){
 const state=world.living?.armorer;if(!state)return true;
 if(state.schema!==1||!state.orders||Array.isArray(state.orders)||
  Object.keys(state.orders).length>LIMIT||
  !Number.isSafeInteger(state.sequence)||state.sequence<0||
  !Number.isSafeInteger(state.completed)||state.completed<0||
  !Number.isSafeInteger(state.manual_repairs)||state.manual_repairs<0||
  !Number.isSafeInteger(state.salvages)||state.salvages<0||
  !Number.isSafeInteger(state.last_manual_minute)||state.last_manual_minute<-1)
  throw Error('Invalid persistent smith repair ledger');
 for(const id of [WORK,PICKUP]){
  const c=world.entity_registry?.containers?.[id];
  if(!c||c.kind!=='work_order'||c.owner!==SHOP||c.area_id!==VILLAGE||
   c.capacity!==LIMIT)throw Error('Invalid smith repair item custody');
 }
 for(const [id,o]of Object.entries(state.orders)){
  const item=world.entity_registry.items[o?.serial];
  if(!/^repair_[1-9][0-9]*$/.test(id)||o?.id!==id||
   !Object.hasOwn(MATERIAL,o.type)||!item||item.type!==o.type||
   !['working','ready'].includes(o.status)||
   !Number.isSafeInteger(o.accepted_minute)||o.accepted_minute<0||
   o.due_minute!==o.accepted_minute+DURATION||
   !Number.isSafeInteger(o.finished_minute)||o.finished_minute<-1||
   o.fee!==FEE||o.material!==MATERIAL[o.type]||
   item.parent!==(o.status==='working'?WORK:PICKUP)||
   (o.status==='ready'&&item.durability!==100)||
   (o.status==='working'&&(!Number.isSafeInteger(item.durability)||
     item.durability<1||item.durability>=100)))
   throw Error('Invalid physical smith repair order');
 }
 return true;
}
function log(world,type,shop,details={},events=null){
 const l=world.living,e={id:'event_'+(++l.event_sequence),
  minute:l.minute,type,text:shop.name+': '+type.split('.').at(-1).replaceAll('_',' ')+'.',
  business_id:shop.id,area_id:shop.area_id,...details};
 l.events.push(e);if(l.events.length>512)l.events.shift();
 if(events)events.push(e);
 return e;
}
function atSmith(world,c){
 if(c.area_id!==VILLAGE)return false;
 const p=V.location(world,world.living.businesses[SHOP]);
 return Math.abs(c.x-p.x)+Math.abs(c.y-p.y)<=3;
}
function physicalItem(world,serial){
 if(typeof serial!=='string'||!/^ent_[1-9][0-9]*$/.test(serial))
  throw Error('Invalid repair item serial');
 const item=world.entity_registry?.items?.[serial];
 if(!item||!Object.hasOwn(MATERIAL,item.type))
  throw Error('Only physical weapons, shields and armor can be repaired or salvaged');
 if(item.parent!==E.PACK||item.amount!==1)
  throw Error('Place the individual unequipped item in your backpack first');
 return item;
}
function apply(world,command){
 const keys={repair_by_hand:'action,serial',salvage_gear:'action,serial',
  submit_repair:'action,serial',collect_repair:'action,order_id'};
 if(!command||typeof command!=='object'||Array.isArray(command)||
  !Object.hasOwn(keys,command.action)||
  Object.keys(command).sort().join(',')!==keys[command.action])
  throw Error('Invalid smith repair command');
 if(!world.runtime?.running)throw Error('World is paused');
 const original=world.characters?.['1'];
 if(!original||original.form!=='living'||original.crafting?.incapacitated||
  !atSmith(world,original))
  throw Error('Visit the village smithy as a conscious living character');
 const next=structuredClone(world),c=next.characters['1'];
 ensure(next);S.ensure(c);
 const l=next.living,s=l.armorer,shop=l.businesses[SHOP],minute=l.minute;
 const action=command.action;
 let evt;
 if(action==='collect_repair'){
  const order=s.orders[command.order_id];
  if(!order||order.status!=='ready')throw Error('Repair order is not ready for pickup');
  const item=next.entity_registry.items[order.serial];
  if(!item||item.parent!==PICKUP)throw Error('The repaired item is missing');
  if(Object.values(c.inventory).reduce((a,b)=>a+b,0)>=200||
   (c.inventory[item.type]||0)>=200)throw Error('Your backpack is full');
  item.parent=E.PACK;c.inventory[item.type]++;
  delete s.orders[order.id];s.completed++;
  E.reconcile(next);E.counts(next);
  evt=log(next,'smith.repair.collected',shop,{serial:item.serial,order_id:order.id});
 }else{
  const item=physicalItem(next,command.serial),material=MATERIAL[item.type];
  if(action==='submit_repair'){
   if(!Number.isSafeInteger(item.durability)||item.durability>=100)
    throw Error('Only a worn item needs smith repairs');
   if(Object.keys(s.orders).length>=LIMIT)throw Error('The smith has no repair capacity');
   if(!shop.open||!l.npcs[shop.owner_id]?.alive)
    throw Error('The village smith is unavailable to accept repairs');
   if(c.gold<FEE)throw Error('You cannot afford the smith repair fee');
   if(shop.coins+FEE>1e9)throw Error('Smithy treasury cannot hold the payment');
   c.gold-=FEE;shop.coins+=FEE;
   c.inventory[item.type]--;item.parent=WORK;
   const id='repair_'+(++s.sequence);
   s.orders[id]={id,serial:item.serial,type:item.type,material,
    accepted_minute:minute,due_minute:minute+DURATION,
    finished_minute:-1,status:'working',fee:FEE};
   E.reconcile(next);E.counts(next);
   evt=log(next,'smith.repair.accepted',shop,
    {serial:item.serial,order_id:id,fee:FEE,due_minute:minute+DURATION});
  }else{
   if(s.last_manual_minute>=minute)throw Error('Wait another world minute to work the smithy');
   if(c.crafting?.hand!=='tools')throw Error('Equip hand tools before manual smith work');
   if(action==='repair_by_hand'){
    if((c.inventory[material]||0)<1)
     throw Error('You need one physical '+material+' to repair this gear');
    if(!Number.isSafeInteger(item.durability)||item.durability>=100)
     throw Error('Only damaged equipment needs a repair');
    c.inventory[material]--;
    item.durability=100;s.manual_repairs++;
    S.practice(c,material==='ore'?'blacksmithing':'carpentry',minute,
     'repair:'+item.type);
    evt=log(next,'smith.repair.manual',shop,{serial:item.serial,item_type:item.type,
     material_spent:material});
   }else{
    // Salvage returns one material from a real destroyed piece of equipment.
    // Net yields stay lower than the original input materials.
    delete next.entity_registry.items[item.serial];
    c.inventory[item.type]--;
    c.inventory[material]++;
    s.salvages++;
    S.practice(c,'tinkering',minute,'salvage:'+item.type);
    evt=log(next,'smith.gear.salvaged',shop,
     {serial:item.serial,item_type:item.type,material_recovered:material});
   }
   s.last_manual_minute=minute;
   E.reconcile(next);E.counts(next);
  }
 }
 c.revision++;next.revision++;
 validate(next);
 return {world:next,character:c,event:evt};
}
function consumeShopMaterial(world,shop,type){
 const bag='vendor_stock_'+shop.id,registry=world.entity_registry;
 const item=Object.values(registry.items).find(i=>
  i.parent===bag&&i.type===type&&i.amount>=1);
 if(!item)throw Error('Smith repair inventory lacks physical raw material');
 item.amount--;if(!item.amount)delete registry.items[item.serial];
 shop.other_stock[type]--;
}
function tick(world,minute,events){
 if(minute%5!==0||!world.living?.armorer)return;
 const l=world.living,shop=l.businesses[SHOP],state=l.armorer;
 if(!shop?.open||l.territories[VILLAGE]?.control!=='settlers')return;
 const worker=l.npcs[shop.owner_id],at=V.location(world,shop);
 if(!worker?.alive||worker.area_id!==VILLAGE||
  Math.abs(worker.x-at.x)+Math.abs(worker.y-at.y)>4||
  ['flee','defend'].includes(l.npc_ai?.brains[worker.id]?.mode))
  return;
 const MAINTENANCE=require('./business-maintenance-m50.cjs');
 const BUSINESS=require('./player-business-m48.cjs');
 const owner=BUSINESS.owned(world,shop);
 if(!MAINTENANCE.operational(world,shop)||(owner&&!owner.assistant_enabled))return;
 for(const o of Object.values(state.orders)){
  if(o.status!=='working'||minute<o.due_minute)continue;
  if((shop.other_stock?.[o.material]||0)<1||shop.coins<WAGE||worker.coins+WAGE>1e9)
   continue;
  E.reconcile(world);
  consumeShopMaterial(world,shop,o.material);
  const item=world.entity_registry.items[o.serial];
  if(!item||item.parent!==WORK)throw Error('Smith lost a serialized repair item');
  item.parent=PICKUP;item.durability=100;
  shop.coins-=WAGE;shop.expenses+=WAGE;worker.coins+=WAGE;
  o.status='ready';o.finished_minute=minute;
  log(world,'smith.repair.ready',shop,
   {order_id:o.id,serial:o.serial,npc_id:worker.id,
    material_used:o.material,wage:WAGE},events);
 }
 E.counts(world);
}
function listing(world){
 const shop=world.living?.businesses?.[SHOP],c=world.characters?.['1'];
 const s=world.living?.armorer,worker=shop&&world.living.npcs[shop.owner_id];
 const at=shop&&V.location(world,shop);
 const BUSINESS=require('./player-business-m48.cjs'),
  MAINTENANCE=require('./business-maintenance-m50.cjs');
 const owner=shop&&BUSINESS.owned(world,shop);
 const available=!!(shop?.open&&worker?.alive&&at&&
  worker.area_id===VILLAGE&&Math.abs(worker.x-at.x)+Math.abs(worker.y-at.y)<=4&&
  world.living.territories[VILLAGE]?.control==='settlers'&&
  MAINTENANCE.operational(world,shop)&&(!owner||owner.assistant_enabled));
 return {world_minute:world.living?.minute||0,shop_id:SHOP,
  near_smith:!!(c&&atSmith(world,c)),fee:FEE,duration:DURATION,
  smith_available:available,
  materials:shop?.other_stock||{},orders:Object.values(s?.orders||{}),
  pack_gear:Object.values(world.entity_registry?.items||{})
   .filter(item=>item.parent===E.PACK&&Object.hasOwn(MATERIAL,item.type))
   .map(item=>({serial:item.serial,type:item.type,durability:item.durability??100})),
  completed:s?.completed||0,manual_repairs:s?.manual_repairs||0,
  salvages:s?.salvages||0};
}
module.exports={FEE,WAGE,DURATION,LIMIT,WORK,PICKUP,SHOP,MATERIAL,
 ensure,validate,atSmith,apply,tick,listing};
