'use strict';
// M34: browser materialization for the server's Streaming Cell content deltas.
// No local save authority, no invented objects and no movement changes.
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.DKCellContents=api;
})(typeof window!=='undefined'?window:null,function(){
 const LIMIT=512,CELL_LIMIT=33;
 function create(){
  let area_id=null,origin=null,cursor=null,world_revision=0;
  const entities=new Map(),cells=new Map();
  function reset(){
   entities.clear();cells.clear();area_id=null;origin=null;cursor=null;
   world_revision=0;
  }
  function apply(data){
   if(!data||data.schema!==1||typeof data.area_id!=='string'||
    typeof data.cursor!=='string'||!/^[a-f0-9]{32}$/.test(data.cursor)||
    !Number.isSafeInteger(data.world_revision)||
    !data.origin||!Number.isInteger(data.origin.x)||!Number.isInteger(data.origin.y)||
    !Array.isArray(data.upsert)||!Array.isArray(data.removed)||
    !Array.isArray(data.cell_upsert)||!Array.isArray(data.cell_removed)||
    typeof data.reset!=='boolean')
    throw Error('Invalid Streaming Cell contents response');
   if(!data.reset&&area_id!==data.area_id)
    throw Error('Streaming Cell response belongs to another area');
   if(data.upsert.length>LIMIT||data.cell_upsert.length>CELL_LIMIT||
    data.removed.length>LIMIT||data.cell_removed.length>CELL_LIMIT)
    throw Error('Streaming Cell response limit exceeded');
   const nextEntities=data.reset?new Map():new Map(entities);
   const nextCells=data.reset?new Map():new Map(cells);
   for(const key of data.removed){
    if(typeof key!=='string'||key.length>150)throw Error('Invalid Streaming Cell removal');
    nextEntities.delete(key);
   }
   for(const key of data.cell_removed){
    if(typeof key!=='string'||key.length>150)throw Error('Invalid Streaming Cell deactivation');
    nextCells.delete(key);
   }
   for(const cell of data.cell_upsert){
    if(!cell||typeof cell.id!=='string'||cell.id.length>150||
     !['region','building'].includes(cell.kind)||!['active','near'].includes(cell.lod))
     throw Error('Invalid Streaming Cell activation');
    nextCells.set(cell.id,{...cell});
   }
   for(const item of data.upsert){
    if(!item||typeof item.id!=='string'||typeof item.kind!=='string'||
     item.id.length>120||item.kind.length>40||item.area_id!==data.area_id||
     typeof item.cell_id!=='string'||!Number.isInteger(item.x)||!Number.isInteger(item.y))
     throw Error('Invalid Streaming Cell entity');
    nextEntities.set(item.kind+':'+item.id,{...item});
   }
   if(nextEntities.size>LIMIT||nextCells.size>CELL_LIMIT)
    throw Error('Streaming Cell materialization limit exceeded');
   entities.clear();cells.clear();
   for(const [key,value] of nextEntities)entities.set(key,value);
   for(const [key,value] of nextCells)cells.set(key,value);
   area_id=data.area_id;origin={...data.origin};cursor=data.cursor;
   world_revision=data.world_revision;
   return stats();
  }
  function visible(kind,player,maxDrift=12){
   if(!player||player.area_id!==area_id||!origin||
    Math.abs(player.x-origin.x)>maxDrift||
    Math.abs(player.y-origin.y)>maxDrift)return null;
   return [...entities.values()].filter(e=>e.kind===kind);
  }
  function stats(){return {area_id,world_revision,entity_count:entities.size,
   cell_count:cells.size,cursor,origin:origin?{...origin}:null};}
  function fixtures(){return [...entities.values()].filter(e=>e.kind==='fixture');}
  return {apply,reset,visible,fixtures,stats};
 }
 return {LIMIT,CELL_LIMIT,create};
});
