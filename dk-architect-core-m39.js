/* DK Architect M39: one editor state and tool dispatcher for ALL game regions.
 * Same commands, selected asset, rotation and menu state; region adapters
 * are only responsible for their map's storage and drawing details.
 * Original JavaScript, informed by Project Porcupine's mode architecture.
 */
(function(root){
'use strict';
const CATEGORY_ASSETS=Object.freeze({
 foundations:'walls',materials:'floors',rooms:'structure',
 objects:'furniture',staff:'npcs',utilities:'relics',
 deployment:'library',logistics:'items',
 intelligence:null,emergencies:'npcs',clone:null,planning:null
});
const TOOLS=Object.freeze({
 foundations:['move_building','draw_wall','erase_wall','wall_line','room_outline'],
 materials:['paint_path','paint_grass','paint_dirt','paint_garden','paint_stone','brush_rect'],
 rooms:['place_door','erase_door','room_outline','inspect'],
 objects:['select','move_object','place_object','rotate_object','erase_object'],
 staff:['place_npc','select','inspect'],
 utilities:['move_fixture','place_fixture','inspect'],
 deployment:['spawn','place_object','select'],
 logistics:['export','save','undo','redo'],
 intelligence:['inspect','select'],
 emergencies:['place_npc','erase_object'],
 clone:['copy','paste','duplicate'],
 planning:['select','move_building','brush_rect','export']
});
const ACTIONS=new Set(['export','save','undo','redo']);
const ROTATIONS=[0,1,2,3];
function create(host){
 if(!host||typeof host.available!=='function'||typeof host.execute!=='function')
  throw Error('DK Architect requires a region adapter');
 let category='foundations',tool='select',asset=null,rotation=0;
 const listeners=new Set();
 const state=()=>Object.freeze({category,tool,asset,rotation});
 function emit(message){
  const snapshot=state();
  for(const listener of listeners)listener(snapshot,message||'');
 }
 function available(key){return Boolean(TOOLS[category]?.includes(key)||Object.values(TOOLS).some(c=>c.includes(key)))&&host.available(key);}
 function selectCategory(name){
  if(!Object.hasOwn(TOOLS,name))throw Error('Unknown Architect category');
  category=name;emit(name.toUpperCase());
  if(host.category)host.category(CATEGORY_ASSETS[name],name);
  return state();
 }
 async function chooseTool(key){
  if(!available(key))throw Error('Construction tool unavailable for this region: '+key);
  if(ACTIONS.has(key))return host.execute(key,state());
  if(key==='place_npc')key='place_object';
  if(key==='place_fixture')key='place_object';
  tool=key;emit(key.replaceAll('_',' ').toUpperCase());
  return host.execute('activate_tool',state());
 }
 async function chooseAsset(next){
  if(!next||typeof next.id!=='string'||!next.type)throw Error('Unknown asset');
  const categoryName=next.category;
  if(categoryName&&Object.values(CATEGORY_ASSETS).includes(categoryName)){
   const group=Object.entries(CATEGORY_ASSETS).find(([,g])=>g===categoryName);
   if(group)category=group[0];
  }
  asset={...next};rotation=0;
  tool=next.category==='floors'||next.type==='floor'?'paint_stone':
   next.category==='walls'||next.type==='wall'?'draw_wall':
   next.type==='door'?'place_door':'place_object';
  emit(next.label+' · place on the grid');
  return host.execute('select_asset',state());
 }
 function rotate(steps=1){
  if(!Number.isInteger(steps))throw Error('Rotation must be a cardinal step');
  rotation=ROTATIONS[(rotation+steps%4+4)%4];
  emit('FACING '+['NORTH','EAST','SOUTH','WEST'][rotation]);
  return host.execute('rotate_preview',state());
 }
 function onChange(listener){
  if(typeof listener!=='function')throw Error('Listener must be a function');
  listeners.add(listener);return ()=>listeners.delete(listener);
 }
 function reset(){
  category='foundations';tool='select';asset=null;rotation=0;emit('Ready');
 }
 function selection(){return {tool,asset,rotation};}
 function assets(name,query=''){return root.DKArchitectCatalog?.list(CATEGORY_ASSETS[name]||name,query)||[];}
 return Object.freeze({state,available,chooseTool,chooseAsset,selectCategory,rotate,
  onChange,reset,assets,selection,tools:TOOLS,categories:CATEGORY_ASSETS});
}
root.DKArchitectCore=Object.freeze({create,TOOLS,CATEGORY_ASSETS,ACTIONS});
})(globalThis);
