'use strict';
// DK Softworks: variable-size world regions. Plain 32px tiles, no new image pack.
const TEMPLE='dk.temple.sacrifice.001';
const COURT='dk.courtyard.lilith.001';
const VILLAGE='dk.village.001';
const TILE=32;
const TERRAIN=(typeof module!=='undefined'&&module.exports)?
 require('./dk-world-terrain-m68.js'):
 (typeof window!=='undefined'?window.DKWorldTerrain:null);
function grid(id,width,height,base='grass'){
 const n=width*height;
 const a={schema:1,area_id:id,tile_size:TILE,width,height,
  floor:Array(n).fill(base),walls:Array(n).fill(0),
  wallStyles:Array(n).fill('clean'),wallVariants:Array(n).fill(null),
  wallPacks:Array(n).fill('ox72i'),wallRotations:Array(n).fill(0),
  floorArt:Array(n).fill(null),objects:[],spawn:{x:Math.floor(width/2),y:Math.floor(height/2)}};
 const at=(x,y)=>y*width+x;
 const put=(x,y,f)=>{if(x>=0&&x<width&&y>=0&&y<height)a.floor[at(x,y)]=f;};
 const wall=(x,y,v=1)=>{if(x>=0&&x<width&&y>=0&&y<height)a.walls[at(x,y)]=v;};
 const fill=(x,y,w,h,f)=>{for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)put(xx,yy,f);};
 const box=(x,y,w,h,type,id)=>{
  for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++){
   put(xx,yy,yy===y||yy===y+h-1||xx===x||xx===x+w-1?'stone':'roof');
   if(xx===x||xx===x+w-1||yy===y||yy===y+h-1)wall(xx,yy);
  }
  const doorX=x+Math.floor(w/2);
  wall(doorX,y+h-1,0);
  a.objects.push({id,type,x,y,w,h,door:{x:doorX,y:y+h-1},interior_ready:false});
 };
 for(let x=0;x<width;x++){wall(x,0);wall(x,height-1);}
 for(let y=0;y<height;y++){wall(0,y);wall(width-1,y);}
 return {area:a,at,put,wall,fill,box};
}
function courtyard(){
 const {area:a,put,wall,box}=grid(COURT,64,64);
 // This is now ONLY wild temple grounds. All four houses, vendor stalls,
 // village gate and the old paved settlement have been removed.
 // The surviving temple exterior retains the exact approved 16x16 footprint.
 box(24,48,16,16,'temple_exterior','temple_exterior');
 wall(32,48,0);put(32,48,'stone');put(32,47,'path');
 a.objects.push({id:'courtyard_temple_door',type:'door',
  x:32,y:48,r:0,open:false,link:TEMPLE});
 // The old Lilith sequence still lands at the same willow/camera position,
 // but its surroundings are now forested open land, not a former village.
 const cx=32,cy=27;
 for(let y=4;y<=47;y++)for(let x=0;x<64;x++){
  const d=Math.hypot(x-cx,y-cy);
  if((x>=30&&x<=34&&x<34&&y>=27)||(d>=7&&d<9))
   put(x,y,'path');
  else if(d<7)put(x,y,'garden');
  else if((x*13+y*19)%23===0)put(x,y,'heath');
  else if((x*7+y*11)%31===0)put(x,y,'forest');
 }
 for(let y=0;y<=47;y++)for(let x=31;x<=33;x++)put(x,y,'path');
 wall(32,0,0);put(32,0,'path');
 a.objects.push({id:'lilith_willow',type:'willow',x:31,y:26,
  w:3,h:3,world_form:'unresolved'});
 a.spawn={x:32,y:47};
 return a;
}
// Retired, unreachable region ID retained temporarily for server save
// compatibility. NONE of the previous town's physical buildings or streets.
function village(){
 const {area:a}=grid(VILLAGE,128,128,'grass');
 return a;
}
const templates=Object.freeze({[COURT]:courtyard,[VILLAGE]:village,
 ...Object.fromEntries((TERRAIN?.IDS||[]).map(id=>[id,()=>TERRAIN.generate(id)]))});
