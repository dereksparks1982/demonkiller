/* M73 real player + autonomous atlas NPC display.
 * All actors are the server's actual saved character/NPC records.
 * Reuses the original 32x32 pixel sprites, no generated scenery.
 */
(function(){
'use strict';
const api=window.DemonKillerServer,canvas=document.getElementById('dkActorCanvas');
const ctx=canvas?.getContext('2d');
const status=document.getElementById('dkActorStatus');
const pos=document.getElementById('dkActorPosition');
const inspectEl=document.getElementById('dkActorInspect');
const startForm=document.getElementById('dkActorStartForm');
const startButton=document.getElementById('dkActorStart');
const npcForm=document.getElementById('dkNpcForm');
const npcList=document.getElementById('dkNpcList');
const PALETTE={grass:'#547a41',heath:'#77804c',forest:'#345a34',pine:'#2a503b',
 highland:'#76736a',cliff:'#64636c',boulder:'#77777c',glacier:'#b0c4c7',
 crevasse:'#456a78',sea:'#285e77',deepwater:'#20465c',river:'#4284a1',
 lake:'#4c8699',marsh:'#627557',bog:'#475f4c',reed:'#869161',
 beach:'#c1aa7c',dirt:'#8b7357',path:'#9b8867',stone:'#8a8988',
 dark:'#34333a',cracked:'#606068',sigil:'#995058',garden:'#5d8650',bridge:'#96805f'};
const N=25,RADIUS=12,TILE=32;
let view=null,chosen=null,busy=false,pressed=false,pointer=null,tick=null,poll=null;
const images={living:{},ghost:{}};
for(const form of ['living','ghost'])for(const dir of ['north','south','east','west']){
 const img=new Image();
 img.src='./assets/art/characters/'+(form==='living'?'human/human_':'ghost/ghost_')+dir+'.png';
 img.onload=()=>draw();images[form][dir]=img;
}
function say(message,error=false){
 if(status){status.textContent=message;status.dataset.error=String(error);}
}
function paintActor(x,y,form,direction,color){
 const im=images[form]?.[direction];
 if(im?.complete&&im.naturalWidth>0){
  ctx.drawImage(im,x*TILE,y*TILE,TILE,TILE);
 }else{
  ctx.fillStyle='#202d32';ctx.fillRect(x*TILE+8,y*TILE+27,16,3);
  ctx.fillStyle=color||'#d5c0a4';ctx.fillRect(x*TILE+12,y*TILE+5,9,9);
  ctx.fillStyle=form==='ghost'?'#b8cad4':'#6e7351';
  ctx.fillRect(x*TILE+9,y*TILE+14,15,14);
 }
}
function draw(){
 if(!ctx)return;
 ctx.imageSmoothingEnabled=false;
 ctx.fillStyle=PALETTE.grass;ctx.fillRect(0,0,N*TILE,N*TILE);
 if(!view?.started)return;
 for(let row=0;row<N;row++)for(let col=0;col<N;col++){
  const item=view.tiles[row]?.[col];
  const x=col*TILE,y=row*TILE;
  if(!item){ctx.fillStyle='#222b31';ctx.fillRect(x,y,TILE,TILE);continue;}
  const [material,height]=item;
  ctx.fillStyle=PALETTE[material]||PALETTE.grass;
  ctx.fillRect(x,y,TILE,TILE);
  const salt=(col*11+row*7+view.actor.x*3+view.actor.y*5)%13;
  if(['grass','heath','forest','pine','marsh'].includes(material)){
   ctx.fillStyle=material==='grass'?'#678a51':'#4b7752';
   ctx.fillRect(x+5+salt,y+6+salt%8,4,3);
   ctx.fillStyle='#375b39';ctx.fillRect(x+23,y+22,3,3);
  }else if(['cliff','boulder','highland'].includes(material)){
   ctx.fillStyle='#aaaa9b';ctx.fillRect(x+5,y+7,14,3);
   ctx.fillStyle='#444550';ctx.fillRect(x+14,y+20,12,4);
  }else if(['sea','deepwater','river','lake'].includes(material)){
   ctx.fillStyle='#689db0';ctx.fillRect(x+6,y+18,13,2);
  }
  if(height!==0){
   ctx.fillStyle=height>0?'#d0cdb7':'#293a48';
   ctx.fillRect(x+3,y+4,4,3);
  }
 }
 for(const n of view.npcs||[]){
  const col=n.x-view.actor.x+RADIUS,row=n.y-view.actor.y+RADIUS;
  if(col<0||row<0||col>=N||row>=N)continue;
  paintActor(col,row,'living',n.facing,'#b8a27b');
  ctx.fillStyle=n.role==='guard'?'#efb54d':n.role==='forager'?'#94cb7a':
   n.role==='worker'?'#cd9380':'#a3bede';
  ctx.fillRect(col*TILE+2,row*TILE+2,6,5);
 }
 paintActor(RADIUS,RADIUS,view.actor.form,view.actor.facing,'#dbcba5');
 if(chosen){
  const col=chosen.x-view.actor.x+RADIUS,row=chosen.y-view.actor.y+RADIUS;
  if(col>=0&&row>=0&&col<N&&row<N){
   ctx.strokeStyle='#ecd28c';ctx.lineWidth=2;
   ctx.strokeRect(col*TILE+1,row*TILE+1,TILE-2,TILE-2);
  }
 }
}
function refreshUI(data){
 view=data;
 startButton.textContent=data.has_character?
  'ENTER / MOVE CHARACTER HERE':'CREATE NEW ATLAS CHARACTER';
 document.getElementById('dkActorName').disabled=Boolean(data.has_character);
 if(!data.started){
  pos.textContent=data.has_character?
   'Saved character '+data.character_name+' exists. Select a place and enter the atlas.':
   'No character yet. Choose a name and enter the new world.';
  inspectEl.textContent='Default ground: grass · Elevation: 0';
  npcList.replaceChildren(new Option('No nearby NPCs',''));
  draw();return;
 }
 const a=data.actor;
 pos.textContent=a.name+' · WORLD '+a.x.toLocaleString()+','+a.y.toLocaleString()+
  ' · '+a.cell_id+' · STEPS '+a.steps;
 document.getElementById('dkActorName').value=a.name;
 if(!chosen)chosen={x:a.x+1,y:a.y};
 const center=data.tiles[RADIUS]?.[RADIUS];
 inspectEl.textContent='Ground: '+(center?.[0]||'unknown')+
  ' · Elevation: '+(center?.[1]??0)+' · NPCs nearby: '+data.npcs.length;
 const previous=npcList.value;
 npcList.replaceChildren(new Option(data.npcs.length?'SELECT NEARBY NPC':'NONE NEARBY',''));
 for(const n of data.npcs)
  npcList.add(new Option(n.name+' ('+n.role+') '+n.x+','+n.y,n.id));
 if(data.npcs.some(n=>n.id===previous))npcList.value=previous;
 draw();
}
const query=new URLSearchParams(location.search);
function preferred(){
 const x=Number(document.getElementById('dkActorX').value),
  y=Number(document.getElementById('dkActorY').value);
 if(!Number.isSafeInteger(x)||!Number.isSafeInteger(y)||x<0||y<0||x>=9216||y>=9216)
  throw Error('World coordinates must be 0 through 9,215');
 return {x,y};
}
function clientPosition(e){
 const rect=canvas.getBoundingClientRect();
 const col=Math.floor((e.clientX-rect.left)/rect.width*N),
  row=Math.floor((e.clientY-rect.top)/rect.height*N);
 if(!view?.started||col<0||row<0||col>=N||row>=N)return null;
 return {x:view.actor.x+col-RADIUS,y:view.actor.y+row-RADIUS,
  tile:view.tiles[row]?.[col]};
}
async function action(promise,message){
 if(busy)return;
 busy=true;
 try{
  const result=await promise();
  refreshUI(result);
  say(message||'Server saved revision '+result.world_revision);
 }catch(err){
  say(err.message,true);
 }finally{busy=false;}
}
startForm.addEventListener('submit',e=>{
 e.preventDefault();if(busy||!api)return;
 let loc;try{loc=preferred();}catch(err){say(err.message,true);return;}
 if(view?.has_character)void action(()=>api.worldActorEnter(loc.x,loc.y),
  'Existing character entered the world atlas.');
 else{
  const name=document.getElementById('dkActorName').value.trim();
  void action(()=>api.worldActorCreate(name,loc.x,loc.y),
   'Development atlas character created and saved. The old temple opening is bypassed.');
 }
});
npcForm.addEventListener('submit',e=>{
 e.preventDefault();if(busy||!api||!view?.started){
  say('Enter with a character before placing NPCs',true);return;
 }
 if(!chosen){say('Left-click an unoccupied ground tile to place an NPC',true);return;}
 const name=document.getElementById('dkNpcName').value.trim(),
  role=document.getElementById('dkNpcRole').value;
 void action(()=>api.worldActorNPC(name,role,chosen.x,chosen.y),
  name+' was introduced to the persistent world.');
});
document.getElementById('dkNpcRemove').addEventListener('click',()=>{
 const id=npcList.value;
 if(!id)return say('Select a nearby NPC first',true);
 void action(()=>api.worldActorRemoveNPC(id),'NPC removed from the atlas.');
});
function directionToCursor(){
 if(!view?.started||!pointer)return null;
 const rect=canvas.getBoundingClientRect();
 const dx=(pointer.x-rect.left)/rect.width*N-(RADIUS+.5);
 const dy=(pointer.y-rect.top)/rect.height*N-(RADIUS+.5);
 if(Math.abs(dx)<.5&&Math.abs(dy)<.5)return null;
 return Math.abs(dx)>Math.abs(dy)?(dx>0?'east':'west'):(dy>0?'south':'north');
}
function move(direction){
 if(!view?.started){say('Create or enter a character first',true);return;}
 void action(()=>api.worldActorStep(direction),'Walked '+direction+' · position saved.');
}
if(canvas){
 canvas.addEventListener('contextmenu',e=>e.preventDefault());
 canvas.addEventListener('pointerdown',e=>{
  if(e.button===2){
   e.preventDefault();pressed=true;pointer={x:e.clientX,y:e.clientY};
   canvas.setPointerCapture(e.pointerId);return;
  }
  if(e.button===0){
   const p=clientPosition(e);
   if(p?.tile){
    chosen={x:p.x,y:p.y};
    inspectEl.textContent=p.x+','+p.y+' · '+p.tile[0]+
     ' · elevation '+p.tile[1]+' · selected for NPC placement';
    draw();
   }
  }
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
 tick=setInterval(()=>{
  if(pressed&&!busy){const dir=directionToCursor();if(dir)move(dir);}
 },220);
}
document.addEventListener('keydown',e=>{
 if(e.repeat||e.ctrlKey||e.altKey||e.metaKey||
    ['INPUT','SELECT','TEXTAREA','BUTTON'].includes(e.target?.tagName))return;
 const dict={w:'north',a:'west',s:'south',d:'east',
  ArrowUp:'north',ArrowLeft:'west',ArrowDown:'south',ArrowRight:'east'};
 const dir=dict[e.key];
 if(dir){e.preventDefault();move(dir);}
});
async function sync(){
 if(busy||!api?.worldActorView)return;
 try{refreshUI(await api.worldActorView());}
 catch(e){say(e.message,true);}
}
(async()=>{
 if(!api?.worldActorView){say('Connect to the local DK Server. The static preview has no running world.',true);return;}
 if(query.has('x')||query.has('y')){
  const x=query.get('x'),y=query.get('y');
  if(!/^(0|[1-9][0-9]{0,3})$/.test(x||'')||
     !/^(0|[1-9][0-9]{0,3})$/.test(y||'')||
     Number(x)>=9216||Number(y)>=9216){
   say('Invalid atlas entry coordinates',true);return;
  }
  document.getElementById('dkActorX').value=x;
  document.getElementById('dkActorY').value=y;
 }
 await sync();
 poll=setInterval(sync,5000);
 window.addEventListener('pagehide',()=>{clearInterval(tick);clearInterval(poll);});
})();
})();
