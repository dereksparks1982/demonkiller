'use strict';
// DK Server M19: actual NPC customers. No ghost buyers and no free meals.
// Independent UO-inspired mobile/vendor interaction; same one-world authority.
const {merchandises,location}=require('./vendors-m18.cjs');
const {reconcile}=require('./entity-registry-m10.cjs');
const BUSINESS=require('./player-business-m48.cjs');
const FOOD=new Set(['bread','produce','meals','rations']);
const SHOPPERS=new Set(['guard','caravan','escort','courier','caretaker','herbalist','smithy','bakery','market','tavern','bank']);
const PRICE=Object.freeze({bread:2,produce:2,meals:4});
const MAX_GOALS=40,MAX_WAIT=30;
function ensure(world){
 if(!world.living)throw Error('NPC trade requires a living world');
 if(world.living.npc_trade){
  const state=world.living.npc_trade;
  if(state.schema!==1)throw Error('Unknown NPC commerce save schema');
  if(!state.pending_sales){state.pending_sales={};return true;}
  return false;
 }
 world.living.npc_trade={schema:1,goals:{},pending_sales:{},
  last_purchase:{},purchases:0};
 return true;
}
function event(world,minute,type,text,extra={}){
 const l=world.living,e={id:'event_'+(++l.event_sequence),minute,
  type,text,...extra};
 l.events.push(e);if(l.events.length>512)l.events.shift();
 return e;
}
function pack(world,n){
 return Object.values(world.entity_registry?.items||{})
  .filter(i=>i.parent==='npc_pack_'+n.id);
}
function distance(a,x,y){return Math.abs(a.x-x)+Math.abs(a.y-y);}
function plan(world,minute,out){
 if(minute%15!==0)return;
 ensure(world);
 const state=world.living.npc_trade;
 for(const n of Object.values(world.living.npcs)){
  if(!n.alive||!SHOPPERS.has(n.role)||state.goals[n.id]||
     (world.living.caravans?.active&&['caravan','escort'].includes(n.role))||
     !['work','recover'].includes(world.living.npc_ai?.brains[n.id]?.mode||'work'))continue;
  if(pack(world,n).some(i=>FOOD.has(i.type)))continue;
  if((state.last_purchase[n.id]??-1000)+90>minute)continue;
  const choices=Object.values(world.living.businesses)
    .filter(shop=>merchandises(shop)&&FOOD.has(shop.product)&&
      shop.area_id===n.area_id&&shop.open&&shop.stock>0&&
      (!BUSINESS.owned(world,shop)||BUSINESS.presence(world,shop))&&
      n.coins>=BUSINESS.price(world,shop,PRICE[shop.product]))
    .map(shop=>({shop,at:location(world,shop)}))
    .sort((a,b)=>distance(n,a.at.x,a.at.y)-distance(n,b.at.x,b.at.y)||
      a.shop.id.localeCompare(b.shop.id));
  if(!choices.length)continue;
  const choice=choices[0];
  state.goals[n.id]={npc_id:n.id,shop_id:choice.shop.id,
    assigned_minute:minute,expires_minute:minute+300};
  out.push(event(world,minute,'npc.trade.planned',
    n.name+' set out to buy food at '+choice.shop.name+'.',
    {npc_id:n.id,business_id:choice.shop.id,area_id:n.area_id}));
 }
}
function destination(world,n){
 const goal=world.living.npc_trade?.goals[n.id];
 if(!goal)return null;
 const shop=world.living.businesses[goal.shop_id];
 if(!shop||shop.area_id!==n.area_id)return null;
 const spot=location(world,shop);
 return {area_id:shop.area_id,x:spot.x,y:spot.y};
}
function purchase(world,minute,out,serveId=null){
 if(minute%5!==0&&serveId===null)return;
 const state=world.living.npc_trade;if(!state)return;
 for(const [id,goal] of Object.entries(state.goals)){
  if(serveId!==null&&serveId!==id)continue;
  const n=world.living.npcs[id],shop=world.living.businesses[goal.shop_id];
  if(!n?.alive||!shop||minute>=goal.expires_minute){
   delete state.goals[id];delete state.pending_sales[id];continue;
  }
  const waiting=state.pending_sales[id];
  if(waiting&&minute>=waiting.expires_minute){
   delete state.pending_sales[id];delete state.goals[id];
   state.last_purchase[id]=minute;
   out.push(event(world,minute,'npc.trade.abandoned',
    n.name+' left '+shop.name+' after waiting to be served.',
    {npc_id:id,business_id:shop.id,area_id:shop.area_id}));
   continue;
  }
  if(['flee','defend'].includes(world.living.npc_ai?.brains[id]?.mode))continue;
  const point=location(world,shop);
  if(n.area_id!==shop.area_id||distance(n,point.x,point.y)>1)continue;
  const price=BUSINESS.price(world,shop,PRICE[shop.product]);
  if(!shop.open||shop.stock<1||!price||n.coins<price||
     (BUSINESS.owned(world,shop)&&!BUSINESS.presence(world,shop))||
     shop.coins+price>1e9){
   delete state.goals[id];delete state.pending_sales[id];continue;
  }
  if(BUSINESS.owned(world,shop)&&BUSINESS.presence(world,shop)==='player'&&serveId!==id){
   if(!state.pending_sales[id]){
    state.pending_sales[id]={npc_id:id,shop_id:shop.id,
     queued_minute:minute,expires_minute:minute+MAX_WAIT};
    out.push(event(world,minute,'npc.trade.waiting',
     n.name+' is waiting for the owner at '+shop.name+'.',
     {npc_id:id,business_id:shop.id,area_id:shop.area_id,
      expires_minute:minute+MAX_WAIT}));
   }
   continue;
  }
  // Restocking may have happened earlier inside this same simulation batch.
  reconcile(world);
  const registry=world.entity_registry;
  const backpack='npc_pack_'+n.id,bag=registry.containers[backpack];
  if(!bag){delete state.goals[id];continue;}
  const capacity=Object.values(registry.items)
    .filter(i=>i.parent===backpack).reduce((sum,i)=>sum+i.amount,0);
  if(capacity>=bag.capacity){delete state.goals[id];continue;}
  const vendor='vendor_stock_'+shop.id;
  const item=Object.values(registry.items).find(i=>
    i.parent===vendor&&i.type===shop.product&&i.amount>=1);
  if(!item){delete state.goals[id];continue;}
  let serial;
  if(item.amount===1){item.parent=backpack;serial=item.serial;}
  else{
    item.amount--;
    serial='ent_'+registry.next_serial++;
    registry.items[serial]={serial,kind:'item',type:shop.product,amount:1,
      parent:backpack,created_minute:minute};
  }
  n.coins-=price;shop.coins+=price;shop.stock--;shop.sales++;
  const serving=BUSINESS.owned(world,shop)?BUSINESS.presence(world,shop):null;
  if(BUSINESS.owned(world,shop))BUSINESS.recordSale(world,shop,serving,price,out);
  state.last_purchase[id]=minute;state.purchases++;
  delete state.goals[id];delete state.pending_sales[id];
  out.push(event(world,minute,'business.trade',
    n.name+' bought '+shop.product+' at '+shop.name+'.',
    {npc_id:id,business_id:shop.id,area_id:shop.area_id,
      item_serial:serial,units:1,revenue:price,served_by:serving||shop.owner_id}));
 }
}
function consume(world,n,minute,out){
 if(!n.alive||n.hunger<10||!world.entity_registry)return false;
 const reserved=world.living.caravans?.active?.cargo_serial;
 const item=pack(world,n).find(i=>FOOD.has(i.type)&&i.serial!==reserved);
 if(!item)return false;
 if(item.amount===1)delete world.entity_registry.items[item.serial];
 else item.amount--;
 n.hunger=Math.max(0,n.hunger-(item.type==='meals'?38:25));
 out.push(event(world,minute,'npc.food.eaten',
  n.name+' ate food from their own backpack.',
  {npc_id:n.id,item:item.type,item_serial:item.serial,area_id:n.area_id}));
 return true;
}
function validate(world){
 const state=world.living?.npc_trade;
 if(!state)return true;
 if(state.schema!==1||!state.goals||!state.last_purchase||
   (state.pending_sales!==undefined&&
    (!state.pending_sales||Array.isArray(state.pending_sales)||
     typeof state.pending_sales!=='object'))||
   !Number.isSafeInteger(state.purchases)||state.purchases<0||
   Object.keys(state.goals).length>MAX_GOALS||
   Object.keys(state.pending_sales||{}).length>MAX_GOALS)
  throw Error('Invalid physical NPC trade state');
 for(const [id,g] of Object.entries(state.goals)){
  if(!world.living.npcs[id]||g.npc_id!==id||
   !world.living.businesses[g.shop_id]||
   !Number.isSafeInteger(g.assigned_minute)||g.assigned_minute<0||
   !Number.isSafeInteger(g.expires_minute)||
   g.expires_minute!==g.assigned_minute+300)
   throw Error('Invalid NPC customer travel goal');
 }
 for(const [id,p] of Object.entries(state.pending_sales||{})){
  const goal=state.goals[id];
  if(!goal||p.npc_id!==id||p.shop_id!==goal.shop_id||
   !BUSINESS.owned(world,world.living.businesses[p.shop_id])||
   !Number.isSafeInteger(p.queued_minute)||p.queued_minute<0||
   !Number.isSafeInteger(p.expires_minute)||
   p.expires_minute!==p.queued_minute+MAX_WAIT)
   throw Error('Invalid pending NPC customer transaction');
 }
 for(const [id,minute] of Object.entries(state.last_purchase))
  if(!world.living.npcs[id]||!Number.isSafeInteger(minute)||minute<0)
   throw Error('Invalid NPC purchase history');
 return true;
}
function listing(world){
 const s=world.living?.npc_trade;
 return {world_minute:world.living?.minute||0,
   recorded_purchases:s?.purchases||0,
   waiting_customers:Object.values(s?.pending_sales||{}).map(wait=>{
    const n=world.living?.npcs?.[wait.npc_id],shop=world.living?.businesses?.[wait.shop_id];
    return {npc_id:wait.npc_id,npc_name:n?.name||wait.npc_id,
     business_id:wait.shop_id,business_name:shop?.name||wait.shop_id,
     queued_minute:wait.queued_minute,expires_minute:wait.expires_minute,
     price:shop?BUSINESS.price(world,shop,PRICE[shop.product]):0,
     near_owner:!!(shop&&BUSINESS.presence(world,shop)==='player')};
   }),
   active_shoppers:Object.values(s?.goals||{}).map(g=>({
    npc_id:g.npc_id,shop_id:g.shop_id,
    expires_minute:g.expires_minute}))};
}

