'use strict';
// M67: Code-only replacement-world topology. No legacy temple, village,
// courtyard, artwork, map image, paths, NPCs or settlements are imported.
// The old areas remain isolated until their dependent gameplay is migrated.
const SCHEMA=1, WIDTH=4096, HEIGHT=4096, TILE=32, SECTOR=16, CELL=128;
const DIRECTIONS=Object.freeze({north:[0,-1],east:[1,0],south:[0,1],west:[-1,0]});
function integer(value,label,min,max){
 if(!Number.isSafeInteger(value)||value<min||value>max)throw Error('Invalid '+label);
 return value;
}
function tile(x,y){
 integer(x,'world x',0,WIDTH-1);integer(y,'world y',0,HEIGHT-1);
 const cx=Math.floor(x/CELL),cy=Math.floor(y/CELL);
 const sx=Math.floor(x/SECTOR),sy=Math.floor(y/SECTOR);
 return {x,y,tile_size:TILE,
  cell:{id:'dk.cell.world.'+cx+'.'+cy,x:cx,y:cy,local_x:x%CELL,local_y:y%CELL},
  sector:{id:'dk.sector.world.'+sx+'.'+sy,x:sx,y:sy,local_x:x%SECTOR,local_y:y%SECTOR}};
}
function cellBounds(cx,cy){
 integer(cx,'cell x',0,WIDTH/CELL-1);integer(cy,'cell y',0,HEIGHT/CELL-1);
 return {x:cx*CELL,y:cy*CELL,width:CELL,height:CELL};
}
function sectorBounds(sx,sy){
 integer(sx,'sector x',0,WIDTH/SECTOR-1);integer(sy,'sector y',0,HEIGHT/SECTOR-1);
 return {x:sx*SECTOR,y:sy*SECTOR,width:SECTOR,height:SECTOR};
}
function rectangle(x,y,width,height){
 integer(x,'rectangle x',0,WIDTH-1);integer(y,'rectangle y',0,HEIGHT-1);
 integer(width,'rectangle width',1,WIDTH-x);integer(height,'rectangle height',1,HEIGHT-y);
 return {x,y,width,height};
}
function cellsForRectangle(x,y,width,height){
 rectangle(x,y,width,height);
 const result=[];
 for(let cy=Math.floor(y/CELL);cy<=Math.floor((y+height-1)/CELL);cy++)
  for(let cx=Math.floor(x/CELL);cx<=Math.floor((x+width-1)/CELL);cx++)
   result.push({id:'dk.cell.world.'+cx+'.'+cy,x:cx,y:cy,bounds:cellBounds(cx,cy)});
 return result;
}
function neighborCells(cx,cy){
 cellBounds(cx,cy);
 const result={};
 for(const [name,[dx,dy]] of Object.entries(DIRECTIONS)){
  const x=cx+dx,y=cy+dy;
  result[name]=x>=0&&y>=0&&x<WIDTH/CELL&&y<HEIGHT/CELL?
   'dk.cell.world.'+x+'.'+y:null;
 }
 return result;
}
function step(x,y,direction){
 tile(x,y);
 if(!Object.prototype.hasOwnProperty.call(DIRECTIONS,direction))
  throw Error('Cardinal movement only');
 const [dx,dy]=DIRECTIONS[direction],nx=x+dx,ny=y+dy;
 return nx<0||ny<0||nx>=WIDTH||ny>=HEIGHT?null:tile(nx,ny);
}
function blank(){
 // Only structural plans are stored. Empty terrain is not a 16M-tile array.
 return {schema:SCHEMA,width:WIDTH,height:HEIGHT,tile_size:TILE,
  sector_size:SECTOR,cell_size:CELL,buildings:{}};
}
function overlap(a,b){
 return a.x<b.x+b.width&&b.x<a.x+a.width&&
  a.y<b.y+b.height&&b.y<a.y+a.height;
}
function validBuilding(id,b){
 if(!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(id)||!b||b.id!==id||
  typeof b.kind!=='string'||!/^[a-z][a-z0-9_-]{0,39}$/.test(b.kind)||
  (b.owner_id!==null&&
   (typeof b.owner_id!=='string'||!/^[a-z0-9:_-]{1,80}$/.test(b.owner_id)))||
  b.state!=='draft')
  throw Error('Invalid planned building');
 rectangle(b.x,b.y,b.width,b.height);
 if(b.width>512||b.height>512)throw Error('Building footprint too large');
 if(Object.keys(b).some(key=>!['id','kind','owner_id','state','x','y','width','height'].includes(key)))
  throw Error('Unknown building record fields');
}
function validate(world){
 const plan=world?.world_grid;
 if(plan===undefined)return true; // Accept pre-M67 saves; ensure() migrates.
 if(!plan||plan.schema!==SCHEMA||plan.width!==WIDTH||plan.height!==HEIGHT||
  plan.tile_size!==TILE||plan.cell_size!==CELL||plan.sector_size!==SECTOR||
  !plan.buildings||Array.isArray(plan.buildings)||typeof plan.buildings!=='object'||
  Object.keys(plan).some(key=>!['schema','width','height','tile_size','sector_size','cell_size','buildings'].includes(key)))
  throw Error('Invalid replacement world grid');
 const entries=Object.entries(plan.buildings);
 if(entries.length>4096)throw Error('Too many building drafts');
 const byCell=new Map();
 for(const [id,b] of entries){
  validBuilding(id,b);
  for(const c of cellsForRectangle(b.x,b.y,b.width,b.height)){
   const others=byCell.get(c.id)||[];
   if(others.some(other=>overlap(other,b)))throw Error('Building footprints overlap');
   others.push(b);byCell.set(c.id,others);
  }
 }
 return true;
}
function ensure(world){
 if(!world||!world.areas||!world.characters)throw Error('World required');
 if(world.world_grid===undefined){world.world_grid=blank();return true;}
 validate(world);return false;
}
function planBuilding(world,input){
 ensure(world);
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid building draft');
 const b={id:input.id,kind:input.kind,owner_id:input.owner_id??null,
  state:'draft',x:input.x,y:input.y,width:input.width,height:input.height};
 validBuilding(b.id,b);
 if(world.world_grid.buildings[b.id])throw Error('Building ID already in use');
 world.world_grid.buildings[b.id]=b;
 try{validate(world);}catch(e){delete world.world_grid.buildings[b.id];throw e;}
 // Planning a footprint does not create usable buildings, equipment or supplies.
 return {...b,cells:cellsForRectangle(b.x,b.y,b.width,b.height).map(c=>c.id)};
}
function cancelDraft(world,id){
 ensure(world);
 if(!Object.prototype.hasOwnProperty.call(world.world_grid.buildings,id))
  throw Error('Unknown building draft');
 delete world.world_grid.buildings[id];
 return true;
}
function overview(world,x=null,y=null){
 validate(world);
 const plan=world.world_grid||blank();
 const result={schema:SCHEMA,world_tiles:{width:WIDTH,height:HEIGHT},
  tile_size:TILE,sectors:{size:SECTOR,columns:WIDTH/SECTOR,rows:HEIGHT/SECTOR},
  streaming_cells:{size:CELL,columns:WIDTH/CELL,rows:HEIGHT/CELL},
  legacy_scenes_imported:false,planned_buildings:Object.keys(plan.buildings).length};
 if(x!==null||y!==null){
  if(x===null||y===null)throw Error('Both world coordinates required');
  result.position=tile(x,y);
 }
 return result;
}
module.exports=Object.freeze({SCHEMA,WIDTH,HEIGHT,TILE,SECTOR,CELL,
 tile,cellBounds,sectorBounds,cellsForRectangle,neighborCells,step,
 blank,ensure,validate,planBuilding,cancelDraft,overview});
