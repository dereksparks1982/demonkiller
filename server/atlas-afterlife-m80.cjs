'use strict';
// M80: server-owned permanent hidden caches, physical player corpses and
// monster theft. Atlas coordinates only. No player-created alternate realms.
const GRID=require('./world-grid-m67.cjs');
const WALK=require('./world-walker-m72.cjs');
const GATHER=require('./atlas-gathering-m74.cjs');
const {PACK,HAND,LIGHT}=require('./entity-registry-m10.cjs');
const {SLOTS}=require('./armory-m54.cjs');
const MAX_CACHES=256,MAX_BODIES=128,MAX_STOCK=160,PACK_CAP=GATHER.MAX_PLAYER_CARRY;
const GEAR_KINDS=new Set(['pack','equip','armory_equip']);
const STAGES=[['fresh',0],['early',180],['decaying',720],['skeletal',2160],['scattered',4320],['gone',10080]];
function ensure(w){
 if(!w?.living)throw Error('Living world required');
 if(w.living.atlas_afterlife===undefined){
  w.living.atlas_afterlife={schema:1,sequence:0,caches:{},corpses:{},last_minute:0};
  return true;
 }
 valid(w);return false;
}
function stockOK(s,cap){
 if(!s||Array.isArray(s)||typeof s!=='object'||
    Object.keys(s).some(k=>!['timber','herbs','reeds','stone','clay','plank','cord'].includes(k))||
    Object.values(s).some(n=>!Number.isSafeInteger(n)||n<1||n>cap)||
    Object.values(s).reduce((a,b)=>a+b,0)>cap)
  throw Error('Invalid atlas stock');
}
function serialOf(w){return w.entity_registry?.refs?.['player:1']?.serial??null;}
function distance(a,b){return Math.abs(a.x-b.x)+Math.abs(a.y-b.y);}
function player(w,{material=false}={}){
 const c=w.characters?.['1'];
 if(!c?.atlas_position||c.atlas_interior)throw Error('Visit the open world first');
 if(material&&c.form!=='living')throw Error('Ghosts cannot handle physical possessions');
 return c;
}
function container(w,id,kind,capacity=500,owner='world'){
 const r=w.entity_registry;
 if(!r?.containers[id])r.containers[id]={id,kind,capacity,owner};
 return r.containers[id];
}
function gear(w,parent){
 return Object.values(w.entity_registry?.items||{}).filter(i=>i.parent===parent);
}
function carried(w){
 const ids=new Set([PACK,HAND,LIGHT,...Object.values(SLOTS)]);
 return Object.values(w.entity_registry?.items||{}).filter(i=>ids.has(i.parent));
}
function stripItemMirror(c,item,origin){
 if(origin===PACK){
  if((c.inventory?.[item.type]||0)<item.amount)throw Error('Inventory item mirror out of sync');
  c.inventory[item.type]-=item.amount;
 }else if(origin===HAND){
  if(c.crafting?.hand!==item.type)throw Error('Hand item mirror out of sync');
  c.crafting.hand=null;
 }else if(origin===LIGHT){
  if(c.crafting?.light!==item.type)throw Error('Light item mirror out of sync');
  c.crafting.light=null;
 }else{
  const slot=Object.keys(SLOTS).find(k=>SLOTS[k]===origin);
  if(!slot||c.armory?.slots?.[slot]!==item.serial)
   throw Error('Equipment mirror out of sync');
  c.armory.slots[slot]=null;
  delete c.armory.durability[item.serial];
 }
}
function receive(w,item){
 const c=player(w,{material:true});
 const r=w.entity_registry;
 const all=gear(w,PACK).reduce((n,i)=>n+i.amount,0);
 if(all+item.amount>r.containers[PACK].capacity)
  throw Error('Physical backpack is full');
 if((c.inventory[item.type]||0)+item.amount>200)
  throw Error('Inventory type capacity reached');
 item.parent=PACK;
 c.inventory[item.type]=(c.inventory[item.type]||0)+item.amount;
}
function cacheView(w,c){
 const owner=serialOf(w)===c.owner_serial;
 return {id:c.id,x:c.x,y:c.y,marked:c.marked,owner_self:owner,
  coins:c.coins,stock:{...c.stock},items:gear(w,c.id).map(i=>({serial:i.serial,type:i.type,amount:i.amount}))};
}
function stage(c,minute){
 let current='fresh';for(const [s,n]of STAGES)if(minute-c.created_minute>=n)current=s;
 return current;
}
function bodyView(w,b){
 return {id:b.id,x:b.x,y:b.y,stage:stage(b,w.living.minute),
  own:serialOf(w)===b.owner_serial,stock:{...b.stock},coins:b.coins,
  stolen_by:[...b.stolen_by],
  items:gear(w,b.id).map(i=>({serial:i.serial,type:i.type,amount:i.amount}))};
}
function view(w,{radius=18}={}){
 const c=w.characters?.['1'],p=c?.atlas_position,s=w.living.atlas_afterlife;
 const caches=Object.values(s?.caches||{});
 return {form:c?.form||null,nearby_caches:p?caches.filter(q=>distance(q,p)<=2||(q.owner_serial===serialOf(w)&&distance(q,p)<=radius))
  .map(q=>cacheView(w,q)):[],
  cache_index:caches.filter(q=>q.owner_serial===serialOf(w)&&q.marked)
   .map(q=>({id:q.id,x:q.x,y:q.y})),
  nearby_corpses:p?Object.values(s?.corpses||{}).filter(b=>distance(b,p)<=radius)
   .map(b=>bodyView(w,b)):[],
  gear:p&&c.form==='living'?carried(w).map(i=>({
   serial:i.serial,type:i.type,amount:i.amount,origin:i.parent})):[],
  state:c?.form==='ghost'?'ghost':'living'};
}
function assertNearby(w,obj){if(distance(player(w).atlas_position,obj)>2)throw Error('Move beside this container first');}
function valid(w){
 const s=w.living?.atlas_afterlife;if(!s)return true;
 if(s.schema!==1||!Number.isSafeInteger(s.sequence)||s.sequence<0||
  !Number.isSafeInteger(s.last_minute)||s.last_minute<0||
  !s.caches||!s.corpses||Object.keys(s.caches).length>MAX_CACHES||
  Object.keys(s.corpses).length>MAX_BODIES)throw Error('Invalid afterlife registry');
 for(const [id,c] of Object.entries(s.caches)){
  if(!/^atlas_cache_[1-9][0-9]*$/.test(id)||c.id!==id||
   c.owner_serial!==null&&!/^ent_[1-9][0-9]*$/.test(c.owner_serial)||
   typeof c.marked!=='boolean')throw Error('Invalid atlas cache');
  GRID.tile(c.x,c.y);stockOK(c.stock,MAX_STOCK);
  if(!Number.isSafeInteger(c.coins)||c.coins<0||c.coins>1e9)
   throw Error('Invalid cached coins');
  if(w.entity_registry?.containers?.[id]?.kind!=='atlas_cache')
   throw Error('Missing physical cache item container');
 }
 for(const [id,b] of Object.entries(s.corpses)){
  if(!/^atlas_corpse_[1-9][0-9]*$/.test(id)||b.id!==id||
   !/^ent_[1-9][0-9]*$/.test(b.owner_serial)||
   !Number.isSafeInteger(b.created_minute)||b.created_minute<0||
   !Number.isSafeInteger(b.coins)||b.coins<0||
   !Array.isArray(b.stolen_by)||b.stolen_by.length>64||
   b.stolen_by.some(i=>typeof i!=='string'||i.length>50))
   throw Error('Invalid atlas corpse');
  GRID.tile(b.x,b.y);stockOK(b.stock,MAX_STOCK);
  if(w.entity_registry?.containers?.[id]?.kind!=='atlas_corpse')
   throw Error('Missing physical corpse container');
 }
 return true;
}
function perform(w,cmd){
 if(!cmd||typeof cmd!=='object'||Array.isArray(cmd)||
  !['cache_create','cache_mark','cache_store','cache_take',
    'cache_stash_gear','cache_take_gear','cache_store_coins','cache_take_coins',
    'ritual_death','body_reclaim','body_take','body_take_gear','body_take_coins'].includes(cmd.action))
  throw Error('Invalid afterlife action');
 const next=structuredClone(w);ensure(next);
 const c=player(next),p=c.atlas_position,r=next.entity_registry;
 const s=next.living.atlas_afterlife,pack=next.living.atlas_resources.packs.player;
 const keys=Object.keys(cmd).sort().join(',');
 const requireKeys=(expected)=>{if(keys!==expected)throw Error('Invalid afterlife action fields');};
 let message='',target=null;
 if(cmd.action==='cache_create'){
  requireKeys('action,x,y');
  player(next,{material:true});GRID.tile(cmd.x,cmd.y);
  if(distance(p,cmd)>1||!WALK.walkable(next,cmd.x,cmd.y))
   throw Error('Create a cache on reachable ground beside you');
  if(Object.values(s.caches).some(q=>distance(q,cmd)<2))
   throw Error('Another cache occupies this ground');
  if(Object.keys(s.caches).length>=MAX_CACHES)throw Error('Too many caches');
  const id='atlas_cache_'+(++s.sequence),owner=serialOf(next);
  if(!owner)throw Error('Player serial missing');
  target=s.caches[id]={id,x:cmd.x,y:cmd.y,stock:{},coins:0,owner_serial:owner,marked:true};
  container(next,id,'atlas_cache');
  message='Buried a permanent, discoverable cache';
 }else if(cmd.action==='cache_mark'){
  requireKeys('action,id,marked');
  target=s.caches[cmd.id];if(!target||target.owner_serial!==serialOf(next))
   throw Error('Only the owner can mark their own cache');
  if(typeof cmd.marked!=='boolean')throw Error('Invalid cache marker');
  target.marked=cmd.marked;message='Cache map marker updated';
 }else if(['cache_store','cache_take'].includes(cmd.action)){
  requireKeys('action,id,item,quantity');player(next,{material:true});
  target=s.caches[cmd.id];if(!target)throw Error('Unknown cache');
  assertNearby(next,target);
  if(!['timber','herbs','reeds','stone','clay','plank','cord'].includes(cmd.item)||
     !Number.isSafeInteger(cmd.quantity)||cmd.quantity<1||cmd.quantity>64)
   throw Error('Invalid cache supply transfer');
  const from=cmd.action==='cache_store'?pack:target.stock,
   to=cmd.action==='cache_store'?target.stock:pack;
  const limit=cmd.action==='cache_store'?MAX_STOCK:PACK_CAP;
  if((from[cmd.item]||0)<cmd.quantity)throw Error('Not enough materials');
  if(Object.values(to).reduce((a,b)=>a+b,0)+cmd.quantity>limit)
   throw Error('Destination pack is full');
  from[cmd.item]-=cmd.quantity;if(!from[cmd.item])delete from[cmd.item];
  to[cmd.item]=(to[cmd.item]||0)+cmd.quantity;
  message=cmd.action==='cache_store'?'Stored supplies in cache':'Recovered supplies from cache';
 }else if(['cache_store_coins','cache_take_coins','body_take_coins'].includes(cmd.action)){
  requireKeys('action,id,quantity');
  player(next,{material:true});
  target=cmd.action==='body_take_coins'?s.corpses[cmd.id]:s.caches[cmd.id];
  if(!target)throw Error('Unknown physical stash');
  assertNearby(next,target);
  if(!Number.isSafeInteger(cmd.quantity)||cmd.quantity<1||cmd.quantity>100000)
   throw Error('Invalid coin transfer');
  const into=cmd.action==='cache_store_coins';
  if(into&&c.gold<cmd.quantity)throw Error('Not enough carried coins');
  if(!into&&target.coins<cmd.quantity)throw Error('Stash has insufficient coins');
  if(into){c.gold-=cmd.quantity;target.coins+=cmd.quantity;}
  else{if(c.gold+cmd.quantity>1e9)throw Error('Too many coins');
   target.coins-=cmd.quantity;c.gold+=cmd.quantity;}
  message=into?'Coins secured in permanent cache':'Recovered physical coins';
 }else if(['cache_stash_gear','cache_take_gear','body_take_gear'].includes(cmd.action)){
  requireKeys('action,id,serial');player(next,{material:true});
  target=cmd.action==='body_take_gear'?s.corpses[cmd.id]:s.caches[cmd.id];
  if(!target)throw Error('Unknown physical stash');assertNearby(next,target);
  const item=r.items[cmd.serial];if(!item)throw Error('Unknown item serial');
  if(cmd.action==='cache_stash_gear'){
   if(!carried(next).some(i=>i.serial===item.serial))throw Error('Item is not carried');
   const qty=gear(next,target.id).reduce((n,i)=>n+i.amount,0);
   if(qty+item.amount>500)throw Error('Cache is full');
   const original=item.parent;stripItemMirror(c,item,original);item.parent=target.id;
   message='Stored genuine item serial '+item.serial;
  }else{
   if(item.parent!==target.id)throw Error('Item is not in that stash');
   receive(next,item);
   message='Recovered genuine item serial '+item.serial;
  }
 }else if(cmd.action==='ritual_death'){
  requireKeys('action');player(next,{material:true});
  if(!c.armory?.slots?.weapon)throw Error('A sword or weapon must be equipped for this ritual');
  if(Object.keys(s.corpses).length>=MAX_BODIES)throw Error('Too many persistent remains');
  if(!serialOf(next))throw Error('Player serial missing');
  const stocks={...pack};stockOK(stocks,MAX_STOCK);
  const id='atlas_corpse_'+(++s.sequence);
  target=s.corpses[id]={id,x:p.x,y:p.y,created_minute:next.living.minute,
   owner_serial:serialOf(next),stock:stocks,coins:c.gold||0,stolen_by:[]};
  container(next,id,'atlas_corpse');
  for(const item of carried(next)){const original=item.parent;
   stripItemMirror(c,item,original);item.parent=id;
  }
  for(const key of Object.keys(pack))delete pack[key];
  c.gold=0;c.form='ghost';c.opening_state='complete';c.crystal_spent=true;
  c.last_atlas_corpse_id=id;
  message='The body remains on the ground with all carried possessions';
 }else if(cmd.action==='body_reclaim'){
  requireKeys('action,id');
  if(c.form!=='ghost')throw Error('Only a ghost can reclaim the body');
  target=s.corpses[cmd.id];if(!target||target.owner_serial!==serialOf(next))
   throw Error('This is not your body');
  assertNearby(next,target);
  if(stage(target,next.living.minute)==='gone')
   throw Error('This body has returned to the earth');
  c.form='living';c.opening_state='resurrected';c.crystal_spent=true;
  message='Spirit and body reunited. The corpse still holds its belongings';
 }else if(cmd.action==='body_take'){
  requireKeys('action,id,item,quantity');player(next,{material:true});
  target=s.corpses[cmd.id];if(!target)throw Error('Unknown corpse');
  assertNearby(next,target);
  if(!['timber','herbs','reeds','stone','clay','plank','cord'].includes(cmd.item)||
     !Number.isSafeInteger(cmd.quantity)||cmd.quantity<1||cmd.quantity>64)
   throw Error('Invalid corpse supply transfer');
  if((target.stock[cmd.item]||0)<cmd.quantity)throw Error('No such supplies in corpse');
  if(Object.values(pack).reduce((a,b)=>a+b,0)+cmd.quantity>PACK_CAP)
   throw Error('Resource pack is full');
  target.stock[cmd.item]-=cmd.quantity;
  if(!target.stock[cmd.item])delete target.stock[cmd.item];
  pack[cmd.item]=(pack[cmd.item]||0)+cmd.quantity;
  message='Recovered supplies from remains';
 }else throw Error('Unknown afterlife action');
 c.revision++;next.revision++;
 valid(next);
 return {world:next,message,view:view(next)};
}
function advance(w,minute){
 const s=w.living?.atlas_afterlife;if(!s)return 0;
 if(minute<=s.last_minute)return 0;
 s.last_minute=minute;
 if(minute%60!==0)return 0;
 let stolen=0;
 for(const npc of Object.values(w.living.atlas_npcs?.records||{})){
  if(npc.role!=='monster'||!npc.alive)continue;
  const body=Object.values(s.corpses).find(b=>distance(npc,b)<=2&&
    (Object.keys(b.stock).length>0||gear(w,b.id).length>0));
  if(!body)continue;
  const item=gear(w,body.id)[0];
  if(item){
   const id='atlas_loot_'+npc.id;
   container(w,id,'atlas_loot',500,npc.id);
   if(gear(w,id).reduce((n,i)=>n+i.amount,0)+item.amount<=500){
    item.parent=id;body.stolen_by.push(npc.id+':'+item.serial);stolen++;
   }
  }else if(body.coins>0){
   body.coins--;
   npc.coins=(npc.coins||0)+1;
   body.stolen_by.push(npc.id+':coins');stolen++;
  }else{
   const [type,count]=Object.entries(body.stock)[0]||[];
   const npcPack=w.living.atlas_resources.packs.npcs[npc.id]||
    (w.living.atlas_resources.packs.npcs[npc.id]={});
   const total=Object.values(npcPack).reduce((a,b)=>a+b,0);
   if(count&&total<GATHER.MAX_NPC_CARRY){
    body.stock[type]--;if(!body.stock[type])delete body.stock[type];
    npcPack[type]=(npcPack[type]||0)+1;
    body.stolen_by.push(npc.id+':'+type);stolen++;
   }
  }
  if(body.stolen_by.length>64)body.stolen_by.shift();
 }
 return stolen;
}
function onRemoveNPC(w,npc){
 const id='atlas_loot_'+npc.id,gearItems=gear(w,id);
 const stock=w.living.atlas_resources.packs.npcs[npc.id]||{};
 if(!gearItems.length&&!Object.keys(stock).length&&!(npc.coins||0))return;
 const s=w.living.atlas_afterlife;
 if(Object.keys(s.caches).length>=MAX_CACHES)
  throw Error('Too many caches to drop monster loot');
 const crateId='atlas_cache_'+(++s.sequence);
 s.caches[crateId]={id:crateId,x:npc.x,y:npc.y,owner_serial:null,
  stock:{...stock},coins:npc.coins||0,marked:false};
 container(w,crateId,'atlas_cache');
 for(const item of gearItems)item.parent=crateId;
 npc.coins=0;
 delete w.entity_registry.containers[id];
}
module.exports=Object.freeze({ensure,validate:valid,perform,view,advance,onRemoveNPC,
 stage,MAX_CACHES,MAX_BODIES});
