'use strict';
// M43: UO-style usable field skills tied to real world state, not free levels.
// No copied RunUO code. Every success/failure is decided by the server.
const SKILLS=require('./skills-m14.cjs');
const DECAY=require('./corpse-decay-m29.cjs');
const ENTITIES=require('./entity-registry-m10.cjs');
const {TEMPLE,traversable}=require('./regions.cjs');
const ALLOWED=Object.freeze(['tracking','hiding','anatomy',
 'forensic_evaluation','meditation','spirit_speak','animal_lore',
 'stealth','camping']);
const RANGE=12,COOLDOWN=5;
function ensure(character){
 if(!character)return false;
 if(character.fieldcraft){
  let changed=false;
  if(character.fieldcraft.stealth_steps===undefined){
   character.fieldcraft.stealth_steps=0;changed=true;
  }
  if(character.fieldcraft.camp_until_minute===undefined){
   character.fieldcraft.camp_until_minute=-1;changed=true;
  }
  return changed;
 }
 character.fieldcraft={schema:1,hidden_until_minute:-1,last_use_minute:-COOLDOWN,
  last_skill:null,stealth_steps:0,camp_until_minute:-1};return true;
}
function validate(character){
 const f=character?.fieldcraft;
 if(!f)return true;
 if(f.schema!==1||!Number.isSafeInteger(f.hidden_until_minute)||
  f.hidden_until_minute < -1||!Number.isSafeInteger(f.last_use_minute)||
  f.last_use_minute< -COOLDOWN||
  (f.stealth_steps!==undefined&&(!Number.isSafeInteger(f.stealth_steps)||
   f.stealth_steps<0||f.stealth_steps>12))||
  (f.camp_until_minute!==undefined&&(!Number.isSafeInteger(f.camp_until_minute)||
   f.camp_until_minute < -1))||
  (f.last_skill!==null&&!ALLOWED.includes(f.last_skill)))
  throw Error('Invalid field skill state');
 return true;
}
function distance(a,b){return Math.abs(a.x-b.x)+Math.abs(a.y-b.y);}
function labelDirection(a,b){
 const dx=b.x-a.x,dy=b.y-a.y;
 if(!dx&&!dy)return 'here';
 if(Math.abs(dx)>=Math.abs(dy))return dx>=0?'east':'west';
 return dy>=0?'south':'north';
}
function nearest(world,c,types,range){
 const targets=[];
 if(types.includes('monster'))targets.push(...Object.values(world.living.combat?.creatures||{})
  .filter(m=>m.alive).map(m=>({...m,targetKind:'monster'})));
 if(types.includes('npc'))targets.push(...Object.values(world.living.npcs||{})
  .filter(n=>n.alive).map(n=>({...n,targetKind:'npc'})));
 if(types.includes('pet'))targets.push(...Object.values(world.living.companions?.pets||{})
  .filter(p=>p.alive).map(p=>({...p,targetKind:'pet'})));
 if(types.includes('corpse'))targets.push(...Object.values(world.living.mobile_assets?.corpses||{})
  .map(n=>({...n,targetKind:'corpse'})));
 return targets.filter(n=>n.area_id===c.area_id&&distance(c,n)<=range)
  .sort((a,b)=>distance(c,a)-distance(c,b)||a.id.localeCompare(b.id))[0]||null;
}
function apply(world,command){
 if(!command||typeof command!=='object'||Array.isArray(command)||
  Object.keys(command).sort().join(',')!=='action,skill'||
  command.action!=='use_skill'||!ALLOWED.includes(command.skill))
  throw Error('Invalid field-skill action');
 if(!world.runtime?.running)throw Error('World is paused');
 if(!world.characters?.['1'])throw Error('No character exists');
 const next=structuredClone(world),c=next.characters['1'],l=next.living,minute=l.minute;
 SKILLS.ensure(c);ensure(c);
 const skill=command.skill;
 const stealthCombo=skill==='stealth'&&c.fieldcraft.last_skill==='hiding'&&
  c.fieldcraft.hidden_until_minute>minute;
 if(c.fieldcraft.last_use_minute+COOLDOWN>minute&&!stealthCombo)
  throw Error('Wait for your skill cooldown');
 let target=null,text='',success=false;
 if(skill==='hiding'){
  if(c.form!=='living')throw Error('Ghosts do not need concealment');
  if(c.crafting?.incapacitated)throw Error('You are unconscious');
  target=nearest(next,c,['monster'],6);
  if(target)throw Error('Too close to a monster to hide');
  c.fieldcraft.hidden_until_minute=minute+15;
  c.fieldcraft.stealth_steps=0;
  text='You slip out of sight for fifteen world minutes.';success=true;
 }else if(skill==='stealth'){
  if(c.form!=='living'||c.crafting?.incapacitated)
   throw Error('Only a conscious living character can sneak');
  if(c.fieldcraft.hidden_until_minute<=minute)
   throw Error('Hide successfully before attempting to move in stealth');
  c.fieldcraft.stealth_steps=Math.min(12,
   2+Math.floor(c.skillbook.skills.stealth.value/150));
  text='You prepare to sneak '+c.fieldcraft.stealth_steps+
   ' cardinal steps while staying concealed. Nearby monsters may detect you.';
  success=true;
 }else if(skill==='camping'){
  if(c.form!=='living'||c.crafting?.incapacitated)
   throw Error('Only a conscious living character can make camp');
  if(c.area_id===TEMPLE||!traversable(next.areas[c.area_id],c.x,c.y,'living'))
   throw Error('You must camp on safe outdoor ground');
  if(c.fieldcraft.camp_until_minute>minute)
   throw Error('Your camp is already established');
  if(nearest(next,c,['monster'],6))
   throw Error('Dangerous creatures are too close to make camp');
  if((c.inventory?.wood||0)<1)
   throw Error('You need wood to set up a camp');
  c.inventory.wood--;
  ENTITIES.reconcile(next);
  c.crafting.energy=Math.min(100,c.crafting.energy+25);
  c.crafting.health=Math.min(100,c.crafting.health+5);
  c.fieldcraft.camp_until_minute=minute+30;
  c.fieldcraft.hidden_until_minute=-1;c.fieldcraft.stealth_steps=0;
  text='You set up a temporary camp and recover health and energy.';success=true;
 }else if(skill==='tracking'){
  target=nearest(next,c,['monster','npc'],RANGE);
  text=target?'You detect '+(target.name||target.kind||target.id)+
   ' toward the '+labelDirection(c,target)+', '+distance(c,target)+' tiles away.':
   'No nearby tracks are fresh enough to follow.';
  success=!!target;
 }else if(skill==='anatomy'){
  target=nearest(next,c,['monster','npc'],2);
  text=target?'You examine '+(target.name||target.kind||target.id)+
   ': '+target.health+' health remaining.':'Move beside a living creature to examine it.';
  success=!!target;
 }else if(skill==='animal_lore'){
  target=nearest(next,c,['pet','monster'],2);
  if(target){
   const loyalty=target.targetKind==='pet'?' · loyalty '+target.loyalty:'';
   text='The '+target.kind+' has '+target.health+' health'+loyalty+'.';
   success=true;
  }else text='Move beside an animal to study it.';
 }else if(skill==='forensic_evaluation'){
  target=nearest(next,c,['corpse'],2);
  const stage=target?DECAY.stageAt(target,minute):null;
  text=target?'The remains of '+target.name+' are '+stage+
   ', approximately '+(minute-target.created_minute)+' world minutes old.':
   'There are no nearby remains to examine.';
  success=!!target;
 }else if(skill==='meditation'){
  if(c.form!=='living')throw Error('Ghosts cannot recover a living mana reserve');
  if(!c.magic||c.magic.mana>=c.magic.max_mana)
   throw Error('Your magical reserve is already full');
  const amount=3+Math.floor((c.skillbook.skills.meditation?.value||0)/200);
  c.magic.mana=Math.min(c.magic.max_mana,c.magic.mana+amount);
  text='You meditate and restore '+amount+' mana.';success=true;
 }else if(skill==='spirit_speak'){
  const lost=Object.values(l.mobile_assets?.corpses||{})
   .filter(body=>body.area_id===c.area_id&&distance(c,body)<=RANGE).length;
  text=lost?'You sense '+lost+' lingering spirit'+(lost===1?'':'s')+' nearby.':
   'The nearby spirit world is silent.';
  success=lost>0||c.form==='ghost';
 }
 c.fieldcraft.last_use_minute=minute;c.fieldcraft.last_skill=skill;
 let gain=null;
 if(success)gain=SKILLS.practice(c,skill,minute,
  'field:'+(target?.id||c.area_id+':'+Math.floor(c.x/8)+':'+Math.floor(c.y/8)));
 c.revision++;next.revision++;
 const e={id:'event_'+(++l.event_sequence),minute,type:'player.skill.'+skill,
  text,slot:1,area_id:c.area_id,success,
  target_id:target?.id||null,gained:gain?.gained||0};
 l.events.push(e);if(l.events.length>512)l.events.shift();
 validate(c);SKILLS.validate(c);
 return {world:next,character:c,event:e};
}

