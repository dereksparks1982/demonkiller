'use strict';
// M12: NPC backpacks, persistent corpses and reclaimable belongings.
// RunUO-informed item/mobile ownership, written independently.
const {COURT,VILLAGE}=require('./regions.cjs');
const {PACK,reconcile}=require('./entity-registry-m10.cjs');
const {onNpcDeath:enterHousingEstate}=require('./housing-m17.cjs');
const LAW=require('./law-m15.cjs');
const Decay=require('./corpse-decay-m29.cjs');
const PROVISIONS=Object.freeze({
 bank:'bread',bakery:'bread',smithy:'tools',market:'produce',
 guard:'tools',caretaker:'herbs',courier:'bread',caravan:'produce',
 escort:'tools',tavern:'meals',herbalist:'herbs'
});
const DECAY=720,MAX_CORPSES=1024,MAX_MARKS=1024,MARK_LIFETIME=2880; // M12 legacy expiry for old saves
function allocate(reg){
 if(!Number.isSafeInteger(reg.next_serial))throw Error('Invalid registry serial counter');
 return 'ent_'+reg.next_serial++;
}
function ensure(world){
 if(!world.living||!world.entity_registry)throw Error('Mobile assets require entity registry');
 const l=world.living,r=world.entity_registry;
 let changed=false;
 if(!l.mobile_assets){
  l.mobile_assets={schema:1,sequence:0,npcs:{},corpses:{},terrain_marks:{}};changed=true;
 }
 const asset=l.mobile_assets;
 if(!asset.terrain_marks){asset.terrain_marks={};changed=true;}
 for(const corpse of Object.values(asset.corpses))
  if(Decay.migrate(corpse,l.minute))changed=true;
 for(const npc of Object.values(l.npcs)){
  if(asset.npcs[npc.id])continue;
  let bagId=null;
  if(npc.alive){
   bagId='npc_pack_'+npc.id;
   if(r.containers[bagId])throw Error('Duplicate NPC backpack');
   r.containers[bagId]={id:bagId,kind:'npc_pack',owner:npc.id,capacity:20};
   const itemType=PROVISIONS[npc.role]||'bread',serial=allocate(r);
   r.items[serial]={serial,kind:'item',type:itemType,amount:1,
     parent:bagId,created_minute:l.minute};
  }
  asset.npcs[npc.id]={npc_id:npc.id,bag_id:bagId,death_minute:null};
  changed=true;
 }
 return changed;
}
function onDeath(world,npc,minute,out){
 ensure(world);
 const m=world.living.mobile_assets,r=world.entity_registry;
 const state=m.npcs[npc.id];
 if(!state||state.death_minute!==null)return null;
 if(Object.keys(m.corpses).length>=MAX_CORPSES&&!reserve(world,minute,out))
  return null;
 state.death_minute=minute;
 const id='corpse_'+(++m.sequence);
 const coins=npc.coins||0;npc.coins=0;
 const corpse={id,npc_id:npc.id,name:npc.name,area_id:npc.area_id,
   x:npc.x,y:npc.y,coins,created_minute:minute,bag_id:state.bag_id,
   ...Decay.configure({kind:'npc',species:'human',area_id:npc.area_id,minute})};
 m.corpses[id]=corpse;
 const e=record(world,minute,'npc.corpse',npc.name+' left a body and possessions.',
   {npc_id:npc.id,corpse_id:id,area_id:npc.area_id});
 out.push(e);
 enterHousingEstate(world,npc,minute,out);
 return corpse;
}
function clearBag(world,corpse){
 const r=world.entity_registry;
 if(corpse.bag_id){
  for(const item of Object.values(r.items))
   if(item.parent===corpse.bag_id)delete r.items[item.serial];
  delete r.containers[corpse.bag_id];
  const n=world.living.mobile_assets.npcs[corpse.npc_id];
  if(n)n.bag_id=null;
  corpse.bag_id=null;
 }
 corpse.coins=0;
}
function reserve(world,minute,out){
 const m=world.living.mobile_assets;
 if(Object.keys(m.corpses).length<MAX_CORPSES)return;
 const victims=Object.values(m.corpses).filter(c=>!c.preserved)
  .sort((a,b)=>{
   const priority=c=>Decay.stageAt(c,minute)==='scattered'?0:1;
   return priority(a)-priority(b)||a.created_minute-b.created_minute||a.id.localeCompare(b.id);
  });
 if(!victims.length)return false; // Never evict preserved story remains.
 const first=victims[0];clearBag(world,first);delete m.corpses[first.id];
 out.push(record(world,minute,'corpse.pruned','Old remains made room for a new death.',
  {corpse_id:first.id,area_id:first.area_id}));
 return true;
}
function onCreatureDeath(world,creature,minute,out){
 ensure(world);
 const m=world.living.mobile_assets;
 if(Object.keys(m.corpses).length>=MAX_CORPSES&&!reserve(world,minute,out))
  return null;
 const id='corpse_'+(++m.sequence);
 const corpse={id,npc_id:null,creature_id:creature.id,name:'Imp',
  area_id:creature.area_id,x:creature.x,y:creature.y,
  created_minute:minute,coins:0,bag_id:null,
  ...Decay.configure({kind:'monster',species:'demon',area_id:creature.area_id,minute})};
 m.corpses[id]=corpse;
 out.push(record(world,minute,'monster.corpse','An imp left remains on the ground.',
  {corpse_id:id,creature_id:creature.id,area_id:creature.area_id}));
 return corpse;
}
function record(world,minute,type,text,details={}){
 const l=world.living,e={id:'event_'+(++l.event_sequence),minute,type,text,...details};
 l.events.push(e);if(l.events.length>512)l.events.shift();
 return e;
}
function count(c){return Object.values(c.inventory||{}).reduce((a,b)=>a+b,0);}
function read(world){
 const player=world.characters['1'],m=world.living.minute;
 const all=Object.values(world.living.mobile_assets?.corpses||{});
 const nearby=player?all.filter(c=>c.area_id===player.area_id&&
   Math.abs(player.x-c.x)+Math.abs(player.y-c.y)<=2):[];
 return {corpses:nearby.map(c=>({
   id:c.id,npc_id:c.npc_id,creature_id:c.creature_id||null,
   name:c.name,area_id:c.area_id,x:c.x,y:c.y,coins:c.coins,
   ...Decay.view(c,m),items:Object.values(world.entity_registry.items)
    .filter(i=>c.bag_id!==null&&i.parent===c.bag_id)
    .map(i=>({serial:i.serial,type:i.type,amount:i.amount}))
 })),minute:m,revision:world.revision};
}
function loot(world,command){
 if(!command||typeof command!=='object'||Array.isArray(command)||
    Object.keys(command).sort().join(',')!=='action,corpse_id'||
    command.action!=='loot_corpse'||typeof command.corpse_id!=='string'||
    !/^corpse_[1-9][0-9]*$/.test(command.corpse_id))
   throw Error('Invalid corpse action');
 if(!world.runtime?.running)throw Error('World is paused');
 const original=world.characters['1'];
 if(!original)throw Error('No character exists');
 if(original.form!=='living')throw Error('Ghosts cannot loot corpses');
 if(original.crafting?.incapacitated)throw Error('You are unconscious');
 const next=structuredClone(world),l=next.living,r=next.entity_registry,c=next.characters['1'];
 const corpse=l.mobile_assets?.corpses[command.corpse_id];
 if(!corpse||corpse.area_id!==c.area_id||
   Math.abs(c.x-corpse.x)+Math.abs(c.y-corpse.y)>1)
   throw Error('Move beside the body to recover its belongings');
 if(Decay.expired(corpse,l.minute)||Decay.stageAt(corpse,l.minute)==='scattered')
  throw Error('Only scattered remains are left here');
 if(corpse.looted||(!corpse.bag_id&&!corpse.coins))
  throw Error('Nothing remains to loot');
 const items=Object.values(r.items).filter(i=>i.parent===corpse.bag_id);
 const size=items.reduce((sum,item)=>sum+item.amount,0);
 if(count(c)+size>200)throw Error('Your pack is full');
 for(const i of items)
  if((c.inventory[i.type]||0)+i.amount>200)throw Error('An item stack is full');
 if(c.gold+corpse.coins>1e9)throw Error('Too much gold to carry');
 for(const i of items){c.inventory[i.type]+=i.amount;i.parent=PACK;}
 c.gold+=corpse.coins;
 const assets=l.mobile_assets.npcs[corpse.npc_id];
 if(assets)assets.bag_id=null;
 if(corpse.bag_id)delete r.containers[corpse.bag_id];
 corpse.bag_id=null;corpse.coins=0;corpse.looted=true;
 reconcile(next);
 c.revision++;next.revision++;
 const e=record(next,l.minute,'corpse.looted',
   'The character recovered possessions from '+corpse.name+'.',
   {corpse_id:corpse.id,npc_id:corpse.npc_id,area_id:corpse.area_id,
     coins:corpse.coins,items:size});
 const notices=[];
 LAW.reportCorpseLoot(next,corpse,l.minute,notices);
 validate(next);
 return {world:next,character:c,event:notices.at(-1)||e,events:[e,...notices]};
}
function leaveTrace(world,corpse,minute){
 const m=world.living.mobile_assets;
 if(!m.terrain_marks)m.terrain_marks={};
 const ids=Object.keys(m.terrain_marks);
 if(ids.length>=MAX_MARKS){
  ids.sort((a,b)=>m.terrain_marks[a].created_minute-m.terrain_marks[b].created_minute||
    a.localeCompare(b));
  delete m.terrain_marks[ids[0]];
 }
 const id='mark_'+(++m.sequence);
 m.terrain_marks[id]={id,area_id:corpse.area_id,x:corpse.x,y:corpse.y,
  kind:corpse.species==='demon'?'ash':'stain',
  created_minute:minute,expires_minute:minute+MARK_LIFETIME};
}
function expire(world,minute,out){
 const state=world.living.mobile_assets;if(!state)return;
 for(const [id,mark] of Object.entries(state.terrain_marks||{}))
  if(minute>=mark.expires_minute)delete state.terrain_marks[id];
 for(const corpse of Object.values(state.corpses)){
  if(Decay.expired(corpse,minute)){
   clearBag(world,corpse);
   leaveTrace(world,corpse,minute);
   delete state.corpses[corpse.id];
   out.push(record(world,minute,'corpse.decayed',
    corpse.name+'\'s remains returned to the earth.',
    {corpse_id:corpse.id,area_id:corpse.area_id}));
   continue;
  }
  const stage=Decay.stageAt(corpse,minute);
  if(stage!==corpse.stage){
   const former=corpse.stage;
   corpse.stage=stage;corpse.last_stage_minute=minute;
   out.push(record(world,minute,'corpse.stage',
    corpse.name+'\'s remains changed as time passed.',
    {corpse_id:corpse.id,area_id:corpse.area_id,from:former,to:stage}));
  }
  // Skeletons can still be searched. Once the bones scatter, remaining
  // unclaimed possessions leave the world rather than becoming orphan items.
  if(stage==='scattered'&&(corpse.bag_id||corpse.coins))
   clearBag(world,corpse);
 }
}
function validate(world){
 const m=world.living?.mobile_assets;
 if(!m)return true;
 if(m.schema!==1||!Number.isSafeInteger(m.sequence)||m.sequence<0||
   !m.npcs||!m.corpses||Object.keys(m.corpses).length>MAX_CORPSES)
   throw Error('Invalid NPC possession store');
 for(const [id,n] of Object.entries(m.npcs)){
   if(!world.living.npcs[id]||n.npc_id!==id||
     (n.bag_id!==null&&!world.entity_registry.containers[n.bag_id])||
     (n.death_minute!==null&&(!Number.isSafeInteger(n.death_minute)||n.death_minute<0)))
     throw Error('Invalid NPC inventory identity');
 }
 const marks=m.terrain_marks||{};
 if(Array.isArray(marks)||Object.keys(marks).length>MAX_MARKS)
  throw Error('Invalid terrain-remains layer');
 for(const [id,mark] of Object.entries(marks)){
  const area=world.areas[mark?.area_id];
  if(!/^mark_[1-9][0-9]*$/.test(id)||mark.id!==id||!area||
    !Number.isInteger(mark.x)||!Number.isInteger(mark.y)||
    mark.x<0||mark.y<0||mark.x>=area.width||mark.y>=area.height||
    !['stain','ash'].includes(mark.kind)||
    !Number.isSafeInteger(mark.created_minute)||mark.created_minute<0||
    mark.expires_minute!==mark.created_minute+MARK_LIFETIME)
   throw Error('Invalid decomposed terrain mark');
 }
 for(const [id,c] of Object.entries(m.corpses)){
  const a=world.areas[c?.area_id];
  const legacy=c.stage===undefined;
  if(!/^corpse_[1-9][0-9]*$/.test(id)||c.id!==id||
    (c.npc_id===null?
      c.kind!=='monster'||typeof c.creature_id!=='string':
      !m.npcs[c.npc_id]||(!legacy&&c.kind!=='npc'))||
    !a||!Number.isInteger(c.x)||!Number.isInteger(c.y)||
    c.x<0||c.y<0||c.x>=a.width||c.y>=a.height||
    !Number.isSafeInteger(c.coins)||c.coins<0||c.coins>1e9||
    !Number.isSafeInteger(c.created_minute)||c.created_minute<0||
    (legacy?c.expires_minute!==c.created_minute+DECAY:
      !Decay.validate(c,Math.max(world.living.minute,c.created_minute)))||
    (c.bag_id!==null&&!world.entity_registry.containers[c.bag_id]))
    throw Error('Invalid persistent corpse');
 }
 return true;
}
module.exports={DECAY,MAX_CORPSES,MAX_MARKS,MARK_LIFETIME,ensure,onDeath,onCreatureDeath,clearBag,read,loot,expire,validate};
