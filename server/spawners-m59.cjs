'use strict';
// M59: world-owned persistent spawn controllers.
// Independently designed around RunUO's saved spawner concept; no GPL code.
const {COURT,VILLAGE}=require('./regions.cjs');
const CREATURES=require('./creatures-m42.cjs');
const PROFILES=Object.freeze([
 Object.freeze({id:'courtyard_siege',area_id:COURT,mode:'siege',interval:90,cap:8,batch:2}),
 Object.freeze({id:'village_siege',area_id:VILLAGE,mode:'siege',interval:90,cap:8,batch:2}),
 Object.freeze({id:'courtyard_wild',area_id:COURT,mode:'wild',interval:120,cap:2,batch:1,species:'wolf'}),
 Object.freeze({id:'village_wild',area_id:VILLAGE,mode:'wild',interval:120,cap:2,batch:1,species:'bandit'})
]);
const BY_ID=Object.freeze(Object.fromEntries(PROFILES.map(p=>[p.id,p])));
const MAX_MINUTE=Number.MAX_SAFE_INTEGER-10000;
const LIBERATION_GRACE=120;
function future(minute,interval){
 return Math.floor(minute/interval)*interval+interval;
}
function seed(minute=0){
 if(!Number.isSafeInteger(minute)||minute<0||minute>=MAX_MINUTE)
  throw Error('Invalid spawn clock');
 return {schema:1,zones:Object.fromEntries(PROFILES.map(p=>[p.id,{
  id:p.id,area_id:p.area_id,mode:p.mode,interval_minutes:p.interval,
  next_due_minute:future(minute,p.interval),last_processed_minute:-1,
  last_spawn_minute:-1,spawns:0,suppressed_until_minute:0
 }]))};
}
function ensure(world){
 if(!world?.living)throw Error('Spawners require a saved world');
 if(!world.living.spawners){
  world.living.spawners=seed(world.living.minute);return true;
 }
 // Safe non-destructive migration if a newer official profile is added.
 const s=world.living.spawners,template=seed(world.living.minute);
 let added=false;
 for(const [id,entry] of Object.entries(template.zones))
  if(!Object.hasOwn(s.zones,id)){s.zones[id]=entry;added=true;}
 return added;
}
function validate(world){
 const s=world.living?.spawners;
 if(!s)return true; // M58 and older snapshots migrate at startup.
 if(s.schema!==1||!s.zones||Array.isArray(s.zones)||
  Object.keys(s.zones).length!==PROFILES.length)
  throw Error('Invalid persistent creature spawners');
 const minute=world.living.minute;
 for(const p of PROFILES){
  const z=s.zones[p.id];
  if(!z||z.id!==p.id||z.area_id!==p.area_id||z.mode!==p.mode||
   z.interval_minutes!==p.interval||
   !Number.isSafeInteger(z.next_due_minute)||z.next_due_minute<1||
   z.next_due_minute>=MAX_MINUTE||
   !Number.isSafeInteger(z.last_processed_minute)||z.last_processed_minute< -1||
   z.last_processed_minute>minute||
   !Number.isSafeInteger(z.last_spawn_minute)||z.last_spawn_minute< -1||
   z.last_spawn_minute>minute||
   !Number.isSafeInteger(z.spawns)||z.spawns<0||z.spawns>MAX_MINUTE||
   !Number.isSafeInteger(z.suppressed_until_minute)||
   z.suppressed_until_minute<0||z.suppressed_until_minute>=MAX_MINUTE)
   throw Error('Invalid persistent spawn controller');
 }
 for(const id of Object.keys(s.zones))
  if(!BY_ID[id])throw Error('Unexpected spawn controller');
 return true;
}
function suppressAfterLiberation(world,area_id,minute){
 ensure(world);
 if(!Number.isSafeInteger(minute)||minute<0)throw Error('Invalid liberation minute');
 const z=world.living.spawners.zones[
  area_id===COURT?'courtyard_siege':area_id===VILLAGE?'village_siege':''];
 if(z)z.suppressed_until_minute=Math.max(z.suppressed_until_minute,minute+LIBERATION_GRACE);
}
function tick(world,minute,events,spawn){
 if(!Number.isSafeInteger(minute)||minute<0||minute>=MAX_MINUTE)
  throw Error('Invalid spawn minute');
 if(typeof spawn!=='function')throw Error('Server spawn callback required');
 ensure(world);
 const l=world.living,creatures=l.combat?.creatures||{};
 let created=0;
 for(const p of PROFILES){
  const z=l.spawners.zones[p.id];
  if(minute<=z.last_processed_minute)continue; // exact-once per world minute
  z.last_processed_minute=minute;
  const terr=l.territories[p.area_id];
  const stationed=Object.values(creatures).filter(m=>m.alive&&m.area_id===p.area_id).length;
  // The first occupation is urgent. A cleared siege retains its cooldown
  // even if the territory changes hands again immediately.
  let seeded=false;
  if(p.mode==='siege'&&terr?.control==='monsters'&&stationed===0&&
   minute>=z.suppressed_until_minute){
   const count=p.area_id===COURT?3:5;
   const n=spawn(world,p.area_id,minute,events,count,'imp')||0;
   if(n){z.spawns+=n;z.last_spawn_minute=minute;created+=n;seeded=true;}
  }
  if(minute<z.next_due_minute)continue;
  // Due timestamps are anchored to the world clock, not the browser clock.
  // In particular, visiting a region cannot restart its countdown.
  z.next_due_minute=future(minute,p.interval);
  // A first siege wave counts as this minute's spawn; no double batch.
  if(seeded)continue;
  const occupied=terr?.control==='monsters';
  if((p.mode==='siege')!==occupied||
   minute<z.suppressed_until_minute)continue;
  const population=Object.values(l.combat?.creatures||{})
   .filter(m=>m.alive&&m.area_id===p.area_id).length;
  if(population>=p.cap)continue;
  if(p.mode==='wild'&&terr.threat<2)continue;
  const kind=p.mode==='siege'?
   CREATURES.select(p.area_id,minute,l.combat.sequence):p.species;
  const n=spawn(world,p.area_id,minute,events,Math.min(p.batch,p.cap-population),kind)||0;
  if(n){z.spawns+=n;z.last_spawn_minute=minute;created+=n;}
 }
 return created;
}
function listing(world){
 const l=world.living;
 return {world_minute:l.minute,revision:world.revision,
  zones:PROFILES.map(p=>{
   const z=l.spawners?.zones[p.id];
   return {id:p.id,area_id:p.area_id,mode:p.mode,
    species:p.species||'regional_rotation',capacity:p.cap,
    population:Object.values(l.combat?.creatures||{})
     .filter(c=>c.alive&&c.area_id===p.area_id).length,
    next_due_minute:z?.next_due_minute??future(l.minute,p.interval),
    last_spawn_minute:z?.last_spawn_minute??-1,
    suppressed_until_minute:z?.suppressed_until_minute??0,
    total_created:z?.spawns??0};
  })};
}
module.exports={PROFILES,LIBERATION_GRACE,seed,ensure,validate,tick,
 suppressAfterLiberation,listing};
