'use strict';
// M45: physical town bounty board; monster kills count only when the player
// dealt the finishing blow. Rewards transfer real treasury gold, never mint it.
// Inspired by old UO town hunting commissions; all logic is original.
const {COURT,VILLAGE}=require('./regions.cjs');
const SKILLS=require('./skills-m14.cjs');
const CREATURES=require('./creatures-m42.cjs');
const MAX_HISTORY=64;
const CONTRACTS=Object.freeze([
 Object.freeze({id:'hunt_wolves',name:'Culling the Wolves',kind:'wolf',
  required:2,reward:14,issuer:'village_bank'}),
 Object.freeze({id:'bones_of_the_fallen',name:'Bones of the Fallen',kind:'skeleton',
  required:2,reward:18,issuer:'village_bank'}),
 Object.freeze({id:'road_bandits',name:'Make the Roads Safe',kind:'bandit',
  required:2,reward:25,issuer:'village_bank'}),
 Object.freeze({id:'the_willow_watch',name:'Wraiths of the Willow',kind:'wraith',
  required:1,reward:20,issuer:'courtyard_market'})
]);
const BY_ID=Object.freeze(Object.fromEntries(CONTRACTS.map(q=>[q.id,q])));
function ensure(world){
 if(!world.living)throw Error('Bounties require a living world');
 if(world.living.bounties)return false;
 world.living.bounties={schema:1,active:null,completed:[],total_claimed:0,
  kills:{},last_claim_minute:-1};
 return true;
}
function validate(world){
 const s=world.living?.bounties;if(!s)return true;
 if(s.schema!==1||!Array.isArray(s.completed)||s.completed.length>MAX_HISTORY||
  !Number.isSafeInteger(s.total_claimed)||s.total_claimed<0||
  !Number.isSafeInteger(s.last_claim_minute)||s.last_claim_minute<-1||
  !s.kills||Array.isArray(s.kills)||typeof s.kills!=='object')
  throw Error('Invalid bounty board');
 for(const [kind,count]of Object.entries(s.kills))
  if(!CREATURES.KINDS[kind]||!Number.isSafeInteger(count)||count<0)
   throw Error('Invalid bounty kill record');
 if(s.active){
  const c=s.active,q=BY_ID[c.id];
  if(!q||!Number.isSafeInteger(c.count)||c.count<0||c.count>q.required||
   !Number.isSafeInteger(c.accepted_minute)||c.accepted_minute<0)
   throw Error('Invalid accepted bounty');
 }
 for(const c of s.completed)
  if(!BY_ID[c.id]||!Number.isSafeInteger(c.minute)||c.minute<0||
   !Number.isSafeInteger(c.reward)||c.reward!==BY_ID[c.id].reward)
   throw Error('Invalid completed bounty');
 return true;
}
function event(world,minute,type,text,extra={}){
 const l=world.living,e={id:'event_'+(++l.event_sequence),minute,type,text,...extra};
 l.events.push(e);if(l.events.length>512)l.events.shift();return e;
}
function nearBoard(world,player,id){
 const issuer=BY_ID[id]?.issuer;
 const shop=issuer&&world.living.businesses[issuer];
 if(!shop||player.area_id!==shop.area_id)return false;
 const building=world.areas[shop.area_id]?.objects.find(o=>o.id===issuer);
 if(!building)return false;
 const place=building.door?
  {x:building.door.x,y:building.door.y+1}:{x:building.x,y:building.y};
 return Math.abs(player.x-place.x)+Math.abs(player.y-place.y)<=4;
}
function onKill(world,creature,minute,out){
 ensure(world);const state=world.living.bounties;
 state.kills[creature.kind]=(state.kills[creature.kind]||0)+1;
 const active=state.active,q=active&&BY_ID[active.id];
 if(!q||q.kind!==creature.kind||active.count>=q.required)return false;
 active.count++;
 out.push(event(world,minute,'bounty.progress',
  q.name+' · '+active.count+' / '+q.required+' creatures defeated.',
  {bounty_id:q.id,creature_id:creature.id,progress:active.count,
    complete:active.count===q.required}));
 return true;
}
function apply(world,command){
 const keys=Object.keys(command||{}).sort().join(',');
 if(!command||typeof command!=='object'||Array.isArray(command)||
  !['accept_bounty','turn_in_bounty'].includes(command.action)||
  (command.action==='accept_bounty'?keys!=='action,bounty_id':keys!=='action'))
  throw Error('Invalid bounty action');
 if(!world.runtime?.running)throw Error('World is paused');
 const original=world.characters?.['1'];
 if(!original||original.form!=='living'||original.crafting?.incapacitated)
  throw Error('Only a conscious living character can accept bounties');
 const next=structuredClone(world),c=next.characters['1'],minute=next.living.minute;
 ensure(next);
 let e;
 if(command.action==='accept_bounty'){
  const q=BY_ID[command.bounty_id];
  if(!q)throw Error('Unknown bounty contract');
  if(next.living.bounties.active)throw Error('Finish your current bounty first');
  if(!nearBoard(next,c,q.id))throw Error('Stand near the issuing town business');
  next.living.bounties.active={id:q.id,count:0,accepted_minute:minute};
  e=event(next,minute,'bounty.accepted','You accepted '+q.name+'.',
   {bounty_id:q.id,required:q.required,kind:q.kind});
 }else{
  const active=next.living.bounties.active,q=active&&BY_ID[active.id];
  if(!q)throw Error('You have no active bounty');
  if(active.count<q.required)throw Error('You have not completed this bounty');
  if(!nearBoard(next,c,q.id))throw Error('Return to the issuing business to claim your bounty');
  const payer=next.living.businesses[q.issuer];
  if(payer.coins<q.reward)throw Error('The issuing business cannot afford the reward');
  payer.coins-=q.reward;payer.expenses=(payer.expenses||0)+q.reward;
  c.gold+=q.reward;
  const records=next.living.bounties;
  records.total_claimed+=q.reward;records.last_claim_minute=minute;
  records.completed.push({id:q.id,minute,reward:q.reward});
  if(records.completed.length>MAX_HISTORY)records.completed.shift();
  records.active=null;
  SKILLS.practice(c,'trading',minute,'bounty:'+q.id);
  e=event(next,minute,'bounty.paid',
   'You claimed '+q.reward+' gold from '+payer.name+' for '+q.name+'.',
   {bounty_id:q.id,paid:q.reward,business_id:payer.id});
 }
 c.revision++;next.revision++;
 validate(next);
 return {world:next,character:c,event:e};
}
function listing(world){
 const state=world.living?.bounties;
 const player=world.characters?.['1'];
 return {world_minute:world.living?.minute||0,active:state?.active||null,
  completed:state?.completed?.slice(-12)||[],total_claimed:state?.total_claimed||0,
  contracts:CONTRACTS.map(q=>({...q,
   near_issuer:player?nearBoard(world,player,q.id):false,
   issuer_name:world.living?.businesses?.[q.issuer]?.name||q.issuer}))};
}
module.exports={CONTRACTS,ensure,validate,nearBoard,onKill,apply,listing};
