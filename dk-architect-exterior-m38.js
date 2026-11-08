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
  area.wallStyles[i]='clean';area.wallVariants[i]=null;
  area.wallPacks[i]='ox72i';area.wallRotations[i]=0;
 }
 return points.length;
}
return Object.freeze({FIELDS,BASE,BUILDINGS,test,move,wallEdit,rect,overlaps});
});