function serve(world,command){
 if(!command||typeof command!=='object'||Array.isArray(command)||
  command.action!=='serve_customer'||
  Object.keys(command).sort().join(',')!=='action,business_id,npc_id'||
  typeof command.npc_id!=='string'||typeof command.business_id!=='string')
  throw Error('Invalid customer service command');
 if(!world.runtime?.running)throw Error('World is paused');
 const player=world.characters?.['1'],shop=world.living?.businesses?.[command.business_id];
 if(!player||player.form!=='living'||player.crafting?.incapacitated||
  !shop||!BUSINESS.owned(world,shop)||BUSINESS.presence(world,shop)!=='player')
  throw Error('Stand at your own storefront to serve a waiting customer');
 const queued=world.living?.npc_trade?.pending_sales?.[command.npc_id],
  goal=world.living?.npc_trade?.goals?.[command.npc_id],
  npc=world.living?.npcs?.[command.npc_id];
 if(!queued||!goal||goal.shop_id!==shop.id||queued.shop_id!==shop.id||
  world.living.minute>=queued.expires_minute||
  !npc?.alive||npc.area_id!==shop.area_id)
  throw Error('This NPC is not waiting to buy from you');
 const pt=location(world,shop);
 if(distance(npc,pt.x,pt.y)>1)
  throw Error('The customer left the counter');
 const next=structuredClone(world),c=next.characters['1'],events=[];
 purchase(next,next.living.minute,events,command.npc_id);
 const sale=events.find(e=>e.type==='business.trade'&&e.npc_id===command.npc_id);
 if(!sale)throw Error('The customer could not complete this purchase');
 c.revision++;next.revision++;
 validate(next);
 return {world:next,character:c,event:sale,events};
}
module.exports={MAX_WAIT,ensure,validate,plan,destination,purchase,consume,listing,serve};
