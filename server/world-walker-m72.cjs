'use strict';
// M72: a server-owned walking surveyor for the replacement 9,216² atlas.
// Separate from obsolete M68 temple/courtyard character runtime until migrated.
// This is a real persisted position, not a browser-only camera.
const GRID=require('./world-grid-m67.cjs');
const TERRAIN=require('./world-terrain-editor-m69.cjs');
const SITES=require('./atlas-construction-m75.cjs');
const DIRECTION=Object.freeze({north:[0,-1],east:[1,0],south:[0,1],west:[-1,0]});
const BLOCKED=new Set(['sea','deepwater','river','lake','cliff','boulder','crevasse']);
const MAX_RISE=1;
const VIEW_RADIUS=12;
function valid(world){
 const actor=world?.world_grid?.walker;
 if(actor===undefined)return true;
 if(!actor||typeof actor!=='object'||Array.isArray(actor)||
  Object.keys(actor).sort().join(',')!=='facing,steps,x,y'||
  !Object.hasOwn(DIRECTION,actor.facing)||!Number.isSafeInteger(actor.steps)||actor.steps<0)
  throw Error('Invalid world walker state');
 GRID.tile(actor.x,actor.y);
 return true;
}
function walkable(world,x,y){
 GRID.tile(x,y);
 const material=TERRAIN.readTile(world,x,y).material;
 if(BLOCKED.has(material))return false;
 // Unbuilt M67 plans have no physical walls. A future construction-site system
 // will add real collision only when a foundation actually exists.
 return !SITES.blocks(world,x,y);
}
function worldView(world,{radius=VIEW_RADIUS}={}){
 valid(world);
 if(!Number.isSafeInteger(radius)||radius<2||radius>VIEW_RADIUS)
  throw Error('Invalid walking view radius');
 const actor=world.world_grid.walker;
 if(!actor)return {started:false,world_revision:world.revision,
  atlas:{width:GRID.WIDTH,height:GRID.HEIGHT,cell_size:GRID.CELL},
  default_material:TERRAIN.DEFAULTS.material};
 const rows=[];
 for(let dy=-radius;dy<=radius;dy++){
  const row=[];
  for(let dx=-radius;dx<=radius;dx++){
   const x=actor.x+dx,y=actor.y+dy;
   if(x<0||y<0||x>=GRID.WIDTH||y>=GRID.HEIGHT){row.push(null);continue;}
   const t=TERRAIN.readTile(world,x,y);
   row.push([t.material,t.elevation]);
  }
  rows.push(row);
 }
 const p=GRID.tile(actor.x,actor.y);
 return {started:true,world_revision:world.revision,
  actor:{...actor,cell_id:p.cell.id,sector_id:p.sector.id},
  radius,tiles:rows,
  atlas:{width:GRID.WIDTH,height:GRID.HEIGHT,cell_size:GRID.CELL}};
}
function perform(world,command){
 if(!world?.world_grid||!command||typeof command!=='object'||Array.isArray(command))
  throw Error('Invalid world movement command');
 valid(world);
 let x,y,facing,steps;
 const current=world.world_grid.walker;
 if(command.action==='place'){
  if(Object.keys(command).sort().join(',')!=='action,x,y')
   throw Error('Invalid surveyor placement command');
  GRID.tile(command.x,command.y);
  if(!walkable(world,command.x,command.y))throw Error('Destination terrain is impassable');
  x=command.x;y=command.y;facing=current?.facing??'south';steps=current?.steps??0;
 }else if(command.action==='step'){
  if(Object.keys(command).sort().join(',')!=='action,direction'||
    !Object.hasOwn(DIRECTION,command.direction))
   throw Error('Cardinal movement only');
  if(!current)throw Error('Place the surveyor before walking');
  const next=GRID.step(current.x,current.y,command.direction);
  if(!next)throw Error('World boundary reached');
  if(!walkable(world,next.x,next.y))throw Error('Destination terrain is impassable');
  const oldHeight=TERRAIN.readTile(world,current.x,current.y).elevation;
  const newHeight=TERRAIN.readTile(world,next.x,next.y).elevation;
  if(Math.abs(newHeight-oldHeight)>MAX_RISE)
   throw Error('Slope too steep to walk');
  x=next.x;y=next.y;facing=command.direction;steps=current.steps+1;
 }else throw Error('Unknown world walking action');
 const result=structuredClone(world);
 result.world_grid.walker={x,y,facing,steps};
 result.revision++;
 const event={id:'event_'+(++result.living.event_sequence),
  minute:result.living.minute,type:'world.walker.'+command.action,
  text:command.action==='place'?'Surveyor placed in replacement atlas':'Surveyor walked '+facing};
 result.living.events.push(event);
 if(result.living.events.length>512)result.living.events.shift();
 valid(result);
 return {world:result,actor:{...result.world_grid.walker},event};
}
module.exports=Object.freeze({valid,walkable,worldView,perform,BLOCKED,MAX_RISE,VIEW_RADIUS});
