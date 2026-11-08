'use strict';
// DK Server M8: server-owned monster presence, combat and persistent ground loot.
// Only the server decides health, attack distance, drops and region cleansing.
const {COURT,VILLAGE,traversable}=require('./regions.cjs');
const {chooseStep}=require('./npc-navigation-m6.cjs');
const SKILLS=require('./skills-m14.cjs');
const CREATURES=require('./creatures-m42.cjs');
const SPAWNERS=require('./spawners-m59.cjs');
const GUARDS=require('./guard-watch-m61.cjs');
const MONSTER_AI=require('./monster-ai-m60.cjs');
const BOUNTIES=require('./bounties-m45.cjs');
const COMPANIONS=require('./companions-m46.cjs');
const ARMORY=require('./armory-m54.cjs');
const ENTITIES=require('./entity-registry-m10.cjs');
const {onDeath:recordMobileDeath,onCreatureDeath:recordMonsterRemains}=require('./mobile-assets-m12.cjs');
const MAX_CREATURES=48,MAX_DROPS=2048;
function seed(){return {schema:1,sequence:0,creatures:{},drops:{}};}
function ensure(world){
 if(!world.living.combat){world.living.combat=seed();return true;}
 let migrated=false;
 for(const m of Object.values(world.living.combat.creatures||{}))
  if(MONSTER_AI.ensure(m,world.living.minute))migrated=true;
 return migrated;
}
function validate(world){
 const s=world.living?.combat;if(!s)return true;
 if(s.schema!==1||!Number.isSafeInteger(s.sequence)||s.sequence<0||
  !s.creatures||!s.drops||Object.keys(s.creatures).length>MAX_CREATURES||
  Object.keys(s.drops).length>MAX_DROPS)throw Error('Invalid combat world');
 for(const c of Object.values(s.creatures)){
  const a=world.areas[c?.area_id];
  if(!c||!CREATURES.KINDS[c.kind]||!new RegExp('^'+c.kind+'_[0-9]+$').test(c.id)||!a||
   !Number.isInteger(c.x)||!Number.isInteger(c.y)||c.x<0||c.y<0||
   c.x>=a.width||c.y>=a.height||!Number.isInteger(c.health)||
   c.health<0||c.health>CREATURES.config(c.kind).health||typeof c.alive!=='boolean')
   throw Error('Invalid monster record');
 }
 for(const d of Object.values(s.drops)){
  const a=world.areas[d?.area_id];
  if(!d||!/^drop_[0-9]+$/.test(d.id)||!a||
   !Number.isInteger(d.x)||!Number.isInteger(d.y)||d.x<0||d.y<0||
   d.x>=a.width||d.y>=a.height||!Number.isSafeInteger(d.gold)||
   d.gold<0||d.gold>100||!['ore','herbs','wood'].includes(d.item))
   throw Error('Invalid ground loot');
 }
 MONSTER_AI.valid(world);
 return true;
}
function event(world,minute,type,text,details={}){
 const l=world.living,e={id:'event_'+(++l.event_sequence),minute,type,text,...details};
 l.events.push(e);if(l.events.length>512)l.events.shift();
 return e;
}
function distance(a,b){return Math.abs(a.x-b.x)+Math.abs(a.y-b.y);}
function bowLineClear(area,a,b){
 if(a.x!==b.x&&a.y!==b.y)return false;
 const dx=Math.sign(b.x-a.x),dy=Math.sign(b.y-a.y);
 let x=a.x+dx,y=a.y+dy;
 while(x!==b.x||y!==b.y){
  if(!traversable(area,x,y,'living'))return false;
  x+=dx;y+=dy;
 }
 return true;
}
function findOpen(world,area_id,x,y,occupied=new Set()){
 const area=world.areas[area_id];
 if(!area)return null;
 for(let radius=0;radius<=12;radius++)for(let dy=-radius;dy<=radius;dy++)
  for(let dx=-radius;dx<=radius;dx++){
   if(Math.abs(dx)+Math.abs(dy)!==radius)continue;
   const tx=x+dx,ty=y+dy;
   if(!traversable(area,tx,ty,'living')||occupied.has(tx+','+ty))continue;
   const p=world.characters?.['1'];
   if(p?.area_id===area_id&&p.x===tx&&p.y===ty)continue;
   if(Object.values(world.living.npcs||{}).some(n=>
    n.alive&&n.area_id===area_id&&n.x===tx&&n.y===ty))continue;
   return {x:tx,y:ty};
  }
 return null;
}
function spawn(world,area_id,minute,events,count,kind='imp'){
 const type=CREATURES.config(kind);
 const s=world.living.combat,area=world.areas[area_id];
 if(!area)return 0;
 const points=kind==='imp'?(area_id===COURT?[[15,18],[48,18],[32,6]]:
   [[65,84],[38,94],[94,100],[64,112],[30,70]]):CREATURES.spawnPoints(area_id);
 const occupied=new Set(Object.values(s.creatures).filter(c=>c.alive&&
  c.area_id===area_id).map(c=>c.x+','+c.y));
 let created=0;
 for(let i=0;i<count&&Object.keys(s.creatures).length<MAX_CREATURES;i++){
  const [x,y]=points[i%points.length],pt=findOpen(world,area_id,x,y,occupied);
  if(!pt)continue;
  occupied.add(pt.x+','+pt.y);created++;
  const id=kind+'_'+(++s.sequence);
  s.creatures[id]={id,kind,area_id,x:pt.x,y:pt.y,
   health:type.health,alive:true,spawn_minute:minute,last_attack_minute:-1};
  MONSTER_AI.ensure(s.creatures[id],world.living.minute);
  events.push(event(world,minute,'monster.spawn',type.name+' entered '+area_id+'.',
   {creature_id:id,area_id,x:pt.x,y:pt.y}));
 }
 return created;
}
function dead(world,creature,minute,events,killer='world'){
 const s=world.living.combat;creature.health=0;creature.alive=false;
 const id='drop_'+(++s.sequence);
 s.drops[id]={id,area_id:creature.area_id,x:creature.x,y:creature.y,
  gold:creature.kind==='imp'?2+creature.id.length%5:CREATURES.config(creature.kind).gold,
  item:creature.kind==='imp'?(creature.id.length%2===0?'herbs':'ore'):
   CREATURES.config(creature.kind).loot,
  dropped_minute:minute};
 delete s.creatures[creature.id];
 const corpse=recordMonsterRemains(world,creature,minute,events);
 if(killer==='player')BOUNTIES.onKill(world,creature,minute,events);
 events.push(event(world,minute,'monster.defeated',CREATURES.config(creature.kind).name+' was defeated.',
  {creature_id:creature.id,drop_id:id,corpse_id:corpse?.id||null,area_id:creature.area_id}));
 const terr=world.living.territories[creature.area_id];
 if(terr?.control==='monsters'&&!Object.values(s.creatures).some(c=>c.alive&&c.area_id===creature.area_id)){
  terr.control='settlers';terr.threat=2;terr.last_raid=minute;
  SPAWNERS.suppressAfterLiberation(world,creature.area_id,minute);
  events.push(event(world,minute,'territory.liberated',
   'The last imp was driven from '+creature.area_id+'.',
   {area_id:creature.area_id,control:'settlers'}));
 }
}
function tick(world,minute,events){
 const l=world.living;
 if(!l?.combat)return;
 SPAWNERS.tick(world,minute,events,spawn);
 if(minute%5!==0)return;
 const c=world.characters['1'];
 for(const monster of Object.values(l.combat.creatures)){
  if(!monster.alive)continue;
  const nearby=Object.values(l.npcs).filter(n=>n.alive&&
   n.area_id===monster.area_id&&CREATURES.canSense(monster,n));
  const guards=nearby.filter(n=>n.role==='guard'||n.role==='escort');
  const decision=MONSTER_AI.decide(world,monster,minute,events);
  const target=decision.target;
  const player=decision.targetType==='player'?c:null;
  const nearestPet=decision.targetType==='pet'?target:null;
  if(decision.mode==='retreat'&&decision.threat){
   const escape=MONSTER_AI.retreatStep(world,monster,decision.threat);
   if(escape){monster.x=escape.x;monster.y=escape.y;}
  }else if(decision.goal&&distance(monster,decision.goal)>1){
   const step=chooseStep(world,monster,decision.goal);
   if(step?.area_id===monster.area_id&&
    !MONSTER_AI.occupied(world,monster,step.x,step.y)){
    monster.x=step.x;monster.y=step.y;
   }
  }else if(decision.mode==='patrol'){
   const walk=MONSTER_AI.patrolStep(world,monster,minute);
   if(walk){monster.x=walk.x;monster.y=walk.y;}
  }
  if(target&&decision.mode==='pursue'&&distance(target,monster)<=1){
   let damage=CREATURES.damage(monster.kind,player===target?'player':'guard');
   if(player===target&&c.magic?.protection_until_minute>minute)
    damage=Math.max(1,Math.floor(damage/2));
   if(player===target){
    damage=ARMORY.defend(world,c,damage,events,monster.id);
    c.crafting.health=Math.max(0,c.crafting.health-damage);
    if(c.crafting.health===0&&!c.crafting.incapacitated){
     c.crafting.incapacitated=true;
     events.push(event(world,minute,'player.incapacitated',
      'A monster knocked the character unconscious.',{area_id:c.area_id}));
    }
   }else if(target===nearestPet){
    COMPANIONS.attacked(world,target,damage,minute,events);
   }else{
    target.health=Math.max(0,target.health-damage);
    if(target.health===0){
     target.alive=false;
     recordMobileDeath(world,target,minute,events);
     events.push(event(world,minute,'npc.death',
      target.name+' was slain by an imp.',{npc_id:target.id,area_id:target.area_id}));
    }
   }
   monster.last_attack_minute=minute;
   events.push(event(world,minute,'monster.attack',CREATURES.config(monster.kind).name+' attacked.',
    {creature_id:monster.id,area_id:monster.area_id,target:player===target?'player':target.id,
      damage}));
  }
  // Guard duty runs once per world combat tick, not once per monster.
 }
 GUARDS.tick(world,minute,events,dead);
}
function apply(world,command,now=Date.now()){
 const expected={attack:'action,target_id',loot:'action,drop_id'};
 if(!command||typeof command!=='object'||Array.isArray(command)||
  !Object.hasOwn(expected,command.action)||
  Object.keys(command).sort().join(',')!==expected[command.action])
  throw Error('Invalid combat action');
 if(!world.runtime?.running)throw Error('World is paused');
 const original=world.characters['1'];
 if(!original)throw Error('No character exists');
 if(original.form!=='living')throw Error('Ghosts cannot fight or gather physical loot');
 if(original.crafting?.incapacitated)throw Error('You are unconscious');
 const next=structuredClone(world),c=next.characters['1'],s=next.living.combat;
 if(!s)throw Error('Combat is not initialized');
 const minute=next.living.minute;
 const events=[];
 if(command.action==='attack'){
  if(typeof command.target_id!=='string'||!/^[a-z]+_[0-9]+$/.test(command.target_id))
   throw Error('Invalid creature target');
  const enemy=s.creatures[command.target_id],weapon=ARMORY.equipped(next,c,'weapon');
  const range=weapon?.range||1,dist=enemy?distance(enemy,c):Infinity;
  if(!enemy?.alive||enemy.area_id!==c.area_id||dist<1||dist>range)
   throw Error(range>1?'Move within weapon range':'Move beside a living monster');
  if(weapon?.type==='bow'&&!bowLineClear(next.areas[c.area_id],c,enemy))
   throw Error('A bow requires cardinal line of sight');
  if(weapon?.type==='bow'&&!(c.inventory?.arrows>0))
   throw Error('You have no arrows');
  if(!Number.isFinite(now)||now<0)throw Error('Invalid attack clock');
  if(c.last_attack_utc_ms!==undefined&&now-c.last_attack_utc_ms<900)
   throw Error('You must wait before striking again');
  c.last_attack_utc_ms=now;
  if(c.fieldcraft){
   c.fieldcraft.hidden_until_minute=-1;c.fieldcraft.stealth_steps=0;
  }
  const skill=weapon?.skill||(c.crafting?.hand==='tools'?'swordsmanship':'wrestling');
  const mastery=c.skillbook?.skills?.[skill]?.value||0;
  const tactics=c.skillbook?.skills?.tactics?.value||0;
  const damage=(weapon?.damage||(c.crafting?.hand==='tools'?8:5))+
   Math.floor((mastery+tactics)/400);
  if(weapon?.type==='bow')c.inventory.arrows--;
  enemy.health=Math.max(0,enemy.health-damage);
  if(weapon)ARMORY.wear(next,c,'weapon',1,events);
  if(weapon?.type==='bow')ENTITIES.reconcile(next);
  c.skills.combat=(c.skills.combat||0)+1;
  SKILLS.practice(c,skill,minute,'monster:'+enemy.id);
  SKILLS.practice(c,'tactics',minute,'combat:'+enemy.id);
  SKILLS.practice(c,'anatomy',minute,'opponent:'+enemy.kind);
  events.push(event(next,minute,'player.attack','The character struck '+CREATURES.config(enemy.kind).name+'.',
   {creature_id:enemy.id,damage,area_id:c.area_id,weapon:weapon?.type||null,
    ranged:weapon?.type==='bow'}));
  if(enemy.health===0)dead(next,enemy,minute,events,'player');
 }else{
  if(typeof command.drop_id!=='string'||!/^drop_[0-9]+$/.test(command.drop_id))
   throw Error('Invalid loot target');
  const drop=s.drops[command.drop_id];
  if(!drop||drop.area_id!==c.area_id||distance(drop,c)>1)
   throw Error('Move beside the ground loot');
  if(Object.values(c.inventory).reduce((sum,n)=>sum+n,0)>=200||
   (c.inventory[drop.item]||0)>=200)throw Error('Your pack is full');
  c.gold+=drop.gold;c.inventory[drop.item]++;
  delete s.drops[drop.id];
  events.push(event(next,minute,'player.loot','The character collected monster loot.',
   {drop_id:drop.id,area_id:c.area_id,gold:drop.gold,item:drop.item}));
 }
 c.revision++;next.revision++;
 validate(next);
 return {world:next,character:c,event:events.at(-1),events};
}
module.exports={seed,ensure,validate,tick,apply,spawn,findOpen,dead};
