/* M38: DK Architect edits the ACTUAL outdoor game viewport, not an iframe.
 * Same PA-style category fly-outs as the temple, browser-export or DK Server.
 */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const game=$('world'),button=$('editMode');
const bridge=window.DKOutdoorArchitectBridge,Menus=window.DKArchitectMenus;
const Core=window.DKArchitectCore,Catalog=window.DKArchitectCatalog;
const Geo=window.DKExteriorGeometry,R=window.DemonKillerRegions;
if(!game||!button||!bridge||!Menus||!Geo||!Core||!Catalog)return;
const canvas=document.createElement('canvas');canvas.id='dkArchitectWorldOverlay';
canvas.className='dk-world-overlay';canvas.width=640;canvas.height=640;
canvas.hidden=true;canvas.setAttribute('aria-label','Editable live outdoor map');
const wrap=document.createElement('div');wrap.className='dk-world-map-wrap';
game.parentElement.insertBefore(wrap,game);wrap.append(game,canvas);
const ctx=canvas.getContext('2d');
const BUILDINGS=Geo.BUILDINGS,FIXTURES=new Set(['well','stall']),PROPS=new Set(['architect_prop']);
const SELECTABLE=new Set([...BUILDINGS,...FIXTURES,...PROPS]);
const areaOf=()=>bridge.snapshot()?.area_id||R.COURT;
let area=null,revision=0,mode='select',floor='path',floorArt=null,selected=null,selectedAsset=null,clipboard=null;
let sequence=0;
let open=false,busy=false,drag=null,hover=null;
const undo=[],redo=[];
const enabled=new Set([
 'select','inspect','move_building','move_object','move_fixture','place_door',
 'erase_door','paint_path','paint_grass','paint_dirt','paint_garden','paint_stone',
 'brush_rect','draw_wall','erase_wall','wall_line','room_outline','export','save',
 'undo','redo','place_object','erase_object','rotate_object','place_npc',
 'place_fixture','copy','paste','duplicate','spawn','export_world','world_atlas',
 ...Core.TOOLS.terrain
]);
const core=Core.create({
 available:key=>enabled.has(key)&&(!key.startsWith('terrain_')||
 Boolean(area?.world_origin&&window.DemonKillerServer?.editWorldTerrain))&&
 (key!=='export_world'||Boolean(window.DemonKillerServer?.exportWorldTerrain))&&
 (key!=='world_atlas'||Boolean(window.DKWorldAtlasM70&&window.DemonKillerServer?.atlasViewport)),
 category:()=>{},
 execute:(action,state)=>{
  if(action==='activate_tool'){
   mode=state.tool;drag=null;
   if(mode.startsWith('paint_')){floor=mode.slice(6);floorArt=null;}
   say(mode.replaceAll('_',' ').toUpperCase()+' · click or drag on the world.');draw();
  }else if(action==='select_asset'){
   selectedAsset=state.asset;mode=state.tool;drag=null;
   if(selectedAsset.type==='floor'){floor=selectedAsset.id;floorArt=null;}
   else if(selectedAsset.category==='floors'){floor='stone';floorArt=selectedAsset.assetId||null;}
   else if(selectedAsset.category!=='floors')floorArt=null;
   if(selectedAsset.type==='door')mode='place_door';
   say('SELECTED '+selectedAsset.label.toUpperCase()+' · click the world to place.');draw();
  }else if(action==='rotate_preview'){
   say('ROTATED '+['NORTH','EAST','SOUTH','WEST'][state.rotation]);draw();
  }else if(action==='export')exportJSON();
  else if(action==='export_world')exportWorldTerrain();
   else if(action==='world_atlas'){
    if(window.DKWorldAtlasM70?.show())
     say('WORLD ATLAS · PAINT ANYWHERE IN THE 9,216 × 9,216 WORLD');
    else say('The world atlas requires a connected DK Server.',true);
   }
  else if(action==='save')say('Edits are saved after each operation. EXPORT JSON when finished.');
  else if(action==='undo'||action==='redo')history(action);
 }
});
const menu=Menus.create({core,onClose:()=>close()});
const TERRAIN_TOOLS=Object.freeze({terrain_ocean:'sea',terrain_river:'river',
 terrain_mountain:'cliff',terrain_rock:'boulder',terrain_grass:'grass',
 terrain_forest:'forest',terrain_marsh:'marsh',terrain_beach:'beach'});
