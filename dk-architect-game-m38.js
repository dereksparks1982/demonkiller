/* M38: DK Architect edits the ACTUAL outdoor game viewport, not an iframe.
 * Same PA-style category fly-outs as the temple, browser-export or DK Server.
 */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const game=$('world'),button=$('editMode');
const bridge=window.DKOutdoorArchitectBridge,Menus=window.DKArchitectMenus;
const Geo=window.DKExteriorGeometry,R=window.DemonKillerRegions;
if(!game||!button||!bridge||!Menus||!Geo)return;
const canvas=document.createElement('canvas');canvas.id='dkArchitectWorldOverlay';
canvas.className='dk-world-overlay';canvas.width=640;canvas.height=640;
canvas.hidden=true;canvas.setAttribute('aria-label','Editable live outdoor map');
const wrap=document.createElement('div');wrap.className='dk-world-map-wrap';
game.parentElement.insertBefore(wrap,game);wrap.append(game,canvas);
const ctx=canvas.getContext('2d');
const BUILDINGS=Geo.BUILDINGS,FIXTURES=new Set(['well','stall']);
const areaOf=()=>bridge.snapshot()?.area_id||R.COURT;
let area=null,revision=0,mode='select',floor='path',selected=null;
let open=false,busy=false,drag=null,hover=null;
const undo=[],redo=[];
const enabled=new Set(['select','inspect','move_building','move_object','move_fixture',
 'place_door','erase_door','paint_path','paint_grass','paint_dirt','paint_garden',
 'paint_stone','brush_rect','draw_wall','erase_wall','wall_line','room_outline',
 'export','save','undo','redo']);
const names={move_building:'MOVE BUILDING',move_object:'MOVE OBJECT',move_fixture:'MOVE FIXTURE',
 paint_path:'PAINT PATH',paint_grass:'PAINT GRASS',paint_dirt:'PAINT DIRT',
 paint_garden:'PAINT GARDEN',paint_stone:'PAINT STONE',brush_rect:'RECTANGLE BRUSH',
 place_door:'PLACE DOOR',erase_door:'ERASE DOOR',draw_wall:'BUILD WALL',
 erase_wall:'ERASE WALL',wall_line:'STRAIGHT WALL',room_outline:'ROOM OUTLINE',
 select:'SELECT',inspect:'INSPECT'};
const menu=Menus.create({
 available:key=>enabled.has(key),
 onCategory:()=>false,
 onClose:()=>close(),
 onTool:(key,category,say)=>{
  if(busy)return;
  if(key==='export'){exportJSON();return;}
  if(key==='save'){say('Layout changes are saved after each action. Export JSON to send the layout to GitHub.');return;}
  if(key==='undo'||key==='redo'){history(key);return;}
  if(key.startsWith('paint_'))floor=key.slice(6);
  mode=key;drag=null;say(names[key]||key.toUpperCase());
  draw();
 }
});
function say(message,error=false){
 menu.say((error?'BLOCKED · ':'')+message);
 const caption=$('dkArchitectFeedback');
 if(caption){caption.textContent=(error?'✖ ':'✓ ')+message;caption.style.color=error?'#ffc4b7':'#f5dcaf';}
}
const feedback=document.createElement('output');feedback.id='dkArchitectFeedback';
feedback.style.cssText='position:fixed;z-index:93;left:10px;top:8px;max-width:min(600px,85vw);'+
 'padding:6px 10px;background:#101b2adf;color:#f5dcaf;border:1px solid #6c8ab0;'+
 'font:12px/1.3 monospace;pointer-events:none;';
