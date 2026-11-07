'use strict';
// M33: original-design Streaming Cells reconstructed for the JavaScript runtime.
// Distinct from 16x16 terrain sectors: cells are variable-sized named world units.
// All geometry and doors remain server-owned in world.areas; this module
// persists only cell visits/identity, never duplicate terrain or inventory.
const {TEMPLE,COURT,VILLAGE}=require('./regions.cjs');
const SCHEMA=1,MAX_CELLS=512,MAX_RECORDS=512,MAX_LINKS=64;
const ROOT_IDS=Object.freeze({
 [TEMPLE]:'dk.cell.temple',
 [COURT]:'dk.cell.courtyard',
 [VILLAGE]:'dk.cell.village'
});
const BUILDINGS=new Set(['temple_exterior','house','bank','bakery','smithy','tavern']);
const FORMS=new Set(['active','near','dormant']);
function rootId(area_id){return ROOT_IDS[area_id]||null;}
function objectCellId(area_id,object_id){
 const root=rootId(area_id);
 if(!root||typeof object_id!=='string'||!/^[a-z0-9_-]{1,80}$/.test(object_id))
  throw Error('Invalid streaming cell object id');
 return root+'/building/'+object_id;
}
function bounds(a){return {x:0,y:0,width:a.width,height:a.height};}
function catalogue(world){
 if(!world?.areas||typeof world.areas!=='object')throw Error('Missing streaming cell areas');
 const cells={},links=[],roots={};
 for(const [area_id,area] of Object.entries(world.areas)){
  const id=rootId(area_id);
  if(!id)continue;
  if(!Number.isInteger(area.width)||!Number.isInteger(area.height)||
   area.width<16||area.height<16||area.width>512||area.height>512)
   throw Error('Invalid streaming cell region bounds');
  roots[area_id]=id;
  cells[id]={id,area_id,parent:null,kind:'region',bounds:bounds(area),
   interior_ready:true,children:[],object_id:null};
 }
 for(const [area_id,area] of Object.entries(world.areas)){
  const root=roots[area_id];if(!root)continue;
  for(const o of area.objects||[]){
   if(BUILDINGS.has(o.type)&&Number.isInteger(o.w)&&Number.isInteger(o.h)&&
    o.w>0&&o.h>0){
    const id=objectCellId(area_id,o.id);
    if(cells[id])throw Error('Duplicate streaming cell');
    if(o.x<0||o.y<0||o.x+o.w>area.width||o.y+o.h>area.height)
     throw Error('Invalid streaming building footprint');
    cells[id]={id,area_id,parent:root,kind:'building',
     bounds:{x:o.x,y:o.y,width:o.w,height:o.h},
     interior_ready:o.interior_ready===true,
     object_id:o.id,children:[],
     doorway:o.door?{x:o.door.x,y:o.door.y}:null};
    cells[root].children.push(id);
   }
   const target=typeof o.link==='string'?o.link:
    area_id===TEMPLE&&o.id==='temple_north_door'?COURT:null;
   if(target&&roots[target]){
    const edge={id:area_id+':'+o.id,from:root,to:roots[target],
     area_id,object_id:o.id,at:{x:o.x,y:o.y},
     open:o.open!==false,kind:o.type==='gate'?'gate':'door'};
    links.push(edge);
   }
  }
 }
 if(Object.keys(cells).length>MAX_CELLS||links.length>MAX_LINKS)
  throw Error('Streaming cell catalogue limit exceeded');
 for(const cell of Object.values(cells))cell.children.sort();
 links.sort((a,b)=>a.id.localeCompare(b.id));
 return {schema:SCHEMA,roots,cells,links};
}
function ensure(world){
 if(!world.living)throw Error('Streaming cells require a living world');
 const graph=catalogue(world);
 let changed=false;
 if(!world.living.streaming_cells){
  world.living.streaming_cells={schema:SCHEMA,records:{},current:null};changed=true;
 }
 const state=world.living.streaming_cells;
 if(!state.records||Array.isArray(state.records)||typeof state.records!=='object')
  throw Error('Invalid streaming cell records');
 const player=world.characters?.['1'];
 if(player){
  const id=graph.roots[player.area_id];
  if(!id)throw Error('Unknown active streaming cell');
  if(!state.records[id]){
   state.records[id]={visits:1,first_minute:world.living.minute,
    last_minute:world.living.minute};changed=true;
  }
  if(state.current!==id){state.current=id;changed=true;}
 }else if(state.current!==null){state.current=null;changed=true;}
 return changed;
}
function validate(world){
 const state=world.living?.streaming_cells;
 if(!state)return true; // M32 and older saves migrate before commit.
 const graph=catalogue(world);
 if(state.schema!==SCHEMA||!state.records||Array.isArray(state.records)||
  typeof state.records!=='object'||Object.keys(state.records).length>MAX_RECORDS)
  throw Error('Invalid persistent streaming cells');
 const player=world.characters?.['1'];
 if(state.current!==null&&(!player||state.current!==rootId(player.area_id)))
  throw Error('Invalid current streaming cell');
 for(const [id,r] of Object.entries(state.records)){
  if(!graph.cells[id]||!r||
   !Number.isSafeInteger(r.visits)||r.visits<1||r.visits>1e9||
   !Number.isSafeInteger(r.first_minute)||r.first_minute<0||
   !Number.isSafeInteger(r.last_minute)||r.last_minute<r.first_minute||
   r.last_minute>world.living.minute)
   throw Error('Invalid durable streaming cell visit');
 }
 return true;
}
function appendEvent(world,type,minute,from,to){
 const l=world.living;
 const e={id:'event_'+(++l.event_sequence),minute,type,
  text:type==='cell.enter'?'A streaming cell became active.':'A streaming cell was left.',
  from_cell:from,to_cell:to,area_id:world.characters['1']?.area_id||null};
 l.events.push(e);if(l.events.length>512)l.events.shift();
 return e;
}
function onPlayerMove(world,previous){
 const after=world.characters?.['1'];
 if(!after)return [];
 const before=rootId(previous?.area_id),now=rootId(after.area_id);
 if(!now)throw Error('Unknown destination streaming cell');
 const existed=Boolean(world.living?.streaming_cells?.records?.[now]);
 ensure(world); // Seeds the destination once for migrated saves.
 if(before===now)return [];
 const state=world.living.streaming_cells,minute=world.living.minute;
 if(existed)state.records[now].visits++;
 state.records[now].last_minute=minute;state.current=now;
 return [appendEvent(world,'cell.exit',minute,before,now),
  appendEvent(world,'cell.enter',minute,before,now)];
}
function rectangleDistance(rect,x,y){
 const rx=Math.max(rect.x-x,0,x-(rect.x+rect.width-1));
 const ry=Math.max(rect.y-y,0,y-(rect.y+rect.height-1));
 return rx+ry;
}
function streamingView(world,{slot=1,radius=24}={}){
 if(slot!==1||!Number.isInteger(radius)||radius<8||radius>32)
  throw Error('Invalid streaming cell view');
 const player=world.characters?.[String(slot)];
 if(!player)throw Error('No character exists');
 const graph=catalogue(world),home=graph.roots[player.area_id];
 if(!home)throw Error('Unknown current streaming cell');
 const root=graph.cells[home],objects=[];
 for(const id of root.children){
  const entry=graph.cells[id],distance=rectangleDistance(entry.bounds,player.x,player.y);
  const lod=distance<=8?'active':distance<=radius?'near':'dormant';
  // Distant buildings remain in the authoritative world but are not
  // materialized in the local client's nearby object-shell list.
  if(lod!=='dormant')objects.push({...entry,lod,distance});
 }
 objects.sort((a,b)=>a.distance-b.distance||a.id.localeCompare(b.id));
 const links=graph.links.filter(e=>e.from===home).map(e=>({...e}));
 const state=world.living.streaming_cells||{records:{},current:null};
 return {schema:SCHEMA,area_id:player.area_id,current_cell:home,
  root:{...root,lod:'active'},children:objects,links,
  visited:{...state.records[home]},world_minute:world.living.minute,
  world_revision:world.revision,sector_size:16};
}
module.exports={SCHEMA,ROOT_IDS,MAX_CELLS,rootId,objectCellId,
 catalogue,ensure,validate,onPlayerMove,streamingView,rectangleDistance};
