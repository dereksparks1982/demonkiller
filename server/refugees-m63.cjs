'use strict';
// M63: civilian displacement and homecoming under persistent territory changes.
// NPCs walk existing portals; nobody teleports to "safe" coordinates.
const {COURT,VILLAGE,traversable}=require('./regions.cjs');
const STATUS=new Set(['home','evacuating','sheltered','returning','stranded','lost']);
const EXEMPT=new Set(['guard','escort','caravan']);
const SAFETY_MINUTES=90,MAX_REFUGEES=128,MAX_STAY=36;
const CAMP=Object.freeze({
 [COURT]:Object.freeze({x:19,y:31,width:8,height:5}),
 [VILLAGE]:Object.freeze({x:69,y:67,width:10,height:5})
});
const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
function eligible(n){
 return !!n&&!EXEMPT.has(n.role)&&[COURT,VILLAGE].includes(n.home_area);
}
function person(n){
 return {npc_id:n.id,home_area_id:n.home_area,status:'home',
  shelter_area_id:null,shelter_x:null,shelter_y:null,
  displaced_minute:-1,sheltered_minute:-1,safe_since_minute:-1,
  last_change_minute:0,evacuations:0,homecomings:0};
}
function ensure(world){
 if(!world.living)throw Error('Refugees require a saved world');
 let changed=false;
 if(!world.living.refugees){
  world.living.refugees={schema:1,records:{},last_tick_minute:-1,
   total_evacuations:0,total_homecomings:0,total_lost:0};
  changed=true;
 }
 const state=world.living.refugees;
 for(const n of Object.values(world.living.npcs||{})){
  if(!eligible(n)||state.records[n.id])continue;
  if(Object.keys(state.records).length>=MAX_REFUGEES)
   throw Error('Refugee registry capacity exceeded');
  state.records[n.id]=person(n);changed=true;
 }
 return changed;
}
function validate(world){
 const s=world.living?.refugees;if(!s)return true;
 if(s.schema!==1||!s.records||Array.isArray(s.records)||
  Object.keys(s.records).length>MAX_REFUGEES||
  !Number.isSafeInteger(s.last_tick_minute)||s.last_tick_minute<-1||
  s.last_tick_minute>world.living.minute)
  throw Error('Invalid refugee registry');
 const now=world.living.minute,seen=new Set();
 let evacuations=0,homecomings=0,losses=0;
 for(const [id,r] of Object.entries(s.records)){
  const npc=world.living.npcs[id],area=world.areas[r?.shelter_area_id];
  if(!eligible(npc)||!r||r.npc_id!==id||r.home_area_id!==npc.home_area||
   !STATUS.has(r.status)||
   (r.shelter_area_id!==null&&
     (r.shelter_area_id===r.home_area_id||!CAMP[r.shelter_area_id]))||
   ((r.shelter_x===null)!==(r.shelter_y===null))||
   (r.shelter_area_id===null&&r.shelter_x!==null)||
   (r.shelter_area_id!==null&&(!area||!Number.isInteger(r.shelter_x)||
     !Number.isInteger(r.shelter_y)||r.shelter_x<0||r.shelter_y<0||
     r.shelter_x>=area.width||r.shelter_y>=area.height))||
   ['displaced_minute','sheltered_minute','safe_since_minute','last_change_minute']
    .some(k=>!Number.isSafeInteger(r[k])||r[k]<-1||r[k]>now)||
   ['evacuations','homecomings'].some(k=>!Number.isSafeInteger(r[k])||r[k]<0)||
   (r.status==='lost'&&npc.alive))
   throw Error('Invalid saved refugee record');
  if(['evacuating','sheltered'].includes(r.status)&&
    r.shelter_area_id===null)throw Error('Evacuation has no safe destination');
  if(r.status==='sheltered'&&r.sheltered_minute<0)
   throw Error('Shelter arrival was never recorded');
  if(r.shelter_area_id&&['evacuating','sheltered'].includes(r.status)){
   const key=r.shelter_area_id+':'+r.shelter_x+','+r.shelter_y;
   if(seen.has(key))throw Error('Duplicate assigned refugee camp tile');
   seen.add(key);
  }
  evacuations+=r.evacuations;homecomings+=r.homecomings;
  if(r.status==='lost')losses++;
 }
 for(const [key,min] of Object.entries({total_evacuations:evacuations,
  total_homecomings:homecomings,total_lost:losses}))
  if(!Number.isSafeInteger(s[key])||s[key]<min)
   throw Error('Invalid refugee history totals');
 return true;
}
function event(world,minute,type,n,out,extra={}){
 const l=world.living,e={id:'event_'+(++l.event_sequence),
  minute,type,npc_id:n.id,area_id:n.area_id,
  text:n.name+' '+({
   'refugee.departed':'fled an overrun settlement.',
   'refugee.sheltered':'reached a temporary refuge.',
   'refugee.returning':'began the journey home.',
   'refugee.home':'returned to work after the danger passed.',
   'refugee.stranded':'was trapped without a safe route out.',
   'refugee.lost':'died while displaced.'
  }[type]||'changed refuge status.'),...extra};
 l.events.push(e);if(l.events.length>512)l.events.shift();out.push(e);
 return e;
}
function safeArea(world,n){
 const alternate=n.home_area===VILLAGE?COURT:VILLAGE;
 return world.living.territories[alternate]?.control==='settlers'?alternate:null;
}
function assign(world,n,area){
 const state=world.living.refugees,base=CAMP[area],map=world.areas[area];
 const used=new Set(Object.values(state.records).filter(r=>
  r.npc_id!==n.id&&r.shelter_area_id===area&&
  ['evacuating','sheltered'].includes(r.status))
  .map(r=>r.shelter_x+','+r.shelter_y));
 const reserved=new Set(Object.values(world.living.npcs).filter(x=>
  x.alive&&x.id!==n.id&&x.area_id===area).map(x=>x.x+','+x.y));
 const player=world.characters?.['1'];
 if(player?.area_id===area)reserved.add(player.x+','+player.y);
 let options=[];
 for(let y=base.y;y<base.y+base.height;y++)
  for(let x=base.x;x<base.x+base.width;x++){
   if(!traversable(map,x,y,'living')||used.has(x+','+y)||reserved.has(x+','+y))continue;
   options.push({x,y});
  }
 if(!options.length)return null;
 // Stable order based on resident identity, then rotating against occupied slots.
 const offset=[...n.id].reduce((v,c)=>(v*33+c.charCodeAt(0))>>>0,17)%options.length;
 return options[offset];
}
function change(world,n,record,status,minute,out,extra={}){
 if(record.status===status)return false;
 record.status=status;record.last_change_minute=minute;
 const types={evacuating:'refugee.departed',sheltered:'refugee.sheltered',
  returning:'refugee.returning',stranded:'refugee.stranded',
  home:'refugee.home',lost:'refugee.lost'};
 event(world,minute,types[status],n,out,extra);
 return true;
}
function plan(world,minute,events){
 if(!Number.isSafeInteger(minute)||minute<0)throw Error('Invalid refugee minute');
 if(minute%5!==0)return 0;
 ensure(world);const s=world.living.refugees;
 if(minute<=s.last_tick_minute)return 0;
 let transitions=0;
 for(const n of Object.values(world.living.npcs).filter(eligible)
   .sort((a,b)=>a.id.localeCompare(b.id))){
  const r=s.records[n.id];
  if(!n.alive){
   if(r.status!=='home'&&r.status!=='lost'){
    s.total_lost++;
    change(world,n,r,'lost',minute,events);
    transitions++;
   }
   continue;
  }
  const occupied=world.living.territories[n.home_area]?.control==='monsters';
  if(occupied){
   r.safe_since_minute=-1;
   const area=safeArea(world,n);
   if(!area){
    if(change(world,n,r,'stranded',minute,events))transitions++;
    r.shelter_area_id=null;r.shelter_x=null;r.shelter_y=null;
    continue;
   }
   if(r.status!=='evacuating'&&r.status!=='sheltered'||r.shelter_area_id!==area){
    const spot=assign(world,n,area);
    if(!spot){
     if(change(world,n,r,'stranded',minute,events))transitions++;
     r.shelter_area_id=null;r.shelter_x=null;r.shelter_y=null;
     continue;
    }
    r.shelter_area_id=area;r.shelter_x=spot.x;r.shelter_y=spot.y;
    r.displaced_minute=minute;r.sheltered_minute=-1;
    r.evacuations++;s.total_evacuations++;
    if(change(world,n,r,'evacuating',minute,events,{refuge_area_id:area}))
     transitions++;
   }
   if(r.status==='evacuating'&&n.area_id===r.shelter_area_id&&
      distance(n,{x:r.shelter_x,y:r.shelter_y})<=1){
    r.sheltered_minute=minute;
    if(change(world,n,r,'sheltered',minute,events))transitions++;
   }
   continue;
  }
  if(r.status==='home'||r.status==='lost')continue;
  if(r.safe_since_minute<0)r.safe_since_minute=minute;
  if(minute-r.safe_since_minute<SAFETY_MINUTES)continue;
  if(r.status!=='returning'){
   if(change(world,n,r,'returning',minute,events))transitions++;
  }
  if(n.area_id===n.home_area&&distance(n,{x:n.home_x,y:n.home_y})<=2){
   r.homecomings++;s.total_homecomings++;
   r.shelter_area_id=null;r.shelter_x=null;r.shelter_y=null;
   if(change(world,n,r,'home',minute,events))transitions++;
  }
 }
 s.last_tick_minute=minute;
 return transitions;
}
function destination(world,n){
 const r=world.living.refugees?.records[n.id];
 if(!r||!n.alive)return null;
 if(['evacuating','sheltered'].includes(r.status)&&r.shelter_area_id)
  return {area_id:r.shelter_area_id,x:r.shelter_x,y:r.shelter_y};
 if(r.status==='returning')
  return {area_id:n.home_area,x:n.home_x,y:n.home_y};
 if(r.status==='stranded')
  return {area_id:n.area_id,x:n.x,y:n.y}; // Trapped, not teleported.
 return null;
}
function listing(world,area_id=null){
 const s=world.living.refugees;
 return {world_minute:world.living.minute,
  total_evacuations:s?.total_evacuations||0,
  total_homecomings:s?.total_homecomings||0,total_lost:s?.total_lost||0,
  refugees:Object.values(s?.records||{}).filter(r=>
   r.status!=='home'&&(!area_id||world.living.npcs[r.npc_id]?.area_id===area_id))
   .map(r=>({npc_id:r.npc_id,status:r.status,home_area_id:r.home_area_id,
    area_id:world.living.npcs[r.npc_id]?.area_id||null,
    shelter_area_id:r.shelter_area_id,displaced_minute:r.displaced_minute,
    sheltered_minute:r.sheltered_minute,safe_since_minute:r.safe_since_minute}))
   .sort((a,b)=>a.npc_id.localeCompare(b.npc_id))};
}
module.exports={SAFETY_MINUTES,EXEMPT,CAMP,ensure,validate,assign,plan,destination,listing};
