/* DK Softworks M68. True overhead procedural wilderness, 32px tiles.
 * Single coordinate system: a 4096 x 4096 master grid, but ONLY four 128x128
 * regions materialize for this slice. 16x16 sectors stream within each region.
 * All terrain is deterministic from its world tile coordinate, including edges.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.DKWorldTerrain=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const TILE=32,SIZE=128,MASTER=4096,SECTOR=16;
 const GRID=Object.freeze([[12,14],[13,14],[12,15],[13,15]]);
 const id=(col,row)=>'dk.overworld.c'+col+'r'+row;
 const IDS=Object.freeze(GRID.map(([c,r])=>id(c,r)));
 const ORIGIN=Object.freeze({x:12*SIZE,y:14*SIZE});
 const CAMPS=Object.freeze([
  {id:'timber',name:'Timber Camp',x:1595,y:1857,kind:'wood'},
  {id:'quarry',name:'Quarry Camp',x:1700,y:1864,kind:'ore'},
  {id:'marsh',name:'Marsh Camp',x:1586,y:1998,kind:'peat'}
 ]);
 const ROADS=Object.freeze([
  [[1600,2048],[1598,2000]],
  [[1598,2000],[1602,1948]],
  [[1602,1948],[1600,1891]],
  [[1600,1891],[1595,1857]],
  [[1602,1948],[1640,1935]],
  [[1640,1935],[1700,1864]],
  [[1598,2000],[1586,1998]]
 ]);
 const BLOCKED=new Set(['sea','river','lake','deepwater','cliff','crevasse','boulder']);
 const PALETTE=Object.freeze({
  grass:'#48743e',heath:'#6b7540',forest:'#325737',
  pine:'#264b33',highland:'#65765b',cliff:'#535862',
  boulder:'#68696a',glacier:'#a9d5da',crevasse:'#39718b',
  sea:'#1c5269',beach:'#b5a67b',river:'#367a9b',
  lake:'#40869f',deepwater:'#214d63',marsh:'#5b7048',
  bog:'#404f41',reed:'#8c9560',path:'#87775b',
  bridge:'#ae9469',dirt:'#795f42'
 });
 function coords(area_id){
  const m=/^dk\.overworld\.c(1[23])r(1[45])$/.exec(area_id||'');
  if(!m)return null;
  const col=Number(m[1]),row=Number(m[2]);
  if(!GRID.some(([x,y])=>x===col&&y===row))return null;
  return {col,row,x:col*SIZE,y:row*SIZE};
 }
 const isWorldArea=area_id=>coords(area_id)!==null;
 function hash(x,y,s=0){
  let n=(Math.imul(x,374761393)+Math.imul(y,668265263)+Math.imul(s,1442695041))|0;
  n=Math.imul(n^(n>>>13),1274126177);
  return (n^(n>>>16))>>>0;
 }
 function segmentDistance(x,y,a,b){
  const dx=b[0]-a[0],dy=b[1]-a[1];
  const t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));
  return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t);
 }
 function road(x,y){return ROADS.some(([a,b])=>segmentDistance(x,y,a,b)<=2);}
 function terrain(x,y){
  if(!Number.isSafeInteger(x)||!Number.isSafeInteger(y)||
   x<0||y<0||x>=MASTER||y>=MASTER)throw Error('Invalid world tile');
  const coast=1555+Math.round(8*Math.sin(y/37)+5*Math.sin(y/12));
  if(x<coast-2)return 'sea';
  if(x<coast+3)return 'beach';
  // Basin drainage: westward river and smaller glacier-fed tributary.
  const riverY=1934+Math.round(13*Math.sin((x-1540)/45)+6*Math.sin((x-1540)/14));
  const tributaryX=1704+Math.round(11*Math.sin((y-1835)/33));
  if(Math.abs(y-riverY)<=2)return 'river';
  if(y>=1846&&y<=riverY&&Math.abs(x-tributaryX)<=1)return 'river';
  if(((x-1731)/18)**2+((y-1853)/13)**2<1)return 'lake';
  const noise=hash(x>>2,y>>2,7)%100;
  if(x>1680&&y<1900-(x-1680)*0.15){
   if(x>1730&&y<1840+(x-1730)*0.09)return noise<8?'crevasse':'glacier';
   return noise<55?'cliff':noise<78?'boulder':'highland';
  }
  if(y>1971&&x<1607)return noise<14?'deepwater':noise<45?'bog':noise<80?'marsh':'reed';
  if(y<1870&&x>1620)return noise<12?'boulder':noise<43?'highland':'forest';
  if(y>2009&&x>1613)return noise<53?'heath':'grass';
  return noise<8?'pine':noise<37?'forest':noise<47?'heath':'grass';
 }
 function tile(x,y){
  let type=terrain(x,y);
  if(road(x,y)&&type!=='sea'&&type!=='cliff'&&type!=='crevasse'){
   if(type==='river'||type==='lake'||type==='deepwater')return 'bridge';
   type='path';
  }
  for(const camp of CAMPS)if(Math.abs(camp.x-x)<=5&&Math.abs(camp.y-y)<=4&&
     !['sea','river','lake','cliff'].includes(type))return 'dirt';
  return type;
 }
 function traversableType(type){return !BLOCKED.has(type);}
 function globalPosition(area_id,x,y){
  const p=coords(area_id);
  if(!p||!Number.isInteger(x)||!Number.isInteger(y)||
   x<0||y<0||x>=SIZE||y>=SIZE)throw Error('Invalid world position');
  return {x:p.x+x,y:p.y+y};
 }
 function generate(area_id){
  const p=coords(area_id);if(!p)throw Error('Unknown wilderness region');
  const n=SIZE*SIZE;
  const a={schema:1,area_id,tile_size:TILE,width:SIZE,height:SIZE,
   world_origin:{x:p.x,y:p.y},
   floor:Array(n),walls:Array(n).fill(0),
   wallStyles:Array(n).fill('clean'),
   wallVariants:Array(n).fill(null),wallPacks:Array(n).fill('ox72i'),
   wallRotations:Array(n).fill(0),floorArt:Array(n).fill(null),
   objects:[],spawn:{x:64,y:64}};
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++)
   a.floor[y*SIZE+x]=tile(p.x+x,p.y+y);
  for(const camp of CAMPS){
   const x=camp.x-p.x,y=camp.y-p.y;
   if(x<7||y<7||x>SIZE-8||y>SIZE-8)continue;
   a.objects.push({id:'workcamp_'+camp.id,type:'camp_tent',
    name:camp.name,x:x-2,y:y-2,w:4,h:3,
    resource:camp.kind,interior_ready:false});
   a.objects.push({id:'campfire_'+camp.id,type:'campfire',
    x:x+3,y:y+1});
   a.objects.push({id:'supplies_'+camp.id,type:'logpile',
    x:x-2,y:y+3,resource:camp.kind});
  }
  // The temple grounds join this southern region at an actual edge tile.
  if(p.col===12&&p.row===15){
   for(let y=SIZE-3;y<SIZE;y++)for(let x=63;x<=65;x++)
    a.floor[y*SIZE+x]='path';
  }
  return a;
 }
 function neighbor(area_id,dx,dy){
  const p=coords(area_id);if(!p)return null;
  const next=id(p.col+dx,p.row+dy);
  return isWorldArea(next)?next:null;
 }
 function draw(ctx,kind,x,y,worldX,worldY){
  if(!Object.hasOwn(PALETTE,kind))return false;
  const at=(color,dx,dy,w,h)=>{ctx.fillStyle=color;ctx.fillRect(x+dx,y+dy,w,h);};
  at(PALETTE[kind],0,0,32,32);
  const n=hash(worldX,worldY),a=n%16,b=(n>>>7)%15;
  if(['grass','heath','forest','pine','highland'].includes(kind)){
   at('#70944c',3+a,6+b,4,2);at('#2b5436',19,19,4,3);
  }
  if(kind==='pine'){
   at('#4b3b32',14,21,4,10);at('#143d2b',8,12,18,14);
   at('#2c6143',11,5,13,17);at('#1d4932',6,19,21,5);
  }
  if(kind==='forest'){at('#21442c',7,12,16,12);at('#407342',11,6,13,12);}
  if(['sea','river','lake','deepwater','crevasse'].includes(kind)){
   at('#5896ab',3+a%11,10+b%10,10,2);at('#235570',20,25,9,2);
  }
  if(['marsh','bog','reed'].includes(kind)){
   at('#466c69',2+a%12,14,15,6);at('#a9ac68',18,5+b%9,2,12);
   at('#748c4c',25,17,2,10);
  }
  if(kind==='glacier'){at('#dfebe8',3,4,23,6);at('#679db0',19,13,9,15);at('#c3dfe1',4,18,14,11);}
  if(kind==='cliff'||kind==='boulder'){at('#939397',3,3,19,8);at('#343b43',8,13,17,15);at('#747e80',4,21,10,5);}
  if(['path','dirt','bridge'].includes(kind)){
   at('#b4a47e',4+a%8,6+b%9,8,3);at('#675744',22,23,7,3);
   if(kind==='bridge')for(let j=0;j<4;j++)at(j%2?'#65513a':'#b79e78',0,j*8,32,4);
  }
  if(kind==='beach'){at('#d5c18e',2,11,8,2);at('#8c886a',20,25,7,2);}
  return true;
 }
 return Object.freeze({TILE,SIZE,MASTER,SECTOR,GRID,IDS,CAMPS,ROADS,
  coords,isWorldArea,id,neighbor,globalPosition,tile,terrain,
  traversableType,generate,draw,PALETTE});
});
