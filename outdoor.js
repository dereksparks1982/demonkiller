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
let area=null,world=null,player=null,living=null,gameplay=null,social=null,law=null,housing=null,busy=false,rightHeld=false;
let pointer=null,camera={x:0,y:0},lastMove=0,lastDraw=0,animStart=0;
let architectCamera=null,architectZoom=1;
const visual={x:0,y:0,queue:[]};
function resetVisual(){if(player){visual.x=player.x;visual.y=player.y;visual.queue.length=0;}}
let lilithPhase='finished',firstVisit=false,doorOpen=true,clock=null;
const cellShells=window.DKStreamingCellShells?.create({maxShells:256})||null;
const cellContents=window.DKCellContents?.create()||null;
let cellContentsPending=false,cellContentsErrors=0;
async function refreshCellContents(){
 if(!SERVER||!player||!area||!cellContents||cellContentsPending)return;
 cellContentsPending=true;
 const requestedArea=area.area_id;
 try{
  const snapshot=await SERVER.cellContents(cellContents.stats().cursor,24);
  if(!area||area.area_id!==requestedArea||snapshot.area_id!==requestedArea){
   cellContents.reset();return;
  }
  cellContents.apply(snapshot);cellContentsErrors=0;
  // Fixture doors remain world-owned. Copy only their current visible
  // presentation flags, never positions, collision or room geometry.
  const byId=new Map(area.objects.map(o=>[o.id,o]));
  for(const fixture of cellContents.fixtures()){
   const object=byId.get(fixture.id);
   if(!object)continue;
   if(Object.prototype.hasOwnProperty.call(fixture,'open')&&
    Object.prototype.hasOwnProperty.call(object,'open'))
    object.open=fixture.open;
   if(Object.prototype.hasOwnProperty.call(fixture,'locked')&&
    Object.prototype.hasOwnProperty.call(object,'locked'))
    object.locked=fixture.locked;
   if(fixture.id==='courtyard_temple_door'&&typeof fixture.open==='boolean')
    doorOpen=fixture.open;
  }
  draw();
 }catch(_){
  if(++cellContentsErrors>=2){cellContents.reset();cellContentsErrors=0;}
 }finally{cellContentsPending=false;}
}

let cellViewPending=false;
async function refreshCellView(){
 if(!SERVER||!area||!cellShells||cellViewPending)return;
 cellViewPending=true;
 const areaId=area.area_id;
 try{
  const view=await SERVER.streamingCells();
  if(area?.area_id===areaId&&view.area_id===areaId)
   cellShells.setCellView(view);
 }catch(_){/* The legacy renderer remains available. */}
 finally{cellViewPending=false;}
}

// M31: nearby entities arrive through bounded server-sector deltas.
// This is client display state only; the server remains authoritative.
let sectorView=null,sectorCursor=null,sectorPolling=false,sectorErrors=0;
let terrainSession=null,terrainFailures=0,terrainRecovering=false;
async function recoverFullTerrain(session){
 if(terrainRecovering||terrainSession!==session||!SERVER||!area)return;
 terrainRecovering=true;
 const id=area.area_id;
 try{
  const complete=(await SERVER.area(id)).area;
  if(terrainSession!==session||area.area_id!==id)return;
  if(!complete?.floor||complete.floor.length!==complete.width*complete.height)
   throw Error('Invalid region fallback');
  session.close();terrainSession=null;terrainFailures=0;
  // Keep the current player position, visual interpolation, and input state.
  area=complete;draw();
 }catch(_){terrainFailures=0;}
 finally{terrainRecovering=false;}
}
function checkTerrainFetch(session,result){
 if(terrainSession!==session)return;
 if(result.failed===0){terrainFailures=0;return;}
 if(++terrainFailures>=3)void recoverFullTerrain(session);
}
function prefetchTerrain(){
 if(!terrainSession||!player||!area||area.area_id!==player.area_id)return;
 const session=terrainSession;
 try{
  const desired=session.setFocus(player.x,player.y);
  // Prefetch up to two sectors around the character. Never block walking
  // on a network request; the server alone determines movement legality.
  void session.prefetch(session.around(player.x,player.y,2))
   .then(result=>checkTerrainFetch(session,result)).catch(()=>{});
 }catch(_){}
}

