'use strict';
// M43: UO-style usable field skills tied to real world state, not free levels.
// No copied RunUO code. Every success/failure is decided by the server.
const SKILLS=require('./skills-m14.cjs');
const DECAY=require('./corpse-decay-m29.cjs');
const ALLOWED=Object.freeze(['tracking','hiding','anatomy',
 'forensic_evaluation','meditation','spirit_speak','animal_lore']);
const RANGE=12,COOLDOWN=5;
function ensure(character){
 if(!character)return false;
 if(character.fieldcraft)return false;
 character.fieldcraft={schema:1,hidden_until_minute:-1,last_use_minute:-COOLDOWN,
  last_skill:null};return true;
}
function validate(character){
 const f=character?.fieldcraft;
 if(!f)return true;
 if(f.schema!==1||!Number.isSafeInteger(f.hidden_until_minute)||
  f.hidden_until_minute < -1||!Number.isSafeInteger(f.last_use_minute)||
  f.last_use_minute< -COOLDOWN||
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
 if(c.fieldcraft.last_use_minute+COOLDOWN>minute)
  throw Error('Wait for your skill cooldown');
 const skill=command.skill;
 let target=null,text='',success=false;
 if(skill==='hiding'){
  if(c.form!=='living')throw Error('Ghosts do not need concealment');
  if(c.crafting?.incapacitated)throw Error('You are unconscious');
  target=nearest(next,c,['monster'],6);
  if(target)throw Error('Too close to a monster to hide');
  c.fieldcraft.hidden_until_minute=minute+15;
  text='You slip out of sight for fifteen world minutes.';success=true;
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
module.exports={ALLOWED,RANGE,COOLDOWN,ensure,validate,apply,nearest,labelDirection};