feedback.hidden=true;document.body.append(feedback);
async function load(){
 const api=window.DemonKillerServer;
 if(!api)throw Error('Browser draft not ready.');
 const current=areaOf(),result=await api.area(current);
 area=result.area;revision=result.revision;
 if(!area||!Array.isArray(area.objects))throw Error('The outdoor region did not load');
 if(!area.objects.some(o=>o.id===selected))selected=null;
 draw();
}
function tile(e){
 const bounds=canvas.getBoundingClientRect(),state=bridge.snapshot();
 if(!state||!bounds.width||!bounds.height)return null;
 const px=(e.clientX-bounds.left)/bounds.width*640,
  py=(e.clientY-bounds.top)/bounds.height*640;
 const gridX=Math.floor(state.camera.x+px/640*state.span),
  gridY=Math.floor(state.camera.y+py/640*state.span);
 return {x:gridX,y:gridY,px,py};
}
function rect(o){return Geo.rect(o);}
function includes(r,p){return p.x>=r.x&&p.x<r.x+r.w&&p.y>=r.y&&p.y<r.y+r.h;}
function pick(p,types){
 if(!area||!p)return null;
 return area.objects.slice().reverse().find(o=>types.has(o.type)&&includes(rect(o),p))||null;
}
function current(){return area?.objects?.find(o=>o.id===selected)||null;}
function highlight(o,fill,stroke){
 const state=bridge.snapshot();if(!state)return;
 const pxPerTile=640/state.span,x=(o.x-state.camera.x)*pxPerTile,
 y=(o.y-state.camera.y)*pxPerTile,w=(o.w||1)*pxPerTile,h=(o.h||1)*pxPerTile;
 ctx.fillStyle=fill;ctx.fillRect(x,y,w,h);
 ctx.strokeStyle=stroke;ctx.lineWidth=3;ctx.strokeRect(x+.5,y+.5,w-1,h-1);
 if(o.door){
  const dx=(o.door.x-state.camera.x)*pxPerTile,dy=(o.door.y-state.camera.y)*pxPerTile;
  ctx.fillStyle='#fff0b3';ctx.fillRect(dx+pxPerTile*.2,dy+pxPerTile*.2,
   pxPerTile*.6,pxPerTile*.6);
 }
}
function movePlan(){
 const o=current();if(!o||drag?.kind!=='move'||!drag.preview)return null;
 const to=drag.preview;
 try{
  if(BUILDINGS.has(o.type))Geo.test(area,o.id,to.x,to.y);
  else{
   if(!Number.isInteger(to.x)||!Number.isInteger(to.y)||to.x<1||to.y<1||
    to.x>=area.width-1||to.y>=area.height-1)throw Error('Outside editable area');
   if(area.walls[to.y*area.width+to.x]||area.floor[to.y*area.width+to.x]==='roof'||
    area.objects.some(x=>x.id!==o.id&&Geo.overlaps(rect(x),{x:to.x,y:to.y,w:1,h:1})))
     throw Error('Fixture placement is blocked');
  }
  return {ok:true};
 }catch(e){return {ok:false,error:e.message};}
}
function draw(){
 ctx.clearRect(0,0,640,640);
 if(!open||!area)return;
 const object=current();
 if(object)highlight(object,'#ffd65b24','#ffe391');
 if(drag?.kind==='move'&&object&&drag.preview){
  const candidate=movePlan();
  highlight({...object,x:drag.preview.x,y:drag.preview.y,
   door:object.door&&{x:object.door.x+drag.preview.x-object.x,
    y:object.door.y+drag.preview.y-object.y}},
   candidate?.ok?'#59e68b4d':'#f34a514f',candidate?.ok?'#8ef5ad':'#fa6a6a');
 }
 if(drag?.kind==='rectangle'&&hover){
  const state=bridge.snapshot(),scale=640/state.span,
   x=Math.min(drag.start.x,hover.x),y=Math.min(drag.start.y,hover.y),
   w=Math.abs(drag.start.x-hover.x)+1,h=Math.abs(drag.start.y-hover.y)+1;
  ctx.fillStyle='#f2e6c32d';ctx.fillRect((x-state.camera.x)*scale,
   (y-state.camera.y)*scale,w*scale,h*scale);
  ctx.strokeStyle='#f4da8d';ctx.lineWidth=2;ctx.strokeRect((x-state.camera.x)*scale,
   (y-state.camera.y)*scale,w*scale,h*scale);
 }
 if(hover){
  const state=bridge.snapshot(),scale=640/state.span;
  ctx.strokeStyle='#dbd9cb';ctx.lineWidth=1;
  ctx.strokeRect((hover.x-state.camera.x)*scale,(hover.y-state.camera.y)*scale,scale,scale);
 }
}
function choose(o){selected=o?.id||null;draw();
 say(o?o.id+' · '+(o.w||1)+' × '+(o.h||1)+
  ' · '+(o.door?'door '+o.door.x+','+o.door.y:'no door'):'No building selected');}
