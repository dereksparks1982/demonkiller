/* Demon Killer: big-area room renderer. Same 32px architect tiles and
 * cardinal UO-style movement as the original temple, no new sprite pack.
 */
(function(){
'use strict';
const R=window.DemonKillerRegions,D=window.DKArchitectDungeon||null;
const q=new URLSearchParams(location.search),slot=Number(q.get('dkSlot')||1);
const SERVER=window.DemonKillerServer&&q.has('dkSlot')?window.DemonKillerServer:null;
const $=id=>document.getElementById(id),canvas=$('world'),ctx=canvas.getContext('2d');
if(!R||!ctx)return;
const PREVIEW_KEY='dkSoftworks.demonkiller.outdoors.preview.v1';
const TEMPLE_SAVE='dkSoftworks.demonkiller.characters.v1';
const TILE=32,VIEW=20;
const images=new Map();
let area=null,world=null,player=null,living=null,gameplay=null,social=null,busy=false,rightHeld=false;
let pointer=null,camera={x:0,y:0},lastMove=0,lastDraw=0,animStart=0;
let lilithPhase='finished',firstVisit=false,doorOpen=true,clock=null;
function image(path){
 if(images.has(path))return images.get(path);
 const img=new Image();img.src='./assets/art/'+path;img.onload=draw;
 images.set(path,img);return img;
}
function ready(path){const img=image(path);return img.complete&&img.naturalWidth?img:null;}
function message(text){$('message').textContent=text;}
function title(){return area?.area_id===R.COURT?'LILITH\u2019S COURTYARD':
  area?.area_id===R.VILLAGE?'THE VILLAGE':'OUTDOOR REGION';}
function persistPreview(){
 if(SERVER||!player)return;
 localStorage.setItem(PREVIEW_KEY,JSON.stringify({...player,
  doorOpen,firstCourtyardSeen:true}));
}
function previewArea(id){
 const template=R.templates[id];if(!template)throw Error('Unknown preview region');
 return template();
}
async function loadArea(id){
 area=SERVER?(await SERVER.area(id)).area:previewArea(id);
 if(!area||!area.floor||area.floor.length!==area.width*area.height)
  throw Error('Invalid region geometry');
 $('areaName').textContent=title();
 const door=area.objects.find(o=>o.id==='courtyard_temple_door');
 if(door){if(SERVER)doorOpen=!!door.open;else door.open=doorOpen;}
 draw();
}
function viewCamera(){
 camera.x=Math.max(0,Math.min(area.width-VIEW,Math.round(player.x-VIEW/2)));
 camera.y=Math.max(0,Math.min(area.height-VIEW,Math.round(player.y-VIEW/2)));
}
function px(color,x,y,w,h){ctx.fillStyle=color;ctx.fillRect(x,y,w,h);}
function floor(x,y){
 const f=area.floor[y*area.width+x];
 const colors={grass:'#36663b',path:'#716a61',garden:'#446f40',
  stone:'#625d64',roof:'#443940'};
 px(colors[f]||'#345d3b',x*TILE,y*TILE,TILE,TILE);
 const seed=(x*23+y*13+x*y*7)%17;
 if(f==='grass'||f==='garden'){
  px('#458147',x*TILE+(seed%23)+2,y*TILE+(seed%11)+6,4,2);
  px('#274a2e',x*TILE+22,y*TILE+18,3,3);
 }else if(f==='path'||f==='stone'){
  px('#958a81',x*TILE+1,y*TILE+2,28,2);
  px('#4e4850',x*TILE+16,y*TILE+14,13,2);
 }else if(f==='roof'){
  px('#5b4447',x*TILE+2,y*TILE+3,29,3);
 }
}
function drawWall(x,y){
 if(D?.drawWall(ctx,area,x,y,performance.now()/1000))return;
 px('#27232b',x*TILE,y*TILE,32,32);px('#777178',x*TILE+3,y*TILE+2,26,10);
 px('#4c4650',x*TILE+3,y*TILE+14,26,16);
 px('#a79ba3',x*TILE+2,y*TILE+2,28,3);
}
function willow(x,y,phase){
 const golden=player.form==='ghost',cx=(x+1.5)*TILE,cy=(y+1.5)*TILE;
 const adult=phase>=1;
 if(!adult){
  // Four-direction Lilith reference from the established temple art pack.
  const filename='characters/crystal-woman/crystal_woman_south.png';
  const woman=ready(filename);
  if(woman&&golden)ctx.drawImage(woman,cx-16,cy-20,32,32);
  else{
   px('#7f332c',cx-5,cy-17,11,6);
   px('#d9ac88',cx-4,cy-10,8,8);
   px(golden?'#336b36':'#913336',cx-7,cy-2,14,17);
   px('#34292d',cx-5,cy+12,4,4);px('#34292d',cx+2,cy+12,4,4);
  }
  return;
 }
 const amount=Math.max(0,Math.min(1,(phase-.6)/.4));
 px(golden?'#946024':'#302b2e',cx-6,cy-6,12,32);
 px(golden?'#a46d29':'#4b3e41',cx-12,cy+13,24,4);
 if(amount<.4)return;
 ctx.strokeStyle=golden?'#b78635':'#40383d';ctx.lineWidth=4;
 for(let i=-2;i<=2;i++){ctx.beginPath();ctx.moveTo(cx,cy);
  ctx.lineTo(cx+i*15,cy-26-Math.abs(i)*2);ctx.stroke();}
 if(golden){
  for(let i=-3;i<=3;i++){
   const bx=cx+i*12,by=cy-30-Math.round((3-Math.abs(i))*4);
   px('#d8a739',bx-7,by-7,14,13);px('#f4cf57',bx-4,by-5,8,7);
   px('#ae862d',bx-3,by+7,3,12+Math.abs(i)*2);
  }
 }else{
  for(let i=-2;i<=2;i++)px('#222125',cx+i*17-3,cy-31-Math.abs(i)*2,6,4);
 }
}
function drawObject(o){
 if(o.type==='willow'){
  const phase=lilithPhase==='playing'?
   Math.min(1,(performance.now()-animStart)/6200):1;
  willow(o.x,o.y,phase);return;
 }
 if(o.type==='gate'||o.type==='door'){
  const open=o.type==='gate'?true:doorOpen;
  px(open?'#221d29':'#754a4a',o.x*TILE+8,o.y*TILE+2,16,28);
  px('#b7a0a1',o.x*TILE+4,o.y*TILE,4,32);
  px('#b7a0a1',o.x*TILE+24,o.y*TILE,4,32);
  return;
 }
 if(o.door){
  const x=o.door.x,y=o.door.y;
  px('#201a22',x*TILE+8,y*TILE+5,16,27);
  px('#98747b',x*TILE+5,y*TILE+3,22,3);
 }
 if(o.type==='well'){
  px('#aca4a0',o.x*TILE+3,o.y*TILE+8,26,22);
  px('#28242e',o.x*TILE+7,o.y*TILE+12,18,14);
 }else if(o.type==='stall'){
  px('#65432e',o.x*TILE+2,o.y*TILE+7,28,20);
  px('#b9976b',o.x*TILE+3,o.y*TILE+3,26,6);
 }
}
function drawNpcs(){
 if(!living)return;
 for(const n of Object.values(living.npcs||{})){
  if(!n.alive||n.area_id!==area.area_id)continue;
  const x=n.x*TILE,y=n.y*TILE;
  px('#1d1b24',x+10,y+24,12,6);
  px(n.role==='guard'||n.role==='escort'?'#696ea0':
   n.role==='caravan'?'#a57b3d':'#725a65',x+9,y+13,14,13);
  px('#d6b48d',x+11,y+5,11,10);
  px('#332a32',x+10,y+4,13,4);
 }
 const camp=living.traveling_camps?.camp_1;
 if(camp?.present&&camp.area_id===area.area_id){
  const x=camp.x*TILE,y=camp.y*TILE;
  px('#9d8363',x-12,y-14,55,35);px('#60443e',x-8,y-10,47,8);
  px('#2c2228',x+10,y+6,10,15);
 }
}
function drawResources(){
 for(const node of gameplay?.resources||[]){
  if(!node.remaining)continue;
  const x=node.x*TILE,y=node.y*TILE;
  const color=node.type==='herbs'?'#9eb850':node.type==='ore'?'#a49a9d':'#7e5b34';
  px('#23282a',x+6,y+20,20,5);px(color,x+7,y+12,17,10);
  px(color,x+13,y+6,7,9);
 }
}
function draw(){
 if(!area||!player)return;
 viewCamera();
 ctx.imageSmoothingEnabled=false;ctx.setTransform(1,0,0,1,0,0);
 ctx.clearRect(0,0,canvas.width,canvas.height);
 ctx.save();ctx.translate(-camera.x*TILE,-camera.y*TILE);
 for(let y=camera.y;y<Math.min(area.height,camera.y+VIEW);y++)
  for(let x=camera.x;x<Math.min(area.width,camera.x+VIEW);x++)floor(x,y);
 for(let y=camera.y;y<Math.min(area.height,camera.y+VIEW);y++)
  for(let x=camera.x;x<Math.min(area.width,camera.x+VIEW);x++)
   if(area.walls[y*area.width+x])drawWall(x,y);
 for(const o of area.objects)drawObject(o);
 drawResources();
 drawNpcs();
 const spriteGroup=player.form==='ghost'?'ghost':'human';
 const pImg=ready('characters/'+spriteGroup+'/'+spriteGroup+'_'+player.facing+'.png');
 if(pImg)ctx.drawImage(pImg,player.x*TILE,player.y*TILE,TILE,TILE);
 else{
  px('#342b30',player.x*TILE+9,player.y*TILE+20,14,10);
  px(player.form==='ghost'?'#bbc6ed':'#b4826b',player.x*TILE+9,player.y*TILE+8,14,14);
 }
 ctx.restore();
 $('characterStatus').textContent=player.form.toUpperCase()+' · ('+player.x+', '+player.y+
  ') · '+player.facing.toUpperCase();
}
function actorAt(x,y){
 const npc=Object.values(living?.npcs||{}).find(n=>n.alive&&n.area_id===area.area_id&&n.x===x&&n.y===y);
 if(npc)return {npc};
 const object=area.objects.find(o=>o.type==='willow'&&x>=o.x&&x<o.x+3&&y>=o.y&&y<o.y+3||
  o.door&&o.door.x===x&&o.door.y===y||
  o.x===x&&o.y===y);
 return object?{object}:null;
}
function targetTile(e){
 const r=canvas.getBoundingClientRect();
 if(!r.width||!r.height)return null;
 const x=camera.x+Math.floor((e.clientX-r.left)/r.width*VIEW);
 const y=camera.y+Math.floor((e.clientY-r.top)/r.height*VIEW);
 return x<0||y<0||x>=area.width||y>=area.height?null:{x,y};
}
function packText(c){
 if(!c)return 'No character loaded';
 const goods=Object.entries(c.inventory||{}).filter(([,count])=>count>0)
   .map(([name,count])=>name+': '+count).join(' · ')||'Empty pack';
 return 'Gold: '+(c.gold??0)+' · Banked: '+(c.bank_gold??0)+
   '\n'+goods+'\nForaging '+(c.skills?.foraging??0)+
   ' · Commerce '+(c.skills?.commerce??0);
}
async function refreshSocial(){
 if(!SERVER||!player)return;
 try{
  social=await SERVER.social();
  const active=social.contracts?.[0];
  $('socialStatus').textContent='Reputation: Town '+(social.reputation?.town||0)+
    ', Courtyard '+(social.reputation?.courtyard||0)+
    ', Travelers '+(social.reputation?.travelers||0)+
    ' · Contacts '+Object.keys(social.contacts||{}).length+
    (active?' · Commission: '+active.quantity+' '+active.item_type+
      ' for '+active.reward+' gold':' · No active commission');
 }catch(e){$('socialStatus').textContent='Social records unavailable: '+e.message;}
}
function closestNpc(){
 return Object.values(living?.npcs||{}).filter(n=>n.alive&&n.area_id===player.area_id&&
  Math.abs(n.x-player.x)+Math.abs(n.y-player.y)<=2)
 .sort((a,b)=>(Math.abs(a.x-player.x)+Math.abs(a.y-player.y))-
  (Math.abs(b.x-player.x)+Math.abs(b.y-player.y)))[0]||null;
}
async function socialAction(action,fields={}){
 if(!SERVER)return message('People and commissions require a connected DK Server.');
 if(busy)return;
 busy=true;
 try{
  const result=await SERVER.socialAction(action,fields);
  if(result.character)player=result.character;
  message(action==='talk'?result.dialogue.name+': "'+result.dialogue.line+'"':
   result.event?.text||'Conversation recorded.');
  await Promise.all([refreshSocial(),refreshGameplay(),refreshLiving()]);
 }catch(e){message('Cannot '+action.replaceAll('_',' ')+': '+e.message);}
 finally{busy=false;}
}
function talk(){
 const npc=closestNpc();
 if(!npc)return message('Move next to a resident and try again.');
 return socialAction('talk',{npc_id:npc.id});
}
function acceptContract(){
 const nearby=Object.values(living?.businesses||{}).filter(b=>{
  const owner=living?.npcs?.[b.owner_id];
  return b.open&&owner?.alive&&b.area_id===player.area_id&&
   Math.abs(owner.x-player.x)+Math.abs(owner.y-player.y)<=3;
 });
 const offered=nearby.find(b=>['village_bakery','village_smithy','village_market',
  'village_tavern','courtyard_market'].includes(b.id));
 if(!offered)return message('Stand beside an open shop owner to request a commission.');
 return socialAction('accept_contract',{business_id:offered.id});
}
function deliverContract(){
 const contract=social?.contracts?.[0];
 if(!contract)return message('You have no active commission.');
 return socialAction('complete_contract',{contract_id:contract.id});
}
async function refreshGameplay(){
 if(!SERVER)return;
 try{
  gameplay=await SERVER.gameplay();
  player={...player,...gameplay.character};
  $('packStatus').textContent=packText(gameplay.character);
  const needs=gameplay.character.crafting;
  if(needs)$('needsStatus').textContent='Health '+needs.health+
    ' · Hunger '+needs.hunger+' · Energy '+needs.energy+
    ' · Crafting '+needs.skill+' · Hand '+(needs.hand||'empty')+
    ' · Light '+(needs.light||'none')+
    (needs.incapacitated?' · UNCONSCIOUS: REST TO RECOVER':'');
 }catch(e){message('Inventory unavailable: '+e.message);}
 draw();
}
function closestBusiness(){
 if(!gameplay)return null;
 const possibilities=gameplay.businesses.filter(b=>b.product!=='bank').map(b=>{
   const o=area.objects.find(o=>o.id===b.id);
   const x=o?.door?.x??o?.x,y=o?.door?o.door.y+1:o?.y;
   return {...b,distance:Math.abs(player.x-x)+Math.abs(player.y-y)};
 }).filter(b=>Number.isFinite(b.distance)&&b.distance<=3&&b.open);
 return possibilities.sort((a,b)=>a.distance-b.distance)[0]||null;
}
async function takeAction(action,fields={}){
 if(!SERVER)return message('A connected DK Server is required for persistent transactions.');
 if(busy)return;
 busy=true;
 try{
  const result=await SERVER.gameAction(action,fields);
  player=result.character;
  message('Saved: '+result.event.text);
  await Promise.all([refreshGameplay(),refreshLiving()]);
 }catch(e){message('Cannot '+action.replaceAll('_',' ')+': '+e.message);}
 finally{busy=false;}
}
async function gather(){
 if(!gameplay)return message('No persistent world is connected.');
 const near=(gameplay.resources||[]).filter(n=>n.remaining>0&&
   Math.abs(player.x-n.x)+Math.abs(player.y-n.y)<=2)
  .sort((a,b)=>(Math.abs(player.x-a.x)+Math.abs(player.y-a.y))-
    (Math.abs(player.x-b.x)+Math.abs(player.y-b.y)));
 if(!near.length)return message('Move beside an herb patch, ore outcrop, or wood resource.');
 await takeAction('gather',{node_id:near[0].id});
}
async function trade(buy){
 const shop=closestBusiness();
 if(!shop)return message('Find an open shop or market and stand beside it.');
 if(buy)return takeAction('buy',{business_id:shop.id,quantity:1});
 const buys={
  village_smithy:['ore','wood'],village_market:['herbs','produce'],
  courtyard_market:['herbs'],village_bakery:['produce'],village_tavern:['meals','produce']
 }[shop.id]||[];
 const item=buys.find(type=>(player.inventory?.[type]||0)>0);
 if(!item)return message('This shop cannot buy anything currently in your pack.');
 await takeAction('sell',{business_id:shop.id,item_type:item,quantity:1});
}
async function refreshLiving(){
 if(!SERVER)return;
 try {
  [living,clock]=await Promise.all([SERVER.living(),SERVER.clock()]);
  $('worldStatus').textContent=clock.running?'WORLD RUNNING':'WORLD PAUSED';
  $('clockStatus').textContent=clock.phase.toUpperCase()+
   ' · '+Math.ceil(clock.seconds_until_transition/60)+' min until transition';
  const present=Object.values(living.npcs).filter(n=>n.alive&&n.area_id===area.area_id);
  $('activityStatus').textContent=present.length+' NPCs nearby · '+
    Object.values(living.businesses).filter(b=>b.area_id===area.area_id&&b.open).length+
    ' businesses open · '+Object.values(living.territories).filter(t=>t.control==='monsters').length+
    ' territories occupied';
 }catch(e){$('worldStatus').textContent='SERVER UNAVAILABLE';message(e.message);}
 draw();
}
function previewWorld(){
 return {areas:{[R.TEMPLE]:{objects:[{id:'temple_north_door',open:doorOpen}]},
  [R.COURT]:R.courtyard(),[R.VILLAGE]:R.village()}};
}
function returnTemple(){
 rightHeld=false;
 if(SERVER){location.href='./test-center.html?dkSlot='+slot;return;}
 try{
  const data=JSON.parse(localStorage.getItem(TEMPLE_SAVE)||'null');
  const saved=data?.slots?.[0]?.scene;
  if(saved){
   saved.player={x:8,y:1,facing:'south',form:player.form};
   saved.introSeen=true;
   const door=saved.objects?.find(o=>o.id==='temple_north_door');
   if(door)door.open=doorOpen;
   data.slots[0].scene=saved;localStorage.setItem(TEMPLE_SAVE,JSON.stringify(data));
  }
 }catch(_){}
 location.href='./test-center.html?from=courtyard';
}
async function step(direction){
 if(busy||lilithPhase==='playing')return;
 const delta={north:[0,-1],east:[1,0],south:[0,1],west:[-1,0]}[direction];
 if(!delta)return;
 const x=player.x+delta[0],y=player.y+delta[1];
 if(SERVER){
  busy=true;
  try {
   const next=await SERVER.action(slot,'move',{direction});
   if(next.area_id===R.TEMPLE){returnTemple();return;}
   player=next;
   if(area.area_id!==player.area_id)await loadArea(player.area_id);
   persistPreview();
  }catch(e){message('Movement blocked: '+e.message);}
  finally{busy=false;}
 }else{
  const link=R.portal(previewWorld(),area.area_id,x,y);
  if(link?.blocked)return message('The temple door is closed. Double-click to open it.');
  if(link){
   player={...player,...link};
   if(player.area_id===R.TEMPLE){returnTemple();return;}
   await loadArea(player.area_id);
  }else if(R.traversable(area,x,y,player.form)){
   player.x=x;player.y=y;player.facing=direction;
  }else return message('A wall or object blocks the way.');
  persistPreview();
 }
 draw();
}
async function toggleDoor(){
 if(Math.abs(player.x-32)+Math.abs(player.y-48)>1)
  return message('Move beside the temple door first.');
 if(SERVER){
  if(busy)return;busy=true;
  try{
   await SERVER.action(slot,'toggle_door');
   await loadArea(area.area_id);
   const door=area.objects.find(o=>o.id==='courtyard_temple_door');
   doorOpen=!!door?.open;
  }catch(e){message(e.message);}
  finally{busy=false;}
 }else{doorOpen=!doorOpen;persistPreview();}
 message('Temple door '+(doorOpen?'opened.':'closed.')+' Walk into it to enter.');
 draw();
}
function inspect(x,y,doubleClick){
 const item=actorAt(x,y);if(!item)return message('Nothing notable here.');
 if(item.npc){
  const n=item.npc;
  if(doubleClick&&SERVER)return socialAction('talk',{npc_id:n.id});
  return message(n.name+' · '+n.role+' · '+n.status+(SERVER?' · Double-click to talk.':'.'));
 }
 const o=item.object;
 if(o.id==='courtyard_temple_door'){
  if(doubleClick)toggleDoor();
  else message('Temple door: '+(doorOpen?'open. Walk into it to enter.':'closed. Double-click to open.'));
 }else if(o.type==='willow')
  message(player.form==='ghost'?'Lilith has become a golden weeping willow.':
    'Lilith has become a sickly black weeping willow.');
 else if(o.type==='bank'&&doubleClick)openBank();
 else message(o.type.toUpperCase()+' · '+o.id);
}
async function openBank(){
 const bank=area?.objects.find(o=>o.id==='village_bank');
 if(!bank||area.area_id!==R.VILLAGE||
  Math.abs(player.x-54)+Math.abs(player.y-103)>3)
  return message('Visit the Village Bank doorway to open your bank box.');
 if(!SERVER)return message('Bank letters require the hosted DK Server. This is only a static preview.');
 try{
  const box=await SERVER.bankBox();
  $('letters').replaceChildren();
  if(!box.letters.length)$('letters').textContent='Your bank box is empty.';
  for(const letter of box.letters){
   const node=document.createElement('article');
   const title=document.createElement('strong');
   title.textContent=letter.subject+' · From '+letter.from;
   const body=document.createElement('p');body.textContent=letter.body;
   const collect=document.createElement('button');collect.type='button';collect.textContent='COLLECT LETTER';
   collect.addEventListener('click',async()=>{
    try{await SERVER.collectLetter(letter.id);message('Collected '+letter.subject);openBank();}
    catch(e){message(e.message);}
   });
   node.append(title,body,collect);$('letters').append(node);
  }
  $('bankPanel').hidden=false;
 }catch(e){message(e.message);}
}
function pointerMove(){
 if(!rightHeld||!pointer||busy||!player||!area)return;
 const dx=pointer.x-player.x,dy=pointer.y-player.y;
 if(!dx&&!dy)return;
 const direction=Math.abs(dx)>=Math.abs(dy)?
  dx>0?'east':'west':dy>0?'south':'north';
 const stamp=Date.now();
 if(stamp-lastMove<165)return;lastMove=stamp;
 step(direction);
}
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('mousedown',e=>{if(e.button===2){e.preventDefault();pointer=targetTile(e);rightHeld=true;canvas.focus();}});
canvas.addEventListener('mousemove',e=>{if(rightHeld)pointer=targetTile(e);});
document.addEventListener('mouseup',e=>{if(e.button===2)rightHeld=false;});
window.addEventListener('blur',()=>{rightHeld=false;});
canvas.addEventListener('click',e=>{if(e.button!==0)return;const p=targetTile(e);if(p)inspect(p.x,p.y,false);canvas.focus();});
canvas.addEventListener('dblclick',e=>{if(e.button!==0)return;const p=targetTile(e);if(p)inspect(p.x,p.y,true);});
document.addEventListener('keydown',e=>{
 const tag=e.target?.tagName;
 if(tag==='INPUT'||tag==='TEXTAREA'||tag==='BUTTON')return;
 const dir={ArrowUp:'north',w:'north',ArrowDown:'south',s:'south',
  ArrowLeft:'west',a:'west',ArrowRight:'east',d:'east'}[e.key.length===1?e.key.toLowerCase():e.key];
 if(dir){e.preventDefault();step(dir);}
});
$('showBank').addEventListener('click',openBank);
$('closeBank').addEventListener('click',()=>{$('bankPanel').hidden=true;});
$('gatherButton').addEventListener('click',gather);
$('craftTorch').addEventListener('click',()=>takeAction('craft',{recipe:'torch'}));
$('craftRations').addEventListener('click',()=>takeAction('craft',{recipe:'rations'}));
$('craftBandages').addEventListener('click',()=>takeAction('craft',{recipe:'bandages'}));
$('eatFood').addEventListener('click',()=>{
 const inventory=player?.inventory||{};
 const choice=['rations','meals','bread','produce'].find(i=>inventory[i]>0);
 if(!choice)return message('There is no food in your pack.');
 takeAction('consume',{item_type:choice});
});
$('equipTools').addEventListener('click',()=>{
 const gear=player?.crafting;
 takeAction(gear?.hand?'unequip':'equip',gear?.hand?{slot:'hand'}:{item_type:'tools'});
});
$('equipTorch').addEventListener('click',()=>{
 const gear=player?.crafting;
 takeAction(gear?.light?'unequip':'equip',gear?.light?{slot:'light'}:{item_type:'torches'});
});
$('restButton').addEventListener('click',()=>takeAction('rest'));
$('talkButton').addEventListener('click',talk);
$('contractButton').addEventListener('click',acceptContract);
$('deliverButton').addEventListener('click',deliverContract);
$('buyButton').addEventListener('click',()=>trade(true));
$('sellButton').addEventListener('click',()=>trade(false));
$('depositButton').addEventListener('click',()=>takeAction('bank_deposit',{amount:1}));
$('withdrawButton').addEventListener('click',()=>takeAction('bank_withdraw',{amount:1}));
function frame(now){
 if(now-lastDraw>=60){pointerMove();if(area)draw();lastDraw=now;}
 requestAnimationFrame(frame);
}
async function begin(){
 try{
  if(SERVER){
   await SERVER.startWorld();
   player=await SERVER.getCharacter(slot);
   if(player.area_id===R.TEMPLE){location.href='./test-center.html?dkSlot='+slot;return;}
   doorOpen=true;await loadArea(player.area_id);
   const last=Number(sessionStorage.getItem('dk.lilith.entry.'+slot)||0);
   if(player.area_id===R.COURT&&player.courtyard_visit_count===1&&last!==1){
    firstVisit=true;sessionStorage.setItem('dk.lilith.entry.'+slot,'1');
   }
   await Promise.all([refreshLiving(),refreshGameplay(),refreshSocial()]);
   setInterval(refreshLiving,10000);setInterval(refreshGameplay,10000);setInterval(refreshSocial,15000);
  }else{
   const saved=JSON.parse(localStorage.getItem(PREVIEW_KEY)||'null');
   player=saved&&[R.COURT,R.VILLAGE].includes(saved.area_id)?saved:
    {area_id:R.COURT,x:32,y:47,facing:'north',form:'ghost'};
   doorOpen=saved?.doorOpen!==false;
   firstVisit=!saved?.firstCourtyardSeen&&player.area_id===R.COURT;
   await loadArea(player.area_id);
   persistPreview();
   $('worldStatus').textContent='BROWSER PREVIEW';
   $('clockStatus').textContent='No persistent world connected';
   $('packStatus').textContent='Persistent inventory and trading require DK Server.';
   $('socialStatus').textContent='Social records require DK Server.';
   $('needsStatus').textContent='Crafting and survival need DK Server.';
   for(const id of ['gatherButton','buyButton','sellButton','depositButton','withdrawButton','talkButton','contractButton','deliverButton','craftTorch','craftRations','craftBandages','eatFood','equipTools','equipTorch','restButton'])
     $(id).disabled=true;
  }
  if(firstVisit){
   lilithPhase='playing';animStart=performance.now();
   message(player.form==='ghost'?
    'Lilith stands in a green dress. Her form begins to take root.':
    'Lilith stands in a red dress. Her limbs darken and twist.');
   setTimeout(()=>{lilithPhase='finished';message(player.form==='ghost'?
     'Lilith has become the golden weeping willow.':
     'Lilith has become the sickly black weeping willow.');},6300);
  }else message('Explore the world. Houses have true exterior footprints.');
  canvas.focus();requestAnimationFrame(frame);
 }catch(e){message('The region could not open: '+e.message);$('worldStatus').textContent='LOAD FAILED';}
}
begin();
})();
