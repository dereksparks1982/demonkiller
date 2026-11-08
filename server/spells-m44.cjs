'use strict';
// DK Server M44: server-authoritative early spellbook and mana.
// No resurrection spell: the temple soul crystal remains the one resurrection gate.
const SKILLS=require('./skills-m14.cjs');
const COMBAT=require('./combat-m8.cjs');
const SPELLS=Object.freeze({
 magic_arrow:Object.freeze({name:'Magic Arrow',mana:5,herbs:1,skill:0,
  range:6,damage:7,target:'monster'}),
 fireball:Object.freeze({name:'Fireball',mana:13,herbs:2,skill:100,
  range:5,damage:18,target:'monster'}),
 heal:Object.freeze({name:'Heal',mana:8,herbs:1,skill:0,
  range:0,heal:18,target:'self'}),
 protection:Object.freeze({name:'Protection',mana:10,herbs:1,skill:80,
  range:0,duration:60,target:'self'}),
 night_sight:Object.freeze({name:'Night Sight',mana:4,herbs:0,skill:0,
  range:0,duration:180,target:'self'})
});
const MAX_MANA=60,COOLDOWN=1400;
function ensure(character){
 if(!character)return false;
 if(character.magic)return false;
 character.magic={schema:1,mana:40,max_mana:40,last_cast_utc_ms:0,
  protection_until_minute:-1,night_sight_until_minute:-1};
 return true;
}
function validate(character){
 const m=character?.magic;if(!m)return true;
 if(m.schema!==1||!Number.isSafeInteger(m.mana)||m.mana<0||
  !Number.isSafeInteger(m.max_mana)||m.max_mana<1||m.max_mana>MAX_MANA||
  m.mana>m.max_mana||
  !Number.isSafeInteger(m.last_cast_utc_ms)||m.last_cast_utc_ms<0||
  !Number.isSafeInteger(m.protection_until_minute)||m.protection_until_minute < -1||
  !Number.isSafeInteger(m.night_sight_until_minute)||m.night_sight_until_minute < -1)
  throw Error('Invalid persisted spellbook mana state');
 return true;
}
function distance(a,b){return Math.abs(a.x-b.x)+Math.abs(a.y-b.y);}
function lineOfSight(area,a,b){
 if(a.x!==b.x&&a.y!==b.y)return false; // Cardinal-only spell beams.
 const dx=Math.sign(b.x-a.x),dy=Math.sign(b.y-a.y);
 let x=a.x+dx,y=a.y+dy;
 while(x!==b.x||y!==b.y){
  if(x<0||y<0||x>=area.width||y>=area.height)return false;
  const i=y*area.width+x;
  if(area.walls[i]||['roof','temple_roof'].includes(area.floor[i]))return false;
  x+=dx;y+=dy;
 }
 return true;
}
function apply(world,command,now=Date.now()){
 const names=Object.keys(command||{}).sort().join(',');
 if(!command||typeof command!=='object'||Array.isArray(command)||
  command.action!=='cast_spell'||!SPELLS[command.spell]||
  (names!=='action,spell'&&names!=='action,spell,target_id'))
  throw Error('Invalid spell-cast action');
 if(!world.runtime?.running)throw Error('World is paused');
 const origin=world.characters?.['1'];
 if(!origin||origin.form!=='living')throw Error('Only a living character can cast spells');
 if(origin.crafting?.incapacitated)throw Error('You cannot cast while unconscious');
 if(!Number.isSafeInteger(now)||now<0)throw Error('Invalid spell clock');
 const recipe=SPELLS[command.spell];
 if((recipe.target==='self'&&command.target_id!==undefined)||
  (recipe.target==='monster'&&typeof command.target_id!=='string'))
  throw Error('Invalid spell target');
 const next=structuredClone(world),c=next.characters['1'],minute=next.living.minute;
 ensure(c);SKILLS.ensure(c);
 const m=c.magic,level=c.skillbook.skills.magery.value;
 if(level<recipe.skill)throw Error('Your Magery skill is too low for this spell');
 if(now-m.last_cast_utc_ms<COOLDOWN)throw Error('Wait before casting another spell');
 if(m.mana<recipe.mana)throw Error('You do not have enough mana');
 if((c.inventory?.herbs||0)<recipe.herbs)throw Error('You need more herbal reagents');
 let target=null,damage=0,healed=0;
 if(recipe.target==='monster'){
  target=next.living.combat?.creatures[command.target_id];
  if(!target?.alive||target.area_id!==c.area_id||
    distance(c,target)>recipe.range||!lineOfSight(next.areas[c.area_id],c,target))
   throw Error('A living monster must be within cardinal line of sight');
 }else if(command.spell==='heal'){
  if(c.crafting.health>=100)throw Error('You are already at full health');
 }else if(command.spell==='protection'){
  if(m.protection_until_minute>minute)throw Error('Protection is already active');
 }else if(command.spell==='night_sight'){
  if(m.night_sight_until_minute>minute)throw Error('Night Sight is already active');
 }
 m.mana-=recipe.mana;m.last_cast_utc_ms=now;c.inventory.herbs-=recipe.herbs;
 const events=[];
 if(target){
  damage=recipe.damage+Math.floor(level/250);
  target.health=Math.max(0,target.health-damage);
  if(!target.health)COMBAT.dead(next,target,minute,events,'player');
 }else if(command.spell==='heal'){
  healed=Math.min(100-c.crafting.health,recipe.heal+Math.floor(level/200));
  c.crafting.health+=healed;
  SKILLS.practice(c,'healing',minute,'spell:heal:'+Math.floor(c.crafting.health/10));
 }else if(command.spell==='protection'){
  m.protection_until_minute=minute+recipe.duration;
 }else if(command.spell==='night_sight'){
  m.night_sight_until_minute=minute+recipe.duration;
 }
 const gain=SKILLS.practice(c,'magery',minute,
  'spell:'+command.spell+':'+(target?.id||c.area_id));
 if(command.spell==='protection')
  SKILLS.practice(c,'resisting_spells',minute,'ward:'+c.area_id);
 c.revision++;next.revision++;
 const event={id:'event_'+(++next.living.event_sequence),minute,
  type:'player.spell.'+command.spell,slot:1,area_id:c.area_id,
  text:'The character cast '+recipe.name+'.',
  spell:command.spell,target_id:target?.id||null,damage,healed,
  mana_remaining:m.mana,skill_gain:gain.gained};
 next.living.events.push(event);
 if(next.living.events.length>512)next.living.events.shift();
 validate(c);SKILLS.validate(c);
 return {world:next,character:c,event,events:[...events,event]};
}
function tick(world,minute){
 const c=world.characters?.['1'];if(!c)return false;
 ensure(c);
 if(minute%5!==0||c.magic.mana>=c.magic.max_mana)return false;
 c.magic.mana=Math.min(c.magic.max_mana,c.magic.mana+1+
  Math.floor((c.skillbook?.skills?.meditation?.value||0)/300));
 return true;
}
function publicRecord(character,minute=0){
 if(!character)return null;
 ensure(character);SKILLS.ensure(character);
 return {mana:character.magic.mana,max_mana:character.magic.max_mana,
  protection_until_minute:character.magic.protection_until_minute,
  night_sight_until_minute:character.magic.night_sight_until_minute,
  world_minute:minute,
  spells:Object.fromEntries(Object.entries(SPELLS).map(([id,s])=>[id,
   {name:s.name,mana:s.mana,reagents:{herbs:s.herbs},
    min_magery:s.skill,range:s.range,target:s.target,
    learned:character.skillbook.skills.magery.value>=s.skill}]))};
}
module.exports={SPELLS,MAX_MANA,COOLDOWN,ensure,validate,lineOfSight,apply,tick,publicRecord};