function wallArt(){
 const a=selectedAsset;
 if(!a||a.category!=='walls')return {};
 const source=window.DKArchitectDungeon?.entries?.[a.assetId];
 return {wallPack:a.wallPack||source?.pack||'ox72i',
  wallAsset:a.type==='imported'?a.assetId:null,
  rotation:core.state().rotation};
}
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
  else if(PROPS.has(o.type))Geo.validatePropPlacement(area,{...o,x:to.x,y:to.y},o.id);
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
 if((mode==='place_object'||mode==='paste')&&hover&&(selectedAsset||clipboard)){
  try{
   const asset=mode==='paste'?clipboard:selectedAsset;
   const pending=Geo.propObject({
    id:'architect_prop_preview99',assetType:asset.assetType||asset.type,
    assetId:asset.assetId||null,spriteId:asset.spriteId||null,
    x:hover.x,y:hover.y,r:core.state().rotation
   });
   let valid=true;try{Geo.validatePropPlacement(area,pending);}catch(_){valid=false;}
   highlight(pending,valid?'#56e78555':'#e957574a',valid?'#8bf3a6':'#fe7474');
  }catch(_){}
 }
 if(drag?.kind==='move'&&object&&drag.preview){
  const candidate=movePlan();
  highlight({...object,x:drag.preview.x,y:drag.preview.y,
   door:object.door&&{x:object.door.x+drag.preview.x-object.x,
    y:object.door.y+drag.preview.y-object.y}},
   candidate?.ok?'#59e68b4d':'#f34a514f',candidate?.ok?'#8ef5ad':'#fa6a6a');
 }
 if((drag?.kind==='rectangle'||drag?.kind==='terrain_rectangle')&&hover){
  const state=bridge.snapshot(),scale=640/state.span,
   x=Math.min(drag.start.x,hover.x),y=Math.min(drag.start.y,hover.y),
   w=Math.abs(drag.start.x-hover.x)+1,h=Math.abs(drag.start.y-hover.y)+1;
  ctx.fillStyle='#f2e6c32d';ctx.fillRect((x-state.camera.x)*scale,
   (y-state.camera.y)*scale,w*scale,h*scale);
  ctx.strokeStyle='#f4da8d';ctx.lineWidth=2;ctx.strokeRect((x-state.camera.x)*scale,
   (y-state.camera.y)*scale,w*scale,h*scale);
 }
 if(drag?.kind==='wall_stroke'){
  const state=bridge.snapshot(),scale=640/(state?.span||20);
  for(const p of drag.cells){
   const i=p.y*area.width+p.x;
   const valid=p.x>=1&&p.y>=1&&p.x<area.width-1&&p.y<area.height-1&&
    !area.objects.some(o=>Geo.overlaps(Geo.rect(o),{x:p.x,y:p.y,w:1,h:1}))&&
    (drag.erase?Boolean(area.walls[i]):(!area.walls[i]&&
     ['grass','dirt','garden'].includes(area.floor[i])));
   ctx.fillStyle=valid?'#4dea8866':'#e74a4a66';
   ctx.fillRect((p.x-state.camera.x)*scale,(p.y-state.camera.y)*scale,scale,scale);
  }
 }
 if(mode==='spawn'&&area?.spawn){
  highlight({x:area.spawn.x,y:area.spawn.y,w:1,h:1},'#91d9eb35','#c2f1ec');
 }
 if(hover){
  const state=bridge.snapshot(),scale=640/state.span;
  ctx.strokeStyle='#dbd9cb';ctx.lineWidth=1;
  ctx.strokeRect((hover.x-state.camera.x)*scale,(hover.y-state.camera.y)*scale,scale,scale);
 }
}
function captureTiles(action,fields){
 if(!area||!['paint_wall','erase_wall','wall_line','room_outline',
   'paint_ground','paint_rectangle','wall_batch'].includes(action))return [];
 const w=fields.w||1,h=fields.h||1,result=[];
 const points=action==='wall_batch'?fields.tiles:
  Array.from({length:w*h},(_,k)=>({x:fields.x+k%w,y:fields.y+Math.floor(k/w)}));
 for(const {x,y}of points){
  if(x<1||y<1||x>=area.width-1||y>=area.height-1)continue;
  if(area.objects.some(o=>Geo.overlaps(Geo.rect(o),{x,y,w:1,h:1})))continue;
  const i=y*area.width+x,row={x,y};
  for(const name of Geo.FIELDS)row[name]=area[name][i];
  result.push(row);
 }
 return result;
}
function choose(o){selected=o?.id||null;draw();
 say(o?o.id+' · '+(o.w||1)+' × '+(o.h||1)+
  ' · '+(o.door?'door '+o.door.x+','+o.door.y:'no door'):'No building selected');}
