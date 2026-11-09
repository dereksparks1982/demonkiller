'use strict';
// M70: whole-world, intentionally low-detail pixel-paint atlas.
// Each 128x128 Streaming Cell can be painted by one sparse material entry.
// Fine tile overrides from M69 always take precedence.
const GRID=require('./world-grid-m67.cjs');
const TERRAIN=require('./world-terrain-editor-m69.cjs');
const M68=require('../dk-world-terrain-m68.js');
const MAX_CELLS_PER_EDIT=5184;
const SCALE_LEVELS=Object.freeze([1,2,4,8,16,32,64,128]);
const SEA=new Set(['sea','deepwater','river','lake']);
function key(cx,cy){GRID.cellBounds(cx,cy);return cx+'.'+cy;}
function validateCellCommand(c){
 if(!c||typeof c!=='object'||Array.isArray(c)||
    !Number.isSafeInteger(c.expected_revision))throw Error('Invalid atlas edit request');
 if(c.action==='restore_cells'){
  if(Object.keys(c).sort().join(',')!=='action,expected_revision,tiles'||
   !Array.isArray(c.tiles)||c.tiles.length<1||c.tiles.length>MAX_CELLS_PER_EDIT)
   throw Error('Invalid atlas restore request');
  const seen=new Set();
  return c.tiles.map(p=>{
   if(!p||Object.keys(p).sort().join(',')!=='cx,cy,material'||
      !(p.material===null||TERRAIN.MATERIALS.has(p.material)))
    throw Error('Invalid atlas restore cell');
   const k=key(p.cx,p.cy);if(seen.has(k))throw Error('Duplicate atlas cell');
   seen.add(k);return {cx:p.cx,cy:p.cy,material:p.material};
  });
 }
 if(c.action!=='fill_cells'||
  Object.keys(c).sort().join(',')!=='action,expected_revision,height,material,width,x,y'||
  !TERRAIN.MATERIALS.has(c.material)||![c.x,c.y,c.width,c.height].every(Number.isSafeInteger)||
  c.width<1||c.height<1||c.width*c.height>MAX_CELLS_PER_EDIT)
  throw Error('Invalid atlas cell fill request');
 key(c.x,c.y);key(c.x+c.width-1,c.y+c.height-1);
 const out=[];
 for(let cy=c.y;cy<c.y+c.height;cy++)
  for(let cx=c.x;cx<c.x+c.width;cx++)out.push({cx,cy,material:c.material});
 return out;
}
function impassableBlocked(world,cx,cy,material){
 const bounds=GRID.cellBounds(cx,cy);
 // Protect building stakes even from broad passable material fills.
 if(Object.values(world.living?.atlas_sites?.records||{}).some(s=>
   s.x<bounds.x+bounds.width&&s.x+s.width>bounds.x&&
   s.y<bounds.y+bounds.height&&s.y+s.height>bounds.y))return true;
 if(!TERRAIN.SOLID.has(material))return false;
 const contained=(x,y)=>x>=bounds.x&&y>=bounds.y&&x<bounds.x+bounds.width&&y<bounds.y+bounds.height;
 const walker=world.world_grid?.walker;
 if(walker&&contained(walker.x,walker.y))return true;
 const actor=world.characters?.['1']?.atlas_position;
 if(actor&&contained(actor.x,actor.y))return true;
 if(Object.values(world.living?.atlas_npcs?.records||{}).some(n=>
   contained(n.x,n.y)))return true;
 for(const b of Object.values(world.world_grid?.buildings||{}))
  if(b.x<bounds.x+bounds.width&&b.x+b.width>bounds.x&&
   b.y<bounds.y+bounds.height&&b.y+b.height>bounds.y)return true;
 for(const a of Object.values(world.areas||{})){
  if(!a.world_origin)continue;
  const ax=a.world_origin.x,ay=a.world_origin.y;
  if(ax>=bounds.x+bounds.width||ay>=bounds.y+bounds.height||
     ax+a.width<=bounds.x||ay+a.height<=bounds.y)continue;
  for(const obj of a.objects||[]){
   const gx=ax+obj.x,gy=ay+obj.y;
   if(gx<bounds.x+bounds.width&&gx+(obj.w||1)>bounds.x&&
    gy<bounds.y+bounds.height&&gy+(obj.h||1)>bounds.y)return true;
  }
 }
 for(const person of [...Object.values(world.characters||{}),
                      ...Object.values(world.living?.npcs||{})]){
  const a=world.areas?.[person?.area_id];
  if(a?.world_origin&&person.alive!==false&&
    contained(a.world_origin.x+person.x,a.world_origin.y+person.y))return true;
 }
 return false;
}
function cellMaterial(world,cx,cy){
 return world.world_grid?.terrain?.cells?.[key(cx,cy)]??null;
}
function editCells(world,c){
 if(!world?.world_grid||c?.expected_revision!==world.revision)
  throw Error('Stale world revision');
 const inputs=validateCellCommand(c),cells=world.world_grid.terrain?.cells||{};
 // "Paint grass" restores the implicit grass plane instead of serializing
 // 16,384 redundant grass tiles for every cleared ocean cell.
 const targets=c.action==='fill_cells'&&c.material===TERRAIN.DEFAULTS.material?
  inputs.map(t=>({...t,material:null})):inputs;
 const requested=targets.filter(t=>(cells[key(t.cx,t.cy)]??null)!==t.material);
 const skipped=requested.filter(t=>impassableBlocked(world,t.cx,t.cy,t.material));
 const blocked=new Set(skipped.map(t=>key(t.cx,t.cy)));
 const changed=requested.filter(t=>!blocked.has(key(t.cx,t.cy)));
 if(!changed.length)throw Error('Cell fill made no changes; all selected cells are protected');
 const next=structuredClone(world);TERRAIN.ensure(next);
 if(!next.world_grid.terrain.cells)next.world_grid.terrain.cells={};
 const undo=[];
 for(const t of changed){
  const k=key(t.cx,t.cy),old=cells[k]??null;
  undo.push({cx:t.cx,cy:t.cy,material:old});
  if(t.material===null)delete next.world_grid.terrain.cells[k];
  else next.world_grid.terrain.cells[k]=t.material;
  // Existing materialized M68 samples stay authoritative for play and collision.
  const area=next.areas?.[M68.id(t.cx,t.cy)];
  if(!area||!M68.isWorldArea(area.area_id))continue;
  for(let i=0;i<area.floor.length;i++){
   const x=t.cx*GRID.CELL+i%area.width,y=t.cy*GRID.CELL+Math.floor(i/area.width);
   area.floor[i]=TERRAIN.override(next,x,y)?.material??t.material??M68.tile(x,y);
  }
 }
 next.revision++;
 const event={id:'event_'+(++next.living.event_sequence),
  minute:next.living.minute,type:'architect.terrain.cells',
  text:'DK Architect painted '+changed.length+' Streaming Cells',
  changed_cells:changed.length,skipped_cells:skipped.length};
 next.living.events.push(event);
 if(next.living.events.length>512)next.living.events.shift();
 TERRAIN.validate(next);
 return {world:next,revision:next.revision,changed:changed.length,
  changed_tiles:changed.length*GRID.CELL*GRID.CELL,undo_cells:undo,
  skipped_cells:skipped.map(t=>({cx:t.cx,cy:t.cy})),event};
}
function view(world,{x,y,scale,columns,rows}={}){
 if(!Number.isSafeInteger(x)||!Number.isSafeInteger(y)||!Number.isSafeInteger(columns)||
  !Number.isSafeInteger(rows)||columns<1||rows<1||columns>72||rows>72||
  !SCALE_LEVELS.includes(scale))throw Error('Invalid atlas viewport');
 GRID.tile(x,y);
 const tiles=[];
 for(let iy=0;iy<rows;iy++){
  const row=[];
  for(let ix=0;ix<columns;ix++){
   const px=x+ix*scale+Math.floor(scale/2),py=y+iy*scale+Math.floor(scale/2);
   if(px>=GRID.WIDTH||py>=GRID.HEIGHT){row.push(null);continue;}
   const o=TERRAIN.override(world,px,py),base=world.world_grid?.terrain?.cells?.[
     Math.floor(px/GRID.CELL)+'.'+Math.floor(py/GRID.CELL)]??null;
   row.push({material:o?.material??base??TERRAIN.DEFAULTS.material,
     elevation:o?.elevation??TERRAIN.DEFAULTS.elevation,
     painted:Boolean(o||base),
     // The old 4-cell M68 scene is intentionally not the new world atlas.
     cell_x:Math.floor(px/GRID.CELL),cell_y:Math.floor(py/GRID.CELL)});
  }
  tiles.push(row);
 }
 return {format:'dk.world.atlas.m70',revision:world.revision,
  width:GRID.WIDTH,height:GRID.HEIGHT,
  tile_size:GRID.TILE,cell_size:GRID.CELL,sector_size:GRID.SECTOR,
  x,y,scale,columns,rows,tiles,defaults:TERRAIN.DEFAULTS};
}
function coverage(world){
 const terrain=world.world_grid?.terrain||{},cells=terrain.cells||{};
 const total=GRID.WIDTH*GRID.HEIGHT,cellArea=GRID.CELL*GRID.CELL;
 const base=TERRAIN.DEFAULTS.material,materials={[base]:total};
 let authored=0,water=SEA.has(base)?total:0;
 for(const type of Object.values(cells)){
  authored+=cellArea;
  materials[base]-=cellArea;
  materials[type]=(materials[type]||0)+cellArea;
  if(SEA.has(type))water+=cellArea;
  if(SEA.has(base))water-=cellArea;
 }
 for(const [name,sector] of Object.entries(terrain.sectors||{})){
  const [sx,sy]=name.split('.').map(Number);
  for(const [idx,value]of Object.entries(sector.tiles)){
   const x=sx*GRID.SECTOR+Number(idx)%GRID.SECTOR,
    y=sy*GRID.SECTOR+Math.floor(Number(idx)/GRID.SECTOR),
    cell=cells[Math.floor(x/GRID.CELL)+'.'+Math.floor(y/GRID.CELL)]??null;
   if(cell===null)authored++;
   const old=cell??base,material=value.material??old;
   if(material===old)continue;
   materials[old]--;
   materials[material]=(materials[material]||0)+1;
   if(SEA.has(old))water--;
   if(SEA.has(material))water++;
  }
 }
 return {
  world_tiles:total,authored_tiles:authored,
  default_material:base,default_elevation:TERRAIN.DEFAULTS.elevation,
  unedited_tiles:total-authored,
  grass_tiles:materials.grass||0,
  water_tiles:water,water_percent:Number((water/total*100).toFixed(4)),
  target_water_percent:33.3333,materials,
  note:'Unpainted terrain is flat grass. Coverage counts authored cell and tile overrides; legacy preview scenery is separate.'
 };
}
module.exports={view,editCells,coverage,validateCellCommand,cellMaterial,
 MAX_CELLS_PER_EDIT,SCALE_LEVELS};
