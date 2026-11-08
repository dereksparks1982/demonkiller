/* DK Architect M39 temple map adapter. All menu state, tool naming, assets
 * and rotations come from the same DKArchitectCore used in the outdoor world.
 * Temple geometry, opening and old character save remain authoritative.
 */
(function(){
'use strict';
const $=id=>document.getElementById(id),menus=window.DKArchitectMenus;
const Core=window.DKArchitectCore;
const button=$('editMode'),walk=$('walkMode');
if(!menus||!Core||!button||!walk||!$('architectWindow'))return;
const aliases={
 draw_wall:'uoWallBrush',erase_wall:'wallEraseButton',
 wall_line:'wallLineButton',room_outline:'uoRoom',
 paint_stone:'uoFloor',paint_path:'uoFloor',paint_grass:'uoFloor',
 paint_dirt:'uoFloor',paint_garden:'uoFloor',brush_rect:'tool:rectangle',
 place_object:'uoPlace',select:'uoSelect',move_object:'uoMove',
 move_building:'uoMove',rotate_object:'uoRotate',erase_object:'uoDelete',
 inspect:'uoInspect',copy:'uoCopy',paste:'inspectorPaste',duplicate:'duplicate',
 undo:'uoUndo',redo:'uoRedo',export:'export',save:'save',
 place_npc:'uoPlace',place_fixture:'uoPlace',move_fixture:'uoMove',
 spawn:'tool:spawn',place_door:'tool:door',erase_door:'tool:door'
};
const assetGroup={foundations:'walls',materials:'floors',rooms:'structure',
 objects:'furniture',staff:'npcs',utilities:'relics',deployment:'library',
 logistics:'items',emergencies:'npcs'};
const using={open:false};
function existingTool(name){return name.startsWith('tool:')?
 Array.from($('tool').options).some(o=>o.value===name.slice(5)):
 Boolean($(name));}
function selectLegacy(name){
 if(!existingTool(name))throw Error('Temple tool unavailable: '+name);
 if(name.startsWith('tool:')){
  const field=$('tool');field.value=name.slice(5);
  field.dispatchEvent(new Event('change',{bubbles:true}));return;
 }
 $(name).click();
}
function setCategory(value){
 if(!value)return;
 const field=$('category');if(!field||field.value===value)return;
 field.value=value;field.dispatchEvent(new Event('change',{bubbles:true}));
}
function selectOldAsset(asset){
 if(!asset)return;
 setCategory(asset.category);
 const query=$('assetSearch');
 if(query){query.value='';query.dispatchEvent(new Event('input',{bubbles:true}));}
 const buttons=$('palette')?.querySelectorAll('[data-asset-id]')||[];
 const target=Array.from(buttons).find(b=>b.dataset.assetId===asset.id);
 if(!target)throw Error('Approved asset missing from temple palette: '+asset.id);
 target.click();
}
const core=Core.create({
 available:key=>Boolean(aliases[key]&&existingTool(aliases[key])),
 category:group=>{if(group)setCategory(group);},
 execute:(action,state)=>{
  if(action==='activate_tool'){
   selectLegacy(aliases[state.tool]);return;
  }
  if(action==='select_asset'){selectOldAsset(state.asset);return;}
  if(action==='rotate_preview'){
   // The approved temple editor handles mouse-wheel preview rotation natively.
   return;
  }
  if(aliases[action])selectLegacy(aliases[action]);
 }
});
const menu=menus.create({core,onClose:()=>walk.click()});
function sync(open){
 using.open=open;
 $('architectWindow').hidden=true;
 menu[open?'open':'close']();
 document.body.classList.toggle('dk-pa-building',open);
 if(open)$('room')?.focus({preventScroll:true});
}
button.addEventListener('click',()=>sync(true));
walk.addEventListener('click',()=>sync(false));
$('architectClose')?.addEventListener('click',()=>sync(false));
document.addEventListener('keydown',e=>{
 if(e.key!=='F8'||e.repeat||e.ctrlKey||e.altKey||e.metaKey)return;
 e.preventDefault();e.stopImmediatePropagation();
 (using.open?walk:button).click();
},true);
// The SAME drag-to-move gesture now works in the temple too. Existing
// temple undo/history and 32px placement collision remain authoritative.
const room=$('room');let dragging=null,suppressClick=false;
function pointerTile(e){
 const bounds=room.getBoundingClientRect();
 if(!bounds.width||!bounds.height)return null;
 const x=Math.floor((e.clientX-bounds.left)/bounds.width*16),
  y=Math.floor((e.clientY-bounds.top)/bounds.height*16);
 return x>=0&&x<16&&y>=0&&y<16?{x,y}:null;
}
room.addEventListener('pointerdown',e=>{
 if(!using.open||e.button!==0||
  !['move_object','move_building'].includes(core.state().tool))return;
 const p=pointerTile(e),obj=p&&window.DKTempleArchitectBridge?.hit(p.x,p.y);
 if(!obj)return;
 dragging={id:obj.id,start:p,origin:{x:obj.x,y:obj.y},moved:false,
  last:{x:obj.x,y:obj.y}};
 room.setPointerCapture?.(e.pointerId);
},true);
room.addEventListener('pointermove',e=>{
 if(!dragging||!using.open)return;
 const p=pointerTile(e);if(!p)return;
 const x=dragging.origin.x+p.x-dragging.start.x,
  y=dragging.origin.y+p.y-dragging.start.y;
 if(x===dragging.last.x&&y===dragging.last.y)return;
 dragging.last={x,y};dragging.moved=true;
 const result=window.DKTempleArchitectBridge?.preview(dragging.id,x,y);
 if(result&&!result.ok)menu.say(result.error);
},true);
room.addEventListener('pointerup',e=>{
 if(!dragging)return;
 const move=dragging;dragging=null;
 if(room.hasPointerCapture?.(e.pointerId))room.releasePointerCapture(e.pointerId);
 window.DKTempleArchitectBridge?.cancel();
 if(move.moved){
  suppressClick=true;
  const ok=window.DKTempleArchitectBridge?.move(move.id,move.last.x,move.last.y);
  menu.say(ok?'Moved object in the temple.':'Cannot move there. Position is blocked.');
  setTimeout(()=>{suppressClick=false;},100);
 }
},true);
room.addEventListener('pointercancel',()=>{
 dragging=null;window.DKTempleArchitectBridge?.cancel();
},true);
room.addEventListener('click',e=>{
 if(!suppressClick)return;
 e.preventDefault();e.stopImmediatePropagation();suppressClick=false;
},true);
window.DKArchitectActive=()=>({scene:'temple',open:using.open,tool:core.state().tool,
 category:core.state().category});
sync(false);
})();
