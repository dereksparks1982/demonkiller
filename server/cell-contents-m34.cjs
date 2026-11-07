'use strict';
// Demon Killer M34: authoritative Streaming Cell contents and lifecycle.
// Entity coordinates, ownership, doors and persistence remain in world.json;
// this is a bounded, derived view with temporary per-client delta cursors.
const crypto=require('node:crypto');
const {catalogue,rootId,rectangleDistance}=require('./streaming-cells-m33.cjs');
const {build:buildSectors}=require('./sectors-m10.cjs');
const RADIUS=24,MIN_RADIUS=8,MAX_RADIUS=32,MAX_ENTITIES=512;
const MAX_SESSIONS=16,SESSION_MS=90_000,MAX_ACTIVE_CHILDREN=32;
function checkRadius(radius){
 if(!Number.isSafeInteger(radius)||radius<MIN_RADIUS||radius>MAX_RADIUS)
  throw Error('Invalid streaming contents radius');
}
function distance(x,y,player){return Math.abs(x-player.x)+Math.abs(y-player.y);}
function entityKey(item){return item.kind+':'+item.id;}
function asPosition(world){
 const p=world.characters?.['1'];
 if(!p||!world.areas?.[p.area_id]||
  !Number.isInteger(p.x)||!Number.isInteger(p.y))
  throw Error('No playable streaming character');
 return p;
}
function records(world,{radius=RADIUS}={}){
 checkRadius(radius);
 const player=asPosition(world),g=catalogue(world);
 const home=g.roots[player.area_id],area=world.areas[player.area_id],cells=[];
 if(!home||!area)throw Error('Unknown streaming root cell');
 cells.push({id:home,kind:'region',lod:'active',
  bounds:g.cells[home].bounds,interior_ready:true,parent:null});
 const liveChild=new Map();
 for(const id of g.cells[home].children){
  const c=g.cells[id],d=rectangleDistance(c.bounds,player.x,player.y);
  if(d>radius)continue;
  const lod=d<=8?'active':'near';
  const view={id,kind:'building',lod,bounds:c.bounds,
   object_id:c.object_id,interior_ready:c.interior_ready,parent:home};
  cells.push(view);liveChild.set(c.object_id,view);
 }
 if(cells.length>MAX_ACTIVE_CHILDREN+1)
  throw Error('Streaming cell materialization limit exceeded');
 const entities=new Map(),add=item=>{
  if(entities.size>=MAX_ENTITIES)throw Error('Streaming cell content limit exceeded');
  const key=entityKey(item);
  if(entities.has(key))throw Error('Duplicate streaming cell entity');
  entities.set(key,item);
 };
 const original=area.objects||[];
 const refs=world.entity_registry?.refs||{};
 for(const o of original){
  const child=liveChild.get(o.id),w=o.w||1,h=o.h||1;
  const d=rectangleDistance({x:o.x,y:o.y,width:w,height:h},player.x,player.y);
  if(d>radius)continue;
  const cell_id=child?.id||home;
  const item={kind:'fixture',id:o.id,area_id:player.area_id,cell_id,
   x:o.x,y:o.y,w,h,type:o.type,serial:refs['fixture:'+player.area_id+':'+o.id]?.serial||null};
  if(Object.prototype.hasOwnProperty.call(o,'open'))item.open=o.open;
  if(Object.prototype.hasOwnProperty.call(o,'locked'))item.locked=o.locked;
  // Don't serialize unknown private metadata or inaccessible interiors.
  add(item);
 }
 const sectors=buildSectors(world);
 for(const group of sectors.sectors.values())
  for(const e of group){
   if(e.area_id!==player.area_id||e.kind==='fixture'||e.kind==='character')continue;
   if(distance(e.x,e.y,player)>radius)continue;
   const item={...e,cell_id:home};
   // "kind" is the entity category. Carrion species belongs in a separate field.
   if(item.kind==='scavenger'&&typeof item.type==='string')
    item.species=item.type;
   if(item.kind==='corpse'&&typeof item.kind_of_remains==='string')
    item.remains_kind=item.kind_of_remains;
   add(item);
  }
 // The player is authoritative but is not echoed as a second renderable NPC.
 cells.sort((a,b)=>a.id.localeCompare(b.id));
 return {world_id:world.world_id,area_id:player.area_id,root_cell:home,
  origin:{x:player.x,y:player.y},radius,world_revision:world.revision,
  world_minute:world.living.minute,cells,entities};
}
function createTracker({now=Date.now,maxSessions=MAX_SESSIONS}={}){
 if(!Number.isSafeInteger(maxSessions)||maxSessions<1||maxSessions>64)
  throw Error('Invalid streaming contents session limit');
 const sessions=new Map();
 function prune(){
  const t=now();
  for(const [k,v] of sessions)
   if(t-v.time>SESSION_MS)sessions.delete(k);
 }
 function poll(world,{radius=RADIUS,cursor=null}={}){
  checkRadius(radius);
  if(cursor!==null&&(typeof cursor!=='string'||!/^[a-f0-9]{32}$/.test(cursor)))
   throw Error('Invalid streaming contents cursor');
  prune();
  const previous=cursor===null?null:sessions.get(cursor);
  if(cursor!==null)sessions.delete(cursor);
  const snapshot=records(world,{radius});
  const reset=!previous||previous.world_id!==snapshot.world_id||
   previous.area_id!==snapshot.area_id||previous.radius!==radius;
  const cells=new Map(snapshot.cells.map(c=>[c.id,JSON.stringify(c)]));
  const entities=new Map([...snapshot.entities].map(([k,v])=>[k,JSON.stringify(v)]));
  const cell_upsert=snapshot.cells.filter(c=>reset||previous.cells.get(c.id)!==cells.get(c.id));
  const cell_removed=reset?[]:[...previous.cells.keys()].filter(k=>!cells.has(k)).sort();
  const upsert=[...snapshot.entities].filter(([k,v])=>
   reset||previous.entities.get(k)!==entities.get(k)).map(([,v])=>v);
  const removed=reset?[]:[...previous.entities.keys()].filter(k=>!entities.has(k)).sort();
  upsert.sort((a,b)=>entityKey(a).localeCompare(entityKey(b)));
  while(sessions.size>=maxSessions)sessions.delete(sessions.keys().next().value);
  const next=crypto.randomBytes(16).toString('hex');
  sessions.set(next,{world_id:snapshot.world_id,area_id:snapshot.area_id,
   radius,time:now(),cells,entities});
  return {schema:1,area_id:snapshot.area_id,root_cell:snapshot.root_cell,
   origin:snapshot.origin,world_minute:snapshot.world_minute,
   world_revision:snapshot.world_revision,reset,cursor:next,radius,
   cell_upsert,cell_removed,upsert,removed,
   cell_count:cells.size,entity_count:entities.size};
 }
 return {poll,clear:()=>sessions.clear(),sessionCount:()=>sessions.size};
}
module.exports={RADIUS,MIN_RADIUS,MAX_RADIUS,MAX_ENTITIES,MAX_ACTIVE_CHILDREN,
 MAX_SESSIONS,SESSION_MS,records,createTracker,entityKey};
