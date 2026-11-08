/* M37: local browser drafts for the static GitHub Pages preview.
 * The preview is NOT DK Server and never claims authoritative persistence.
 * It stores only edited layout drafts for JSON export and visual review.
 */
(()=>{
'use strict';
if(window.DemonKillerServer)return;
const R=window.DemonKillerRegions,GEOMETRY=window.DKExteriorGeometry;
if(!R)return;
const KEY='dkSoftworks.demonkiller.architect.outdoorDraft.m37.';
const allowed=new Set([R.COURT,R.VILLAGE]);
const building=new Set(['house','bank','bakery','smithy','tavern']);
const fixture=new Set(['well','stall']);
const ground=new Set(['grass','path','dirt','garden','stone','dark','cracked','sigil']);
const layerKeys=['floor','walls','wallStyles','wallVariants','wallPacks','wallRotations','floorArt'];
const blank={floor:'grass',walls:0,wallStyles:'clean',wallVariants:null,
 wallPacks:'ox72i',wallRotations:0,floorArt:null};
const clone=v=>JSON.parse(JSON.stringify(v));
const pos=(a,x,y)=>y*a.width+x;
const safe=(a,x,y)=>Number.isInteger(x)&&Number.isInteger(y)&&
 x>0&&y>0&&x<a.width-1&&y<a.height-1;
const footprint=o=>({x:o.x,y:o.y,w:o.w||1,h:o.h||1});
const overlaps=(a,b)=>a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h;
function read(id){
 if(!allowed.has(id))throw Error('Unknown region');
 try{
  const stored=JSON.parse(localStorage.getItem(KEY+id)||'null');
  if(stored&&Number.isSafeInteger(stored.revision)&&stored.revision>=0&&
   R.checkRegion(stored.area).area_id===id)return stored;
 }catch(_){}
 return {revision:0,area:R.templates[id]()};
}
function store(id,record){
 try{localStorage.setItem(KEY+id,JSON.stringify(record));}
 catch(e){throw Error('Browser storage is unavailable: export the layout before closing.');}
}
function getObject(area,object_id,kinds){
 const o=area.objects.find(x=>x.id===object_id);
 if(!o||!kinds.has(o.type))throw Error('Object is protected or not found');
 return o;
}
function doorOutside(area,o,x,y){
 const w=o.w||1,h=o.h||1;
 if(x===o.x&&y===o.y||x===o.x+w-1&&y===o.y||
    x===o.x&&y===o.y+h-1||x===o.x+w-1&&y===o.y+h-1)
  throw Error('Door cannot occupy a corner');
 let ox=x,oy=y;
 if(x===o.x)ox--;
 else if(x===o.x+w-1)ox++;
 else if(y===o.y)oy--;
 else if(y===o.y+h-1)oy++;
 else throw Error('Door must occupy outer wall');
 if(!safe(area,ox,oy)||area.walls[pos(area,ox,oy)]||
    area.floor[pos(area,ox,oy)]==='roof'||
    area.objects.some(z=>z.id!==o.id&&overlaps(footprint(z),{x:ox,y:oy,w:1,h:1})))
  throw Error('Door needs a clear exterior tile');
}
function apply(area,action,fields){
 const {x,y,object_id}=fields;
 if(action==='move_building'){
  GEOMETRY.move(area,object_id,x,y);
 }else if(['place_prop','move_prop','rotate_prop','remove_prop'].includes(action)){
  GEOMETRY.propEdit(area,action,fields);
 }else if(action==='move_fixture'){
  const o=getObject(area,object_id,fixture);
  if(!safe(area,x,y)||area.walls[pos(area,x,y)]||
     !ground.has(area.floor[pos(area,x,y)])||
     area.objects.some(other=>other.id!==o.id&&overlaps(footprint(other),{x,y,w:1,h:1})))
   throw Error('Fixture move is blocked');
  o.x=x;o.y=y;
 }else if(action==='set_door'||action==='remove_door'){
  const o=getObject(area,object_id,building);
  if(action==='remove_door'){
   if(!o.door)throw Error('No door to remove');
   area.walls[pos(area,o.door.x,o.door.y)]=1;o.door=null;
  }else{
   if(!Number.isInteger(x)||!Number.isInteger(y))throw Error('Invalid door tile');
   doorOutside(area,o,x,y);
   if(o.door)area.walls[pos(area,o.door.x,o.door.y)]=1;
   o.door={x,y};area.walls[pos(area,x,y)]=0;
  }
 }else if(action==='restore_tiles'){
  GEOMETRY.restoreTiles(area,fields.tiles);
 }else if(action==='set_spawn'){
  GEOMETRY.setSpawn(area,x,y);
 }else if(action==='wall_batch'){
  GEOMETRY.wallBatch(area,fields.tiles,fields.erase,fields);
 }else if(['paint_wall','erase_wall','wall_line','room_outline'].includes(action)){
  GEOMETRY.wallEdit(area,action,fields);
 }else if(action==='paint_ground'||action==='paint_rectangle'){
  const w=action==='paint_ground'?1:fields.w,h=action==='paint_ground'?1:fields.h;
  if(!safe(area,x,y)||!Number.isInteger(w)||!Number.isInteger(h)||
   w<1||h<1||w*h>256||!safe(area,x+w-1,y+h-1)||!ground.has(fields.floor))
   throw Error('Invalid ground selection');
  let count=0;
  for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++){
   const i=pos(area,xx,yy);
   if(area.walls[i]||area.floor[i]==='roof'||area.objects.some(o=>
    overlaps(footprint(o),{x:xx,y:yy,w:1,h:1})))continue;
   if(fields.floorArt){
    const art=window.DKArchitectDungeon?.entries?.[fields.floorArt];
    if(!art||art.category!=='floor')throw Error('Unapproved floor artwork');
   }
   area.floor[i]=fields.floor;area.floorArt[i]=fields.floorArt||null;count++;
  }
  if(!count)throw Error('No editable ground found');
 }else throw Error('Unsupported editor operation');
}
window.DKArchitectPreviewActive=true;
window.DemonKillerServer=Object.freeze({
 async area(id){const p=read(id);return {area:clone(p.area),revision:p.revision};},
 async exportOutdoor(id){
  const p=read(id);
  return {format:'dk.outdoor.layout.m36',area_id:id,world_revision:p.revision,map:clone(p.area),
   preview_draft:true};
 },
 async previewOutdoor(action,area_id,fields={}){
  const prior=read(area_id),copy=clone(prior.area);
  try{
   if(action==='move_building'){
    GEOMETRY.test(copy,fields.object_id,fields.x,fields.y);
   }else apply(copy,action,fields);
   return {ok:true};
  }catch(error){return {ok:false,error:error.message};}
 },
 async editOutdoor(action,area_id,expected_revision,fields={}){
  const prior=read(area_id);
  if(prior.revision!==expected_revision)throw Error('Stale exterior revision; reload draft');
  const working=clone(prior.area);
  apply(working,action,fields);
  R.checkRegion(working);
  const next={revision:prior.revision+1,area:working};
  store(area_id,next);return {revision:next.revision,area_id};
 }
});
})();
