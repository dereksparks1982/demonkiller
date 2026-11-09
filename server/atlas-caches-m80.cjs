'use strict';
// M80: actual sparse, persistent, discoverable physical caches.
// Caches never expire, but contents are not magically protected.
// All mutable operations are authority-side serialized transactions.
const GRID=require('./world-grid-m67.cjs');
const TERRAIN=require('./world-terrain-editor-m69.cjs');
const WALK=require('./world-walker-m72.cjs');
const GATHER=require('./atlas-gathering-m74.cjs');
const ANCHOR=require('./world-anchor-m78.cjs');
const LIMIT=64,CAPACITY=128,DEPLOY_RANGE=1,SEARCH_RANGE=2,INTERACT_RANGE=1;
const ITEM=new Set(['timber','stone','clay','reeds','herbs','plank','cord']);
const BLOCKED=new Set(['sea','deepwater','river','lake','cliff','crevasse','boulder']);
const key=(x,y)=>x+','+y,own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const serial=world=>world.entity_registry?.refs?.['player:1']?.serial??null;
const count=pack=>Object.values(pack).reduce((a,v)=>a+v,0);
function ensure(world){
 if(!world?.living)throw Error('Living world required');
 if(world.living.atlas_caches===undefined){
  world.living.atlas_caches={schema:1,sequence:0,records:{}};
  return true;
 }
 validate(world);
 return false;
}
function validate(world){
 const a=world?.living?.atlas_caches;
 if(a===undefined)return true;
 if(!a||a.schema!==1||Object.keys(a).sort().join(',')!=='records,schema,sequence'||
  !Number.isSafeInteger(a.sequence)||a.sequence<0||a.sequence>100000||
  !a.records||typeof a.records!=='object'||Array.isArray(a.records)||
  Object.keys(a.records).length>LIMIT)throw Error('Invalid atlas cache registry');
 const locations=new Set();
 for(const [id,c] of Object.entries(a.records)){
  if(!/^atlas_cache_[1-9][0-9]{0,5}$/.test(id)||!c||c.id!==id||
   Object.keys(c).sort().join(',')!==
    'created_minute,discovered_by,id,owner_serial,stock,x,y'||
   !Number.isSafeInteger(c.created_minute)||c.created_minute<0||
   c.created_minute>world.living.minute||
   (c.owner_serial!==null&&(typeof c.owner_serial!=='string'||!c.owner_serial.length||c.owner_serial.length>120))||
   !Array.isArray(c.discovered_by)||c.discovered_by.length>32||
   c.discovered_by.some(x=>typeof x!=='string'||x.length<1||x.length>120)||
   new Set(c.discovered_by).size!==c.discovered_by.length||
   !c.stock||Array.isArray(c.stock)||typeof c.stock!=='object'||
   Object.entries(c.stock).some(([k,n])=>!ITEM.has(k)||!Number.isSafeInteger(n)||n<1||n>CAPACITY)||
   count(c.stock)>CAPACITY)throw Error('Invalid atlas cache');
  GRID.tile(c.x,c.y);
  if(locations.has(key(c.x,c.y)))throw Error('Duplicate atlas cache location');
  locations.add(key(c.x,c.y));
 }
 return true;
}
function player(world){
 const c=world.characters?.['1'];
 if(!c?.atlas_position||c.atlas_interior)throw Error('Must be outside in the living world');
 if(c.form!=='living')throw Error('Ghosts cannot handle physical caches');
 const owner=serial(world);
 if(!owner)throw Error('Character serial required to manage caches');
 return {c:c.atlas_position,owner};
}
function range(a,x,y,d){return Math.abs(a.x-x)+Math.abs(a.y-y)<=d;}
function position(world,x,y,actor,dist){
 GRID.tile(x,y);
 if(!range(actor,x,y,dist))throw Error('Cache position is out of reach');
}
function near(world,x,y,radius=18){
 const root=world.living?.atlas_caches;
 const owner=serial(world);
 if(!root)return [];
 return Object.values(root.records).filter(c=>{
  const visible=(c.owner_serial===owner&&owner!==null)||c.discovered_by.includes(owner);
  return visible&&Math.abs(c.x-x)<=radius&&Math.abs(c.y-y)<=radius;
 }).map(c=>({id:c.id,x:c.x,y:c.y,owned:owner!==null&&c.owner_serial===owner,
  discovered:owner!==null&&c.discovered_by.includes(owner),
  stock:{...c.stock},capacity:CAPACITY,permanent:true}));
}
function listing(world){
 const p=world.characters?.['1'];
 if(!p?.atlas_position||p.atlas_interior)return {nearby:[],mine:[]};
 const s=serial(world);
 const all=Object.values(world.living?.atlas_caches?.records||{});
 return {nearby:near(world,p.atlas_position.x,p.atlas_position.y),
  mine:all.filter(c=>s!==null&&c.owner_serial===s)
   .map(c=>({id:c.id,x:c.x,y:c.y,stock:{...c.stock},
    capacity:CAPACITY,permanent:true}))};
}
function perform(world,cmd){
 if(!cmd||typeof cmd!=='object'||Array.isArray(cmd)||
   !Number.isSafeInteger(cmd.expected_revision))
  throw Error('Invalid cache command');
 if(cmd.expected_revision!==world.revision)throw Error('Stale world revision');
 const signatures={
  create:'action,expected_revision,x,y',
  discover:'action,expected_revision,x,y',
  deposit:'action,cache_id,expected_revision,item,quantity',
  withdraw:'action,cache_id,expected_revision,item,quantity'
 };
 if(!own(signatures,cmd.action)||
   Object.keys(cmd).sort().join(',')!==signatures[cmd.action])
  throw Error('Invalid cache command fields');
 const next=structuredClone(world);
 ensure(next);GATHER.ensure(next);
 const {c,owner}=player(next),state=next.living.atlas_caches;
 const pack=next.living.atlas_resources.packs.player;
 let changed=null,text='',id=null;
 if(cmd.action==='create'){
  position(next,cmd.x,cmd.y,c,DEPLOY_RANGE);
  if(!WALK.walkable(next,cmd.x,cmd.y))throw Error('Cache needs passable ground');
  if(Object.keys(state.records).length>=LIMIT)throw Error('World cache limit reached');
  if(ANCHOR.blocked(cmd.x,cmd.y))throw Error('Cannot conceal a cache in the temple or willow');
  if(Object.values(next.living.atlas_sites?.records||{}).some(s=>
    cmd.x>=s.x&&cmd.y>=s.y&&cmd.x<s.x+s.width&&cmd.y<s.y+s.height))
   throw Error('Cannot place a cache in a building footprint');
  if(Object.values(state.records).some(o=>o.x===cmd.x&&o.y===cmd.y))
   throw Error('Another cache is already here');
  const idNew='atlas_cache_'+(++state.sequence);
  id=idNew;
  state.records[id]={id,x:cmd.x,y:cmd.y,owner_serial:owner,
   created_minute:next.living.minute,discovered_by:[],stock:{}};
  text='A hidden permanent cache was placed';
 }else if(cmd.action==='discover'){
  position(next,cmd.x,cmd.y,c,SEARCH_RANGE);
  const targets=Object.values(state.records).filter(o=>o.x===cmd.x&&o.y===cmd.y);
  if(!targets.length)throw Error('Nothing concealed was discovered');
  const target=targets[0];
  if(target.owner_serial===owner)throw Error('This cache is already yours');
  if(target.discovered_by.includes(owner))throw Error('Already discovered this cache');
  target.discovered_by.push(owner);id=target.id;
  text='A hidden cache was uncovered and may be looted';
 }else{
  const target=state.records[cmd.cache_id];
  if(!target)throw Error('Unknown cache');
  position(next,target.x,target.y,c,INTERACT_RANGE);
  if(target.owner_serial!==owner&&!target.discovered_by.includes(owner))
   throw Error('This cache has not been discovered');
  if(!ITEM.has(cmd.item)||!Number.isSafeInteger(cmd.quantity)||
   cmd.quantity<1||cmd.quantity>32)throw Error('Invalid cache transfer');
  const from=cmd.action==='deposit'?pack:target.stock;
  const to=cmd.action==='deposit'?target.stock:pack;
  const cap=cmd.action==='deposit'?CAPACITY:GATHER.MAX_PLAYER_CARRY;
  if((from[cmd.item]||0)<cmd.quantity)throw Error('Not enough stored material');
  if(count(to)+cmd.quantity>cap)throw Error('Destination inventory is full');
  from[cmd.item]-=cmd.quantity;
  if(!from[cmd.item])delete from[cmd.item];
  to[cmd.item]=(to[cmd.item]||0)+cmd.quantity;
  id=target.id;
  text=(cmd.action==='deposit'?'Stored ':'Took ')+cmd.quantity+' '+cmd.item+
   (target.owner_serial!==owner?' from a discovered cache':'');
 }
 next.characters['1'].revision++;
 next.revision++;
 const event={id:'event_'+(++next.living.event_sequence),minute:next.living.minute,
  type:'atlas.cache.'+cmd.action,slot:1,cache_id:id,text};
 next.living.events.push(event);
 if(next.living.events.length>512)next.living.events.shift();
 validate(next);GATHER.validate(next);
 return {world:next,event,cache_id:id};
}
module.exports=Object.freeze({ensure,validate,perform,near,listing,ITEM,CAPACITY,LIMIT});
