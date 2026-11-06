'use strict';
// DK Server M6: persistent social relationships and trade commissions.
// No client-authored reward, NPC position, stock or reputation is trusted.
const {COURT,VILLAGE}=require('./regions.cjs');
const COMMODITIES=Object.freeze({
  courtyard_market:{item:'herbs',quantity:3,reward:18,description:'Deliver three bundles of medicinal herbs.'},
  village_bakery:{item:'wood',quantity:4,reward:16,description:'Bring four logs for the bakery ovens.'},
  village_smithy:{item:'ore',quantity:3,reward:24,description:'Bring three pieces of iron ore.'},
  village_market:{item:'herbs',quantity:2,reward:12,description:'Supply two bundles of fresh herbs.'},
  village_tavern:{item:'produce',quantity:3,reward:15,description:'Bring three crates of fresh produce.'}
});
const FACTIONS=Object.freeze({
 bank:'town',bakery:'town',smithy:'town',market:'town',tavern:'town',
 caretaker:'courtyard',herbalist:'courtyard',courier:'town',
 guard:'town',caravan:'travelers',escort:'travelers'
});
const DEFAULT_REPUTATION=()=>({town:0,courtyard:0,travelers:0});
function ensureSocial(world){
 let changed=false;
 if(!world.living.social){
  world.living.social={schema:1,reputation:DEFAULT_REPUTATION(),
    contacts:{},contracts:{},sequence:0};
  changed=true;
 }
 const social=world.living.social;
 if(!social.reputation){social.reputation=DEFAULT_REPUTATION();changed=true;}
 for(const f of Object.keys(DEFAULT_REPUTATION()))
  if(social.reputation[f]===undefined){social.reputation[f]=0;changed=true;}
 if(!social.contacts){social.contacts={};changed=true;}
 if(!social.contracts){social.contracts={};changed=true;}
 if(!Number.isSafeInteger(social.sequence)){social.sequence=0;changed=true;}
 return changed;
}
function validateSocial(world){
 const s=world.living?.social;
 if(!s)return true; // Read older saves before a safe migration.
 if(s.schema!==1||!Number.isSafeInteger(s.sequence)||s.sequence<0||
   !s.reputation||!s.contacts||!s.contracts||
   Object.keys(s.contracts).length>50000)throw Error('Invalid social world');
 for(const [key,value] of Object.entries(s.reputation))
  if(!Object.hasOwn(DEFAULT_REPUTATION(),key)||!Number.isSafeInteger(value)||
     value< -1000||value>1000)throw Error('Invalid faction reputation');
 for(const [id,contact] of Object.entries(s.contacts))
  if(!world.living.npcs[id]||!contact||!Number.isSafeInteger(contact.meetings)||
     contact.meetings<1||!Number.isSafeInteger(contact.last_minute))
    throw Error('Invalid contact record');
 for(const [id,contract] of Object.entries(s.contracts))
  if(!/^contract_[0-9]+$/.test(id)||contract.id!==id||
     !Object.hasOwn(COMMODITIES,contract.business_id)||
     !['active','completed','expired'].includes(contract.status)||
     !Number.isSafeInteger(contract.accepted_minute)||
     !Number.isSafeInteger(contract.deadline_minute)||
     contract.deadline_minute<contract.accepted_minute)
    throw Error('Invalid contract record');
 return true;
}
function closeEnough(c,target,radius){
 return c.area_id===target.area_id&&
   Math.abs(c.x-target.x)+Math.abs(c.y-target.y)<=radius;
}
function requireLivingPlayer(world){
 const character=world.characters['1'];
 if(!character)throw Error('No character exists');
 if(character.form!=='living')throw Error('Ghosts cannot conduct physical trade or conversations');
 return character;
}
function record(world,type,text,details,at=world.living.minute){
 const l=world.living;
 const event={id:'event_'+(++l.event_sequence),minute:at,
  type,text,...details};
 l.events.push(event);if(l.events.length>512)l.events.shift();
 return event;
}
function dialogue(n,world){
 const phase=(world.living.minute%720)<360?'day':'night';
 const topic={
 bank:'Your bank box is here. We keep letters until you collect them.',
 bakery:'A hot oven needs firewood, and there is never enough.',
 smithy:'Bring me honest ore and I can pay honest coin.',
 market:'Produce and herbs always find a buyer.',
 tavern:'Every traveler needs supper and a place to rest.',
 caretaker:'The willow is no ordinary tree. Look closely.',
 courier:'Letters go to the bank box, never to wherever you happen to be.',
 caravan:'We follow the road when it is safe enough.',
 escort:'The roads have grown dangerous. Stay sharp.',
 herbalist:'The plants around the courtyard have their uses.',
 guard:'I watch the roads and the town gates.'
 };
 return {npc_id:n.id,name:n.name,role:n.role,
  line:topic[n.role]||'Good '+(phase==='day'?'day':'evening')+'.',
  status:n.status,health:n.health,area_id:n.area_id};
}
function listing(world,character){
 const s=world.living.social;
 return {
  reputation:{...s.reputation},
  contacts:structuredClone(s.contacts),
  contracts:Object.values(s.contracts).filter(c=>c.status==='active'),
  nearby_npcs:Object.values(world.living.npcs).filter(n=>n.alive&&
    closeEnough(character,n,3)).map(n=>dialogue(n,world))
 };
}
function apply(world,command){
 const spec={
  talk:'action,npc_id',
  accept_contract:'action,business_id',
  complete_contract:'action,contract_id'
 };
 if(!command||typeof command!=='object'||Array.isArray(command)||
    !Object.hasOwn(spec,command.action)||
    Object.keys(command).sort().join(',')!==spec[command.action])
   throw Error('Invalid social action');
 const character=requireLivingPlayer(world),next=structuredClone(world);
 ensureSocial(next);
 const s=next.living.social,m=next.living.minute;
 let result;
 if(command.action==='talk'){
  if(typeof command.npc_id!=='string')throw Error('Invalid NPC identifier');
  const npc=next.living.npcs[command.npc_id];
  if(!npc||!npc.alive)throw Error('This person is not available');
  if(!closeEnough(character,npc,2))throw Error('Move closer to the person');
  const previous=s.contacts[npc.id]||{meetings:0,last_minute:-1};
  // Prevent farming reputation by clicking a person repeatedly.
  const newMeeting=previous.last_minute<0||m-previous.last_minute>=30;
  previous.meetings+=newMeeting?1:0;
  previous.last_minute=m;
  s.contacts[npc.id]=previous;
  const faction=FACTIONS[npc.role]||'town';
  if(newMeeting)s.reputation[faction]=Math.min(1000,s.reputation[faction]+1);
  result={dialogue:dialogue(npc,next),reputation_delta:newMeeting?1:0};
 }else if(command.action==='accept_contract'){
  const rule=COMMODITIES[command.business_id];
  if(!rule)throw Error('Invalid business contract');
  const shop=next.living.businesses[command.business_id];
  if(!shop?.open)throw Error('The business is closed');
  const owner=next.living.npcs[shop.owner_id];
  if(!owner?.alive||!closeEnough(character,owner,3))
    throw Error('Speak with the business owner in person');
  if(next.living.territories[shop.area_id]?.control!=='settlers')
    throw Error('The settlement has fallen to monsters');
  if(Object.values(s.contracts).some(c=>c.status==='active'))
    throw Error('Finish your current commission first');
  const id='contract_'+(++s.sequence);
  const contract={id,business_id:shop.id,issuer_npc_id:owner.id,
    area_id:shop.area_id,item_type:rule.item,quantity:rule.quantity,
    reward:rule.reward,description:rule.description,
    accepted_minute:m,deadline_minute:m+720,status:'active'};
  s.contracts[id]=contract;
  result={contract};
 }else{
  if(typeof command.contract_id!=='string'||!/^contract_[0-9]+$/.test(command.contract_id))
    throw Error('Invalid contract identifier');
  const contract=s.contracts[command.contract_id];
  if(!contract||contract.status!=='active')throw Error('The contract is not active');
  if(m>contract.deadline_minute)throw Error('The contract has expired');
  const shop=next.living.businesses[contract.business_id];
  const owner=next.living.npcs[contract.issuer_npc_id];
  if(!shop?.open||!owner?.alive||!closeEnough(character,owner,3))
    throw Error('Return to the open business and speak with its owner');
  if((next.characters['1'].inventory?.[contract.item_type]||0)<contract.quantity)
    throw Error('You do not have the required goods');
  if(shop.coins<contract.reward)throw Error('The business cannot afford the commission');
  const player=next.characters['1'];
  player.inventory[contract.item_type]-=contract.quantity;
  player.gold+=contract.reward;player.skills.commerce=(player.skills.commerce||0)+2;
  shop.stock+=contract.quantity;shop.coins-=contract.reward;
  contract.status='completed';contract.completed_minute=m;
  const faction=FACTIONS[owner.role]||'town';
  s.reputation[faction]=Math.min(1000,s.reputation[faction]+5);
  result={contract,reward:contract.reward,reputation_delta:5};
 }
 next.revision++;
 const e=record(next,'social.'+command.action,
   command.action==='talk'?'The player spoke to a resident.':
   command.action==='accept_contract'?'The player accepted a commission.':
   'A trade commission was delivered and paid.',
   {npc_id:command.npc_id||result.contract?.issuer_npc_id||null,
    contract_id:result.contract?.id||null,area_id:next.characters['1'].area_id});
 validateSocial(next);
 return {world:next,character:next.characters['1'],event:e,...result};
}
function tick(world,m,events){
 const s=world.living.social;if(!s)return;
 for(const contract of Object.values(s.contracts)){
  if(contract.status==='active'&&m>contract.deadline_minute){
   contract.status='expired';contract.expired_minute=m;
   const e=record(world,'social.contract.expired',
     'A trade commission expired.',{contract_id:contract.id,area_id:contract.area_id},m);
   events.push(e);
  }
 }
}
module.exports={COMMODITIES,ensureSocial,validateSocial,listing,apply,tick};
