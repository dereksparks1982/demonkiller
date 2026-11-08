'use strict';
// M54: physical weapons, shields and armor. Independent DK Softworks code.
const E=require('./entity-registry-m10.cjs'),S=require('./skills-m14.cjs');
const {VILLAGE}=require('./regions.cjs'),V=require('./vendors-m18.cjs');
const GEAR=Object.freeze({
 short_sword:{slot:'weapon',skill:'swordsmanship',damage:8,range:1},
 mace:{slot:'weapon',skill:'mace_fighting',damage:9,range:1},
 spear:{slot:'weapon',skill:'fencing',damage:7,range:1},
 bow:{slot:'weapon',skill:'archery',damage:6,range:5},
 buckler:{slot:'offhand',absorb:2},
 iron_armor:{slot:'armor',absorb:2}
});
const RECIPES=Object.freeze({
 short_sword:{input:{ore:3,wood:1},amount:1,smith:true,skill:'blacksmithing'},
 mace:{input:{ore:2,wood:2},amount:1,smith:true,skill:'blacksmithing'},
 spear:{input:{ore:1,wood:3},amount:1,smith:true,skill:'blacksmithing'},
 bow:{input:{wood:4,herbs:1},amount:1,smith:false,skill:'bowcraft'},
 arrows:{input:{wood:1},amount:4,smith:false,skill:'fletching'},
 buckler:{input:{ore:1,wood:2},amount:1,smith:true,skill:'blacksmithing'},
 iron_armor:{input:{ore:5,wood:1},amount:1,smith:true,skill:'blacksmithing'}
});
const SLOTS=Object.freeze({weapon:'armory_weapon_1',
 offhand:'armory_offhand_1',armor:'armory_armor_1'}),DURABILITY=100;
