'use strict';
// M27: serial-addressed backpack operations built on the existing M10 registry.
// Items remain in the authoritative world save. No parallel inventory database.
const CRAFT=require('./crafting-m7.cjs');
const R=require('./entity-registry-m10.cjs');
const USER_ITEMS=new Set(['bread','produce','meals','rations','bandages','tools','torches']);
const EQUIP=new Set(['tools','torches']);
const ORDER=(a,b)=>Number(a.serial.slice(4))-Number(b.serial.slice(4));
function backpack(world){
 const c=world.characters?.['1'];
 if(!c)throw Error('No character exists');
 const r=world.entity_registry;
 if(!r)throw Error('Item registry unavailable');
 const items=Object.values(r.items).filter(i=>i.parent===R.PACK)
   .sort(ORDER).map(({serial,type,amount})=>({serial,type,amount}));
 const equipment={};
 for(const [slot,parent] of Object.entries({hand:R.HAND,light:R.LIGHT})){
  const item=Object.values(r.items).find(i=>i.parent===parent);
  equipment[slot]=item?{serial:item.serial,type:item.type,amount:item.amount}:null;
 }
 const count=items.reduce((sum,i)=>sum+i.amount,0);
 // Only expose bank, chest and deed storage when the character can access
 // them physically. A remote client must not learn their current contents.
 const visible=R.inspect(world);
 const containers=visible.containers
  .filter(box=>![R.HAND,R.LIGHT].includes(box.id))
  .map(box=>({id:box.id,kind:box.kind,capacity:box.capacity,
    used:visible.items.filter(i=>i.parent===box.id).reduce((n,i)=>n+i.amount,0),
    items:box.id===R.PACK?[]:visible.items.filter(i=>i.parent===box.id)
      .sort(ORDER).map(({serial,type,amount})=>({serial,type,amount}))}));
 return {character:c.name,form:c.form,backpack:items,equipment,
  containers,gold:c.gold||0,bank_gold:c.bank_gold||0,capacity:200,
  used:count,revision:world.revision};
}
function take(world,command){
 if(!command||typeof command!=='object'||Array.isArray(command))throw Error('Invalid item action');
 const action=command.action;
 const allowed={use_item:'action,serial',split_stack:'action,quantity,serial',
   combine_stacks:'action,source_serial,target_serial',move_stack:'action,destination,serial',
   equip_item:'action,serial',unequip_item:'action,serial'};
 if(!Object.hasOwn(allowed,action)||
   Object.keys(command).sort().join(',')!==allowed[action])throw Error('Invalid item action');
 const serials=action==='combine_stacks'?
  [command.source_serial,command.target_serial]:[command.serial];
 if(!serials.every(id=>typeof id==='string'&&/^ent_[1-9][0-9]*$/.test(id)))
  throw Error('Invalid item serial');
 if(!world.runtime?.running)throw Error('World is paused');
 const c=world.characters?.['1'];
 if(!c)throw Error('No character exists');
 if(c.form!=='living')throw Error('Ghosts cannot handle physical goods');
 if(c.crafting?.incapacitated)throw Error('You are unconscious');
 const registry=world.entity_registry;
 const item=registry?.items[serials[0]];
 if(!item)throw Error('Unknown item serial');
 const visible=new Set(R.inspect(world).containers.map(box=>box.id));
 if(!visible.has(item.parent))throw Error('Item is not accessible from here');
 if(action==='move_stack'){
  // Never trust the submitted quantity. The server owns the stack amount.
  return R.transfer(world,{action:'move_item',serial:item.serial,
    quantity:item.amount,destination:command.destination},{maxQuantity:500});
 }
 if(action==='equip_item'){
  if(item.parent!==R.PACK)throw Error('Item is not in your backpack');
  const destination=item.type==='tools'?R.HAND:item.type==='torches'?R.LIGHT:null;
  if(!destination)throw Error('This item cannot be equipped');
  const result=R.transfer(world,{action:'move_item',serial:item.serial,
    quantity:1,destination});
  result.event.type='item.equipped';result.event.text='Equipment was worn.';
  return result;
 }
 if(action==='unequip_item'){
  if(![R.HAND,R.LIGHT].includes(item.parent))throw Error('Item is not equipped');
  const result=R.transfer(world,{action:'move_item',serial:item.serial,
    quantity:1,destination:R.PACK});
  result.event.type='item.unequipped';result.event.text='Equipment returned to backpack.';
  return result;
 }
 if(action==='use_item'){
  if(item.parent!==R.PACK)throw Error('Item is not in your backpack');
  if(!USER_ITEMS.has(item.type))throw Error('The item cannot be used directly');
  const equip=EQUIP.has(item.type);
  const result=CRAFT.apply(world,equip?{action:'equip',item_type:item.type}:
    {action:'consume',item_type:item.type});
  const next=result.world,r=next.entity_registry,selected=r.items[item.serial];
  if(!selected||selected.parent!==R.PACK||selected.amount<1)
   throw Error('Selected item was modified');
  if(equip){
   const destination=item.type==='tools'?R.HAND:R.LIGHT;
   if(selected.amount===1)selected.parent=destination;
   else{
    selected.amount--;
    const serial='ent_'+r.next_serial++;
    r.items[serial]={serial,kind:'item',type:selected.type,amount:1,
      parent:destination,created_minute:next.living.minute};
    result.event.item_serial=serial;
   }
   if(!result.event.item_serial)result.event.item_serial=selected.serial;
  }else{
   selected.amount--;
   if(!selected.amount)delete r.items[item.serial];
   result.event.item_serial=item.serial;
  }
  R.reconcile(next);R.counts(next);R.validate(next);
  return result;
 }
 if([R.HAND,R.LIGHT].includes(item.parent))throw Error('Equipped items cannot be split or combined');
 const next=structuredClone(world),r=next.entity_registry;
 const source=r.items[serials[0]];
 let text,type=action,eventFields={};
 if(action==='split_stack'){
  const qty=command.quantity;
  if(!Number.isSafeInteger(qty)||qty<1||qty>=source.amount)
   throw Error('Invalid stack split quantity');
  source.amount-=qty;
  const created='ent_'+r.next_serial++;
  r.items[created]={serial:created,kind:'item',type:source.type,amount:qty,
    parent:source.parent,created_minute:next.living.minute};
  type='item.split';text='A backpack stack was divided.';
  eventFields={source_serial:source.serial,new_serial:created,quantity:qty};
 }else{
  const target=r.items[serials[1]];
  if(!target||target.parent!==source.parent||target.serial===source.serial||
    target.type!==source.type)throw Error('Stacks are incompatible');
  if(source.amount+target.amount>500)throw Error('The resulting stack is too large');
  target.amount+=source.amount;
  eventFields={source_serial:source.serial,target_serial:target.serial,
    quantity:source.amount};
  delete r.items[source.serial];
  type='item.combined';text='Two backpack stacks were combined.';
 }
 const character=next.characters['1'],l=next.living;
 character.revision++;next.revision++;
 const event={id:'event_'+(++l.event_sequence),minute:l.minute,
   type,text,slot:1,area_id:character.area_id,...eventFields};
 l.events.push(event);if(l.events.length>512)l.events.shift();
 R.reconcile(next);R.counts(next);R.validate(next);
 return {world:next,character,event};
}
module.exports={backpack,take};
