'use strict';
// DK Server M9: physical bank-item storage and persistent dropped goods.
// Item counts, bank access, pickup distance and decay belong to the server.
const {COURT,VILLAGE,traversable}=require('./regions.cjs');
const ITEMS=Object.freeze(['herbs','wood','ore','bread','tools','produce','meals',
 'torches','rations','bandages']);
const ACCEPTED=new Set(ITEMS),VAULT_CAP=500,PACK_CAP=200;
const GROUND_CAP=1024,DECAY_MINUTES=360;
const emptyVault=()=>Object.fromEntries(ITEMS.map(item=>[item,0]));
function ensure(world){
 if(!world.living.storage){
  world.living.storage={schema:1,sequence:0,vaults:{'1':emptyVault()},ground:{}};
  return true;
 }
 let updated=false;
 const s=world.living.storage;
 if(!s.vaults){s.vaults={'1':emptyVault()};updated=true;}
 if(!s.vaults['1']){s.vaults['1']=emptyVault();updated=true;}
 for(const item of ITEMS)if(s.vaults['1'][item]===undefined){
  s.vaults['1'][item]=0;updated=true;
 }
 if(!s.ground){s.ground={};updated=true;}
 if(!Number.isSafeInteger(s.sequence)){s.sequence=0;updated=true;}
 return updated;
}
function validate(world){
 const s=world.living?.storage;if(!s)return true;
 if(s.schema!==1||!Number.isSafeInteger(s.sequence)||s.sequence<0||
  !s.vaults||!s.vaults['1']||!s.ground||
  Object.keys(s.ground).length>GROUND_CAP)
  throw Error('Invalid persistent storage');
 let total=0;
 for(const [key,count] of Object.entries(s.vaults['1'])){
  if(!ACCEPTED.has(key)||!Number.isSafeInteger(count)||count<0||count>VAULT_CAP)
   throw Error('Invalid bank item count');
  total+=count;
 }
 if(total>VAULT_CAP)throw Error('Bank vault exceeds capacity');
 for(const [id,drop] of Object.entries(s.ground)){
  const area=world.areas[drop?.area_id];
  if(!/^ground_[0-9]+$/.test(id)||drop.id!==id||!area||
   ![COURT,VILLAGE].includes(drop.area_id)||
   !Number.isInteger(drop.x)||!Number.isInteger(drop.y)||
   drop.x<0||drop.y<0||drop.x>=area.width||drop.y>=area.height||
   !ACCEPTED.has(drop.item)||!Number.isSafeInteger(drop.quantity)||
   drop.quantity<1||drop.quantity>20||
   !Number.isSafeInteger(drop.dropped_minute)||drop.dropped_minute<0||
   !Number.isSafeInteger(drop.expires_minute)||
   drop.expires_minute!==drop.dropped_minute+DECAY_MINUTES)
   throw Error('Invalid ground item record');
 }
 return true;
}
function distance(a,x,y){return Math.abs(a.x-x)+Math.abs(a.y-y);}
function bankAccessible(world,c){
 if(c.area_id!==VILLAGE||distance(c,54,103)>3)
  throw Error('Visit the Village Bank to access stored items');
 if(!world.living.businesses.village_bank?.open)
  throw Error('The bank is closed');
}
function packCount(player){return Object.values(player.inventory).reduce((sum,n)=>sum+n,0);}
function vaultCount(vault){return Object.values(vault).reduce((sum,n)=>sum+n,0);}
function event(world,type,text,details={}){
 const l=world.living,e={id:'event_'+(++l.event_sequence),minute:l.minute,
  type,text,area_id:world.characters['1'].area_id,...details};
 l.events.push(e);if(l.events.length>512)l.events.shift();
 return e;
}
function apply(world,command){
 const allowed={
  bank_store:'action,item_type,quantity',
  bank_take:'action,item_type,quantity',
  drop_item:'action,item_type,quantity',
  pick_up:'action,drop_id'
 };
 if(!command||typeof command!=='object'||Array.isArray(command)||
  !Object.hasOwn(allowed,command.action)||
  Object.keys(command).sort().join(',')!==allowed[command.action])
  throw Error('Invalid storage action');
 if(!world.runtime?.running)throw Error('World is paused');
 const original=world.characters['1'];
 if(!original)throw Error('No character exists');
 if(original.form!=='living')throw Error('Ghosts cannot handle physical storage');
 if(original.crafting?.incapacitated)throw Error('You are unconscious');
 const next=structuredClone(world),c=next.characters['1'];
 ensure(next);
 const s=next.living.storage,minute=next.living.minute;
 let item,qty,drop;
 if(command.action==='pick_up'){
  if(typeof command.drop_id!=='string'||!/^ground_[0-9]+$/.test(command.drop_id))
   throw Error('Invalid ground item ID');
  drop=s.ground[command.drop_id];
  if(!drop||drop.area_id!==c.area_id||distance(c,drop.x,drop.y)>1)
   throw Error('Move beside the dropped item');
  if(minute>=drop.expires_minute)throw Error('The dropped item has decayed');
  item=drop.item;qty=drop.quantity;
  if(packCount(c)+qty>PACK_CAP||(c.inventory[item]||0)+qty>PACK_CAP)
   throw Error('Your pack is full');
  c.inventory[item]+=qty;
  delete s.ground[drop.id];
 }else{
  item=command.item_type;qty=command.quantity;
  if(!ACCEPTED.has(item)||!Number.isSafeInteger(qty)||qty<1||qty>20)
   throw Error('Invalid item or quantity');
  if(command.action==='bank_store'){
   bankAccessible(next,c);
   const vault=s.vaults['1'];
   if((c.inventory[item]||0)<qty)throw Error('You do not own those items');
   if(vaultCount(vault)+qty>VAULT_CAP||vault[item]+qty>VAULT_CAP)
    throw Error('Your bank vault is full');
   c.inventory[item]-=qty;vault[item]+=qty;
  }else if(command.action==='bank_take'){
   bankAccessible(next,c);
   const vault=s.vaults['1'];
   if(vault[item]<qty)throw Error('Your bank does not hold enough items');
   if(packCount(c)+qty>PACK_CAP||(c.inventory[item]||0)+qty>PACK_CAP)
    throw Error('Your pack is full');
   vault[item]-=qty;c.inventory[item]+=qty;
  }else{
   if(![COURT,VILLAGE].includes(c.area_id)||
      !traversable(next.areas[c.area_id],c.x,c.y,'living'))
    throw Error('Find a safe outdoor tile to drop items');
   if((c.inventory[item]||0)<qty)throw Error('You do not own those items');
   if(Object.keys(s.ground).length>=GROUND_CAP)
    throw Error('The ground is full of items');
   const id='ground_'+(++s.sequence);
   drop={id,area_id:c.area_id,x:c.x,y:c.y,item,quantity:qty,
    dropped_minute:minute,expires_minute:minute+DECAY_MINUTES};
   s.ground[id]=drop;c.inventory[item]-=qty;
  }
 }
 c.revision++;next.revision++;
 const e=event(next,'storage.'+command.action,
  command.action==='bank_store'?'Goods stored in a bank vault.':
  command.action==='bank_take'?'Goods withdrawn from the bank vault.':
  command.action==='drop_item'?'The player left goods on the ground.':
  'The player recovered goods from the ground.',
  {item,quantity:qty,drop_id:drop?.id||null,slot:1});
 validate(next);
 return {world:next,character:c,event:e};
}
function tick(world,minute,events){
 const s=world.living?.storage;if(!s)return;
 for(const drop of Object.values(s.ground)){
  if(minute<drop.expires_minute)continue;
  delete s.ground[drop.id];
  const l=world.living,e={id:'event_'+(++l.event_sequence),minute,
   type:'storage.decayed',text:'A dropped item decayed in the world.',
   area_id:drop.area_id,drop_id:drop.id,item:drop.item,quantity:drop.quantity};
  l.events.push(e);if(l.events.length>512)l.events.shift();events.push(e);
 }
}
module.exports={ITEMS,VAULT_CAP,PACK_CAP,GROUND_CAP,DECAY_MINUTES,
 emptyVault,ensure,validate,apply,tick};
