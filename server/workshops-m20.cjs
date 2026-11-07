'use strict';
// DK Server M20: physical NPC workshop production from purchased ingredients.
// Recipes are server-authored; no player-supplied outputs or RunUO GPL code.
const {location,CAPACITY,total}=require('./vendors-m18.cjs');
const {reconcile,counts}=require('./entity-registry-m10.cjs');
const RECIPES=Object.freeze({
 village_smithy:{label:'Smithing',ingredients:{ore:2,wood:1},
  output:'tools',quantity:1,wage:2},
 village_bakery:{label:'Baking',ingredients:{produce:2},
  output:'bread',quantity:2,wage:2},
 village_tavern:{label:'Cooking',ingredients:{produce:2},
  output:'meals',quantity:1,wage:2}
});
const IDS=Object.keys(RECIPES);
function ensure(world){
 if(!world.living||!world.entity_registry)throw Error('Workshops require the living world');
 let changed=false;
 if(!world.living.workshops){
  world.living.workshops={schema:1,production_runs:0,total_units:0,shops:{}};
  changed=true;
 }
 for(const id of IDS)if(!world.living.workshops.shops[id]){
  world.living.workshops.shops[id]={id,made:0,paid:0,last_minute:-1};
  changed=true;
 }
 return changed;
}
function log(world,minute,type,text,extra={}){
 const l=world.living,e={id:'event_'+(++l.event_sequence),minute,type,text,...extra};
 l.events.push(e);if(l.events.length>512)l.events.shift();return e;
}
function consume(registry,container,type,count){
 let outstanding=count;
 const taken=[];
 for(const item of Object.values(registry.items)
   .filter(i=>i.parent===container&&i.type===type)
   .sort((a,b)=>Number(a.serial.slice(4))-Number(b.serial.slice(4)))){
  if(outstanding<=0)break;
  const amount=Math.min(outstanding,item.amount);
  outstanding-=amount;item.amount-=amount;
  taken.push({serial:item.serial,amount});
  if(item.amount===0)delete registry.items[item.serial];
 }
 if(outstanding)throw Error('Vendor recipe inventory is inconsistent');
 return taken;
}
function run(world,minute,out){
 ensure(world);
 const state=world.living.workshops;
 let produced=0;
 for(const id of IDS){
  const recipe=RECIPES[id],shop=world.living.businesses[id],
    worker=shop?world.living.npcs[shop.owner_id]:null;
  if(!shop||!worker?.alive||!shop.open||
     world.living.territories[shop.area_id]?.control!=='settlers')continue;
  const at=location(world,shop);
  if(worker.area_id!==shop.area_id||
     Math.abs(worker.x-at.x)+Math.abs(worker.y-at.y)>4||
     shop.coins<recipe.wage)continue;
  if(Object.entries(recipe.ingredients).some(([type,needed])=>
    (shop.other_stock?.[type]||0)<needed))continue;
  const inputTotal=Object.values(recipe.ingredients).reduce((sum,n)=>sum+n,0);
  if(total(shop)-inputTotal+recipe.quantity>CAPACITY)continue;
  // Reconcile any stock arriving through earlier world-minutes in the batch.
  reconcile(world);
  const bag='vendor_stock_'+id,registry=world.entity_registry,taken=[];
  for(const [type,need] of Object.entries(recipe.ingredients)){
   taken.push(...consume(registry,bag,type,need));
   shop.other_stock[type]-=need;
  }
  const serial='ent_'+registry.next_serial++;
  registry.items[serial]={serial,kind:'item',type:recipe.output,
    amount:recipe.quantity,parent:bag,created_minute:minute};
  shop.stock+=recipe.quantity;shop.coins-=recipe.wage;
  shop.expenses+=recipe.wage;worker.coins+=recipe.wage;
  const record=state.shops[id];
  record.made+=recipe.quantity;record.paid+=recipe.wage;
  record.last_minute=minute;state.production_runs++;
  state.total_units+=recipe.quantity;produced+=recipe.quantity;
  out.push(log(world,minute,'workshop.production',
    worker.name+' completed '+recipe.label.toLowerCase()+' for '+shop.name+'.',
    {business_id:id,npc_id:worker.id,area_id:shop.area_id,
      ingredients:recipe.ingredients,input_serials:taken,
      output_type:recipe.output,output_quantity:recipe.quantity,
      output_serial:serial,wage:recipe.wage}));
 }
 if(produced)counts(world);
 return produced;
}
function validate(world){
 const w=world.living?.workshops;if(!w)return true;
 if(w.schema!==1||!w.shops||Object.keys(w.shops).length!==IDS.length||
   !Number.isSafeInteger(w.production_runs)||w.production_runs<0||
   !Number.isSafeInteger(w.total_units)||w.total_units<0)
  throw Error('Invalid workshop production');
 for(const id of IDS){
  const s=w.shops[id];
  if(!s||s.id!==id||!Number.isSafeInteger(s.made)||s.made<0||
   !Number.isSafeInteger(s.paid)||s.paid<0||
   !Number.isSafeInteger(s.last_minute)||s.last_minute<-1)
   throw Error('Invalid workshop record');
 }
 return true;
}
function listing(world){
 const state=world.living.workshops;
 return {world_minute:world.living.minute,production_runs:state?.production_runs||0,
  total_units:state?.total_units||0,
  shops:IDS.map(id=>({id,name:world.living.businesses[id]?.name,
   recipe:RECIPES[id],made:state?.shops[id]?.made||0,
   last_minute:state?.shops[id]?.last_minute??-1}))};
}
module.exports={RECIPES,ensure,validate,run,listing};
