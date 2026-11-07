'use strict';
// DK Server M26: one-character retirement with preserved world and unique item IDs.
// Independently implemented; the game world is never reset during deletion.
const {reconcile,counts,PACK,VAULT,HAND,LIGHT,CHEST}=require('./entity-registry-m10.cjs');
const {validateWorld}=require('./world.cjs');
function deleteCharacter(world,slot,name){
 if(slot!==1)throw Error('Invalid character slot');
 const previous=world.characters?.['1'];
 if(!previous)throw Error('Empty character slot');
 if(typeof name!=='string'||name!==previous.name)
  throw Error('Character name confirmation does not match');
 const next=structuredClone(world),l=next.living,r=next.entity_registry;
 if(!l||!r)throw Error('World migration is incomplete');
 const oldSerial=r.refs['player:1']?.serial||null;
 // Remove only the selected character's custody, never world loot or NPC goods.
 const owned=new Set([PACK,VAULT,HAND,LIGHT,CHEST]);
 for(const house of Object.values(l.housing?.records||{})){
  if(house.owner?.kind!=='player'||house.owner.slot!==1)continue;
  owned.add(house.storage_id);
  house.owner=null;house.public=true;house.locked=false;
  house.last_transfer_minute=l.minute;
  l.housing.transfers++;
 }
 for(const [id,item] of Object.entries(r.items))
  if(owned.has(item.parent))delete r.items[id];
 // Legacy mirrors and personal ledgers cannot leak into a new character.
 const vault=l.storage?.vaults?.['1'];
 if(vault)for(const key of Object.keys(vault))vault[key]=0;
 if(l.social){
  for(const faction of Object.keys(l.social.reputation||{}))
   l.social.reputation[faction]=0;
  l.social.contacts={};l.social.contracts={};
 }
 if(l.law?.player)Object.assign(l.law.player,{
  fines:0,heat:0,wanted_until_minute:-1,detained_until_minute:-1,
  last_crime_minute:-1,last_guard_action_minute:-1,citations:0
 });
 if(l.mail){
  if(l.mail.boxes)l.mail.boxes['1']=[];
  if(Array.isArray(l.mail.outbound))
   l.mail.outbound=l.mail.outbound.filter(letter=>letter.to_slot!==1);
  // The collected-mail ledger belongs to the former character.
  if(Array.isArray(l.mail.collected))l.mail.collected=[];
 }
 for(const [id,record] of Object.entries(l.region_history?.records||{})){
  record.player_visits=0;
  if(record.npc_visits===0)delete l.region_history.records[id];
 }
 delete next.characters['1'];
 // A new character gets a NEW serial. Do not revive the retired identity.
 delete r.refs['player:1'];
 reconcile(next);counts(next);
 next.revision++;
 const entry={id:'event_'+(++l.event_sequence),minute:l.minute,
  type:'player.deleted',text:'A character record was retired.',
  slot:1,character_serial:oldSerial};
 l.events.push(entry);if(l.events.length>512)l.events.shift();
 validateWorld(next);
 return {world:next,event:entry,retired_serial:oldSerial};
}
module.exports={deleteCharacter};
