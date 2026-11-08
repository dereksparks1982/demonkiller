'use strict';
// DK Server M17: stable house deeds, ownership and storage on existing exteriors.
// Independent RunUO-inspired housing design, no engine or GPL source.
const {COURT,VILLAGE}=require('./regions.cjs');
const {regionAt}=require('./region-policies-m16.cjs');
const OWNER_BY_HOUSE=Object.freeze({
  courtyard_house_nw:'herbalist',
  courtyard_house_ne:'courtyard_keeper',
  village_house_1:'guard_north',
  village_house_2:'bank_clerk',
  village_house_3:'baker',
  village_house_4:'tavern_keeper',
  village_house_5:'blacksmith',
  village_house_6:'market_vendor'
});
const MAX_HOUSES=64,HOME_CAPACITY=64;
function storageId(id){return 'home_storage_'+id;}
function houseObjects(world){
 const houses=[];
 for(const [area_id,area] of Object.entries(world.areas||{}))
  for(const obj of area.objects||[]){
   if(obj.type!=='house')continue;
   const door=obj.door;
   if(door&&(!Number.isInteger(door.x)||!Number.isInteger(door.y)))
    throw Error('House exterior has invalid doorway coordinates');
   // The deed and goods survive when Architect erases a doorway.
   houses.push({id:obj.id,area_id,x:obj.x,y:obj.y,w:obj.w,h:obj.h,
     door_x:door?.x??null,door_y:door?.y??null});
  }
 return houses.sort((a,b)=>a.id.localeCompare(b.id));
}
function ensure(world){
 if(!world.living||!world.entity_registry)throw Error('Housing requires a living world');
 let changed=false;
 if(!world.living.housing){
  world.living.housing={schema:1,records:{},transfers:0};changed=true;
 }
 const housing=world.living.housing;
 for(const house of houseObjects(world)){
  const seller=OWNER_BY_HOUSE[house.id];
  if(!housing.records[house.id]){
   const npc=seller?world.living.npcs[seller]:null;
   const owner=npc?.alive?{kind:'npc',id:seller}:
     npc?{kind:'estate',id:seller}:null;
   const price=Math.max(120,Math.ceil(house.w*house.h*3/2));
   housing.records[house.id]={...house,price,owner,locked:!!owner,
     public:!owner,storage_id:storageId(house.id),last_transfer_minute:null};
   changed=true;
  }
  const record=housing.records[house.id];
  if(!world.entity_registry.containers[record.storage_id]){
   world.entity_registry.containers[record.storage_id]={
    id:record.storage_id,kind:'house_store',house_id:house.id,
    area_id:house.area_id,x:house.door_x,y:house.door_y,
    owner:'property:'+house.id,capacity:HOME_CAPACITY};
   changed=true;
  }
  if(seller&&world.living.npcs[seller]&&!world.living.npcs[seller].home_id){
   world.living.npcs[seller].home_id=house.id;changed=true;
  }
 }
 return changed;
}
function event(world,minute,type,text,details={}){
 const l=world.living,e={id:'event_'+(++l.event_sequence),minute,type,text,...details};
 l.events.push(e);if(l.events.length>512)l.events.shift();
 return e;
}
function beside(player,house,range=2){
 return Number.isInteger(house.door_x)&&Number.isInteger(house.door_y)&&
  player.area_id===house.area_id&&
  Math.abs(player.x-house.door_x)+Math.abs(player.y-house.door_y)<=range;
}
function isOwner(house){
 return house.owner?.kind==='player'&&house.owner.slot===1;
}
function checkOwnership(world,player,house){
 if(!house||!isOwner(house))throw Error('This house does not belong to you');
 if(!beside(player,house))throw Error('Move beside your house doorway');
}
function canStore(world,player,container_id){
 const house=Object.values(world.living.housing?.records||{})
  .find(h=>h.storage_id===container_id);
 if(!house)return false;
 return isOwner(house)&&beside(player,house);
}
function apply(world,command){
 if(!command||typeof command!=='object'||Array.isArray(command)||
  !['buy_house','sell_house','set_house_public'].includes(command.action)||
  Object.keys(command).sort().join(',')!=='action,house_id'&&
   Object.keys(command).sort().join(',')!=='action,house_id,public')
  throw Error('Invalid house deed action');
 const expected=command.action==='set_house_public'?'action,house_id,public':
  'action,house_id';
 if(Object.keys(command).sort().join(',')!==expected||
  typeof command.house_id!=='string')
  throw Error('Invalid house deed parameters');
 if(command.action==='set_house_public'&&typeof command.public!=='boolean')
  throw Error('House visibility must be a boolean');
 if(!world.runtime?.running)throw Error('World is paused');
 const next=structuredClone(world);ensure(next);
 const player=next.characters?.['1'];if(!player)throw Error('No character exists');
 if(player.form!=='living')throw Error('Ghosts cannot sign house deeds');
 if(player.crafting?.incapacitated)throw Error('You are unconscious');
 const house=next.living.housing.records[command.house_id];
 if(!house)throw Error('Unknown house deed');
 const bank=next.living.businesses.village_bank;
 let eventType,text,amount=0;
 if(command.action==='buy_house'){
  if(house.owner)throw Error('This house already has a lawful owner or estate');
  if(!beside(player,house))throw Error('Visit the house doorway to buy its deed');
  if(!regionAt(next,house.area_id,house.door_x,house.door_y).housing)
   throw Error('Housing is forbidden in this district');
  if(next.living.territories[house.area_id]?.control==='monsters')
   throw Error('The occupied settlement cannot register new deeds');
  if(Object.values(next.living.housing.records).some(isOwner))
   throw Error('A character may own only one house');
  if(player.gold<house.price)throw Error('Insufficient gold for the house deed');
  if(!bank||bank.coins+house.price>1e9)throw Error('The settlement bank cannot accept payment');
  player.gold-=house.price;bank.coins+=house.price;
  house.owner={kind:'player',slot:1};
  house.public=false;house.locked=true;
  eventType='housing.purchased';text='The character bought the deed to '+house.id+'.';
  amount=house.price;
 }else if(command.action==='sell_house'){
  checkOwnership(next,player,house);
  const belongings=Object.values(next.entity_registry.items)
    .filter(i=>i.parent===house.storage_id);
  if(belongings.length)throw Error('Empty your secure house storage before selling');
  amount=Math.floor(house.price/2);
  if(!bank||bank.coins<amount)throw Error('The settlement cannot afford to buy back the house');
  if(player.gold+amount>1e9)throw Error('The character cannot carry the sale proceeds');
  bank.coins-=amount;player.gold+=amount;
  house.owner=null;house.public=true;house.locked=false;
  eventType='housing.sold';text='The character sold the deed to '+house.id+'.';
 }else{
  checkOwnership(next,player,house);
  if(house.public===command.public)throw Error('The house already has that public status');
  house.public=command.public;house.locked=!command.public;
  eventType='housing.access';text='The house public-entry policy was updated.';
 }
 const l=next.living;house.last_transfer_minute=l.minute;
 l.housing.transfers++;player.revision++;next.revision++;
 const e=event(next,l.minute,eventType,text,{
  house_id:house.id,area_id:house.area_id,amount,
  owner:house.owner?.kind||'vacant',public:house.public
 });
 validate(next);
 return {world:next,character:player,event:e};
}
function onNpcDeath(world,npc,minute,out=[]){
 const housing=world.living?.housing;
 if(!housing)return null;
 const house=Object.values(housing.records)
  .find(h=>h.owner?.kind==='npc'&&h.owner.id===npc.id);
 if(!house)return null;
 house.owner={kind:'estate',id:npc.id};
 house.public=false;house.locked=true;
 house.last_transfer_minute=minute;
 housing.transfers++;
 out.push(event(world,minute,'housing.estate',
  'The property belonging to '+npc.name+' entered an unsettled estate.',
  {npc_id:npc.id,house_id:house.id,area_id:house.area_id}));
 return house;
}
function listing(world){
 const player=world.characters?.['1'],homes=Object.values(world.living?.housing?.records||{});
 const nearby=player?homes.filter(h=>beside(player,h,4)):[],owned=homes.filter(isOwner);
 return {revision:world.revision,world_minute:world.living?.minute||0,
  houses:[...new Map([...nearby,...owned].map(h=>[h.id,h])).values()]
   .map(h=>({id:h.id,area_id:h.area_id,door_x:h.door_x,door_y:h.door_y,
    width:h.w,height:h.h,price:h.price,owner:h.owner,
    public:h.public,locked:h.locked,storage_id:h.storage_id,
    accessible:!!player&&canStore(world,player,h.storage_id)})),
  total_houses:homes.length};
}
function validate(world){
 const state=world.living?.housing;
 if(!state)return true;
 if(state.schema!==1||!state.records||Array.isArray(state.records)||
  Object.keys(state.records).length>MAX_HOUSES||
  !Number.isSafeInteger(state.transfers)||state.transfers<0)
  throw Error('Invalid housing registry');
 const source=Object.fromEntries(houseObjects(world).map(h=>[h.id,h]));
 let playerOwned=0;
 for(const [id,h] of Object.entries(state.records)){
  const o=source[id],c=world.entity_registry?.containers[h?.storage_id];
  if(!o||!h||h.id!==id||h.area_id!==o.area_id||
   h.x!==o.x||h.y!==o.y||h.w!==o.w||h.h!==o.h||
   h.door_x!==o.door_x||h.door_y!==o.door_y||
   !Number.isSafeInteger(h.price)||h.price<1||h.price>1e7||
   typeof h.locked!=='boolean'||typeof h.public!=='boolean'||
   h.storage_id!==storageId(id)||
   (h.last_transfer_minute!==null&&
    (!Number.isSafeInteger(h.last_transfer_minute)||h.last_transfer_minute<0))||
   !c||c.kind!=='house_store'||c.house_id!==id)
   throw Error('Invalid house property or container');
  if(h.owner){
   if(!['npc','player','estate'].includes(h.owner.kind))throw Error('Invalid home owner');
   if(h.owner.kind==='player'){
    if(h.owner.slot!==1||!world.characters['1'])throw Error('Invalid player deed');
    playerOwned++;
   }else if(typeof h.owner.id!=='string'||!world.living.npcs[h.owner.id])
    throw Error('Unknown NPC or estate owner');
  }
 }
 if(playerOwned>1)throw Error('Only one player house may be owned');
 return true;
}
module.exports={HOME_CAPACITY,ensure,validate,apply,onNpcDeath,listing,canStore,houseObjects};
