'use strict';
// UO-inspired first economy loop: gathering, inventory, shop transactions,
// and banked gold. The authoritative server validates every transaction.
const {COURT,VILLAGE}=require('./regions.cjs');
const CRAFT=require('./crafting-m7.cjs');
const COMBAT=require('./combat-m8.cjs');
const STORAGE=require('./storage-m9.cjs');
const ENTITIES=require('./entity-registry-m10.cjs');
const MOBILE=require('./mobile-assets-m12.cjs');
const SKILLS=require('./skills-m14.cjs');
const LAW=require('./law-m15.cjs');
const TYPES=new Set(['herbs','wood','ore','bread','tools','produce','meals','torches','rations','bandages']);
const VALUES={herbs:3,wood:2,ore:4,bread:2,tools:8,produce:2,meals:4};
const NODES=[
 ['courtyard_herbs_west',COURT,18,32,'herbs',6],
 ['courtyard_herbs_east',COURT,45,33,'herbs',6],
 ['courtyard_wood',COURT,19,12,'wood',5],
 ['village_herbs',VILLAGE,85,71,'herbs',8],
 ['village_ore',VILLAGE,90,57,'ore',5],
 ['village_wood',VILLAGE,20,62,'wood',8]
];
function ensureProgress(character){
 if(!character)return false;
 let changed=false;
 if(!character.inventory){character.inventory={};changed=true;}
 for(const type of TYPES)
  if(character.inventory[type]===undefined){character.inventory[type]=0;changed=true;}
 for(const [key,value] of [['gold',5],['bank_gold',0],['gather_after_minute',-1]])
  if(character[key]===undefined){character[key]=value;changed=true;}
 if(!character.skills){character.skills={foraging:0,commerce:0};changed=true;}
 if(character.skills.combat===undefined){character.skills.combat=0;changed=true;}
 if(CRAFT.ensure(character))changed=true;
 if(SKILLS.ensure(character))changed=true;
 return changed;
}
function ensureResources(world){
 let changed=false;
 if(!world.living.resources){world.living.resources={};changed=true;}
 for(const [id,area_id,x,y,type,max] of NODES){
  if(world.living.resources[id])continue;
  world.living.resources[id]={id,area_id,x,y,type,max,remaining:max,
    next_regen_minute:60};changed=true;
 }
 return changed;
}
function validateProgress(character){
 if(!character)return true;
 if(character.inventory){
  for(const [type,count] of Object.entries(character.inventory))
   if(!TYPES.has(type)||!Number.isSafeInteger(count)||count<0||count>200)
    throw Error('Invalid server-owned inventory');
 }
 CRAFT.validate(character);
 SKILLS.validate(character);
 if(character.last_attack_utc_ms!==undefined&&(!Number.isSafeInteger(character.last_attack_utc_ms)||character.last_attack_utc_ms<0))throw Error('Invalid attack timestamp');
 for(const key of ['gold','bank_gold'])
  if(character[key]!==undefined&&(!Number.isSafeInteger(character[key])||
    character[key]<0||character[key]>1e9))throw Error('Invalid character gold');
 if(character.skills){
  for(const key of ['foraging','commerce','combat'])
   if(!Number.isSafeInteger(character.skills[key])||character.skills[key]<0||
     character.skills[key]>1e7)throw Error('Invalid character skill');
 }
 return true;
}
function near(c,x,y,r=2){return Math.abs(c.x-x)+Math.abs(c.y-y)<=r;}
function nearShop(world,c,id){
 const shop=world.living.businesses[id];
 if(!shop||shop.area_id!==c.area_id)throw Error('This business is not nearby');
 const object=world.areas[c.area_id]?.objects.find(o=>o.id===id);
 if(!object)throw Error('Business building is not available');
 const p=object.door?{x:object.door.x,y:object.door.y+1}:object;
 if(!near(c,p.x,p.y,3))throw Error('Move closer to the business');
 return shop;
}
function bankLocation(world,c){
 if(c.area_id!==VILLAGE||!near(c,54,103,3))
  throw Error('Visit the Village Bank doorway first');
 const shop=world.living.businesses.village_bank;
 if(!shop.open)throw Error('The bank is closed');
 return shop;
}
function apply(world,command,now=Date.now()){
 if(command?.action==='pay_fine')return LAW.payFine(world,command);
 if(command?.action==='skill_lock')return SKILLS.applyLock(world,command);
 if(command?.action==='loot_corpse')return MOBILE.loot(world,command);
 if(command?.action==='move_item')return ENTITIES.transfer(world,command);
 if(['bank_store','bank_take','drop_item','pick_up'].includes(command?.action))return STORAGE.apply(world,command);
 if(['attack','loot'].includes(command?.action))return COMBAT.apply(world,command,now);
 if(['craft','consume','equip','unequip','rest'].includes(command?.action))
   return CRAFT.apply(world,command);
 const allowed={gather:['action','node_id'],
  buy:['action','business_id','quantity'],
  sell:['action','business_id','item_type','quantity'],
  bank_deposit:['action','amount'],bank_withdraw:['action','amount']};
 if(!command||typeof command!=='object'||!allowed[command.action]||
  Object.keys(command).sort().join(',')!==allowed[command.action].sort().join(','))
  throw Error('Invalid gameplay action');
 const character=world.characters['1'];
 if(!character)throw Error('No character exists');
 if(character.form!=='living')throw Error('Ghosts cannot handle physical goods');
 if(!world.runtime?.running)throw Error('World is paused');
 const next=structuredClone(world),c=next.characters['1'],l=next.living;
 ensureProgress(c);ensureResources(next);
 const minute=l.minute,action=command.action;
 let item=null,qty=1,amount=0,shop=null;
 if(action==='gather'){
  const n=l.resources[command.node_id];
  if(!n||n.area_id!==c.area_id||!near(c,n.x,n.y,2))
   throw Error('Move beside a resource patch to gather');
  if(c.gather_after_minute>=minute)throw Error('You must wait before gathering again');
  if(n.remaining<=0)throw Error('This resource has been depleted');
  if(Object.values(c.inventory).reduce((sum,v)=>sum+v,0)>=200)
   throw Error('Your pack is full');
  n.remaining--;c.inventory[n.type]++;
  c.gather_after_minute=minute;c.skills.foraging+=c.crafting?.hand==='tools'?2:1;
  SKILLS.practice(c,n.type==='herbs'?'herbalism':n.type==='wood'?'lumberjacking':'mining',
    minute,'resource:'+n.id);
  item=n.type;
 }else if(action==='buy'){
  shop=nearShop(next,c,command.business_id);
  if(!shop.open)throw Error('This shop is closed');
  qty=command.quantity;
  if(!Number.isInteger(qty)||qty<1||qty>10)throw Error('Invalid quantity');
  item=shop.product;
  if(!TYPES.has(item)||shop.stock<qty)throw Error('Shop is out of stock');
  const price=VALUES[item]*qty;
  if(c.gold<price)throw Error('Not enough gold');
  if(Object.values(c.inventory).reduce((sum,v)=>sum+v,0)+qty>200)
   throw Error('Your pack is full');
  c.gold-=price;c.inventory[item]+=qty;shop.stock-=qty;shop.coins+=price;
  c.skills.commerce+=qty;
  SKILLS.practice(c,'trading',minute,'business:'+shop.id);
 }else if(action==='sell'){
  shop=nearShop(next,c,command.business_id);
  if(!shop.open)throw Error('This shop is closed');
  qty=command.quantity;item=command.item_type;
  if(!TYPES.has(item)||!Number.isInteger(qty)||qty<1||qty>10)
   throw Error('Invalid item or quantity');
  const accepted={
   village_smithy:['wood','ore'],village_market:['herbs','produce'],
   courtyard_market:['herbs'],village_bakery:['produce'],
   village_tavern:['meals','produce']
  }[shop.id]||[];
  if(!accepted.includes(item))throw Error('This merchant does not buy that item');
  if(c.inventory[item]<qty)throw Error('You do not own those items');
  const price=VALUES[item]*qty;
  if(shop.coins<price)throw Error('The merchant cannot afford the trade');
  c.inventory[item]-=qty;c.gold+=price;shop.coins-=price;shop.stock+=qty;
  c.skills.commerce+=qty;
  SKILLS.practice(c,'trading',minute,'business:'+shop.id);
 }else{
  bankLocation(next,c);
  amount=command.amount;
  if(!Number.isSafeInteger(amount)||amount<1||amount>100000)
   throw Error('Invalid amount');
  if(action==='bank_deposit'){
   if(c.gold<amount)throw Error('You do not have enough gold');
   c.gold-=amount;c.bank_gold+=amount;
  }else{
   if(c.bank_gold<amount)throw Error('Your bank balance is too low');
   c.bank_gold-=amount;c.gold+=amount;
  }
 }
 c.revision++;next.revision++;
 const e={id:'event_'+(++l.event_sequence),minute,
  type:'player.'+action,text:'Player '+action.replaceAll('_',' ')+'.',
  area_id:c.area_id,slot:1,x:c.x,y:c.y,item,quantity:qty,
  amount:amount||undefined,business_id:shop?.id};
 l.events.push(e);if(l.events.length>512)l.events.shift();
 validateProgress(c);
 return {world:next,character:c,event:e};
}
function regenerate(world,minute,events){
 const resources=world.living.resources;if(!resources||minute%60!==0)return;
 for(const node of Object.values(resources)){
  if(node.remaining>=node.max||node.next_regen_minute>minute)continue;
  node.remaining++;node.next_regen_minute=minute+60;
  const l=world.living;
  const e={id:'event_'+(++l.event_sequence),minute,type:'resource.regrown',
    text:'Resources regrew near '+node.area_id+'.',
    node_id:node.id,area_id:node.area_id,remaining:node.remaining};
  l.events.push(e);if(l.events.length>512)l.events.shift();events.push(e);
 }
}
module.exports={TYPES,VALUES,NODES,ensureProgress,ensureResources,validateProgress,apply,regenerate};
