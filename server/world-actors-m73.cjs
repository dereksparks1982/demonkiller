'use strict';
// M73: optional real-character presence and independent server NPCs on the
// original global atlas. Legacy area coordinates remain saved, untouched.
// No auto-population, no fabricated towns, no synthetic NPC cloning.
const GRID=require('./world-grid-m67.cjs');
const TERRAIN=require('./world-terrain-editor-m69.cjs');
const WALK=require('./world-walker-m72.cjs');
const GATHER=require('./atlas-gathering-m74.cjs');
const CONSTRUCTION=require('./atlas-construction-m75.cjs');
const BUILDINGS=require('./atlas-buildings-m76.cjs');
const ANCHOR=require('./world-anchor-m78.cjs');
const CACHES=require('./atlas-caches-m80.cjs');
const ROLES=new Set(['scout','guard','forager','worker']);
const DIRECTIONS=Object.freeze({north:[0,-1],east:[1,0],south:[0,1],west:[-1,0]});
const LIMIT=32,RADIUS=18,INTERVAL=4;
function positionValid(p){
 if(!p||Array.isArray(p)||typeof p!=='object'||
    Object.keys(p).sort().join(',')!=='facing,steps,x,y'||
    !Object.hasOwn(DIRECTIONS,p.facing)||
    !Number.isSafeInteger(p.steps)||p.steps<0)throw Error('Invalid atlas position');
 GRID.tile(p.x,p.y);
 return true;
}
function ensure(world){
 if(!world?.living)throw Error('Living world required');
 if(world.living.atlas_npcs===undefined){
  world.living.atlas_npcs={schema:1,sequence:0,
   last_minute:world.living.minute,records:{}};
  return true;
 }
 validate(world);
 return false;
}
function validate(world){
 const actor=world?.characters?.['1']?.atlas_position;
 if(actor!==undefined)positionValid(actor);
 const store=world?.living?.atlas_npcs;
 if(store===undefined)return true; // Pre-M73 saves are upgraded by ensure.
 if(!store||store.schema!==1||
   Object.keys(store).sort().join(',')!=='last_minute,records,schema,sequence'||
   !Number.isSafeInteger(store.sequence)||store.sequence<0||store.sequence>100000||
   !Number.isSafeInteger(store.last_minute)||store.last_minute<0||
   store.last_minute>world.living.minute||
   !store.records||typeof store.records!=='object'||Array.isArray(store.records))
  throw Error('Invalid atlas NPC registry');
 const entries=Object.entries(store.records);
 if(entries.length>LIMIT)throw Error('Too many atlas NPCs');
 const used=new Set();
 for(const [id,n] of entries){
  if(!/^atlas_npc_[1-9][0-9]{0,5}$/.test(id)||!n||n.id!==id||
   (Object.keys(n).sort().join(',')!==
    'alive,facing,home_x,home_y,id,name,role,steps,x,y'&&
    Object.keys(n).sort().join(',')!==
    'alive,coins,facing,home_x,home_y,id,name,role,steps,x,y')||
   (n.coins!==undefined&&(!Number.isSafeInteger(n.coins)||n.coins<0||n.coins>1e9))||
   typeof n.name!=='string'||!/^[A-Za-z][A-Za-z '-]{1,23}$/.test(n.name)||
   !ROLES.has(n.role)||n.alive!==true||
   !Object.hasOwn(DIRECTIONS,n.facing)||
   !Number.isSafeInteger(n.steps)||n.steps<0)
   throw Error('Invalid atlas NPC');
  GRID.tile(n.x,n.y);GRID.tile(n.home_x,n.home_y);
  if(Math.abs(n.x-n.home_x)>12||Math.abs(n.y-n.home_y)>12)
   throw Error('Atlas NPC wandered beyond home radius');
  const key=n.x+','+n.y;
  if(used.has(key))throw Error('Overlapping atlas NPC positions');
  used.add(key);
 }
 return true;
}
function occupied(world,x,y,ignore=null){
 const c=world.characters?.['1']?.atlas_position;
 if(c?.x===x&&c.y===y&&ignore!=='player')return true;
 const legacy=world.world_grid?.walker;
 if(legacy?.x===x&&legacy.y===y&&ignore!=='surveyor')return true;
 for(const n of Object.values(world.living?.atlas_npcs?.records||{})){
  if(n.id!==ignore&&n.x===x&&n.y===y)return true;
 }
 return false;
}
function traversable(world,x,y,from=null,ignore=null){
 if(!WALK.walkable(world,x,y)||occupied(world,x,y,ignore))return false;
 if(from){
  if(Math.abs(TERRAIN.readTile(world,x,y).elevation-
              TERRAIN.readTile(world,from.x,from.y).elevation)>WALK.MAX_RISE)
   return false;
 }
 return true;
}
function view(world,{radius=RADIUS}={}){
 if(!Number.isSafeInteger(radius)||radius<2||radius>RADIUS)
  throw Error('Invalid atlas actor viewport');
 validate(world);
 const player=world.characters?.['1'],actor=player?.atlas_position;
 if(!actor)return {started:false,world_revision:world.revision,
  has_character:Boolean(player),character_name:player?.name??null,
  atlas:{width:GRID.WIDTH,height:GRID.HEIGHT,cell_size:GRID.CELL},
  default_material:TERRAIN.DEFAULTS.material,npcs:[],sites:[],buildings:[],interior:null};
 const rows=[];
 for(let dy=-radius;dy<=radius;dy++){
  const row=[];
  for(let dx=-radius;dx<=radius;dx++){
   const x=actor.x+dx,y=actor.y+dy;
   if(x<0||y<0||x>=GRID.WIDTH||y>=GRID.HEIGHT){row.push(null);continue;}
   const tile=TERRAIN.readTile(world,x,y);
   row.push([tile.material,tile.elevation]);
  }
  rows.push(row);
 }
 const location=GRID.tile(actor.x,actor.y);
 const sites=CONSTRUCTION.nearby(world,actor.x,actor.y,radius);
 const housing=BUILDINGS.view(world);
 const npcs=Object.values(world.living?.atlas_npcs?.records||{})
  .filter(n=>Math.abs(n.x-actor.x)<=radius&&Math.abs(n.y-actor.y)<=radius)
  .map(n=>({id:n.id,name:n.name,role:n.role,x:n.x,y:n.y,
    facing:n.facing,steps:n.steps,pack:GATHER.inventory(world,n.id),coins:n.coins||0}))
  .sort((a,b)=>a.id.localeCompare(b.id));
 return {started:true,has_character:true,character_name:player.name,
  kind:'character',world_revision:world.revision,
  actor:{...actor,cell_id:location.cell.id,sector_id:location.sector.id,
   name:player.name,form:player.form,slot:player.slot,character_revision:player.revision,
   war_mode:player.war_mode===true,lilith_witnessed:player.lilith_witnessed===true},
  radius,tiles:rows,npcs,sites,buildings:housing.buildings,interior:housing.interior,
  landmarks:ANCHOR.landmarks(actor.x,actor.y,radius),village_spawn:ANCHOR.SPAWN,
  caches:CACHES.listing(world),
  supplies:GATHER.inventory(world,'player'),
  gold:player.gold??0,
  world_minute:world.living.minute,
  atlas:{width:GRID.WIDTH,height:GRID.HEIGHT,cell_size:GRID.CELL}};
}
function event(world,kind,text,extra={}){
 const log=world.living;
 const e={id:'event_'+(++log.event_sequence),minute:log.minute,type:kind,text,...extra};
 log.events.push(e);
 if(log.events.length>512)log.events.shift();
 return e;
}
function perform(world,command){
 if(!world?.world_grid||!command||Array.isArray(command)||
  typeof command!=='object')throw Error('Invalid atlas actor command');
 const keys=Object.keys(command).sort().join(',');
 const old=world.characters?.['1'];
 const next=structuredClone(world);
 ensure(next);
 GATHER.ensure(next);
 let e=null;
 if(command.action==='enter'){
  if(keys!=='action,x,y')throw Error('Invalid atlas entry command');
  if(!old)throw Error('Create a saved character first');
  GRID.tile(command.x,command.y);
  if(old.atlas_interior)throw Error('Exit the building before reentering the atlas');
  // The real character supersedes the disposable M72 surveyor entirely:
  // do not leave an invisible, impassable old testing avatar elsewhere.
  delete next.world_grid.walker;
  if(!traversable(next,command.x,command.y,null,'player'))
   throw Error('World entry terrain is occupied or impassable');
  next.characters['1'].atlas_position={x:command.x,y:command.y,
   facing:old.atlas_position?.facing??'south',steps:old.atlas_position?.steps??0};
  next.characters['1'].revision++;
  e=event(next,'atlas.player.enter',old.name+' entered the world atlas',
    {x:command.x,y:command.y,slot:1});
 }else if(command.action==='step'){
  if(keys!=='action,direction'||!Object.hasOwn(DIRECTIONS,command.direction))
   throw Error('Cardinal movement only');
  if(!old?.atlas_position)throw Error('Enter the world before moving');
  if(old.atlas_interior){
   BUILDINGS.move(next,command.direction);
   e=event(next,'atlas.player.indoor.step',old.name+' walked inside a building',
    {building_id:old.atlas_interior.id,slot:1});
  }else{
   const newPos=GRID.step(old.atlas_position.x,old.atlas_position.y,command.direction);
   if(!newPos)throw Error('World boundary reached');
   if(!traversable(world,newPos.x,newPos.y,old.atlas_position,'player'))
    throw Error('World terrain is blocked, occupied or too steep');
   next.characters['1'].atlas_position={x:newPos.x,y:newPos.y,
     facing:command.direction,steps:old.atlas_position.steps+1};
   next.characters['1'].revision++;
   e=event(next,'atlas.player.step',old.name+' moved '+command.direction,
    {x:newPos.x,y:newPos.y,slot:1});
  }
 }else if(command.action==='introduce_npc'){
  if(keys!=='action,name,role,x,y')throw Error('Invalid atlas NPC placement');
  GRID.tile(command.x,command.y);
  if(!ROLES.has(command.role)||typeof command.name!=='string'||
    !/^[A-Za-z][A-Za-z '-]{1,23}$/.test(command.name))
   throw Error('Invalid atlas NPC identity');
  if(Object.keys(next.living.atlas_npcs.records).length>=LIMIT)
   throw Error('Atlas NPC population limit reached');
  if(!traversable(world,command.x,command.y))
   throw Error('NPC placement is occupied or impassable');
  const store=next.living.atlas_npcs,id='atlas_npc_'+(++store.sequence);
  store.records[id]={id,name:command.name,role:command.role,alive:true,
   x:command.x,y:command.y,home_x:command.x,home_y:command.y,
   facing:'south',steps:0,coins:0};
  e=event(next,'atlas.npc.arrive',command.name+' arrived in the world atlas',
   {npc_id:id,x:command.x,y:command.y});
 }else if(command.action==='witness'){
  if(keys!=='action')throw Error('Invalid willow witness command');
  if(!old?.atlas_position||old.atlas_interior)throw Error('Visit the village willow in person');
  const d=ANCHOR.treeDistance(old.atlas_position.x,old.atlas_position.y);
  if(d>10||d<3)throw Error('Approach the willow from a short distance');
  if(old.lilith_witnessed)throw Error('The transformation has already been witnessed');
  next.characters['1'].lilith_witnessed=true;
  next.characters['1'].revision++;
  e=event(next,'underworld.queen.transformation',
   'The Queen of the Underworld became the willow before the character.',
   {x:ANCHOR.TREE.x,y:ANCHOR.TREE.y,form:old.form,slot:1});
 }else if(command.action==='enter_temple'){
  if(keys!=='action')throw Error('Invalid temple entry command');
  if(!old?.atlas_position||old.atlas_interior)throw Error('Approach the temple from outside');
  if(ANCHOR.doorDistance(old.atlas_position.x,old.atlas_position.y)>2)
   throw Error('Stand beside the temple entrance');
  if(!next.areas['dk.temple.sacrifice.001']?.objects?.find(o=>o.id==='temple_north_door')?.open)
   throw Error('The temple door is closed');
  next.characters['1'].area_id='dk.temple.sacrifice.001';
  next.characters['1'].x=8;next.characters['1'].y=1;next.characters['1'].facing='south';
  delete next.characters['1'].atlas_position;
  next.characters['1'].revision++;
  e=event(next,'atlas.temple.entry',old.name+' entered the Forsaken Temple',{slot:1});
 }else if(command.action==='gather'){
  if(keys!=='action,x,y')throw Error('Invalid atlas resource command');
  if(!old?.atlas_position)throw Error('Enter the world before gathering');
  if(old.atlas_interior)throw Error('Exit the building before gathering');
  const result=GATHER.harvest(next,'player',command.x,command.y);
  next.characters['1'].revision++;
  e=event(next,'atlas.player.gather',old.name+' gathered '+result.item,
   {x:result.x,y:result.y,item:result.item,slot:1});
 }else if(command.action==='remove_npc'){
  if(keys!=='action,npc_id'||typeof command.npc_id!=='string')
   throw Error('Invalid NPC removal command');
  const npc=next.living.atlas_npcs.records[command.npc_id];
  if(!npc)throw Error('Unknown atlas NPC');
  delete next.living.atlas_npcs.records[command.npc_id];
  delete next.living.atlas_resources.packs.npcs[command.npc_id];
  for(const house of Object.values(next.living.atlas_buildings?.records||{}))
   if(house.caretaker_id===command.npc_id)house.caretaker_id=null;
  for(const site of Object.values(next.living.atlas_sites?.records||{}))
   site.workers=site.workers.filter(id=>id!==command.npc_id);
  e=event(next,'atlas.npc.depart',npc.name+' left the world atlas',
   {npc_id:command.npc_id});
 }else throw Error('Unknown atlas actor command');
 next.revision++;
 validate(next);
 return {world:next,event:e,view:view(next)};
}
function advance(world,minute){
 const store=world.living?.atlas_npcs;
 if(!store||minute<=store.last_minute)return 0;
 store.last_minute=minute;
 const gathered=GATHER.advance(world,minute);
 if(minute%INTERVAL!==0)return gathered;
 let changed=gathered;
 for(const npc of Object.values(store.records)){
  if(npc.role==='worker')continue; // Workers remain at assigned worksite.
  // Small, repeatable local routes. No wandering across regions by chance.
  const radius=npc.role==='guard'?2:npc.role==='forager'?4:6;
  const pattern=[[1,0],[0,1],[-1,0],[0,-1]];
  // Patrol target derived from durable step count, not session randomness.
  const phase=Math.floor(npc.steps/radius)%4;
  const [dx,dy]=pattern[phase];
  const nx=npc.x+dx,ny=npc.y+dy;
  if(Math.abs(nx-npc.home_x)>radius||Math.abs(ny-npc.home_y)>radius||
     !traversable(world,nx,ny,npc,npc.id)){
   // Allow routes to turn around obstacles without walking through walls.
   npc.steps++;continue;
  }
  npc.x=nx;npc.y=ny;npc.facing=Object.keys(DIRECTIONS).find(
    d=>DIRECTIONS[d][0]===dx&&DIRECTIONS[d][1]===dy);
  npc.steps++;changed++;
 }
 return changed;
}
module.exports=Object.freeze({ensure,validate,view,perform,advance,traversable,
 occupied,ROLES,LIMIT,RADIUS,INTERVAL});
