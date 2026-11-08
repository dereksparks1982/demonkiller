'use strict';
// DK Server M20: physical NPC workshop production from purchased ingredients.
// Recipes are server-authored; no player-supplied outputs or RunUO GPL code.
const {location,CAPACITY,total}=require('./vendors-m18.cjs');
const {reconcile,counts}=require('./entity-registry-m10.cjs');
const SKILLS=require('./skills-m14.cjs');
const PLAYERBUSINESS=require('./player-business-m48.cjs');
const MAINTENANCE=require('./business-maintenance-m50.cjs');
const REBUILD=require('./reconstruction-m66.cjs');
const RECIPES=Object.freeze({
 village_smithy:{label:'Smithing',ingredients:{ore:2,wood:1},
  output:'tools',quantity:1,wage:2},
 village_bakery:{label:'Baking',ingredients:{flour:2},
  output:'bread',quantity:2,wage:2},
 village_tavern:{label:'Cooking',ingredients:{produce:2},
  output:'meals',quantity:1,wage:2}
});
const IDS=Object.keys(RECIPES);
function recipeFor(id,shop){
 const base=RECIPES[id];
 if(id==='village_tavern'&&
  (shop?.other_stock?.raw_meat||0)>=1&&
  (shop?.other_stock?.produce||0)>=1)
  return {...base,ingredients:{raw_meat:1,produce:1}};
 return base;
}
function ensure(world){
 if(!world.living||!world.entity_registry)throw Error('Workshops require the living world');
 let changed=false;
 if(!world.living.workshops){
  world.living.workshops={schema:1,production_runs:0,total_units:0,shops:{}};
  changed=true;
 }
 for(const id of IDS){
  if(!world.living.workshops.shops[id]){
   world.living.workshops.shops[id]={id,made:0,paid:0,last_minute:-1};
   changed=true;
  }
  const row=world.living.workshops.shops[id];
  if(row.player_runs===undefined){row.player_runs=0;changed=true;}
  if(row.player_last_minute===undefined){row.player_last_minute=-1;changed=true;}
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
  const shop=world.living.businesses[id],recipe=recipeFor(id,shop),
    worker=shop?world.living.npcs[shop.owner_id]:null;
  if(!shop||!PLAYERBUSINESS.productionEnabled(world,shop)||
     (PLAYERBUSINESS.owned(world,shop)&&!PLAYERBUSINESS.owned(world,shop).assistant_enabled)||
     !MAINTENANCE.operational(world,shop)||!REBUILD.operational(world,shop)||
     !worker?.alive||!shop.open||
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
  MAINTENANCE.onProduction(world,shop,minute,out,'workshop');
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
   !Number.isSafeInteger(s.last_minute)||s.last_minute<-1||
   (s.player_runs!==undefined&&(!Number.isSafeInteger(s.player_runs)||s.player_runs<0))||
   (s.player_last_minute!==undefined&&(!Number.isSafeInteger(s.player_last_minute)||
    s.player_last_minute<-1)))
   throw Error('Invalid workshop record');
 }
 return true;
}
function listing(world){
 const state=world.living.workshops;
 return {world_minute:world.living.minute,production_runs:state?.production_runs||0,
  total_units:state?.total_units||0,
  shops:IDS.map(id=>({id,name:world.living.businesses[id]?.name,
   recipe:recipeFor(id,world.living.businesses[id]),made:state?.shops[id]?.made||0,
   last_minute:state?.shops[id]?.last_minute??-1}))};
}

function applyPlayer(world,command){
 if(!command||typeof command!=='object'||Array.isArray(command)||
  Object.keys(command).sort().join(',')!=='action,business_id'||
  command.action!=='run_workshop'||!IDS.includes(command.business_id))
  throw Error('Invalid manual workshop command');
 if(!world.runtime?.running)throw Error('World is paused');
 const prior=world.characters?.['1'];
 if(!prior||prior.form!=='living'||prior.crafting?.incapacitated)
  throw Error('Only a conscious living character can operate a workshop');
 const BUSINESS=require('./player-business-m48.cjs');
 const previousShop=world.living.businesses[command.business_id];
 if(!BUSINESS.owned(world,previousShop))
  throw Error('You must own this workshop to operate its machinery');
 if(!MAINTENANCE.operational(world,previousShop))
  throw Error('The workshop machinery is broken and needs repair');
 if(!REBUILD.operational(world,previousShop))
  throw Error('The workshop building must be reconstructed before production');
 if(!BUSINESS.atShop(world,prior,previousShop))
  throw Error('Stand by the workshop station to operate it');
 if(world.living.territories[previousShop.area_id]?.control!=='settlers')
  throw Error('The settlement is occupied');
 const next=structuredClone(world),c=next.characters['1'];
 ensure(next);SKILLS.ensure(c);
 const id=command.business_id,shop=next.living.businesses[id],recipe=recipeFor(id,shop);
 const state=next.living.workshops,row=state.shops[id],minute=next.living.minute;
 if(row.player_last_minute>=minute)
  throw Error('Work on this station requires another world minute');
 if(Object.entries(recipe.ingredients).some(([type,amount])=>
  (shop.other_stock?.[type]||0)<amount))
  throw Error('The workshop lacks physical ingredients');
 const inputTotal=Object.values(recipe.ingredients).reduce((n,a)=>n+a,0);
 if(total(shop)-inputTotal+recipe.quantity>CAPACITY)
  throw Error('The finished goods would overflow the storeroom');
 reconcile(next);
 const bag='vendor_stock_'+id,reg=next.entity_registry,taken=[];
 for(const [type,amount]of Object.entries(recipe.ingredients)){
  taken.push(...consume(reg,bag,type,amount));
  shop.other_stock[type]-=amount;
 }
 const serial='ent_'+reg.next_serial++;
 reg.items[serial]={serial,kind:'item',type:recipe.output,
  amount:recipe.quantity,parent:bag,created_minute:minute};
 shop.stock+=recipe.quantity;
 row.player_runs++;row.player_last_minute=minute;
 row.made+=recipe.quantity;row.last_minute=minute;
 state.production_runs++;state.total_units+=recipe.quantity;
 const profession=id==='village_smithy'?'blacksmithing':'cooking';
 const gained=SKILLS.practice(c,profession,minute,'manual:'+id);
 const l=next.living,e={id:'event_'+(++l.event_sequence),minute,
  type:'workshop.player.production',slot:1,business_id:id,area_id:shop.area_id,
  input_serials:taken,output_serial:serial,output_type:recipe.output,
  output_quantity:recipe.quantity,skill_gain:gained.gained,
  text:'You operated the '+recipe.label.toLowerCase()+' station at '+shop.name+'.'};
 l.events.push(e);if(l.events.length>512)l.events.shift();
 const following=[];
 MAINTENANCE.onProduction(next,shop,minute,following,'manual');
 c.revision++;next.revision++;
 counts(next);validate(next);
 return {world:next,character:c,event:e,events:[e,...following]};
}
module.exports={RECIPES,recipeFor,ensure,validate,run,listing,applyPlayer};
