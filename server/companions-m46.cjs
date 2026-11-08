'use strict';
// M46 one real server-owned animal companion. Taming consumes food, requires
// a weakened wolf, and grants no pet unless world-state validation succeeds.
const {COURT,VILLAGE,traversable}=require('./regions.cjs');
const CREATURES=require('./creatures-m42.cjs');
const SKILLS=require('./skills-m14.cjs');
const {chooseStep}=require('./npc-navigation-m6.cjs');
const {onCreatureDeath}=require('./mobile-assets-m12.cjs');
const MAX_PETS=1,MODES=Object.freeze(['follow','stay','guard']);
function ensure(world){
 if(!world.living)throw Error('Companions require a living world');
 if(world.living.companions)return false;
 world.living.companions={schema:1,pets:{},sequence:0,last_tame_minute:-10};
 return true;
}
function validate(world){
 const s=world.living?.companions;if(!s)return true;
 if(s.schema!==1||!s.pets||Array.isArray(s.pets)||
  Object.keys(s.pets).length>MAX_PETS||
  !Number.isSafeInteger(s.sequence)||s.sequence<0||
  !Number.isSafeInteger(s.last_tame_minute)||s.last_tame_minute<-10)
  throw Error('Invalid companion world');
 for(const pet of Object.values(s.pets)){
  const area=world.areas[pet?.area_id];
  if(!pet||!/^pet_wolf_[0-9]+$/.test(pet.id)||
   pet.kind!=='wolf'||pet.owner_slot!==1||
   !area||![COURT,VILLAGE].includes(pet.area_id)||
   !Number.isInteger(pet.x)||!Number.isInteger(pet.y)||
   pet.x<0||pet.y<0||pet.x>=area.width||pet.y>=area.height||
   !Number.isInteger(pet.health)||pet.health<0||pet.health>24||
   typeof pet.alive!=='boolean'||!MODES.includes(pet.mode)||
   !Number.isInteger(pet.loyalty)||pet.loyalty<0||pet.loyalty>100)
   throw Error('Invalid companion mobile record');
 }
 return true;
}
function emit(world,minute,type,text,extra={},out=null){
 const l=world.living,e={id:'event_'+(++l.event_sequence),minute,type,text,...extra};
 l.events.push(e);if(l.events.length>512)l.events.shift();
 if(out)out.push(e);return e;
}
function distance(a,b){return Math.abs(a.x-b.x)+Math.abs(a.y-b.y);}
function apply(world,command){
 const action=command?.action;
 const spec={
  tame_creature:'action,target_id',
  feed_pet:'action,pet_id',release_pet:'action,pet_id',
  pet_follow:'action,pet_id',pet_stay:'action,pet_id',pet_guard:'action,pet_id'
 };
 if(!command||typeof command!=='object'||Array.isArray(command)||
  !Object.hasOwn(spec,action)||
  Object.keys(command).sort().join(',')!==spec[action])
  throw Error('Invalid companion command');
 if(!world.runtime?.running)throw Error('World is paused');
 const old=world.characters?.['1'];
 if(!old||old.form!=='living'||old.crafting?.incapacitated)
  throw Error('Only a conscious living character can handle animals');
 const next=structuredClone(world),c=next.characters['1'],l=next.living,minute=l.minute;
 ensure(next);SKILLS.ensure(c);
 const state=l.companions,pets=state.pets;
 let result=null;
 if(action==='tame_creature'){
  if(Object.keys(pets).length>=MAX_PETS)
   throw Error('Your companion slot is full');
  if(minute<state.last_tame_minute+10)
   throw Error('You must wait before attempting to tame another animal');
  if(typeof command.target_id!=='string'||!/^wolf_[0-9]+$/.test(command.target_id))
   throw Error('Only weakened wolves can be tamed');
  const enemy=l.combat.creatures[command.target_id];
  if(!enemy||enemy.kind!=='wolf'||!enemy.alive||enemy.area_id!==c.area_id||
   distance(enemy,c)>1)
   throw Error('Move beside a living wolf before attempting to tame it');
  if(enemy.health>12)throw Error('The wolf must be weakened below half health');
  if((c.inventory?.produce||0)<1)throw Error('Taming requires one serving of food');
  c.inventory.produce--;
  state.last_tame_minute=minute;
  const skill=c.skillbook.skills.animal_taming.value;
  const roll=(minute*17+enemy.id.length*13+enemy.health*11) % 100;
  const chance=Math.min(95,50+Math.floor(skill/20));
  if(roll>=chance){
   result=emit(next,minute,'companion.tame.failed',
    'The wolf refused the offered food and remained wild.',
    {creature_id:enemy.id,chance});
  }else{
   const id='pet_wolf_'+(++state.sequence);
   pets[id]={id,kind:'wolf',owner_slot:1,area_id:enemy.area_id,
    x:enemy.x,y:enemy.y,health:enemy.health,alive:true,
    mode:'follow',loyalty:70};
   delete l.combat.creatures[enemy.id];
   SKILLS.practice(c,'animal_taming',minute,'wolf:'+enemy.id);
   result=emit(next,minute,'companion.tamed',
    'You earned the trust of a wolf. It follows you as a living companion.',
    {pet_id:id,creature_id:enemy.id});
  }
 }else{
  const pet=pets[command.pet_id];
  if(!pet?.alive||pet.area_id!==c.area_id||distance(pet,c)>2)
   throw Error('Move near your living companion first');
  if(action==='feed_pet'){
   if((c.inventory?.produce||0)<1)throw Error('You need food to feed your companion');
   if(pet.health>=24&&pet.loyalty>=100)
    throw Error('Your companion has no need for food');
   c.inventory.produce--;
   pet.health=Math.min(24,pet.health+7);
   pet.loyalty=Math.min(100,pet.loyalty+8);
   SKILLS.practice(c,'veterinary',minute,'pet:'+pet.id);
   result=emit(next,minute,'companion.fed','Your wolf ate and recovered.',
    {pet_id:pet.id,health:pet.health,loyalty:pet.loyalty});
  }else if(action==='release_pet'){
   const spawnId='wolf_'+(++l.combat.sequence);
   l.combat.creatures[spawnId]={id:spawnId,kind:'wolf',area_id:pet.area_id,
    x:pet.x,y:pet.y,health:pet.health,alive:true,
    spawn_minute:minute,last_attack_minute:-1};
   delete pets[pet.id];
   result=emit(next,minute,'companion.released',
    'You released your wolf to the wild.',{pet_id:pet.id,creature_id:spawnId});
  }else{
   pet.mode=action.slice(4);
   result=emit(next,minute,'companion.command',
    'Your wolf was commanded to '+pet.mode+'.',{pet_id:pet.id,mode:pet.mode});
  }
 }
 c.revision++;next.revision++;validate(next);SKILLS.validate(c);
 return {world:next,character:c,event:result};
}
function tick(world,minute,out,killMonster){
 const state=world.living?.companions;
 if(!state||minute%5!==0)return;
 const player=world.characters?.['1'];
 for(const pet of Object.values(state.pets)){
  if(!pet.alive)continue;
  if(player?.form==='living'&&pet.mode!=='stay'&&
    [COURT,VILLAGE].includes(player.area_id)){
   if(pet.area_id!==player.area_id||distance(pet,player)>2){
    const next=chooseStep(world,pet,{area_id:player.area_id,x:player.x,y:player.y});
    if(next&&world.areas[next.area_id]&&
      traversable(world.areas[next.area_id],next.x,next.y,'living')){
      pet.area_id=next.area_id;pet.x=next.x;pet.y=next.y;
    }
   }
  }
  if(pet.mode==='stay')continue;
  const enemy=Object.values(world.living.combat?.creatures||{}).filter(monster=>
   monster.alive&&monster.area_id===pet.area_id&&distance(monster,pet)<=1)
   .sort((a,b)=>a.id.localeCompare(b.id))[0];
  if(!enemy)continue;
  enemy.health=Math.max(0,enemy.health-3);
  if(!enemy.health&&killMonster)killMonster(world,enemy,minute,out);
  emit(world,minute,'companion.defend',
   'A tamed wolf defended its owner.',{pet_id:pet.id,creature_id:enemy.id},out);
 }
}
function attacked(world,pet,damage,minute,out){
 pet.health=Math.max(0,pet.health-damage);
 if(pet.health===0&&pet.alive){
  pet.alive=false;
  onCreatureDeath(world,{id:pet.id,kind:'wolf',area_id:pet.area_id,x:pet.x,y:pet.y},minute,out);
  emit(world,minute,'companion.death','The tamed wolf fell in battle.',
   {pet_id:pet.id},out);
  delete world.living.companions.pets[pet.id];
 }
}
function listing(world){
 const s=world.living?.companions;
 return {world_minute:world.living?.minute||0,max_pets:MAX_PETS,
  pets:Object.values(s?.pets||{}).map(x=>({...x})),
  can_tame:!s||Object.keys(s.pets).length<MAX_PETS};
}
module.exports={MAX_PETS,MODES,ensure,validate,apply,tick,attacked,listing};
