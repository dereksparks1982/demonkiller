'use strict';
// DK Softworks: variable-size world regions. Plain 32px tiles, no new image pack.
const TEMPLE='dk.temple.sacrifice.001';
const COURT='dk.courtyard.lilith.001';
const VILLAGE='dk.village.001';
const TILE=32;
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
 const {area:a,at,put,wall,fill,box}=grid(COURT,64,64);
 // The temple has the full footprint of its existing 16x16 interior.
 box(24,48,16,16,'temple_exterior','temple_exterior');
 wall(32,48,0);put(32,48,'stone');put(32,47,'path');
 a.objects.push({id:'courtyard_temple_door',type:'door',x:32,y:48,r:0,open:false,link:TEMPLE});
 // North gate leads to the village. It is a real traversable portal.
 wall(32,0,0);put(32,0,'path');
 a.objects.push({id:'courtyard_village_gate',type:'gate',x:32,y:0,r:0,open:true,link:VILLAGE});
 for(let y=1;y<=47;y++)for(let x=31;x<=33;x++)put(x,y,'path');
 for(let x=6;x<=58;x++)for(let y=26;y<=28;y++)put(x,y,'path');
 // Circular stone walk, 3x3 willow center. Both forms share an anchor.
 const cx=32,cy=27;
 for(let y=12;y<=42;y++)for(let x=15;x<=49;x++){
  const d=Math.hypot(x-cx,y-cy);
  if(d>=7&&d<9.3)put(x,y,'path');
  else if(d<7)put(x,y,'garden');
 }
 for(let y=20;y<=34;y++)for(let x=31;x<=33;x++)
  if(Math.hypot(x-cx,y-cy)>2)put(x,y,'path');
 a.objects.push({id:'lilith_willow',type:'willow',x:31,y:26,w:3,h:3,world_form:'unresolved'});
 // Four houses with actual exterior footprints, not one tile houses.
 box(5,6,12,10,'house','courtyard_house_nw');
 box(47,6,12,10,'house','courtyard_house_ne');
 box(5,37,12,10,'house','courtyard_house_sw');
 box(47,37,12,10,'house','courtyard_house_se');
 a.objects.push({id:'courtyard_well',type:'well',x:49,y:28,r:0});
 a.objects.push({id:'courtyard_market',type:'stall',x:10,y:25,r:0});
 a.spawn={x:32,y:47};
 return a;
}
function village(){
 const {area:a,put,wall,fill,box}=grid(VILLAGE,128,128);
 // The southern gate connects to the courtyard. The village really is larger.
 wall(64,127,0);put(64,127,'path');
 a.objects.push({id:'village_courtyard_gate',type:'gate',x:64,y:127,r:0,open:true,link:COURT});
 for(let y=2;y<128;y++)for(let x=63;x<=65;x++)put(x,y,'path');
 for(let x=12;x<116;x++)for(let y=62;y<=65;y++)put(x,y,'path');
 // Streets do not imply doors are already enterable.
 const houses=[
  [16,18,16,12,'house','village_house_1'],[43,18,16,12,'house','village_house_2'],
  [76,18,16,12,'house','village_house_3'],[98,18,16,12,'house','village_house_4'],
  [16,73,16,12,'house','village_house_5'],[96,75,16,12,'house','village_house_6'],
  [44,89,20,14,'bank','village_bank'],
  [79,88,16,12,'bakery','village_bakery'],
  [16,99,18,14,'smithy','village_smithy'],
  [98,98,17,15,'tavern','village_tavern']
 ];
 for(const args of houses)box(...args);
 a.objects.push({id:'village_well',type:'well',x:66,y:63,r:0});
 a.objects.push({id:'village_market',type:'stall',x:70,y:68,r:0});
 a.spawn={x:64,y:126};
 return a;
}
const templates=Object.freeze({[COURT]:courtyard,[VILLAGE]:village});
function ensureRegions(world){
 let changed=false;
 for(const [id,fn] of Object.entries(templates)){
  if(!world.areas[id]){world.areas[id]=fn();changed=true;}
 }
 return changed;
}
function traversable(area,x,y,form='living'){
 if(!area||!Number.isInteger(x)||!Number.isInteger(y)||
 x<0||y<0||x>=area.width||y>=area.height)return false;
 const idx=y*area.width+x;
 if(area.walls[idx])return false;
 if(['roof','temple_roof'].includes(area.floor[idx]))return false;
 if(area.objects.some(o=>o.type==='willow'&&
   x>=o.x&&x<o.x+(o.w||1)&&y>=o.y&&y<o.y+(o.h||1)))return false;
 if(form==='living'&&area.objects.some(o=>o.type==='well'&&x===o.x&&y===o.y))return false;
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
 if(areaId===COURT&&x===32&&y===0)
  return {area_id:VILLAGE,x:64,y:126,facing:'north'};
 if(areaId===VILLAGE&&x===64&&y===127)
  return {area_id:COURT,x:32,y:1,facing:'south'};
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
const api=Object.freeze({TEMPLE,COURT,VILLAGE,TILE,templates,courtyard,village,ensureRegions,traversable,portal,checkRegion});
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(typeof window!=='undefined')window.DemonKillerRegions=api;
