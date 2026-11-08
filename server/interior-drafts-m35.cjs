'use strict';
// DK Server M35: durable variable-size, UNPUBLISHED Streaming Cell interiors.
// The live world is authoritative. These records live in world.json and are
// never interpreted as traversable rooms until a separately approved build.
const {catalogue}=require('./streaming-cells-m33.cjs');
const SCHEMA=1,MAX_DRAFTS=32,MAX_TOTAL_TILES=16384,MAX_ROOM_TILES=2048;
const MAX_BATCH=32,MAX_OBJECTS=96,LAYERS=Object.freeze([
 'floor','walls','wallStyles','wallVariants','wallPacks','wallRotations','floorArt'
]);
const FLOORS=new Set(['stone','dark','cracked','sigil','grass','path',
 'garden','roof','dirt','wood']);
const WALL_STYLES=new Set(['clean','cracked','dark','mossy']);
const WALL_PACKS=new Set(['ox72i']);
const OBJECT_TYPES=new Set(['altar','brazier','crystal','runestone','chest',
 'coffin','pew','pillar','statue','candle','table','chair','bed','rug',
 'crate','barrel','sconce','bookcase','door']);
const ID_RE=/^[a-z0-9_-]{1,80}$/;
function validDimension(v){return Number.isSafeInteger(v)&&v>=4&&v<=64;}
function validObject(o,width,height){
 return o&&typeof o==='object'&&!Array.isArray(o)&&
  typeof o.id==='string'&&ID_RE.test(o.id)&&OBJECT_TYPES.has(o.type)&&
  Number.isSafeInteger(o.x)&&Number.isSafeInteger(o.y)&&
  Number.isSafeInteger(o.w)&&Number.isSafeInteger(o.h)&&
  o.w>=1&&o.h>=1&&o.w<=8&&o.h<=8&&
  o.x>=0&&o.y>=0&&o.x+o.w<=width&&o.y+o.h<=height&&
  (o.r===undefined||[0,1,2,3].includes(o.r));
}
function validValue(layer,value){
 if(layer==='floor')return typeof value==='string'&&FLOORS.has(value);
 if(layer==='walls')return value===0||value===1;
 if(layer==='wallStyles')return typeof value==='string'&&WALL_STYLES.has(value);
 if(layer==='wallVariants'||layer==='floorArt')
  return value===null||(typeof value==='string'&&ID_RE.test(value));
 if(layer==='wallPacks')return typeof value==='string'&&WALL_PACKS.has(value);
 if(layer==='wallRotations')return [0,1,2,3].includes(value);
 return false;
}
function defaultLayers(width,height){
 const n=width*height,layers={
  floor:Array(n).fill('stone'),
  walls:Array(n).fill(0),
  wallStyles:Array(n).fill('clean'),
  wallVariants:Array(n).fill(null),
  wallPacks:Array(n).fill('ox72i'),
  wallRotations:Array(n).fill(0),
  floorArt:Array(n).fill(null)
 };
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  if(x===0||y===0||x===width-1||y===height-1)
   layers.walls[y*width+x]=1;
 }
 // Entry is structural only. It does not create a world portal.
 layers.walls[(height-1)*width+Math.floor(width/2)]=0;
 return layers;
}
function state(world){
 return world.living?.interior_drafts;
}
function ensure(world){
 if(!world.living)throw Error('Interior drafts require the living world');
 if(!state(world)){
  world.living.interior_drafts={schema:SCHEMA,records:{}};
  return true;
 }
 return false;
}
function validate(world){
 const s=state(world);
 if(!s)return true; // M34 and older files are migrated at startup.
 if(!s||s.schema!==SCHEMA||!s.records||
  typeof s.records!=='object'||Array.isArray(s.records)||
  Object.keys(s.records).length>MAX_DRAFTS)
  throw Error('Invalid saved interior draft store');
 const graph=catalogue(world);let tiles=0;
 for(const [cell_id,d] of Object.entries(s.records)){
  const cell=graph.cells[cell_id];
  if(!cell||cell.kind!=='building'||!d||d.cell_id!==cell_id||
   d.status!=='draft'||!validDimension(d.width)||!validDimension(d.height)||
   d.width*d.height>MAX_ROOM_TILES||!Number.isSafeInteger(d.revision)||
   d.revision<1||d.revision>1e9||
   !Number.isSafeInteger(d.created_minute)||d.created_minute<0||
   !Number.isSafeInteger(d.updated_minute)||d.updated_minute<d.created_minute||
   d.updated_minute>world.living.minute||
   typeof d.title!=='string'||d.title.length>48||
   !d.layers||typeof d.layers!=='object'||
   !Array.isArray(d.objects)||d.objects.length>MAX_OBJECTS||
   !d.entry||!Number.isSafeInteger(d.entry.x)||!Number.isSafeInteger(d.entry.y)||
   d.entry.x<0||d.entry.x>=d.width||d.entry.y<0||d.entry.y>=d.height)
   throw Error('Invalid saved interior blueprint');
  const n=d.width*d.height;tiles+=n;
  if(tiles>MAX_TOTAL_TILES)throw Error('Interior draft tile budget exceeded');
  if(Object.keys(d.layers).length!==LAYERS.length)
   throw Error('Invalid interior tile layers');
  for(const key of LAYERS){
   const layer=d.layers[key];
   if(!Array.isArray(layer)||layer.length!==n||
    layer.some(x=>!validValue(key,x)))
    throw Error('Invalid interior tile layer: '+key);
  }
  const seen=new Set();
  for(const o of d.objects){
   if(!validObject(o,d.width,d.height)||seen.has(o.id))
    throw Error('Invalid or duplicate interior object');
   seen.add(o.id);
  }
 }
 return true;
}
function details(world,cell_id){
 const g=catalogue(world),cell=g.cells[cell_id];
 if(!cell||cell.kind!=='building')throw Error('Unknown building Streaming Cell');
 return cell;
}
function listing(world){
 const g=catalogue(world),drafts=state(world)?.records||{};
 return {schema:SCHEMA,world_revision:world.revision,entries:
  Object.values(g.cells).filter(c=>c.kind==='building')
   .map(c=>({cell_id:c.id,area_id:c.area_id,object_id:c.object_id,
    exterior:{...c.bounds},interior_ready:c.interior_ready,
    draft:!!drafts[c.id],draft_revision:drafts[c.id]?.revision||0,
    draft_dimensions:drafts[c.id]?
     {width:drafts[c.id].width,height:drafts[c.id].height}:null}))
   .sort((a,b)=>a.cell_id.localeCompare(b.cell_id))};
}
function read(world,cell_id){
 details(world,cell_id);
 const draft=state(world)?.records?.[cell_id];
 return {cell_id,draft:draft?structuredClone(draft):null,
  world_revision:world.revision};
}
function edit(world,command){
 if(!command||typeof command!=='object'||Array.isArray(command)||
  typeof command.action!=='string'||typeof command.cell_id!=='string'||
  !Number.isSafeInteger(command.expected_revision)||command.expected_revision<0)
  throw Error('Invalid interior architect command');
 const cell=details(world,command.cell_id),old=state(world)?.records?.[command.cell_id];
 if((old?.revision||0)!==command.expected_revision)
  throw Error('Stale interior draft revision');
 const next=structuredClone(world);ensure(next);
 const store=next.living.interior_drafts.records;
 let draft=store[command.cell_id];
 if(command.action==='create_draft'){
  if(draft)throw Error('Interior draft already exists');
  if(Object.keys(store).length>=MAX_DRAFTS)
   throw Error('Interior draft quota reached');
  const width=command.width,height=command.height;
  if(!validDimension(width)||!validDimension(height)||
   width*height>MAX_ROOM_TILES)
   throw Error('Invalid interior dimensions');
  const total=Object.values(store).reduce((sum,d)=>sum+d.width*d.height,0);
  if(total+width*height>MAX_TOTAL_TILES)
   throw Error('Interior draft tile budget exceeded');
  const title=command.title===undefined?cell.object_id:command.title;
  if(typeof title!=='string'||!title.trim()||title.length>48)
   throw Error('Invalid interior title');
  draft={cell_id:cell.id,status:'draft',revision:1,
   width,height,title,created_minute:next.living.minute,
   updated_minute:next.living.minute,
   entry:{x:Math.floor(width/2),y:height-1},
   layers:defaultLayers(width,height),objects:[]};
  store[cell.id]=draft;
 }else if(command.action==='paint_tiles'){
  if(!draft)throw Error('Interior draft does not exist');
  const patches=command.patches;
  if(!Array.isArray(patches)||!patches.length||patches.length>MAX_BATCH)
   throw Error('Invalid interior tile batch');
  const seen=new Set();
  for(const patch of patches){
   if(!patch||!LAYERS.includes(patch.layer)||
    !Number.isSafeInteger(patch.x)||!Number.isSafeInteger(patch.y)||
    patch.x<0||patch.y<0||patch.x>=draft.width||patch.y>=draft.height||
    !validValue(patch.layer,patch.value))
    throw Error('Invalid interior tile patch');
   const key=patch.layer+':'+patch.x+','+patch.y;
   if(seen.has(key))throw Error('Duplicate interior tile patch');
   seen.add(key);
   if(patch.layer==='walls'&&patch.x===draft.entry.x&&
    patch.y===draft.entry.y&&patch.value!==0)
    throw Error('Interior entry cannot be sealed');
  }
  for(const patch of patches)
   draft.layers[patch.layer][patch.y*draft.width+patch.x]=patch.value;
 }else if(command.action==='place_object'){
  if(!draft)throw Error('Interior draft does not exist');
  const object=command.object;
  if(!validObject(object,draft.width,draft.height))
   throw Error('Invalid interior object placement');
  if(draft.objects.length>=MAX_OBJECTS)
   throw Error('Interior object quota reached');
  if(draft.objects.some(o=>o.id===object.id))
   throw Error('Duplicate interior object id');
  draft.objects.push({
   id:object.id,type:object.type,x:object.x,y:object.y,
   w:object.w,h:object.h,r:object.r||0
  });
  draft.objects.sort((a,b)=>a.id.localeCompare(b.id));
 }else if(command.action==='remove_object'){
  if(!draft)throw Error('Interior draft does not exist');
  const i=draft.objects.findIndex(o=>o.id===command.object_id);
  if(i<0)throw Error('Interior object not found');
  draft.objects.splice(i,1);
 }else if(command.action==='rename_draft'){
  if(!draft||typeof command.title!=='string'||
   !command.title.trim()||command.title.length>48)
   throw Error('Invalid interior title');
  draft.title=command.title.trim();
 }else{
  throw Error('Unsupported interior draft action');
 }
 if(command.action!=='create_draft')draft.revision++;
 draft.updated_minute=next.living.minute;
 next.revision++;
 const event={id:'event_'+(++next.living.event_sequence),
  minute:next.living.minute,type:'architect.interior.draft',
  text:'Interior draft updated.',cell_id:cell.id,action:command.action};
 next.living.events.push(event);
 if(next.living.events.length>512)next.living.events.shift();
 validate(next);
 return {world:next,draft:structuredClone(draft),event};
}
module.exports={SCHEMA,MAX_DRAFTS,MAX_TOTAL_TILES,MAX_ROOM_TILES,
 MAX_BATCH,MAX_OBJECTS,LAYERS,defaultLayers,ensure,validate,
 listing,read,edit,validObject};
