'use strict';
// M6 NPC pathfinding: cardinal only. Deterministic BFS uses actual region
// walls, house footprints and portals, not a straight line through scenery.
const {COURT,VILLAGE,traversable,portal}=require('./regions.cjs');
const DIRECTIONS=[[0,-1],[1,0],[0,1],[-1,0]];
function chooseStep(world,n,dest){
 const area=world.areas[n.area_id];if(!area)return null;
 let tx=dest.x,ty=dest.y;
 if(dest.area_id!==n.area_id){
  if(n.area_id===VILLAGE){tx=64;ty=127;}
  else if(n.area_id===COURT){tx=32;ty=0;}
  else return null;
 }
 const width=area.width,height=area.height;
 if(tx<0||ty<0||tx>=width||ty>=height)return null;
 if(n.x===tx&&n.y===ty)return null;
 const length=width*height,seen=new Uint8Array(length);
 const parents=new Int32Array(length);parents.fill(-1);
 const start=n.y*width+n.x,goal=ty*width+tx;
 const queue=new Int32Array(length),queued=1;
 let front=0,back=1;queue[0]=start;seen[start]=1;
 // Bound work for the very large village. A safe partial route is useful
 // even if the destination lies farther away than the search budget.
 let best=start,bestDistance=Math.abs(n.x-tx)+Math.abs(n.y-ty);
 const budget=Math.min(length,20000);
 while(front<back&&front<budget){
  const here=queue[front++],cx=here%width,cy=Math.floor(here/width);
  if(here===goal){best=here;break;}
  for(const [dx,dy] of DIRECTIONS){
   const x=cx+dx,y=cy+dy;
   if(x<0||y<0||x>=width||y>=height)continue;
   const k=y*width+x;if(seen[k])continue;
   const link=portal(world,n.area_id,x,y);
   if((link&&link.blocked)||(!link&&!traversable(area,x,y)))continue;
   seen[k]=1;parents[k]=here;queue[back++]=k;
   const d=Math.abs(x-tx)+Math.abs(y-ty);
   if(d<bestDistance){best=k;bestDistance=d;}
  }
 }
 if(best===start)return null;
 let step=best;
 while(parents[step]!==start&&parents[step]>=0)step=parents[step];
 if(parents[step]!==start)return null;
 const x=step%width,y=Math.floor(step/width);
 const jump=portal(world,n.area_id,x,y);
 if(jump){
  if(jump.blocked)return null;
  return {area_id:jump.area_id,x:jump.x,y:jump.y};
 }
 return {area_id:n.area_id,x,y};
}
module.exports={chooseStep};
