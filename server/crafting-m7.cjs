'use strict';
// DK Server M7: small, server-owned crafting/needs/equipment rules.
// Recipes refer to real existing inventory; no random free item generation.
const {VILLAGE}=require('./regions.cjs');
const SKILLS=require('./skills-m14.cjs');
const RECIPES=Object.freeze({
 torch:{inputs:{wood:1,herbs:1},output:'torches',amount:1,station:null},
 rations:{inputs:{bread:1,produce:1},output:'rations',amount:2,station:null},
 bandages:{inputs:{herbs:2,produce:1},output:'bandages',amount:1,station:null},
 tools:{inputs:{ore:2,wood:1},output:'tools',amount:1,station:'village_smithy'}
});
const EDIBLE=Object.freeze({bread:15,produce:10,meals:25,rations:35});
const DEFAULT=()=>({hunger:80,energy:100,health:100,hand:null,light:null,
  skill:0,craft_after_minute:-1,rest_after_minute:-1,torch_until_minute:-1,
  last_need_minute:0,incapacitated:false});
function ensure(character){
 if(!character)return false;
 if(!character.crafting){character.crafting=DEFAULT();return true;}
 let changed=false;
 for(const [key,value] of Object.entries(DEFAULT()))if(character.crafting[key]===undefined){
  character.crafting[key]=value;changed=true;
 }
 return changed;
}
function validate(character){
 const c=character?.crafting;if(!c)return true;
 for(const key of ['hunger','energy','health'])
  if(!Number.isSafeInteger(c[key])||c[key]<0||c[key]>100)
   throw Error('Invalid survival needs');
 for(const key of ['skill','craft_after_minute','rest_after_minute','last_need_minute','torch_until_minute'])
  if(!Number.isSafeInteger(c[key])||c[key]<-1||c[key]>Number.MAX_SAFE_INTEGER)
   throw Error('Invalid crafting progression');
 if(![null,'tools'].includes(c.hand)||![null,'torches'].includes(c.light)||
   typeof c.incapacitated!=='boolean')throw Error('Invalid equipped gear');
 return true;
}
const countPack=c=>Object.values(c.inventory||{}).reduce((sum,n)=>sum+n,0);
function nearSmith(world,c){
 if(c.area_id!==VILLAGE)return false;
 const object=world.areas[VILLAGE]?.objects.find(o=>o.id==='village_smithy');
 if(!object)return false;
 const px=object.door?.x??object.x,py=object.door?object.door.y+1:object.y;
 return Math.abs(c.x-px)+Math.abs(c.y-py)<=3;
}
function apply(world,command){
 const allowed={
  craft:'action,recipe',consume:'action,item_type',equip:'action,item_type',
  unequip:'action,slot',rest:'action'
 };
 if(!command||typeof command!=='object'||Array.isArray(command)||
    !Object.hasOwn(allowed,command.action)||
    Object.keys(command).sort().join(',')!==allowed[command.action])
   throw Error('Invalid crafting action');
 const old=world.characters['1'];
 if(!old)throw Error('No character exists');
 if(old.form!=='living')throw Error('Ghosts cannot use physical equipment or food');
 if(!world.runtime?.running)throw Error('The world is paused');
 const next=structuredClone(world),player=next.characters['1'];
 ensure(player);
 const c=player.crafting,minute=next.living.minute;
 if(c.incapacitated&&command.action!=='rest')throw Error('You are unconscious and cannot act');
 let detail='';
 if(command.action==='craft'){
  const recipe=RECIPES[command.recipe];
  if(!recipe)throw Error('Invalid recipe');
  if(minute<=c.craft_after_minute)throw Error('You must wait before crafting again');
  if(recipe.station&&!nearSmith(next,player))throw Error('Move to the village smithy to craft tools');
  for(const [item,amount] of Object.entries(recipe.inputs))
   if((player.inventory[item]||0)<amount)throw Error('Not enough ingredients');
  const used=Object.values(recipe.inputs).reduce((a,b)=>a+b,0);
  if(countPack(player)-used+recipe.amount>200)throw Error('Your pack is full');
  if((player.inventory[recipe.output]||0)+recipe.amount>200)throw Error('Item stack is full');
  for(const [item,amount] of Object.entries(recipe.inputs))
   player.inventory[item]-=amount;
  player.inventory[recipe.output]+=recipe.amount;
  c.skill+=2;c.craft_after_minute=minute;
  const profession=command.recipe==='tools'?'blacksmithing':
    command.recipe==='rations'?'cooking':
    command.recipe==='bandages'?'healing':'survival';
  SKILLS.practice(player,profession,minute,'recipe:'+command.recipe);
  detail=command.recipe;
 }else if(command.action==='consume'){
  const item=command.item_type;
  if(!Object.hasOwn(EDIBLE,item)&&item!=='bandages')throw Error('Invalid consumable');
  if((player.inventory[item]||0)<1)throw Error('You do not have that item');
  if(item==='bandages'){
   if(c.health>=100)throw Error('You do not need bandages');
   c.health=Math.min(100,c.health+20);
  }else{
   if(c.hunger>=100)throw Error('You are not hungry');
   c.hunger=Math.min(100,c.hunger+EDIBLE[item]);
   c.energy=Math.min(100,c.energy+5);
  }
  player.inventory[item]--;detail=item;
  SKILLS.practice(player,item==='bandages'?'healing':'survival',
    minute,'consume:'+item);
 }else if(command.action==='equip'){
  const item=command.item_type;
  const slot=item==='tools'?'hand':item==='torches'?'light':null;
  if(!slot)throw Error('Invalid equip item');
  if(c[slot])throw Error('This equipment slot is occupied');
  if((player.inventory[item]||0)<1)throw Error('You do not own the equipment');
  player.inventory[item]--;c[slot]=item;
  if(item==='torches')c.torch_until_minute=minute+90;
  detail=item;
 }else if(command.action==='unequip'){
  const slot=command.slot;
  if(!['hand','light'].includes(slot))throw Error('Invalid equipment slot');
  const item=c[slot];
  if(!item)throw Error('No equipment is worn there');
  if(countPack(player)>=200||(player.inventory[item]||0)>=200)
   throw Error('Your pack is full');
  player.inventory[item]++;c[slot]=null;
  if(slot==='light')c.torch_until_minute=-1;
  detail=item;
 }else{
  if(minute<=c.rest_after_minute)throw Error('You must wait before resting again');
  c.energy=Math.min(100,c.energy+25);
  if(c.incapacitated){c.health=Math.max(c.health,20);c.hunger=Math.max(c.hunger,5);c.incapacitated=false;}
  c.rest_after_minute=minute+60;
  SKILLS.practice(player,'survival',minute,'rest');
  detail='rest';
 }
 player.revision++;next.revision++;
 const living=next.living,e={id:'event_'+(++living.event_sequence),minute,
  type:'player.'+command.action,text:'Player '+command.action+
    (detail==='rest'?'ed': ' '+detail+'.'),
  item:detail,area_id:player.area_id,slot:1};
 living.events.push(e);if(living.events.length>512)living.events.shift();
 validate(player);
 return {world:next,character:player,event:e};
}
function tick(world,minute,events){
 const player=world.characters?.['1'];
 if(!player||player.form!=='living')return;
 ensure(player);
 const c=player.crafting;
 if(c.light==='torches'&&minute>=c.torch_until_minute){
  c.light=null;c.torch_until_minute=-1;
  events.push(record(world,minute,'equipment.exhausted','The equipped torch burned out.'));
 }
 if(minute%30!==0||minute<=c.last_need_minute)return;
 c.last_need_minute=minute;
 c.hunger=Math.max(0,c.hunger-2);
 c.energy=Math.max(0,c.energy-1);
 if(c.hunger===0)c.health=Math.max(0,c.health-1);
 if(c.health===0&&!c.incapacitated){
  c.incapacitated=true;
  events.push(record(world,minute,'player.incapacitated','The character collapsed from exhaustion and starvation.'));
 }
}
function record(world,minute,type,text){
 const l=world.living,e={id:'event_'+(++l.event_sequence),minute,type,text,
  slot:1,area_id:world.characters['1'].area_id};
 l.events.push(e);if(l.events.length>512)l.events.shift();
 return e;
}
module.exports={RECIPES,EDIBLE,ensure,validate,apply,tick};
