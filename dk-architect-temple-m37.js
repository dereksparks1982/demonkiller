/* M37: turn the existing temple Architect button into a bottom tool dock.
 * The underlying DK Architect tools and palettes remain the actual editors.
 */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const edit=$('editMode'),walk=$('walkMode'),old=$('architectWindow');
if(!edit||!walk||!old||!$('uoPaletteViewport'))return;
const dock=document.createElement('section');
dock.id='dkArchitectDock';dock.hidden=true;
dock.setAttribute('aria-label','DK Architect construction tools');
dock.innerHTML='<div class="dk-dock-head"><strong>DK ARCHITECT · CONSTRUCTION</strong>'+
 '<small>SELECT A CATEGORY BELOW · PLACE DIRECTLY ON THE GRID</small>'+
 '<button type="button" id="dkBuildFinish">RETURN TO WALKING · F8</button></div>'+
 '<div id="dkBuildActions" class="dk-dock-actions" aria-label="Building tools"></div>'+
 '<div id="dkBuildPalette" class="dk-dock-palette" aria-label="Available building sprites"></div>'+
 '<nav id="dkBuildTabs" class="dk-dock-tabs" aria-label="Construction categories"></nav>'+
 '<div class="dk-dock-footer" id="dkBuildStatus">LIVE TEMPLE GRID · 32 PX TILES · RIGHT-DRAG PANS IN ARCHITECT MODE</div>';
document.body.append(dock);
const groups=[
 {id:'foundations',icon:'▦',label:'FOUNDATIONS',category:'walls',
  actions:[['WALL BRUSH','uoWallBrush'],['STRAIGHT RUN','wallLineButton'],['ROOM OUTLINE','uoRoom'],['REMOVE WALL','wallEraseButton']]},
 {id:'materials',icon:'▤',label:'MATERIALS',category:'floors',
  actions:[['PAINT FLOOR','uoFloor'],['FILL REGION','tool:fill'],['RECTANGLE','tool:rectangle']]},
 {id:'rooms',icon:'▣',label:'ROOMS',category:'structure',
  actions:[['PLACE DOOR','tool:door'],['OUTLINE ROOM','uoRoom'],['PLACE STRUCTURE','uoPlace']]},
 {id:'objects',icon:'◇',label:'OBJECTS',category:'furniture',
  actions:[['SELECT','uoSelect'],['PLACE','uoPlace'],['MOVE','uoMove'],['ROTATE','uoRotate'],['COPY','uoCopy'],['DELETE','uoDelete']]},
 {id:'staff',icon:'♙',label:'STAFF',category:'npcs',
  actions:[['PLACE NPC / ACTOR','uoPlace'],['SELECT','uoSelect'],['MOVE','uoMove']]},
 {id:'utilities',icon:'✣',label:'UTILITIES',category:'relics',
  actions:[['PLACE RELIC','uoPlace'],['ROTATE','uoRotate'],['ERASE','uoDelete']]},
 {id:'deployment',icon:'⚑',label:'DEPLOYMENT',category:'library',
  actions:[['PLAYER SPAWN','tool:spawn'],['PLACE ORIGINAL SPRITE','uoPlace']]},
 {id:'logistics',icon:'▥',label:'LOGISTICS',category:'items',
  actions:[['PLACE EQUIPMENT','uoPlace'],['PICK TILE','uoPick'],['SAVE ROOM','save'],['EXPORT JSON','export']]},
 {id:'intelligence',icon:'⌁',label:'INTELLIGENCE',category:null,
  actions:[['CHECK ACCESS','uoInspect'],['PICK EXISTING','uoPick']]},
 {id:'emergencies',icon:'⚠',label:'EMERGENCIES',category:'npcs',
  actions:[['STAGE ENEMY ACTOR','uoPlace'],['REMOVE STAGED ACTOR','uoDelete']]},
 {id:'clone',icon:'▧',label:'CLONE',category:null,
  actions:[['COPY OBJECT','uoCopy'],['PASTE OBJECT','inspectorPaste'],['DUPLICATE','duplicate']]},
 {id:'planning',icon:'⌕',label:'PLANNING',category:null,
  actions:[['SELECT','uoSelect'],['CHECK ACCESS','uoInspect'],['UNDO','uoUndo'],['REDO','uoRedo'],['EXPORT JSON','export']]}
];
const tabs=$('dkBuildTabs'),actions=$('dkBuildActions'),palette=$('dkBuildPalette');
let current='foundations';
const originalViewport=$('uoPaletteViewport');
palette.append(originalViewport); // original palette retains its existing click handlers
function status(msg){$('dkBuildStatus').textContent=msg;}
function trigger(name){
 if(name.startsWith('tool:')){
  const field=$('tool');field.value=name.slice(5);
  field.dispatchEvent(new Event('change',{bubbles:true}));return;
 }
 const button=$(name);
 if(button){button.click();return;}
 status('Tool '+name+' unavailable in this room.');
}
function selectCategory(name){
 const group=groups.find(x=>x.id===name);if(!group)return;
 current=name;
 for(const btn of tabs.children)btn.setAttribute('aria-selected',String(btn.dataset.category===name));
 actions.replaceChildren();
 if(group.category){
  const control=$('category');
  control.value=group.category;
  control.dispatchEvent(new Event('change',{bubbles:true}));
 }
 for(const [label,action] of group.actions){
  const button=document.createElement('button');
  button.type='button';button.textContent=label;button.dataset.action=action;
  button.addEventListener('click',()=>{trigger(action);status(label+' selected. Click the map to use it.');});
  actions.append(button);
 }
 const usePalette=group.category!==null&&group.id!=='planning';
 palette.hidden=!usePalette;
 status(group.label+' · choose a tool above, then work on the temple grid.');
}
for(const category of groups){
 const button=document.createElement('button');button.className='dk-dock-tab';
 button.type='button';button.dataset.category=category.id;
 button.innerHTML='<span aria-hidden="true">'+category.icon+'</span>'+category.label;
 button.setAttribute('aria-selected','false');
 button.addEventListener('click',()=>selectCategory(category.id));
 tabs.append(button);
}
function sync(open){
 dock.hidden=!open;
 document.body.classList.toggle('dk-architect-v37',open);
 old.hidden=true;
 if(open)selectCategory(current);
}
edit.addEventListener('click',()=>sync(true));
walk.addEventListener('click',()=>sync(false));
$('dkBuildFinish').addEventListener('click',()=>walk.click());
document.addEventListener('keydown',event=>{
 if(event.key!=='F8'||event.repeat||event.ctrlKey||event.altKey||event.metaKey)return;
 event.preventDefault();event.stopImmediatePropagation();
 (dock.hidden?edit:walk).click();
},true);
// Existing toolbar close controls still terminate edit mode.
$('architectClose')?.addEventListener('click',()=>sync(false));
sync(false);
})();
