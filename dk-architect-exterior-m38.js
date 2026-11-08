/* DK Architect M38: one movement rule for browser drafts and the real server.
 * Move actual footprint tile layers; restore what was underneath each building.
 * Protected paths, portal, temple, willow and existing properties stay untouched.
 */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.DKExteriorGeometry=api;
})(typeof window!=='undefined'?window:null,function(){
'use strict';
const FIELDS=['floor','walls','wallStyles','wallVariants','wallPacks','wallRotations','floorArt'];
const BASE=['grass',0,'clean',null,'ox72i',0,null];
const BUILDINGS=new Set(['house','bank','bakery','smithy','tavern']);
const ACCEPT=new Set(['grass','dirt','garden']);
const rect=o=>({x:o.x,y:o.y,w:o.w||1,h:o.h||1});
const overlaps=(a,b)=>a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h;
const idx=(a,x,y)=>y*a.width+x;
const tile=(a,x,y)=>FIELDS.map(k=>a[k][idx(a,x,y)]);
const put=(a,x,y,values)=>{FIELDS.forEach((k,j)=>{a[k][idx(a,x,y)]=values[j];});};
const inside=(r,x,y)=>x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h;
function test(area,id,x,y){
 const o=area?.objects?.find(item=>item.id===id);
 if(!o||!BUILDINGS.has(o.type))throw Error('Select a whole house or shop to move');
 if(!Number.isSafeInteger(x)||!Number.isSafeInteger(y))throw Error('Move requires a grid position');
 const old=rect(o),next={x,y,w:old.w,h:old.h};
 if(x===old.x&&y===old.y)throw Error('Drag to a different tile');
 if(x<1||y<1||x+next.w>=area.width||y+next.h>=area.height)
  throw Error('Building would cross the world boundary');
 const block=area.objects.find(other=>other.id!==id&&overlaps(next,rect(other)));
 if(block)throw Error('Blocked by '+block.id+'; move beside it');
 const originalUnderlay=Array.isArray(o._underlay)&&o._underlay.length===old.w*old.h?
  o._underlay:null;
 const groundAt=(gx,gy)=>{
  if(inside(old,gx,gy)){
   const n=(gy-old.y)*old.w+(gx-old.x);
   return originalUnderlay?.[n]||BASE;
  }
  return tile(area,gx,gy);
 };
 const underlay=[];
 for(let yy=y;yy<y+next.h;yy++)for(let xx=x;xx<x+next.w;xx++){
  const base=groundAt(xx,yy);
  if(base[1])throw Error('A wall blocks this building position');
  if(!ACCEPT.has(base[0]))
   throw Error(base[0]==='path'?'A path is here; place the building BESIDE the path':
    'This tile is protected or cannot hold a building');
  underlay.push([...base]);
 }
 let door=null;
 if(o.door) {
  const dx=x-old.x,dy=y-old.y;
  door={x:o.door.x+dx,y:o.door.y+dy};
  const corner=(door.x===x||door.x===x+next.w-1)&&
    (door.y===y||door.y===y+next.h-1);
  if(corner)throw Error('Building doorway cannot move to a corner');
  let outside=null;
  if(door.x===x)outside={x:door.x-1,y:door.y};
  else if(door.x===x+next.w-1)outside={x:door.x+1,y:door.y};
  else if(door.y===y)outside={x:door.x,y:door.y-1};
  else if(door.y===y+next.h-1)outside={x:door.x,y:door.y+1};
  if(!outside||outside.x<1||outside.y<1||
    outside.x>=area.width-1||outside.y>=area.height-1)
   throw Error('Building doorway has no exterior space');
  if(area.objects.some(other=>other.id!==id&&
   overlaps(rect(other),{...outside,w:1,h:1})))
   throw Error('Building doorway would face an occupied object');
  if(!inside(old,outside.x,outside.y)){
   const tileRow=tile(area,outside.x,outside.y);
   if(tileRow[1]||tileRow[0]==='roof')
    throw Error('Building doorway would face an impassable tile');
  }
 }
 return {object:o,old,next,door,oldUnderlay:originalUnderlay,underlay};
}
function move(area,id,x,y){
 // The caller edits a CLONE; a rejected edit is discarded atomically.
 const p=test(area,id,x,y),image=[];
 for(let yy=p.old.y;yy<p.old.y+p.old.h;yy++)
  for(let xx=p.old.x;xx<p.old.x+p.old.w;xx++)
   image.push(tile(area,xx,yy));
 let n=0;
 for(let yy=p.old.y;yy<p.old.y+p.old.h;yy++)
  for(let xx=p.old.x;xx<p.old.x+p.old.w;xx++)
   put(area,xx,yy,p.oldUnderlay?.[n++]||BASE);
 p.object.x=x;p.object.y=y;
 if(p.object.door)p.object.door=p.door;
 n=0;
 for(let yy=y;yy<y+p.next.h;yy++)
  for(let xx=x;xx<x+p.next.w;xx++)
   put(area,xx,yy,image[n++]);
 p.object._underlay=p.underlay;
 return p.object;
}
function wallEdit(area,action,opts){
 const {x,y}=opts;
 const rectangle=action==='wall_line'||action==='room_outline',
  w=rectangle?opts.w:1,h=rectangle?opts.h:1;
 if(!['paint_wall','erase_wall','wall_line','room_outline'].includes(action)||
   !Number.isInteger(x)||!Number.isInteger(y)||
   !Number.isInteger(w)||!Number.isInteger(h)||
   w<1||h<1||w*h>256||x<1||y<1||
   x+w>=area.width||y+h>=area.height)
  throw Error('Invalid exterior wall selection');
 if(action==='wall_line'&&w>1&&h>1)
  throw Error('A straight wall must run horizontally or vertically');
 const pack=opts.wallPack||'ox72i',variant=opts.wallAsset||null,rotation=opts.rotation||0;
 if(!['ox72i','ox72'].includes(pack))throw Error('Unapproved wall style');
 if(variant){
  const entry=globalThis.DKArchitectDungeon?.entries?.[variant]||
   globalThis.DKImportedDungeonAssets?.entries?.[variant]||
   globalThis.DKFirstDungeonAssets?.entries?.[variant];
  if(!entry||entry.category!=='wall')throw Error('Unapproved wall asset');
 }
 if(!Number.isInteger(rotation)||rotation<0||rotation>3)
  throw Error('Wall direction must be cardinal');
 const points=[];
 for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++){
  if(action==='room_outline'&&xx!==x&&xx!==x+w-1&&yy!==y&&yy!==y+h-1)continue;
  const blocker=area.objects.find(o=>overlaps(rect(o),{x:xx,y:yy,w:1,h:1}));
  if(blocker)throw Error('Wall overlaps protected object '+blocker.id);
  const i=idx(area,xx,yy),f=area.floor[i],isErase=action==='erase_wall';
  if(isErase){
   if(!area.walls[i])throw Error('No exterior wall at this tile');
   if(f==='roof'||f==='stone')throw Error('Building walls must be moved as a whole');
  }else{
   if(area.walls[i])throw Error('A wall already occupies this tile');
   if(!ACCEPT.has(f))throw Error('Walls cannot cross roads or protected paths');
  }
  points.push(i);
 }
 if(!points.length)throw Error('No wall tiles selected');
 for(const i of points){
  area.walls[i]=action==='erase_wall'?0:1;
  area.wallStyles[i]='clean';area.wallVariants[i]=action==='erase_wall'?null:variant;
  area.wallPacks[i]=pack;area.wallRotations[i]=rotation;
 }
 return points.length;
}
function wallBatch(area,tiles,erase=false,opts={}){
 if(!Array.isArray(tiles)||tiles.length<1||tiles.length>256||
   typeof erase!=='boolean')throw Error('Wall brush needs 1 to 256 tiles');
 const marked=new Set();
 for(const tile of tiles){
  if(!tile||Object.keys(tile).sort().join(',')!=='x,y'||
    !Number.isSafeInteger(tile.x)||!Number.isSafeInteger(tile.y))
   throw Error('Invalid wall brush coordinates');
  const key=tile.y*area.width+tile.x;
  if(marked.has(key))throw Error('Duplicate wall brush tile');
  marked.add(key);
  wallEdit(area,erase?'erase_wall':'paint_wall',{x:tile.x,y:tile.y,...opts});
 }
 return tiles.length;
}
const MAX_PROPS=512;
function definition(terms){
 const catalog=globalThis.DKArchitectCatalog;
 if(!catalog)throw Error('Approved DK Architect asset catalogue is not loaded');
 const {assetType,assetId,spriteId}=terms;
 if(typeof assetType!=='string')throw Error('Invalid construction asset type');
 if(assetType==='imported'){
  const source=globalThis.DKArchitectDungeon?.entries?.[assetId]||
   globalThis.DKImportedDungeonAssets?.entries?.[assetId]||
   globalThis.DKFirstDungeonAssets?.entries?.[assetId];
  if(!source||typeof assetId!=='string')throw Error('Unapproved imported construction asset');
  const dims=source.footprint;
  if(!Array.isArray(dims)||!Number.isInteger(dims[0])||!Number.isInteger(dims[1])||
    dims[0]<1||dims[1]<1||dims[0]*dims[1]>64)
    throw Error('Imported asset has no valid footprint');
  return {w:dims[0],h:dims[1],solid:['structure','wall','furniture'].includes(source.category)};
 }
 if(assetType==='scenery'){
  if(!Object.hasOwn(catalog.sprites,spriteId))
   throw Error('Unapproved original character or crystal sprite');
  return {w:1,h:1,solid:false};
 }
 const entry=catalog.objects[assetType];
 if(!entry||['imported','scenery','door'].includes(assetType))
  throw Error('Unapproved construction object');
 return {w:entry.w,h:entry.h,solid:entry.solid};
}
function propObject(terms){
 const def=definition(terms);
 if(!Number.isInteger(terms.r)||terms.r<0||terms.r>3)
  throw Error('Construction rotation must be north/east/south/west');
 const swapped=terms.r%2===1;
 const w=swapped?def.h:def.w,h=swapped?def.w:def.h;
 return {id:terms.id,type:'architect_prop',assetType:terms.assetType,
  assetId:terms.assetType==='imported'?terms.assetId||null:null,
  spriteId:terms.assetType==='scenery'?terms.spriteId||null:null,
  x:terms.x,y:terms.y,r:terms.r,w,h,solidOverride:def.solid};
}
function validatePropPlacement(area,candidate,ignoreId=null){
 const bounds=rect(candidate);
 if(!Number.isSafeInteger(candidate.x)||!Number.isSafeInteger(candidate.y)||
  !Number.isInteger(bounds.w)||!Number.isInteger(bounds.h)||
  candidate.x<1||candidate.y<1||
  candidate.x+bounds.w>=area.width||candidate.y+bounds.h>=area.height)
   throw Error('Object crosses the editable map boundary');
 const occupied=area.objects.find(other=>other.id!==ignoreId&&overlaps(bounds,rect(other)));
 if(occupied)throw Error('Object overlaps '+occupied.id);
 for(let y=bounds.y;y<bounds.y+bounds.h;y++)for(let x=bounds.x;x<bounds.x+bounds.w;x++){
  const i=idx(area,x,y);
  if(area.walls[i]||['roof','temple_roof'].includes(area.floor[i]))
   throw Error('Cannot place an object on a wall or roof');
  if(candidate.solidOverride&&area.floor[i]==='path')
   throw Error('Solid objects cannot block a village road or courtyard path');
 }
 return true;
}
function propEdit(area,action,opts){
 if(!['place_prop','move_prop','rotate_prop','remove_prop'].includes(action))
  throw Error('Unsupported object tool');
 const props=area.objects.filter(o=>o.type==='architect_prop');
 if(action==='place_prop'){
  if(props.length>=MAX_PROPS)throw Error('Exterior object budget reached');
  if(typeof opts.id!=='string'||!/^architect_prop_[a-z0-9_]{5,48}$/.test(opts.id)||
   area.objects.some(o=>o.id===opts.id))
   throw Error('Duplicate or invalid new object ID');
  const prop=propObject(opts);
  validatePropPlacement(area,prop);
  area.objects.push(prop);return prop;
 }
 const prop=props.find(o=>o.id===opts.object_id);
 if(!prop)throw Error('Select a placed construction object');
 if(action==='remove_prop'){
  area.objects.splice(area.objects.indexOf(prop),1);return prop;
 }
 if(action==='move_prop'){
  const next={...prop,x:opts.x,y:opts.y};
  validatePropPlacement(area,next,prop.id);
  if(next.x===prop.x&&next.y===prop.y)throw Error('Object is already at that tile');
  Object.assign(prop,{x:next.x,y:next.y});return prop;
 }
 const angle=opts.r;
 if(!Number.isInteger(angle)||angle<0||angle>3)
  throw Error('Object rotation must be cardinal');
 const next=propObject({id:prop.id,assetType:prop.assetType,assetId:prop.assetId,
  spriteId:prop.spriteId,x:prop.x,y:prop.y,r:angle});
 validatePropPlacement(area,next,prop.id);
 if(angle===prop.r)throw Error('Object already has this rotation');
 Object.assign(prop,{r:next.r,w:next.w,h:next.h});
 return prop;
}
const FINISHES=new Set(['clean','dirty','moss','cracked','broken']);
const FLOORS=new Set(['grass','path','dirt','garden','stone','dark','cracked','sigil']);
function restoreTiles(area,tiles){
 if(!Array.isArray(tiles)||tiles.length<1||tiles.length>256)
  throw Error('A tile edit must contain 1 to 256 tiles');
 const seen=new Set();
 for(const row of tiles){
  if(!Number.isSafeInteger(row.x)||!Number.isSafeInteger(row.y)||
    row.x<1||row.y<1||row.x>=area.width-1||row.y>=area.height-1)
   throw Error('Tile history crosses the world boundary');
  const key=idx(area,row.x,row.y);
  if(seen.has(key))throw Error('Tile history has duplicate coordinates');
  seen.add(key);
  if(area.objects.some(o=>overlaps(rect(o),{x:row.x,y:row.y,w:1,h:1})))
   throw Error('Tile history cannot alter buildings or protected objects');
  if(!FLOORS.has(row.floor)||!([0,1].includes(row.walls))||
   !FINISHES.has(row.wallStyles)||!['ox72i','ox72'].includes(row.wallPacks)||
   !Number.isInteger(row.wallRotations)||row.wallRotations<0||row.wallRotations>3)
   throw Error('Tile history contains an invalid tile');
  const art=globalThis.DKArchitectDungeon?.entries||{};
  if(row.floorArt!==null&&row.floorArt!==undefined&&art[row.floorArt]?.category!=='floor')
   throw Error('Unapproved floor art in tile history');
  if(row.wallVariants!==null&&row.wallVariants!==undefined&&art[row.wallVariants]?.category!=='wall')
   throw Error('Unapproved wall art in tile history');
 }
 for(const row of tiles)for(const name of FIELDS)
  area[name][idx(area,row.x,row.y)]=row[name]===undefined?null:row[name];
 return tiles.length;
}
function setSpawn(area,x,y){
 if(!Number.isInteger(x)||!Number.isInteger(y)||
   x<1||y<1||x>=area.width-1||y>=area.height-1)
  throw Error('Player spawn must be inside the region');
 const i=idx(area,x,y);
 if(area.walls[i]||['roof','temple_roof'].includes(area.floor[i])||
  area.objects.some(o=>overlaps(rect(o),{x,y,w:1,h:1})))
  throw Error('Player spawn must be on a clear tile');
 area.spawn={x,y};return area.spawn;
}
return Object.freeze({FIELDS,BASE,BUILDINGS,test,move,wallEdit,wallBatch,definition,
 propObject,validatePropPlacement,propEdit,restoreTiles,setSpawn,rect,overlaps});
});
