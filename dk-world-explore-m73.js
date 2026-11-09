/* M73 real player + autonomous atlas NPC display.
 * All actors are the server's actual saved character/NPC records.
 * Reuses the original 32x32 pixel sprites, no generated scenery.
 */
(function(){
'use strict';
// Dark original overworld score also plays in the real 9,216-tile atlas.
const DK_WORLD_MUSIC=window.DKRenderedSoundtrack?.create({
 url:'./assets/audio/music/demon-killer-overworld-shadowlands-v2.mp3',
 midiUrl:'./assets/audio/music/demon-killer-overworld-shadowlands-v2.mid',
 loopStart:0,loopEnd:96,startAt:0,volume:100,baseGain:.35
})||null;
function dkWorldMusicStart(){
 if(!DK_WORLD_MUSIC)return;
 try{
  const prefs=JSON.parse(localStorage.getItem('dkSoftworks.demonkiller.menuPrefs.v1')||'{}')||{};
  if(prefs.musicEnabled===false){DK_WORLD_MUSIC.stop();return;}
  DK_WORLD_MUSIC.setVolume(Number.isFinite(prefs.volumePercent)?prefs.volumePercent:100);
 }catch(_){}
 void DK_WORLD_MUSIC.play();
}
document.addEventListener('pointerdown',dkWorldMusicStart,{passive:true});
document.addEventListener('keydown',dkWorldMusicStart);
window.addEventListener('pagehide',()=>DK_WORLD_MUSIC?.stop());
dkWorldMusicStart();

const api=window.DemonKillerServer,canvas=document.getElementById('dkActorCanvas');
const ctx=canvas?.getContext('2d');
const status=document.getElementById('dkActorStatus');
const pos=document.getElementById('dkActorPosition');
const inspectEl=document.getElementById('dkActorInspect');
const suppliesEl=document.getElementById('dkActorSupplies');
const siteList=document.getElementById('dkBuildSites');
const siteSummary=document.getElementById('dkBuildSummary');
const houseList=document.getElementById('dkBuildingList');
const houseSummary=document.getElementById('dkBuildingSummary');
const housePanel=document.getElementById('dkBuildingControls');
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
const N=37,RADIUS=18,TILE=32;
// 37 tiles frame all sixteen temple rows when a character leaves its door.
const CINEMATIC=window.DKLilithCinematic;
const treeSheet=new Image();
if(CINEMATIC){treeSheet.src='./assets/art/'+CINEMATIC.SHEET;treeSheet.onload=()=>draw();}
const prayer=document.getElementById('dkActorPrayer'),
 prayerText=document.getElementById('dkActorPrayerText');
const GOLDEN_WORDS='Death does not reveal another world. It reveals the truth this one has always hidden.';
const BLACK_WORDS='The living fear what they cannot understand. Even a miracle looks like a curse through mortal eyes.';
const PRAYER_DURATION=8400,TRANSFORM_DURATION=5400,HOLD_DURATION=1600;
const templeDoorSprite=new Image();
templeDoorSprite.src='./assets/art/temple/doors/door_open_north.png';
templeDoorSprite.onload=()=>draw();
let willowScene=null;

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
function drawInterior(room){
 const t=96,ox=Math.floor((N*TILE-room.width*t)/2),
  oy=Math.floor((N*TILE-room.height*t)/2);
 ctx.fillStyle='#25242b';ctx.fillRect(0,0,N*TILE,N*TILE);
 ctx.fillStyle='#151b1f';ctx.fillRect(ox-12,oy-12,room.width*t+24,room.height*t+24);
 for(let y=0;y<room.height;y++)for(let x=0;x<room.width;x++){
  const px=ox+x*t,py=oy+y*t;
  ctx.fillStyle=(x+y)%2?'#827560':'#8f806b';
  ctx.fillRect(px,py,t,t);
  ctx.fillStyle='#625d58';
  ctx.fillRect(px+t-3,py,3,t);ctx.fillRect(px,py+t-3,t,3);
 }
 const door=room.door,px=ox+door.ix*t,py=oy+door.iy*t;
 ctx.fillStyle='#d7ad65';
 if(door.side==='north')ctx.fillRect(px+12,py,t-24,7);
 if(door.side==='south')ctx.fillRect(px+12,py+t-7,t-24,7);
 if(door.side==='west')ctx.fillRect(px,py+12,7,t-24);
 if(door.side==='east')ctx.fillRect(px+t-7,py+12,7,t-24);
 ctx.fillStyle='#503a29';ctx.fillRect(ox+12,oy+10,32,32);
 ctx.fillStyle='#be9259';ctx.fillRect(ox+17,oy+13,22,5);
 const bx=ox+(room.width-1)*t;
 ctx.fillStyle=room.bench.installed?'#6b5240':'#4c4139';
 ctx.fillRect(bx+t-48,oy+14,35,27);
 if(room.bench.installed){
  ctx.fillStyle='#d9d0ae';ctx.fillRect(bx+t-40,oy+20,21,3);
 }
 const c=room.position,im=images[view.actor.form]?.[c.facing];
 if(im?.complete&&im.naturalWidth>0)
  ctx.drawImage(im,ox+c.x*t+20,oy+c.y*t+12,t-40,t-20);
 else{
  ctx.fillStyle='#e1cc9d';ctx.fillRect(ox+c.x*t+37,oy+c.y*t+25,22,20);
  ctx.fillStyle='#496b55';ctx.fillRect(ox+c.x*t+31,oy+c.y*t+45,34,40);
 }
}
function landmark(kind){return view?.landmarks?.find(o=>o.type===kind)||null;}
function screen(x,y){return {x:x-view.actor.x+RADIUS,y:y-view.actor.y+RADIUS};}
function treeClicked(x,y){
 const o=landmark('willow');return !!o&&x>=o.x-2&&x<o.x+o.w+2&&y>=o.y-5&&y<o.y+o.h+2;
}
function drawTemple(){
 const t=landmark('temple');if(!t)return;
 const a=screen(t.x,t.y);
 // Full 16x16 roof and exterior walls, not a one-tile temple icon.
 for(let by=0;by<t.h;by++)for(let bx=0;bx<t.w;bx++){
  const x=(a.x+bx)*TILE,y=(a.y+by)*TILE;
  const edge=bx===0||by===0||bx===t.w-1||by===t.h-1;
  ctx.fillStyle=edge?'#6c6261':(bx+by)%2?'#51484c':'#564b51';
  ctx.fillRect(x,y,TILE,TILE);
  ctx.fillStyle=edge?'#b8a996':'#75696d';
  ctx.fillRect(x+2,y+2,TILE-4,edge?7:2);
  if(!edge&&by%4===0){ctx.fillStyle='#302d34';ctx.fillRect(x+2,y+11,TILE-4,3);}
 }
 const door=landmark('temple_door');
 if(door){
  const d=screen(door.x,door.y),dx=d.x*TILE,dy=d.y*TILE;
  ctx.fillStyle='#201c25';ctx.fillRect(dx+5,dy+4,22,28);
  ctx.fillStyle='#bfa878';ctx.fillRect(dx+5,dy+3,22,4);
  if(templeDoorSprite.complete&&templeDoorSprite.naturalWidth)
   ctx.drawImage(templeDoorSprite,dx,dy,TILE,TILE);
 }
}
function drawQueen(){
 const tree=landmark('willow');
 if(!tree||!CINEMATIC||!treeSheet.complete||!treeSheet.naturalWidth)return;
 const a=screen(tree.x,tree.y),row=view.actor.form==='ghost'?0:1;
 const cx=(a.x+1.5)*TILE,by=(a.y+3)*TILE;
 if(willowScene){
  const elapsed=performance.now()-willowScene.start;
  if(elapsed<PRAYER_DURATION){
   CINEMATIC.drawLilith(ctx,treeSheet,{womanVisible:true,row,womanX:a.x+1.5,womanY:a.y+2.625});
  }else{
   const frame=Math.min(5,Math.floor((elapsed-PRAYER_DURATION)/(TRANSFORM_DURATION/6)));
   CINEMATIC.drawTree(ctx,treeSheet,row,frame,cx,by);
  }
 }else if(view.actor.lilith_witnessed)CINEMATIC.drawTree(ctx,treeSheet,row,5,cx,by);
 else CINEMATIC.drawLilith(ctx,treeSheet,{womanVisible:true,row,womanX:a.x+1.5,womanY:a.y+2.625});
}
function maybeStartWillow(){
 if(!view?.started||view.interior||view.actor.lilith_witnessed||willowScene||!CINEMATIC)return;
 const t=landmark('willow');if(!t)return;
 const d=Math.abs(view.actor.x-(t.x+1))+Math.abs(view.actor.y-(t.y+1));
 if(d<3||d>9)return;
 willowScene={start:performance.now(),saving:false};
 pressed=false;pointer=null;
 const focus=screen(t.x+1,t.y+1);
 canvas.style.transformOrigin=(focus.x*TILE)+'px '+(focus.y*TILE)+'px';
 canvas.style.transform='scale(1.12)';
 say('The Queen of the Underworld prepares her final prayer.');
}
async function finishWillow(){
 if(!willowScene||willowScene.saving)return;
 willowScene.saving=true;
 try{
  const result=await api.worldActorWitness();
  willowScene=null;canvas.style.transform='';
  refreshUI(result);
  say('The Queen has taken root. Click the willow to hear her words.');
 }catch(e){
  willowScene=null;canvas.style.transform='';
  say('Unable to save the willow transformation: '+e.message,true);
 }
}
function draw(){
 if(!ctx)return;
 ctx.imageSmoothingEnabled=false;
 ctx.fillStyle=PALETTE.grass;ctx.fillRect(0,0,N*TILE,N*TILE);
 if(!view?.started)return;
 if(view.interior){drawInterior(view.interior);return;}
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
  const northern=view.tiles[row-1]?.[col];
  if(northern&&height>northern[1]){
   ctx.fillStyle='#34383c';ctx.fillRect(x,y,TILE,3);
  }
  if(northern&&['sea','deepwater','lake','river'].includes(northern[0])&&
     !['sea','deepwater','lake','river'].includes(material)){
   ctx.fillStyle='#beae79';ctx.fillRect(x,y,TILE,2);
  }
  if(height!==0){
   ctx.fillStyle=height>0?'#d0cdb7':'#293a48';
   ctx.fillRect(x+3,y+4,4,3);
  }
 }
 drawTemple();
 for(const site of view.sites||[]){
  const col=site.x-view.actor.x+RADIUS,row=site.y-view.actor.y+RADIUS;
  ctx.fillStyle=['#9e977e','#7c817f','#a27c51','#594a3f'][site.phase];
  for(let dy=0;dy<site.height;dy++)for(let dx=0;dx<site.width;dx++){
   const gx=col+dx,gy=row+dy;
   if(gx<0||gy<0||gx>=N||gy>=N)continue;
   ctx.fillRect(gx*TILE+3,gy*TILE+3,TILE-6,TILE-6);
   ctx.fillStyle='#d1bb84';ctx.fillRect(gx*TILE+5,gy*TILE+5,TILE-10,2);
   ctx.fillStyle=['#9e977e','#7c817f','#a27c51','#594a3f'][site.phase];
  }
 }
 for(const b of view.buildings||[]){
  const col=b.door.x-view.actor.x+RADIUS,
   row=b.door.y-view.actor.y+RADIUS;
  if(col<0||row<0||col>=N||row>=N)continue;
  ctx.fillStyle=b.locked?'#b85e54':'#e0c173';
  ctx.fillRect(col*TILE+8,row*TILE+8,16,16);
  ctx.fillStyle='#292825';ctx.fillRect(col*TILE+14,row*TILE+15,4,5);
 }
 for(const n of view.npcs||[]){
  const col=n.x-view.actor.x+RADIUS,row=n.y-view.actor.y+RADIUS;
  if(col<0||row<0||col>=N||row>=N)continue;
  paintActor(col,row,'living',n.facing,'#b8a27b');
  ctx.fillStyle=n.role==='guard'?'#efb54d':n.role==='forager'?'#94cb7a':
   n.role==='worker'?'#cd9380':'#a3bede';
  ctx.fillRect(col*TILE+2,row*TILE+2,6,5);
 }
 drawQueen();
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
 maybeStartWillow();
 startForm.hidden=Boolean(data.started);
 startButton.textContent=data.has_character?
  'ENTER / MOVE CHARACTER HERE':'CREATE NEW ATLAS CHARACTER';
 document.getElementById('dkActorName').disabled=Boolean(data.has_character);
 if(!data.started){
  pos.textContent=data.has_character?
   'Saved character '+data.character_name+' exists. Select a place and enter the atlas.':
   'No character yet. Choose a name and enter the new world.';
  inspectEl.textContent='Default ground: grass · Elevation: 0';
  suppliesEl.textContent='Supplies: empty';
  npcList.replaceChildren(new Option('No nearby NPCs',''));
  siteList.replaceChildren(new Option('NO SITES',''));
  siteSummary.textContent='Enter the world to start construction.';
  houseList.replaceChildren(new Option('NO COMPLETED BUILDINGS',''));
  houseSummary.textContent='Complete a construction site first.';
  draw();return;
 }
 const a=data.actor;
 pos.textContent=data.interior?
  a.name+' · INSIDE '+data.interior.kind.toUpperCase()+
   ' · ROOM '+data.interior.position.x+','+data.interior.position.y:
  a.name+' · WORLD '+a.x.toLocaleString()+','+a.y.toLocaleString()+
   ' · '+a.cell_id+' · STEPS '+a.steps;
 if(data.interior)housePanel.open=true;
 startButton.disabled=Boolean(data.interior);
 document.getElementById('dkActorName').value=a.name;
 if(!chosen)chosen={x:a.x+1,y:a.y};
 const center=data.tiles[RADIUS]?.[RADIUS];
 suppliesEl.textContent='Supplies: '+
  (Object.entries(data.supplies||{}).map(([k,v])=>k+' '+v).join(' · ')||'empty');
 inspectEl.textContent='Ground: '+(center?.[0]||'unknown')+
  ' · Elevation: '+(center?.[1]??0)+' · NPCs nearby: '+data.npcs.length;
 const selectedSite=siteList.value;
 siteList.replaceChildren(new Option((data.sites||[]).length?'SELECT NEARBY SITE':'NO SITES',''));
 for(const site of data.sites||[]){
  siteList.add(new Option(site.id+' · '+site.kind+' · '+site.stage,site.id));
 }
 if((data.sites||[]).some(site=>site.id===selectedSite))siteList.value=selectedSite;
 else if((data.sites||[]).length)siteList.value=data.sites[0].id;
 updateSiteSummary();
 const oldHouse=houseList.value;
 houseList.replaceChildren(new Option((data.buildings||[]).length?
  'SELECT COMPLETED BUILDING':'NO COMPLETED BUILDINGS',''));
 for(const b of data.buildings||[]){
  houseList.add(new Option(b.id+' · '+b.kind+' · '+
   (b.owner_self?'yours':b.unclaimed?'unclaimed':'private'),b.id));
 }
 if(data.interior&&data.buildings.some(b=>b.id===data.interior.id))
  houseList.value=data.interior.id;
 else if((data.buildings||[]).some(b=>b.id===oldHouse))houseList.value=oldHouse;
 else if((data.buildings||[]).length)houseList.value=data.buildings[0].id;
 updateHouseSummary();
 const previous=npcList.value;
 npcList.replaceChildren(new Option(data.npcs.length?'SELECT NEARBY NPC':'NONE NEARBY',''));
 for(const n of data.npcs)
  npcList.add(new Option(n.name+' ('+n.role+') '+n.x+','+n.y+' · '+
   (Object.entries(n.pack||{}).map(([k,v])=>k+':'+v).join(' ')||'empty'),n.id));
 if(data.npcs.some(n=>n.id===previous))npcList.value=previous;
 draw();
}
function updateSiteSummary(){
 const site=(view?.sites||[]).find(s=>s.id===siteList.value);
 if(!site){siteSummary.textContent='Select level ground near your character, then stake a building site.';return;}
 const list=part=>Object.entries(part).map(([k,v])=>k+':'+v).join(' · ')||'none';
 siteSummary.textContent=site.kind.toUpperCase()+' · '+site.stage.toUpperCase()+
  ' · '+site.progress+'/'+site.work_required+' work · stock '+list(site.stock)+
  ' · stage needs '+list(site.missing)+' · assigned '+site.workers.length+
  ' · your gold '+(view?.gold??0);
}
siteList.addEventListener('change',updateSiteSummary);
function updateHouseSummary(){
 const b=(view?.buildings||[]).find(x=>x.id===houseList.value);
 if(!b){houseSummary.textContent='No completed building nearby. Finish construction first.';return;}
 const room=view?.interior?.id===b.id?view.interior:null;
 const stored=room?Object.entries(room.chest.stock).map(([k,v])=>k+':'+v).join(' · '):'enter to inspect';
 houseSummary.textContent=b.kind.toUpperCase()+' · DOOR '+b.door.x+','+b.door.y+
  ' · '+(b.locked?'LOCKED':'UNLOCKED')+' · '+
  (b.owner_self?'YOUR PROPERTY':b.unclaimed?'UNCLAIMED':'OTHER OWNER')+
  ' · caretaker '+(b.caretaker_id||'none')+
  (room?' · chest '+(stored||'empty')+' · bench '+(room.bench.installed?'installed':'not installed'):'');
}
houseList.addEventListener('change',updateHouseSummary);
function houseCommand(operation,details={}){
 if(!api?.worldBuilding||!view?.started)
  return say('Connect and enter the living world before using buildings',true);
 const withBuilding=new Set(['enter','lock','unlock','claim','assign_caretaker','unassign_caretaker']);
 const id=houseList.value;
 if(withBuilding.has(operation)&&!id)
  return say('Choose a completed building first',true);
 void action(()=>api.worldBuilding({
  action:operation,expected_revision:view.world_revision,
  ...(withBuilding.has(operation)?{building_id:id}:{}),...details
 }),'Saved building operation: '+operation+'.');
}
document.getElementById('dkHouseEnter').addEventListener('click',()=>houseCommand('enter'));
document.getElementById('dkHouseExit').addEventListener('click',()=>houseCommand('exit'));
document.getElementById('dkHouseLock').addEventListener('click',()=>houseCommand('lock'));
document.getElementById('dkHouseUnlock').addEventListener('click',()=>houseCommand('unlock'));
document.getElementById('dkHouseClaim').addEventListener('click',()=>houseCommand('claim'));
for(const cmd of ['deposit','withdraw']){
 document.getElementById(cmd==='deposit'?'dkHouseDeposit':'dkHouseWithdraw')
  .addEventListener('click',()=>{
   const quantity=Number(document.getElementById('dkHouseQuantity').value);
   if(!Number.isSafeInteger(quantity)||quantity<1||quantity>8)
    return say('Storage transfer must be 1 to 8 items',true);
   houseCommand(cmd,{item:document.getElementById('dkHouseItem').value,quantity});
  });
}
document.getElementById('dkHouseBench').addEventListener('click',()=>houseCommand('install_bench'));
document.getElementById('dkHousePlank').addEventListener('click',()=>houseCommand('craft',{recipe:'plank'}));
document.getElementById('dkHouseCord').addEventListener('click',()=>houseCommand('craft',{recipe:'cord'}));
document.getElementById('dkHouseAssign').addEventListener('click',()=>{
 if(!npcList.value)return say('Select a nearby NPC worker first',true);
 houseCommand('assign_caretaker',{npc_id:npcList.value});
});
document.getElementById('dkHouseUnassign').addEventListener('click',()=>houseCommand('unassign_caretaker'));
function buildCommand(operation,details={}){
 if(!api?.worldConstruction||!view?.started||view.interior){
  say('Connect and enter the world to construct',true);return;
 }
 const siteId=siteList.value;
 if(operation!=='place'&&!siteId){say('Select a nearby construction site first',true);return;}
 void action(()=>api.worldConstruction({
  action:operation,expected_revision:view.world_revision,
  ...(operation==='place'?details:{site_id:siteId,...details})
 }),operation==='place'?'Construction site staked and saved.':
  'Construction command saved on DK Server.');
}
document.getElementById('dkBuildPlace').addEventListener('click',()=>{
 if(!chosen)return say('Choose the northwest tile with left click',true);
 buildCommand('place',{kind:document.getElementById('dkBuildKind').value,
  x:chosen.x,y:chosen.y});
});
document.getElementById('dkBuildDeliver').addEventListener('click',()=>{
 const quantity=Number(document.getElementById('dkBuildQuantity').value);
 if(!Number.isSafeInteger(quantity)||quantity<1||quantity>8)
  return say('Choose a delivery amount between 1 and 8',true);
 buildCommand('deliver',{item:document.getElementById('dkBuildMaterial').value,quantity});
});
document.getElementById('dkBuildLabor').addEventListener('click',()=>buildCommand('labor'));
document.getElementById('dkBuildAssign').addEventListener('click',()=>{
 if(!npcList.value)return say('Select a worker NPC',true);
 buildCommand('assign',{npc_id:npcList.value});
});
document.getElementById('dkBuildUnassign').addEventListener('click',()=>{
 if(!npcList.value)return say('Select a worker NPC',true);
 buildCommand('unassign',{npc_id:npcList.value});
});
document.getElementById('dkBuildCancel').addEventListener('click',()=>buildCommand('cancel'));
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
document.getElementById('dkActorGather').addEventListener('click',()=>{
 if(!view?.started||view.interior)return say('Exit the building before gathering',true);
 if(!chosen)return say('Select a resource tile with left click first',true);
 void action(()=>api.worldActorGather(chosen.x,chosen.y),
  'Gathered a physical supply and saved it in your atlas pack.');
});
document.getElementById('dkNpcRemove').addEventListener('click',()=>{
 const id=npcList.value;
 if(!id)return say('Select a nearby NPC first',true);
 void action(()=>api.worldActorRemoveNPC(id),'NPC removed from the atlas.');
});
function directionToCursor(){
 if(willowScene||!view?.started||!pointer)return null;
 const rect=canvas.getBoundingClientRect();
 const dx=(pointer.x-rect.left)/rect.width*N-(RADIUS+.5);
 const dy=(pointer.y-rect.top)/rect.height*N-(RADIUS+.5);
 if(Math.abs(dx)<.5&&Math.abs(dy)<.5)return null;
 return Math.abs(dx)>Math.abs(dy)?(dx>0?'east':'west'):(dy>0?'south':'north');
}
function move(direction){
 if(willowScene)return;
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
   if(willowScene)return;
   if(view?.interior){inspectEl.textContent='Interior floor · Walk with WASD or arrows · Use room fixtures from the building panel';return;}
   const p=clientPosition(e);
   if(p?.tile){
    if(treeClicked(p.x,p.y)&&view.actor.lilith_witnessed){
     say(view.actor.form==='ghost'?GOLDEN_WORDS:BLACK_WORDS);return;
    }
    chosen={x:p.x,y:p.y};
    const selectedSite=(view.sites||[]).find(s=>
      p.x>=s.x&&p.x<s.x+s.width&&p.y>=s.y&&p.y<s.y+s.height);
    if(selectedSite){
     siteList.value=selectedSite.id;updateSiteSummary();
     if((view.buildings||[]).some(b=>b.id===selectedSite.id)){
      houseList.value=selectedSite.id;updateHouseSummary();
     }
    }
    inspectEl.textContent=p.x+','+p.y+' · '+p.tile[0]+
     ' · elevation '+p.tile[1]+' · selected for NPC placement';
    draw();
   }
  }
 });
 canvas.addEventListener('dblclick',e=>{
  if(willowScene||!view?.started||view.interior)return;
  const p=clientPosition(e),door=landmark('temple_door');
  if(!p||!door||p.x!==door.x||p.y!==door.y)return;
  if(Math.abs(view.actor.x-door.x)+Math.abs(view.actor.y-(door.y-1))>2)
   return say('Stand beside the temple doorway.',true);
  void api.worldActorEnterTemple().then(()=>
   location.href='./test-center.html?dkSlot=1&walk=continuous1'
  ).catch(e=>say(e.message,true));
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
 if(busy||willowScene||!api?.worldActorView)return;
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
 function cinematicTick(){
  if(willowScene){
   const elapsed=performance.now()-willowScene.start;
   if(prayer){
    prayer.hidden=elapsed>=PRAYER_DURATION;
    if(!prayer.hidden)prayerText.textContent=CINEMATIC.PRAYER[Math.min(
      CINEMATIC.PRAYER.length-1,Math.floor(elapsed/(PRAYER_DURATION/CINEMATIC.PRAYER.length)))];
   }
   if(elapsed>=PRAYER_DURATION+TRANSFORM_DURATION+HOLD_DURATION)void finishWillow();
   draw();
  }else if(prayer)prayer.hidden=true;
  requestAnimationFrame(cinematicTick);
 }
 requestAnimationFrame(cinematicTick);
 window.addEventListener('pagehide',()=>{clearInterval(tick);clearInterval(poll);});
})();
})();
