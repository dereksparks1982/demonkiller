/* DK Architect M39: one catalogue for temple, courtyard and village.
 * Original DK tiles + currently approved 0x72/Pixel_Poem assets ONLY.
 * Project Porcupine's GPL code is NOT incorporated into this source.
 */
(function(root){
'use strict';
const objects=Object.freeze({
 altar:{label:'Sacrificial Altar',category:'relics',w:3,h:2,solid:true},
 crystal:{label:'Soul Crystal',category:'relics',w:1,h:1,solid:false},
 braziers:{label:'Crimson Brazier',category:'relics',w:1,h:1,solid:true},
 runestone:{label:'Runestone',category:'relics',w:1,h:1,solid:true},
 pillar:{label:'Ruined Pillar',category:'structure',w:1,h:1,solid:true},
 door:{label:'Iron Arch Door',category:'structure',w:1,h:1,solid:false},
 statue:{label:'Veiled Statue',category:'structure',w:1,h:2,solid:true},
 pew:{label:'Temple Pew',category:'furniture',w:2,h:1,solid:true},
 coffin:{label:'Stone Sarcophagus',category:'furniture',w:2,h:1,solid:true},
 candle:{label:'Candle Cluster',category:'furniture',w:1,h:1,solid:false},
 chest:{label:'Reliquary Chest',category:'furniture',w:1,h:1,solid:true},
 scenery:{label:'Approved Character Sprite',category:'library',w:1,h:1,solid:false},
 imported:{label:'Approved Dungeon Object',category:'library',w:1,h:1,solid:false}
});
const sprites=(()=>{
 const entries={};
 for(const color of ['gold','red','orange','yellow','green','cyan','blue','purple','pink'])
  for(const shade of ['bright','dim']){
   const id='crystal_'+color+'_'+shade;
   entries[id]={label:'Crystal · '+color+' '+shade,
    group:'crystal',path:'crystals/'+id+'.png',size:24};
  }
 entries.crystal_silver_depleted={label:'Crystal · silver (spent)',
  group:'crystal',path:'crystals/crystal_silver_depleted.png',size:24};
 for(const [id,label,prefix] of [
  ['ghost','Ghost (static)','characters/ghost/ghost_'],
  ['human','Human (static)','characters/human/human_'],
  ['cult-member','Cult member (static)','characters/cult-member/cult_member_'],
  ['crystal-woman','Lilith visual (static)','characters/crystal-woman/crystal_woman_']])
  entries[id]={label,group:'actor',prefix,size:32};
 entries['cult-leader']={label:'Cult leader visual (static)',group:'actor',
  sheet:'characters/cult-leader/cult_leader_spritesheet.png',size:32};
 entries.devil={label:'Devil visual (static)',group:'actor',
  sheet:'characters/devil/devil_spritesheet.png',size:32};
 return Object.freeze(entries);
})();
const groups=Object.freeze({relics:'Relics & Ritual',structure:'Doors & Structures',
 furniture:'Furniture & Props',floors:'Dungeon Floors',walls:'Matching Wall Sets',
 library:'Original DK Sprites',items:'Equipment & Items',npcs:'NPCs & Enemies'});
const directions=['north','east','south','west'];
function list(category,query=''){
 const entries=[];
 const D=root.DKArchitectDungeon||null;
 if(category==='library'){
  for(const [id,o] of Object.entries(sprites))
   entries.push({id,type:'scenery',spriteId:id,label:o.label,category,
    w:1,h:1,image:o.path||(o.prefix?o.prefix+'south.png':o.sheet)||null,sheet:o.sheet||null});
 }else if(category==='floors'){
  for(const id of ['stone','dark','cracked','sigil'])
   entries.push({id,type:'floor',label:id.toUpperCase()+' FLOOR',category,w:1,h:1,
    image:'temple/floors/floor_'+id+'_south.png'});
 }else if(category==='walls'){
  for(const [id,o] of Object.entries(D?.auto||{}))
   entries.push({id,type:'wall',wallPack:o.pack,label:o.label,category,w:1,h:1});
 }
 for(const [id,o] of Object.entries(objects)){
  if(o.category!==category||id==='scenery'||id==='imported')continue;
  entries.push({id,type:id,label:o.label,category,w:o.w,h:o.h,
   image:o.category==='relics'?
    'temple/ritual/'+(id==='crystal'?'crystal_active':id)+'_south.png':
    'temple/'+(id==='door'?'doors':o.category==='structure'?'structure':o.category)+
    '/'+(id==='door'?'door_closed':id)+'_south.png'});
 }
 for(const [id,o] of Object.entries(D?.entries||{})){
  if(o.category!==category&&!(category==='items'&&o.category==='item')&&
     !(category==='npcs'&&['npc','enemy'].includes(o.category)))continue;
  entries.push({id,type:'imported',assetId:id,label:o.name||o.label||id,
   category,w:o.footprint?.[0]||1,h:o.footprint?.[1]||1,
   art:true});
 }
 const term=query.trim().toLowerCase();
 return term?entries.filter(e=>(e.id+' '+e.label).toLowerCase().includes(term)):entries;
}
function dimensions(o){
 if(!o)return [1,1];
 const d=o.type==='imported'?
  root.DKArchitectDungeon?.footprint(o.assetId,o.r||0)||[1,1]:
  (()=>{const b=objects[o.type];return [o.w||b?.w||1,o.h||b?.h||1]})();
 return (o.type==='imported'||!o.w&&!o.h)&&(o.r||0)%2?[d[1],d[0]]:d;
}
function match(o){
 if(!o||typeof o!=='object')return false;
 if(o.type==='imported')return typeof o.assetId==='string'&&
  Object.hasOwn(root.DKArchitectDungeon?.entries||{},o.assetId);
 if(o.type==='scenery')return typeof o.spriteId==='string'&&Object.hasOwn(sprites,o.spriteId);
 return Object.hasOwn(objects,o.type)&&o.type!=='imported'&&o.type!=='scenery';
}
root.DKArchitectCatalog=Object.freeze({objects,sprites,groups,directions,list,dimensions,match});
})(globalThis);
