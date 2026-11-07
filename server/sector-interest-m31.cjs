'use strict';
// DK Server M31: server-derived sector interest, bounded client cursors,
// and fixed-size map chunks. Derived from world state; never a save authority.
const crypto=require('node:crypto');
const S=require('./sectors-m10.cjs');
const SIZE=S.SECTOR_SIZE;
const MIN_RADIUS=8,MAX_RADIUS=32,DEFAULT_RADIUS=24;
const MAX_SESSIONS=16,EXPIRE_MS=90_000,MAX_OBJECTS=2048;
function position(world,slot){
 if(slot!==1)throw Error('Invalid player slot');
 const c=world.characters?.[String(slot)];
 if(!c)throw Error('No character exists');
 const area=world.areas?.[c.area_id];
 if(!area||!Number.isInteger(c.x)||!Number.isInteger(c.y)||
  c.x<0||c.y<0||c.x>=area.width||c.y>=area.height)
  throw Error('Invalid player sector position');
 return {c,area};
}
function validateRadius(radius){
 if(!Number.isSafeInteger(radius)||radius<MIN_RADIUS||radius>MAX_RADIUS)
  throw Error('Invalid sector interest radius');
 return radius;
}
function sectorBounds(area,sx,sy){
 if(!Number.isSafeInteger(sx)||!Number.isSafeInteger(sy)||
  sx<0||sy<0||sx>=Math.ceil(area.width/SIZE)||
  sy>=Math.ceil(area.height/SIZE))throw Error('Invalid sector coordinate');
 return {x:sx*SIZE,y:sy*SIZE,
  width:Math.min(SIZE,area.width-sx*SIZE),
  height:Math.min(SIZE,area.height-sy*SIZE)};
}
function nearbySectors(world,slot=1,radius=DEFAULT_RADIUS){
 validateRadius(radius);
 const {c,area}=position(world,slot);
 const home=S.cell(c.x,c.y),x0=Math.max(0,Math.floor((c.x-radius)/SIZE)),
  x1=Math.min(Math.ceil(area.width/SIZE)-1,Math.floor((c.x+radius)/SIZE)),
  y0=Math.max(0,Math.floor((c.y-radius)/SIZE)),
  y1=Math.min(Math.ceil(area.height/SIZE)-1,Math.floor((c.y+radius)/SIZE));
 const tiles=[];
 for(let sy=y0;sy<=y1;sy++)for(let sx=x0;sx<=x1;sx++){
  const dx=Math.abs(home.sx-sx),dy=Math.abs(home.sy-sy);
  const tier=dx===0&&dy===0?'active':Math.max(dx,dy)===1?'neighbor':'prefetch';
  tiles.push({key:S.key(c.area_id,sx,sy),sx,sy,tier,
   ...sectorBounds(area,sx,sy)});
 }
 return {area_id:c.area_id,origin:{x:c.x,y:c.y},sector:home,
  radius,world_minute:world.living?.minute??0,sectors:tiles};
}
function tierFor(world,area_id,x,y){
 const c=world.characters?.['1'];
 if(!c)return 'background';
 if(c.area_id!==area_id)return 'background';
 const here=S.cell(c.x,c.y),other=S.cell(x,y);
 const d=Math.max(Math.abs(here.sx-other.sx),Math.abs(here.sy-other.sy));
 return d===0?'active':d===1?'neighbor':'background';
}
// Only expensive NPC threat sensing is tiered. The ordinary 5-minute
// movement step, needs, shops, combat and territory timers continue globally.
function npcSenseDue(world,npc,minute){
 if(!Number.isSafeInteger(minute)||minute<0)throw Error('Invalid NPC AI minute');
 if(minute%5!==0)return false;
 if(!world.characters?.['1'])return true;
 return tierFor(world,npc.area_id,npc.x,npc.y)!=='background'||minute%15===0;
}
function terrainChunk(world,{slot=1,area_id,sx,sy}){
 const {c}=position(world,slot),area=world.areas?.[area_id];
 if(!area||area_id!==c.area_id)throw Error('Sector is outside the current region');
 const here=S.cell(c.x,c.y),distance=Math.max(Math.abs(here.sx-sx),Math.abs(here.sy-sy));
 if(!Number.isInteger(sx)||!Number.isInteger(sy)||distance>2)
  throw Error('Sector is too far from the player');
 const bounds=sectorBounds(area,sx,sy),layers={};
 for(const key of ['floor','walls','wallStyles','wallVariants','wallPacks','wallRotations','floorArt']){
  if(!Array.isArray(area[key])||area[key].length!==area.width*area.height)
   throw Error('Invalid region tile layer');
  const rows=[];
  for(let y=bounds.y;y<bounds.y+bounds.height;y++){
   const row=[];
   for(let x=bounds.x;x<bounds.x+bounds.width;x++)
    row.push(area[key][y*area.width+x]);
   rows.push(row);
  }
  layers[key]=rows;
 }
 const objects=(area.objects||[]).filter(o=>{
  const w=o.w||1,h=o.h||1;
  return o.x<bounds.x+bounds.width&&o.x+w>bounds.x&&
   o.y<bounds.y+bounds.height&&o.y+h>bounds.y;
 }).map(o=>({id:o.id,type:o.type,x:o.x,y:o.y,
  w:o.w||1,h:o.h||1,open:o.open??null}));
 return {area_id,sx,sy,sector_size:SIZE,bounds,
  layers,objects,world_revision:world.revision};
}
function sectorEntities(index,visible){
 const items=new Map();
 for(const sector of visible.sectors){
  const group=index.sectors.get(sector.key)||[];
  for(const item of group){
   if(Math.abs(item.x-visible.origin.x)>visible.radius||
     Math.abs(item.y-visible.origin.y)>visible.radius)continue;
   const key=item.kind+':'+item.id;
   if(!items.has(key)){
    if(items.size>=MAX_OBJECTS)throw Error('Sector interest entity limit exceeded');
    items.set(key,{...item});
   }
  }
 }
 return items;
}
function createInterestTracker({now=Date.now,maxSessions=MAX_SESSIONS}={}){
 if(!Number.isSafeInteger(maxSessions)||maxSessions<1||maxSessions>64)
  throw Error('Invalid interest session limit');
 const sessions=new Map();
 function prune(){
  const time=now();
  for(const [key,session] of sessions)
   if(time-session.created_at>EXPIRE_MS)sessions.delete(key);
 }
 function poll(world,index,{slot=1,cursor=null,radius=DEFAULT_RADIUS}={}){
  validateRadius(radius);
  if(cursor!==null&&(typeof cursor!=='string'||!/^[a-f0-9]{32}$/.test(cursor)))
   throw Error('Invalid sector cursor');
  prune();
  const view=nearbySectors(world,slot,radius);
  const previous=cursor===null?null:sessions.get(cursor);
  if(cursor!==null)sessions.delete(cursor); // One-use cursor prevents stale replay.
  // Evict only after preserving the cursor actively being continued.
  while(sessions.size>=maxSessions)sessions.delete(sessions.keys().next().value);
  const reset=!previous||previous.area_id!==view.area_id||
   previous.radius!==radius||previous.world_id!==world.world_id;
  const entries=sectorEntities(index,view);
  const upsert=[],removed=[];
  for(const [key,item] of entries){
   const digest=JSON.stringify(item);
   if(reset||previous.entries.get(key)!==digest)upsert.push(item);
  }
  if(!reset)for(const key of previous.entries.keys())
   if(!entries.has(key))removed.push(key);
  upsert.sort((a,b)=>a.kind.localeCompare(b.kind)||a.id.localeCompare(b.id));
  removed.sort();
  const nextCursor=crypto.randomBytes(16).toString('hex');
  const nextEntries=new Map([...entries].map(([key,item])=>[key,JSON.stringify(item)]));
  sessions.set(nextCursor,{world_id:world.world_id,area_id:view.area_id,
   radius,created_at:now(),entries:nextEntries});
  return {...view,reset,cursor:nextCursor,world_revision:world.revision,
   upsert,removed,entity_count:entries.size};
 }
 return {poll,activeSessions:()=>sessions.size,clear:()=>sessions.clear()};
}
module.exports={SIZE,MIN_RADIUS,MAX_RADIUS,DEFAULT_RADIUS,MAX_SESSIONS,
 EXPIRE_MS,MAX_OBJECTS,sectorBounds,nearbySectors,tierFor,terrainChunk,
 sectorEntities,createInterestTracker,npcSenseDue};