function nearbyDisplay(kind,fallback){
 // M34 authoritative Streaming Cell contents replace broader region scans
 // when the current player view has been freshly materialized.
 const materialized=cellContents?.visible(kind,player,12);
 if(materialized!==null&&materialized!==undefined){
  if(kind==='scavenger')
   return materialized.map(o=>({...o,kind:o.species||o.type}));
  return materialized;
 }
 const view=sectorView;
 if(!view||!area||!player||view.area_id!==area.area_id||
    Math.abs(player.x-view.origin.x)>12||
    Math.abs(player.y-view.origin.y)>12)return fallback;
 const entries=[...view.entities.values()].filter(x=>x.kind===kind);
 if(kind==='scavenger')return entries.map(x=>({...x,kind:x.type}));
 return entries;
}
async function refreshSectorInterest(){
 if(!SERVER||!player||sectorPolling||!area)return;
 sectorPolling=true;
 const requestArea=area.area_id;
 try{
  const state=await SERVER.sectorInterest(sectorCursor,24);
  if(!area||state.area_id!==area.area_id||requestArea!==area.area_id){
   sectorView=null;sectorCursor=null;return;
  }
  if(state.reset||!sectorView||sectorView.area_id!==state.area_id)
   sectorView={area_id:state.area_id,origin:state.origin,
    entities:new Map(),sectors:[]};
  sectorView.origin=state.origin;
  sectorView.sectors=state.sectors;
  for(const key of state.removed)sectorView.entities.delete(key);
  for(const entry of state.upsert)
   sectorView.entities.set(entry.kind+':'+entry.id,entry);
  sectorCursor=state.cursor;sectorErrors=0;
  if(terrainSession&&terrainSession.area.area_id===state.area_id){
   try{
    terrainSession.setFocus(player.x,player.y);
    // Client cache de-duplicates already loaded chunks and caps concurrency.
    const session=terrainSession;
    void session.prefetch(state.sectors)
     .then(result=>checkTerrainFetch(session,result)).catch(()=>{});
   }catch(_){}
  }
  draw();
 }catch(error){
  sectorErrors++;
  if(sectorErrors>=2){sectorView=null;sectorCursor=null;}
 }finally{sectorPolling=false;}
}

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
 // Exportable Architect drafts stay separate from character saves.
 try{
  const key='dkSoftworks.demonkiller.architect.outdoorDraft.m37.'+id;
  const record=JSON.parse(localStorage.getItem(key)||'null');
  if(record?.area?.area_id===id&&record.area.width===template().width&&
     record.area.height===template().height)return R.checkRegion(record.area);
 }catch(_){}
 return template();
}
async function loadArea(id){
 const changed=!area||area.area_id!==id;
 if(terrainSession){terrainSession.close();terrainSession=null;}
 terrainFailures=0;
 let nextArea=null;
 if(SERVER&&window.DKSectorTerrain&&!window.DKOutdoorArchitect?.isOpen()){
  let candidate=null;
  try{
   const manifest=await SERVER.sectorManifest(id);
   candidate=window.DKSectorTerrain.makeSession({
    manifest,
    loadChunk:(region,sx,sy)=>SERVER.sectorChunk(region,sx,sy),
    onChange:(updated)=>{if(terrainSession===candidate&&area===updated)draw();}
   });
   await candidate.prime(player.x,player.y);
   terrainSession=candidate;nextArea=candidate.area;
   // The first ring is ready to draw; extra sectors stream in the background.
   void candidate.prefetch(candidate.around(player.x,player.y,2)).catch(()=>{});
  }catch(error){
   candidate?.close();
   // A failed or outdated server must not leave the player on partial tiles.
   nextArea=(await SERVER.area(id)).area;
  }
 }else nextArea=SERVER?(await SERVER.area(id)).area:previewArea(id);
 area=nextArea;
 if(!area||!area.floor||area.floor.length!==area.width*area.height)
  throw Error('Invalid region geometry');
 if(changed){resetVisual();sectorView=null;sectorCursor=null;cellShells?.reset();cellContents?.reset();}
 if(window.DKOutdoorArchitect?.isOpen())cellShells?.reset();
 $('areaName').textContent=title();
 const door=area.objects.find(o=>o.id==='courtyard_temple_door');
 if(door){if(SERVER)doorOpen=!!door.open;else door.open=doorOpen;}
 draw();
 if(SERVER){void refreshCellView();void refreshCellContents();}
}
function viewCamera(){
 if(architectCamera){
  const span=VIEW/architectZoom;
  camera.x=Math.max(0,Math.min(Math.max(0,area.width-span),architectCamera.x));
  camera.y=Math.max(0,Math.min(Math.max(0,area.height-span),architectCamera.y));
  architectCamera.x=camera.x;architectCamera.y=camera.y;
  return;
 }
 // Follow the interpolated actor, not the next authoritative tile.
 camera.x=Math.max(0,Math.min(area.width-VIEW,visual.x-VIEW/2));
 camera.y=Math.max(0,Math.min(area.height-VIEW,visual.y-VIEW/2));
}
function px(color,x,y,w,h){ctx.fillStyle=color;ctx.fillRect(x,y,w,h);}
function floor(x,y){
 const f=area.floor[y*area.width+x];
 if(area.streamed&&f===null){
  // Explicit unready tile; never silently invent grass or wall collision.
  px('#26252c',x*TILE,y*TILE,TILE,TILE);return;
 }
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
 for(const n of nearbyDisplay('npc',Object.values(living.npcs||{}))){
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
function drawMonsters(){
 if(!living?.combat)return;
 for(const n of nearbyDisplay('monster',Object.values(living.combat.creatures||{}))){
  if(!n.alive||n.area_id!==area.area_id)continue;
  const x=n.x*TILE,y=n.y*TILE;
  px('#201920',x+9,y+24,15,5);px('#793348',x+10,y+13,13,13);
  px('#aa4550',x+10,y+8,14,10);px('#e1be84',x+11,y+14,3,3);
  px('#e1be84',x+19,y+14,3,3);
 }
 for(const drop of Object.values(living.combat.drops||{})){
  if(drop.area_id!==area.area_id)continue;
  const x=drop.x*TILE,y=drop.y*TILE;
  px('#28242a',x+7,y+19,18,8);px('#d2ae55',x+11,y+16,10,5);
 }
}
// M29 remains are static terrain features. They never participate in
// movement collision and always use the same 32px Zelda-era pixel scale.
function drawTerrainMarks(){
 for(const mark of Object.values(living?.mobile_assets?.terrain_marks||{})){
  if(mark.area_id!==area.area_id)continue;
  const x=mark.x*TILE,y=mark.y*TILE;
  const age=Math.max(0,(living.minute||0)-mark.created_minute);
  const fade=Math.max(0,1-age/2880);
  if(fade<=0)continue;
  ctx.save();ctx.globalAlpha=Math.max(.12,Math.min(.65,fade*.65));
  px(mark.kind==='ash'?'#2b2631':'#3d322f',x+5,y+23,24,6);
  px(mark.kind==='ash'?'#5b454b':'#645248',x+8,y+20,13,3);
  px(mark.kind==='ash'?'#444049':'#79694e',x+20,y+26,5,2);
  ctx.restore();
 }
}
// M30 graves and carrion animals are saved world objects, rendered beneath
// characters without changing the approved collision or walking system.
function drawBurials(){
 for(const grave of nearbyDisplay('grave',Object.values(living?.burials||{}))){
  if(grave.area_id!==area.area_id)continue;
  const x=grave.x*TILE,y=grave.y*TILE;
  px('#40372f',x+4,y+21,25,8);
  px(grave.stage==='fresh'?'#645246':'#524b43',x+8,y+16,18,8);
  px('#746d67',x+12,y+9,10,14);
  px('#ac9f8e',x+13,y+10,8,2);
  if(grave.stage==='overgrown'){
   px('#46613b',x+7,y+20,5,4);px('#536945',x+24,y+22,5,6);
   px('#52683d',x+15,y+27,10,3);
  }else if(grave.stage==='settled'){
   px('#837b6e',x+19,y+22,4,2);
  }
 }
}
function drawScavengers(){
 for(const animal of nearbyDisplay('scavenger',Object.values(living?.scavengers||{}))){
  if(animal.area_id!==area.area_id)continue;
  const x=animal.x*TILE,y=animal.y*TILE;
  if(animal.kind==='raven'){
   px('#22232d',x+9,y+13,16,10);
   px('#33343e',x+6,y+14,7,6);
   px('#bf9c69',x+23,y+17,5,3);
   px('#171922',x+10,y+23,2,4);px('#171922',x+19,y+23,2,4);
  }else if(animal.kind==='rat'){
   px('#655657',x+8,y+20,15,7);
   px('#8e7972',x+9,y+18,5,4);
   px('#b0867c',x+22,y+25,7,2);
  }else{
   px('#32313a',x+12,y+21,8,6);px('#695e55',x+10,y+20,3,4);
   px('#695e55',x+21,y+20,3,4);
  }
 }
}
function drawCorpses(){
 for(const body of nearbyDisplay('corpse',Object.values(living?.mobile_assets?.corpses||{}))){
  if(body.area_id!==area.area_id)continue;
  const x=body.x*TILE,y=body.y*TILE;
  const monster=body.kind==='monster'||body.species==='demon';
  const stage=body.stage||'fresh';
  const color=monster?{
   fresh:'#803c4a',early:'#653448',decaying:'#422735',
   skeletal:'#998b8b',scattered:'#4d3b40'
  }:{
   fresh:'#866b5f',early:'#74645d',decaying:'#564b48',
   skeletal:'#c1b9a4',scattered:'#9c9683'
  };
  px('#27212a',x+6,y+24,21,4);
  if(stage==='scattered'){
   px(color.scattered,x+8,y+20,6,3);
   px(color.scattered,x+17,y+23,9,2);
   px(monster?'#6f424a':'#bbb39d',x+12,y+16,5,3);
   continue;
  }
  if(stage==='skeletal'){
   px(color.skeletal,x+12,y+13,11,7); // skull
   px('#28242c',x+14,y+16,2,2);
   px('#28242c',x+20,y+16,2,2);
   px(color.skeletal,x+10,y+21,13,2);
   px(color.skeletal,x+13,y+24,3,5);
   px(color.skeletal,x+20,y+24,3,5);
   continue;
  }
  const shade=color[stage]||color.fresh;
  px(shade,x+10,y+14,18,11);
  px(monster?'#8f4b52':'#b69b86',x+6,y+12,10,8);
  px('#33272d',x+8,y+19,3,3);
  px(monster?'#8b7772':'#302c2b',x+18,y+25,9,3);
  if(stage==='early'||stage==='decaying'){
   px('#544b3b',x+11,y+17,5,3);
   px('#261d28',x+23,y+20,3,4);
   // Small irregular specks suggest flies without extra sprite animations.
   if(stage==='decaying'){
    px('#99907c',x+6,y+5,2,2);px('#99907c',x+24,y+9,2,2);
    px('#514946',x+15,y+25,7,3);
   }
  }
 }
}

function closestCorpse(){
 return Object.values(living?.mobile_assets?.corpses||{}).filter(body=>
  body.area_id===player.area_id&&Math.abs(body.x-player.x)+
   Math.abs(body.y-player.y)<=1)[0]||null;
}
function lootCorpse(){
 const body=closestCorpse();
 if(!body)return message('Move beside a fallen resident to recover their belongings.');
 return takeAction('loot_corpse',{corpse_id:body.id});
}
function buryCorpse(){
 if(!SERVER)return message('Burial requires the local DK Server.');
 const corpse=Object.values(living?.mobile_assets?.corpses||{}).find(b=>
  b.kind==='npc'&&b.area_id===player.area_id&&
  Math.abs(b.x-player.x)+Math.abs(b.y-player.y)<=1);
 if(!corpse)return message('Move beside a human body before pressing B.');
 if(!window.confirm('Bury '+corpse.name+'? Any possessions still on the body will be buried and cannot be recovered.'))
  return;
 takeAction('bury_corpse',{corpse_id:corpse.id});
}
function nearestCreature(){
 return Object.values(living?.combat?.creatures||{}).filter(n=>n.alive&&
  n.area_id===player.area_id&&Math.abs(n.x-player.x)+Math.abs(n.y-player.y)<=1)[0]||null;
}
function nearestLoot(){
 return Object.values(living?.combat?.drops||{}).filter(d=>
  d.area_id===player.area_id&&Math.abs(d.x-player.x)+Math.abs(d.y-player.y)<=1)[0]||null;
}
function attack(){const n=nearestCreature();if(!n)return message('Move beside a living imp to attack.');
 return takeAction('attack',{target_id:n.id});}
function loot(){const d=nearestLoot();if(!d)return message('Move beside a loot pile first.');
 return takeAction('loot',{drop_id:d.id});}
function drawHouseSigns(){
 if(!area)return;
 for(const house of area.objects){
  if(house.type!=='house'||!house.door)continue;
  const x=house.door.x*TILE,y=house.door.y*TILE;
  px('#4a3023',x+20,y+6,3,16);
  px('#927048',x+15,y+3,14,10);
  px('#d6b883',x+17,y+5,9,2);
 }
}
function drawChest(){
 if(!area||area.area_id!==R.VILLAGE)return;
 const x=54*TILE,y=105*TILE;
 px('#241e1b',x+4,y+13,25,15);
 px('#775439',x+4,y+10,24,17);
 px('#be965f',x+6,y+12,20,3);
 px('#d3b067',x+14,y+17,5,6);
}
function drawGroundItems(){
 for(const d of Object.values(living?.storage?.ground||{})){
  if(d.area_id!==area.area_id)continue;
  const x=d.x*TILE,y=d.y*TILE;
  px('#2b241f',x+6,y+17,19,11);
  px('#8e724d',x+8,y+14,16,11);
  px('#b39864',x+11,y+16,10,3);
 }
}
function closestGroundItem(){
 return Object.values(living?.storage?.ground||{}).filter(d=>
  d.area_id===player.area_id&&Math.abs(d.x-player.x)+Math.abs(d.y-player.y)<=1)[0]||null;
}
function itemOrder(){
 const item_type=$('itemChoice').value;
 const quantity=Number($('itemQuantity').value);
 if(!Number.isSafeInteger(quantity)||quantity<1||quantity>20){
  message('Select between 1 and 20 items.');return null;
 }
 return {item_type,quantity};
}
function dropGoods(){
 const order=itemOrder();if(order)return takeAction('drop_item',order);
}
function pickupGoods(){
 const d=closestGroundItem();
 if(!d)return message('Move beside a dropped item.');
 return takeAction('pick_up',{drop_id:d.id});
}
async function chestGoods(destination,source){
 if(!SERVER)return message('Chest storage needs DK Server.');
 if(busy)return;
 const order=itemOrder();
 if(!order)return;
 try{
  const view=await SERVER.items();
  const selected=view.items.find(i=>i.parent===source&&i.type===order.item_type&&
   i.amount>=order.quantity);
  if(!selected)return message('No accessible matching stack. Reduce the quantity or move beside the chest.');
  await takeAction('move_item',{serial:selected.serial,quantity:order.quantity,destination});
 }catch(e){message('Chest access: '+e.message);}
}
function currentHouse(){
 if(!housing||!player)return null;
 return housing.houses.filter(h=>h.area_id===player.area_id&&
  Math.abs(player.x-h.door_x)+Math.abs(player.y-h.door_y)<=2)
  .sort((a,b)=>(Math.abs(player.x-a.door_x)+Math.abs(player.y-a.door_y))-
    (Math.abs(player.x-b.door_x)+Math.abs(player.y-b.door_y)))[0]||null;
}
async function refreshWorkshops(){
 if(!SERVER)return;
 try{
  const report=await SERVER.workshops();
  $('workshopStatus').textContent=report.total_units+
   ' goods produced by workshops · '+
   report.shops.map(shop=>shop.name+': '+shop.made).join(' · ');
 }catch(e){$('workshopStatus').textContent='Workshop production records unavailable.';}
}
async function refreshCaravans(){
 if(!SERVER)return;
 try{
  const report=await SERVER.caravans();
  const trip=report.nearby_caravan;
  $('caravanStatus').textContent=report.purchased+' goods purchased · '+
   report.delivered+' delivered · Merchant earnings '+report.merchant_profit+
   (trip?' · Nearby: '+trip.merchant_name+' '+trip.phase.replaceAll('_',' '):'');
 }catch(e){$('caravanStatus').textContent='Trade caravan records unavailable.';}
}
async function refreshNpcSuccession(){
 if(!SERVER)return;
 try{
  const s=await SERVER.npcSuccession();
  const local=(s.nearby||[]).map(p=>p.title+': '+
    (p.filled?p.holder_name:'VACANT'));
  $('npcSuccessionStatus').textContent=s.hired+' new residents hired'+
    (local.length?' · Nearby posts: '+local.join(', '):'');
 }catch(e){$('npcSuccessionStatus').textContent='Settlement recruitment records unavailable.';}
}
async function refreshNpcHarvest(){
 if(!SERVER)return;
 try{
  const report=await SERVER.npcHarvest();
  const trips=(report.nearby_goals||[]).map(g=>g.npc_id+
   (g.phase==='to_node'?' gathering ':' delivering ')+g.item_type);
  $('npcHarvestStatus').textContent=report.collected+' resources gathered · '+
    report.delivered+' physical shop deliveries'+
    (trips.length?' · Nearby: '+trips.join(', '):'');
 }catch(e){$('npcHarvestStatus').textContent='NPC resource delivery records unavailable.';}
}
async function refreshNpcAI(){
 if(!SERVER)return;
 try{
  const status=await SERVER.npcAI();
  const nearby=status.nearby||[];
  const fleeing=nearby.filter(n=>n.mode==='flee').map(n=>n.name);
  const defending=nearby.filter(n=>n.mode==='defend').map(n=>n.name);
  const recovering=nearby.filter(n=>n.mode==='recover').length;
  $('npcAIStatus').textContent='Nearby residents '+nearby.length+
    ' · Fleeing '+fleeing.length+' · Defending '+defending.length+
    (recovering?' · Recovering '+recovering:'')+
    (fleeing.length?' · '+fleeing.join(', '):'')+
    (defending.length?' · Guard response: '+defending.join(', '):'');
 }catch(e){$('npcAIStatus').textContent='NPC threat response unavailable.';}
}
async function refreshNpcCommerce(){
 if(!SERVER)return;
 try{
  const s=await SERVER.npcCommerce();
  const traveling=(s.active_shoppers||[]).map(g=>
   living?.npcs?.[g.npc_id]?.name||g.npc_id);
  $('customerStatus').textContent=s.recorded_purchases+
   ' physical NPC purchases · '+(traveling.length?
    traveling.join(', ')+' traveling to shop':'No NPCs currently shopping');
 }catch(e){$('customerStatus').textContent='NPC customer records unavailable.';}
}
async function refreshVendors(){
 if(!SERVER)return;
 try{
  const data=await SERVER.vendors();
  const near=(data.nearby||[]).sort((a,b)=>
   Math.abs(a.x-player.x)+Math.abs(a.y-player.y)-
   (Math.abs(b.x-player.x)+Math.abs(b.y-player.y)))[0];
  $('vendorStatus').textContent=near?
   near.name+' · '+(near.open?'Open':'Closed')+
   ' · '+near.quantity+' '+near.product+' available'+
   (Object.keys(near.other_stock||{}).length?
    ' · Other merchandise: '+Object.entries(near.other_stock)
      .filter(([,n])=>n>0).map(([type,n])=>type+' '+n).join(', '):''):
   'No merchandise vendor within six tiles.';
 }catch(e){$('vendorStatus').textContent='Vendor inventory unavailable.';}
}
async function refreshHousing(){
 if(!SERVER)return;
 try{
  housing=await SERVER.housing();
  const here=currentHouse();
  const mine=housing.houses.find(h=>h.owner?.kind==='player');
  $('houseStatus').textContent=here?
    'House '+here.id+' · '+(here.owner?.kind==='player'?'YOUR DEED':
      here.owner?.kind==='npc'?'Resident-owned':here.owner?.kind==='estate'?
      'Property in probate':'VACANT')+
    ' · '+here.price+' gold · '+(here.public?'Public':'Private'):
    mine?'Your home: '+mine.id+' · Visit its doorway to manage goods.':
    'No house beside you. Visit a house doorway to view its deed.';
 }catch(e){$('houseStatus').textContent='Property registry unavailable.';}
}
async function houseAction(action){
 const h=currentHouse();
 if(!h)return message('Stand beside a house doorway first.');
 if(action==='set_house_public')await takeAction(action,{house_id:h.id,public:!h.public});
 else await takeAction(action,{house_id:h.id});
 await refreshHousing();
}
async function houseGoods(direction){
 const h=currentHouse();
 if(!h||h.owner?.kind!=='player')return message('You must own this house and stand beside its door.');
 if(!SERVER||busy)return;
 const order=itemOrder();if(!order)return;
 try{
  const inventory=await SERVER.items();
  const src=direction==='store'?'pack_1':h.storage_id;
  const item=inventory.items.find(i=>i.parent===src&&i.type===order.item_type&&i.amount>=order.quantity);
  if(!item)return message('No matching accessible item stack of that quantity.');
  await takeAction('move_item',{serial:item.serial,quantity:order.quantity,
    destination:direction==='store'?h.storage_id:'pack_1'});
  await refreshHousing();
 }catch(e){message('House storage unavailable: '+e.message);}
}
async function refreshDistrict(){
 if(!SERVER||!player)return;
 try{
  const r=(await SERVER.region()).region;
  $('districtStatus').textContent='District: '+r.name+
   ' · '+(r.guarded?'Guarded':'Unguarded')+
   (r.occupied?' · Occupied by monsters':'')+
   (r.housing?' · Housing allowed':' · Housing restricted');
 }catch(e){$('districtStatus').textContent='District data unavailable.';}
}
async function refreshSchedule(){
 if(!SERVER)return;
 try{
  const s=await SERVER.schedule();
  const next=s.jobs?.slice(0,3).map(job=>job.kind.replaceAll('_',' ')+
   ' at '+job.next_minute).join(' · ');
  $('scheduleStatus').textContent=(s.paused?'SCHEDULE PAUSED':'Scheduled jobs')+
   ' · '+(next||'No pending jobs');
 }catch(e){$('scheduleStatus').textContent='World schedule unavailable.';}
}
async function refreshSector(){
 if(!SERVER||!player)return;
 try{
  const info=await SERVER.nearby(8);
  const chest=info.entities.find(o=>o.kind==='chest');
  $('sectorStatus').textContent='Sector '+info.sector.sx+','+info.sector.sy+
   ' · '+info.entities.length+' nearby entities'+
   (chest?' · Village chest visible':'');
 }catch(e){$('sectorStatus').textContent='Nearby world objects unavailable.';}
}
async function bankGoods(action){
 const order=itemOrder();if(!order||busy)return;
 await takeAction(action,order);
 if($('bankPanel').hidden===false)await openBank();
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
 ctx.save();const editorScale=architectCamera?architectZoom:1;
 const viewSpan=VIEW/editorScale;ctx.scale(editorScale,editorScale);
 ctx.translate(-Math.round(camera.x*TILE),-Math.round(camera.y*TILE));
 const left=Math.floor(camera.x),top=Math.floor(camera.y);
 const right=Math.min(area.width,Math.ceil(camera.x+viewSpan));
 const bottom=Math.min(area.height,Math.ceil(camera.y+viewSpan));
 for(let y=top;y<bottom;y++)
  for(let x=left;x<right;x++)floor(x,y);
 for(let y=top;y<bottom;y++)
  for(let x=left;x<right;x++)
   if(area.walls[y*area.width+x])drawWall(x,y);
 // Reuse lightweight object shells. Their source objects remain the
 // same authoritative area records, including live door and gate state.
 const visibleObjects=cellShells?
  cellShells.visible(area,camera,viewSpan):area.objects;
 for(const o of visibleObjects)drawObject(o);
 drawResources();
 drawTerrainMarks();
 drawBurials();
 drawCorpses();
 drawScavengers();
 drawNpcs();
 drawMonsters();
 drawGroundItems();
 drawChest();
 drawHouseSigns();
 const spriteGroup=player.form==='ghost'?'ghost':'human';
 const pImg=ready('characters/'+spriteGroup+'/'+spriteGroup+'_'+player.facing+'.png');
 const drawX=Math.round(visual.x*TILE),drawY=Math.round(visual.y*TILE);
 if(pImg)ctx.drawImage(pImg,drawX,drawY,TILE,TILE);
 else{
  px('#342b30',drawX+9,drawY+20,14,10);
  px(player.form==='ghost'?'#bbc6ed':'#b4826b',drawX+9,drawY+8,14,14);
 }
 ctx.restore();
 $('characterStatus').textContent=player.form.toUpperCase()+' · ('+player.x+', '+player.y+
  ') · '+player.facing.toUpperCase();
}
function actorAt(x,y){
 const body=Object.values(living?.mobile_assets?.corpses||{}).find(c=>
  c.area_id===area.area_id&&c.x===x&&c.y===y);
 if(body)return {body};
 const grave=Object.values(living?.burials||{}).find(g=>
  g.area_id===area.area_id&&g.x===x&&g.y===y);
 if(grave)return {grave};
 const scavenger=Object.values(living?.scavengers||{}).find(v=>
  v.area_id===area.area_id&&v.x===x&&v.y===y);
 if(scavenger)return {scavenger};
 const ground=Object.values(living?.storage?.ground||{}).find(d=>
  d.area_id===area.area_id&&d.x===x&&d.y===y);
 if(ground)return {ground};
 const creature=Object.values(living?.combat?.creatures||{}).find(n=>n.alive&&
  n.area_id===area.area_id&&n.x===x&&n.y===y);
 if(creature)return {creature};
 const loot=Object.values(living?.combat?.drops||{}).find(d=>
  d.area_id===area.area_id&&d.x===x&&d.y===y);
 if(loot)return {loot};
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
 const x=Math.floor(camera.x+(e.clientX-r.left)/r.width*VIEW);
 const y=Math.floor(camera.y+(e.clientY-r.top)/r.height*VIEW);
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
async function refreshLaw(){
 if(!SERVER||!player)return;
 try{
  law=await SERVER.law();
  const p=law.player;
  const inGuarded=law.area_guarded?'GUARDED VILLAGE':'OUTSIDE GUARDED VILLAGE';
  $('lawStatus').textContent=inGuarded+' · Fine '+p.fines+' gold · Heat '+p.heat+
   ' · Citations '+p.citations+(p.detained_until_minute>=law.minute?
    ' · Held until minute '+p.detained_until_minute:'');
  $('payFine').disabled=!p.fines;
 }catch(e){$('lawStatus').textContent='Law records unavailable.';}
}
function payFine(){
 if(!law?.player?.fines)return message('You have no unpaid village fine.');
 const amount=Math.min(12,law.player.fines,player?.gold||0);
 if(amount<1)return message('You need gold and must visit the open Village Bank.');
 return takeAction('pay_fine',{amount});
}
async function refreshSkills(){
 if(!SERVER)return;
 try{
  const s=await SERVER.skills();
  const choice=$('skillName').value;
  const record=s.skills?.[choice];
  const text=Object.entries(s.skills||{}).map(([name,entry])=>
   name+': '+(entry.value/10).toFixed(1)+(entry.lock==='up'?' ↑':
   entry.lock==='down'?' ↓':' ■')).join(' · ');
  $('skillStatus').textContent='Total '+(s.total/10).toFixed(1)+'/700.0 · '+text;
  if(record)$('skillLock').value=record.lock;
 }catch(e){$('skillStatus').textContent='Skillbook unavailable: '+e.message;}
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
  await Promise.all([refreshGameplay(),refreshLiving(),refreshSkills(),refreshLaw(),refreshVendors()]);
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
  const groundCount=Object.values(living.storage?.ground||{}).filter(d=>d.area_id===area.area_id).length;
  const activeImps=Object.values(living.combat?.creatures||{}).filter(n=>
    n.alive&&n.area_id===area.area_id);
  $('combatStatus').textContent=activeImps.length+' active imps · '+
    Object.values(living.combat?.drops||{}).filter(d=>d.area_id===area.area_id).length+
    ' monster loot piles · '+groundCount+' dropped item piles · '+
     Object.values(living.mobile_assets?.corpses||{}).filter(c=>c.area_id===area.area_id).length+
     ' fallen residents · Combat skill '+(player.skills?.combat||0);
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
 if(SERVER){location.href='./test-center.html?dkSlot='+slot+'&walk=continuous1';return;}
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
 location.href='./test-center.html?from=courtyard&walk=continuous1';
}
async function step(direction){
 if(busy||lilithPhase==='playing')return;
 const stamp=Date.now();
 if(stamp-lastMove<165)return;
 lastMove=stamp;
 const delta={north:[0,-1],east:[1,0],south:[0,1],west:[-1,0]}[direction];
 if(!delta)return;
 const x=player.x+delta[0],y=player.y+delta[1];
 if(SERVER){
  busy=true;
  try {
   const next=await SERVER.action(slot,'move',{direction});
   if(next.area_id===R.TEMPLE){returnTemple();return;}
   const oldDistrict=player.region_id;
   player=next;
   if(oldDistrict!==player.region_id)refreshDistrict();
   if(area.objects.some(o=>o.type==='house'&&o.door&&Math.abs(o.door.x-player.x)+Math.abs(o.door.y-player.y)<=6))refreshHousing();
   if(area.area_id!==player.area_id)await loadArea(player.area_id);
   else{visual.queue.push({x:player.x,y:player.y});prefetchTerrain();}
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
   visual.queue.push({x,y});
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
 if(item.grave)return message(item.grave.name+
  ' rests beneath a '+item.grave.stage+' grave. The stone remains in the world.');
 if(item.scavenger)return message('A '+item.scavenger.kind+
  ' has come to feed among the remains.');
 if(item.body){
  const body=item.body,stage=(body.stage||'fresh').replaceAll('_',' ');
  const kind=body.kind==='monster'?'demon':'person';
  const accessible=!body.looted&&body.stage!=='scattered'&&
   (body.bag_id!==null||body.coins>0);
  if(doubleClick&&SERVER&&accessible)
   return takeAction('loot_corpse',{corpse_id:body.id});
  return message((kind==='demon'?'Demon remains: ':body.name+': ')+
   stage+' remains anchored here. '+(accessible?
    'Double-click to recover belongings. B buries the body if you have tools.':
    'Nothing remains to loot. B can bury a human body.'));
 }
 if(item.ground){
  if(doubleClick&&SERVER)return takeAction('pick_up',{drop_id:item.ground.id});
  return message('Dropped '+item.ground.quantity+' '+item.ground.item+
   '. Double-click beside it to collect.');
 }
 if(item.creature){
  if(doubleClick&&SERVER)return takeAction('attack',{target_id:item.creature.id});
  return message('Imp · '+item.creature.health+' health. Double-click beside it to attack.');
 }
 if(item.loot){
  if(doubleClick&&SERVER)return takeAction('loot',{drop_id:item.loot.id});
  return message('Loot · '+item.loot.gold+' gold and '+item.loot.item+'. Double-click beside it to collect.');
 }
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
  $('storedItems').textContent=Object.entries(box.items||{})
   .filter(([,count])=>count>0).map(([name,count])=>name+': '+count)
   .join(' · ')||'Your bank vault is empty.';
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
function pointerPosition(e){
 const r=canvas.getBoundingClientRect();
 if(!r.width||!r.height)return null;
 return {x:(e.clientX-r.left)/r.width*VIEW,y:(e.clientY-r.top)/r.height*VIEW};
}
function pointerMove(dt){
 if(!rightHeld||!pointer||busy||!player||!area||dt<=0)return;
 // The cursor is screen-relative as the camera follows the character.
 const dx=camera.x+pointer.x-(visual.x+.5);
 const dy=camera.y+pointer.y-(visual.y+.5);
 const distance=Math.hypot(dx,dy);
 if(distance<.08)return;
 const direction=Math.abs(dx)>=Math.abs(dy)?
  dx>0?'east':'west':dy>0?'south':'north';
 if(SERVER){
  // The saved world validates discrete steps. Those are rendered smoothly.
  step(direction);
  return;
 }
 // In the browser preview, RMB walking is genuinely continuous. The
 // authoritative tile address changes only when the visual centre crosses
 // into the next grid cell. No diagonal movement, snaps, or step timer.
 if(visual.queue.length)return;
 const speed=distance>4?5.6:3.1;
 let ax=0,ay=0;
 if(Math.abs(dx)>=Math.abs(dy))ax=Math.sign(dx)*Math.min(Math.abs(dx),speed*dt);
 else ay=Math.sign(dy)*Math.min(Math.abs(dy),speed*dt);
 const nx=visual.x+ax,ny=visual.y+ay;
 const tx=Math.round(nx),ty=Math.round(ny);
 if(tx!==player.x||ty!==player.y){
  const link=R.portal(previewWorld(),area.area_id,tx,ty);
  if(link?.blocked){message('The temple door is closed. Double-click to open it.');return;}
  if(link){
   rightHeld=false;
   player={...player,...link};
   if(player.area_id===R.TEMPLE){returnTemple();return;}
   loadArea(player.area_id);
   persistPreview();
   return;
  }
  if(!R.traversable(area,tx,ty,player.form))return;
  player.x=tx;player.y=ty;
  persistPreview();
 }
 visual.x=nx;visual.y=ny;
 player.facing=direction;
}
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('mousedown',e=>{if(e.button===2){e.preventDefault();pointer=pointerPosition(e);rightHeld=true;canvas.focus();}});
canvas.addEventListener('mousemove',e=>{if(rightHeld)pointer=pointerPosition(e);});
document.addEventListener('mouseup',e=>{if(e.button===2)rightHeld=false;});
window.addEventListener('blur',()=>{rightHeld=false;});
canvas.addEventListener('click',e=>{if(e.button!==0)return;const p=targetTile(e);if(p)inspect(p.x,p.y,false);canvas.focus();});
canvas.addEventListener('dblclick',e=>{if(e.button!==0)return;const p=targetTile(e);if(p)inspect(p.x,p.y,true);});
document.addEventListener('keydown',e=>{
 const tag=e.target?.tagName;
 if(e.ctrlKey||e.altKey||e.metaKey)return;
 if(tag==='INPUT'||tag==='TEXTAREA'||tag==='BUTTON'||tag==='SELECT'||e.target?.isContentEditable)return;
 if(e.key==='F8'&&!e.repeat){
  e.preventDefault();rightHeld=false;
  if(!SERVER)return message('World editing needs the local DK Server.');
  if(lilithPhase==='playing')return message('Wait for Lilith to finish her transformation.');
  location.href='./dk-architect-outdoors-m36.html?dkSlot='+slot+'&area_id='+encodeURIComponent(area.area_id);
  return;
 }
 if(e.key.toLowerCase()==='b'&&!e.repeat){e.preventDefault();buryCorpse();return;}
 const dir={ArrowUp:'north',w:'north',ArrowDown:'south',s:'south',
  ArrowLeft:'west',a:'west',ArrowRight:'east',d:'east'}[e.key.length===1?e.key.toLowerCase():e.key];
 if(dir){e.preventDefault();step(dir);}
});
$('showBank').addEventListener('click',openBank);
$('skillName').addEventListener('change',refreshSkills);
$('payFine').addEventListener('click',payFine);
$('buyHouse').addEventListener('click',()=>houseAction('buy_house'));
$('sellHouse').addEventListener('click',()=>houseAction('sell_house'));
$('houseAccess').addEventListener('click',()=>houseAction('set_house_public'));
$('homeStore').addEventListener('click',()=>houseGoods('store'));
$('homeTake').addEventListener('click',()=>houseGoods('take'));
$('skillApply').addEventListener('click',()=>
 takeAction('skill_lock',{skill:$('skillName').value,lock:$('skillLock').value}));
$('closeBank').addEventListener('click',()=>{$('bankPanel').hidden=true;});
$('gatherButton').addEventListener('click',gather);
$('dropItem').addEventListener('click',dropGoods);
$('pickItem').addEventListener('click',pickupGoods);
$('chestStore').addEventListener('click',()=>chestGoods('chest_village_1','pack_1'));
$('chestTake').addEventListener('click',()=>chestGoods('pack_1','chest_village_1'));
$('storeItem').addEventListener('click',()=>bankGoods('bank_store'));
$('takeItem').addEventListener('click',()=>bankGoods('bank_take'));
$('attackButton').addEventListener('click',attack);
$('lootButton').addEventListener('click',loot);
$('lootCorpse').addEventListener('click',lootCorpse);
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
function advanceVisual(dt){
 if(!visual.queue.length)return;
 const target=visual.queue[0];
 const dx=target.x-visual.x,dy=target.y-visual.y;
 const distance=Math.hypot(dx,dy);
 const travel=Math.min(distance,6.2*dt);
 if(distance<=.001||travel>=distance){
  visual.x=target.x;visual.y=target.y;visual.queue.shift();
 }else{
  visual.x+=dx/distance*travel;
  visual.y+=dy/distance*travel;
 }
}
function frame(now){
 if(now-lastDraw>=16){
  const dt=lastDraw?Math.min((now-lastDraw)/1000,.06):0;
  pointerMove(dt);
  advanceVisual(dt);
  if(area)draw();
  lastDraw=now;
 }
 requestAnimationFrame(frame);
}
async function begin(){
 try{
  if(SERVER){
   await SERVER.startWorld();
   player=await SERVER.getCharacter(slot);
   if(player.area_id===R.TEMPLE){location.href='./test-center.html?dkSlot='+slot+'&walk=continuous1';return;}
   doorOpen=true;await loadArea(player.area_id);
   const last=Number(sessionStorage.getItem('dk.lilith.entry.'+slot)||0);
   if(player.area_id===R.COURT&&player.courtyard_visit_count===1&&last!==1){
    firstVisit=true;sessionStorage.setItem('dk.lilith.entry.'+slot,'1');
   }
   await Promise.all([refreshLiving(),refreshGameplay(),refreshSocial(),refreshSector(),refreshSchedule(),refreshSkills(),refreshLaw(),refreshDistrict(),refreshHousing(),refreshVendors(),refreshNpcCommerce(),refreshWorkshops(),refreshNpcAI(),refreshNpcHarvest(),refreshNpcSuccession(),refreshCaravans()]);
   await refreshSectorInterest();
   setInterval(refreshSectorInterest,1750);
   setInterval(refreshCellView,4500);
   setInterval(refreshCellContents,1900);
   setInterval(refreshLiving,10000);setInterval(refreshGameplay,10000);
   setInterval(refreshSocial,15000);setInterval(refreshSector,15000);setInterval(refreshSchedule,15000);setInterval(refreshSkills,15000);setInterval(refreshLaw,15000);setInterval(refreshDistrict,15000);setInterval(refreshHousing,15000);setInterval(refreshVendors,15000);setInterval(refreshNpcCommerce,15000);setInterval(refreshWorkshops,15000);setInterval(refreshNpcAI,10000);setInterval(refreshNpcHarvest,15000);setInterval(refreshNpcSuccession,15000);setInterval(refreshCaravans,15000);
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
   $('skillStatus').textContent='Training and skill progression require DK Server.';
   $('skillApply').disabled=true;
   $('lawStatus').textContent='Village law requires DK Server.';
   $('payFine').disabled=true;
   $('needsStatus').textContent='Crafting and survival need DK Server.';
   $('combatStatus').textContent='Monster combat, NPC remains and loot require DK Server.';
   $('sectorStatus').textContent='The sector index requires DK Server.';
    $('scheduleStatus').textContent='World timers require DK Server.';
    $('districtStatus').textContent='District policy requires DK Server.';
   $('houseStatus').textContent='House deeds and secure storage require DK Server.';
   $('vendorStatus').textContent='Physical merchant stock requires DK Server.';
   $('customerStatus').textContent='NPC shopping history requires DK Server.';
   $('workshopStatus').textContent='Workshop production needs DK Server.';
    $('npcAIStatus').textContent='NPC threat response requires DK Server.';
    $('npcHarvestStatus').textContent='NPC resource gathering requires DK Server.';
    $('npcSuccessionStatus').textContent='Settlement recruitment requires DK Server.';
    $('caravanStatus').textContent='Physical trade caravans require DK Server.';
   for(const id of ['gatherButton','buyButton','sellButton','depositButton','withdrawButton','talkButton','contractButton','deliverButton','craftTorch','craftRations','craftBandages','eatFood','equipTools','equipTorch','restButton','attackButton','lootButton','lootCorpse','dropItem','pickItem','storeItem','takeItem','chestStore','chestTake','buyHouse','sellHouse','houseAccess','homeStore','homeTake'])
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
// Read-only access for the classic UI; server-owned gameplay stays authoritative.
window.DKOutdoorState=()=>({player,gameplay,serverConnected:!!SERVER});
window.DKOutdoorArchitectBridge=Object.freeze({
 snapshot:()=>area?{area_id:area.area_id,camera:{...camera},
  span:VIEW/(architectCamera?architectZoom:1),zoom:architectZoom,
  form:player?.form||'ghost',cutscene:lilithPhase==='playing'}:null,
 begin:()=>{
  if(!area||!player||lilithPhase==='playing')return false;
  rightHeld=false;architectZoom=1;viewCamera();
  architectCamera={x:camera.x,y:camera.y};draw();return true;
 },
 end:()=>{architectCamera=null;architectZoom=1;rightHeld=false;if(area)draw();},
 pan:(x,y)=>{
  if(!architectCamera||!area)return;
  architectCamera.x+=x;architectCamera.y+=y;draw();
 },
 zoom:(amount,ax=.5,ay=.5)=>{
  if(!architectCamera||!area)return;
  const was=VIEW/architectZoom;
  architectZoom=Math.max(.35,Math.min(2,architectZoom*amount));
  const now=VIEW/architectZoom;
  architectCamera.x+=(was-now)*ax;
  architectCamera.y+=(was-now)*ay;draw();
 },
 refresh:async()=>{
  if(area){await loadArea(area.area_id);draw();}
 },
 draw:()=>{if(area)draw();}
});

window.addEventListener('dk-inventory-updated',()=>{if(SERVER)refreshGameplay();});
begin();
})();