function ensureRegions(world){
 let changed=false;
 for(const [id,fn] of Object.entries(templates)){
  if(!world.areas[id]){world.areas[id]=fn();changed=true;}
 }
 // The previous village terrain and its 10 buildings are discarded even for
 // old saves. Server economy records are retained for compatibility until
 // the later settlements/economy migration. The region is disconnected.
 const old=world.areas[VILLAGE];
 if(old?.objects?.length){
  world.areas[VILLAGE]=village();changed=true;
 }
 return changed;
}
function traversable(area,x,y,form='living'){
 if(!area||!Number.isInteger(x)||!Number.isInteger(y)||
 x<0||y<0||x>=area.width||y>=area.height)return false;
 const idx=y*area.width+x;
 if(area.walls[idx])return false;
 if(['roof','temple_roof'].includes(area.floor[idx]))return false;
 if(TERRAIN?.isWorldArea(area.area_id)&&
  !TERRAIN.traversableType(area.floor[idx]))return false;
 if(area.objects.some(o=>o.type==='willow'&&
   x>=o.x&&x<o.x+(o.w||1)&&y>=o.y&&y<o.y+(o.h||1)))return false;
 if(form==='living'&&area.objects.some(o=>o.type==='well'&&x===o.x&&y===o.y))return false;
 if(form==='living'&&area.objects.some(o=>o.type==='architect_prop'&&o.solidOverride&&
  x>=o.x&&y>=o.y&&x<o.x+(o.w||1)&&y<o.y+(o.h||1)))return false;
 return true;
}
function portal(world,areaId,x,y){
 const source=world.areas[areaId];
 if(!source)return null;
 if(areaId===TEMPLE&&x===8&&y===0){
  const door=source.objects.find(o=>o.id==='temple_north_door');
  if(!door?.open)return {blocked:true};
  return {area_id:COURT,x:32,y:47,facing:'north'};
 }
 if(areaId===COURT&&x===32&&y===48){
  const door=world.areas[TEMPLE].objects.find(o=>o.id==='temple_north_door');
  if(!door?.open)return {blocked:true};
  return {area_id:TEMPLE,x:8,y:1,facing:'south'};
 }
 // Courtyard is placed immediately south of global tile (1600,2047).
 if(areaId===COURT&&x===32&&y===-1)
  return {area_id:TERRAIN.id(12,15),x:64,y:127,facing:'north'};
 if(TERRAIN?.isWorldArea(areaId)){
  const p=TERRAIN.coords(areaId);
  const side=x<0?[-1,0]:x>=TERRAIN.SIZE?[1,0]:
   y<0?[0,-1]:y>=TERRAIN.SIZE?[0,1]:null;
  if(!side)return null;
  if(p.col===12&&p.row===15&&side[1]===1&&x>=63&&x<=65)
   return {area_id:COURT,x:32,y:0,facing:'south'};
  const other=TERRAIN.neighbor(areaId,side[0],side[1]);
  if(!other||!world.areas[other])return null;
  return {area_id:other,
   x:x<0?TERRAIN.SIZE-1:x>=TERRAIN.SIZE?0:x,
   y:y<0?TERRAIN.SIZE-1:y>=TERRAIN.SIZE?0:y,
   facing:side[0]>0?'east':side[0]<0?'west':side[1]>0?'south':'north'};
 }
 return null;
}
function checkRegion(area){
 if(!area||typeof area.area_id!=='string'||!Number.isInteger(area.width)||
   !Number.isInteger(area.height)||area.width<16||area.height<16||area.width>512||area.height>512||
   area.tile_size!==32||!Array.isArray(area.objects))throw Error('Invalid region');
 for(const key of ['floor','walls','wallStyles','wallVariants','wallPacks','wallRotations','floorArt'])
  if(!Array.isArray(area[key])||area[key].length!==area.width*area.height)
   throw Error('Invalid region '+key);
 for(const o of area.objects){
  if(!o||typeof o.id!=='string'||!Number.isInteger(o.x)||!Number.isInteger(o.y)||
    o.x<0||o.y<0||o.x>=area.width||o.y>=area.height)throw Error('Invalid region object');
 }
 return area;
}
const api=Object.freeze({TEMPLE,COURT,VILLAGE,TILE,TERRAIN,templates,courtyard,village,ensureRegions,traversable,portal,checkRegion});
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(typeof window!=='undefined')window.DemonKillerRegions=api;
