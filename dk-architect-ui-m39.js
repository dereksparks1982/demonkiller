/* DK Architect M39: one build-menu renderer in every world region.
 * Follows the same prototype-driven category/mode architecture in each scene.
 */
(function(root){
'use strict';
const CATEGORIES=[
 ['foundations','▦','FOUNDATIONS',[['move_building','MOVE WHOLE BUILDING','▣'],['draw_wall','BUILD WALL','▥'],['erase_wall','DEMOLISH WALL','⌫'],['wall_line','STRAIGHT WALL','▬'],['room_outline','BUILD ROOM OUTLINE','▢']]],
 ['terrain','▲','LANDSCAPE',[
  ['terrain_ocean','OCEAN','≈'],['terrain_river','RIVER','≋'],
  ['terrain_mountain','MOUNTAIN / CLIFF','▲'],['terrain_rock','ROCK','◆'],
  ['terrain_grass','GRASS','♣'],['terrain_forest','FOREST','♠'],
  ['terrain_marsh','MARSH','♧'],['terrain_beach','BEACH','▤'],
  ['terrain_raise','RAISE LAND','↑'],['terrain_lower','LOWER LAND','↓'],
  ['terrain_smooth','SMOOTH SLOPES','∿'],['terrain_flatten','FLATTEN','▬']]],
 ['materials','▧','MATERIALS',[['paint_path','STONE PATH','◫'],['paint_grass','GRASS','♣'],['paint_dirt','DIRT','░'],['paint_garden','GARDEN','♧'],['paint_stone','STONE FLOOR','▤'],['brush_rect','RECTANGLE BRUSH','□']]],
 ['rooms','▣','ROOMS',[['place_door','INSTALL / MOVE DOOR','▥'],['erase_door','REMOVE DOOR','⌫'],['room_outline','ROOM WALLS','▢'],['inspect','INSPECT ROOM','⌕']]],
 ['objects','◇','OBJECTS',[['select','SELECT','⌖'],['move_object','MOVE OBJECT','✥'],['place_object','PLACE OBJECT','◈'],['rotate_object','ROTATE OBJECT','↻'],['erase_object','DELETE OBJECT','⌫']]],
 ['staff','♟','STAFF',[['place_npc','PLACE ACTOR','♟'],['select','SELECT','⌖'],['inspect','INSPECT','⌕']]],
 ['utilities','⚙','UTILITIES',[['move_fixture','MOVE FIXTURE','✥'],['place_fixture','PLACE FIXTURE','◈'],['inspect','INSPECT','⌕']]],
 ['deployment','⚑','DEPLOYMENT',[['spawn','PLAYER SPAWN','⚑'],['place_object','PLACE SPRITE','◈'],['select','SELECT','⌖']]],
 ['logistics','▤','LOGISTICS',[['export','EXPORT AREA JSON','⇩'],['export_world','EXPORT SERVER TERRAIN','⇩'],['save','SAVE LAYOUT','▣'],['undo','UNDO','↶'],['redo','REDO','↷']]],
 ['intelligence','⌕','INTELLIGENCE',[['inspect','INSPECT OBJECT','⌕'],['select','SELECT','⌖']]],
 ['emergencies','⚠','EMERGENCIES',[['place_npc','STAGE ACTOR','♟'],['erase_object','REMOVE ACTOR','⌫']]],
 ['clone','▥','CLONE',[['copy','COPY','▣'],['paste','PASTE','▧'],['duplicate','DUPLICATE','⊞']]],
 ['planning','▱','PLANNING',[['select','SELECT','⌖'],['move_building','MOVE BUILDING','▣'],['brush_rect','RECTANGLE','□'],['export','EXPORT JSON','⇩']]]
];

function create({core,onTool,onCategory,onAsset,onClose,available}){
 const model=core;
 if(!model||!root.DKArchitectCatalog)throw Error('DK Architect model and catalogue must load first');
 const panel=document.createElement('section');panel.className='dk-pa-menu';panel.hidden=true;
 panel.setAttribute('aria-label','DK Architect construction menus');
 panel.innerHTML='<div class="dk-pa-flyout" id="dkPaFlyout" hidden>'+
  '<div class="dk-pa-flyout-head"><strong id="dkPaCategory"></strong>'+
  '<button id="dkPaDismiss" type="button" aria-label="Close construction menu">×</button></div>'+
  '<div id="dkPaTools" class="dk-pa-tool-grid" role="group" aria-label="Construction tools"></div>'+
  '<div class="dk-pa-palette" id="dkPaPalette">'+
  '<label class="dk-pa-search">CONSTRUCTION CATALOG <input id="dkPaSearch" type="search" autocomplete="off" placeholder="Search approved art and tiles"></label>'+
  '<div id="dkPaAssetCards" class="dk-pa-assets" aria-label="Approved buildable assets"></div>'+
  '<button type="button" id="dkPaMore" hidden>SHOW MORE ASSETS</button></div>'+
  '<small class="dk-pa-help" id="dkPaHelp">Choose a tool, then click the map.</small></div>'+
  '<div class="dk-pa-bottom"><span class="dk-pa-brand">DK<br>ARCHITECT</span>'+
  '<nav id="dkPaCategories" aria-label="Construction categories"></nav>'+
  '<button class="dk-pa-done" id="dkPaDone" type="button">DONE<br>F8</button></div>';
 document.body.append(panel);
 const nav=panel.querySelector('#dkPaCategories'),flyout=panel.querySelector('#dkPaFlyout');
 const tools=panel.querySelector('#dkPaTools'),help=panel.querySelector('#dkPaHelp');
 const cards=panel.querySelector('#dkPaAssetCards'),search=panel.querySelector('#dkPaSearch');
 const more=panel.querySelector('#dkPaMore'),palette=panel.querySelector('#dkPaPalette');
 let active=null,limit=48,selected=null;
 const say=message=>{help.textContent=message;};
 function drawAssets(){
  cards.replaceChildren();
  if(!active)return;
  const assets=model.assets(active,search.value);const list=assets.slice(0,limit);
  for(const asset of list){
   const b=document.createElement('button');b.type='button';b.className='dk-pa-asset';
   b.dataset.asset=asset.id;b.title=asset.label+' ('+asset.w+' × '+asset.h+')';
   b.setAttribute('aria-pressed',String(selected===asset.id));
   const picture=document.createElement('span');picture.className='dk-pa-asset-art';
   if(asset.image){
    const img=document.createElement('img');img.src='./assets/art/'+asset.image;
    img.alt='';img.loading='lazy';img.decoding='async';picture.append(img);
   }else if(asset.art&&root.DKArchitectDungeon){
    const sample=document.createElement('canvas');sample.width=32;sample.height=32;
    sample.setAttribute('aria-hidden','true');
    const c=sample.getContext?.('2d');if(c){
     c.imageSmoothingEnabled=false;
     root.DKArchitectDungeon.draw(c,asset.assetId,0,0,32,32,0);
    }
    picture.append(sample);
   }else picture.textContent=asset.type==='wall'?'▦':'◇';
   const name=document.createElement('span');name.textContent=asset.label;name.className='dk-pa-asset-label';
   b.append(picture,name);
   b.addEventListener('click',async()=>{
    try{
     await model.chooseAsset(asset);selected=asset.id;
     cards.querySelectorAll('button').forEach(x=>
      x.setAttribute('aria-pressed',String(x.dataset.asset===selected)));
     onAsset?.(asset);say('SELECTED '+asset.label.toUpperCase()+'. Click the live map to place.');
    }catch(e){say('Cannot select: '+e.message);}
   });
   cards.append(b);
  }
  more.hidden=assets.length<=limit;
  more.textContent='SHOW MORE · '+list.length+' / '+assets.length;
 }
 search.addEventListener('input',()=>{limit=48;drawAssets();});
 more.addEventListener('click',()=>{limit+=48;drawAssets();});
 function choose(category){
  const info=CATEGORIES.find(c=>c[0]===category);if(!info)return;
  if(active===category&&!flyout.hidden){flyout.hidden=true;active=null;
   nav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed','false'));return;}
  active=category;flyout.hidden=false;limit=48;search.value='';
  model.selectCategory(category);onCategory?.(category);
  panel.querySelector('#dkPaCategory').textContent=info[2];
  nav.querySelectorAll('button').forEach(b=>
   b.setAttribute('aria-pressed',String(b.dataset.category===category)));
  tools.replaceChildren();
  const label=nav.querySelector('[data-category="'+category+'"]');
  const rect=label?.getBoundingClientRect();
  const width=Math.min(480,Math.max(260,window.innerWidth-16));
  flyout.style.left=Math.max(8,Math.min(window.innerWidth-width-8,rect?.left||8))+'px';
  flyout.style.width=width+'px';
  for(const [tool,text,icon] of info[3]){
   const b=document.createElement('button');b.type='button';b.className='dk-pa-tool';
   b.dataset.tool=tool;b.innerHTML='<span aria-hidden="true">'+icon+'</span><strong>'+text+'</strong>';
   const enabled=available?available(tool):model.available(tool);
   b.disabled=!enabled;
   if(!enabled)b.title='Not supported in this region yet';
   b.setAttribute('aria-pressed',String(model.state().tool===tool));
   b.addEventListener('click',async()=>{
    try{
     await model.chooseTool(tool);
     tools.querySelectorAll('button').forEach(node=>
      node.setAttribute('aria-pressed',String(node.dataset.tool===tool)));
     onTool?.(tool,category,say);
     say(text+' · use the mouse on the world grid.');
    }catch(e){say('Cannot use tool: '+e.message);}
   });
   tools.append(b);
  }
  const assetGroup=model.categories[category];
  palette.hidden=!assetGroup;
  if(assetGroup)drawAssets();
  say('SELECT A BUILD TOOL OR ITEM. Left drag draws; right drag pans outdoors.');
 }
 for(const [id,icon,title] of CATEGORIES){
  const b=document.createElement('button');b.className='dk-pa-category';b.type='button';
  b.dataset.category=id;b.setAttribute('aria-pressed','false');
  b.innerHTML='<span class="dk-pa-icon" aria-hidden="true">'+icon+'</span>'+
   '<span class="dk-pa-label">'+title+'</span>';
  b.addEventListener('click',()=>choose(id));nav.append(b);
 }
 panel.querySelector('#dkPaDismiss').addEventListener('click',()=>{
  flyout.hidden=true;active=null;
  nav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed','false'));
 });
 panel.querySelector('#dkPaDone').addEventListener('click',onClose);
 function open(){panel.hidden=false;choose('foundations');}
 function close(){panel.hidden=true;flyout.hidden=true;active=null;}
 return Object.freeze({root:panel,open,close,choose,say,get visible(){return !panel.hidden;},get active(){return active;}});
}
root.DKArchitectMenus=Object.freeze({create,CATEGORIES});
})(globalThis);
