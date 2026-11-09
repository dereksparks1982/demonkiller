/* DK Architect M70. Whole-world pixel painter. Deliberately 2D and low-detail:
 * one hard-edged on-screen pixel block per sampled terrain tile/cell,
 * styled to coexist with the original 32x32 character sprites.
 * Server is authoritative. No generated decorative terrain art.
 */
(function(root){
 'use strict';
 const WORLD=9216,DIM=72,PIXEL=10,SIZE=720;
 const SCALES=[1,2,4,8,16,32,64,128];
 const PALETTE=Object.freeze({
  grass:'#547a41',heath:'#77804c',forest:'#345a34',pine:'#2a503b',
  highland:'#76736a',cliff:'#64636c',boulder:'#77777c',glacier:'#b0c4c7',
  crevasse:'#456a78',sea:'#285e77',deepwater:'#20465c',river:'#4284a1',
  lake:'#4c8699',marsh:'#627557',bog:'#475f4c',reed:'#869161',
  beach:'#c1aa7c',dirt:'#8b7357',path:'#9b8867',stone:'#8a8988',
  dark:'#34333a',cracked:'#606068',sigil:'#995058',garden:'#5d8650',
  bridge:'#96805f'
 });
 const LABELS=Object.freeze({
  sea:'OCEAN',deepwater:'DEEP OCEAN',river:'RIVER',lake:'LAKE',
  highland:'HIGHLAND / FOOTHILLS',cliff:'MOUNTAIN / CLIFF',
  glacier:'GLACIER / SNOW',forest:'FOREST'
 });
 const ACCENT=Object.freeze({
  grass:'#689054',forest:'#467147',pine:'#3e6851',
  highland:'#929081',cliff:'#88838c',boulder:'#a39da0',
  sea:'#39758d',river:'#64a0b3',lake:'#6b9aaa',
  beach:'#d6c18f',glacier:'#d4dad9',marsh:'#81936c'
 });
 const TYPES=['sea','deepwater','river','lake','beach','grass','forest','pine',
  'heath','highland','cliff','boulder','marsh','bog','reed','glacier','crevasse',
  'dirt','stone','path','bridge','garden'];
 const OPERATIONS=['paint_material','raise_elevation','lower_elevation',
  'smooth_elevation','flatten_elevation'];
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const $=(selector)=>panel?.querySelector(selector);
 const api=()=>root.DemonKillerServer;
 let panel=null,canvas=null,ctx=null,open=false,busy=false;
 let x=0,y=0,scale=128,brush='sea',mode='cells';
 let frame=null,drag=null,hover=null,revision=null;
 let requestId=0,timer=null;const undo=[],redo=[];
 function say(message,error=false){
  const f=$('[data-status]');if(f){
   f.textContent=message;f.dataset.error=String(error);
  }
 }
 function maxOrigin(){return WORLD-DIM*scale;}
 function camera(nx,ny){
  x=clamp(Math.round(nx),0,maxOrigin());
  y=clamp(Math.round(ny),0,maxOrigin());
  render();scheduleFetch();
 }
 function localPoint(e){
  const r=canvas.getBoundingClientRect();
  const px=clamp((e.clientX-r.left)/r.width,0,.999999);
  const py=clamp((e.clientY-r.top)/r.height,0,.999999);
  const ix=Math.floor(px*DIM),iy=Math.floor(py*DIM);
  return {ix,iy,wx:x+ix*scale,wy:y+iy*scale,px,py};
 }
 function gridLine(index){return index*PIXEL;}
 function render(){
  if(!open||!ctx)return;
  ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,SIZE,SIZE);
  ctx.fillStyle=PALETTE.grass;ctx.fillRect(0,0,SIZE,SIZE);
  if(frame&&frame.x===x&&frame.y===y&&frame.scale===scale){
   for(let row=0;row<DIM;row++)for(let col=0;col<DIM;col++){
    const value=frame.tiles[row]?.[col];
    const color=value?.material?PALETTE[value.material]||'#83798a':PALETTE.grass;
    ctx.fillStyle=color;ctx.fillRect(gridLine(col),gridLine(row),PIXEL,PIXEL);
    if(scale<=4&&value?.material&&ACCENT[value.material]){
     const salt=((x+col*scale)*17+(y+row*scale)*13)%7;
     ctx.fillStyle=ACCENT[value.material];
     ctx.fillRect(gridLine(col)+1+salt%4,gridLine(row)+3+salt%3,3,2);
    }
    // At tile zoom, highlight deliberately raised land with a single hard pixel
    // mark, never a gradient or 3D texture.
    if(scale<=4&&value?.elevation){
     ctx.fillStyle=value.elevation>0?'#b4b1a1':'#1e303b';
     ctx.fillRect(gridLine(col)+2,gridLine(row)+2,2,2);
    }
   }
  }
  if(drag?.kind==='paint'){
   const a=drag.start,b=drag.end||drag.start;
   const minx=Math.min(a.ix,b.ix),miny=Math.min(a.iy,b.iy);
   const w=Math.abs(a.ix-b.ix)+1,h=Math.abs(a.iy-b.iy)+1;
   ctx.fillStyle='#e9d39340';
   ctx.fillRect(minx*PIXEL,miny*PIXEL,w*PIXEL,h*PIXEL);
   ctx.strokeStyle='#f2db88';ctx.lineWidth=2;
   ctx.strokeRect(minx*PIXEL+.5,miny*PIXEL+.5,w*PIXEL-1,h*PIXEL-1);
  }else if(hover){
   ctx.strokeStyle='#f2db88';ctx.lineWidth=1;
   ctx.strokeRect(hover.ix*PIXEL+.5,hover.iy*PIXEL+.5,PIXEL-1,PIXEL-1);
  }
  const pos=$('[data-position]');
  if(pos)pos.textContent='X '+x.toLocaleString()+' · Y '+y.toLocaleString()+
   ' · 1 square = '+scale+' world tile'+(scale===1?'':'s')+
   ' · '+(mode==='cells'?'CELL PAINT':'TILE PAINT');
  const level=$('[data-zoom]');if(level)level.textContent='1:'+scale;
 }
 function scheduleFetch(){
  if(!open)return;
  clearTimeout(timer);
  timer=setTimeout(fetchViewport,100);
 }
 async function fetchViewport(){
  if(!open||!api()?.atlasViewport)return;
  const id=++requestId,params={x,y,scale,columns:DIM,rows:DIM};
  try{
   const result=await api().atlasViewport(params);
   if(!open||id!==requestId)return;
   frame=result;revision=result.revision;
   render();
  }catch(error){if(open&&id===requestId)say('Atlas read failed: '+error.message,true);}
 }
 async function refresh(){
  if(!open)return;
  await fetchViewport();
  if(!api()?.worldCoverage)return;
  try{
   const stats=await api().worldCoverage();
   if(!open)return;
   $('[data-water]').textContent=stats.water_percent.toFixed(2)+'% WATER · TARGET ~33%';
   $('[data-authored]').textContent=stats.authored_tiles.toLocaleString()+
    ' / '+stats.world_tiles.toLocaleString()+' TILES PAINTED';
  }catch(error){say('Coverage unavailable: '+error.message,true);}
 }
 function selectScale(next,pivot={ix:36,iy:36}){
  const value=clamp(next,0,SCALES.length-1),newScale=SCALES[value];
  if(newScale===scale)return;
  const wx=x+pivot.ix*scale,wy=y+pivot.iy*scale;
  scale=newScale;frame=null;
  camera(wx-pivot.ix*scale,wy-pivot.iy*scale);
 }
 function toolChoice(){
  const val=$('[data-tool]').value;
  brush=val;
  if(OPERATIONS.includes(val)&&mode==='cells'){
   mode='tiles';$('[data-mode]').value='tiles';
  }
  say(val.replaceAll('_',' ').toUpperCase()+
   (mode==='cells'?' · PAINT ENTIRE STREAMING CELLS':' · PAINT EXACT TERRAIN TILES'));
  render();
 }
 function positionBounds(a,b){
  return {x:Math.min(a.wx,b.wx),y:Math.min(a.wy,b.wy),
    width:Math.abs(a.wx-b.wx)+scale,
    height:Math.abs(a.wy-b.wy)+scale};
 }
 async function execute(action,fields,remember=true){
  const isCell=['fill_cells','restore_cells'].includes(action);
  const result=isCell?
   await api().paintAtlasCells(action,revision,fields):
   await api().editWorldTerrain(action,revision,fields);
  revision=result.revision;
  if(remember){
   const inverse=isCell?
    {action:'restore_cells',fields:{tiles:result.undo_cells}}:
    {action:'restore',fields:{tiles:result.undo}};
   undo.push({undo:inverse,redo:{action,fields}});
   if(undo.length>30)undo.shift();
   redo.length=0;
  }
  return result;
 }
 async function paintSelection(start,end){
  if(busy)return;
  const choice=brush;
  if(mode==='cells'&&OPERATIONS.includes(choice)){
   say('ELEVATION TOOLS NEED TILE MODE',true);return;
  }
  busy=true;
  try{
   if(revision===null)throw Error('Wait for the server map to load');
   let action,fields;
   if(mode==='cells'){
    const cx=Math.floor(Math.min(start.wx,end.wx)/128),
     cy=Math.floor(Math.min(start.wy,end.wy)/128);
    const ex=Math.floor(Math.max(start.wx,end.wx)/128),
     ey=Math.floor(Math.max(start.wy,end.wy)/128);
    action='fill_cells';
    fields={x:cx,y:cy,width:ex-cx+1,height:ey-cy+1,material:choice};
   }else{
    if(scale>8)throw Error('Zoom in to 1:8 or closer for tile painting');
    const box=positionBounds(start,end);
    if(box.width*box.height>1024)
     throw Error('Maximum detailed paint stroke is 1,024 tiles; zoom in or use CELL FILL');
    action=OPERATIONS.includes(choice)?choice:'paint_material';
    fields=box;
    if(action==='paint_material')fields.material=choice;
    if(action==='flatten_elevation'){
     const ref=await api().terrainSector(Math.floor(start.wx/16),Math.floor(start.wy/16));
     fields.target_elevation=ref.tiles[start.wy%16][start.wx%16].elevation;
    }
   }
   const result=await execute(action,fields);
   say('SAVED TO SERVER · REV '+result.revision+
    ' · '+(result.changed_tiles??result.changed)+' TILES'+
    (result.skipped_cells?.length?' · '+result.skipped_cells.length+' PROTECTED CELLS SKIPPED':''));
   await refresh();
  }catch(error){
   if(/Stale/.test(error.message)){undo.length=0;redo.length=0;await refresh();}
   say(error.message,true);
  }finally{busy=false;render();}
 }
 async function history(kind){
  if(busy)return;
  const stack=kind==='undo'?undo:redo,other=kind==='undo'?redo:undo;
  if(!stack.length){say('Nothing to '+kind);return;}
  const item=stack.pop(),command=item[kind];busy=true;
  try{
   const result=await execute(command.action,command.fields,false);
   other.push(item);
   say(kind.toUpperCase()+' SAVED · REV '+result.revision);
   await refresh();
  }catch(error){stack.push(item);say(error.message,true);}
  finally{busy=false;}
 }
 async function exportWorld(){
  if(!api()?.exportWorldTerrain)return say('Connect DK Server first',true);
  busy=true;
  try{
   const result=await api().exportWorldTerrain();
   const blob=new Blob([JSON.stringify(result,null,2)+'\n'],{type:'application/json'});
   const href=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=href;a.download='dk-world-terrain-m70.json';document.body.append(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(href),5000);
   say('WORLD EXPORTED · REV '+result.world_revision);
  }catch(error){say(error.message,true);}
  finally{busy=false;}
 }
 function make(){
  panel=document.createElement('section');
  panel.id='dkWorldAtlasM70';panel.className='dk-world-atlas-m70';panel.hidden=true;
  panel.setAttribute('aria-label','DK Architect whole world pixel painter');
  const materialOptions=TYPES.map(m=>'<option value="'+m+'">'+(LABELS[m]||m.toUpperCase())+'</option>').join('');
  panel.innerHTML='<header><strong>DK ARCHITECT · WORLD PAINTER</strong>'+
   '<span>9,216 × 9,216 TILES · FLAT GRASS START</span>'+
   '<button type="button" data-close>CLOSE ATLAS</button></header>'+
   '<div class="dk-atlas-toolbar"><label>PAINT <select data-tool>'+materialOptions+
   '<option value="raise_elevation">RAISE GROUND</option>'+
   '<option value="lower_elevation">LOWER GROUND</option>'+
   '<option value="smooth_elevation">SMOOTH HEIGHT</option>'+
   '<option value="flatten_elevation">FLATTEN HEIGHT</option></select></label>'+
   '<label>DETAIL <select data-mode><option value="cells">WHOLE CELLS</option>'+
   '<option value="tiles">INDIVIDUAL TILES</option></select></label>'+
   '<button type="button" data-out>ZOOM OUT</button>'+
   '<strong data-zoom>1:128</strong>'+
   '<button type="button" data-in>ZOOM IN</button>'+
   '<button type="button" data-home>FULL WORLD</button>'+
   '<button type="button" data-undo>UNDO</button>'+
   '<button type="button" data-redo>REDO</button>'+
   '<button type="button" data-export>EXPORT WORLD</button>'+
   '<button type="button" data-walk>WALK HERE</button></div>'+
   '<div class="dk-atlas-body"><div class="dk-atlas-board">'+
   '<canvas width="720" height="720" data-canvas tabindex="0"'+
   ' aria-label="Pixel grid world terrain; left drag paints, right drag pans"></canvas>'+
   '</div><div class="dk-atlas-sidebar"><h2>WORLD GEOGRAPHY</h2>'+
   '<p>LEFT DRAG · PAINT<br>RIGHT DRAG · PAN<br>WHEEL · ZOOM</p>'+
   '<p>WHOLE CELLS fills 128 × 128 world tiles per square.'+
   ' Zoom in and choose INDIVIDUAL TILES to refine coastlines and elevations.</p>'+
   '<strong data-water>0% WATER</strong><strong data-authored>0 TILES PAINTED</strong>'+
   '<p data-position></p><p data-status role="status" aria-live="polite">World atlas loading…</p>'+
   '<p>Every tile starts as green GRASS at elevation 0. Paint oceans, rivers and mountains yourself.</p>'+
   '</div></div>';
  document.body.append(panel);canvas=$('[data-canvas]');ctx=canvas.getContext('2d');
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('pointerdown',e=>{
   if(!open||busy||![0,2].includes(e.button))return;
   const p=localPoint(e);
   drag=e.button===2?{kind:'pan',id:e.pointerId,startX:e.clientX,startY:e.clientY,
    initialX:x,initialY:y}:
    {kind:'paint',id:e.pointerId,start:p,end:p};
   canvas.setPointerCapture(e.pointerId);
   canvas.style.cursor=e.button===2?'grabbing':'crosshair';render();
   e.preventDefault();
  });
  canvas.addEventListener('pointermove',e=>{
   if(!open)return;
   hover=localPoint(e);
   if(drag?.id!==e.pointerId){render();return;}
   if(drag.kind==='pan'){
    if(!(e.buttons&2)){drag=null;canvas.style.cursor='';return;}
    const dx=(e.clientX-drag.startX)/canvas.getBoundingClientRect().width*DIM*scale,
     dy=(e.clientY-drag.startY)/canvas.getBoundingClientRect().height*DIM*scale;
    camera(drag.initialX-dx,drag.initialY-dy);return;
   }
   drag.end=hover;render();
  });
  canvas.addEventListener('pointerup',e=>{
   if(drag?.id!==e.pointerId)return;
   const d=drag;drag=null;canvas.style.cursor='';
   if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
   if(d.kind==='paint')paintSelection(d.start,localPoint(e));
   render();
  });
  canvas.addEventListener('pointercancel',()=>{drag=null;canvas.style.cursor='';render();});
  canvas.addEventListener('lostpointercapture',()=>{
   if(drag){drag=null;canvas.style.cursor='';render();}
  });
  canvas.addEventListener('wheel',e=>{
   if(!open)return;
   e.preventDefault();const p=localPoint(e);
   selectScale(SCALES.indexOf(scale)+(e.deltaY>0?1:-1),p);
  },{passive:false});
  $('[data-tool]').addEventListener('change',toolChoice);
  $('[data-mode]').addEventListener('change',e=>{
   mode=e.target.value;say('PAINT MODE · '+mode.toUpperCase());render();
  });
  $('[data-in]').addEventListener('click',()=>selectScale(SCALES.indexOf(scale)-1));
  $('[data-out]').addEventListener('click',()=>selectScale(SCALES.indexOf(scale)+1));
  $('[data-home]').addEventListener('click',()=>{scale=128;camera(0,0);});
  $('[data-undo]').addEventListener('click',()=>history('undo'));
  $('[data-redo]').addEventListener('click',()=>history('redo'));
  $('[data-export]').addEventListener('click',exportWorld);
  $('[data-walk]').addEventListener('click',()=>{
   const tile=hover||{wx:x+36*scale,wy:y+36*scale};
   const tx=Math.min(WORLD-1,Math.floor(tile.wx)),
    ty=Math.min(WORLD-1,Math.floor(tile.wy));
   root.location.href='./dk-world-explore-m73.html?x='+tx+'&y='+ty;
  });
  $('[data-close]').addEventListener('click',close);
  document.addEventListener('keydown',e=>{
   if(open&&e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}
  },true);
 }
 function show(){
  if(open)return;
  if(!api()?.atlasViewport||!api()?.paintAtlasCells)return false;
  if(!panel)make();
  open=true;panel.hidden=false;brush=$('[data-tool]').value;mode=$('[data-mode]').value;
  document.body.classList.add('dk-atlas-open');render();refresh();
  return true;
 }
 function close(){
  if(!open)return;
  open=false;if(panel)panel.hidden=true;document.body.classList.remove('dk-atlas-open');
  clearTimeout(timer);requestId++;drag=null;hover=null;
  if(root.location?.pathname?.endsWith('/dk-world-architect-m70.html'))
   root.location.href='./index.html';
 }
 root.DKWorldAtlasM70=Object.freeze({show,close,get isOpen(){return open;}});
})(globalThis);
