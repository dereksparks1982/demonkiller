/* DK Softworks M32 - client-side terrain-sector cache. Original runtime code.
 * Shared by Node tests and the browser, with no dependence on rendering.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.DKSectorTerrain=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const SIZE=16,LAYERS=Object.freeze(['floor','walls','wallStyles','wallVariants',
  'wallPacks','wallRotations','floorArt']);
 const MAX_CACHED=28,MAX_PARALLEL=4;
 function integer(v){return Number.isSafeInteger(v);}
 function key(sx,sy){return sx+','+sy;}
 function validateManifest(m){
  if(!m||typeof m.area_id!=='string'||!/^dk\.[a-z0-9.]+$/.test(m.area_id)||
   !integer(m.width)||!integer(m.height)||m.width<16||m.height<16||
   m.width>512||m.height>512||m.tile_size!==32||
   !Array.isArray(m.objects)||m.objects.length>2048||
   !integer(m.sector_size)||m.sector_size!==SIZE)
   throw Error('Invalid streaming map manifest');
  for(const o of m.objects)if(!o||typeof o.id!=='string'||
   !integer(o.x)||!integer(o.y)||o.x<0||o.y<0||
   o.x>=m.width||o.y>=m.height)throw Error('Invalid streamed object');
  return m;
 }
 function makeArea(manifest){
  const m=validateManifest(manifest),a={
   schema:m.schema||1,area_id:m.area_id,width:m.width,height:m.height,
   tile_size:32,objects:m.objects.map(o=>({...o})),streamed:true
  };
  for(const layer of LAYERS)a[layer]=Array(m.width*m.height).fill(null);
  return a;
 }
 function checkChunk(area,chunk){
  if(!chunk||chunk.area_id!==area.area_id||chunk.sector_size!==SIZE||
   !integer(chunk.sx)||!integer(chunk.sy)||chunk.sx<0||chunk.sy<0)
   throw Error('Invalid terrain chunk identity');
  const x=chunk.sx*SIZE,y=chunk.sy*SIZE;
  if(x>=area.width||y>=area.height)throw Error('Chunk outside region');
  const width=Math.min(SIZE,area.width-x),height=Math.min(SIZE,area.height-y);
  const b=chunk.bounds;
  if(!b||b.x!==x||b.y!==y||b.width!==width||b.height!==height)
   throw Error('Invalid terrain chunk bounds');
  for(const name of LAYERS){
   const rows=chunk.layers?.[name];
   if(!Array.isArray(rows)||rows.length!==height||
    rows.some(row=>!Array.isArray(row)||row.length!==width))
    throw Error('Incomplete streamed tile layer: '+name);
  }
  return {x,y,width,height};
 }
 function writeChunk(area,chunk){
  const b=checkChunk(area,chunk);
  for(const name of LAYERS)for(let dy=0;dy<b.height;dy++){
   const start=(b.y+dy)*area.width+b.x;
   for(let dx=0;dx<b.width;dx++)
    area[name][start+dx]=chunk.layers[name][dy][dx];
  }
  return b;
 }
 function clearChunk(area,sx,sy){
  const x=sx*SIZE,y=sy*SIZE;
  if(x>=area.width||y>=area.height)return;
  for(const name of LAYERS)for(let py=y;py<Math.min(y+SIZE,area.height);py++)
   area[name].fill(null,py*area.width+x,
    py*area.width+Math.min(x+SIZE,area.width));
 }
 function makeSession({manifest,loadChunk,onChange=()=>{},maxCached=MAX_CACHED,
  maxParallel=MAX_PARALLEL}={}){
  if(typeof loadChunk!=='function'||typeof onChange!=='function'||
    !integer(maxCached)||maxCached<9||maxCached>64||
    !integer(maxParallel)||maxParallel<1||maxParallel>8)
   throw Error('Invalid sector cache settings');
  const area=makeArea(manifest),loaded=new Map(),pending=new Map();
  let closed=false,focus={sx:0,sy:0},lastFailure=null,pipe=Promise.resolve();
  function ordered(coords){
   const selected=new Map(),maxX=Math.ceil(area.width/SIZE),maxY=Math.ceil(area.height/SIZE);
   for(const s of coords||[]){
    const sx=Number(s.sx),sy=Number(s.sy);
    if(!integer(sx)||!integer(sy)||sx<0||sy<0||sx>=maxX||sy>=maxY)continue;
    selected.set(key(sx,sy),{sx,sy});
   }
   return [...selected.values()].sort((a,b)=>{
    const da=Math.max(Math.abs(a.sx-focus.sx),Math.abs(a.sy-focus.sy));
    const db=Math.max(Math.abs(b.sx-focus.sx),Math.abs(b.sy-focus.sy));
    return da-db||Math.abs(a.sx-focus.sx)+Math.abs(a.sy-focus.sy)-
      Math.abs(b.sx-focus.sx)-Math.abs(b.sy-focus.sy)||a.sy-b.sy||a.sx-b.sx;
   });
  }
  function trim(){
   if(loaded.size<=maxCached)return;
   const victims=[...loaded].sort(([a],[b])=>{
    const [ax,ay]=a.split(',').map(Number),[bx,by]=b.split(',').map(Number);
    const da=Math.max(Math.abs(ax-focus.sx),Math.abs(ay-focus.sy));
    const db=Math.max(Math.abs(bx-focus.sx),Math.abs(by-focus.sy));
    return db-da||a.localeCompare(b);
   });
   for(const [name] of victims){
    if(loaded.size<=maxCached)break;
    const [sx,sy]=name.split(',').map(Number);
    if(Math.max(Math.abs(sx-focus.sx),Math.abs(sy-focus.sy))<=1)continue;
    clearChunk(area,sx,sy);loaded.delete(name);
   }
  }
  async function get(sx,sy){
   if(closed)return false;
   const id=key(sx,sy);
   if(loaded.has(id)){loaded.delete(id);loaded.set(id,true);return true;}
   if(pending.has(id))return pending.get(id);
   const operation=(async()=>{
    try{
     const chunk=await loadChunk(area.area_id,sx,sy);
     if(closed)return false;
     checkChunk(area,chunk);
     writeChunk(area,chunk);loaded.set(id,true);lastFailure=null;
     trim();onChange(area,{sx,sy});
     return true;
    }catch(error){
     lastFailure=error;throw error;
    }finally{pending.delete(id);}
   })();
   pending.set(id,operation);
   return operation;
  }
  function around(x,y,radius=1){
   if(!integer(x)||!integer(y)||x<0||y<0||
    x>=area.width||y>=area.height||!integer(radius)||
    radius<0||radius>2)throw Error('Invalid terrain prefetch position');
   const sx=Math.floor(x/SIZE),sy=Math.floor(y/SIZE);
   focus={sx,sy};
   const coords=[];
   for(let yy=sy-radius;yy<=sy+radius;yy++)
    for(let xx=sx-radius;xx<=sx+radius;xx++)coords.push({sx:xx,sy:yy});
   return ordered(coords);
  }
  function prefetch(coords){
   const desired=ordered(coords);
   const batch=async()=>{
    let next=0,failed=0;
    const workers=Array.from({length:Math.min(maxParallel,desired.length)},async()=>{
     while(!closed&&next<desired.length){
      const {sx,sy}=desired[next++];
      try{await get(sx,sy);}catch(_){failed++;}
     }
    });
    await Promise.all(workers);
    return {requested:desired.length,failed,loaded:loaded.size};
   };
   // One per-session queue keeps request volume bounded even if the player
   // holds RMB across several sector boundaries before a previous prefetch ends.
   const result=pipe.then(batch,batch);
   pipe=result.catch(()=>{});
   return result;
  }
  async function prime(x,y){
   const first=around(x,y,1),result=await prefetch(first);
   // Do not silently show incorrect walkable terrain when startup chunks failed.
   if(result.failed||result.loaded<first.length)
    throw(lastFailure||Error('Initial terrain sectors unavailable'));
   return area;
  }
  function setFocus(x,y){return around(x,y,1);}
  function has(x,y){
   if(!integer(x)||!integer(y)||x<0||y<0||x>=area.width||y>=area.height)return false;
   return loaded.has(key(Math.floor(x/SIZE),Math.floor(y/SIZE)));
  }
  function stats(){return {area_id:area.area_id,loaded:loaded.size,
    pending:pending.size,closed,last_failure:lastFailure?.message||null,
    sectors_x:Math.ceil(area.width/SIZE),sectors_y:Math.ceil(area.height/SIZE)};}
  function close(){closed=true;loaded.clear();pending.clear();}
  return {area,prime,prefetch,around,setFocus,has,stats,close};
 }
 return {SIZE,LAYERS,MAX_CACHED,makeArea,checkChunk,writeChunk,
  clearChunk,makeSession};
});