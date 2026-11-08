/* M36: top-down Prison Architect-style world construction tools.
 * All world mutations go through DK Server; no browser-side save fork.
 */
(()=>{
'use strict';
const api=window.DemonKillerServer,localDraft=Boolean(window.DKArchitectPreviewActive),$=id=>document.getElementById(id);
const map=$('map'),ctx=map.getContext('2d');
const COURT='dk.courtyard.lilith.001',VILLAGE='dk.village.001';
const PALETTE={grass:'#566744',path:'#897c71',stone:'#8a8787',garden:'#425e37',
 dirt:'#66533f',roof:'#534249',dark:'#272630'};
const BUILDINGS=new Set(['house','bank','bakery','smithy','tavern']);
const FIXTURES=new Set(['well','stall']);
const MODES=['select','move','door','erase','ground','inspect'];
let area=null,revision=0,mode='select',selected=null,busy=false;
let zoom=15,offset={x:140,y:60},hover=null,drag=null,grid=true;
const undo=[],redo=[];
function status(message,error=false){$('status').textContent=message;
 $('status').style.color=error?'#faa9a2':'#e6d7b7';}
function zoomAt(pixelX,pixelY,next){
 const wx=(pixelX-offset.x)/zoom,wy=(pixelY-offset.y)/zoom;
 zoom=Math.max(8,Math.min(30,next));
 offset.x=pixelX-wx*zoom;offset.y=pixelY-wy*zoom;
 $('zoom').value=zoom;draw();
}
function tileOf(e){
 const r=map.getBoundingClientRect(),px=(e.clientX-r.left)*map.width/r.width,
 py=(e.clientY-r.top)*map.height/r.height;
 return {pixel:{x:px,y:py},x:Math.floor((px-offset.x)/zoom),
  y:Math.floor((py-offset.y)/zoom)};
}
function valid(t){return area&&t&&t.x>=0&&t.y>=0&&t.x<area.width&&t.y<area.height;}
function rect(o){return {x:o.x,y:o.y,w:o.w||1,h:o.h||1};}
function inside(r,t){return t.x>=r.x&&t.y>=r.y&&t.x<r.x+r.w&&t.y<r.y+r.h;}
function objectAt(t){return area?.objects?.slice().reverse().find(o=>inside(rect(o),t))||null;}
function pick(t){const o=objectAt(t);return o&&BUILDINGS.has(o.type)||o&&FIXTURES.has(o.type)?o:null;}
function selectedObject(){return area?.objects?.find(o=>o.id===selected)||null;}
function choose(object){
 selected=object?.id||null;
 $('selection').textContent=selected?selected.toUpperCase():'NO SELECTION';
 $('inspector').textContent=object?
  object.type.toUpperCase()+' · '+object.id+'\n'+
  'FOOTPRINT: '+(object.w||1)+' × '+(object.h||1)+'\n'+
  'POSITION: '+object.x+', '+object.y+'\n'+
  (object.door?'DOOR: '+object.door.x+', '+object.door.y:'NO DOOR')+
  (localDraft?'\nBrowser draft; export JSON.':'\nSaved to DK Server.'):'Choose a building or fixture. The temple, paths, and willow are protected.';
 draw();
}
function modeSet(next){
 if(!MODES.includes(next))return;
 mode=next;document.querySelectorAll('[data-tool]').forEach(b=>
  b.classList.toggle('active',b.dataset.tool===mode));
 $('modeText').textContent=next==='move'?'MOVE WHOLE BUILDING':
  next==='door'?'PLACE OR RELOCATE DOOR':
  next==='erase'?'ERASE EXTERIOR DOOR':
  next==='ground'?'GROUND RECTANGLE BRUSH':next.toUpperCase();
 status(next==='move'?'Drag a whole house or shop to its new location.':
  next==='door'?'Click a perimeter wall to install a door (replaces the old one).':
  next==='erase'?'Click a building to erase its current door.':
  next==='ground'?'Drag over open terrain to paint ground, without touching buildings.':
  next==='inspect'?'Click any building or fixture to inspect it.':
  'Select a building; use MOVE, DOORS, ERASE, MATERIALS, or EXPORT JSON.');
}
function controls(){
 $('revision').textContent=(localDraft?'BROWSER DRAFT: ':'SERVER REVISION: ')+revision;
 $('undo').disabled=!undo.length||busy;$('redo').disabled=!redo.length||busy;
}
function floorColor(f){return PALETTE[f]||'#39363c';}
function renderBuilding(o,x,y,w,h){
 ctx.fillStyle='#1b1720';ctx.fillRect(x-2,y-2,w+4,h+4);
 ctx.fillStyle='#a19a9a';ctx.fillRect(x,y,w,h);
 ctx.fillStyle='#45353a';ctx.fillRect(x+zoom/2,y+zoom/2,w-zoom,h-zoom);
 for(let yy=y+zoom;yy<y+h-zoom;yy+=zoom){
  ctx.fillStyle='#5e4845';ctx.fillRect(x+zoom,yy,w-2*zoom,2);
 }
 ctx.fillStyle='#9b8581';ctx.fillRect(x,y,w,Math.max(3,zoom/3));
 ctx.strokeStyle='#201920';ctx.lineWidth=Math.max(1,zoom/10);ctx.strokeRect(x,y,w,h);
 if(o.door){
  const px=offset.x+o.door.x*zoom,py=offset.y+o.door.y*zoom;
  ctx.fillStyle='#1b1722';ctx.fillRect(px+2,py+2,zoom-4,zoom-4);
  ctx.fillStyle='#aa7961';ctx.fillRect(px+zoom*.36,py+zoom*.2,zoom*.26,zoom*.58);
 }
}
function renderFixture(o){
 const x=offset.x+o.x*zoom,y=offset.y+o.y*zoom;
 ctx.fillStyle=o.type==='well'?'#b3aca8':'#af854f';
 ctx.fillRect(x+zoom*.1,y+zoom*.15,zoom*.8,zoom*.7);
 ctx.fillStyle=o.type==='well'?'#282630':'#5a382c';
 ctx.fillRect(x+zoom*.25,y+zoom*.3,zoom*.5,zoom*.32);
}
function draw(){
 if(!ctx)return;ctx.imageSmoothingEnabled=false;
 ctx.fillStyle='#15171b';ctx.fillRect(0,0,map.width,map.height);
 if(!area)return;
 const x0=Math.max(0,Math.floor(-offset.x/zoom)),y0=Math.max(0,Math.floor(-offset.y/zoom)),
  x1=Math.min(area.width,Math.ceil((map.width-offset.x)/zoom)),
  y1=Math.min(area.height,Math.ceil((map.height-offset.y)/zoom));
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
  const sx=Math.round(offset.x+x*zoom),sy=Math.round(offset.y+y*zoom);
  const v=area.floor[y*area.width+x];
  ctx.fillStyle=floorColor(v);ctx.fillRect(sx,sy,zoom+1,zoom+1);
  if(v==='path'||v==='stone'){
   ctx.fillStyle='#b1a49b';ctx.fillRect(sx+1,sy+1,zoom*.55,1);
  }
  if(v==='garden'){
   ctx.fillStyle='#748955';ctx.fillRect(sx+zoom*.25,sy+zoom*.25,2,2);
  }
  if(area.walls[y*area.width+x]&&v!=='roof'){
   ctx.fillStyle='#817b7e';ctx.fillRect(sx,sy,zoom,zoom);
   ctx.fillStyle='#302e35';ctx.fillRect(sx+zoom*.18,sy+zoom*.4,zoom*.63,zoom*.35);
  }
  if(grid&&zoom>=12){
   ctx.strokeStyle='rgba(10,14,15,.20)';ctx.lineWidth=.5;ctx.strokeRect(sx+.5,sy+.5,zoom,zoom);
  }
 }
 for(const o of area.objects){
  if(BUILDINGS.has(o.type)||o.type==='temple_exterior'){
   const sx=offset.x+o.x*zoom,sy=offset.y+o.y*zoom;
   renderBuilding(o,sx,sy,o.w*zoom,o.h*zoom);
  }else if(FIXTURES.has(o.type))renderFixture(o);
  else if(o.type==='willow'){
   // Reserved story destination, not a pre-planted tree.
   ctx.strokeStyle='#c09e51';ctx.lineWidth=2;
   const cx=offset.x+(o.x+1.5)*zoom,cy=offset.y+(o.y+1.5)*zoom;
   ctx.strokeRect(cx-zoom/2,cy-zoom/2,zoom,zoom);
   ctx.fillStyle='#d5b16c';ctx.font=Math.max(9,zoom)+'px monospace';ctx.fillText('L',cx-zoom*.3,cy+zoom*.25);
  }
 }
 const target=selectedObject();
 if(target){
  const rect=target.id===drag?.id&&drag.preview?
   {...target,x:drag.preview.x,y:drag.preview.y}:target;
  ctx.strokeStyle='#f0d082';ctx.lineWidth=3;
  ctx.strokeRect(offset.x+rect.x*zoom+1,offset.y+rect.y*zoom+1,
   (rect.w||1)*zoom-2,(rect.h||1)*zoom-2);
 }
 if(drag?.type==='ground'&&hover){
  const x=Math.min(drag.start.x,hover.x),y=Math.min(drag.start.y,hover.y);
  const w=Math.abs(drag.start.x-hover.x)+1,h=Math.abs(drag.start.y-hover.y)+1;
  ctx.strokeStyle='#d2cba2';ctx.lineWidth=2;
  ctx.strokeRect(offset.x+x*zoom,offset.y+y*zoom,w*zoom,h*zoom);
 }
}
async function reload(keepSelection=true){
 const requested=$('region').value;
 if(!api)throw Error('DK Server is required; GitHub Pages cannot write layouts.');
 const data=await api.area(requested);
 area=data.area;revision=data.revision;
 if(!keepSelection)selected=null;
 choose(selectedObject());controls();draw();
}
async function submit(action,fields,track=true){
 if(busy)return false;busy=true;controls();
 const area_id=$('region').value,prev=selectedObject();
 let inverse=null,forward={action,...fields};
 if(track&&prev){
  if(action==='move_building'||action==='move_fixture')
   inverse={action,object_id:prev.id,x:prev.x,y:prev.y};
  else if(action==='set_door'||action==='remove_door')
   inverse=prev.door?{action:'set_door',object_id:prev.id,...prev.door}:
    {action:'remove_door',object_id:prev.id};
 }
 try{
  const result=await api.editOutdoor(action,area_id,revision,fields);
  revision=result.revision;
  if(track&&inverse){
   undo.push({undo:inverse,redo:forward});if(undo.length>40)undo.shift();redo.length=0;
  }
  const response=await api.area(area_id);
  area=response.area;revision=response.revision;
  choose(selectedObject());controls();
  status((localDraft?'BROWSER DRAFT · EXPORT JSON TO SHARE':'SAVED TO DK SERVER')+' · '+action.replaceAll('_',' ')+' · revision '+revision);
  return true;
 }catch(error){
  if(/Stale exterior revision/.test(error.message)){
   undo.length=0;redo.length=0;
   try{await reload();}catch(_){}
  }
  status('Edit rejected: '+error.message,true);return false;
 }finally{busy=false;controls();draw();}
}
async function history(direction){
 const from=direction==='undo'?undo:redo,to=direction==='undo'?redo:undo;
 if(busy||!from.length)return;
 const record=from.pop();
 const command=record[direction];if(!command)return;
 const {action,...fields}=command;
 const ok=await submit(action,fields,false);
 if(ok)to.push(record);else from.push(record);
 controls();
}
function begin(e){
 if(e.button===2){e.preventDefault();const p=tileOf(e);drag={type:'pan',pixel:p.pixel,
  startOffset:{...offset}};map.setPointerCapture?.(e.pointerId);return;}
 if(e.button!==0)return;
 const t=tileOf(e);hover=t;if(!valid(t))return;
 if(mode==='move'){
  const o=pick(t);if(!o)return status('Choose a movable building or fixture.',true);
  choose(o);drag={type:'move',id:o.id,start:t,preview:{x:o.x,y:o.y},
   original:{x:o.x,y:o.y}};map.setPointerCapture?.(e.pointerId);return;
 }
 if(mode==='ground'){
  drag={type:'ground',start:t};map.setPointerCapture?.(e.pointerId);return;
 }
 const o=pick(t);
 if(mode==='select'||mode==='inspect'){choose(o);return;}
 if(mode==='door'){
  if(!o||!BUILDINGS.has(o.type))return status('Click a building perimeter tile.',true);
  choose(o);
  if(t.x!==o.x&&t.x!==o.x+o.w-1&&t.y!==o.y&&t.y!==o.y+o.h-1)
   return status('Door must be on the building outer wall.',true);
  submit('set_door',{object_id:o.id,x:t.x,y:t.y});return;
 }
 if(mode==='erase'){
  if(!o||!BUILDINGS.has(o.type))return status('Choose a building door to erase.',true);
  choose(o);submit('remove_door',{object_id:o.id});return;
 }
}
function pointerMove(e){
 const t=tileOf(e);hover=t;
 if(drag?.type==='pan'){
  offset.x=drag.startOffset.x+t.pixel.x-drag.pixel.x;
  offset.y=drag.startOffset.y+t.pixel.y-drag.pixel.y;
 }
 if(drag?.type==='move'&&valid(t)){
  drag.preview={x:drag.original.x+t.x-drag.start.x,
   y:drag.original.y+t.y-drag.start.y};
 }
 draw();
}
function pointerEnd(e){
 if(!drag)return;const d=drag;drag=null;
 if(e.pointerId!==undefined)try{map.releasePointerCapture(e.pointerId);}catch(_){}
 const t=tileOf(e);hover=t;
 if(d.type==='move'&&d.preview&&(d.preview.x!==d.original.x||d.preview.y!==d.original.y)){
  const o=selectedObject(),action=o&&FIXTURES.has(o.type)?'move_fixture':'move_building';
  submit(action,{object_id:d.id,x:d.preview.x,y:d.preview.y});return;
 }
 if(d.type==='ground'&&valid(t)){
  const x=Math.min(d.start.x,t.x),y=Math.min(d.start.y,t.y),
   w=Math.abs(d.start.x-t.x)+1,h=Math.abs(d.start.y-t.y)+1;
  if(w*h>256){status('Ground selection is limited to 256 tiles per stroke.',true);draw();return;}
  submit(w*h===1?'paint_ground':'paint_rectangle',w*h===1?
   {x,y,floor:$('ground').value}:{x,y,w,h,floor:$('ground').value});return;
 }
 draw();
}
function saveJSON(){
 if(!area||!api)return;
 api.exportOutdoor($('region').value).then(result=>{
  const blob=new Blob([JSON.stringify(result,null,2)+'\n'],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='demon-killer-'+(area.area_id===COURT?'courtyard':'village')+'-m36.json';
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  status('Exported MAP JSON. Send this file for integration into GitHub. No character save included.');
 }).catch(error=>status('Export failed: '+error.message,true));
}
map.addEventListener('pointerdown',begin);
map.addEventListener('pointermove',pointerMove);
map.addEventListener('pointerup',pointerEnd);
map.addEventListener('pointercancel',()=>{drag=null;draw();});
map.addEventListener('contextmenu',e=>e.preventDefault());
map.addEventListener('wheel',e=>{
 e.preventDefault();const p=tileOf(e).pixel;zoomAt(p.x,p.y,zoom+(e.deltaY<0?1:-1));
},{passive:false});
document.querySelectorAll('[data-tool]').forEach(btn=>
 btn.addEventListener('click',()=>modeSet(btn.dataset.tool)));
$('region').addEventListener('change',()=>{undo.length=0;redo.length=0;
 reload(false).then(()=>status('Exterior region loaded.')).catch(e=>status(e.message,true));});
$('zoom').addEventListener('input',()=>zoomAt(map.width/2,map.height/2,Number($('zoom').value)));
$('showGrid').addEventListener('change',e=>{grid=e.target.checked;draw();});
$('undo').addEventListener('click',()=>history('undo'));
$('redo').addEventListener('click',()=>history('redo'));
$('export').addEventListener('click',saveJSON);
function exitArchitect(){
 if(window.parent!==window){window.parent.postMessage({dkArchitect:'close'},location.origin);return;}
 location.href=$('returnGame').href;
}
$('returnGame').addEventListener('click',e=>{
 if(window.parent!==window){e.preventDefault();exitArchitect();}
});
const GROUPS={
 foundations:['select','move','door','erase'],
 materials:['ground','select'],
 rooms:['door','erase','move','select'],
 objects:['select','move','door','erase','inspect'],
 staff:['inspect','select'],
 utilities:['ground','inspect'],
 deployment:['select','inspect'],
 logistics:['inspect','select'],
 intelligence:['inspect','select'],
 emergencies:['inspect','select'],
 planning:['inspect','select','move','ground']
};
function groupSet(name){
 if(!Object.hasOwn(GROUPS,name))return;
 document.querySelectorAll('[data-group]').forEach(b=>
  b.classList.toggle('active',b.dataset.group===name));
 document.querySelectorAll('[data-tool]').forEach(b=>{
  b.hidden=!GROUPS[name].includes(b.dataset.tool);
 });
 if(!GROUPS[name].includes(mode))modeSet(GROUPS[name][0]);
 status(name.toUpperCase()+' TOOLS · use the choices above and click or drag on the map.');
}
document.querySelectorAll('[data-group]').forEach(b=>
 b.addEventListener('click',()=>groupSet(b.dataset.group)));
groupSet('foundations');
document.addEventListener('keydown',e=>{
 if(e.key==='F8'&&!e.repeat){e.preventDefault();exitArchitect();return;}
 if(e.target?.matches?.('input,select,textarea')||e.ctrlKey||e.altKey||e.metaKey)return;
 if(e.key==='Escape'){drag=null;choose(null);return;}
 if(e.key==='z'||e.key==='Z'){history('undo');return;}
 if(e.key==='y'||e.key==='Y'){history('redo');return;}
 if(/^[1-6]$/.test(e.key))modeSet(MODES[Number(e.key)-1]);
});
const params=new URLSearchParams(location.search);
const wanted=params.get('area_id');
if(wanted===COURT||wanted===VILLAGE)$('region').value=wanted;
const slot=params.get('dkSlot');
if(slot==='1')$('returnGame').href='./outdoor.html?dkSlot=1&walk=continuous1';
if(!api)status('No DK Server or browser draft is available.',true);
else reload(false).then(()=>status(localDraft?'BROWSER DRAFT READY · EDIT & EXPORT JSON · NOT SERVER SAVED':'ARCHITECT READY · EDIT BUILDINGS & DOORS ON THE MAP'))
 .catch(error=>status('Cannot open DK Architect: '+error.message,true));
})();