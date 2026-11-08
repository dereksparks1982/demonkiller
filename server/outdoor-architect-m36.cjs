'use strict';
// M36: author-owned exterior edits. Server world stays authoritative.
// All edits are one transaction; building cells retain their stable IDs.
const {COURT,VILLAGE}=require('./regions.cjs');
const GEOMETRY=require('../dk-architect-exterior-m38.js');
const BUILDINGS=new Set(['house','bank','bakery','smithy','tavern']);
const FIXTURES=new Set(['well','stall']);
const TILE_FIELDS=['floor','walls','wallStyles','wallVariants','wallPacks','wallRotations','floorArt'];
const BASE={floor:'grass',walls:0,wallStyles:'clean',wallVariants:null,
 wallPacks:'ox72i',wallRotations:0,floorArt:null};
const GROUND=new Set(['grass','path','garden','dirt','stone']);
const DECOR=new Set(['grass','dirt']);
function integer(v){return Number.isSafeInteger(v);}
function at(a,x,y){return y*a.width+x;}
function inside(a,x,y){return integer(x)&&integer(y)&&x>=1&&y>=1&&x<a.width-1&&y<a.height-1;}
function rect(o){return {x:o.x,y:o.y,w:o.w||1,h:o.h||1};}
function overlaps(a,b){return a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h;}
function areaFor(world,id){
 if(id!==COURT&&id!==VILLAGE)throw Error('Only courtyard and village exteriors are editable');
 const area=world.areas?.[id];if(!area)throw Error('Unknown exterior region');
 return area;
}
function editable(area,id,types){
 const object=area.objects.find(o=>o.id===id);
 if(!object||!types.has(object.type))throw Error('Unknown or protected exterior object');
 return object;
}
function commandKeys(command,fields){
 const actual=Object.keys(command).sort().join(',');
 const expected=['action','area_id','expected_revision',...fields].sort().join(',');
 if(actual!==expected)throw Error('Invalid exterior edit parameters');
}
function blank(area,x,y){
 const i=at(area,x,y);
 for(const field of TILE_FIELDS)area[field][i]=BASE[field];
}
function validDestination(world,area,object,target){
 const bounds=rect(target);
 if(!inside(area,bounds.x,bounds.y)||!inside(area,bounds.x+bounds.w-1,bounds.y+bounds.h-1))
  throw Error('Exterior destination crosses protected region boundary');
 for(const other of area.objects){
  if(other.id!==object.id&&overlaps(bounds,rect(other)))
   throw Error('Exterior destination overlaps another fixture or building');
  if(other.id!==object.id&&other.door&&overlaps(bounds,{x:other.door.x,y:other.door.y,w:1,h:1}))
   throw Error('Exterior destination blocks an existing doorway');
 }
 for(let y=bounds.y;y<bounds.y+bounds.h;y++)for(let x=bounds.x;x<bounds.x+bounds.w;x++){
  const i=at(area,x,y);
  if(area.walls[i]||!DECOR.has(area.floor[i]))
   throw Error('Exterior destination blocks a wall, path, or garden');
 }
 const player=world.characters?.['1'];
 if(player?.area_id===area.area_id&&overlaps(bounds,{x:player.x,y:player.y,w:1,h:1}))
  throw Error('Cannot move a building onto the player');
 for(const npc of Object.values(world.living?.npcs||{}))
  if(npc.alive&&npc.area_id===area.area_id&&overlaps(bounds,{x:npc.x,y:npc.y,w:1,h:1}))
   throw Error('Cannot move a building onto an NPC');
}
function syncAttached(world,object,area_id){
 const house=world.living?.housing?.records?.[object.id];
 if(house){
  house.x=object.x;house.y=object.y;house.w=object.w;house.h=object.h;
  house.door_x=object.door?.x??null;house.door_y=object.door?.y??null;
  const store=world.entity_registry?.containers?.[house.storage_id];
  if(store){store.area_id=area_id;store.x=object.door?.x??object.x;
   store.y=object.door?.y??object.y;}
 }
 const stock=world.entity_registry?.containers?.['vendor_stock_'+object.id];
 if(stock){stock.area_id=area_id;stock.x=object.door?.x??object.x;
  stock.y=object.door?object.door.y+1:object.y;}
}
function freeOutside(area,object,x,y){
 if((x===object.x||x===object.x+object.w-1)&&
    (y===object.y||y===object.y+object.h-1))
  throw Error('Door cannot occupy a building corner');
 let outside=null;
 if(x===object.x)outside={x:x-1,y};
 else if(x===object.x+object.w-1)outside={x:x+1,y};
 else if(y===object.y)outside={x,y:y-1};
 else if(y===object.y+object.h-1)outside={x,y:y+1};
 if(!outside||!inside(area,outside.x,outside.y)||
  area.walls[at(area,outside.x,outside.y)]||
  area.floor[at(area,outside.x,outside.y)]==='roof')
  throw Error('Door requires a reachable exterior tile');
 for(const other of area.objects)
  if(other.id!==object.id&&overlaps(rect(other),{...outside,w:1,h:1}))
   throw Error('Door exit is occupied by another fixture');
}
function list(world,id){
 const area=areaFor(world,id);
 return {schema:'dk.outdoor.architect.m36',area_id:id,revision:world.revision,
  width:area.width,height:area.height,tile_size:area.tile_size,
  buildings:area.objects.filter(o=>BUILDINGS.has(o.type)).map(o=>({
   id:o.id,type:o.type,x:o.x,y:o.y,w:o.w,h:o.h,door:o.door?{...o.door}:null})),
  fixtures:area.objects.filter(o=>FIXTURES.has(o.type)).map(o=>({
   id:o.id,type:o.type,x:o.x,y:o.y})),
  protected_objects:area.objects.filter(o=>!BUILDINGS.has(o.type)&&!FIXTURES.has(o.type))
   .map(o=>({id:o.id,type:o.type,x:o.x,y:o.y}))};
}
function exportLayout(world,id){
 const area=areaFor(world,id);
 return {format:'dk.outdoor.layout.m36',area_id:id,world_revision:world.revision,
  map:structuredClone(area)};
}
function edit(world,command){
 if(!command||typeof command!=='object'||Array.isArray(command)||
  !integer(command.expected_revision)||typeof command.action!=='string')
  throw Error('Invalid exterior edit command');
 if(command.expected_revision!==world.revision)throw Error('Stale exterior revision');
 const action=command.action,id=command.area_id;
 const specs={move_building:['object_id','x','y'],move_fixture:['object_id','x','y'],
  set_door:['object_id','x','y'],remove_door:['object_id'],
  paint_wall:['x','y'],erase_wall:['x','y'],
  wall_line:['x','y','w','h'],room_outline:['x','y','w','h'],
  paint_ground:['x','y','floor'],paint_rectangle:['x','y','w','h','floor']};
 if(!Object.hasOwn(specs,action))throw Error('Unsupported exterior edit action');
 commandKeys(command,specs[action]);
 const next=structuredClone(world),area=areaFor(next,id);
 let target=null;
 if(action==='move_building'){
  target=GEOMETRY.move(area,command.object_id,command.x,command.y);
  syncAttached(next,target,id);
 }else if(action==='move_fixture'){
  target=editable(area,command.object_id,FIXTURES);
  if(!integer(command.x)||!integer(command.y))throw Error('Invalid fixture coordinates');
  if(target.x===command.x&&target.y===command.y)throw Error('Fixture is already there');
  // A fixture is a one-tile record; it does not contain building floor layers.
  const pos={...target,x:command.x,y:command.y};
  if(!inside(area,pos.x,pos.y)||area.walls[at(area,pos.x,pos.y)]||
   !GROUND.has(area.floor[at(area,pos.x,pos.y)]))
   throw Error('Fixture destination is blocked');
  for(const other of area.objects)if(other.id!==target.id&&overlaps(rect(other),rect(pos)))
   throw Error('Fixture overlaps another object');
  const player=next.characters?.['1'];
  if(player?.area_id===id&&player.x===pos.x&&player.y===pos.y)
   throw Error('Fixture destination is occupied by the player');
  if(Object.values(next.living.npcs||{}).some(n=>n.alive&&n.area_id===id&&n.x===pos.x&&n.y===pos.y))
   throw Error('Fixture destination is occupied by an NPC');
  target.x=pos.x;target.y=pos.y;
 }else if(action==='set_door'||action==='remove_door'){
  target=editable(area,command.object_id,BUILDINGS);
  if(action==='set_door'){
   if(!integer(command.x)||!integer(command.y)||
    command.x<target.x||command.y<target.y||
    command.x>=target.x+target.w||command.y>=target.y+target.h)
    throw Error('Door must occupy its building perimeter');
   const x=command.x,y=command.y;
   if(x!==target.x&&x!==target.x+target.w-1&&
    y!==target.y&&y!==target.y+target.h-1)
    throw Error('Door must occupy an exterior wall');
   freeOutside(area,target,x,y);
   if(target.door?.x===x&&target.door?.y===y)throw Error('Door is already there');
   if(target.door)area.walls[at(area,target.door.x,target.door.y)]=1;
   target.door={x,y};area.walls[at(area,x,y)]=0;
  }else{
   if(!target.door)throw Error('Building has no door to erase');
   area.walls[at(area,target.door.x,target.door.y)]=1;
   target.door=null;
  }
  syncAttached(next,target,id);
 }else if(['paint_wall','erase_wall','wall_line','room_outline'].includes(action)){
  GEOMETRY.wallEdit(area,action,command);
 }else{
  const rectangle=action==='paint_rectangle';
  const w=rectangle?command.w:1,h=rectangle?command.h:1;
  if(!integer(command.x)||!integer(command.y)||!integer(w)||!integer(h)||
   w<1||h<1||w*h>256||!GROUND.has(command.floor)||
   !inside(area,command.x,command.y)||
   !inside(area,command.x+w-1,command.y+h-1))
   throw Error('Invalid ground brush selection');
  let changed=0;
  for(let y=command.y;y<command.y+h;y++)for(let x=command.x;x<command.x+w;x++){
   const i=at(area,x,y);
   if(area.walls[i]||area.floor[i]==='roof'||area.objects.some(o=>
    overlaps(rect(o),{x,y,w:1,h:1})))continue;
   if(area.floor[i]===command.floor)continue;
   area.floor[i]=command.floor;area.floorArt[i]=null;changed++;
  }
  if(!changed)throw Error('Ground brush found no editable tiles');
 }
 next.revision++;
 const text=action.replaceAll('_',' ')+' in '+id+'.';
 const event={id:'event_'+(++next.living.event_sequence),minute:next.living.minute,
  type:'architect.outdoor.edit',text,area_id:id,action,
  object_id:target?.id||null};
 next.living.events.push(event);
 if(next.living.events.length>512)next.living.events.shift();
 return {world:next,event,area_id:id,revision:next.revision};
}
module.exports={BUILDINGS,FIXTURES,list,exportLayout,edit,overlaps,rect};
