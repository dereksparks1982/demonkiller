/* DK Architect M38: temple uses the SAME Prison Architect menus as outdoors.
 * Keep the existing room painter and original sprite catalogue, not a new engine.
 */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const button=$('editMode'),walk=$('walkMode'),old=$('architectWindow');
if(!window.DKArchitectMenus||!button||!walk||!old)return;
const aliases=Object.freeze({
 draw_wall:'uoWallBrush',erase_wall:'wallEraseButton',wall_line:'wallLineButton',
 room_outline:'uoRoom',paint_stone:'uoFloor',
 place_object:'uoPlace',select:'uoSelect',move_object:'uoMove',
 rotate_object:'uoRotate',erase_object:'uoDelete',
 inspect:'uoInspect',copy:'uoCopy',paste:'inspectorPaste',
 duplicate:'duplicate',undo:'uoUndo',redo:'uoRedo',
 export:'export',save:'save',place_npc:'uoPlace',
 spawn:'tool:spawn',brush_rect:'tool:rectangle',
 place_door:'tool:door',erase_door:'tool:door'
});
const categories=Object.freeze({
 foundations:'walls',materials:'floors',rooms:'structure',objects:'furniture',
 staff:'npcs',utilities:'relics',deployment:'library',logistics:'items',
 emergencies:'npcs',clone:null,intelligence:null,planning:null
});
const available=key=>Boolean(aliases[key]&&
 (aliases[key].startsWith('tool:')||$(aliases[key])));
const palette=$('uoPaletteViewport');
const menu=window.DKArchitectMenus.create({
 palette,
 available,
 onCategory:(id)=>{
  const next=categories[id];if(!next)return false;
  const field=$('category');field.value=next;
  field.dispatchEvent(new Event('change',{bubbles:true}));
  return true;
 },
 onTool:(key,category,say)=>{
  const action=aliases[key];if(!action)return;
  if(action.startsWith('tool:')){
   const field=$('tool');field.value=action.slice(5);
   field.dispatchEvent(new Event('change',{bubbles:true}));
  }else $(action).click();
  say(key.replaceAll('_',' ').toUpperCase()+' · click the live temple grid to apply.');
 },
 onClose:()=>walk.click()
});
const refresh=visible=>{
 old.hidden=true;
 menu[visible?'open':'close']();
 document.body.classList.toggle('dk-pa-building',visible);
 if(visible)$('room')?.focus({preventScroll:true});
};
button.addEventListener('click',()=>refresh(true));
walk.addEventListener('click',()=>refresh(false));
$('architectClose')?.addEventListener('click',()=>refresh(false));
document.addEventListener('keydown',e=>{
 if(e.key!=='F8'||e.repeat||e.ctrlKey||e.altKey||e.metaKey)return;
 e.preventDefault();e.stopImmediatePropagation();
 (menu.visible?walk:button).click();
},true);
refresh(false);
})();