async function submit(action,fields,remember=true){
 if(busy||!area)return false;
 busy=true;
 const api=window.DemonKillerServer,object=current();
 let inverse=null;
 const before=captureTiles(action,fields);
 if(before.length)inverse={action:'restore_tiles',tiles:before};
 if(action==='set_spawn'&&area.spawn)
  inverse={action:'set_spawn',x:area.spawn.x,y:area.spawn.y};
 if(object){
  if(action==='move_building'||action==='move_fixture'||action==='move_prop')
   inverse={action,object_id:object.id,x:object.x,y:object.y};
  else if(action==='rotate_prop')
   inverse={action,object_id:object.id,r:object.r};
  else if(action==='remove_prop')
   inverse={action:'place_prop',id:object.id,assetType:object.assetType,
    assetId:object.assetId||null,spriteId:object.spriteId||null,
    x:object.x,y:object.y,r:object.r};
  else if(action==='set_door'||action==='remove_door')
   inverse=object.door?{action:'set_door',object_id:object.id,...object.door}:
    {action:'remove_door',object_id:object.id};
 }
 if(action==='place_prop')inverse={action:'remove_prop',object_id:fields.id};
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
async function submitTerrain(action,fields,remember=true){
 const api=window.DemonKillerServer;
 if(busy||!area?.world_origin||!api?.editWorldTerrain)return false;
 busy=true;
 try{
  const result=await api.editWorldTerrain(action,revision,fields);
  revision=result.revision;
  if(remember){
   undo.push({terrain:true,undo:{action:'restore',fields:{tiles:result.undo}},
    redo:{action,fields}});
   redo.length=0;if(undo.length>40)undo.shift();
  }
  await load();await bridge.refresh();
  say('SERVER TERRAIN SAVED · '+result.changed+' tiles · revision '+revision);
  return true;
 }catch(error){
  if(/Stale/.test(error.message)){
   undo.length=0;redo.length=0;try{await load();}catch(_){}
  }
  say(error.message,true);return false;
 }finally{busy=false;draw();}
}
async function exportWorldTerrain(){
 try{
  const api=window.DemonKillerServer;
  if(!api?.exportWorldTerrain)throw Error('Terrain export requires a connected DK Server');
  const data=await api.exportWorldTerrain();
  const blob=new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'});
  const href=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=href;link.download='demon-killer-world-terrain-m69.json';
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(href),3000);
  say('SERVER TERRAIN EXPORTED · '+data.dimensions.width+'×'+data.dimensions.height+
    ' · revision '+data.world_revision);
 }catch(error){say(error.message,true);}
}
async function paintWorldTerrain(p0,p1,chosenMode){
 const origin=area?.world_origin,api=window.DemonKillerServer;
 if(!origin||!api?.editWorldTerrain)
  return say('World terrain editing requires a connected server wilderness cell',true);
 const x=origin.x+Math.min(p0.x,p1.x),y=origin.y+Math.min(p0.y,p1.y);
 const width=Math.abs(p0.x-p1.x)+1,height=Math.abs(p0.y-p1.y)+1;
 if(width*height>1024)return say('Maximum terrain brush is 1024 tiles',true);
 const actions={terrain_raise:'raise_elevation',terrain_lower:'lower_elevation',
  terrain_smooth:'smooth_elevation',terrain_flatten:'flatten_elevation'};
 const action=actions[chosenMode]||'paint_material',fields={x,y,width,height};
 if(action==='paint_material')fields.material=TERRAIN_TOOLS[chosenMode];
 if(action==='flatten_elevation'){
  try{
   const sx=Math.floor((origin.x+p0.x)/16),sy=Math.floor((origin.y+p0.y)/16);
   const sector=await api.terrainSector(sx,sy);
   fields.target_elevation=sector.tiles[(origin.y+p0.y)%16][(origin.x+p0.x)%16].elevation;
  }catch(error){return say('Cannot inspect flatten height: '+error.message,true);}
 }
 return submitTerrain(action,fields);
}
async function history(which){
 const a=which==='undo'?undo:redo,b=which==='undo'?redo:undo;
 if(!a.length){say('Nothing to '+which);return;}
 const item=a.pop(),command=item[which];
 const {action,...fields}=item.terrain?{action:command.action,...command.fields}:command;
 const ok=item.terrain?await submitTerrain(action,fields,false):
  await submit(action,fields,false);
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
 if(!bridge.begin()){const journal=$('message');if(journal)journal.textContent='Wait for Lilith to finish transforming before editing.';return;}
 open=true;feedback.hidden=false;canvas.hidden=false;
 button.setAttribute('aria-pressed','true');
 document.body.classList.add('dk-pa-building');
 core.reset();mode='select';menu.open();
 try{await load();say('LIVE OUTDOOR MAP · choose MOVE WHOLE BUILDING, then drag a building.');}
 catch(error){say('Editor unavailable: '+error.message,true);}
}
function close(){
 if(!open)return;
 window.DKWorldAtlasM70?.close();
 open=false;drag=null;hover=null;canvas.hidden=true;feedback.hidden=true;canvas.style.cursor='';
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
  e.preventDefault();
  drag={kind:'pan',pointerId:e.pointerId,px:p.px,py:p.py};
  canvas.style.cursor='grabbing';
  canvas.setPointerCapture(e.pointerId);return;
 }
 if(e.button!==0)return;
 if(mode.startsWith('terrain_')){
  drag={kind:'terrain_rectangle',start:p,tool:mode,pointerId:e.pointerId};
  canvas.setPointerCapture(e.pointerId);draw();return;
 }
 const wallTools=['draw_wall','erase_wall'];
 if(mode==='move_building'||mode==='move_object'||mode==='move_fixture'){
  const o=pick(p,mode==='move_fixture'?FIXTURES:
   mode==='move_building'?BUILDINGS:SELECTABLE);
  if(!o){say('Click directly on the building you want to move.',true);return;}
  choose(o);
  drag={kind:'move',id:o.id,start:{x:p.x,y:p.y},
   old:{x:o.x,y:o.y},preview:{x:o.x,y:o.y}};
  canvas.setPointerCapture(e.pointerId);return;
 }
 if(mode==='select'||mode==='inspect'){choose(pick(p,SELECTABLE));return;}
 if(mode==='spawn'){submit('set_spawn',{x:p.x,y:p.y});return;}
 if(mode==='place_object'||mode==='paste'){
  const asset=mode==='paste'?clipboard:selectedAsset;
  if(!asset)return say('Choose an approved sprite or object from the catalog.',true);
  const kind=asset.assetType||asset.type;
  if(kind==='floor'||kind==='wall')return say('Choose a floor or wall tool.',true);
  const item={id:'architect_prop_'+Date.now().toString(36)+'_'+(++sequence).toString(36),
   assetType:kind,assetId:asset.assetId||null,spriteId:asset.spriteId||null,
   x:p.x,y:p.y,r:core.state().rotation};
  submit('place_prop',item);return;
 }
 if(['rotate_object','erase_object','copy','duplicate'].includes(mode)){
  const prop=pick(p,PROPS);if(!prop)return say('Select a DK Architect object, not a protected building.',true);
  choose(prop);
  if(mode==='rotate_object')submit('rotate_prop',{object_id:prop.id,r:(prop.r+1)%4});
  else if(mode==='erase_object')submit('remove_prop',{object_id:prop.id});
  else{
   clipboard={assetType:prop.assetType,assetId:prop.assetId,spriteId:prop.spriteId};
   if(mode==='duplicate'){mode='paste';say('Click a clear tile to place the duplicate.');}
   else say('Copied '+prop.id+'. Choose PASTE to place a copy.');
  }
  return;
 }
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
  drag={kind:'wall_stroke',cells:[{x:p.x,y:p.y}],seen:new Set([p.y*area.width+p.x]),
   last:{x:p.x,y:p.y},erase:mode==='erase_wall'};
  canvas.setPointerCapture(e.pointerId);draw();return;
 }
});
canvas.addEventListener('pointermove',e=>{
 if(!open)return;
 const p=tile(e);if(!p)return;hover=p;
 if(drag?.kind==='pan'){
  if(e.pointerId!==drag.pointerId)return;
  if(!(e.buttons&2)){drag=null;canvas.style.cursor='';return draw();}
  const span=bridge.snapshot()?.span||20,dx=(p.px-drag.px)/640*span,
   dy=(p.py-drag.py)/640*span;
  bridge.pan(-dx,-dy);drag.px=p.px;drag.py=p.py;
  return draw();
 }
 if(drag?.kind==='wall_stroke'){
  const last=drag.last;
  let x=last.x,y=last.y;
  const add=(tx,ty)=>{
   const key=ty*area.width+tx;
   if(drag.seen.has(key)||drag.cells.length>=256)return;
   drag.seen.add(key);drag.cells.push({x:tx,y:ty});
  };
  while(x!==p.x&&drag.cells.length<256){x+=Math.sign(p.x-x);add(x,y);}
  while(y!==p.y&&drag.cells.length<256){y+=Math.sign(p.y-y);add(x,y);}
  drag.last={x,y};
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
 if(drag.kind==='pan'&&e.pointerId!==drag.pointerId)return;
 const operation=drag;drag=null;
 if(operation.kind==='pan')canvas.style.cursor='';
 if(canvas.hasPointerCapture?.(e.pointerId))canvas.releasePointerCapture(e.pointerId);
 const p=tile(e);if(!p)return draw();
 if(operation.kind==='terrain_rectangle'){
  paintWorldTerrain(operation.start,p,operation.tool);
 }else if(operation.kind==='wall_stroke'){
  submit('wall_batch',{tiles:operation.cells,erase:operation.erase,
   ...(operation.erase?{}:wallArt())});
 }else if(operation.kind==='move'&&operation.preview){
  const object=current(),x=operation.preview.x,y=operation.preview.y;
  if(object&& (x!==object.x||y!==object.y)){
   const action=PROPS.has(object.type)?'move_prop':FIXTURES.has(object.type)?'move_fixture':'move_building';
   submit(action,{object_id:object.id,x,y});
  }
 }else if(operation.kind==='rectangle'){
  const x=Math.min(operation.start.x,p.x),y=Math.min(operation.start.y,p.y),
   w=Math.abs(operation.start.x-p.x)+1,h=Math.abs(operation.start.y-p.y)+1;
  if(w*h>256){say('Limit the selection to 256 tiles per operation.',true);return draw();}
  if(mode==='wall_line'||mode==='room_outline'){
   submit(mode,{x,y,w,h,...wallArt()});
  }else if(mode==='brush_rect'||mode.startsWith('paint_')){
   submit(w*h===1?'paint_ground':'paint_rectangle',w*h===1?
    {x,y,floor,...(floorArt?{floorArt}:{})}:{x,y,w,h,floor,...(floorArt?{floorArt}:{})});
  }
 }
 draw();
});
canvas.addEventListener('pointercancel',()=>{drag=null;canvas.style.cursor='';draw();});
canvas.addEventListener('lostpointercapture',()=>{
 if(drag?.kind==='pan'){drag=null;canvas.style.cursor='';draw();}
});
canvas.addEventListener('wheel',e=>{
 if(!open)return;e.preventDefault();
 if((mode==='place_object'||mode==='paste'||mode==='draw_wall')&&!e.shiftKey){core.rotate(e.deltaY>0?1:-1);return;}
 const r=canvas.getBoundingClientRect();
 bridge.zoom(e.deltaY>0?.86:1.16,
  (e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height);
 draw();
},{passive:false});
window.DKOutdoorArchitect=Object.freeze({isOpen:()=>open,open:openEditor,close,core});
})();
