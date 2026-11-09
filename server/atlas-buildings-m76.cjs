'use strict';
// M76. Real interiors, title, material storage, workbenches and paid caretakers.
// No Godot runtime, no prefab town generation, no magical goods.
const GRID=require('./world-grid-m67.cjs');
const TERRAIN=require('./world-terrain-editor-m69.cjs');
const GATHER=require('./atlas-gathering-m74.cjs');
const SOLID=new Set(['sea','deepwater','river','lake','cliff','boulder','crevasse']);
const MATERIALS=new Set(['timber','herbs','reeds','stone','clay','plank','cord']);
const RECIPES=Object.freeze({
 plank:{consumes:{timber:2},makes:{plank:1}},
 cord:{consumes:{reeds:2},makes:{cord:1}}
});
const CAPACITY=160;
const CARDINAL=Object.freeze({north:[0,-1],south:[0,1],west:[-1,0],east:[1,0]});
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const total=pack=>Object.values(pack).reduce((n,v)=>n+v,0);
function owner(world){return world.entity_registry?.refs?.['player:1']?.serial??null;}
function player(world){
 const c=world.characters?.['1'];
 if(!c?.atlas_position)throw Error('Enter the living world first');
 if(c.form!=='living')throw Error('Ghosts cannot use buildings');
 return c;
}
function site(world,id){
 if(typeof id!=='string'||!/^atlas_site_[1-9][0-9]{0,5}$/.test(id))
  throw Error('Invalid building ID');
 const s=world.living?.atlas_sites?.records?.[id];
 if(!s||s.phase!==3)throw Error('Building must be fully completed');
 return s;
}
function near(s,x,y){
 const nx=Math.max(s.x,Math.min(s.x+s.width-1,x));
 const ny=Math.max(s.y,Math.min(s.y+s.height-1,y));
 return Math.abs(x-nx)+Math.abs(y-ny);
}
function threshold(s){
 const c=[];
 for(let dx=0;dx<s.width;dx++){
  c.push({x:s.x+dx,y:s.y-1,side:'north',ix:dx,iy:0});
  c.push({x:s.x+dx,y:s.y+s.height,side:'south',ix:dx,iy:s.height-1});
 }
 for(let dy=0;dy<s.height;dy++){
  c.push({x:s.x-1,y:s.y+dy,side:'west',ix:0,iy:dy});
  c.push({x:s.x+s.width,y:s.y+dy,side:'east',ix:s.width-1,iy:dy});
 }
 return c.filter(d=>d.x>=0&&d.y>=0&&d.x<GRID.WIDTH&&d.y<GRID.HEIGHT);
}
function chooseDoor(world,s){
 const actor=world.characters?.['1']?.atlas_position;
 const options=threshold(s).filter(d=>
   !Object.values(world.living?.atlas_sites?.records||{}).some(other=>
      other.id!==s.id&&other.phase>=1&&
      d.x>=other.x&&d.y>=other.y&&
      d.x<other.x+other.width&&d.y<other.y+other.height)&&
   !Object.values(world.world_grid?.buildings||{}).some(b=>
      d.x>=b.x&&d.y>=b.y&&d.x<b.x+b.width&&d.y<b.y+b.height)&&
   !SOLID.has(TERRAIN.readTile(world,d.x,d.y).material)&&
   TERRAIN.readTile(world,d.x,d.y).elevation===s.elevation);
 if(!options.length)throw Error('Completed building needs one accessible exterior doorway');
 options.sort((a,b)=>{
  const aa=actor?Math.abs(a.x-actor.x)+Math.abs(a.y-actor.y):0;
  const bb=actor?Math.abs(b.x-actor.x)+Math.abs(b.y-actor.y):0;
  return aa-bb||['south','west','east','north'].indexOf(a.side)-
   ['south','west','east','north'].indexOf(b.side)||a.x-b.x||a.y-b.y;
 });
 return options[0];
}
function blank(){return {schema:1,records:{}};}
function sync(world){
 const root=world.living.atlas_buildings;
 let added=0;
 for(const s of Object.values(world.living.atlas_sites?.records||{})){
  if(s.phase!==3||root.records[s.id])continue;
  const door=chooseDoor(world,s);
  root.records[s.id]={id:s.id,kind:s.kind,owner_serial:s.owner_serial===undefined?
    owner(world):s.owner_serial,locked:false,door,storage:{},
   workbench:false,caretaker_id:null,completed_minute:world.living.minute};
  added++;
 }
 return added;
}
function ensure(world){
 if(!world?.living)throw Error('Living world required');
 let created=false;
 if(world.living.atlas_buildings===undefined){
  world.living.atlas_buildings=blank();created=true;
 }
 const added=sync(world);
 validate(world);
 return created||added>0;
}
function validStock(stock){
 return !!stock&&!Array.isArray(stock)&&typeof stock==='object'&&
  Object.keys(stock).every(k=>MATERIALS.has(k))&&
  Object.values(stock).every(v=>Number.isSafeInteger(v)&&v>0&&v<=CAPACITY)&&
  total(stock)<=CAPACITY;
}
function validate(world){
 const root=world.living?.atlas_buildings;
 if(root===undefined)return true;
 if(!root||root.schema!==1||Object.keys(root).sort().join(',')!=='records,schema'||
    !root.records||Array.isArray(root.records)||typeof root.records!=='object')
   throw Error('Invalid atlas building registry');
 if(Object.keys(root.records).length>64)throw Error('Too many atlas buildings');
 for(const [id,b] of Object.entries(root.records)){
  const s=site(world,id);
  if(!b||b.id!==id||b.kind!==s.kind||
   Object.keys(b).sort().join(',')!==
    'caretaker_id,completed_minute,door,id,kind,locked,owner_serial,storage,workbench'||
   (b.owner_serial!==null&&(typeof b.owner_serial!=='string'||b.owner_serial.length>120||
     b.owner_serial.length<1))||
   typeof b.locked!=='boolean'||(b.owner_serial===null&&b.locked)||
   typeof b.workbench!=='boolean'||
   !validStock(b.storage)||
   !Number.isSafeInteger(b.completed_minute)||b.completed_minute<0||
   b.completed_minute>world.living.minute)
   throw Error('Invalid atlas building state');
  const d=b.door;
  if(!d||Object.keys(d).sort().join(',')!=='ix,iy,side,x,y'||
   !own(CARDINAL,d.side)||![d.x,d.y,d.ix,d.iy].every(Number.isSafeInteger)||
   d.ix<0||d.iy<0||d.ix>=s.width||d.iy>=s.height)
   throw Error('Invalid building doorway');
  GRID.tile(d.x,d.y);
  const check={
   north:d.y===s.y-1&&d.x===s.x+d.ix&&d.iy===0,
   south:d.y===s.y+s.height&&d.x===s.x+d.ix&&d.iy===s.height-1,
   west:d.x===s.x-1&&d.y===s.y+d.iy&&d.ix===0,
   east:d.x===s.x+s.width&&d.y===s.y+d.iy&&d.ix===s.width-1
  };
  if(!check[d.side])throw Error('Building door is not on exterior wall');
  if(b.caretaker_id!==null){
   const npc=world.living.atlas_npcs?.records?.[b.caretaker_id];
   if(!npc||npc.role!=='worker'||near(s,npc.x,npc.y)>2)
    throw Error('Invalid building caretaker');
  }
 }
 const interior=world.characters?.['1']?.atlas_interior;
 if(interior!==undefined){
  if(!interior||Object.keys(interior).sort().join(',')!=='facing,id,x,y'||
   !own(CARDINAL,interior.facing)||!Number.isSafeInteger(interior.x)||
   !Number.isSafeInteger(interior.y))throw Error('Invalid indoor character position');
  const s=site(world,interior.id);
  if(!root.records[interior.id]||interior.x<0||interior.y<0||
    interior.x>=s.width||interior.y>=s.height)
   throw Error('Character is in an unknown building');
 }
 return true;
}
function building(world,id){
 const s=site(world,id);
 const b=world.living.atlas_buildings.records[id];
 if(!b)throw Error('Unknown furnished building');
 return {s,b};
}
function belongs(world,b){
 const serial=owner(world);
 if(!serial||b.owner_serial!==serial)throw Error('You do not own this building');
}
function current(world){
 const p=player(world),v=p.atlas_interior;
 if(!v)throw Error('Enter the building first');
 const {s,b}=building(world,v.id);
 return {p,v,s,b};
}
function closeEnough(v,x,y){
 if(Math.abs(v.x-x)+Math.abs(v.y-y)>1)
  throw Error('Move nearer the fixture before using it');
}
function move(world,direction){
 if(!own(CARDINAL,direction))throw Error('Cardinal movement only');
 const {p,v,s}=current(world),[dx,dy]=CARDINAL[direction];
 const x=v.x+dx,y=v.y+dy;
 if(x<0||y<0||x>=s.width||y>=s.height)
  throw Error('Interior wall blocks movement');
 v.x=x;v.y=y;v.facing=direction;p.revision++;
 return v;
}
function take(pack,item,quantity){
 if((pack[item]||0)<quantity)throw Error('Not enough physical inventory');
 pack[item]-=quantity;if(!pack[item])delete pack[item];
}
function add(pack,item,quantity,capacity){
 if(total(pack)+quantity>capacity)throw Error('Inventory capacity reached');
 pack[item]=(pack[item]||0)+quantity;
}
function event(world,action,id,info){
 const l=world.living;
 const e={id:'event_'+(++l.event_sequence),minute:l.minute,
  type:'atlas.building.'+action,building_id:id,text:info};
 l.events.push(e);if(l.events.length>512)l.events.shift();
 return e;
}
function perform(world,command){
 if(!world?.living||!command||typeof command!=='object'||Array.isArray(command)||
  !Number.isSafeInteger(command.expected_revision))
  throw Error('Invalid building command');
 if(command.expected_revision!==world.revision)throw Error('Stale world revision');
 const signatures={
  enter:'action,building_id,expected_revision',
  exit:'action,expected_revision',
  deposit:'action,expected_revision,item,quantity',
  withdraw:'action,expected_revision,item,quantity',
  install_bench:'action,expected_revision',
  craft:'action,expected_revision,recipe',
  lock:'action,building_id,expected_revision',
  unlock:'action,building_id,expected_revision',
  claim:'action,building_id,expected_revision',
  assign_caretaker:'action,building_id,expected_revision,npc_id',
  unassign_caretaker:'action,building_id,expected_revision'
 };
 if(!own(signatures,command.action)||
    Object.keys(command).sort().join(',')!==signatures[command.action])
  throw Error('Invalid building command fields');
 const next=structuredClone(world);
 ensure(next);GATHER.ensure(next);
 const p=player(next),pack=next.living.atlas_resources.packs.player;
 let id=null,description='';
 if(command.action==='enter'){
  if(p.atlas_interior)throw Error('Already inside a building');
  const {s,b}=building(next,command.building_id),d=b.door;
  if(p.atlas_position.x!==d.x||p.atlas_position.y!==d.y)
   throw Error('Stand on the exterior doorway tile to enter');
  if(b.locked&&b.owner_serial!==owner(next))throw Error('Building door is locked');
  p.atlas_interior={id:s.id,x:d.ix,y:d.iy,facing:d.side};
  id=s.id;description='Entered '+s.kind+' interior';
 }else if(command.action==='exit'){
  const {v,b}=current(next);
  if(v.x!==b.door.ix||v.y!==b.door.iy)
   throw Error('Return to the doorway before exiting');
  const d=b.door;
  if(Object.values(next.living.atlas_npcs?.records||{}).some(n=>n.x===d.x&&n.y===d.y))
   throw Error('An NPC is blocking the doorway');
  if(SOLID.has(TERRAIN.readTile(next,d.x,d.y).material)||
     Object.values(next.living.atlas_sites.records).some(s=>
       s.phase>=1&&d.x>=s.x&&d.y>=s.y&&
       d.x<s.x+s.width&&d.y<s.y+s.height))
   throw Error('Exterior doorway is obstructed');
  id=v.id;delete p.atlas_interior;description='Stepped out through building door';
 }else if(['lock','unlock','claim','assign_caretaker','unassign_caretaker'].includes(command.action)){
  if(p.atlas_interior)throw Error('Step outside for building management');
  const {s,b}=building(next,command.building_id);
  id=s.id;
  if(command.action==='claim'){
   if(b.owner_serial!==null)throw Error('Building already has an owner');
   if(p.atlas_position.x!==b.door.x||p.atlas_position.y!==b.door.y)
    throw Error('Stand at the exterior doorway to claim');
   if(!owner(next))throw Error('Player title is unavailable');
   if((p.gold||0)<5)throw Error('Five gold required to register ownership');
   p.gold-=5;b.owner_serial=owner(next);description='Registered abandoned building title';
  }else{
   belongs(next,b);
   if(Math.abs(p.atlas_position.x-b.door.x)+Math.abs(p.atlas_position.y-b.door.y)>1)
    throw Error('Move near the doorway to manage this building');
   if(command.action==='lock'||command.action==='unlock'){
    b.locked=command.action==='lock';
    description=b.locked?'Locked owner door':'Unlocked owner door';
   }else if(command.action==='unassign_caretaker'){
    if(!b.caretaker_id)throw Error('No caretaker assigned');
    b.caretaker_id=null;description='Released building caretaker';
   }else{
    const npc=next.living.atlas_npcs?.records?.[command.npc_id];
    if(!npc||npc.role!=='worker'||near(s,npc.x,npc.y)>2)
     throw Error('Caretaker must be a worker stationed beside the building');
    if(Object.values(next.living.atlas_buildings.records).some(other=>
      other.caretaker_id===npc.id))throw Error('Worker already cares for a building');
    b.caretaker_id=npc.id;description='Assigned paid caretaker '+npc.name;
   }
  }
 }else{
  const {v,b,s}=current(next);id=s.id;belongs(next,b);
  if(['deposit','withdraw'].includes(command.action)){
   closeEnough(v,0,0);
   if(!MATERIALS.has(command.item)||!Number.isSafeInteger(command.quantity)||
    command.quantity<1||command.quantity>8)throw Error('Invalid building inventory transfer');
   if(command.action==='deposit'){
    take(pack,command.item,command.quantity);
    add(b.storage,command.item,command.quantity,CAPACITY);
   }else{
    take(b.storage,command.item,command.quantity);
    add(pack,command.item,command.quantity,GATHER.MAX_PLAYER_CARRY);
   }
   description=command.action+' '+command.quantity+' '+command.item;
  }else if(command.action==='install_bench'){
   closeEnough(v,s.width-1,0);
   if(b.workbench)throw Error('Workbench already installed');
   if((pack.timber||0)<2||(pack.stone||0)<1)
    throw Error('Workbench requires two timber and one stone in your pack');
   take(pack,'timber',2);take(pack,'stone',1);
   b.workbench=true;description='Installed permanent crafting workbench';
  }else{
   if(!b.workbench)throw Error('Install a workbench before crafting');
   closeEnough(v,s.width-1,0);
   const recipe=RECIPES[command.recipe];
   if(!own(RECIPES,command.recipe))throw Error('Unknown workbench recipe');
   for(const [item,qty] of Object.entries(recipe.consumes))
    if((pack[item]||0)<qty)throw Error('Not enough workbench materials');
   const consume=total(recipe.consumes),produced=total(recipe.makes);
   if(total(pack)-consume+produced>GATHER.MAX_PLAYER_CARRY)
    throw Error('Inventory capacity reached');
   for(const [item,qty] of Object.entries(recipe.consumes))take(pack,item,qty);
   for(const [item,qty] of Object.entries(recipe.makes))add(pack,item,qty,GATHER.MAX_PLAYER_CARRY);
   description='Crafted '+command.recipe+' using real gathered materials';
  }
 }
 p.revision++;next.revision++;
 const e=event(next,command.action,id,description);
 validate(next);GATHER.validate(next);
 return {world:next,event:e,view:view(next)};
}
function advance(world,minute,events=[]){
 if(minute%60!==0)return 0;
 let count=0;
 for(const b of Object.values(world.living?.atlas_buildings?.records||{})){
  if(!b.caretaker_id||b.owner_serial!==owner(world)||!b.owner_serial)continue;
  const s=world.living.atlas_sites.records[b.id];
  const npc=world.living.atlas_npcs.records[b.caretaker_id];
  const pack=world.living.atlas_resources.packs.npcs[npc.id]||{};
  if(near(s,npc.x,npc.y)>2||total(b.storage)>=CAPACITY)continue;
  const item=Object.keys(pack).sort().find(k=>MATERIALS.has(k)&&pack[k]>0);
  if(!item)continue;
  const p=world.characters?.['1'];
  if(!p||p.gold<1||(npc.coins||0)>=1e9)continue;
  take(pack,item,1);add(b.storage,item,1,CAPACITY);
  p.gold--;p.revision++;npc.coins=(npc.coins||0)+1;
  count++;
  events.push(event(world,'caretaker',b.id,npc.name+' stored one '+item+' for one gold'));
 }
 return count;
}
function nearby(world,x,y,radius=12){
 return Object.values(world.living?.atlas_buildings?.records||{}).filter(b=>{
  const s=world.living.atlas_sites.records[b.id];
  return near(s,x,y)<=radius;
 }).map(b=>{
  const s=world.living.atlas_sites.records[b.id];
  return {id:b.id,kind:b.kind,door:{...b.door},locked:b.locked,
   owner_self:!!owner(world)&&b.owner_serial===owner(world),
   unclaimed:b.owner_serial===null,caretaker_id:b.caretaker_id,
   x:s.x,y:s.y,width:s.width,height:s.height};
 });
}
function view(world){
 const c=world.characters?.['1'];
 if(!c?.atlas_position)return {world_revision:world.revision,buildings:[],interior:null};
 const interior=c.atlas_interior;
 const active=interior?building(world,interior.id):null;
 return {world_revision:world.revision,
  buildings:nearby(world,c.atlas_position.x,c.atlas_position.y),
  interior:!active?null:{
   id:interior.id,kind:active.b.kind,position:{x:interior.x,y:interior.y,
    facing:interior.facing},
   width:active.s.width,height:active.s.height,door:{...active.b.door},
   chest:{x:0,y:0,stock:{...active.b.storage},capacity:CAPACITY},
   bench:{x:active.s.width-1,y:0,installed:active.b.workbench},
   locked:active.b.locked,owner_self:active.b.owner_serial===owner(world)}};
}
module.exports=Object.freeze({ensure,sync,validate,perform,advance,nearby,view,move,
 RECIPES,MATERIALS,CAPACITY});