function onMove(world,character){
 const state=character?.fieldcraft;
 if(!state)return null;
 ensure(character);
 const minute=world.living.minute;
 if(state.camp_until_minute>minute)state.camp_until_minute=-1;
 if(state.hidden_until_minute<=minute){
  state.hidden_until_minute=-1;state.stealth_steps=0;return null;
 }
 if(state.stealth_steps<=0){
  state.hidden_until_minute=-1;return null;
 }
 const level=character.skillbook?.skills?.stealth?.value||0;
 const detectRange=Math.max(2,5-Math.floor(level/250));
 const spotted=nearest(world,character,['monster'],detectRange);
 state.stealth_steps--;
 if(spotted||state.stealth_steps===0){
  state.hidden_until_minute=-1;state.stealth_steps=0;
  const l=world.living,e={id:'event_'+(++l.event_sequence),minute,
   type:spotted?'player.stealth.detected':'player.stealth.exhausted',
   text:spotted?'A nearby monster spotted your movement.':'You emerged from concealment.',
   area_id:character.area_id,slot:1,creature_id:spotted?.id||null};
  l.events.push(e);if(l.events.length>512)l.events.shift();
  return e;
 }
 SKILLS.practice(character,'stealth',minute,
  'sneak:'+character.area_id+':'+Math.floor(character.x/8)+':'+Math.floor(character.y/8));
 return null;
}
module.exports={ALLOWED,RANGE,COOLDOWN,ensure,validate,apply,nearest,labelDirection,onMove};
