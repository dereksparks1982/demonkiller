'use strict';
// M53: server-owned UO-style snooping and pickpocketing of actual NPC packs.
// No imaginary goods or client-submitted success probabilities.
const SKILLS=require('./skills-m14.cjs');
const ENTITIES=require('./entity-registry-m10.cjs');
const LAW=require('./law-m15.cjs');
const OBSERVED_LIFETIME=10,COOLDOWN=5;
function ensure(character){
 if(!character)return false;
 if(character.thievery)return false;
 character.thievery={schema:1,observed_npc:null,observed_minute:-1,
  observed_serials:[],last_attempt_minute:-COOLDOWN,attempts:0,successes:0};
 return true;
}
function validate(character){
 const x=character?.thievery;
 if(!x)return true;
 if(x.schema!==1||!Array.isArray(x.observed_serials)||x.observed_serials.length>20||
  (x.observed_npc!==null&&(typeof x.observed_npc!=='string'||
   x.observed_npc.length>80))||
  x.observed_serials.some(s=>typeof s!=='string'||!/^ent_[1-9][0-9]*$/.test(s))||
  new Set(x.observed_serials).size!==x.observed_serials.length||
  !Number.isSafeInteger(x.observed_minute)||x.observed_minute<-1||
  !Number.isSafeInteger(x.last_attempt_minute)||x.last_attempt_minute< -COOLDOWN||
  !Number.isSafeInteger(x.attempts)||x.attempts<0||x.attempts>1e7||
  !Number.isSafeInteger(x.successes)||x.successes<0||x.successes>x.attempts)
  throw Error('Invalid persistent thievery record');
 return true;
}
function distance(a,b){return Math.abs(a.x-b.x)+Math.abs(a.y-b.y);}
function targetNpc(world,c,id,range){
 if(typeof id!=='string'||id.length>80)throw Error('Invalid NPC target');
 const n=world.living.npcs[id];
 if(!n?.alive||n.area_id!==c.area_id||distance(n,c)>range)
  throw Error('Move closer to a living NPC before examining their belongings');
 return n;
}
function log(world,minute,type,text,extra={}){
 const l=world.living,e={id:'event_'+(++l.event_sequence),minute,type,text,...extra};
 l.events.push(e);if(l.events.length>512)l.events.shift();return e;
}
function apply(world,command){
 const verb=command?.action;
 const keys={snoop_npc:'action,npc_id',pickpocket:'action,npc_id,serial'};
 if(!command||typeof command!=='object'||Array.isArray(command)||
  !Object.hasOwn(keys,verb)||Object.keys(command).sort().join(',')!==keys[verb])
  throw Error('Invalid thievery command');
 if(!world.runtime?.running)throw Error('World is paused');
 const old=world.characters?.['1'];
 if(!old||old.form!=='living'||old.crafting?.incapacitated)
  throw Error('Only a conscious living character can snoop or steal');
 const next=structuredClone(world),c=next.characters['1'],l=next.living,minute=l.minute;
 ensure(c);SKILLS.ensure(c);
 const skillState=c.thievery,events=[];
 const n=targetNpc(next,c,command.npc_id,verb==='snoop_npc'?2:1);
 const bag='npc_pack_'+n.id;
 if(!next.entity_registry?.containers?.[bag])throw Error('This NPC has no accessible backpack');
 let observation=null,success=false,e;
 if(verb==='snoop_npc'){
  const items=Object.values(next.entity_registry.items)
   .filter(i=>i.parent===bag)
   .sort((a,b)=>Number(a.serial.slice(4))-Number(b.serial.slice(4)))
   .slice(0,20);
  if(!items.length)throw Error('This NPC has no belongings to inspect');
  skillState.observed_npc=n.id;skillState.observed_minute=minute;
  skillState.observed_serials=items.map(i=>i.serial);
  const gained=SKILLS.practice(c,'snooping',minute,'npc:'+n.id);
  observation={npc_id:n.id,npc_name:n.name,
   items:items.map(i=>({serial:i.serial,type:i.type,amount:i.amount}))};
  e=log(next,minute,'player.snoop',
   'You examined '+n.name+'\'s personal backpack.',
   {npc_id:n.id,area_id:c.area_id,items:observation.items,gained:gained.gained});
  events.push(e);success=true;
 }else{
  if(typeof command.serial!=='string'||!/^ent_[1-9][0-9]*$/.test(command.serial)||
   skillState.observed_npc!==n.id||
   minute-skillState.observed_minute>OBSERVED_LIFETIME||
   !skillState.observed_serials.includes(command.serial))
   throw Error('Inspect this NPC before attempting to steal a known item');
  if(minute<skillState.last_attempt_minute+COOLDOWN)
   throw Error('Wait before another pickpocket attempt');
  const registry=next.entity_registry,item=registry.items[command.serial];
  if(!item||item.parent!==bag||item.amount<1||
   item.serial===next.living.caravans?.active?.cargo_serial)
   throw Error('That item is no longer in the NPC backpack');
  const count=Object.values(c.inventory).reduce((sum,v)=>sum+v,0);
  if(count>=200||(c.inventory[item.type]||0)>=200)
   throw Error('Your pack is too full to take anything');
  skillState.last_attempt_minute=minute;skillState.attempts++;
  const mastered=c.skillbook.skills.stealing.value;
  const chance=Math.min(90,45+Math.floor(mastered/18));
  const roll=(minute*31+n.id.length*17+
   Number(item.serial.slice(4))*7+c.x*11+c.y*13)%100;
  success=roll<chance;
  let obtained=null;
  if(success){
   if(item.amount===1){item.parent=ENTITIES.PACK;obtained=item.serial;}
   else{
    item.amount--;
    obtained='ent_'+registry.next_serial++;
    registry.items[obtained]={serial:obtained,kind:'item',
     type:item.type,amount:1,parent:ENTITIES.PACK,created_minute:minute};
   }
   c.inventory[item.type]=(c.inventory[item.type]||0)+1;
   skillState.successes++;
   ENTITIES.reconcile(next);ENTITIES.counts(next);
  }
  const training=SKILLS.practice(c,'stealing',minute,'victim:'+n.id+':'+item.type);
  const spotted=success?LAW.witnesses(next,n.area_id,n.x,n.y,n.id).length>0:true;
  e=log(next,minute,success?'player.steal.success':'player.steal.failed',
   success?'You slipped one '+item.type+' from '+n.name+'.':
    n.name+' noticed your attempted theft.',
   {npc_id:n.id,area_id:c.area_id,serial:item.serial,
    item_type:item.type,obtained_serial:obtained,success,chance,gained:training.gained});
  events.push(e);
  if(spotted)LAW.reportPickpocket(next,n,minute,events,{failed:!success});
  if(c.fieldcraft){c.fieldcraft.hidden_until_minute=-1;c.fieldcraft.stealth_steps=0;}
  skillState.observed_npc=null;skillState.observed_serials=[];
  skillState.observed_minute=-1;
 }
 c.revision++;next.revision++;
 validate(c);SKILLS.validate(c);
 return {world:next,character:c,event:e,events,observation};
}
module.exports={OBSERVED_LIFETIME,COOLDOWN,ensure,validate,apply,targetNpc};
