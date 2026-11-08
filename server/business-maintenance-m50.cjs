'use strict';
// M50: physical workshop breakdowns, repairs and hired repair jobs.
// A machine fails only after real production wear or a real monster raid.
// Player-owned workshops require an owner decision; NPC-owned ones may
// self-repair when a living worker is physically at the station and paid.
const VENDORS=require('./vendors-m18.cjs');
const SKILLS=require('./skills-m14.cjs');
const ENTITIES=require('./entity-registry-m10.cjs');
const MACHINES=Object.freeze(['village_smithy','village_bakery','village_tavern']);
const COST=20,REPAIR_TIME=60;
function ensure(world){
 if(!world.living)throw Error('Workshop maintenance needs a living world');
 let changed=false;
 if(!world.living.maintenance){
  world.living.maintenance={schema:1,shops:{}};changed=true;
 }
 for(const id of MACHINES)if(!world.living.maintenance.shops[id]){
  world.living.maintenance.shops[id]={id,wear:0,broken:false,failed_minute:-1,
   breakdowns:0,repairs:0,pending:null};
  changed=true;
 }
 return changed;
}
function validate(world){
 const s=world.living?.maintenance;
 if(!s)return true;
 if(s.schema!==1||!s.shops||Array.isArray(s.shops)||
  Object.keys(s.shops).length!==MACHINES.length)
  throw Error('Invalid maintenance save');
 for(const id of MACHINES){
  const r=s.shops[id];if(!r||r.id!==id||typeof r.broken!=='boolean'||
   !Number.isSafeInteger(r.wear)||r.wear<0||r.wear>100||
   r.broken!==(r.wear===100)||
   !Number.isSafeInteger(r.failed_minute)||r.failed_minute<-1||
   !Number.isSafeInteger(r.repairs)||r.repairs<0||r.repairs>1e7||
   !Number.isSafeInteger(r.breakdowns)||r.breakdowns<0||r.breakdowns>1e7)
   throw Error('Invalid workshop maintenance record');
  if(r.pending){
   const p=r.pending;
   if(!r.broken||!Number.isSafeInteger(p.requested)||p.requested<0||
    !Number.isSafeInteger(p.due)||p.due!==p.requested+REPAIR_TIME||
    p.cost!==COST)throw Error('Invalid workshop repair order');
  }
 }
 return true;
}
function log(world,minute,type,shop,details={},out=null){
 const l=world.living;
 const e={id:'event_'+(++l.event_sequence),minute,type,
  text:shop.name+': '+type.split('.').at(-1).replaceAll('_',' ')+'.',
  area_id:shop.area_id,business_id:shop.id,...details};
 l.events.push(e);if(l.events.length>512)l.events.shift();
 if(out)out.push(e);
 return e;
}
function shopState(world,id){return world.living?.maintenance?.shops?.[id]||null;}
function operational(world,shop){
 const state=shop&&shopState(world,shop.id);
 return !state||!state.broken;
}
function breakMachine(world,shop,minute,out,reason){
 const s=shopState(world,shop.id);
 if(!s||s.broken)return false;
 s.wear=100;s.broken=true;s.failed_minute=minute;s.breakdowns++;
 log(world,minute,'workshop.breakdown',shop,{reason},out);return true;
}
function onProduction(world,shop,minute,out,kind='workshop'){
 ensure(world);
 const s=shopState(world,shop.id);if(!s)return false;
 if(s.broken)throw Error('The workshop cannot produce with broken machinery');
 const cost=kind==='mill'?9:kind==='manual'?16:22;
 s.wear=Math.min(100,s.wear+cost);
 if(s.wear>=100)return breakMachine(world,shop,minute,out,'production_wear');
 return false;
}
function damageArea(world,area_id,minute,out){
 ensure(world);
 const choices=MACHINES.filter(id=>{
  const shop=world.living.businesses[id];
  return shop?.area_id===area_id&&!shopState(world,id).broken;
 });
 if(!choices.length)return false;
 const id=choices[minute%choices.length];
 return breakMachine(world,world.living.businesses[id],minute,out,'monster_raid');
}
function near(world,character,shop){
 if(!character||character.area_id!==shop.area_id)return false;
 const p=VENDORS.location(world,shop);
 return Math.abs(character.x-p.x)+Math.abs(character.y-p.y)<=3;
}
function fix(world,shop,minute,out,method){
 const r=shopState(world,shop.id),worker=world.living.npcs[shop.owner_id];
 const repair=r.pending;
 if(method==='hire'&&repair){
  if(!worker?.alive||worker.coins+COST>1e9)throw Error('Worker cannot receive repair wages');
  worker.coins+=repair.cost;
 }
 if(method==='manual'&&repair){
  if(shop.coins+repair.cost>1e9)throw Error('Repair escrow exceeds the business treasury');
  shop.coins+=repair.cost;
 }
 r.wear=0;r.broken=false;r.pending=null;r.repairs++;
 return log(world,minute,'workshop.repaired',shop,{method},out);
}
function apply(world,command){
 const action=command?.action;
 if(!command||typeof command!=='object'||Array.isArray(command)||
  !['repair_workshop','hire_repair'].includes(action)||
  Object.keys(command).sort().join(',')!=='action,business_id'||
  !MACHINES.includes(command.business_id))
  throw Error('Invalid workshop repair command');
 if(!world.runtime?.running)throw Error('World is paused');
 const p=world.characters?.['1'],shop=world.living.businesses[command.business_id];
 const BUSINESS=require('./player-business-m48.cjs');
 if(!p||p.form!=='living'||p.crafting?.incapacitated||
  !BUSINESS.owned(world,shop)||!near(world,p,shop))
  throw Error('Only the owner standing at the workshop may authorize repairs');
 if(world.living.territories[shop.area_id]?.control!=='settlers')
  throw Error('You cannot repair equipment while the settlement is occupied');
 const next=structuredClone(world),c=next.characters['1'],business=next.living.businesses[shop.id];
 ensure(next);
 const record=shopState(next,shop.id),minute=next.living.minute;
 if(!record.broken)throw Error('The machine does not need repairs');
 let event;
 if(action==='repair_workshop'){
  if((c.inventory?.tools||0)<1)throw Error('You need one spare tool to repair the machinery');
  c.inventory.tools--;
  ENTITIES.reconcile(next);ENTITIES.counts(next);
  SKILLS.ensure(c);SKILLS.practice(c,'tinkering',minute,'workshop:'+shop.id);
  event=fix(next,business,minute,null,'manual');
 }else{
  if(record.pending)throw Error('A paid repair has already been arranged');
  const worker=next.living.npcs[business.owner_id];
  if(!worker?.alive)throw Error('No living worker is available for repairs');
  if(business.coins<COST)throw Error('The business cannot afford a repair contractor');
  business.coins-=COST;record.pending={requested:minute,due:minute+REPAIR_TIME,cost:COST};
  event=log(next,minute,'workshop.repair_ordered',business,
   {npc_id:worker.id,cost:COST,due_minute:minute+REPAIR_TIME});
 }
 c.revision++;next.revision++;validate(next);
 return {world:next,character:c,event};
}
function tick(world,minute,out){
 if(minute%5!==0)return;
 ensure(world);
 for(const id of MACHINES){
  const shop=world.living.businesses[id],record=shopState(world,id);
  if(!shop||!record?.broken)continue;
  if(world.living.territories[shop.area_id]?.control!=='settlers')continue;
  const worker=world.living.npcs[shop.owner_id],point=VENDORS.location(world,shop);
  if(!worker?.alive||worker.area_id!==shop.area_id||
    Math.abs(worker.x-point.x)+Math.abs(worker.y-point.y)>4)continue;
  if(['flee','defend'].includes(world.living.npc_ai?.brains[worker.id]?.mode))
   continue;
  if(record.pending){
   if(minute>=record.pending.due)fix(world,shop,minute,out,'hire');
  }else if(!world.living.player_business?.shops?.[id]&&
   minute-record.failed_minute>=120&&shop.coins>=COST&&worker.coins+COST<=1e9){
   shop.coins-=COST;worker.coins+=COST;
   record.broken=false;record.wear=0;record.repairs++;
   log(world,minute,'workshop.repaired',shop,{method:'npc',cost:COST},out);
  }
 }
}
function listing(world){
 const s=world.living?.maintenance?.shops||{};
 const p=world.characters?.['1'];
 return {world_minute:world.living?.minute||0,
  shops:MACHINES.map(id=>{
   const shop=world.living?.businesses?.[id],r=s[id];
   return {id,name:shop?.name||id,...r,
    near:!!(p&&shop&&near(world,p,shop)),
    owned:!!world.living?.player_business?.shops?.[id]};
  })};
}
module.exports={MACHINES,COST,REPAIR_TIME,ensure,validate,operational,
 onProduction,damageArea,apply,tick,listing};
