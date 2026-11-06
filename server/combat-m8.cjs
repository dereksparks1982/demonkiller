'use strict';
// DK Server M8: server-owned monster presence, combat and persistent ground loot.
// Only the server decides health, attack distance, drops and region cleansing.
const {COURT,VILLAGE,traversable}=require('./regions.cjs');
const {chooseStep}=require('./npc-navigation-m6.cjs');
const MAX_CREATURES=48,MAX_DROPS=2048;
function seed(){return {schema:1,sequence:0,creatures:{},drops:{}};}
function ensure(world){
 if(!world.living.combat){world.living.combat=seed();return true;}
 return false;
}
function validate(world){
 const s=world.living?.combat;if(!s)return true;
 if(s.schema!==1||!Number.isSafeInteger(s.sequence)||s.sequence<0||
  !s.creatures||!s.drops||Object.keys(s.creatures).length>MAX_CREATURES||
  Object.keys(s.drops).length>MAX_DROPS)throw Error('Invalid combat world');
 for(const c of Object.values(s.creatures)){
  const a=world.areas[c?.area_id];
  if(!c||!/^imp_[0-9]+$/.test(c.id)||c.kind!=='imp'||!a||
   !Number.isInteger(c.x)||!Number.isInteger(c.y)||c.x<0||c.y<0||
   c.x>=a.width||c.y>=a.height||!Number.isInteger(c.health)||
   c.health<0||c.health>30||typeof c.alive!=='boolean')
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
 return true;
}
function event(world,minute,type,text,details={}){
 const l=world.living,e={id:'event_'+(++l.event_sequence),minute,type,text,...details};
 l.events.push(e);if(l.events.length>512)l.events.shift();
 return e;
}
function distance(a,b){return Math.abs(a.x-b.x)+Math.abs(a.y-b.y);}
function findOpen(world,area_id,x,y){
 const area=world.areas[area_id];
 if(!area)return null;
 for(let radius=0;radius<=12;radius++)for(let dy=-radius;dy<=radius;dy++)
  for(let dx=-radius;dx<=radius;dx++){
   if(Math.abs(dx)+Math.abs(dy)!==radius)continue;
   const tx=x+dx,ty=y+dy;
   if(traversable(area,tx,ty,'living'))return {x:tx,y:ty};
  }
 return null;
}
function spawn(world,area_id,minute,events,count){
 const s=world.living.combat,area=world.areas[area_id];
 if(!area)return;
 const points=area_id===COURT?[[15,18],[48,18],[32,6]]:
   [[65,84],[38,94],[94,100],[64,112],[30,70]];
 for(let i=0;i<count&&Object.keys(s.creatures).length<MAX_CREATURES;i++){
  const [x,y]=points[i%points.length],pt=findOpen(world,area_id,x,y);
  if(!pt)continue;
  const id='imp_'+(++s.sequence);
  s.creatures[id]={id,kind:'imp',area_id,x:pt.x,y:pt.y,
   health:18,alive:true,spawn_minute:minute,last_attack_minute:-1};
  events.push(event(world,minute,'monster.spawn','An imp entered '+area_id+'.',
   {creature_id:id,area_id,x:pt.x,y:pt.y}));
 }
}
function dead(world,creature,minute,events){
 const s=world.living.combat;creature.health=0;creature.alive=false;
 const id='drop_'+(++s.sequence);
 s.drops[id]={id,area_id:creature.area_id,x:creature.x,y:creature.y,
  gold:2+creature.id.length%5,item:creature.id.length%2===0?'herbs':'ore',
  dropped_minute:minute};
 delete s.creatures[creature.id];
 events.push(event(world,minute,'monster.defeated','An imp was defeated.',
  {creature_id:creature.id,drop_id:id,area_id:creature.area_id}));
 const terr=world.living.territories[creature.area_id];
 if(terr?.control==='monsters'&&!Object.values(s.creatures).some(c=>c.alive&&c.area_id===creature.area_id)){
  terr.control='settlers';terr.threat=2;terr.last_raid=minute;
  events.push(event(world,minute,'territory.liberated',
   'The last imp was driven from '+creature.area_id+'.',
   {area_id:creature.area_id,control:'settlers'}));
 }
}
function tick(world,minute,events){
 const l=world.living;
 if(!l?.combat)return;
 for(const terr of Object.values(l.territories)){
  if(terr.control==='monsters'&&!Object.values(l.combat.creatures).some(c=>c.alive&&c.area_id===terr.id)){
   spawn(world,terr.id,minute,events,terr.id===COURT?3:5);
  }
 }
 if(minute%5!==0)return;
 const c=world.characters['1'];
 for(const monster of Object.values(l.combat.creatures)){
  if(!monster.alive)continue;
  const guards=Object.values(l.npcs).filter(n=>n.alive&&
   (n.role==='guard'||n.role==='escort')&&n.area_id===monster.area_id);
  const nearestGuard=guards.sort((a,b)=>distance(a,monster)-distance(b,monster))[0];
  const player=c?.form==='living'&&!c.crafting?.incapacitated&&
   c.area_id===monster.area_id?c:null;
  const target=player&&distance(player,monster)<=5?player:nearestGuard;
  if(!target)continue;
  if(distance(target,monster)>1){
   const step=chooseStep(world,monster,{area_id:monster.area_id,x:target.x,y:target.y});
   if(step?.area_id===monster.area_id){monster.x=step.x;monster.y=step.y;}
  }
  if(distance(target,monster)<=1){
   const damage=player===target?3:2;
   if(player===target){
    c.crafting.health=Math.max(0,c.crafting.health-damage);
    if(c.crafting.health===0&&!c.crafting.incapacitated){
     c.crafting.incapacitated=true;
     events.push(event(world,minute,'player.incapacitated',
      'A monster knocked the character unconscious.',{area_id:c.area_id}));
    }
   }else{
    target.health=Math.max(0,target.health-damage);
    if(target.health===0){
     target.alive=false;
     events.push(event(world,minute,'npc.death',
      target.name+' was slain by an imp.',{npc_id:target.id,area_id:target.area_id}));
    }
   }
   monster.last_attack_minute=minute;
   events.push(event(world,minute,'monster.attack','An imp attacked.',
    {creature_id:monster.id,area_id:monster.area_id,target:player===target?'player':target.id,
      damage}));
  }
  // Guards fight back when a monster is beside them.
  for(const guard of guards)if(guard.alive&&distance(guard,monster)<=1){
   monster.health=Math.max(0,monster.health-4);
   if(monster.health===0){dead(world,monster,minute,events);break;}
  }
 }
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
  if(typeof command.target_id!=='string'||!/^imp_[0-9]+$/.test(command.target_id))
   throw Error('Invalid creature target');
  const enemy=s.creatures[command.target_id];
  if(!enemy?.alive||enemy.area_id!==c.area_id||distance(enemy,c)>1)
   throw Error('Move beside a living monster');
  if(!Number.isFinite(now)||now<0)throw Error('Invalid attack clock');
  if(c.last_attack_utc_ms!==undefined&&now-c.last_attack_utc_ms<900)
   throw Error('You must wait before striking again');
  c.last_attack_utc_ms=now;
  const damage=c.crafting?.hand==='tools'?8:5;
  enemy.health=Math.max(0,enemy.health-damage);
  c.skills.combat=(c.skills.combat||0)+1;
  events.push(event(next,minute,'player.attack','The character struck an imp.',
   {creature_id:enemy.id,damage,area_id:c.area_id}));
  if(enemy.health===0)dead(next,enemy,minute,events);
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
module.exports={seed,ensure,validate,tick,apply,spawn,findOpen};
