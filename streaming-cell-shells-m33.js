'use strict';
// DK M33: reusable object shells for variable-size Streaming Cells.
// Canvas does not require Godot nodes. These shells cache identity and
// rendering priority, while always referencing authoritative area objects.
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.DKStreamingCellShells=api;
})(typeof window!=='undefined'?window:null,function(){
 const DEFAULT_CAP=256;
 function visibleBounds(o){
  return {x:o.x,y:o.y,w:Math.max(1,o.w||1),h:Math.max(1,o.h||1)};
 }
 function overlap(a,b){
  return a.x<b.x+b.w&&a.x+a.w>b.x&&
   a.y<b.y+b.h&&a.y+a.h>b.y;
 }
 function create({maxShells=DEFAULT_CAP}={}){
  if(!Number.isSafeInteger(maxShells)||maxShells<16||maxShells>1024)
   throw Error('Invalid streaming shell limit');
  const shells=new Map();let serial=0,areaId=null,graph=null;
  let allocations=0,reuses=0,evictions=0;
  function reset(){shells.clear();areaId=null;graph=null;}
  function setCellView(view){
   if(view!==null&&(!view||typeof view.area_id!=='string'||
    !Array.isArray(view.children)))throw Error('Invalid streaming cell view');
   graph=view;
  }
  function shellFor(o,area_id){
   const k=area_id+':'+o.id;
   let shell=shells.get(k);
   if(shell){shell.object=o;reuses++;shell.touched=++serial;return shell;}
   shell={key:k,object:o,cell_id:null,lod:'near',touched:++serial};
   allocations++;shells.set(k,shell);
   if(shells.size>maxShells){
    const oldest=[...shells.values()].sort((a,b)=>a.touched-b.touched)[0];
    if(oldest){shells.delete(oldest.key);evictions++;}
   }
   return shell;
  }
  function visible(area,camera,span=20){
   if(!area||typeof area.area_id!=='string'||!Array.isArray(area.objects)||
    !camera||!Number.isFinite(camera.x)||!Number.isFinite(camera.y)||
    !Number.isFinite(span)||span<1||span>128)
    throw Error('Invalid streaming cell camera');
   if(areaId!==area.area_id){reset();areaId=area.area_id;}
   const scope={x:camera.x-2,y:camera.y-2,w:span+4,h:span+4};
   const onScreen={x:camera.x,y:camera.y,w:span,h:span};
   const structureIds=new Map((graph?.area_id===areaId?graph.children:[])
    .filter(x=>typeof x.object_id==='string').map(x=>[x.object_id,x.id]));
   const result=[];
   for(const o of area.objects){
    if(!overlap(visibleBounds(o),scope))continue;
    const shell=shellFor(o,areaId);
    shell.cell_id=structureIds.get(o.id)||graph?.root?.id||null;
    shell.lod=overlap(visibleBounds(o),onScreen)?'active':'near';
    result.push(shell.object);
   }
   return result;
  }
  function stats(){return{area_id:areaId,loaded:shells.size,allocations,
    reuses,evictions,limit:maxShells,cell_id:graph?.current_cell||null};}
  return {visible,reset,setCellView,stats};
 }
 return {DEFAULT_CAP,visibleBounds,overlap,create};
});