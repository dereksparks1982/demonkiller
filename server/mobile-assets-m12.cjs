'use strict';
// M12: NPC backpacks, persistent corpses and reclaimable belongings.
// RunUO-informed item/mobile ownership, written independently.
const {COURT,VILLAGE}=require('./regions.cjs');
const {PACK,reconcile}=require('./entity-registry-m10.cjs');
const PROVISIONS=Object.freeze({
 bank:'bread',bakery:'bread',smithy:'tools',market:'produce',
 guard:'tools',caretaker:'herbs',courier:'bread',caravan:'produce',
 escort:'tools',tavern:'meals',herbalist:'herbs'
});
const DECAY=720,MAX_CORPSES=256;
function allocate(reg){
 if(!Number.isSafeInteger(reg.next_serial))throw Error('Invalid registry serial counter');
 return 'ent_'+reg.next_serial++;
}
function ensure(world){
 if(!world.living||!world.entity_registry)throw Error('Mobile assets require entity registry');
 const l=world.living,r=world.entity_registry;
 let changed=false;
 if(!l.mobile_assets){
  l.mobile_assets={schema:1,sequence:0,npcs:{},corpses:{}};changed=true;
 }
 const asset=l.mobile_assets;
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
 state.death_minute=minute;
 const id='corpse_'+(++m.sequence);
 const coins=npc.coins||0;npc.coins=0;
 const corpse={id,npc_id:npc.id,name:npc.name,area_id:npc.area_id,
   x:npc.x,y:npc.y,coins,created_minute:minute,expires_minute:minute+DECAY,
   bag_id:state.bag_id};
 m.corpses[id]=corpse;
 const e=record(world,minute,'npc.corpse',npc.name+' left a body and possessions.',
   {npc_id:npc.id,corpse_id:id,area_id:npc.area_id});
 out.push(e);
 return corpse;
}
function record(world,minute,type,text,details={}){
 const l=world.living,e={id:'event_'+(++l.event_sequence),minute,type,text,...details};
 l.events.push(e);if(l.events.length>512)l.events.shift();
 return e;
}
function count(c){return Object.values(c.inventory||{}).reduce((a,b)=>a+b,0);}
function read(world){
 const player=world.characters['1'];
 const all=Object.values(world.living.mobile_assets?.corpses||{});
 const nearby=player?all.filter(c=>c.area_id===player.area_id&&
   Math.abs(player.x-c.x)+Math.abs(player.y-c.y)<=2):[];
 return {corpses:nearby.map(c=>({
   id:c.id,npc_id:c.npc_id,name:c.name,area_id:c.area_id,x:c.x,y:c.y,
   coins:c.coins,expires_minute:c.expires_minute,
   items:Object.values(world.entity_registry.items).filter(i=>i.parent===c.bag_id)
     .map(i=>({serial:i.serial,type:i.type,amount:i.amount}))
 })),minute:world.living.minute,revision:world.revision};
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
 if(l.minute>=corpse.expires_minute)throw Error('The body has decayed');
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
 delete l.mobile_assets.corpses[corpse.id];
 reconcile(next);
 c.revision++;next.revision++;
 const e=record(next,l.minute,'corpse.looted',
   'The character recovered possessions from '+corpse.name+'.',
   {corpse_id:corpse.id,npc_id:corpse.npc_id,area_id:corpse.area_id,
     coins:corpse.coins,items:size});
 validate(next);
 return {world:next,character:c,event:e};
}
function expire(world,minute,out){
 const state=world.living.mobile_assets;if(!state)return;
 const r=world.entity_registry;
 for(const corpse of Object.values(state.corpses)){
  if(minute<corpse.expires_minute)continue;
  for(const i of Object.values(r.items))
   if(i.parent===corpse.bag_id)delete r.items[i.serial];
  if(corpse.bag_id)delete r.containers[corpse.bag_id];
  const n=state.npcs[corpse.npc_id];if(n)n.bag_id=null;
  delete state.corpses[corpse.id];
  out.push(record(world,minute,'corpse.decayed',
    corpse.name+'\'s remains returned to the earth.',
    {corpse_id:corpse.id,npc_id:corpse.npc_id,area_id:corpse.area_id}));
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
 for(const [id,c] of Object.entries(m.corpses)){
  const a=world.areas[c?.area_id];
  if(!/^corpse_[1-9][0-9]*$/.test(id)||c.id!==id||!m.npcs[c.npc_id]||
    !a||!Number.isInteger(c.x)||!Number.isInteger(c.y)||
    c.x<0||c.y<0||c.x>=a.width||c.y>=a.height||
    !Number.isSafeInteger(c.coins)||c.coins<0||c.coins>1e9||
    !Number.isSafeInteger(c.created_minute)||c.created_minute<0||
    c.expires_minute!==c.created_minute+DECAY||
    (c.bag_id!==null&&!world.entity_registry.containers[c.bag_id]))
    throw Error('Invalid persistent corpse');
 }
 return true;
}
module.exports={DECAY,ensure,onDeath,read,loot,expire,validate};
