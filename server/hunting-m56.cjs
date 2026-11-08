'use strict';
// M56: harvest the same durable corpses that decay into world terrain.
// Independent, server-authoritative UO-style wildlife processing.
const E=require('./entity-registry-m10.cjs'),S=require('./skills-m14.cjs');
const DECAY=require('./corpse-decay-m29.cjs'),V=require('./vendors-m18.cjs');
const {VILLAGE}=require('./regions.cjs');
const DEFAULT=()=>({skinned:false,butchered:false,venom_taken:false});
const MAX=1e8;
function species(body){
 if(body?.kind!=='monster'||body.species!=='beast')return null;
 if(body.name==='Wolf')return 'wolf';
 if(body.name==='Giant Spider')return 'spider';
 return null;
}
function ensure(world){
 if(!world.living)throw Error('Wildlife harvesting requires the saved world');
 let changed=false;
 if(!world.living.hunting){
  world.living.hunting={schema:1,skins:0,butcheries:0,
   venom_extractions:0,meals_cooked:0};changed=true;
 }
 for(const corpse of Object.values(world.living.mobile_assets?.corpses||{})){
  if(species(corpse)&&!corpse.harvest){
   corpse.harvest=DEFAULT();changed=true;
  }
 }
 return changed;
}
function validate(world){
 const h=world.living?.hunting;if(!h)return true;
 if(h.schema!==1||['skins','butcheries','venom_extractions','meals_cooked']
  .some(k=>!Number.isSafeInteger(h[k])||h[k]<0||h[k]>MAX))
  throw Error('Invalid wildlife harvesting history');
 for(const corpse of Object.values(world.living.mobile_assets?.corpses||{})){
  if(!corpse.harvest)continue;
  const flags=corpse.harvest;
  if(!species(corpse)||Object.keys(flags).sort().join(',')!==
    'butchered,skinned,venom_taken'||
   Object.values(flags).some(v=>typeof v!=='boolean')||
   (species(corpse)==='wolf'&&flags.venom_taken)||
   (species(corpse)==='spider'&&flags.butchered))
   throw Error('Invalid persistent animal harvest flags');
 }
 return true;
}
function adjacent(c,body){return c.area_id===body.area_id&&
 Math.abs(c.x-body.x)+Math.abs(c.y-body.y)<=2;}
