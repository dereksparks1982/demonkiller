'use strict';
// M22: real NPC harvesting and physical supply trips.
// Independently inspired by RunUO's harvest systems; no GPL code used.
const {COURT,VILLAGE}=require('./regions.cjs');
const {location,total,CAPACITY}=require('./vendors-m18.cjs');
const {counts,reconcile}=require('./entity-registry-m10.cjs');
const HARVESTERS=Object.freeze({
 herbalist:{shop_id:'courtyard_market',nodes:['courtyard_herbs_west'],target:80},
 market_vendor:{shop_id:'village_market',nodes:['village_produce'],target:80},
 blacksmith:{shop_id:'village_smithy',nodes:['village_ore','village_wood'],target:18}
});
const MAX_GOALS=12,GOAL_LIFETIME=2160;
function ensure(world){
 if(!world.living)throw Error('Gathering requires a living world');
 if(world.living.npc_harvest)return false;
 world.living.npc_harvest={schema:1,goals:{},collected:0,delivered:0,
   last_trip:{}};return true;
}
function distance(a,b){return Math.abs(a.x-b.x)+Math.abs(a.y-b.y);}
function log(world,minute,type,text,extra={}){
 const l=world.living,e={id:'event_'+(++l.event_sequence),minute,type,text,...extra};
 l.events.push(e);if(l.events.length>512)l.events.shift();return e;
}
function safe(world,n){
 if(!n?.alive||world.living.territories[n.area_id]?.control!=='settlers')return false;
 return !['flee','defend','recover'].includes(world.living.npc_ai?.brains[n.id]?.mode);
}
function bagCount(reg,npcId){
 return Object.values(reg.items).filter(i=>i.parent==='npc_pack_'+npcId)
  .reduce((n,i)=>n+i.amount,0);
}
function pickNode(world,n,rule){
 const shop=world.living.businesses[rule.shop_id];
 if(!shop||!safe(world,n))return null;
 if(rule.shop_id!=='village_smithy'&&shop.stock>=rule.target)return null;
 if(rule.shop_id==='village_smithy'&&
   (shop.other_stock?.ore||0)>=12&&(shop.other_stock?.wood||0)>=6)return null;
 let selected=rule.nodes;
 if(rule.shop_id==='village_smithy'){
  const ore=(shop.other_stock?.ore||0),wood=(shop.other_stock?.wood||0);
  selected=ore/12<=wood/6?['village_ore','village_wood']:['village_wood','village_ore'];
 }
 for(const id of selected){
  const node=world.living.resources?.[id];
  if(node?.remaining>0&&node.area_id===n.area_id)return node;
 }
 return null;
}
function plan(world,minute,events){
 if(minute%15!==0)return;
 ensure(world);const s=world.living.npc_harvest;
 for(const [npcId,rule] of Object.entries(HARVESTERS)){
  // Allow the early village marketplace customer cycle before its owner leaves.
  if(npcId==='market_vendor'&&minute<120)continue;
  if(s.goals[npcId]||minute<(s.last_trip[npcId]??-1000)+15)continue;
  const n=world.living.npcs[npcId],node=pickNode(world,n,rule);
  if(!node||!world.entity_registry?.containers?.['npc_pack_'+npcId])continue;
  const goal={npc_id:npcId,node_id:node.id,shop_id:rule.shop_id,item_type:node.type,
   phase:'to_node',accepted_minute:minute,expires_minute:minute+GOAL_LIFETIME,
   item_serial:null};
  s.goals[npcId]=goal;
  events.push(log(world,minute,'npc.harvest.planned',
   n.name+' set out to gather '+node.type+'.',
   {npc_id:npcId,node_id:node.id,area_id:n.area_id,shop_id:rule.shop_id}));
 }
}
function destination(world,n){
 const g=world.living.npc_harvest?.goals[n.id];
 if(!g||!safe(world,n))return null;
 if(g.phase==='to_node'){
  const node=world.living.resources[g.node_id];
  return node?{area_id:node.area_id,x:node.x,y:node.y}:null;
 }
 const shop=world.living.businesses[g.shop_id];
 if(!shop)return null;
 const p=location(world,shop);return {area_id:shop.area_id,x:p.x,y:p.y};
}
function process(world,minute,events){
 if(minute%5!==0)return;
 ensure(world);const s=world.living.npc_harvest;let changed=false;
 for(const [id,g] of Object.entries(s.goals)){
  const n=world.living.npcs[id],shop=world.living.businesses[g.shop_id];
  const resource=world.living.resources?.[g.node_id];
  if(!n?.alive||!shop||!resource||minute>=g.expires_minute){
   delete s.goals[id];s.last_trip[id]=minute;continue;
  }
  if(!safe(world,n))continue;
  if(g.phase==='to_node'){
   if(n.area_id!==resource.area_id||distance(n,resource)>1)continue;
   const bag=world.entity_registry.containers['npc_pack_'+id];
   if(!bag||bagCount(world.entity_registry,id)>=bag.capacity)continue;
   if(resource.remaining<=0){delete s.goals[id];s.last_trip[id]=minute;continue;}
   resource.remaining--;
   const reg=world.entity_registry,serial='ent_'+reg.next_serial++;
   reg.items[serial]={serial,kind:'item',type:resource.type,amount:1,
      parent:'npc_pack_'+id,created_minute:minute};
   g.item_serial=serial;g.phase='to_shop';s.collected++;changed=true;
   events.push(log(world,minute,'npc.harvest.collected',
    n.name+' gathered real '+resource.type+' from '+resource.id+'.',
    {npc_id:id,node_id:resource.id,area_id:resource.area_id,item_serial:serial,
     remaining:resource.remaining}));
  }else{
   const at=location(world,shop);
   if(n.area_id!==shop.area_id||distance(n,at)>1)continue;
   const item=world.entity_registry.items[g.item_serial];
   if(!item||item.type!==g.item_type||item.parent!=='npc_pack_'+id||
      item.amount!==1){delete s.goals[id];s.last_trip[id]=minute;continue;}
   if(total(shop)+1>CAPACITY)continue;
   const container='vendor_stock_'+shop.id;
   if(!world.entity_registry.containers[container])continue;
   if(shop.product===item.type)shop.stock++;
   else shop.other_stock[item.type]=(shop.other_stock[item.type]||0)+1;
   item.parent=container;
   delete s.goals[id];s.last_trip[id]=minute;s.delivered++;changed=true;
   events.push(log(world,minute,'npc.harvest.delivered',
     n.name+' delivered '+item.type+' to '+shop.name+'.',
     {npc_id:id,area_id:shop.area_id,shop_id:shop.id,item_serial:item.serial,
      item_type:item.type,quantity:1}));
  }
 }
 if(changed){reconcile(world);counts(world);}
}
function validate(world){
 const s=world.living?.npc_harvest;if(!s)return true;
 if(s.schema!==1||!s.goals||!s.last_trip||Array.isArray(s.goals)||
  Object.keys(s.goals).length>MAX_GOALS||
  !Number.isSafeInteger(s.collected)||s.collected<0||
  !Number.isSafeInteger(s.delivered)||s.delivered<0||s.delivered>s.collected)
  throw Error('Invalid NPC harvesting state');
 for(const [id,g] of Object.entries(s.goals)){
  if(!HARVESTERS[id]||!world.living.npcs[id]||!g||g.npc_id!==id||
   !world.living.resources?.[g.node_id]||
   g.shop_id!==HARVESTERS[id].shop_id||
   !['to_node','to_shop'].includes(g.phase)||
   g.item_type!==world.living.resources[g.node_id].type||
   !Number.isSafeInteger(g.accepted_minute)||g.accepted_minute<0||
   g.expires_minute!==g.accepted_minute+GOAL_LIFETIME||
   (g.phase==='to_shop'&&!/^ent_[1-9][0-9]*$/.test(g.item_serial||'')))
   throw Error('Invalid NPC harvest goal');
 }
 for(const [id,minute] of Object.entries(s.last_trip))
  if(!HARVESTERS[id]||!Number.isSafeInteger(minute)||minute<0)
   throw Error('Invalid NPC harvest trip date');
 return true;
}
function listing(world){
 const s=world.living.npc_harvest;
 const p=world.characters?.['1'];
 return {world_minute:world.living.minute,collected:s?.collected||0,
  delivered:s?.delivered||0,nearby_goals:Object.values(s?.goals||{}).filter(g=>{
   const n=world.living.npcs[g.npc_id];
   return p&&n?.area_id===p.area_id&&distance(n,p)<=10;
  }).map(g=>({npc_id:g.npc_id,shop_id:g.shop_id,
   item_type:g.item_type,phase:g.phase}))};
}
module.exports={HARVESTERS,ensure,validate,plan,destination,process,listing};
