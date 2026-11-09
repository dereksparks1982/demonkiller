'use strict';
// M69: sparse, persistent, server-owned top-down world terrain. No prefabs or art.
const GRID=require('./world-grid-m67.cjs');
const ANCHOR=require('./world-anchor-m78.cjs');
const M68=require('../dk-world-terrain-m68.js');
const SCHEMA=1,MAX_SECTORS=262144,MAX_BRUSH=1024;
const MATERIALS=new Set([
 'grass','path','garden','dirt','stone','dark','cracked','sigil',
 'heath','forest','pine','highland','cliff','boulder','glacier','crevasse',
 'sea','beach','river','lake','deepwater','marsh','bog','reed','bridge'
]);
const SOLID=new Set(['cliff','boulder','crevasse','sea','river','lake','deepwater']);
const DEFAULTS=Object.freeze({material:'grass',elevation:0});
const valid=n=>Number.isSafeInteger(n);
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function blank(){return {schema:SCHEMA,defaults:{...DEFAULTS},sectors:{},cells:{}};}
function validate(world){
 const terrain=world?.world_grid?.terrain;
 if(terrain===undefined)return true; // M67/M68 saves acquire an empty ledger.
 if(!terrain||terrain.schema!==SCHEMA||!terrain.sectors||
  typeof terrain.sectors!=='object'||Array.isArray(terrain.sectors)||
  Object.keys(terrain).some(k=>!['schema','defaults','sectors','cells'].includes(k)))
  throw Error('Invalid world terrain ledger');
 if(terrain.defaults!==undefined&&(
  !terrain.defaults||typeof terrain.defaults!=='object'||
  Array.isArray(terrain.defaults)||
  Object.keys(terrain.defaults).sort().join(',')!=='elevation,material'||
  terrain.defaults.material!==DEFAULTS.material||
  terrain.defaults.elevation!==DEFAULTS.elevation))
  throw Error('Invalid terrain world defaults');
 if(terrain.cells!==undefined){
  if(!terrain.cells||typeof terrain.cells!=='object'||Array.isArray(terrain.cells))
   throw Error('Invalid painted cells');
  const c=Object.entries(terrain.cells);
  if(c.length>GRID.WIDTH/GRID.CELL*GRID.HEIGHT/GRID.CELL)
   throw Error('Invalid number of painted cells');
  for(const [key,material] of c){
   const m=/^(0|[1-9][0-9]{0,2})\.(0|[1-9][0-9]{0,2})$/.exec(key);
   if(!m||Number(m[1])>=GRID.WIDTH/GRID.CELL||
     Number(m[2])>=GRID.HEIGHT/GRID.CELL||!MATERIALS.has(material))
    throw Error('Invalid painted Streaming Cell');
  }
 }
 const entries=Object.entries(terrain.sectors);
 if(entries.length>MAX_SECTORS)throw Error('World terrain sector limit exceeded');
 for(const [name,sector] of entries){
  const m=/^(0|[1-9][0-9]{0,2})\.(0|[1-9][0-9]{0,2})$/.exec(name);
  if(!m||+m[1]>=GRID.WIDTH/GRID.SECTOR||+m[2]>=GRID.HEIGHT/GRID.SECTOR||
    !sector||typeof sector!=='object'||Array.isArray(sector)||
    !sector.tiles||typeof sector.tiles!=='object'||Array.isArray(sector.tiles)||
    Object.keys(sector).some(k=>k!=='tiles'))
   throw Error('Invalid world terrain sector');
  const tiles=Object.entries(sector.tiles);
  if(!tiles.length||tiles.length>256)throw Error('Invalid sparse terrain sector size');
  for(const [key,item] of tiles){
   if(!/^(0|[1-9][0-9]{0,2})$/.test(key)||+key>=256||
      !item||typeof item!=='object'||Array.isArray(item)||
      Object.keys(item).some(k=>!['material','elevation'].includes(k))||
      !Object.keys(item).length||
      (own(item,'material')&&!MATERIALS.has(item.material))||
      (own(item,'elevation')&&(!valid(item.elevation)||item.elevation< -64||item.elevation>127)))
    throw Error('Invalid world terrain tile');
  }
 }
 return true;
}
function ensure(world){
 if(!world?.world_grid)throw Error('Missing global world grid');
 if(world.world_grid.terrain===undefined){
  world.world_grid.terrain=blank();return true;
 }
 validate(world);
 let changed=false;
 if(world.world_grid.terrain.cells===undefined){
  world.world_grid.terrain.cells={};changed=true;
 }
 if(world.world_grid.terrain.defaults===undefined){
  world.world_grid.terrain.defaults={...DEFAULTS};changed=true;
 }
 return changed;
}
function address(x,y){
 GRID.tile(x,y);
 const sx=Math.floor(x/GRID.SECTOR),sy=Math.floor(y/GRID.SECTOR);
 return {sector:sx+'.'+sy,index:String((y%GRID.SECTOR)*GRID.SECTOR+x%GRID.SECTOR)};
}
function override(world,x,y){
 const p=address(x,y);
 return world.world_grid?.terrain?.sectors?.[p.sector]?.tiles?.[p.index]||null;
}
function areaTile(world,x,y){
 const col=Math.floor(x/M68.SIZE),row=Math.floor(y/M68.SIZE);
 const id=M68.id(col,row);
 if(!M68.isWorldArea(id))return null;
 const area=world.areas?.[id];
 const lx=x%M68.SIZE,ly=y%M68.SIZE;
 return area?{area,id,lx,ly,index:ly*area.width+lx}:null;
}
function readTile(world,x,y){
 const a=areaTile(world,x,y),o=override(world,x,y),home=ANCHOR.tile(x,y);
 return {x,y,material:o?.material??world.world_grid?.terrain?.cells?.[
   Math.floor(x/GRID.CELL)+'.'+Math.floor(y/GRID.CELL)]??home?.material??DEFAULTS.material,
  elevation:o?.elevation??DEFAULTS.elevation,
  override:o?{...o}:null,sector:address(x,y).sector,
  materialized:Boolean(a)};
}
function inspect(world,x,y){
 const position=GRID.tile(x,y);
 return {schema:SCHEMA,revision:world.revision,position,
  tile:readTile(world,x,y),
  neighbors:Object.fromEntries(Object.entries({north:[0,-1],east:[1,0],
   south:[0,1],west:[-1,0]}).map(([direction,[dx,dy]])=>{
    const next=GRID.step(x,y,direction);
    return [direction,next?readTile(world,next.x,next.y):null];
   }))};
}
function brushTiles(command){
 const {action}=command;
 if(action==='restore'){
  if(!Array.isArray(command.tiles)||!command.tiles.length||
    command.tiles.length>MAX_BRUSH||Object.keys(command).some(k=>
     !['action','expected_revision','tiles'].includes(k)))
   throw Error('Invalid terrain restore selection');
  const unique=new Set();
  return command.tiles.map(t=>{
   if(!t||Object.keys(t).sort().join(',')!=='elevation,material,x,y'||
     (t.material!==null&&!MATERIALS.has(t.material))||
     (t.elevation!==null&&(!valid(t.elevation)||t.elevation< -64||t.elevation>127)))
    throw Error('Invalid terrain restore tile');
   GRID.tile(t.x,t.y);
   const key=t.x+','+t.y;
   if(unique.has(key))throw Error('Duplicate terrain restore tile');
   unique.add(key);return {x:t.x,y:t.y,material:t.material,elevation:t.elevation};
  });
 }
 if(!['paint_material','raise_elevation','lower_elevation','flatten_elevation','smooth_elevation'].includes(action)||
   !valid(command.x)||!valid(command.y)||!valid(command.width)||!valid(command.height)||
   command.width<1||command.height<1||command.width*command.height>MAX_BRUSH)
  throw Error('Invalid terrain brush');
 const keys=action==='paint_material'?
  ['action','expected_revision','x','y','width','height','material']:
  action==='flatten_elevation'?
  ['action','expected_revision','x','y','width','height','target_elevation']:
  ['action','expected_revision','x','y','width','height'];
 if(Object.keys(command).sort().join(',')!==keys.sort().join(',')||
  (action==='paint_material'&&!MATERIALS.has(command.material))||
  (action==='flatten_elevation'&&(!valid(command.target_elevation)||
   command.target_elevation< -64||command.target_elevation>127)))
  throw Error('Invalid terrain brush parameters');
 GRID.tile(command.x,command.y);
 GRID.tile(command.x+command.width-1,command.y+command.height-1);
 const tiles=[];
 for(let y=command.y;y<command.y+command.height;y++)
  for(let x=command.x;x<command.x+command.width;x++)tiles.push({x,y});
 return tiles;
}
function obstructed(world,x,y,material){
 const building=ANCHOR.TEMPLE;
 if(x>=building.x&&x<building.x+building.w&&y>=building.y&&y<building.y+building.h)return true;
 // A staked site protects every tile against both painting and elevation edits.
 if(Object.values(world.living?.atlas_sites?.records||{}).some(s=>
  x>=s.x&&y>=s.y&&x<s.x+s.width&&y<s.y+s.height))return true;
 // Permanent caches are real terrain objects. Do not erase their position
 // using a deep-water/solid terrain brush while their stock persists.
 if(SOLID.has(material)&&Object.values(world.living?.atlas_caches?.records||{})
    .some(c=>c.x===x&&c.y===y))return true;
 if(!SOLID.has(material))return false;
 if(world.world_grid?.walker?.x===x&&world.world_grid.walker.y===y)return true;
 const actor=world.characters?.['1']?.atlas_position;
 if(actor?.x===x&&actor.y===y)return true;
 if(Object.values(world.living?.atlas_npcs?.records||{}).some(n=>
   n.x===x&&n.y===y))return true;
 const a=areaTile(world,x,y);
 if(a){
  const c=world.characters?.['1'];
  if(c&&c.area_id===a.id&&c.x===a.lx&&c.y===a.ly)return true;
  for(const n of Object.values(world.living?.npcs||{}))
   if(n?.alive&&n.area_id===a.id&&n.x===a.lx&&n.y===a.ly)return true;
  for(const o of a.area.objects||[])
   if(x>=0&&a.lx>=o.x&&a.ly>=o.y&&a.lx<o.x+(o.w||1)&&a.ly<o.y+(o.h||1))
    return true;
 }
 for(const b of Object.values(world.world_grid?.buildings||{}))
  if(x>=b.x&&y>=b.y&&x<b.x+b.width&&y<b.y+b.height)return true;
 return false;
}
function edit(world,command){
 if(!command||typeof command!=='object'||Array.isArray(command)||
  !valid(command.expected_revision))throw Error('Invalid terrain edit request');
 if(command.expected_revision!==world.revision)throw Error('Stale world revision');
 const tiles=brushTiles(command);
 // Reject the whole operation before modifying anything.
 const updates=[];
 for(const pos of tiles){
  const prev=override(world,pos.x,pos.y);
  const material=command.action==='paint_material'?command.material:
   command.action==='restore'?pos.material:prev?.material??null;
  let elevation=command.action==='restore'?pos.elevation:prev?.elevation??null;
   if(command.action==='raise_elevation'||command.action==='lower_elevation'){
    elevation=(elevation??readTile(world,pos.x,pos.y).elevation)+
     (command.action==='raise_elevation'?1:-1);
    if(elevation< -64||elevation>127)throw Error('Terrain elevation limit reached');
   }else if(command.action==='flatten_elevation')elevation=command.target_elevation;
   else if(command.action==='smooth_elevation'){
    const heights=[readTile(world,pos.x,pos.y).elevation];
    for(const direction of ['north','east','south','west']){
     const n=GRID.step(pos.x,pos.y,direction);
     if(n)heights.push(readTile(world,n.x,n.y).elevation);
    }
    elevation=Math.round(heights.reduce((a,b)=>a+b,0)/heights.length);
   }
  const current=readTile(world,pos.x,pos.y);
  if(obstructed(world,pos.x,pos.y,material??current.material))
   throw Error('Terrain edit would obstruct a character, fixture, protected construction site or building plan');
  const next={};
  const cellBase=world.world_grid?.terrain?.cells?.[
    Math.floor(pos.x/GRID.CELL)+'.'+Math.floor(pos.y/GRID.CELL)]??ANCHOR.tile(pos.x,pos.y)?.material??DEFAULTS.material;
  if(material!==null&&material!==cellBase)next.material=material;
  if(elevation!==null&&elevation!==DEFAULTS.elevation)next.elevation=elevation;
  updates.push({x:pos.x,y:pos.y,previous:prev?{...prev}:null,next});
 }
 const changed=updates.filter(u=>
  JSON.stringify(u.previous||{})!==JSON.stringify(u.next));
 if(!changed.length)throw Error('Terrain brush would not change anything');
 const nextWorld=structuredClone(world);
 ensure(nextWorld);
 const undo=[];
 for(const u of changed){
  const p=address(u.x,u.y),ledger=nextWorld.world_grid.terrain.sectors;
  const sector=ledger[p.sector]||(ledger[p.sector]={tiles:{}});
  const previous=u.previous;
  undo.push({x:u.x,y:u.y,material:previous?.material??null,
   elevation:previous?.elevation??null});
  if(Object.keys(u.next).length)sector.tiles[p.index]=u.next;
  else delete sector.tiles[p.index];
  if(!Object.keys(sector.tiles).length)delete ledger[p.sector];
  const a=areaTile(nextWorld,u.x,u.y);
  if(a){
   if(u.next.material!==undefined)a.area.floor[a.index]=u.next.material;
   else if(previous?.material!==undefined)a.area.floor[a.index]=
     nextWorld.world_grid?.terrain?.cells?.[Math.floor(u.x/GRID.CELL)+'.'+Math.floor(u.y/GRID.CELL)]??M68.tile(u.x,u.y);
   if(u.next.elevation!==undefined||previous?.elevation!==undefined){
    if(!Array.isArray(a.area.elevation))
     a.area.elevation=Array(a.area.width*a.area.height).fill(0);
    a.area.elevation[a.index]=u.next.elevation??0;
   }
  }
 }
 nextWorld.revision++;
 const event={id:'event_'+(++nextWorld.living.event_sequence),
  minute:nextWorld.living.minute,type:'architect.terrain.edit',
  action:command.action,changed:changed.length,
  text:'DK Architect changed '+changed.length+' world terrain tiles.'};
 nextWorld.living.events.push(event);
 if(nextWorld.living.events.length>512)nextWorld.living.events.shift();
 validate(nextWorld);
 return {world:nextWorld,revision:nextWorld.revision,
  changed:changed.length,undo,event};
}
function sector(world,sx,sy){
 if(!valid(sx)||!valid(sy)||sx<0||sy<0||
  sx>=GRID.WIDTH/GRID.SECTOR||sy>=GRID.HEIGHT/GRID.SECTOR)
  throw Error('Invalid world terrain sector coordinates');
 const tiles=[];
 for(let y=sy*GRID.SECTOR;y<(sy+1)*GRID.SECTOR;y++){
  const row=[];
  for(let x=sx*GRID.SECTOR;x<(sx+1)*GRID.SECTOR;x++)
   row.push(readTile(world,x,y));
  tiles.push(row);
 }
 return {format:'dk.terrain.sector.m69',revision:world.revision,
  sx,sy,bounds:GRID.sectorBounds(sx,sy),tiles};
}
function exportData(world,cx=null,cy=null){
 validate(world);
 const data=world.world_grid?.terrain||blank();
 let sectors=data.sectors;
 if(cx!==null||cy!==null){
  GRID.cellBounds(cx,cy);
  sectors={};
  for(const [key,value] of Object.entries(data.sectors)){
   const [sx,sy]=key.split('.').map(Number);
   if(Math.floor(sx*GRID.SECTOR/GRID.CELL)===cx&&
      Math.floor(sy*GRID.SECTOR/GRID.CELL)===cy)
    sectors[key]=value;
  }
 }
 return {format:'dk.world.terrain.m69',world_revision:world.revision,
  defaults:structuredClone(data.defaults??DEFAULTS),
  dimensions:{width:GRID.WIDTH,height:GRID.HEIGHT,
   tile_size:GRID.TILE,sector_size:GRID.SECTOR,cell_size:GRID.CELL},
  scope:cx===null?'all':{cell_x:cx,cell_y:cy},
  sectors:structuredClone(sectors),
  cells:structuredClone(cx===null?data.cells||{}:
    Object.fromEntries(Object.entries(data.cells||{}).filter(([key])=>key===cx+'.'+cy))),
  building_drafts:cx===null?structuredClone(world.world_grid?.buildings||{}):null,
  legacy_scenes_imported:false};
}
module.exports={SCHEMA,MATERIALS,SOLID,MAX_BRUSH,DEFAULTS,blank,ensure,validate,
 address,override,readTile,inspect,brushTiles,edit,sector,exportData};
