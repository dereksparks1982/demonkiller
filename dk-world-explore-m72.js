/* M72 world-walking surveyor. Original existing 32x32 human sprite artwork,
 * plain hard-edged terrain pixels, 4-direction server-authoritative movement.
 * No generated images, game engine or freehand browser-trusted coordinates.
 */
(function(){
'use strict';
const api=window.DemonKillerServer;
const canvas=document.querySelector('#dkWalkCanvas');
const ctx=canvas?.getContext('2d');
const status=document.querySelector('#dkWalkStatus');
const position=document.querySelector('#dkWalkPosition');
const describe=document.querySelector('#dkWalkInspect');
const CELL=32,RADIUS=12,N=25;
const PALETTE={grass:'#547a41',heath:'#77804c',forest:'#345a34',pine:'#2a503b',
 highland:'#76736a',cliff:'#64636c',boulder:'#77777c',glacier:'#b0c4c7',
 crevasse:'#456a78',sea:'#285e77',deepwater:'#20465c',river:'#4284a1',
 lake:'#4c8699',marsh:'#627557',bog:'#475f4c',reed:'#869161',
 beach:'#c1aa7c',dirt:'#8b7357',path:'#9b8867',stone:'#8a8988',
 dark:'#34333a',cracked:'#606068',sigil:'#995058',garden:'#5d8650',bridge:'#96805f'};
const img={};
for(const direction of ['north','east','south','west']){
 const i=new Image();i.src='./assets/art/characters/human/human_'+direction+'.png';
 i.onload=()=>draw();img[direction]=i;
}
let view=null,busy=false,pressed=false,pointer=null,heldTimer=null;
const show=(s,error=false)=>{
 if(!status)return;
 status.textContent=s;status.dataset.error=String(error);
};
function draw(){
 if(!canvas||!ctx)return;
 ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,canvas.width,canvas.height);
 ctx.fillStyle=PALETTE.grass;ctx.fillRect(0,0,800,800);
 if(!view?.started)return;
 const rows=view.tiles||[];
 for(let row=0;row<N;row++)for(let col=0;col<N;col++){
  const square=rows[row]?.[col],xx=col*CELL,yy=row*CELL;
  if(!square){ctx.fillStyle='#232a32';ctx.fillRect(xx,yy,CELL,CELL);continue;}
  const material=square[0],height=square[1];
  ctx.fillStyle=PALETTE[material]||PALETTE.grass;ctx.fillRect(xx,yy,CELL,CELL);
  // A few simple hard-edged marks match the existing 32x32 actor scale.
  const seed=(row*17+col*23+view.actor.x*5+view.actor.y*11)%17;
  if(['grass','forest','pine','heath'].includes(material)){
   ctx.fillStyle=material==='grass'?'#688b52':'#4c7850';
   ctx.fillRect(xx+5+seed%15,yy+8+seed%9,4,3);
   ctx.fillStyle='#355739';ctx.fillRect(xx+24,yy+20,3,3);
  }else if(['cliff','highland','boulder'].includes(material)){
   ctx.fillStyle='#a29d98';ctx.fillRect(xx+4,yy+6,19,3);
   ctx.fillStyle='#40424b';ctx.fillRect(xx+12,yy+19,13,4);
  }else if(['sea','river','deepwater','lake'].includes(material)){
   ctx.fillStyle='#679cae';ctx.fillRect(xx+4,yy+17,12,2);
  }
  if(height!==0){
   ctx.fillStyle=height>0?'#d2cfb6':'#213742';
   ctx.fillRect(xx+4,yy+4,4,3);
  }
 }
 ctx.fillStyle='#172023';ctx.fillRect(RADIUS*CELL+7,RADIUS*CELL+26,18,3);
 const sprite=img[view.actor.facing];
 if(sprite?.complete&&sprite.naturalWidth>0){
  ctx.drawImage(sprite,RADIUS*CELL,RADIUS*CELL,CELL,CELL);
 }else{
  ctx.fillStyle='#d5c0a4';ctx.fillRect(RADIUS*CELL+12,RADIUS*CELL+7,8,8);
  ctx.fillStyle='#6f765d';ctx.fillRect(RADIUS*CELL+10,RADIUS*CELL+15,12,14);
 }
}
function update(v){
 view=v;draw();
 if(!v.started){
  position.textContent='No surveyor placed yet.';
  show('Open DK Architect and choose WALK HERE to begin.',true);
  return;
 }
 const a=v.actor;
 position.textContent='WORLD X '+a.x.toLocaleString()+
  ' · Y '+a.y.toLocaleString()+' · '+a.cell_id+
  ' · '+a.steps+' STEPS';
 const current=v.tiles[RADIUS][RADIUS];
 describe.textContent='Ground: '+current[0]+' · Elevation: '+current[1];
}
async function act(action,arg){
 if(!api||busy)return;
 busy=true;
 try{
  const result=action==='place'?
   await api.walkWorldPlace(arg.x,arg.y):await api.walkWorldStep(arg);
  update(result);show(action==='place'?'Surveyor placed. Hold RIGHT MOUSE or use WASD/arrow keys.':
   'Walked '+arg+'. World position saved to server.');
 }catch(error){show(error.message,true);}
 finally{busy=false;}
}
function inspect(e){
 if(!view?.started)return;
 const box=canvas.getBoundingClientRect(),col=Math.floor((e.clientX-box.left)/box.width*N),
  row=Math.floor((e.clientY-box.top)/box.height*N);
 if(row<0||row>=N||col<0||col>=N)return;
 const tile=view.tiles[row]?.[col];
 describe.textContent=tile?'Tile '+(view.actor.x+col-RADIUS)+','+
  (view.actor.y+row-RADIUS)+' · '+tile[0]+' · elevation '+tile[1]:
  'Beyond world boundary';
}
function cursorDirection(){
 if(!pointer||!view?.started)return null;
 const box=canvas.getBoundingClientRect(),col=(pointer.x-box.left)/box.width*N,
  row=(pointer.y-box.top)/box.height*N;
 const dx=col-(RADIUS+.5),dy=row-(RADIUS+.5);
 if(Math.abs(dx)<.5&&Math.abs(dy)<.5)return null;
 return Math.abs(dx)>Math.abs(dy)?(dx>0?'east':'west'):(dy>0?'south':'north');
}
if(canvas){
 canvas.addEventListener('contextmenu',e=>e.preventDefault());
 canvas.addEventListener('pointerdown',e=>{
  if(e.button===2){
   e.preventDefault();pressed=true;pointer={x:e.clientX,y:e.clientY};
   canvas.setPointerCapture(e.pointerId);return;
  }
  if(e.button===0)inspect(e);
 });
 canvas.addEventListener('pointermove',e=>{
  if(pressed)pointer={x:e.clientX,y:e.clientY};
 });
 const release=e=>{
  if(e.button===2||e.type==='pointercancel'){
   pressed=false;pointer=null;
   if(canvas.hasPointerCapture?.(e.pointerId))
    canvas.releasePointerCapture(e.pointerId);
  }
 };
 canvas.addEventListener('pointerup',release);
 canvas.addEventListener('pointercancel',release);
 canvas.addEventListener('lostpointercapture',()=>{pressed=false;pointer=null;});
 heldTimer=setInterval(()=>{if(pressed&&!busy){
  const direction=cursorDirection();
  if(direction)void act('step',direction);
 }},190);
 window.addEventListener('pagehide',()=>clearInterval(heldTimer));
}
document.addEventListener('keydown',e=>{
 if(e.repeat||e.ctrlKey||e.altKey||e.metaKey||
    ['INPUT','SELECT','TEXTAREA'].includes(e.target?.tagName))return;
 const map={w:'north',a:'west',s:'south',d:'east',
  ArrowUp:'north',ArrowLeft:'west',ArrowDown:'south',ArrowRight:'east'};
 const direction=map[e.key];
 if(direction){e.preventDefault();void act('step',direction);}
});
(async()=>{
 if(!api?.walkWorldView||!canvas){show('Connect to DK Server to walk the world.',true);return;}
 try{
  const query=new URLSearchParams(location.search);
  const sx=query.get('x'),sy=query.get('y');
  if(sx!==null||sy!==null){
   if(!/^(0|[1-9][0-9]{0,3})$/.test(sx||'')||
      !/^(0|[1-9][0-9]{0,3})$/.test(sy||'')||
      Number(sx)>=9216||Number(sy)>=9216)
    throw Error('Invalid world walk starting point');
   await act('place',{x:Number(sx),y:Number(sy)});
  }else update(await api.walkWorldView());
 }catch(error){show(error.message,true);}
})();
})();
