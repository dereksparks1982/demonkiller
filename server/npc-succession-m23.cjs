'use strict';
// DK Server M23: named posts belong to settlements, not immortal NPC IDs.
// Independently inspired by RunUO region spawners. Dead residents remain dead.
const {COURT,VILLAGE}=require('./regions.cjs');
const {findOpen}=require('./combat-m8.cjs');
const {ensure:ensureMobileAssets}=require('./mobile-assets-m12.cjs');
const {ensure:ensureBrains}=require('./mobile-ai-m21.cjs');
const {ensure:ensureDistricts}=require('./region-policies-m16.cjs');
const {reconcile,counts}=require('./entity-registry-m10.cjs');
const POST_RULES=Object.freeze({
 bank_clerk:{business:'village_bank',payer:'village_bank',title:'Bank Clerk'},
 baker:{business:'village_bakery',payer:'village_bakery',title:'Baker'},
 blacksmith:{business:'village_smithy',payer:'village_smithy',title:'Blacksmith'},
 market_vendor:{business:'village_market',payer:'village_market',title:'Market Keeper'},
 tavern_keeper:{business:'village_tavern',payer:'village_tavern',title:'Innkeeper'},
 herbalist:{business:'courtyard_market',payer:'courtyard_market',title:'Herbalist'},
 guard_north:{business:null,payer:'village_bank',title:'Northern Guard'},
 guard_south:{business:null,payer:'village_bank',title:'Southern Guard'},
 courier:{business:null,payer:'village_bank',title:'Postal Courier'},
 courtyard_keeper:{business:null,payer:'courtyard_market',title:'Courtyard Keeper'}
});
const WAGE=12,WAIT=120,MAX_NPCS=96,MAX_HIRES=80;
const NAMES=Object.freeze(['Ada','Bram','Cora','Dorin','Edith','Felix','Greta',
 'Hugo','Iona','Jasper','Kira','Lenn','Mara','Nolan','Orla','Perrin']);