function tavern(world,c){
 const shop=world.living.businesses.village_tavern;
 if(!shop||!shop.open||c.area_id!==VILLAGE)return false;
 const at=V.location(world,shop);
 return Math.abs(c.x-at.x)+Math.abs(c.y-at.y)<=3;
}
function event(w,type,text,details={}){
 const l=w.living,e={id:'event_'+(++l.event_sequence),minute:l.minute,
  type,text,area_id:w.characters['1'].area_id,...details};
 l.events.push(e);if(l.events.length>512)l.events.shift();return e;
}
function apply(world,command){
 const keys={skin_carcass:'action,corpse_id',butcher_carcass:'action,corpse_id',
  extract_venom:'action,corpse_id',cook_meat:'action'};
 if(!command||typeof command!=='object'||Array.isArray(command)||
  !Object.hasOwn(keys,command.action)||
  Object.keys(command).sort().join(',')!==keys[command.action])
  throw Error('Invalid wildlife harvesting command');
 if(!world.runtime?.running)throw Error('World is paused');
 const original=world.characters?.['1'];
 if(!original||original.form!=='living'||original.crafting?.incapacitated)
  throw Error('Only a conscious living character can handle wildlife');
 const next=structuredClone(world),c=next.characters['1'];
 ensure(next);S.ensure(c);
 const minute=next.living.minute,action=command.action,h=next.living.hunting;
 if(minute<=c.crafting.craft_after_minute)
  throw Error('Wait another world minute before preparing more wildlife resources');
 let result=null,quantity=0,skill='',body=null;
 let input=null,inputQty=0,field=null;
 if(action==='cook_meat'){
  if(!(c.fieldcraft?.camp_until_minute>minute)&&!tavern(next,c))
   throw Error('Prepare an outdoor camp or visit the open village tavern to cook');
  if((c.inventory.raw_meat||0)<1||(c.inventory.wood||0)<1)
   throw Error('Cooking requires real raw meat and one wood for fuel');
  result='meals';quantity=1;skill='cooking';input='raw_meat';inputQty=1;
  c.inventory.wood--;c.inventory.raw_meat--;
  h.meals_cooked++;
 }else{
  body=next.living.mobile_assets?.corpses?.[command.corpse_id];
  const animal=species(body);
  if(!animal||!adjacent(c,body))
   throw Error('Approach the remains of a nearby slain beast');
  if(c.crafting?.hand!=='tools')
   throw Error('Equip real hand tools before harvesting a carcass');
  const stage=DECAY.stageAt(body,minute);
  if(!['fresh','early'].includes(stage))
   throw Error('The carcass has decayed beyond usable resources');
  body.harvest ||= DEFAULT();
  if(action==='skin_carcass'){
   field='skinned';result=animal==='wolf'?'hides':'spider_silk';
   quantity=2;skill='animal_lore';h.skins++;
  }else if(action==='butcher_carcass'){
   if(animal!=='wolf')throw Error('This beast has no usable meat');
   if(stage!=='fresh')throw Error('Only a fresh carcass can provide safe meat');
   field='butchered';result='raw_meat';quantity=2;skill='cooking';h.butcheries++;
  }else{
   if(animal!=='spider')throw Error('Only giant spiders have usable venom');
   if((c.inventory.bandages||0)<1)throw Error('You need a clean bandage to secure venom');
   field='venom_taken';result='venom';quantity=1;skill='poisoning';
   input='bandages';inputQty=1;h.venom_extractions++;
  }
  if(body.harvest[field])throw Error('Those resources were already harvested');
  // The animal's durable body stays in the terrain and continues rotting.
  body.harvest[field]=true;body.disturbed=true;
  if(input)c.inventory[input]-=inputQty;
 }
 const size=Object.values(c.inventory).reduce((a,b)=>a+b,0);
 if(size+quantity>200||(c.inventory[result]||0)+quantity>200)
  throw Error('Your backpack cannot hold the harvested goods');
 c.inventory[result]+=quantity;
 c.crafting.craft_after_minute=minute;
 E.reconcile(next);E.counts(next);
 const gain=S.practice(c,skill,minute,
  action==='cook_meat'?'camp:'+c.area_id+':'+Math.floor(c.x/8):
   'corpse:'+body.id+':'+action);
 const e=event(next,'wildlife.'+action,
  action==='cook_meat'?'You cooked a hot meal from real meat and firewood.':
   'You harvested '+quantity+' '+result+' from '+body.name+'.',
  {corpse_id:body?.id||null,item_type:result,quantity,
   skill,skill_gain:gain.gained});
 c.revision++;next.revision++;
 validate(next);
 return {world:next,character:c,event:e};
}
function listing(world){
 const c=world.characters?.['1'],minute=world.living?.minute||0;
 const corpses=Object.values(world.living?.mobile_assets?.corpses||{})
  .filter(body=>c&&species(body)&&adjacent(c,body))
  .map(body=>({id:body.id,name:body.name,x:body.x,y:body.y,
   kind:species(body),stage:DECAY.stageAt(body,minute),
   harvest:body.harvest||DEFAULT(),area_id:body.area_id}));
 const h=world.living?.hunting;
 return {world_minute:minute,corpses,can_cook:!!(c&&
  (c.fieldcraft?.camp_until_minute>minute||tavern(world,c))),
  inventory:c?{raw_meat:c.inventory?.raw_meat||0,wood:c.inventory?.wood||0,
   hides:c.inventory?.hides||0,spider_silk:c.inventory?.spider_silk||0,
   venom:c.inventory?.venom||0,bandages:c.inventory?.bandages||0}:null,
  totals:h?{skins:h.skins,butcheries:h.butcheries,
   venom_extractions:h.venom_extractions,meals_cooked:h.meals_cooked}:null};
}
module.exports={DEFAULT,species,ensure,validate,apply,listing,adjacent,tavern};
