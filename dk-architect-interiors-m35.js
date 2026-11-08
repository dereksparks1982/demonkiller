/* DK Architect M35: original room-draft editing workspace. Draft-only. */
(()=>{
 'use strict';
 const api=window.DemonKillerServer,$=id=>document.getElementById(id),
  canvas=$('map'),ctx=canvas.getContext('2d');
 const FLOOR=['stone','dark','cracked','sigil','grass','path','garden','roof','dirt','wood'];
 const PALETTE={stone:'#706b71',dark:'#323039',cracked:'#645a60',
  sigil:'#694259',grass:'#55684b',path:'#857568',garden:'#567047',
  roof:'#433b41',dirt:'#695442',wood:'#81614b'};
 const TYPES={altar:[2,3],coffin:[1,2],pew:[2,1],table:[2,2],
  bed:[2,3],rug:[2,2],bookcase:[2,1]};
 const layers=['floor','walls','wallStyles','wallRotations'];
 let entry=null,room=null,cells=[],pending=new Map(),busy=false;
 let origin={x:72,y:65},hover=null,stroke=null,panning=null;
 const GRID=()=>Number($('zoom').value)||26;
 function tell(text,error=false){
  $('status').textContent=text;
  $('status').style.color=error?'#f3a59f':'#d5bf96';
 }
 function clean(){
  pending.clear();updatePending();hover=null;stroke=null;
 }
 function updatePending(){
  $('pending').textContent=pending.size+' unsaved tile edit'+(pending.size===1?'':'s');
 }
 function optionsForLayer(){
  const layer=$('layer').value;
  const values=layer==='floor'?FLOOR:layer==='walls'?['1','0']:
   layer==='wallStyles'?['clean','cracked','dark','mossy']:['0','1','2','3'];
  const control=$('value'),previous=control.value;
  control.replaceChildren();
  for(const value of values){
   const option=new Option(value==='1'&&layer==='walls'?'Wall':
    value==='0'&&layer==='walls'?'Clear':value,value);
   control.add(option);
  }
  if(values.includes(previous))control.value=previous;
 }
 function ready(){return Boolean(entry&&room&&!busy);}
 function configureSize(){
  $('roomSize').textContent=entry?
   'Exterior '+entry.exterior.width+'×'+entry.exterior.height+
   ' tiles • '+(room?'Draft '+room.width+'×'+room.height+
    ' • revision '+room.revision:'No saved interior draft'):'No building selected';
 }
 function worldTile(e){
  const rect=canvas.getBoundingClientRect();
  if(!rect.width||!rect.height)return null;
  const p={x:(e.clientX-rect.left)*canvas.width/rect.width,
    y:(e.clientY-rect.top)*canvas.height/rect.height};
  const tile={x:Math.floor((p.x-origin.x)/GRID()),
    y:Math.floor((p.y-origin.y)/GRID())};
  return {pixel:p,tile,valid:!!room&&tile.x>=0&&tile.y>=0&&
   tile.x<room.width&&tile.y<room.height};
 }
 function value(){const layer=$('layer').value,v=$('value').value;
  return ['walls','wallRotations'].includes(layer)?Number(v):v;
 }
 function paintAt(t){
  if(!room||!t||t.x<0||t.y<0||t.x>=room.width||t.y>=room.height)return;
  const layer=$('layer').value,v=value(),idx=t.y*room.width+t.x;
  if(layer==='walls'&&v===1&&room.entry.x===t.x&&room.entry.y===t.y)return;
  room.layers[layer][idx]=v;
  pending.set(layer+':'+t.x+','+t.y,{layer,x:t.x,y:t.y,value:v});
  updatePending();
 }
 function paintRectangle(a,b){
  const x0=Math.max(0,Math.min(a.x,b.x)),
    x1=Math.min(room.width-1,Math.max(a.x,b.x)),
    y0=Math.max(0,Math.min(a.y,b.y)),
    y1=Math.min(room.height-1,Math.max(a.y,b.y));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)paintAt({x,y});
 }
 async function update(){
  if(!api){tell('Connect to DK Server on 127.0.0.1. Static preview cannot edit world saves.',true);return;}
  busy=true;
  try{
   const result=await api.interiorCells();
   cells=result.entries;
   const control=$('cells'),selected=entry?.cell_id;
   control.replaceChildren();
   for(const item of cells){
    const option=new Option(item.area_id.split('.')[1]+' / '+item.object_id+
     ' ('+item.exterior.width+'×'+item.exterior.height+')'+
     (item.draft?' • draft':''),
      item.cell_id);
    control.add(option);
   }
   control.value=selected&&cells.some(c=>c.cell_id===selected)?selected:
    cells[0]?.cell_id||'';
   entry=cells.find(c=>c.cell_id===control.value)||null;
   await openDraft();
   tell('DK Architect connected. Room blueprints are drafts until a future publish build.');
  }catch(error){tell('Could not load Streaming Cells: '+error.message,true);}
  finally{busy=false;draw();}
 }
 async function openDraft(){
  clean();room=null;
  if(!entry){configureSize();draw();return;}
  const result=await api.interiorDraft(entry.cell_id);
  room=result.draft;
  $('roomTitle').value=room?.title||entry.object_id.replaceAll('_',' ');
  if(room){
   $('roomWidth').value=room.width;$('roomHeight').value=room.height;
  }
  configureSize();draw();
 }
 async function save(command){
  if(!entry||busy||!api)throw Error('No active room');
  busy=true;
  try{
   const result=await api.editInteriorDraft(command.action,entry.cell_id,
    room?.revision||0,command.fields||{});
   if(room)room.revision=result.draft_revision;
   configureSize();
   return result;
  }catch(error){
   tell('Save rejected: '+error.message+'. Reload before resolving a revision conflict.',true);
   throw error;
  }finally{busy=false;draw();}
 }
 async function createRoom(){
  if(!entry||room)return tell('Choose a building without a saved draft.',true);
  try{
   const width=Number($('roomWidth').value),height=Number($('roomHeight').value);
   if(!Number.isInteger(width)||!Number.isInteger(height)||
    width<4||height<4||width>64||height>64||width*height>2048)
    return tell('Room must be at least 4×4 and at most 2,048 tiles.',true);
   await save({action:'create_draft',fields:{
    width,height,title:$('roomTitle').value.trim()||entry.object_id}});
   await openDraft();
   tell('Draft created and saved. Its exterior remains non-enterable.');
  }catch(_){}
 }
 async function saveTiles(){
  if(!ready())return tell('Create a room draft first.',true);
  if(!pending.size)return tell('No tile edits waiting to be saved.');
  const jobs=[...pending.values()];
  try{
   while(jobs.length){
    const batch=jobs.splice(0,32);
    await save({action:'paint_tiles',fields:{patches:batch}});
    for(const t of batch)pending.delete(t.layer+':'+t.x+','+t.y);
    updatePending();
   }
   tell('All tile edits saved to the persistent world.');
  }catch(_){}
 }
 function selectedObjectSize(){
  const type=$('objectType').value,r=Number($('rotation').value)||0,
   [w,h]=TYPES[type]||[1,1];
  return r%2?[h,w]:[w,h];
 }
 async function placeObject(tile){
  const [w,h]=selectedObjectSize(),object={
   id:$('objectId').value.trim(),type:$('objectType').value,
   x:tile.x,y:tile.y,w,h,r:Number($('rotation').value)||0};
  try{
   await save({action:'place_object',fields:{object}});
   room.objects.push(object);
   $('objectId').value=object.id.replace(/\d+$/,match=>String(Number(match)+1));
   tell('Placed '+object.type+' in the saved interior draft.');
  }catch(_){}
 }
 async function removeObject(tile){
  const target=[...room.objects].reverse().find(o=>
   tile.x>=o.x&&tile.x<o.x+o.w&&tile.y>=o.y&&tile.y<o.y+o.h);
  if(!target)return tell('No object occupies that tile.');
  try{
   await save({action:'remove_object',fields:{object_id:target.id}});
   room.objects=room.objects.filter(o=>o.id!==target.id);
   tell('Removed '+target.id+' from the draft.');
  }catch(_){}
 }
 function gridRect(x,y,w=1,h=1){
  return {x:origin.x+x*GRID(),y:origin.y+y*GRID(),
   w:w*GRID(),h:h*GRID()};
 }
 function draw(){
  const w=canvas.width,h=canvas.height;
  ctx.clearRect(0,0,w,h);ctx.fillStyle='#15141a';ctx.fillRect(0,0,w,h);
  if(!room){
   ctx.font='18px system-ui';ctx.fillStyle='#c4a780';
   ctx.fillText('Select a building and create a room draft.',45,55);
   return;
  }
  const side=GRID();
  for(let y=0;y<room.height;y++)for(let x=0;x<room.width;x++){
   const k=y*room.width+x,t=gridRect(x,y);
   if(t.x+t.w<0||t.x>w||t.y+t.h<0||t.y>h)continue;
   const floor=room.layers.floor[k];ctx.fillStyle=PALETTE[floor]||'#706b71';
   ctx.fillRect(t.x,t.y,t.w,t.h);
   if(room.layers.walls[k]===1){
    ctx.fillStyle='#a9a0a0';ctx.fillRect(t.x+2,t.y+2,side-4,side-4);
    ctx.fillStyle='#4f4850';ctx.fillRect(t.x+3,t.y+3,side-6,3);
   }
   ctx.strokeStyle='rgba(23,18,29,.4)';
   ctx.strokeRect(t.x+.5,t.y+.5,t.w,t.h);
  }
  for(const o of room.objects){
   const t=gridRect(o.x,o.y,o.w,o.h);
   ctx.fillStyle='rgba(51,35,76,.78)';ctx.fillRect(t.x+2,t.y+2,t.w-4,t.h-4);
   ctx.strokeStyle='#d3b07a';ctx.lineWidth=2;
   ctx.strokeRect(t.x+2,t.y+2,t.w-4,t.h-4);
   ctx.fillStyle='#f2d9ad';ctx.font='11px monospace';
   ctx.fillText(o.type.slice(0,12),t.x+5,t.y+15);
   ctx.fillStyle='#fff7e9';ctx.fillRect(t.x+t.w/2-2,t.y+4,4,4);
  }
  const entry=gridRect(room.entry.x,room.entry.y);
  ctx.fillStyle='#69c6b7';ctx.fillRect(entry.x+side*.3,entry.y+side*.65,
   side*.4,side*.35);
  if(stroke&&stroke.mode==='rectangle'&&hover?.valid){
   const a=stroke.start,b=hover.tile,from=gridRect(Math.min(a.x,b.x),Math.min(a.y,b.y));
   ctx.strokeStyle='#f0dc91';ctx.lineWidth=3;
   ctx.strokeRect(from.x,from.y,
    (Math.abs(a.x-b.x)+1)*side,(Math.abs(a.y-b.y)+1)*side);
  }
  if(hover?.valid){
   const a=hover.tile,mode=$('mode').value;
   const [pw,ph]=mode==='place'?selectedObjectSize():[1,1],t=gridRect(a.x,a.y,pw,ph);
   ctx.fillStyle='rgba(216,192,112,.22)';ctx.fillRect(t.x,t.y,t.w,t.h);
   ctx.strokeStyle='#f0dba3';ctx.lineWidth=2;ctx.strokeRect(t.x,t.y,t.w,t.h);
  }
 }
 canvas.addEventListener('contextmenu',e=>e.preventDefault());
 canvas.addEventListener('pointerdown',e=>{
  if(!room)return;
  const p=worldTile(e);canvas.setPointerCapture(e.pointerId);
  if(e.button===2){panning=p.pixel;return;}
  if(e.button!==0||!p.valid||busy)return;
  hover=p;
  const mode=$('mode').value;
  if(mode==='paint'){stroke={mode};paintAt(p.tile);}
  else if(mode==='rectangle'){stroke={mode,start:p.tile};}
  else if(mode==='place')void placeObject(p.tile);
  else if(mode==='erase')void removeObject(p.tile);
  draw();
 });
 canvas.addEventListener('pointermove',e=>{
  const p=worldTile(e);
  if(panning){
   origin.x+=p.pixel.x-panning.x;origin.y+=p.pixel.y-panning.y;
   panning=p.pixel;
  }else if(stroke?.mode==='paint'&&p.valid&&!busy)paintAt(p.tile);
  hover=p;draw();
 });
 const release=e=>{
  const p=worldTile(e);
  if(stroke?.mode==='rectangle'&&p?.valid&&!busy)
   paintRectangle(stroke.start,p.tile);
  stroke=null;panning=null;draw();
 };
 canvas.addEventListener('pointerup',release);
 canvas.addEventListener('pointercancel',()=>{stroke=null;panning=null;draw();});
 canvas.addEventListener('wheel',e=>{
  if($('mode').value!=='place')return;
  e.preventDefault();
  $('rotation').value=String((Number($('rotation').value)+(e.deltaY>0?1:3))%4);
  draw();
 },{passive:false});
 $('layer').addEventListener('change',()=>{optionsForLayer();draw();});
 for(const key of ['mode','value','objectType','rotation','zoom'])
  $(key).addEventListener('change',draw);
 $('cells').addEventListener('change',async()=>{
  if(pending.size&&!confirm('Discard unsaved tile changes?')){
   $('cells').value=entry?.cell_id||'';return;
  }
  entry=cells.find(c=>c.cell_id===$('cells').value)||null;
  try{await openDraft();tell('Selected '+entry?.object_id);}
  catch(error){tell(error.message,true);}
 });
 $('createDraft').addEventListener('click',createRoom);
 $('reloadDraft').addEventListener('click',async()=>{
  if(pending.size&&!confirm('Discard unsaved tile changes?'))return;
  try{await openDraft();tell('Draft reloaded from persistent server.');}
  catch(error){tell(error.message,true);}
 });
 $('savePaint').addEventListener('click',saveTiles);
 $('rename').addEventListener('click',async()=>{
  if(!ready())return tell('Create a draft first.',true);
  try{
   await save({action:'rename_draft',fields:{title:$('roomTitle').value}});
   room.title=$('roomTitle').value; tell('Room title saved.');
  }catch(_){}
 });
 optionsForLayer();update();
})();
