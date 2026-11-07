'use strict';
// DK M30: bounded, deterministic carrion life. Only the server schedules birds.
// Individual visitors have persistent identities, positions, and action history.
const {traversable}=require('./regions.cjs');
const D=require('./corpse-decay-m29.cjs');
const LIMIT=48,INTERVAL=15,LINGER=45,VISITS_PER_BODY=2;
function ensure(world){
 if(!world.living)throw Error('Scavengers require a living world');
 if(world.living.scavengers)return false;
 world.living.scavengers={schema:1,sequence:0,visitors:{},total_visits:0};
 return true;
}
function distance(a,b){return Math.abs(a.x-b.x)+Math.abs(a.y-b.y);}
function log(world,minute,type,text,details,out){
 const l=world.living,e={id:'event_'+(++l.event_sequence),minute,type,text,...details};
 l.events.push(e);if(l.events.length>512)l.events.shift();out.push(e);
}
function nearbyTile(world,corpse,ordinal){
 const area=world.areas[corpse.area_id],offsets=[
  [-4,0],[0,-4],[4,0],[0,4],[-3,-2],[2,3],[3,-2],[-2,3]];
 for(let i=0;i<offsets.length;i++){
  const [dx,dy]=offsets[(ordinal+i)%offsets.length];
  const x=corpse.x+dx,y=corpse.y+dy;
  if(x>=0&&y>=0&&x<area.width&&y<area.height&&
    traversable(area,x,y,'living'))return {x,y};
 }
 return {x:corpse.x,y:corpse.y};
}
function choice(body,minute){
 if(body.preserved||D.expired(body,minute)||body.scavenger_visits>=VISITS_PER_BODY)
  return null;
 const stage=D.stageAt(body,minute);
 if(!['early','decaying'].includes(stage))return null;
 if(body.species==='demon')return 'beetle';
 if(body.scavenger_visits===0)return 'raven';
 return stage==='decaying'?'rat':null;
}
function approach(world,v,body){
 const area=world.areas[v.area_id];
 const dx=Math.sign(body.x-v.x),dy=Math.sign(body.y-v.y);
 const moves=Math.abs(body.x-v.x)>=Math.abs(body.y-v.y)?
  [[dx,0],[0,dy]]:[[0,dy],[dx,0]];
 for(const [sx,sy] of moves){
  if(!sx&&!sy)continue;
  const x=v.x+sx,y=v.y+sy;
  if(x>=0&&y>=0&&x<area.width&&y<area.height&&
     traversable(area,x,y,'living')){v.x=x;v.y=y;return;}
 }
}
function run(world,minute,out=[]){
 ensure(world);
 if(!Number.isSafeInteger(minute)||minute<0||minute%INTERVAL!==0)
  throw Error('Invalid scavenger scheduler minute');
 const living=world.living,flock=living.scavengers,corpses=living.mobile_assets?.corpses||{};
 // Existing visitors are processed before new ones are created; every visitor
 // can disturb a corpse at most once and never transfers or mints any loot.
 for(const visitor of Object.values(flock.visitors).sort((a,b)=>a.id.localeCompare(b.id))){
  const corpse=corpses[visitor.corpse_id];
  if(!corpse||corpse.preserved||D.expired(corpse,minute)||
    ['skeletal','scattered'].includes(D.stageAt(corpse,minute))||
    (visitor.visited&&minute-visitor.arrived_minute>=LINGER)){
   delete flock.visitors[visitor.id];
   continue;
  }
  if(!visitor.visited){
   approach(world,visitor,corpse);
   if(distance(visitor,corpse)<=1){
    visitor.visited=true;visitor.arrived_minute=minute;
    corpse.disturbed=true;corpse.scavenger_visits=(corpse.scavenger_visits||0)+1;
    flock.total_visits++;
    log(world,minute,'corpse.scavenged',
      'A scavenger disturbed exposed remains.',
      {corpse_id:corpse.id,scavenger_id:visitor.id,area_id:corpse.area_id},out);
   }
  }
  visitor.last_move_minute=minute;
 }
 if(Object.keys(flock.visitors).length>=LIMIT)return;
 for(const corpse of Object.values(corpses).sort((a,b)=>a.id.localeCompare(b.id))){
  if(Object.keys(flock.visitors).length>=LIMIT)break;
  if(Object.values(flock.visitors).some(v=>v.corpse_id===corpse.id))continue;
  const kind=choice(corpse,minute);if(!kind)continue;
  const location=nearbyTile(world,corpse,flock.sequence);
  const id='scavenger_'+(++flock.sequence);
  flock.visitors[id]={id,kind,corpse_id:corpse.id,area_id:corpse.area_id,
   x:location.x,y:location.y,spawn_minute:minute,last_move_minute:minute,
   arrived_minute:null,visited:false};
  log(world,minute,'scavenger.arrived','Carrion life gathered near remains.',
   {scavenger_id:id,kind,corpse_id:corpse.id,area_id:corpse.area_id},out);
 }
}
function validate(world){
 const s=world.living?.scavengers;
 if(!s)return true; // Old M29 world, migrated on startup.
 if(s.schema!==1||!Number.isSafeInteger(s.sequence)||s.sequence<0||
   !Number.isSafeInteger(s.total_visits)||s.total_visits<0||
   !s.visitors||Array.isArray(s.visitors)||Object.keys(s.visitors).length>LIMIT)
  throw Error('Invalid scavenger population');
 for(const [id,v] of Object.entries(s.visitors)){
  const area=world.areas[v?.area_id];
  if(!/^scavenger_[1-9][0-9]*$/.test(id)||v.id!==id||
    !['raven','rat','beetle'].includes(v.kind)||
    !/^corpse_[1-9][0-9]*$/.test(v.corpse_id)||!area||
    !Number.isSafeInteger(v.x)||!Number.isSafeInteger(v.y)||
    v.x<0||v.y<0||v.x>=area.width||v.y>=area.height||
    !Number.isSafeInteger(v.spawn_minute)||v.spawn_minute<0||
    !Number.isSafeInteger(v.last_move_minute)||v.last_move_minute<v.spawn_minute||
    typeof v.visited!=='boolean'||
    (v.visited?!Number.isSafeInteger(v.arrived_minute)||v.arrived_minute<v.spawn_minute:
      v.arrived_minute!==null))
    throw Error('Invalid scavenger record');
 }
 return true;
}
module.exports={LIMIT,INTERVAL,LINGER,ensure,run,validate,choice};
