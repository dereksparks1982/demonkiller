'use strict';
// M48: player-owned existing village businesses with assistant or owner service.
// Original DK Server code; no RunUO source. Shop.owner_id remains its existing
// worker/job-holder key so NPC schedules and succession continue uninterrupted.
const VENDORS=require('./vendors-m18.cjs');
const SKILLS=require('./skills-m14.cjs');
const COSTS=Object.freeze({
 village_bakery:150,village_market:130,village_smithy:190,
 village_tavern:165,courtyard_market:115
});
const PRICE_MODES=Object.freeze(['budget','standard','premium']);
const RESERVE=20,MAX_SHOPS=5,MAX_LEDGER=64;
function ensure(world){
 if(!world.living)throw Error('Player businesses require a living world');
 if(world.living.player_business)return false;
 world.living.player_business={schema:1,shops:{},transactions:[],sequence:0};return true;
}
function validate(world){
 const state=world.living?.player_business;if(!state)return true;
 if(state.schema!==1||!state.shops||Array.isArray(state.shops)||
  Object.keys(state.shops).length>MAX_SHOPS||!Array.isArray(state.transactions)||
  state.transactions.length>MAX_LEDGER||
  !Number.isSafeInteger(state.sequence)||state.sequence<0)
  throw Error('Invalid player business ledger');
 for(const [id,s]of Object.entries(state.shops))
  if(!Object.hasOwn(COSTS,id)||!world.living.businesses[id]||
   !s||s.id!==id||s.owner_slot!==1||
   !PRICE_MODES.includes(s.price_mode)||
   typeof s.assistant_enabled!=='boolean'||typeof s.production_enabled!=='boolean'||
   !Number.isSafeInteger(s.acquired_minute)||s.acquired_minute<0||
   !Number.isSafeInteger(s.acquisition_cost)||s.acquisition_cost!==COSTS[id]||
   !Number.isSafeInteger(s.owner_sales)||s.owner_sales<0||
   !Number.isSafeInteger(s.assistant_sales)||s.assistant_sales<0||
   !Number.isSafeInteger(s.drawn)||s.drawn<0||
   !Number.isSafeInteger(s.invested)||s.invested<0)
   throw Error('Invalid player business ownership');
 for(const item of state.transactions)
  if(!item||!Number.isSafeInteger(item.sequence)||item.sequence<1||
   !Object.hasOwn(COSTS,item.business_id)||!Number.isSafeInteger(item.minute)||
   item.minute<0||!['acquired','price','assistant','production','invest','draw','stock_in','stock_out','sale'].includes(item.action)||
   !Number.isSafeInteger(item.amount)||item.amount<0||item.amount>1e9)
   throw Error('Invalid player business transaction');
 return true;
}
function log(world,action,shop,amount,details={},out=null){
 const l=world.living,s=l.player_business,minute=l.minute;
 const item={sequence:++s.sequence,minute,action,business_id:shop.id,amount,...details};
 s.transactions.push(item);
 if(s.transactions.length>MAX_LEDGER)s.transactions.shift();
 const e={id:'event_'+(++l.event_sequence),minute,type:'business.player.'+action,
  text:shop.name+': '+action.replaceAll('_',' ')+'.',
  business_id:shop.id,amount,slot:1,...details};
 l.events.push(e);if(l.events.length>512)l.events.shift();
 if(out)out.push(e);
 return e;
}
function distance(a,b){return Math.abs(a.x-b.x)+Math.abs(a.y-b.y);}
function atShop(world,character,shop,range=3){
 if(!shop||character.area_id!==shop.area_id)return false;
 const pt=VENDORS.location(world,shop);
 return distance(character,pt)<=range;
}
function owned(world,shop){return world.living?.player_business?.shops?.[shop.id]||null;}
function presence(world,shop){
 const p=world.characters?.['1'],record=owned(world,shop);
 if(record&&p?.form==='living'&&!p.crafting?.incapacitated&&
  atShop(world,p,shop,3))return 'player';
 const n=world.living.npcs[shop.owner_id],pt=VENDORS.location(world,shop);
 if(n?.alive&&n.area_id===shop.area_id&&distance(n,pt)<=6&&
  (!record||record.assistant_enabled)&&
  !['flee','defend'].includes(world.living.npc_ai?.brains[n.id]?.mode))
  return 'assistant';
 return null;
}
function productionEnabled(world,shop){return !owned(world,shop)||owned(world,shop).production_enabled;}
function price(world,shop,base){
 const mode=owned(world,shop)?.price_mode||'standard';
 return mode==='budget'?Math.max(1,Math.floor(base*3/4)):
  mode==='premium'?Math.max(1,Math.ceil(base*3/2)):base;
}
function recordSale(world,shop,who,amount,out=null){
 const record=owned(world,shop);
 if(!record)return null;
 if(who==='player')record.owner_sales++;
 else record.assistant_sales++;
 return log(world,'sale',shop,amount,{served_by:who||'assistant'},out);
}
function apply(world,command){
 const verbs={buy_business:'action,business_id',
  set_business_price:'action,business_id,price_mode',
  set_assistant:'action,business_id,enabled',
  set_production:'action,business_id,enabled',
  invest_business:'action,amount,business_id',
  draw_business:'action,amount,business_id',
  stock_business:'action,business_id,item_type,quantity',
  take_business_stock:'action,business_id,item_type,quantity'};
 if(!command||typeof command!=='object'||Array.isArray(command)||
  !Object.hasOwn(verbs,command.action)||
  Object.keys(command).sort().join(',')!==verbs[command.action])
  throw Error('Invalid business management action');
 if(!world.runtime?.running)throw Error('World is paused');
 const first=world.characters?.['1'];
 if(!first||first.form!=='living'||first.crafting?.incapacitated)
  throw Error('Only a living, conscious character may manage a business');
 const id=command.business_id,shop=world.living.businesses?.[id];
 if(!Object.hasOwn(COSTS,id)||!shop||!VENDORS.merchandises(shop))
  throw Error('This existing business is not available for acquisition');
 if(!atShop(world,first,shop))throw Error('Stand beside the business entrance');
 if(world.living.territories[shop.area_id]?.control!=='settlers')
  throw Error('The settlement is occupied; business management is suspended');
 const next=structuredClone(world),l=next.living,c=next.characters['1'];
 ensure(next);const state=l.player_business,b=l.businesses[id],record=state.shops[id];
 const action=command.action,minute=l.minute;
 let event;
 if(action==='buy_business'){
  if(record)throw Error('This business is already owned by the character');
  const seller=l.npcs[b.owner_id],cost=COSTS[id];
  if(!seller?.alive)throw Error('The proprietor is unavailable to sell');
  if(c.gold<cost)throw Error('You do not have enough gold to buy this business');
  if(seller.coins+cost>1e9)throw Error('The proprietor cannot receive that much money');
  c.gold-=cost;seller.coins+=cost;
  state.shops[id]={id,owner_slot:1,acquired_minute:minute,
   acquisition_cost:cost,price_mode:'standard',assistant_enabled:true,
   production_enabled:true,owner_sales:0,assistant_sales:0,drawn:0,invested:0};
  event=log(next,'acquired',b,cost,{seller_id:seller.id});
 }else{
  if(!record)throw Error('You do not own this business');
  if(action==='set_business_price'){
   if(!PRICE_MODES.includes(command.price_mode))
    throw Error('Unknown price category');
   if(record.price_mode===command.price_mode)throw Error('Price category is unchanged');
   record.price_mode=command.price_mode;
   event=log(next,'price',b,0,{price_mode:command.price_mode});
  }else if(action==='set_assistant'||action==='set_production'){
   if(typeof command.enabled!=='boolean')throw Error('Invalid management switch');
   const key=action==='set_assistant'?'assistant_enabled':'production_enabled';
   if(record[key]===command.enabled)throw Error('Management switch is unchanged');
   record[key]=command.enabled;
   event=log(next,action==='set_assistant'?'assistant':'production',b,0,{enabled:command.enabled});
  }else if(action==='invest_business'||action==='draw_business'){
   if(!Number.isSafeInteger(command.amount)||command.amount<1||command.amount>1000)
    throw Error('Invalid business currency amount');
   const amount=command.amount;
   if(action==='invest_business'){
    if(c.gold<amount)throw Error('Not enough gold to invest');
    if(b.coins+amount>1e9)throw Error('The business treasury is full');
    c.gold-=amount;b.coins+=amount;record.invested+=amount;
   }else{
    if(b.coins-amount<RESERVE)throw Error('The business must retain its operating reserve');
    if(c.gold+amount>1e9)throw Error('You cannot carry that much gold');
    b.coins-=amount;c.gold+=amount;record.drawn+=amount;
   }
   event=log(next,action==='invest_business'?'invest':'draw',b,amount);
  }else{
   const item=command.item_type,quantity=command.quantity;
   if(!VENDORS.GOODS.has(item)||!Number.isSafeInteger(quantity)||
    quantity<1||quantity>20)throw Error('Invalid business stock transfer');
   const balance=item===b.product?b.stock:(b.other_stock?.[item]||0);
   if(action==='stock_business'){
    if((c.inventory?.[item]||0)<quantity)throw Error('You do not have those goods');
    if(VENDORS.total(b)+quantity>VENDORS.CAPACITY)
     throw Error('The storeroom is full');
    c.inventory[item]-=quantity;
    if(item===b.product)b.stock+=quantity;
    else b.other_stock[item]=(b.other_stock[item]||0)+quantity;
   }else{
    if(balance<quantity)throw Error('Not enough goods in the storeroom');
    const pack=Object.values(c.inventory||{}).reduce((n,x)=>n+x,0);
    if(pack+quantity>200||(c.inventory[item]||0)+quantity>200)
     throw Error('Your backpack is full');
    c.inventory[item]+=quantity;
    if(item===b.product)b.stock-=quantity;
    else b.other_stock[item]-=quantity;
   }
   // Preserve already-existing serial identities when goods move.
   const E=require('./entity-registry-m10.cjs');
   E.reconcile(next);E.counts(next);
   event=log(next,action==='stock_business'?'stock_in':'stock_out',b,quantity,
    {item_type:item,quantity});
  }
 }
 c.revision++;next.revision++;
 validate(next);
 return {world:next,character:c,event};
}
function listing(world){
 const s=world.living?.player_business;
 return {world_minute:world.living?.minute||0,ownership:s?.shops||{},
  ledger:s?.transactions?.slice(-25)||[],
  businesses:Object.keys(COSTS).map(id=>{
   const shop=world.living?.businesses?.[id];if(!shop)return {id};
   const ownership=owned(world,shop);
   return {id,name:shop.name,area_id:shop.area_id,product:shop.product,
    cost:COSTS[id],stock:shop.stock,other_stock:shop.other_stock||{},
    coins:shop.coins,open:shop.open,owner:!!ownership,
    worker_id:shop.owner_id,on_duty:presence(world,shop),
    near:!!(world.characters?.['1']&&atShop(world,world.characters['1'],shop)),
    ...(ownership?{price_mode:ownership.price_mode,
     assistant_enabled:ownership.assistant_enabled,
     production_enabled:ownership.production_enabled,
     owner_sales:ownership.owner_sales,assistant_sales:ownership.assistant_sales}:{} )};
  })};
}
module.exports={COSTS,PRICE_MODES,RESERVE,ensure,validate,atShop,owned,presence,
 productionEnabled,price,recordSale,apply,listing};
