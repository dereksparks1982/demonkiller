'use strict';
// M47: the first physically supplied milling chain at the existing bakery.
// Grain -> ground grist -> sacked flour -> bread. NPC baker runs the mill
// while physically present; the player can do each step personally.
// A dedicated mill building is NOT invented or added to the village here.
const {VILLAGE}=require('./regions.cjs');
const {location,total,CAPACITY}=require('./vendors-m18.cjs');
const {reconcile,counts}=require('./entity-registry-m10.cjs');
const SKILLS=require('./skills-m14.cjs');
const PLAYERBUSINESS=require('./player-business-m48.cjs');
const MAINTENANCE=require('./business-maintenance-m50.cjs');
const BUSINESS='village_bakery',MAX_RUNS=1e7;
const OUTPUTS=Object.freeze({
 grind:Object.freeze({input:'grain',need:2,output:'grist',amount:1}),
 sack:Object.freeze({input:'grist',need:1,output:'flour',amount:1})
});
function ensure(world){
 if(!world.living||!world.entity_registry)throw Error('A mill needs the saved world and item registry');
 if(world.living.milling)return false;
 world.living.milling={schema:1,shops:{
  [BUSINESS]:{id:BUSINESS,ground:0,sacked:0,wages:0,last_minute:-1}},
  player_ground:0,player_sacked:0};
 return true;
}
function validate(world){
 const s=world.living?.milling;if(!s)return true;
 const shop=s.shops?.[BUSINESS];
 if(s.schema!==1||!shop||Object.keys(s.shops).length!==1||
  shop.id!==BUSINESS||!Number.isSafeInteger(shop.ground)||
  !Number.isSafeInteger(shop.sacked)||!Number.isSafeInteger(shop.wages)||
  !Number.isSafeInteger(shop.last_minute)||shop.last_minute<-1||
  !Number.isSafeInteger(s.player_ground)||!Number.isSafeInteger(s.player_sacked)||
  [shop.ground,shop.sacked,shop.wages,s.player_ground,s.player_sacked].some(n=>n<0||n>MAX_RUNS))
  throw Error('Invalid saved mill production');
 return true;
}
function log(world,minute,type,text,extra={},out=null){
 const l=world.living,e={id:'event_'+(++l.event_sequence),minute,type,text,...extra};
 l.events.push(e);if(l.events.length>512)l.events.shift();
 if(out)out.push(e);return e;
}
function nearStation(world,c){
 if(c.area_id!==VILLAGE)return false;
 const shop=world.living.businesses[BUSINESS];
 if(!shop)return false;
 const spot=location(world,shop);
 return Math.abs(c.x-spot.x)+Math.abs(c.y-spot.y)<=3;
}
function apply(world,command){
 if(!command||typeof command!=='object'||Array.isArray(command)||
  Object.keys(command).sort().join(',')!=='action'||
  !['mill_grind','mill_sack'].includes(command.action))
  throw Error('Invalid milling action');
 if(!world.runtime?.running)throw Error('World is paused');
 const original=world.characters?.['1'];
 if(!original||original.form!=='living'||original.crafting?.incapacitated)
  throw Error('Only a conscious living character can operate milling equipment');
 if(!nearStation(world,original))
  throw Error('Go to the village bakery milling station first');
 if(!MAINTENANCE.operational(world,world.living.businesses[BUSINESS]))
  throw Error('The mill machinery is broken and needs repair');
 const next=structuredClone(world),c=next.characters['1'],minute=next.living.minute;
 ensure(next);SKILLS.ensure(c);
 const step=command.action==='mill_grind'?OUTPUTS.grind:OUTPUTS.sack;
 if(minute<=c.crafting.craft_after_minute)throw Error('The milling work requires a little time');
 if(command.action==='mill_grind'&&c.crafting.hand!=='tools')
  throw Error('Equip tools to work the grain grinder');
 if((c.inventory[step.input]||0)<step.need)
  throw Error('Not enough '+step.input+' to continue milling');
 const size=Object.values(c.inventory).reduce((a,b)=>a+b,0);
 if(size-step.need+step.amount>200||
  c.inventory[step.output]+step.amount>200)
  throw Error('Your pack cannot hold this sack');
 c.inventory[step.input]-=step.need;c.inventory[step.output]+=step.amount;
 c.crafting.craft_after_minute=minute;c.crafting.skill+=2;
 SKILLS.practice(c,'milling',minute,'station:'+BUSINESS+':'+command.action);
 if(command.action==='mill_grind')
  next.living.milling.player_ground++;
 else next.living.milling.player_sacked++;
 const followup=[];
 MAINTENANCE.onProduction(next,next.living.businesses[BUSINESS],minute,followup,'mill');
 c.revision++;next.revision++;
 const e=log(next,minute,'player.'+command.action,
  command.action==='mill_grind'?
   'You operated the grinder and produced a measure of grist.':
   'You sacked the grist as flour ready for baking or sale.',
  {area_id:VILLAGE,input_type:step.input,output_type:step.output});
 validate(next);
 return {world:next,character:c,event:e,events:[e,...followup]};
}
function take(reg,bag,type,count){
 let needed=count;
 for(const item of Object.values(reg.items).filter(i=>i.parent===bag&&i.type===type)
  .sort((a,b)=>a.serial.localeCompare(b.serial))){
  const amount=Math.min(needed,item.amount);
  needed-=amount;item.amount-=amount;
  if(item.amount===0)delete reg.items[item.serial];
  if(needed===0)break;
 }
 if(needed)throw Error('Milling raw goods item registry is inconsistent');
}
function run(world,minute,out){
 if(minute%30!==0)return 0;
 ensure(world);
 const shop=world.living.businesses[BUSINESS],worker=shop&&world.living.npcs[shop.owner_id];
 if(!shop||!PLAYERBUSINESS.productionEnabled(world,shop)||
  (PLAYERBUSINESS.owned(world,shop)&&!PLAYERBUSINESS.owned(world,shop).assistant_enabled)||
  !MAINTENANCE.operational(world,shop)||!worker?.alive||!shop.open||
  shop.coins<2||world.living.territories[shop.area_id]?.control!=='settlers')
  return 0;
 const spot=location(world,shop);
 if(worker.area_id!==shop.area_id||
  Math.abs(worker.x-spot.x)+Math.abs(worker.y-spot.y)>4)return 0;
 const goods=shop.other_stock||{};
 const phase=(goods.grist||0)>=1?'sack':(goods.grain||0)>=2?'grind':null;
 if(!phase)return 0;
 const recipe=OUTPUTS[phase],remaining=total(shop)-recipe.need+recipe.amount;
 if(remaining>CAPACITY)return 0;
 reconcile(world);const registry=world.entity_registry,bag='vendor_stock_'+BUSINESS;
 take(registry,bag,recipe.input,recipe.need);
 goods[recipe.input]-=recipe.need;
 const serial='ent_'+registry.next_serial++;
 registry.items[serial]={serial,kind:'item',type:recipe.output,
  amount:recipe.amount,parent:bag,created_minute:minute};
 goods[recipe.output]=(goods[recipe.output]||0)+recipe.amount;
 shop.coins-=2;shop.expenses+=2;worker.coins+=2;
 const record=world.living.milling.shops[BUSINESS];
 record.last_minute=minute;record.wages+=2;record[phase==='grind'?'ground':'sacked']++;
 out.push(log(world,minute,'mill.'+phase,
  worker.name+(phase==='grind'?' ground grain into grist.':' sacked fresh flour.'),
  {business_id:BUSINESS,npc_id:worker.id,area_id:VILLAGE,
   input_type:recipe.input,output_type:recipe.output,output_serial:serial}));
 MAINTENANCE.onProduction(world,shop,minute,out,'mill');
 counts(world);return recipe.amount;
}
function listing(world){
 const shop=world.living?.businesses?.[BUSINESS],c=world.characters?.['1'];
 return {world_minute:world.living?.minute||0,station:BUSINESS,
  station_label:'Village Bakery · Milling Station',
  near_station:c?nearStation(world,c):false,
  player_actions:{ground:world.living?.milling?.player_ground||0,
   sacked:world.living?.milling?.player_sacked||0},
  operator:shop?world.living.npcs[shop.owner_id]?.name||null:null,
  production:world.living?.milling?.shops?.[BUSINESS]||null,
  stock:shop?{grain:shop.other_stock?.grain||0,grist:shop.other_stock?.grist||0,
   flour:shop.other_stock?.flour||0,bread:shop.stock}:null};
}
module.exports={BUSINESS,OUTPUTS,ensure,validate,apply,run,listing,nearStation};
