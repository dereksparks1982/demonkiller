'use strict';
// DK M30: server-owned graves, with persistent stones and staged overgrowth.
const {reconcile,counts}=require('./entity-registry-m10.cjs');
const {clearBag}=require('./mobile-assets-m12.cjs');
const MAX_GRAVES=512;
const AGES=Object.freeze({settled:1440,overgrown:10080});
function ensure(world){
 if(!world.living)throw Error('Burials require living world');
 if(world.living.burials)return false;
 world.living.burials={schema:1,sequence:0,records:{}};
 return true;
}
function age(grave,minute){
 const elapsed=Math.max(0,minute-grave.buried_minute);
 return elapsed>=AGES.overgrown?'overgrown':elapsed>=AGES.settled?'settled':'fresh';
}
function log(world,minute,type,text,details={},out){
 const l=world.living,e={id:'event_'+(++l.event_sequence),minute,type,text,...details};
 l.events.push(e);if(l.events.length>512)l.events.shift();
 if(out)out.push(e);
 return e;
}
function bury(world,command){
 if(!command||typeof command!=='object'||Array.isArray(command)||
  Object.keys(command).sort().join(',')!=='action,corpse_id'||
  command.action!=='bury_corpse'||typeof command.corpse_id!=='string'||
  !/^corpse_[1-9][0-9]*$/.test(command.corpse_id))
  throw Error('Invalid burial command');
 if(!world.runtime?.running)throw Error('World is paused');
 const previous=world.characters?.['1'];
 if(!previous)throw Error('No character exists');
 if(previous.form!=='living')throw Error('Ghosts cannot bury the dead');
 if(previous.crafting?.incapacitated)throw Error('You are unconscious');
 const next=structuredClone(world),l=next.living,c=next.characters['1'];
 ensure(next);
 if(Object.keys(l.burials.records).length>=MAX_GRAVES)
  throw Error('The burial record limit has been reached');
 const body=l.mobile_assets?.corpses[command.corpse_id];
 if(!body||body.area_id!==c.area_id||
  Math.abs(body.x-c.x)+Math.abs(body.y-c.y)>1)
  throw Error('Move beside the body before burial');
 if(body.kind!=='npc'||body.species!=='human')
  throw Error('Only a human body can be buried');
 if(body.preserved)throw Error('These remains cannot be disturbed');
 if(!(c.inventory?.tools>0||c.crafting?.hand==='tools'))
  throw Error('Tools are needed to dig a grave');
 if((c.crafting?.energy??0)<6)throw Error('Too exhausted to dig');
 // Buried items are sequestered with the dead, never awarded to the player.
 // The existing corpse container and its serials are retired atomically.
 clearBag(next,body);
 const id='grave_'+(++l.burials.sequence);
 const grave={id,corpse_id:body.id,npc_id:body.npc_id,name:body.name,
  area_id:body.area_id,x:body.x,y:body.y,
  buried_minute:l.minute,stage:'fresh',last_stage_minute:l.minute};
 l.burials.records[id]=grave;
 delete l.mobile_assets.corpses[body.id];
 c.crafting.energy-=6;
 c.revision++;next.revision++;
 reconcile(next);counts(next);
 const event=log(next,l.minute,'corpse.buried',
  body.name+' was laid to rest.',{grave_id:id,corpse_id:body.id,area_id:body.area_id});
 return {world:next,character:c,event,grave};
}
function run(world,minute,out=[]){
 ensure(world);
 for(const grave of Object.values(world.living.burials.records)){
  const stage=age(grave,minute);
  if(stage===grave.stage)continue;
  grave.stage=stage;grave.last_stage_minute=minute;
  log(world,minute,'grave.changed','An old grave settled into the landscape.',
    {grave_id:grave.id,area_id:grave.area_id,stage},out);
 }
}
function validate(world){
 const b=world.living?.burials;
 if(!b)return true; // Old M29 world; migrated on startup.
 if(b.schema!==1||!Number.isSafeInteger(b.sequence)||b.sequence<0||
  !b.records||Array.isArray(b.records)||Object.keys(b.records).length>MAX_GRAVES)
  throw Error('Invalid burial registry');
 for(const [id,g] of Object.entries(b.records)){
  const area=world.areas[g?.area_id];
  if(!/^grave_[1-9][0-9]*$/.test(id)||g.id!==id||
    !/^corpse_[1-9][0-9]*$/.test(g.corpse_id)||
    typeof g.name!=='string'||!g.name||g.name.length>100||
    typeof g.npc_id!=='string'||!area||
    !Number.isInteger(g.x)||!Number.isInteger(g.y)||
    g.x<0||g.y<0||g.x>=area.width||g.y>=area.height||
    !Number.isSafeInteger(g.buried_minute)||g.buried_minute<0||
    !['fresh','settled','overgrown'].includes(g.stage)||
    !Number.isSafeInteger(g.last_stage_minute)||
    g.last_stage_minute<g.buried_minute)
    throw Error('Invalid grave record');
 }
 return true;
}
module.exports={MAX_GRAVES,AGES,ensure,age,bury,run,validate};