async function submit(action,fields,remember=true){
 if(busy||!area)return false;
 busy=true;
 const api=window.DemonKillerServer,object=current();
 let inverse=null;
 if(object){
  if(action==='move_building'||action==='move_fixture')
   inverse={action,object_id:object.id,x:object.x,y:object.y};
  else if(action==='set_door'||action==='remove_door')
   inverse=object.door?{action:'set_door',object_id:object.id,...object.door}:
    {action:'remove_door',object_id:object.id};
 }
 try{
  const region=area.area_id,result=await api.editOutdoor(action,region,revision,fields);
  revision=result.revision;
  if(remember&&inverse){undo.push({undo:inverse,redo:{action,...fields}});redo.length=0;
   if(undo.length>40)undo.shift();}
  await load();
  await bridge.refresh(); // real game shows edited walls/buildings immediately
  say((window.DKArchitectPreviewActive?'BROWSER DRAFT':'WORLD SAVE')+
   ' · '+action.replaceAll('_',' ')+' · saved; export when finished');
  return true;
 }catch(error){
  if(/Stale/.test(error.message)){
   undo.length=0;redo.length=0;try{await load();}catch(_){}
  }
  say(error.message,true);return false;
 }finally{busy=false;draw();}
}
async function history(which){
 const a=which==='undo'?undo:redo,b=which==='undo'?redo:undo;
 if(!a.length){say('Nothing to '+which);return;}
 const item=a.pop(),command=item[which],{action,...fields}=command;
 const ok=await submit(action,fields,false);
 if(ok)b.push(item);else a.push(item);
}
async function exportJSON(){
 try{
  const content=await window.DemonKillerServer.exportOutdoor(area.area_id);
  const blob=new Blob([JSON.stringify(content,null,2)+'\n'],{type:'application/json'});
  const href=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=href;link.download='demon-killer-'+(area.area_id===R.COURT?'courtyard':'village')+'-layout.json';
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(href),1000);
  say('Map exported as JSON. Send that file back for GitHub integration.');
 }catch(error){say(error.message,true);}
}
async function openEditor(){
 if(open)return;
 if(!bridge.begin()){$('hudJournal').textContent='Lilith is still arriving. Architect is available after the transformation.';return;}
 open=true;feedback.hidden=false;canvas.hidden=false;
 button.setAttribute('aria-pressed','true');
 document.body.classList.add('dk-pa-building');
 menu.open();
 try{await load();say('LIVE OUTDOOR MAP · choose MOVE WHOLE BUILDING, then drag a building.');}
 catch(error){say('Editor unavailable: '+error.message,true);}
}
function close(){
 if(!open)return;
 open=false;drag=null;hover=null;canvas.hidden=true;feedback.hidden=true;
 menu.close();document.body.classList.remove('dk-pa-building');
 button.setAttribute('aria-pressed','false');bridge.end();
 game.focus({preventScroll:true});
}
button.addEventListener('click',()=>open?close():openEditor());
document.addEventListener('keydown',e=>{
 if(e.key==='F8'&&!e.repeat&&!e.ctrlKey&&!e.altKey&&!e.metaKey){
  e.preventDefault();e.stopImmediatePropagation();open?close():openEditor();return;
 }
 if(open&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'].includes(e.key)){
  e.preventDefault();e.stopImmediatePropagation();
 }
},true);
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{
 if(!open||busy||!area)return;
 const p=tile(e);if(!p)return;hover=p;
 if(e.button===2){
  drag={kind:'pan',px:p.px,py:p.py};
  canvas.setPointerCapture(e.pointerId);return;
 }
 if(e.button!==0)return;
 const wallTools=['draw_wall','erase_wall'];
 if(mode==='move_building'||mode==='move_object'||mode==='move_fixture'){
  const o=pick(p,mode==='move_fixture'?FIXTURES:
   mode==='move_building'?BUILDINGS:new Set([...BUILDINGS,...FIXTURES]));
  if(!o){say('Click directly on the building you want to move.',true);return;}
  choose(o);
  drag={kind:'move',id:o.id,start:{x:p.x,y:p.y},
   old:{x:o.x,y:o.y},preview:{x:o.x,y:o.y}};
  canvas.setPointerCapture(e.pointerId);return;
 }
 if(mode==='select'||mode==='inspect'){choose(pick(p,new Set([...BUILDINGS,...FIXTURES])));return;}
 if(mode==='brush_rect'||mode==='wall_line'||mode==='room_outline'){
  drag={kind:'rectangle',start:p};canvas.setPointerCapture(e.pointerId);return;
 }
 if(mode.startsWith('paint_')){drag={kind:'rectangle',start:p};
  canvas.setPointerCapture(e.pointerId);return;}
 if(mode==='place_door'||mode==='erase_door'){
  const o=pick(p,BUILDINGS);
  if(!o)return say('Choose a building wall or doorway.',true);
  choose(o);if(mode==='erase_door'){submit('remove_door',{object_id:o.id});return;}
  submit('set_door',{object_id:o.id,x:p.x,y:p.y});return;
 }
 if(wallTools.includes(mode)){
  submit(mode==='draw_wall'?'paint_wall':'erase_wall',{x:p.x,y:p.y});return;
 }
});
canvas.addEventListener('pointermove',e=>{
 if(!open)return;
 const p=tile(e);if(!p)return;hover=p;
 if(drag?.kind==='pan'){
  const span=bridge.snapshot()?.span||20,dx=(p.px-drag.px)/640*span,
   dy=(p.py-drag.py)/640*span;
  bridge.pan(-dx,-dy);drag.px=p.px;drag.py=p.py;
 }
 if(drag?.kind==='move'){
  drag.preview={x:drag.old.x+p.x-drag.start.x,y:drag.old.y+p.y-drag.start.y};
  const check=movePlan();
  if(check&&!check.ok)say(check.error,true);
 }
 draw();
});
canvas.addEventListener('pointerup',e=>{
 if(!open||!drag)return;
 const operation=drag;drag=null;
 if(canvas.hasPointerCapture?.(e.pointerId))canvas.releasePointerCapture(e.pointerId);
 const p=tile(e);if(!p)return draw();
 if(operation.kind==='move'&&operation.preview){
  const object=current(),x=operation.preview.x,y=operation.preview.y;
  if(object&& (x!==object.x||y!==object.y)){
   const action=FIXTURES.has(object.type)?'move_fixture':'move_building';
   submit(action,{object_id:object.id,x,y});
  }
 }else if(operation.kind==='rectangle'){
  const x=Math.min(operation.start.x,p.x),y=Math.min(operation.start.y,p.y),
   w=Math.abs(operation.start.x-p.x)+1,h=Math.abs(operation.start.y-p.y)+1;
  if(w*h>256){say('Limit the selection to 256 tiles per operation.',true);return draw();}
  if(mode==='wall_line'||mode==='room_outline'){
   submit(mode,{x,y,w,h});
  }else if(mode==='brush_rect'||mode.startsWith('paint_')){
   submit(w*h===1?'paint_ground':'paint_rectangle',w*h===1?
    {x,y,floor}:{x,y,w,h,floor});
  }
 }
 draw();
});
canvas.addEventListener('pointercancel',()=>{drag=null;draw();});
canvas.addEventListener('wheel',e=>{
 if(!open)return;e.preventDefault();
 const r=canvas.getBoundingClientRect();
 bridge.zoom(e.deltaY>0?.86:1.16,
  (e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height);
 draw();
},{passive:false});
window.DKOutdoorArchitect=Object.freeze({isOpen:()=>open,open:openEditor,close});
})();
