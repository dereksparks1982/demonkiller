'use strict';
// M78: the owner-approved willow village is anchored in the ONE 9216x9216
// playable atlas. Its 64x64 original is a layout source, not a second map.
const {courtyard}=require('./regions.cjs');
const X=4096,Y=4096,SIZE=64;
const SCENE=courtyard();
const TREE=Object.freeze({id:'lilith_willow',type:'willow',x:X+31,y:Y+26,w:3,h:3});
const DOOR=Object.freeze({id:'temple_north_door',type:'temple_door',x:X+32,y:Y+48,w:1,h:1});
const TEMPLE=Object.freeze({id:'forsaken_temple',type:'temple',x:X+24,y:Y+48,w:16,h:16});
const SPAWN=Object.freeze({x:X+32,y:Y+47,facing:'north'});
function tile(x,y){
 if(!Number.isSafeInteger(x)||!Number.isSafeInteger(y)||x<X||y<Y||x>=X+SIZE||y>=Y+SIZE)return null;
 const lx=x-X,ly=y-Y,i=ly*SIZE+lx;
 const edge=lx===0||ly===0||lx===SIZE-1||ly===SIZE-1;
 return {material:SCENE.floor[i],wall:!edge&&Boolean(SCENE.walls[i])};
}
function blocked(x,y){
 const t=tile(x,y);
 return !!t&&(t.wall||t.material==='roof'||
  x>=TREE.x&&x<TREE.x+TREE.w&&y>=TREE.y&&y<TREE.y+TREE.h);
}
function landmarks(x,y,radius=0){
 return [TREE,DOOR,TEMPLE].filter(o=>
  Math.abs(x-(o.x+o.w/2))<=radius+o.w/2&&
  Math.abs(y-(o.y+o.h/2))<=radius+o.h/2).map(o=>({...o}));
}
function treeDistance(x,y){return Math.abs(x-(TREE.x+1))+Math.abs(y-(TREE.y+1));}
function doorDistance(x,y){return Math.abs(x-DOOR.x)+Math.abs(y-(DOOR.y-1));}
module.exports=Object.freeze({X,Y,SIZE,TREE,DOOR,TEMPLE,SPAWN,tile,blocked,landmarks,treeDistance,doorDistance});
