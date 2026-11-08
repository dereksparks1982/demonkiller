/* M38: one Prison Architect-style construction menu in temple and outdoor game.
 * Bottom category icons open fly-out menus ABOVE the bar. No second map/iframe.
 */
(function(){
'use strict';
const CATEGORIES=[
 ['foundations','▦','FOUNDATIONS',[['move_building','MOVE WHOLE BUILDING','▣'],['draw_wall','BUILD WALL','▥'],['erase_wall','DEMOLISH WALL','⌫'],['wall_line','STRAIGHT WALL','▬'],['room_outline','BUILD ROOM OUTLINE','▢']]],
 ['materials','▧','MATERIALS',[['paint_path','STONE PATH','◫'],['paint_grass','GRASS','♣'],['paint_dirt','DIRT','░'],['paint_garden','GARDEN','♧'],['paint_stone','STONE FLOOR','▤'],['brush_rect','RECTANGLE BRUSH','□']]],
 ['rooms','▣','ROOMS',[['place_door','INSTALL / MOVE DOOR','▥'],['erase_door','REMOVE DOOR','⌫'],['room_outline','ROOM WALLS','▢'],['inspect','INSPECT ROOM','⌕']]],
 ['objects','◇','OBJECTS',[['select','SELECT','⌖'],['move_object','MOVE OBJECT','✥'],['place_object','PLACE OBJECT','◈'],['rotate_object','ROTATE OBJECT','↻'],['erase_object','DELETE OBJECT','⌫']]],
 ['staff','♟','STAFF',[['place_npc','PLACE ACTOR','♟'],['select','SELECT','⌖'],['inspect','INSPECT','⌕']]],
 ['utilities','⚙','UTILITIES',[['move_fixture','MOVE FIXTURE','✥'],['place_fixture','PLACE FIXTURE','◈'],['inspect','INSPECT','⌕']]],
 ['deployment','⚑','DEPLOYMENT',[['spawn','PLAYER SPAWN','⚑'],['place_object','PLACE SPRITE','◈'],['select','SELECT','⌖']]],
 ['logistics','▤','LOGISTICS',[['export','EXPORT MAP JSON','⇩'],['save','SAVE LAYOUT','▣'],['undo','UNDO','↶'],['redo','REDO','↷']]],
 ['intelligence','⌕','INTELLIGENCE',[['inspect','INSPECT OBJECT','⌕'],['select','SELECT','⌖']]],
 ['emergencies','⚠','EMERGENCIES',[['place_npc','STAGE ACTOR','♟'],['erase_object','REMOVE ACTOR','⌫']]],
 ['clone','▥','CLONE',[['copy','COPY','▣'],['paste','PASTE','▧'],['duplicate','DUPLICATE','⊞']]],
 ['planning','▱','PLANNING',[['select','SELECT','⌖'],['move_building','MOVE BUILDING','▣'],['brush_rect','RECTANGLE','□'],['export','EXPORT JSON','⇩']]]
];
function create({onTool,onCategory,onClose,available,palette}){
 const root=document.createElement('section');
 root.className='dk-pa-menu';root.hidden=true;
 root.setAttribute('aria-label','DK Architect Prison Architect-style construction menu');
 root.innerHTML='<div class="dk-pa-flyout" id="dkPaFlyout" hidden>'+
  '<div class="dk-pa-flyout-head"><strong id="dkPaCategory">FOUNDATIONS</strong><button id="dkPaDismiss" type="button" aria-label="Close category menu">×</button></div>'+
  '<div id="dkPaTools" class="dk-pa-tool-grid" role="group" aria-label="Construction commands"></div>'+
  '<div id="dkPaPalette" class="dk-pa-palette" hidden></div>'+
  '<small class="dk-pa-help" id="dkPaHelp">Choose a construction tool.</small></div>'+
  '<div class="dk-pa-bottom"><span class="dk-pa-brand">DK<br>ARCHITECT</span>'+
  '<nav id="dkPaCategories" aria-label="Construction categories"></nav>'+
  '<button class="dk-pa-done" id="dkPaDone" type="button" title="Exit Architect mode">DONE<br>F8</button></div>';
 document.body.append(root);
 const nav=root.querySelector('#dkPaCategories'),
  flyout=root.querySelector('#dkPaFlyout'),tools=root.querySelector('#dkPaTools'),
  paletteHost=root.querySelector('#dkPaPalette'),help=root.querySelector('#dkPaHelp');
 let active=null,selectedTool=null;
 if(palette)paletteHost.append(palette);
 function say(s){help.textContent=s;}
 function choose(id){
  const category=CATEGORIES.find(c=>c[0]===id);if(!category)return;
  if(active===id&&!flyout.hidden){flyout.hidden=true;active=null;
   nav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed','false'));return;}
  active=id;flyout.hidden=false;
  root.querySelector('#dkPaCategory').textContent=category[2];
  nav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.category===id)));
  tools.replaceChildren();
  const box=nav.querySelector('[data-category="'+id+'"]');
  const rect=box?.getBoundingClientRect();
  // Keep flyout attached to the chosen category, but never off-screen.
  const maxWidth=Math.min(480,Math.max(270,window.innerWidth-16));
  const left=Math.max(8,Math.min(window.innerWidth-maxWidth-8,rect?.left||8));
  flyout.style.left=left+'px';flyout.style.width=maxWidth+'px';
  for(const [key,label,icon]of category[3]){
   const button=document.createElement('button');button.type='button';
   button.className='dk-pa-tool';button.dataset.tool=key;
   button.innerHTML='<span aria-hidden="true">'+icon+'</span><strong>'+label+'</strong>';
   const yes=available(key);
   button.disabled=!yes;
   if(!yes)button.title='This command is not available in this region yet';
   button.setAttribute('aria-pressed',String(key===selectedTool));
   button.addEventListener('click',()=>{
    if(!available(key))return;
    selectedTool=key;
    tools.querySelectorAll('button').forEach(b=>
     b.setAttribute('aria-pressed',String(b.dataset.tool===key)));
    onTool(key,id,say);
   });
   tools.append(button);
  }
  const hasPalette=!!palette&&onCategory?.(id,paletteHost)!==false;
  paletteHost.hidden=!hasPalette;
  say('Choose a tool, then click or drag on the game map. Right-drag pans outdoors.');
 }
 for(const [key,icon,label]of CATEGORIES){
  const b=document.createElement('button');b.type='button';
  b.className='dk-pa-category';b.dataset.category=key;
  b.innerHTML='<span class="dk-pa-icon" aria-hidden="true">'+icon+'</span>'+
   '<span class="dk-pa-label">'+label+'</span>';
  b.setAttribute('aria-pressed','false');
  b.addEventListener('click',()=>choose(key));
  nav.append(b);
 }
 root.querySelector('#dkPaDismiss').addEventListener('click',()=>choose(active));
 root.querySelector('#dkPaDone').addEventListener('click',()=>onClose());
 function open(){root.hidden=false;choose('foundations');}
 function close(){root.hidden=true;flyout.hidden=true;active=null;selectedTool=null;}
 return Object.freeze({root,open,close,choose,say,
  get active(){return active;},get visible(){return !root.hidden;}});
}
window.DKArchitectMenus=Object.freeze({create,CATEGORIES});
})();