function ensure(world){
 if(!world.living)throw Error('Succession requires an inhabited world');
 if(world.living.succession)return false;
 const posts={};
 for(const [id,rule] of Object.entries(POST_RULES)){
  const founder=world.living.npcs[id];
  if(!founder)throw Error('Founder is missing for settlement post '+id);
  const owner=rule.business?world.living.businesses[rule.business]?.owner_id:id;
  posts[id]={id,holder_id:owner||id,appointments:0,last_hired_minute:null,
   last_vacant_minute:null};
 }
 world.living.succession={schema:1,sequence:0,hired:0,posts};
 return true;
}
function record(world,minute,type,text,details,out){
 const l=world.living,e={id:'event_'+(++l.event_sequence),minute,type,text,...details};
 l.events.push(e);if(l.events.length>512)l.events.shift();
 out.push(e);return e;
}
function postRole(world,id){
 const founder=world.living.npcs[id];
 return founder?{role:founder.role,area_id:founder.home_area,
   home_x:founder.home_x,home_y:founder.home_y}:null;
}
function run(world,minute,out){
 ensure(world);
 if(!Number.isSafeInteger(minute)||minute<0)throw Error('Invalid hiring world minute');
 const s=world.living.succession;
 for(const [id,rule] of Object.entries(POST_RULES)){
  const p=s.posts[id],holder=world.living.npcs[p.holder_id];
  if(holder?.alive)continue;
  const death=world.living.mobile_assets?.npcs[p.holder_id]?.death_minute;
  const since=Number.isSafeInteger(death)?death:minute;
  if(p.last_vacant_minute===null){
   p.last_vacant_minute=since;
   record(world,minute,'npc.post.vacant',
    'The '+rule.title+' post fell vacant.',
    {post_id:id,former_npc_id:p.holder_id,area_id:postRole(world,id).area_id},out);
  }
  const loc=postRole(world,id);
  if(minute<p.last_vacant_minute+WAIT||
     world.living.territories[loc.area_id]?.control!=='settlers')continue;
  if(s.hired>=MAX_HIRES||Object.keys(world.living.npcs).length>=MAX_NPCS)continue;
  const payer=world.living.businesses[rule.payer];
  if(!payer||payer.coins<WAGE)continue; // Hiring never mints money.
  const point=findOpen(world,loc.area_id,loc.home_x,loc.home_y);
  if(!point)continue;
  const serial=s.sequence+1,idNew='resident_'+serial;
  if(world.living.npcs[idNew])throw Error('Settlement NPC ID collision');
  const label=NAMES[(serial-1)%NAMES.length];
  const npc={id:idNew,name:label+' the '+rule.title,
   role:loc.role,area_id:loc.area_id,x:point.x,y:point.y,
   home_area:loc.area_id,home_x:loc.home_x,home_y:loc.home_y,
   alive:true,health:100,hunger:0,energy:100,status:'idle',last_change:minute,
   age_years:21+(serial*7%30),coins:WAGE};
  payer.coins-=WAGE;
  payer.expenses+=WAGE;
  world.living.npcs[idNew]=npc;
  if(rule.business){
   const shop=world.living.businesses[rule.business];
   shop.owner_id=idNew;
   shop.open=false; // Never sell while new proprietor is still traveling.
  }
  s.sequence=serial;s.hired++;p.appointments++;p.holder_id=idNew;
  p.last_hired_minute=minute;p.last_vacant_minute=null;
  ensureMobileAssets(world);ensureBrains(world);ensureDistricts(world);
  reconcile(world);counts(world);
  record(world,minute,'npc.post.filled',
    npc.name+' accepted the vacant post.',
    {post_id:id,npc_id:idNew,predecessor:holder?.id||null,
     payer:rule.payer,wage:WAGE,area_id:loc.area_id},out);
 }
}
function validate(world){
 const s=world.living?.succession;
 if(!s)return true;
 if(s.schema!==1||!s.posts||Array.isArray(s.posts)||
   Object.keys(s.posts).length!==Object.keys(POST_RULES).length||
   !Number.isSafeInteger(s.sequence)||s.sequence<0||
   !Number.isSafeInteger(s.hired)||s.hired<0||s.hired>s.sequence||
   s.hired>MAX_HIRES||Object.keys(world.living.npcs).length>MAX_NPCS)
  throw Error('Invalid settlement succession registry');
 for(const [id,rule] of Object.entries(POST_RULES)){
  const p=s.posts[id],npc=world.living.npcs[p?.holder_id];
  if(!p||p.id!==id||!npc||!Number.isSafeInteger(p.appointments)||
     p.appointments<0||p.appointments>MAX_HIRES||
     (p.last_hired_minute!==null&&
       (!Number.isSafeInteger(p.last_hired_minute)||p.last_hired_minute<0))||
     (p.last_vacant_minute!==null&&
       (!Number.isSafeInteger(p.last_vacant_minute)||p.last_vacant_minute<0))||
     (rule.business&&world.living.businesses[rule.business]?.owner_id!==p.holder_id)||
     npc.role!==postRole(world,id).role)
   throw Error('Invalid settlement post holder or business succession');
 }
 return true;
}
function listing(world){
 const s=world.living?.succession,p=world.characters?.['1'];
 const nearby=p?Object.entries(POST_RULES).filter(([id])=>{
  const record=s?.posts?.[id],holder=world.living.npcs[record?.holder_id]||
    world.living.npcs[id];
  return holder?.area_id===p.area_id&&
    Math.abs(holder.x-p.x)+Math.abs(holder.y-p.y)<=10;
 }).map(([id,rule])=>{
  const record=s?.posts?.[id],holder=world.living.npcs[record?.holder_id];
  return {post_id:id,title:rule.title,holder_id:record?.holder_id||id,
    holder_name:holder?.name||null,filled:!!holder?.alive,
    appointed_minute:record?.last_hired_minute??null,
    vacant_since:record?.last_vacant_minute??null};
 }):[];
 return {minute:world.living?.minute||0,revision:world.revision,
  hired:s?.hired||0,nearby};
}
module.exports={POST_RULES,WAGE,WAIT,MAX_NPCS,ensure,run,validate,listing};