function ensureCharacter(c){
 if(!c||c.armory)return false;
 c.armory={schema:1,slots:{weapon:null,offhand:null,armor:null},
  durability:{},last_forge_minute:-1};return true;
}
function ensure(w){
 if(!w.entity_registry)throw Error('Armory needs persistent world items');
 let changed=false;
 for(const [slot,id]of Object.entries(SLOTS))
  if(!w.entity_registry.containers[id]){
   w.entity_registry.containers[id]={id,kind:'armory_equip',slot,
    owner:'1',capacity:1};changed=true;
  }
 if(ensureCharacter(w.characters?.['1']))changed=true;
 return changed;
}
function validate(w){
 const c=w.characters?.['1'];
 if(!c?.armory)return true;
 const a=c.armory,r=w.entity_registry;
 if(a.schema!==1||!a.slots||!a.durability||Array.isArray(a.slots)||
  Object.keys(a.slots).sort().join(',')!=='armor,offhand,weapon'||
  !Number.isSafeInteger(a.last_forge_minute)||a.last_forge_minute<-1)
  throw Error('Invalid armory state');
 const seen=new Set();
 for(const [slot,id]of Object.entries(SLOTS)){
  if(!r?.containers?.[id]||r.containers[id].kind!=='armory_equip')
   throw Error('Armory equipment container is missing');
  const serial=a.slots[slot];
  if(serial===null)continue;
  const item=r.items[serial],kind=item&&GEAR[item.type],hp=a.durability[serial];
  if(!item||!kind||kind.slot!==slot||item.parent!==id||item.amount!==1||
   seen.has(serial)||!Number.isSafeInteger(hp)||hp<1||hp>DURABILITY||
   item.durability!==hp)
   throw Error('Invalid equipped item');
  seen.add(serial);
 }
 if(Object.keys(a.durability).length!==seen.size||
  Object.keys(a.durability).some(id=>!seen.has(id)))
  throw Error('Orphaned equipment durability');
 return true;
}
function nearSmith(w,c){
 const shop=w.living.businesses.village_smithy;
 if(!shop||c.area_id!==VILLAGE)return false;
 const pt=V.location(w,shop);
 return Math.abs(c.x-pt.x)+Math.abs(c.y-pt.y)<=3;
}
function event(w,type,text,details={}){
 const l=w.living,e={id:'event_'+(++l.event_sequence),minute:l.minute,
  type,text,area_id:w.characters['1']?.area_id,...details};
 l.events.push(e);if(l.events.length>512)l.events.shift();return e;
}
function equipped(w,c,slot){
 const serial=c?.armory?.slots?.[slot],item=serial&&w.entity_registry?.items?.[serial];
 return item?{serial,type:item.type,durability:c.armory.durability[serial],
  ...GEAR[item.type]}:null;
}
function wear(w,c,slot,n,out){
 const part=equipped(w,c,slot);
 if(!part)return;
 const hp=Math.max(0,part.durability-n);
 if(hp>0){c.armory.durability[part.serial]=hp;
  w.entity_registry.items[part.serial].durability=hp;return;}
 c.armory.slots[slot]=null;delete c.armory.durability[part.serial];
 delete w.entity_registry.items[part.serial];
 const e=event(w,'equipment.broken',part.type+' broke and was lost.',
  {serial:part.serial,slot,item_type:part.type});
 if(out)out.push(e);
}
function defend(w,c,damage,out,attacker=''){
 if(!c.armory)return damage;
 const shield=equipped(w,c,'offhand');
 if(shield){
  const mastery=c.skillbook?.skills?.parrying?.value||0;
  const chance=Math.min(70,25+Math.floor(mastery/20));
  const roll=(w.living.minute*17+c.x*13+c.y*7+String(attacker).length*11)%100;
  if(roll<chance){
   damage=Math.max(1,damage-shield.absorb);
   S.practice(c,'parrying',w.living.minute,'shield:'+attacker);
  }
  wear(w,c,'offhand',1,out);
 }
 const armor=equipped(w,c,'armor');
 if(armor){damage=Math.max(1,damage-armor.absorb);wear(w,c,'armor',1,out);}
 return damage;
}
function act(w,command){
 const keys={forge_gear:'action,recipe',equip_gear:'action,serial',
  unequip_gear:'action,slot'};
 if(!command||typeof command!=='object'||Array.isArray(command)||
  !Object.hasOwn(keys,command.action)||
  Object.keys(command).sort().join(',')!==keys[command.action])
  throw Error('Invalid armory command');
 if(!w.runtime?.running)throw Error('World is paused');
 const player=w.characters?.['1'];
 if(!player||player.form!=='living'||player.crafting?.incapacitated)
  throw Error('Only a conscious living character can handle physical weapons');
 const next=structuredClone(w),c=next.characters['1'];ensure(next);S.ensure(c);
 const a=c.armory,r=next.entity_registry,minute=next.living.minute;
 let e;
 if(command.action==='forge_gear'){
  const recipe=RECIPES[command.recipe];
  if(!recipe)throw Error('Unknown equipment recipe');
  if(a.last_forge_minute>=minute)throw Error('Wait another world minute to craft');
  if(recipe.smith&&!nearSmith(next,c))throw Error('Visit the village smithy');
  for(const [type,n]of Object.entries(recipe.input))
   if((c.inventory[type]||0)<n)throw Error('Not enough raw materials');
  const used=Object.values(recipe.input).reduce((x,y)=>x+y,0);
  if(Object.values(c.inventory).reduce((x,y)=>x+y,0)-used+recipe.amount>200||
   (c.inventory[command.recipe]||0)+recipe.amount>200)
   throw Error('Backpack cannot hold the finished gear');
  for(const [type,n]of Object.entries(recipe.input))c.inventory[type]-=n;
  c.inventory[command.recipe]+=recipe.amount;
  a.last_forge_minute=minute;
  E.reconcile(next);E.counts(next);
  S.practice(c,recipe.skill,minute,'forge:'+command.recipe);
  e=event(next,'equipment.forged','You crafted '+command.recipe+'.',
   {recipe:command.recipe,amount:recipe.amount});
 }else if(command.action==='equip_gear'){
  const serial=command.serial;
  if(typeof serial!=='string'||!/^ent_[1-9][0-9]*$/.test(serial))
   throw Error('Invalid physical item serial');
  const item=r.items[serial],kind=item&&GEAR[item.type];
  if(!item||item.parent!==E.PACK||item.amount!==1||!kind||!c.inventory[item.type])
   throw Error('This item is not wearable from your backpack');
  if(a.slots[kind.slot])throw Error('The equipment slot is already occupied');
  if(kind.slot==='weapon'&&c.crafting.hand)
   throw Error('Unequip old hand tools before wielding a weapon');
  const id=item.serial;
  item.parent=SLOTS[kind.slot];
  c.inventory[item.type]--;
  const hp=item.durability??DURABILITY;
  if(!Number.isSafeInteger(hp)||hp<1||hp>DURABILITY)
   throw Error('Gear durability is corrupted');
  item.durability=hp;
  a.slots[kind.slot]=id;a.durability[id]=hp;
  E.reconcile(next);E.counts(next);
  e=event(next,'equipment.equipped','You equipped '+item.type+'.',
   {serial:id,item_type:item.type,slot:kind.slot});
 }else{
  const slot=command.slot;
  if(!Object.hasOwn(SLOTS,slot)||!a.slots[slot])
   throw Error('Nothing equipped in that slot');
  const id=a.slots[slot],item=r.items[id];
  if(!item)throw Error('Missing physical equipped item');
  if(Object.values(c.inventory).reduce((x,y)=>x+y,0)>=200||
   (c.inventory[item.type]||0)>=200)throw Error('Backpack is full');
  item.parent=E.PACK;c.inventory[item.type]++;
  a.slots[slot]=null;delete a.durability[id];
  E.reconcile(next);E.counts(next);
  e=event(next,'equipment.unequipped','You returned '+item.type+' to your pack.',
   {serial:id,item_type:item.type,slot});
 }
 c.revision++;next.revision++;validate(next);
 return {world:next,character:c,event:e};
}
function listing(w){
 const c=w.characters?.['1'];
 return {world_minute:w.living?.minute||0,
  equipped:c?Object.fromEntries(Object.keys(SLOTS).map(slot=>[slot,equipped(w,c,slot)])):{},
  recipes:RECIPES,gear:GEAR};
}
module.exports={GEAR,RECIPES,SLOTS,DURABILITY,ensureCharacter,ensure,validate,
 equipped,wear,defend,act,listing};
