'use strict';
// M62: resource-backed garrison care and duty rotation.
// Actual vendor stock, item serials, worker presence and NPC coins pay for care.
const E=require('./entity-registry-m10.cjs');
const V=require('./vendors-m18.cjs');
const B=require('./player-business-m48.cjs');
const {VILLAGE,COURT}=require('./regions.cjs');
const HEAL_AT=75,MAX_PATIENTS=128,INTERVAL=30;
const REMEDIES=Object.freeze([
 {shop_id:'village_market',type:'bandages',count:1,base_cost:6,heal:30},
 {shop_id:'village_tavern',type:'meals',count:1,base_cost:4,heal:12},
 {shop_id:'courtyard_market',type:'herbs',count:2,base_cost:5,heal:18}
]);
function patient(n){
 return {npc_id:n.id,last_treated_minute:-1,treatments:0,spent:0,healed:0};
}
function ensure(world){
 if(!world.living)throw Error('Garrison medicine requires a living world');
 let changed=false;
 if(!world.living.garrison){
  world.living.garrison={schema:1,last_tick_minute:-1,
   total_treatments:0,total_healed:0,total_paid:0,patients:{}};
  changed=true;
 }
 const state=world.living.garrison;
 for(const n of Object.values(world.living.npcs)){
  if(!['guard','escort'].includes(n.role)||state.patients[n.id])continue;
  if(Object.keys(state.patients).length>=MAX_PATIENTS)
   throw Error('Too many garrison patients');
  state.patients[n.id]=patient(n);changed=true;
 }
 return changed;
}
function validate(world){
 const g=world.living?.garrison;if(!g)return true; // M61 save migration
 if(g.schema!==1||!g.patients||Array.isArray(g.patients)||
    Object.keys(g.patients).length>MAX_PATIENTS||
    !Number.isSafeInteger(g.last_tick_minute)||g.last_tick_minute<-1||
    g.last_tick_minute>world.living.minute)
  throw Error('Invalid garrison care state');
 const totals={total_treatments:0,total_healed:0,total_paid:0};
 for(const [id,p] of Object.entries(g.patients)){
  if(!p||p.npc_id!==id||!['guard','escort'].includes(world.living.npcs[id]?.role)||
    !Number.isSafeInteger(p.last_treated_minute)||
    p.last_treated_minute<-1||p.last_treated_minute>world.living.minute||
    !Number.isSafeInteger(p.treatments)||p.treatments<0||
    !Number.isSafeInteger(p.spent)||p.spent<0||
    !Number.isSafeInteger(p.healed)||p.healed<0)
   throw Error('Invalid garrison patient record');
  totals.total_treatments+=p.treatments;
  totals.total_healed+=p.healed;
  totals.total_paid+=p.spent;
 }
 for(const [name,count] of Object.entries(totals))
  if(!Number.isSafeInteger(g[name])||g[name]<count)
   throw Error('Invalid garrison treatment totals');
 return true;
}
const distance=(n,p)=>Math.abs(n.x-p.x)+Math.abs(n.y-p.y);
function available(world,n,rule){
 const shop=world.living.businesses[rule.shop_id];
 if(!shop||!shop.open||n.area_id!==shop.area_id||
   world.living.territories[shop.area_id]?.control!=='settlers')return null;
 const owner=B.owned(world,shop),serving=owner?B.presence(world,shop):shop.owner_id;
 // Store hours can lag actual movement: never invent medical service from an
 // evacuated, deceased, or otherwise absent employee.
 const worker=world.living.npcs[shop.owner_id],door=V.location(world,shop);
 if(owner&&(!serving||serving==='player'))return null;
 if(!owner&&(!worker?.alive||worker.area_id!==shop.area_id||
   Math.abs(worker.x-door.x)+Math.abs(worker.y-door.y)>6))return null;
 const stock=rule.type===shop.product?shop.stock:shop.other_stock?.[rule.type]||0;
 const cost=B.price(world,shop,rule.base_cost);
 if(stock<rule.count||n.coins<cost||shop.coins+cost>1e9)return null;
 return {shop,point:V.location(world,shop),cost,rule,serving};
}
function choose(world,n){
 if(!n.alive||n.health>=HEAL_AT||
  !['guard','escort'].includes(n.role))return null;
 return REMEDIES.map(r=>available(world,n,r)).filter(Boolean)
  .sort((a,b)=>distance(n,a.point)-distance(n,b.point)||
    b.rule.heal-a.rule.heal||a.shop.id.localeCompare(b.shop.id))[0]||null;
}
function destination(world,n){
 const offer=choose(world,n);if(!offer)return null;
 return {area_id:n.area_id,x:offer.point.x,y:offer.point.y};
}
function take(registry,bag,type,count){
 const rows=Object.values(registry.items).filter(i=>i.parent===bag&&i.type===type)
  .sort((a,b)=>Number(a.serial.slice(4))-Number(b.serial.slice(4)));
 if(rows.reduce((s,i)=>s+i.amount,0)<count)return null;
 const taken=[];let remain=count;
 for(const item of rows){
  if(!remain)break;
  const units=Math.min(remain,item.amount);remain-=units;
  item.amount-=units;taken.push({serial:item.serial,amount:units});
  if(!item.amount)delete registry.items[item.serial];
 }
 return taken;
}
function event(world,minute,n,offer,source,heal,events){
 const l=world.living,e={id:'event_'+(++l.event_sequence),
  minute,type:'garrison.treated',text:n.name+' received care at '+offer.shop.name+'.',
  npc_id:n.id,area_id:n.area_id,business_id:offer.shop.id,
  item_type:offer.rule.type,units:offer.rule.count,item_serials:source,
  healed:heal,cost:offer.cost};
 l.events.push(e);if(l.events.length>512)l.events.shift();
 events.push(e);
}
function tick(world,minute,events){
 if(!Number.isSafeInteger(minute)||minute<0)throw Error('Invalid treatment minute');
 if(minute%INTERVAL!==0)return 0;
 ensure(world);
 const g=world.living.garrison;
 if(minute<=g.last_tick_minute)return 0;
 let treated=0;
 for(const n of Object.values(world.living.npcs).filter(n=>n.alive&&
  ['guard','escort'].includes(n.role)).sort((a,b)=>a.id.localeCompare(b.id))){
  const p=g.patients[n.id],offer=choose(world,n);
  if(!offer||distance(n,offer.point)>2||
    p.last_treated_minute>minute-INTERVAL)continue;
  // Reconcile earlier NPC purchases or workshop runs before consuming the
  // actual vendor item serials. Mirrors and physical registry change together.
  E.reconcile(world);
  const reg=world.entity_registry,bag=V.inventoryId(offer.shop);
  const rows=Object.values(reg.items).filter(i=>i.parent===bag&&
    i.type===offer.rule.type).reduce((s,i)=>s+i.amount,0);
  if(rows<offer.rule.count)continue;
  const taken=take(reg,bag,offer.rule.type,offer.rule.count);
  if(!taken)continue;
  if(offer.shop.product===offer.rule.type)offer.shop.stock-=offer.rule.count;
  else offer.shop.other_stock[offer.rule.type]-=offer.rule.count;
  n.coins-=offer.cost;offer.shop.coins+=offer.cost;offer.shop.sales++;
  if(B.owned(world,offer.shop))
   B.recordSale(world,offer.shop,offer.serving,offer.cost,events);
  const heal=Math.min(100-n.health,offer.rule.heal);
  n.health+=heal;n.energy=Math.min(100,n.energy+Math.floor(heal/2));
  n.hunger=Math.max(0,n.hunger-(offer.rule.type==='meals'?25:0));
  p.last_treated_minute=minute;p.treatments++;p.spent+=offer.cost;p.healed+=heal;
  g.total_treatments++;g.total_healed+=heal;g.total_paid+=offer.cost;
  event(world,minute,n,offer,taken,heal,events);
  treated++;
 }
 g.last_tick_minute=minute;
 if(treated)E.counts(world);
 return treated;
}
function listing(world,area_id=null){
 const g=world.living.garrison;
 return {world_minute:world.living.minute,total_treatments:g?.total_treatments||0,
  total_healed:g?.total_healed||0,total_paid:g?.total_paid||0,
  patients:Object.entries(g?.patients||{})
   .filter(([id])=>!area_id||world.living.npcs[id]?.area_id===area_id)
   .map(([id,p])=>{
    const n=world.living.npcs[id];
    return {npc_id:id,alive:!!n?.alive,area_id:n?.area_id||null,
     health:n?.health??0,coins:n?.coins??0,
     last_treated_minute:p.last_treated_minute,treatments:p.treatments,spent:p.spent};
   }).sort((a,b)=>a.npc_id.localeCompare(b.npc_id))};
}
module.exports={REMEDIES,HEAL_AT,INTERVAL,ensure,validate,available,choose,
 destination,take,tick,listing};
