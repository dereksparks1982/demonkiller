'use strict';
// DK Server M66: real siege damage, paid crews, serialized freight and rebuilding.
// Independent DK Softworks implementation, no third-party RunUO source.
const {COURT,VILLAGE}=require('./regions.cjs');
const V=require('./vendors-m18.cjs');
const E=require('./entity-registry-m10.cjs');
const BUSINESS=require('./player-business-m48.cjs');
const AREAS=Object.freeze([COURT,VILLAGE]);
const SOURCE=Object.freeze({[VILLAGE]:'village_smithy',[COURT]:'courtyard_market'});
const WORKER=Object.freeze({[VILLAGE]:'blacksmith',[COURT]:'courtyard_keeper'});
const MATERIALS=Object.freeze({wood:2,tools:1});
const MATERIAL_COST=16,WAGE=6,REPAIR=25,LABOR_MINUTES=30,INTERVAL=5;
const MAX_SITES=32,MAX_HISTORY=128;
const dist=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
function site(shop){return {id:shop.id,area_id:shop.area_id,damage:0,
 damaged_minute:-1,last_repair_minute:-1,raids:0,repairs:0,
 material_units:0,material_spend:0,wages:0};}
function ensure(world){
 if(!world?.living)throw Error('Reconstruction requires a living world');
 let changed=false;
 if(!world.living.reconstruction){
  world.living.reconstruction={schema:1,last_tick_minute:-1,
   sites:{},jobs:{[COURT]:null,[VILLAGE]:null},
   total_damage:0,total_repaired:0,total_spent:0,
   history:[]};
  changed=true;
 }
 const s=world.living.reconstruction;
 for(const shop of Object.values(world.living.businesses||{})){
  if(!AREAS.includes(shop.area_id)||s.sites[shop.id])continue;
  if(Object.keys(s.sites).length>=MAX_SITES)throw Error('Too many reconstruction sites');
  s.sites[shop.id]=site(shop);changed=true;
 }
 return changed;
}
function validate(world){
 const s=world.living?.reconstruction;
 if(!s)return true; // Pre-M66 saves migrate without modifying shops.
 if(s.schema!==1||!s.sites||!s.jobs||!Array.isArray(s.history)||
  Object.keys(s.sites).length>MAX_SITES||s.history.length>MAX_HISTORY||
  !Number.isSafeInteger(s.last_tick_minute)||s.last_tick_minute< -1||
  s.last_tick_minute>world.living.minute)
  throw Error('Invalid reconstruction ledger');
 for(const k of ['total_damage','total_repaired','total_spent'])
  if(!Number.isSafeInteger(s[k])||s[k]<0||s[k]>1e9)
   throw Error('Invalid reconstruction totals');
 for(const [id,r] of Object.entries(s.sites)){
  const shop=world.living.businesses[id];
  if(!shop||r.id!==id||r.area_id!==shop.area_id||
   !Number.isSafeInteger(r.damage)||r.damage<0||r.damage>100||
   !Number.isSafeInteger(r.damaged_minute)||r.damaged_minute< -1||
   r.damaged_minute>world.living.minute||
   !Number.isSafeInteger(r.last_repair_minute)||r.last_repair_minute< -1||
   r.last_repair_minute>world.living.minute||
   ['raids','repairs','material_units','material_spend','wages'].some(k=>
    !Number.isSafeInteger(r[k])||r[k]<0||r[k]>1e9))
   throw Error('Invalid reconstruction site');
 }
 for(const id of AREAS){
  if(!Object.hasOwn(s.jobs,id))throw Error('Missing reconstruction work zone');
  const j=s.jobs[id];if(!j)continue;
  if(j.area_id!==id||!s.sites[j.target_id]||
   s.sites[j.target_id].area_id!==id||s.sites[j.target_id].damage===0||
   j.source_id!==SOURCE[id]||typeof j.worker_id!=='string'||
   !world.living.npcs[j.worker_id]||
   !['to_supply','to_site','working'].includes(j.phase)||
   !Number.isSafeInteger(j.started_minute)||j.started_minute<0||
   j.started_minute>world.living.minute||
   !Number.isSafeInteger(j.loaded_minute)||j.loaded_minute< -1||
   j.loaded_minute>world.living.minute||
   !Number.isSafeInteger(j.work_started_minute)||j.work_started_minute< -1||
   j.work_started_minute>world.living.minute||
   !Array.isArray(j.cargo)||j.cargo.length>8||
   (j.phase==='to_supply'&&j.cargo.length>0)||
   (j.phase!=='to_supply'&&j.cargo.length<2)||
   j.cargo.some(v=>!v||!/^ent_[1-9][0-9]*$/.test(v.serial)||
    !['wood','tools'].includes(v.type)||!Number.isSafeInteger(v.amount)||
    v.amount<1||v.amount>2))
   throw Error('Invalid construction work order');
  // A held material serial may be lost with a killed NPC. Do not
  // resurrect material during validation; the job remains visibly stalled.
 }
 return true;
}
function event(world,minute,type,shop,fields,out){
 const l=world.living,e={id:'event_'+(++l.event_sequence),minute,type,
  area_id:shop.area_id,business_id:shop.id,
  text:shop.name+': '+type.split('.').pop().replaceAll('_',' ')+'.',
  ...fields};
 l.events.push(e);if(l.events.length>512)l.events.shift();
 out?.push(e);
 const s=l.reconstruction;
 s.history.push({minute,type,business_id:shop.id,...fields});
 if(s.history.length>MAX_HISTORY)s.history.shift();
 return e;
}
function damageArea(world,area_id,minute,out=[]){
 if(!AREAS.includes(area_id)||!Number.isSafeInteger(minute)||minute<0)
  throw Error('Invalid reconstruction raid');
 ensure(world);
 const s=world.living.reconstruction;
 const sites=Object.values(s.sites).filter(r=>r.area_id===area_id)
  .sort((a,b)=>a.id.localeCompare(b.id));
 if(!sites.length)return 0;
 // Deterministic selection: repeat handling of a saved occupation is safe
 // because the campaign controller calls this only on its phase transition.
 const count=area_id===VILLAGE?Math.min(2,sites.length):1;
 let damaged=0;
 for(let n=0;n<count;n++){
  const r=sites[(Math.floor(minute/5)+n*3)%sites.length];
  if(r.damage>=100)continue;
  const delta=Math.min(100-r.damage,60+(n%2)*20);
  r.damage+=delta;r.damaged_minute=minute;r.raids++;
  s.total_damage+=delta;damaged++;
  const shop=world.living.businesses[r.id];shop.open=false;
  event(world,minute,'reconstruction.damaged',shop,
   {damage:delta,remaining:r.damage},out);
 }
 return damaged;
}
function operational(world,shop){
 return !world.living?.reconstruction?.sites?.[shop?.id]?.damage;
}
function regionComplete(world,id){
 return Object.values(world.living?.reconstruction?.sites||{})
  .filter(r=>r.area_id===id).every(r=>r.damage===0);
}
function getWorker(world,area_id){
 const shop=world.living.businesses[SOURCE[area_id]];
 const id=area_id===VILLAGE?(shop?.owner_id||WORKER[area_id]):WORKER[area_id];
 return world.living.npcs[id]||null;
}
function eligible(world,shop){
 const own=BUSINESS.owned(world,shop);
 return !own||own.assistant_enabled===true;
}
function sourceReady(world,area_id,target,worker){
 const source=world.living.businesses[SOURCE[area_id]];
 if(!source||!worker?.alive||!target||!eligible(world,target)||
  world.living.territories[area_id]?.control!=='settlers'||
  source.area_id!==area_id||target.area_id!==area_id)return false;
 if(!source.open&&source.id!==target.id)return false;
 const merchant=world.living.npcs[source.owner_id],
  entrance=V.location(world,source);
 if(!merchant?.alive||merchant.area_id!==source.area_id||
   dist(merchant,entrance)>6)return false;
 if(BUSINESS.owned(world,source)&&BUSINESS.presence(world,source)!=='assistant')
  return false;
 if(!Object.values(MATERIALS).every((n,i)=>{
  const type=Object.keys(MATERIALS)[i];
  return (type===source.product?source.stock:source.other_stock?.[type]||0)>=n;
 }))return false;
 const materialsCost=source.id===target.id?0:BUSINESS.price(world,source,MATERIAL_COST);
 return target.coins>=materialsCost+WAGE&&
  (source.id===target.id||source.coins+materialsCost<=1e9);
}
function stockCount(reg,parent,type){
 return Object.values(reg.items).filter(i=>i.parent===parent&&i.type===type)
  .reduce((n,i)=>n+i.amount,0);
}
function transfer(reg,from,to,type,amount,minute){
 const list=Object.values(reg.items).filter(i=>i.parent===from&&i.type===type)
  .sort((a,b)=>Number(a.serial.slice(4))-Number(b.serial.slice(4)));
 if(list.reduce((n,i)=>n+i.amount,0)<amount)return null;
 const taken=[];let left=amount;
 for(const item of list){
  if(!left)break;
  const n=Math.min(item.amount,left);left-=n;
  if(n===item.amount){
   item.parent=to;taken.push({serial:item.serial,type,amount:n});
  }else{
   item.amount-=n;
   const serial='ent_'+reg.next_serial++;
   reg.items[serial]={serial,kind:'item',type,amount:n,
    parent:to,created_minute:minute};
   taken.push({serial,type,amount:n});
  }
 }
 return taken;
}
function cargoValid(world,j){
 const reg=world.entity_registry,pack='npc_pack_'+j.worker_id;
 return j.cargo.length>0&&j.cargo.every(c=>
  reg.items[c.serial]?.parent===pack&&reg.items[c.serial]?.type===c.type&&
   reg.items[c.serial]?.amount===c.amount);
}
function begin(world,area_id,minute,out){
 const s=world.living.reconstruction,source=world.living.businesses[SOURCE[area_id]];
 const worker=getWorker(world,area_id);
 if(!worker?.alive||world.living.territories[area_id]?.control!=='settlers')
  return false;
 const damaged=Object.values(s.sites).filter(r=>r.area_id===area_id&&
  r.damage>0&&eligible(world,world.living.businesses[r.id]))
  .sort((a,b)=>b.damage-a.damage||a.id.localeCompare(b.id));
 if(!damaged.length||!source)return false;
 const target=world.living.businesses[damaged[0].id];
 const order={area_id,target_id:target.id,source_id:source.id,worker_id:worker.id,
  phase:'to_supply',started_minute:minute,loaded_minute:-1,
  work_started_minute:-1,cargo:[]};
 s.jobs[area_id]=order;
 event(world,minute,'reconstruction.assigned',target,
  {worker_id:worker.id,source_id:source.id,remaining:damaged[0].damage},out);
 return true;
}
function destination(world,n){
 const state=world.living?.reconstruction;
 if(!state||!n.alive)return null;
 const order=Object.values(state.jobs).find(j=>j&&j.worker_id===n.id);
 if(!order||order.worker_id!==n.id||!['to_supply','to_site','working'].includes(order.phase)||
  world.living.territories[order.area_id]?.control!=='settlers')
  return null;
 // The blacksmith must finish genuine ore/wood harvesting before accepting
 // a materials-hauling assignment. Otherwise reconstruction would starve
 // its own supply chain by keeping the harvester at the shop forever.
 if(order.phase==='to_supply'&&world.living.npc_harvest?.goals?.[n.id])
  return null;
 const shop=world.living.businesses[order.phase==='to_supply'?
   order.source_id:order.target_id];
 const pt=V.location(world,shop);
 return {area_id:shop.area_id,x:pt.x,y:pt.y};
}
function load(world,j,minute,out){
 const source=world.living.businesses[j.source_id],
  target=world.living.businesses[j.target_id],n=world.living.npcs[j.worker_id];
 if(!sourceReady(world,j.area_id,target,n)||
  world.living.npc_harvest?.goals?.[n.id])return false;
 const point=V.location(world,source);
 if(n.area_id!==source.area_id||dist(n,point)>2)return false;
 E.reconcile(world);
 const reg=world.entity_registry,bag=V.inventoryId(source),
  pack='npc_pack_'+n.id;
 // Old worlds may not yet have a cargo backpack for a craftsman.
 // Creating an empty physical container is safe; creating goods is not.
 if(!reg.containers[pack])reg.containers[pack]={
  id:pack,kind:'npc_pack',owner:'npc:'+n.id,capacity:32
 };
 const container=reg.containers[pack];
 if(container.kind!=='npc_pack')return false;
 const carrying=Object.values(reg.items).filter(i=>i.parent===pack)
  .reduce((sum,item)=>sum+item.amount,0);
 const units=Object.values(MATERIALS).reduce((a,b)=>a+b,0);
 if(carrying+units>container.capacity)return false;
 if(Object.entries(MATERIALS).some(([type,count])=>
   stockCount(reg,bag,type)<count))return false;
 const cargo=[];
 for(const [type,count] of Object.entries(MATERIALS)){
  const moved=transfer(reg,bag,pack,type,count,minute);
  if(!moved)throw Error('Reconstruction materials vanished during checkout');
  cargo.push(...moved);
  if(source.product===type)source.stock-=count;
  else source.other_stock[type]-=count;
 }
 const cost=source.id===target.id?0:BUSINESS.price(world,source,MATERIAL_COST);
 target.coins-=cost;source.coins+=cost;
 if(cost){
  target.expenses+=cost;source.sales++;
  if(BUSINESS.owned(world,source))
   BUSINESS.recordSale(world,source,'assistant',cost,out);
 }
 const site=world.living.reconstruction.sites[target.id];
 site.material_spend+=cost;world.living.reconstruction.total_spent+=cost;
 j.phase='to_site';j.loaded_minute=minute;j.cargo=cargo;
 event(world,minute,'reconstruction.loaded',target,
  {source_id:source.id,worker_id:n.id,units,cargo,cost},out);
 E.counts(world);
 return true;
}
function finish(world,j,minute,out){
 const target=world.living.businesses[j.target_id],
  worker=world.living.npcs[j.worker_id],
  rec=world.living.reconstruction.sites[target.id];
 if(!cargoValid(world,j)||target.coins<WAGE||worker.coins+WAGE>1e9)return false;
 const reg=world.entity_registry;
 for(const c of j.cargo)delete reg.items[c.serial];
 target.coins-=WAGE;target.expenses+=WAGE;worker.coins+=WAGE;
 const done=Math.min(REPAIR,rec.damage);
 rec.damage-=done;rec.repairs++;rec.last_repair_minute=minute;
 rec.material_units+=Object.values(MATERIALS).reduce((a,b)=>a+b,0);
 rec.wages+=WAGE;
 const state=world.living.reconstruction;
 state.total_repaired+=done;state.total_spent+=WAGE;
 state.jobs[j.area_id]=null;
 event(world,minute,'reconstruction.repaired',target,
  {worker_id:worker.id,repair_points:done,remaining:rec.damage,
   wages:WAGE,units:rec.material_units},out);
 if(!rec.damage)
  event(world,minute,'reconstruction.completed',target,
   {worker_id:worker.id},out);
 E.counts(world);
 return true;
}
function tick(world,minute,out){
 if(!Number.isSafeInteger(minute)||minute<0||minute%INTERVAL!==0)
  throw Error('Invalid reconstruction minute');
 ensure(world);
 const s=world.living.reconstruction;
 if(minute<=s.last_tick_minute)return 0;
 let changed=0;
 for(const area of AREAS){
  if(world.living.territories[area]?.control!=='settlers')continue;
  if(!s.jobs[area]){if(begin(world,area,minute,out))changed++;continue;}
  const j=s.jobs[area],n=world.living.npcs[j.worker_id],
   target=world.living.businesses[j.target_id];
  if(!n?.alive){
   // Freight remains under the dead NPC's serialized custody. Never refund,
   // duplicate, or teleport it to the replacement; a new job must repurchase.
   event(world,minute,'reconstruction.worker_lost',target,
    {worker_id:j.worker_id,lost_serials:j.cargo.map(i=>i.serial)},out);
   s.jobs[area]=null;changed++;continue;
  }
  if(!target||!eligible(world,target))continue;
  if(j.phase==='to_supply'){
   if(load(world,j,minute,out))changed++;
  }else{
   const pt=V.location(world,target);
   if(n.area_id!==target.area_id||dist(n,pt)>2){
    j.phase='to_site';j.work_started_minute=-1;continue;
   }
   if(j.phase==='to_site'){
    if(!cargoValid(world,j))continue;
    j.phase='working';j.work_started_minute=minute;
    event(world,minute,'reconstruction.working',target,
     {worker_id:n.id,completes_after_minute:minute+LABOR_MINUTES},out);
    changed++;
   }else if(j.phase==='working'&&minute-j.work_started_minute>=LABOR_MINUTES){
    if(finish(world,j,minute,out))changed++;
   }
  }
 }
 s.last_tick_minute=minute;
 return changed;
}
function listing(world){
 const s=world.living?.reconstruction;
 return {world_minute:world.living.minute,revision:world.revision,
  total_damage:s?.total_damage||0,total_repaired:s?.total_repaired||0,
  total_spent:s?.total_spent||0,
  sites:Object.values(s?.sites||{}).map(r=>({...r,
   name:world.living.businesses[r.id]?.name||r.id})),
  jobs:Object.values(s?.jobs||{}).filter(Boolean),
  sourcing:AREAS.map(area_id=>{
   const source=world.living.businesses[SOURCE[area_id]];
   const worker=getWorker(world,area_id);
   const job=s?.jobs?.[area_id]||null;
   return {area_id,source_id:source?.id||null,worker_id:worker?.id||null,
    worker_alive:worker?.alive||false,job_phase:job?.phase||null,
    wood:source?.other_stock?.wood||(source?.product==='wood'?source.stock:0)||0,
    tools:source?.other_stock?.tools||(source?.product==='tools'?source.stock:0)||0,
    territory:world.living.territories[area_id]?.control||null};
  }),
  history:s?.history?.slice(-32)||[]};
}
module.exports={AREAS,SOURCE,WORKER,MATERIALS,MATERIAL_COST,WAGE,REPAIR,
 LABOR_MINUTES,INTERVAL,ensure,validate,damageArea,operational,
 regionComplete,getWorker,sourceReady,begin,destination,load,finish,tick,listing};
